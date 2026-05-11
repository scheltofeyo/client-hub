import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel } from "@/lib/models/Project";
import { SessionModel } from "@/lib/models/Session";
import { ClientModel } from "@/lib/models/Client";
import { ServiceModel } from "@/lib/models/Service";
import { UserModel } from "@/lib/models/User";

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

  // Archived plans are not public.
  if (plan.status === "archived") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = await ClientModel.findById(plan.clientId, { _id: 1, company: 1, primaryColor: 1 }).lean();
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

  const [projects, services] = await Promise.all([
    ProjectModel.find({ clientId: plan.clientId, planId: plan._id.toString() })
      .sort({ createdAt: 1 })
      .lean(),
    ServiceModel.find({}, { _id: 1, name: 1 }).lean(),
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
        { _id: 1, firstName: 1, preposition: 1, lastName: 1, googleName: 1, email: 1 }
      ).lean()
    : [];
  const publicNameById = new Map<string, string>(
    userDocs.map((u) => [u._id.toString(), publicName(u)])
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

    return {
      id: p._id.toString(),
      title: p.title,
      service: p.serviceId ? serviceMap.get(p.serviceId) ?? null : null,
      scheduledStartDate: start,
      scheduledEndDate: end,
      durationDays,
      soldPrice: p.soldPrice ?? 0,
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

  // Compute totals (server-side so client sees the source of truth)
  const subtotal = sanitizedProjects.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
  let discountAmount = 0;
  if (plan.discountType === "percentage" && plan.discountValue) {
    discountAmount = subtotal * (Number(plan.discountValue) / 100);
  } else if (plan.discountType === "amount" && plan.discountValue) {
    discountAmount = Number(plan.discountValue);
  }
  const net = Math.max(0, subtotal - discountAmount);
  const vatAmount = plan.vatRate ? net * (Number(plan.vatRate) / 100) : 0;
  const total = net + vatAmount;

  return NextResponse.json({
    plan: {
      title: plan.title,
      summary: plan.summary ?? null,
      proposerStatement: plan.proposerStatement ?? null,
      status: plan.status,
      presentedAt: plan.presentedAt ?? null,
      acceptedAt: plan.acceptedAt ?? null,
      acceptedByClient: plan.acceptedByClient ?? null,
      discountType: plan.discountType ?? null,
      discountValue: plan.discountValue ?? null,
      vatRate: plan.vatRate ?? null,
      createdBy: {
        name: plan.createdBy?.userId
          ? publicNameById.get(plan.createdBy.userId) ?? plan.createdBy.name ?? ""
          : plan.createdBy?.name ?? "",
        image: plan.createdBy?.image ?? null,
      },
    },
    client: {
      company: client.company as string,
      primaryColor: (client.primaryColor as string | undefined) ?? null,
    },
    projects: sanitizedProjects,
    team: allTeam,
    totals: {
      subtotal,
      discountAmount,
      net,
      vatAmount,
      total,
    },
  });
}
