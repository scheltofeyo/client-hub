import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { SessionModel } from "@/lib/models/Session";
import { ClientModel } from "@/lib/models/Client";
import { ServiceModel } from "@/lib/models/Service";
import { UserModel } from "@/lib/models/User";
import { ProjectRoleModel } from "@/lib/models/ProjectRole";
import { getOrganizationSettings } from "@/lib/models/OrganizationSettings";
import { getOrSeedProposalTerms } from "@/lib/models/ProposalTermsSection";
import { DEFAULT_VALIDITY_DAYS } from "@/lib/proposal-copy";
import { discountAmountFor } from "@/lib/pricing";

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateIso;
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Build the name shown on the public proposal. We deliberately skip `displayName`
 * (which is an internal/admin override) and prefer the structured firstName +
 * preposition + lastName. Fallback to googleName (real name from Google) so the
 * proposal never leaks an internal alias.
 */
function publicName(u: {
  firstName?: string | null;
  preposition?: string | null;
  lastName?: string | null;
  googleName?: string | null;
  email?: string | null;
}): string {
  const parts = [u.firstName, u.preposition, u.lastName].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(" ");
  if (u.googleName) return u.googleName;
  return u.email ?? "";
}

/**
 * Public proposal data — anything that ends up in this response is shown to the client.
 * Strip:
 *   - role allocation rates / multipliers / external cost rates (internal-only pricing model)
 *   - admin/internal status semantics (we map to "open" vs "accepted")
 *   - sections marked hidden per draft project
 *
 * Keep:
 *   - plan title, summary, totals
 *   - per-project content sections (only visible ones)
 *   - assigned users (name + image only) — so the proposal feels personal
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const plan = await ProjectPlanModel.findOne({ shareCode }).lean();
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const client = await ClientModel.findById(plan.clientId, {
    _id: 1, company: 1, primaryColor: 1, culturalDna: 1,
    addressStreet: 1, addressPostalCode: 1, addressCity: 1, addressCountry: 1,
    contacts: 1,
  }).lean();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Plan is still being worked on (draft) — never expose content, but render a friendly
  // "in progress" surface so a client who already received the link doesn't see a 404.
  if (plan.status === "draft") {
    return NextResponse.json({
      plan: {
        title: plan.title,
        status: "draft" as const,
      },
      client: {
        company: client.company as string,
        primaryColor: (client.primaryColor as string | undefined) ?? null,
      },
      inProgress: true,
    });
  }

  const [projects, services, projectRoles, organization, legalTermsAll] = await Promise.all([
    ProjectModel.find({ clientId: plan.clientId, planId: plan._id.toString() })
      .sort({ createdAt: 1 })
      .lean(),
    ServiceModel.find({}, { _id: 1, name: 1 }).lean(),
    ProjectRoleModel.find({}, { name: 1, dayRate: 1, marginMultiplier: 1, rank: 1, bioNL: 1, bioEN: 1 })
      .sort({ rank: 1, createdAt: 1 })
      .lean(),
    getOrganizationSettings(),
    getOrSeedProposalTerms(),
  ]);

  const projectIds = projects.map((p) => p._id.toString());
  const sessions = projectIds.length > 0
    ? await SessionModel.find({ projectId: { $in: projectIds } }).sort({ date: 1, createdAt: 1 }).lean()
    : [];

  const serviceMap = new Map<string, string>(services.map((s) => [s._id.toString(), s.name as string]));

  // Collect every userId that will end up in the public payload so we can resolve
  // their full structured names in one query (no displayName).
  const referencedUserIds = new Set<string>();
  for (const p of projects) {
    for (const line of p.roleAllocation ?? []) {
      if (line.assignedUser?.userId) referencedUserIds.add(line.assignedUser.userId);
    }
    for (const m of p.members ?? []) {
      if (m.userId) referencedUserIds.add(m.userId);
    }
  }
  if (plan.createdBy?.userId) referencedUserIds.add(plan.createdBy.userId);

  const userDocs = referencedUserIds.size > 0
    ? await UserModel.find(
        { _id: { $in: Array.from(referencedUserIds) } },
        { _id: 1, firstName: 1, preposition: 1, lastName: 1, googleName: 1, email: 1, projectRoleId: 1 }
      ).lean()
    : [];
  const publicNameById = new Map<string, string>(
    userDocs.map((u) => [u._id.toString(), publicName(u)])
  );
  const projectRoleIdByUserId = new Map<string, string | undefined>(
    userDocs.map((u) => [u._id.toString(), (u as { projectRoleId?: string }).projectRoleId])
  );
  const projectRoleById = new Map<string, { name: string; bioNL?: string; bioEN?: string }>(
    projectRoles.map((r) => [r._id.toString(), { name: r.name, bioNL: r.bioNL, bioEN: r.bioEN }])
  );

  type SanitizedTeamMember = { userId: string; name: string; image?: string; roleLabel?: string | null };

  const sanitizedProjects = projects.map((p) => {
    const hidden = new Set((p.hiddenSections as string[] | undefined) ?? []);
    const team: SanitizedTeamMember[] = [];
    const seen = new Set<string>();
    for (const line of p.roleAllocation ?? []) {
      const u = line.assignedUser;
      if (!u || !u.userId || seen.has(u.userId)) continue;
      seen.add(u.userId);
      team.push({
        userId: u.userId,
        name: publicNameById.get(u.userId) ?? u.name,
        image: u.image ?? undefined,
        roleLabel: line.roleName || null,
      });
    }
    // Also include project members that aren't already in the team list (no role assigned)
    for (const m of p.members ?? []) {
      if (!m.userId || seen.has(m.userId)) continue;
      seen.add(m.userId);
      team.push({
        userId: m.userId,
        name: publicNameById.get(m.userId) ?? m.name,
        image: m.image ?? undefined,
        roleLabel: null,
      });
    }

    const start = p.scheduledStartDate ?? null;
    const end = p.scheduledEndDate ?? null;
    let durationDays: number | null = null;
    if (start && end) {
      const s = new Date(start + "T00:00:00").getTime();
      const e = new Date(end + "T00:00:00").getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
        durationDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
      }
    }

    // Sessions for this project — strip internal fields (createdBy, remoteLink, template refs)
    const projectSessions = sessions
      .filter((s) => (s.projectId as string | undefined) === p._id.toString())
      .map((s) => ({
        id: s._id.toString(),
        title: s.title as string,
        date: (s.date as string | undefined) ?? null,
        location: (s.location as string | undefined) ?? null,
        info: (s.info as string | undefined) ?? null,
        participantCount: Array.isArray(s.participants) ? s.participants.length : 0,
      }));

    const gross = p.soldPrice ?? 0;
    const projectDiscount = discountAmountFor(gross, p.discountType, p.discountValue);

    return {
      id: p._id.toString(),
      title: p.title,
      service: p.serviceId ? serviceMap.get(p.serviceId) ?? null : null,
      scheduledStartDate: start,
      scheduledEndDate: end,
      durationDays,
      soldPrice: gross,
      discountType: p.discountType ?? null,
      discountValue: p.discountValue ?? null,
      discountAmount: projectDiscount,
      netPrice: gross - projectDiscount,
      // Sections — only the visible ones, no breakdowns
      sections: {
        why: !hidden.has("why") && p.why ? p.why : null,
        how: !hidden.has("how") && p.how ? p.how : null,
        what: !hidden.has("what") && p.what ? p.what : null,
        activities: !hidden.has("activities") && p.activities ? p.activities : null,
        deliverables: !hidden.has("deliverables") && p.deliverables ? p.deliverables : null,
      },
      team,
      sessions: projectSessions,
    };
  });

  // Aggregate team across all projects (deduped). Count role frequencies per user so we can
  // surface the most-used role as their canonical label in the proposal-wide team list.
  const allTeamMap = new Map<string, SanitizedTeamMember & { projectCount: number; roleCounts: Map<string, number> }>();
  for (const proj of sanitizedProjects) {
    for (const m of proj.team) {
      const existing = allTeamMap.get(m.userId);
      if (existing) {
        existing.projectCount += 1;
        if (m.roleLabel) {
          existing.roleCounts.set(m.roleLabel, (existing.roleCounts.get(m.roleLabel) ?? 0) + 1);
        }
      } else {
        const roleCounts = new Map<string, number>();
        if (m.roleLabel) roleCounts.set(m.roleLabel, 1);
        allTeamMap.set(m.userId, { ...m, projectCount: 1, roleCounts });
      }
    }
  }
  const allTeam = Array.from(allTeamMap.values())
    .map((m) => {
      // Pick the most-frequent role label as canonical for this user in this proposal.
      let topRole: string | null = null;
      let topCount = 0;
      for (const [r, c] of m.roleCounts) {
        if (c > topCount) {
          topCount = c;
          topRole = r;
        }
      }
      return {
        userId: m.userId,
        name: m.name,
        image: m.image,
        roleLabel: topRole,
        projectCount: m.projectCount,
      };
    })
    .sort((a, b) => b.projectCount - a.projectCount);

  // Compute totals (server-side so client sees the source of truth).
  // Discount is per project; the totals line aggregates them.
  const subtotal = sanitizedProjects.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
  const discountAmount = sanitizedProjects.reduce((s, p) => s + p.discountAmount, 0);
  const net = Math.max(0, subtotal - discountAmount);
  const vatAmount = plan.vatRate ? net * (Number(plan.vatRate) / 100) : 0;
  const total = net + vatAmount;

  const language: "nl" | "en" = (plan.language as "nl" | "en" | undefined) ?? "nl";

  // Resolved validity date: explicit value wins; otherwise presentedAt + default days.
  const resolvedValidUntil =
    plan.validUntilDate?.trim()
      ? plan.validUntilDate.trim()
      : plan.presentedAt
        ? addDaysIso(plan.presentedAt, DEFAULT_VALIDITY_DAYS)
        : null;

  // Proposer's job title from their linked ProjectRole (if any), shown on the PDF cover.
  const proposerProjectRoleId = plan.createdBy?.userId
    ? projectRoleIdByUserId.get(plan.createdBy.userId)
    : undefined;
  const proposerRoleName = proposerProjectRoleId
    ? projectRoleById.get(proposerProjectRoleId)?.name ?? null
    : null;

  // Team bios — attach the per-user role bio in the plan's language.
  const teamWithBios = allTeam.map((m) => {
    const roleId = projectRoleIdByUserId.get(m.userId);
    const role = roleId ? projectRoleById.get(roleId) : undefined;
    const bio = role ? (language === "en" ? role.bioEN : role.bioNL) ?? null : null;
    return {
      userId: m.userId,
      name: m.name,
      image: m.image,
      roleName: role?.name ?? m.roleLabel ?? null,
      roleLabel: m.roleLabel,
      projectCount: m.projectCount,
      bio,
    };
  });

  // Rate table — only roles actually used in this plan's projects, hourlyRate = dayRate * marginMultiplier / 8.
  const usedRoleIds = new Set<string>();
  for (const p of projects) {
    for (const line of p.roleAllocation ?? []) {
      if (line.roleId) usedRoleIds.add(line.roleId);
    }
  }
  const rates = projectRoles
    .filter((r) => usedRoleIds.has(r._id.toString()) && Number(r.dayRate) > 0)
    .map((r) => ({
      name: r.name as string,
      hourlyRate: Math.round((Number(r.dayRate) * Number(r.marginMultiplier ?? 1)) / 8),
    }));

  // Legal terms — picked per-language.
  const legalTerms = legalTermsAll.map((t) => ({
    slug: t.slug,
    title: language === "en" ? t.titleEN : t.titleNL,
    content: language === "en" ? t.contentEN : t.contentNL,
  }));

  // Primary contact — first contact entry on the client (if any).
  const primaryContact = Array.isArray(client.contacts) && client.contacts.length > 0
    ? client.contacts[0]
    : null;

  return NextResponse.json({
    plan: {
      title: plan.title,
      summary: plan.summary ?? null,
      proposerStatement: plan.proposerStatement ?? null,
      status: plan.status,
      presentedAt: plan.presentedAt ?? null,
      acceptedAt: plan.acceptedAt ?? null,
      acceptedByClient: plan.acceptedByClient ?? null,
      vatRate: plan.vatRate ?? null,
      language,
      validUntilDate: resolvedValidUntil,
      proposalNumber: plan.proposalNumber ?? null,
      versionLabel: plan.versionLabel ?? null,
      challenge: plan.challenge ?? null,
      context: plan.context ?? null,
      approach: plan.approach ?? null,
      createdBy: {
        name: plan.createdBy?.userId
          ? publicNameById.get(plan.createdBy.userId) ?? plan.createdBy.name ?? ""
          : plan.createdBy?.name ?? "",
        image: plan.createdBy?.image ?? null,
        roleName: proposerRoleName,
      },
    },
    client: {
      company: client.company as string,
      primaryColor: (client.primaryColor as string | undefined) ?? null,
      cultureColors: Array.isArray(client.culturalDna)
        ? client.culturalDna.map((v) => v.color).filter(Boolean)
        : [],
      contactName: primaryContact
        ? [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(" ")
        : null,
      contactEmail: primaryContact?.email ?? null,
      addressStreet: client.addressStreet ?? null,
      addressPostalCode: client.addressPostalCode ?? null,
      addressCity: client.addressCity ?? null,
      addressCountry: client.addressCountry ?? null,
    },
    organization: {
      addressStreet: organization.addressStreet ?? null,
      addressPostalCode: organization.addressPostalCode ?? null,
      addressCity: organization.addressCity ?? null,
      addressCountry: organization.addressCountry ?? null,
      kvkNumber: organization.kvkNumber ?? null,
      btwNumber: organization.btwNumber ?? null,
      iban: organization.iban ?? null,
      website: organization.website ?? null,
      email: organization.email ?? null,
    },
    projects: sanitizedProjects,
    team: teamWithBios,
    rates,
    legalTerms,
    totals: {
      subtotal,
      discountAmount,
      net,
      vatAmount,
      total,
    },
  });
}
