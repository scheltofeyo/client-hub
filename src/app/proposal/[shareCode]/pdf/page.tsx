import { notFound } from "next/navigation";
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
import { copyFor, DEFAULT_VALIDITY_DAYS, type ProposalCopy } from "@/lib/proposal-copy";
import DownloadPdfButton from "./DownloadPdfButton";
import SummLogo from "@/components/ui/SummLogo";

export const dynamic = "force-dynamic";

// Compact, paper-style render of a proposal — meant for Playwright to convert to PDF.
// All styles live inline so this page is fully self-contained.

// ── Types ──────────────────────────────────────────────────────────────────

interface ProposalProject {
  id: string;
  title: string;
  service: string | null;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  durationDays: number | null;
  soldPrice: number;
  sections: {
    why: string | null;
    how: string | null;
    what: string | null;
    activities: string | null;
    deliverables: string | null;
  };
  team: { userId: string; name: string; roleLabel?: string | null }[];
  sessions: { id: string; title: string; date: string | null; location: string | null }[];
}

type Language = "nl" | "en";

interface TeamMember {
  userId: string;
  name: string;
  image?: string | null;
  roleName: string | null;
  bio: string | null;
}

interface Org {
  logoUrl: string | null;
  addressStreet: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  kvkNumber: string | null;
  btwNumber: string | null;
  iban: string | null;
  website: string | null;
  email: string | null;
}

interface ProposalData {
  language: Language;
  plan: {
    title: string;
    summary: string | null;
    proposerStatement: string | null;
    status: "ready" | "accepted" | "finalized";
    presentedAt: string | null;
    acceptedAt: string | null;
    acceptedByClient: { name: string; email: string } | null;
    discountType: "percentage" | "amount" | null;
    discountValue: number | null;
    vatRate: number | null;
    validUntilDate: string | null;
    proposalNumber: string | null;
    versionLabel: string | null;
    challenge: string | null;
    context: string | null;
    approach: string | null;
    createdBy: { name: string; email?: string | null; roleName: string | null };
  };
  client: {
    company: string;
    primaryColor: string | null;
    contactName: string | null;
    contactEmail: string | null;
    addressStreet: string | null;
    addressPostalCode: string | null;
    addressCity: string | null;
    addressCountry: string | null;
  };
  organization: Org;
  projects: ProposalProject[];
  team: TeamMember[];
  rates: { name: string; hourlyRate: number }[];
  legalTerms: { slug: string; title: string; content: string }[];
  totals: { subtotal: number; discountAmount: number; net: number; vatAmount: number; total: number };
}

// ── Data fetch (server-side, single round trip) ───────────────────────────

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

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateIso;
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function loadProposal(shareCode: string): Promise<ProposalData | null> {
  await connectDB();

  const plan = await ProjectPlanModel.findOne({ shareCode }).lean();
  if (!plan || plan.status === "draft") return null;

  const client = await ClientModel.findById(plan.clientId, {
    _id: 1, company: 1, primaryColor: 1,
    addressStreet: 1, addressPostalCode: 1, addressCity: 1, addressCountry: 1,
    contacts: 1,
  }).lean();
  if (!client) return null;

  const [projects, services, projectRoles, organization, legalTermsAll] = await Promise.all([
    ProjectModel.find({ clientId: plan.clientId, planId: plan._id.toString() }).sort({ createdAt: 1 }).lean(),
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

  const referencedUserIds = new Set<string>();
  for (const p of projects) {
    for (const line of p.roleAllocation ?? []) {
      if (line.assignedUser?.userId) referencedUserIds.add(line.assignedUser.userId);
    }
    for (const m of p.members ?? []) if (m.userId) referencedUserIds.add(m.userId);
  }
  if (plan.createdBy?.userId) referencedUserIds.add(plan.createdBy.userId);

  const userDocs = referencedUserIds.size > 0
    ? await UserModel.find(
        { _id: { $in: Array.from(referencedUserIds) } },
        { _id: 1, firstName: 1, preposition: 1, lastName: 1, googleName: 1, email: 1, projectRoleId: 1, googleImage: 1, displayImage: 1 }
      ).lean()
    : [];

  const nameById = new Map<string, string>(userDocs.map((u) => [u._id.toString(), publicName(u)]));
  const projectRoleIdByUserId = new Map<string, string | undefined>(
    userDocs.map((u) => [u._id.toString(), (u as { projectRoleId?: string }).projectRoleId])
  );
  const imageByUserId = new Map<string, string | undefined>(
    userDocs.map((u) => [u._id.toString(), (u as { displayImage?: string; googleImage?: string }).displayImage ?? (u as { googleImage?: string }).googleImage])
  );
  const emailByUserId = new Map<string, string | undefined>(
    userDocs.map((u) => [u._id.toString(), (u as { email?: string }).email])
  );
  const projectRoleById = new Map<string, { name: string; bioNL?: string; bioEN?: string }>(
    projectRoles.map((r) => [r._id.toString(), { name: r.name as string, bioNL: r.bioNL, bioEN: r.bioEN }])
  );

  const language: Language = (plan.language as Language | undefined) ?? "nl";

  const sanitizedProjects: ProposalProject[] = projects.map((p) => {
    const hidden = new Set((p.hiddenSections as string[] | undefined) ?? []);
    const team: ProposalProject["team"] = [];
    const seen = new Set<string>();
    for (const line of p.roleAllocation ?? []) {
      const u = line.assignedUser;
      if (!u || !u.userId || seen.has(u.userId)) continue;
      seen.add(u.userId);
      team.push({ userId: u.userId, name: nameById.get(u.userId) ?? u.name, roleLabel: line.roleName || null });
    }
    for (const m of p.members ?? []) {
      if (!m.userId || seen.has(m.userId)) continue;
      seen.add(m.userId);
      team.push({ userId: m.userId, name: nameById.get(m.userId) ?? m.name, roleLabel: null });
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

    const projectSessions = sessions
      .filter((s) => (s.projectId as string | undefined) === p._id.toString())
      .map((s) => ({
        id: s._id.toString(),
        title: s.title as string,
        date: (s.date as string | undefined) ?? null,
        location: (s.location as string | undefined) ?? null,
      }));

    return {
      id: p._id.toString(),
      title: p.title,
      service: p.serviceId ? serviceMap.get(p.serviceId) ?? null : null,
      scheduledStartDate: start,
      scheduledEndDate: end,
      durationDays,
      soldPrice: p.soldPrice ?? 0,
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

  // Dedupe team across all projects
  const teamMap = new Map<string, TeamMember>();
  for (const proj of sanitizedProjects) {
    for (const m of proj.team) {
      if (teamMap.has(m.userId)) continue;
      const roleId = projectRoleIdByUserId.get(m.userId);
      const role = roleId ? projectRoleById.get(roleId) : undefined;
      const bio = role ? (language === "en" ? role.bioEN : role.bioNL) ?? null : null;
      teamMap.set(m.userId, {
        userId: m.userId,
        name: m.name,
        image: imageByUserId.get(m.userId) ?? null,
        roleName: role?.name ?? m.roleLabel ?? null,
        bio,
      });
    }
  }
  const team = Array.from(teamMap.values());

  // Totals
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

  // Rates table — only roles actually used in this plan's projects.
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

  // Legal terms per language
  const legalTerms = legalTermsAll.map((t) => ({
    slug: t.slug,
    title: language === "en" ? t.titleEN : t.titleNL,
    content: language === "en" ? t.contentEN : t.contentNL,
  }));

  // Resolved validity
  const resolvedValidUntil = plan.validUntilDate?.trim()
    ? plan.validUntilDate.trim()
    : plan.presentedAt
      ? addDaysIso(plan.presentedAt, DEFAULT_VALIDITY_DAYS)
      : null;

  // Primary contact
  const primaryContact = Array.isArray(client.contacts) && client.contacts.length > 0 ? client.contacts[0] : null;

  // Proposer details
  const proposerUserId = plan.createdBy?.userId;
  const proposerRoleId = proposerUserId ? projectRoleIdByUserId.get(proposerUserId) : undefined;

  return {
    language,
    plan: {
      title: plan.title,
      summary: plan.summary ?? null,
      proposerStatement: plan.proposerStatement ?? null,
      status: plan.status as "ready" | "accepted" | "finalized",
      presentedAt: plan.presentedAt ?? null,
      acceptedAt: plan.acceptedAt ?? null,
      acceptedByClient: plan.acceptedByClient ?? null,
      discountType: plan.discountType ?? null,
      discountValue: plan.discountValue ?? null,
      vatRate: plan.vatRate ?? null,
      validUntilDate: resolvedValidUntil,
      proposalNumber: plan.proposalNumber ?? null,
      versionLabel: plan.versionLabel ?? null,
      challenge: plan.challenge ?? null,
      context: plan.context ?? null,
      approach: plan.approach ?? null,
      createdBy: {
        name: proposerUserId ? nameById.get(proposerUserId) ?? plan.createdBy?.name ?? "" : plan.createdBy?.name ?? "",
        email: proposerUserId ? emailByUserId.get(proposerUserId) ?? null : null,
        roleName: proposerRoleId ? projectRoleById.get(proposerRoleId)?.name ?? null : null,
      },
    },
    client: {
      company: client.company as string,
      primaryColor: (client.primaryColor as string | undefined) ?? null,
      contactName: primaryContact ? [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(" ") : null,
      contactEmail: primaryContact?.email ?? null,
      addressStreet: client.addressStreet ?? null,
      addressPostalCode: client.addressPostalCode ?? null,
      addressCity: client.addressCity ?? null,
      addressCountry: client.addressCountry ?? null,
    },
    organization: {
      logoUrl: organization.logoUrl ?? null,
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
    team,
    rates,
    legalTerms,
    totals: { subtotal, discountAmount, net, vatAmount, total },
  };
}

// ── Formatters ──────────────────────────────────────────────────────────────

function localeFor(lang: Language): string {
  return lang === "en" ? "en-GB" : "nl-NL";
}
function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function formatDate(s: string | null, lang: Language): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(localeFor(lang), { day: "numeric", month: "long", year: "numeric" });
}
function formatDateShort(s: string | null, lang: Language): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(localeFor(lang), { day: "numeric", month: "short", year: "numeric" });
}

// Whitelist-sanitize rich-text HTML from the TipTap editor. Keeps the inline
// formatting + list structure the editor can produce (p, strong, em, ul, ol,
// li, br) and strips everything else, including all attributes. This lets the
// PDF render bullets and bold/italic instead of flattening to plain paragraphs.
const ALLOWED_RICH_TAGS = new Set(["p", "strong", "em", "ul", "ol", "li", "br"]);
function sanitizeRichHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    const t = (tag as string).toLowerCase();
    if (!ALLOWED_RICH_TAGS.has(t)) return "";
    return match.startsWith("</") ? `</${t}>` : `<${t}>`;
  });
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function ProposalPdfPage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;
  const data = await loadProposal(shareCode);
  if (!data) notFound();

  const { language: lang, plan, client, organization: org, projects, team, rates, legalTerms, totals } = data;
  const t = copyFor(lang);
  // Both "accepted" and "finalized" plans were officially agreed to by the
  // client — both should render the signature page and hide the validity pill.
  const isAccepted = plan.status === "accepted" || plan.status === "finalized";
  // Subtle client-brand accent — only used in detail elements (section underlines,
  // project numbering, validity pill, signature border). Falls back to monochrome
  // black if no brand color is set on the client (or the value isn't a hex).
  const brand = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(client.primaryColor ?? "")
    ? (client.primaryColor as string)
    : "#111";

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          :root { --pdf-brand: ${brand}; }
          @page { size: A4; margin: 0; }
          html { background: #ffffff !important; }
          body { background: #ffffff !important; color: #111 !important; }
          body {
            font-family: var(--font-ubuntu-sans), "Ubuntu", -apple-system, "Segoe UI", sans-serif;
            font-size: 12px;
            line-height: 1.45;
            margin: 0;
            padding: 0;
          }
          * { box-sizing: border-box; }

          .pdf-page { padding: 0; break-before: page; page-break-before: always; }
          main > section.pdf-page:first-child { break-before: auto; page-break-before: auto; }
          /* Flow blocks: stack on the same page if they fit, each kept whole. */
          .pdf-flow { padding: 14mm 18mm; break-inside: avoid-page; page-break-inside: avoid; }

          .meta-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #666; }
          h1.doc-title { font-size: 30px; line-height: 1.1; margin: 0 0 14px 0; font-weight: 600; letter-spacing: -0.01em; }
          h2.section { font-size: 14px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: 0.04em; text-transform: uppercase; color: #111; border-bottom: 1.5px solid var(--pdf-brand, #111); padding-bottom: 4px; }
          h3.subsection { font-size: 12px; font-weight: 700; margin: 10px 0 4px 0; letter-spacing: 0.08em; text-transform: uppercase; color: #555; }
          h3.project-title { font-size: 14px; font-weight: 700; margin: 0 0 4px 0; }
          .lead { color: #444; font-size: 12px; margin: 0 0 8px 0; }
          .prose p { margin: 0 0 6px 0; }
          .prose p:last-child { margin-bottom: 0; }
          .prose ul, .prose ol { margin: 0 0 6px 0; padding-left: 18px; }
          .prose ul:last-child, .prose ol:last-child { margin-bottom: 0; }
          .prose ul { list-style: disc; }
          .prose ol { list-style: decimal; }
          .prose li { margin: 1px 0; line-height: 1.45; }
          .prose li > p { margin: 0; }
          .prose strong { font-weight: 700; }
          .prose em { font-style: italic; }

          /* Cover page */
          .cover { padding: 18mm 18mm; min-height: 297mm; display: flex; flex-direction: column; }
          .cover .top-row { display: flex; justify-content: flex-start; align-items: flex-start; margin-bottom: 30mm; }
          .cover .logo img { max-height: 36px; max-width: 130px; }
          .cover .logo .wordmark { font-weight: 700; letter-spacing: 0.18em; font-size: 17px; }
          .cover .title-block { flex: 1; }
          .cover .doc-meta { font-size: 13px; color: #555; line-height: 1.55; margin: 0 0 12px 0; }
          .cover .doc-meta strong { color: var(--pdf-brand, #111); font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; }
          .cover .doc-meta .sep { opacity: 0.45; margin: 0 6px; }
          .cover .doc-title { font-size: 38px; line-height: 1.1; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 18px 0; }
          .cover .prepared-for { font-size: 13px; color: #555; }
          .cover .prepared-for .company { color: #111; font-weight: 600; }
          .cover .client-block { margin-top: 18px; font-size: 11px; color: #555; line-height: 1.55; }
          .cover .cover-bottom { margin-top: auto; }
          .cover .validity-fullwidth { display: block; text-align: center; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; border: 1px solid var(--pdf-brand, #ccc); padding: 8px 16px; border-radius: 999px; color: var(--pdf-brand, #555); margin-bottom: 8mm; }
          .cover .footer-grid { padding-top: 8mm; border-top: 1px solid #ddd; display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; font-size: 11px; color: #555; line-height: 1.55; }
          .cover .footer-grid h4 { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #111; margin: 0 0 4px 0; }
          .cover .footer-grid .row { display: block; }

          .section-block { padding: 14mm 18mm; }

          .project { break-inside: avoid-page; page-break-inside: avoid; margin-bottom: 8mm; padding-bottom: 4mm; border-bottom: 1px dotted #bbb; }
          .project:last-of-type { border-bottom: none; }
          .project .pmeta { color: #666; font-size: 11px; margin: 0 0 6px 0; }
          .project .pmeta span + span::before { content: "  ·  "; opacity: 0.55; }
          .project .field { margin-top: 6px; }
          .project .field-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-bottom: 2px; font-weight: 600; }
          .project .sessions-row { margin-top: 8px; font-size: 11px; color: #444; }
          .project .sessions-row .label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-bottom: 2px; font-weight: 600; }
          .project .team-row { margin-top: 6px; font-size: 11px; color: #555; }

          .invest-table, .rates-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .invest-table td, .rates-table td { padding: 5px 0; border-bottom: 1px solid #eee; }
          .invest-table td.amount, .rates-table td.amount { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; padding-left: 16px; }
          .invest-table tr.total td { border-top: 2px solid var(--pdf-brand, #111); border-bottom: none; padding-top: 8px; font-weight: 700; font-size: 14px; color: var(--pdf-brand, #111); }
          .rates-table .unit { color: #777; font-weight: 400; }

          .billing-note { margin-top: 8px; font-size: 11px; color: #555; }
          .validity-pill { display: inline-block; margin-top: 12px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; border: 1px solid var(--pdf-brand, #ccc); padding: 4px 10px; border-radius: 999px; color: var(--pdf-brand, #555); }

          .legal-item { break-inside: avoid-page; page-break-inside: avoid; padding: 6px 0; border-bottom: 1px dotted #ddd; }
          .legal-item:last-of-type { border-bottom: none; }
          .legal-item .ltitle { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
          .legal-item .lbody { font-size: 11px; color: #444; }

          .team-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-top: 8px; }
          .team-card { break-inside: avoid-page; page-break-inside: avoid; padding: 6px 0; }
          .team-card .tname { font-weight: 600; font-size: 12px; }
          .team-card .trole { font-size: 11px; color: #777; margin: 1px 0 3px 0; }
          .team-card .tbio { font-size: 11px; color: #444; }

          .planning { margin-top: 8px; }
          .planning .row { display: flex; align-items: center; font-size: 11px; padding: 3px 0; gap: 8px; border-bottom: 1px dotted #ddd; }
          .planning .row:last-child { border-bottom: none; }
          .planning .row .lbl { width: 45%; color: #111; font-weight: 500; }
          .planning .row .when { color: #666; }

          .signature {
            margin-top: 8mm;
            padding: 6mm;
            border: 1.5px solid var(--pdf-brand, #111);
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
          .signature .label { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; color: var(--pdf-brand, #111); }
          .signature .name { font-family: "Brush Script MT", "Lucida Handwriting", Georgia, cursive; font-size: 30px; line-height: 1; color: #111; }
          .signature .rule { height: 1px; background: var(--pdf-brand, #111); width: 60%; margin: 6px 0 6px 0; }
          .signature .meta { font-size: 11px; color: #555; }

          .pdf-download-btn {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 18px;
            border-radius: 999px;
            border: 1px solid var(--pdf-brand, #111);
            background: var(--pdf-brand, #111);
            color: #fff;
            font-family: var(--font-ubuntu-sans), "Ubuntu", -apple-system, "Segoe UI", sans-serif;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
            z-index: 100;
          }
          .pdf-download-btn:hover:not(:disabled) { opacity: 0.92; }
          .pdf-download-btn:disabled { opacity: 0.7; cursor: default; }
          .pdf-download-btn .spin { animation: pdf-spin 0.9s linear infinite; }
          @keyframes pdf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @media print {
            .pdf-download-btn { display: none !important; }
          }
        `,
        }}
      />
      <DownloadPdfButton shareCode={shareCode} />

      <main>
        <CoverPage lang={lang} plan={plan} client={client} org={org} t={t} />
        {(plan.challenge || plan.context || plan.approach || plan.summary || team.length > 0) && (
          <AanleidingPage lang={lang} plan={plan} projects={projects} team={team} t={t} />
        )}
        <ProjectsPage lang={lang} projects={projects} t={t} />
        <InvestmentPage lang={lang} plan={plan} projects={projects} totals={totals} t={t} />
        {rates.length > 0 && <RatesPage rates={rates} t={t} />}
        {legalTerms.length > 0 && <LegalPage legalTerms={legalTerms} t={t} />}
        {isAccepted && plan.acceptedByClient && (
          <SignaturePage plan={plan} lang={lang} t={t} />
        )}
      </main>
    </>
  );
}

// ── Pages ───────────────────────────────────────────────────────────────────

function CoverPage({
  lang, plan, client, org, t,
}: {
  lang: Language;
  plan: ProposalData["plan"];
  client: ProposalData["client"];
  org: Org;
  t: ProposalCopy;
}) {
  return (
    <section className="pdf-page cover">
      <div className="top-row">
        <div className="logo" style={{ color: "#111" }}>
          <SummLogo width={90} height={36} />
        </div>
      </div>

      <div className="title-block">
        <div className="doc-meta">
          <strong>{t.proposalEyebrow}</strong>
          {plan.proposalNumber && <><span className="sep">·</span>{plan.proposalNumber}</>}
          {plan.versionLabel && <><span className="sep">·</span>{plan.versionLabel}</>}
          {plan.presentedAt && <><span className="sep">·</span>{formatDate(plan.presentedAt, lang)}</>}
        </div>
        <h1 className="doc-title">{plan.title}</h1>
        <div className="prepared-for">
          {t.preparedFor} <span className="company">{client.company}</span>
        </div>
      </div>

      <div className="cover-bottom">
        {plan.status === "ready" && plan.validUntilDate && (
          <div className="validity-fullwidth">
            {t.validUntil(formatDate(plan.validUntilDate, lang))}
          </div>
        )}
        <div className="footer-grid">
          <div>
            <h4>{client.company}</h4>
            {client.contactName && <div className="row">{client.contactName}</div>}
            {client.addressStreet && <div className="row">{client.addressStreet}</div>}
            {(client.addressPostalCode || client.addressCity) && (
              <div className="row">{[client.addressPostalCode, client.addressCity].filter(Boolean).join("  ")}</div>
            )}
            {client.addressCountry && <div className="row">{client.addressCountry}</div>}
          </div>
          <div>
            <h4>SUMM</h4>
            {org.addressStreet && <div className="row">{org.addressStreet}</div>}
            {(org.addressPostalCode || org.addressCity) && (
              <div className="row">{[org.addressPostalCode, org.addressCity].filter(Boolean).join("  ")}</div>
            )}
            {org.addressCountry && <div className="row">{org.addressCountry}</div>}
            {org.kvkNumber && <div className="row">KvK {org.kvkNumber}</div>}
            {org.btwNumber && <div className="row">BTW {org.btwNumber}</div>}
            {org.iban && <div className="row">IBAN {org.iban}</div>}
            {org.website && <div className="row">{org.website}</div>}
            {org.email && <div className="row">{org.email}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function AanleidingPage({
  lang, plan, projects, team, t,
}: {
  lang: Language;
  plan: ProposalData["plan"];
  projects: ProposalProject[];
  team: TeamMember[];
  t: ProposalCopy;
}) {
  // Show every project: dated ones sorted by start date with their date range,
  // undated ones afterwards with "Datum NTB" / "Date TBD" in the right column.
  const withSort = projects.map((p) => ({
    ...p,
    _hasDates: !!(p.scheduledStartDate && p.scheduledEndDate),
    _start: p.scheduledStartDate ? new Date(p.scheduledStartDate + "T00:00:00").getTime() : Number.POSITIVE_INFINITY,
  }));
  const allPlanning = withSort.sort((a, b) => {
    if (a._hasDates && !b._hasDates) return -1;
    if (!a._hasDates && b._hasDates) return 1;
    return a._start - b._start;
  });
  return (
    <section className="pdf-page section-block">
      <h2 className="section">{t.aanleidingTitle}</h2>

      {plan.summary && (
        <div
          className="prose"
          style={{ marginTop: 8 }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(plan.summary) }}
        />
      )}

      {plan.challenge && (
        <>
          <h3 className="subsection">{t.challengeLabel}</h3>
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(plan.challenge) }}
          />
        </>
      )}

      {plan.context && (
        <>
          <h3 className="subsection">{t.contextLabel}</h3>
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(plan.context) }}
          />
        </>
      )}

      {plan.approach && (
        <>
          <h3 className="subsection">{t.approachLabel}</h3>
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(plan.approach) }}
          />
        </>
      )}

      {allPlanning.length > 0 && (
        <>
          <h3 className="subsection">{t.whatWellDo}</h3>
          <div className="planning">
            {allPlanning.map((p) => (
              <div className="row" key={p.id}>
                <div className="lbl">{p.title}</div>
                <div className="when">
                  {p._hasDates
                    ? `${formatDateShort(p.scheduledStartDate, lang)} – ${formatDateShort(p.scheduledEndDate, lang)}`
                    : t.dateTbd}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {team.length > 0 && (
        <>
          <h3 className="subsection">{t.teamLabel}</h3>
          <div className="team-grid">
            {team.map((m) => (
              <div className="team-card" key={m.userId}>
                <div className="tname">{m.name}</div>
                {m.roleName && <div className="trole">{m.roleName}</div>}
                {m.bio && <div className="tbio">{m.bio}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ProjectArticle({
  lang, project, index, t,
}: { lang: Language; project: ProposalProject; index: number; t: ProposalCopy }) {
  return (
    <article className="project">
      <h3 className="project-title">{index + 1}. {project.title}</h3>
      <p className="pmeta">
        {project.service && <span>{project.service}</span>}
        {project.scheduledStartDate && project.scheduledEndDate && (
          <span>
            {formatDateShort(project.scheduledStartDate, lang)} – {formatDateShort(project.scheduledEndDate, lang)}
          </span>
        )}
        {project.durationDays != null && (
          <span>{project.durationDays} {project.durationDays === 1 ? t.dayLabel : t.daysLabel}</span>
        )}
        {project.soldPrice > 0 && <span>{formatEuro(project.soldPrice)}</span>}
      </p>
      {(["why", "how", "what", "activities", "deliverables"] as const).map((k) => {
        const v = project.sections[k];
        if (!v) return null;
        const labelMap = {
          why: t.whyLabel, how: t.howLabel, what: t.whatLabel,
          activities: t.activitiesLabel, deliverables: t.deliverablesLabel,
        } as const;
        return (
          <div className="field" key={k}>
            <div className="field-label">{labelMap[k]}</div>
            <div
              className="prose"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(v) }}
            />
          </div>
        );
      })}
      {project.sessions.length > 0 && (
        <div className="sessions-row">
          <div className="label">{t.sessionsLabel}</div>
          <div>
            {project.sessions
              .map((s) => [s.date ? formatDateShort(s.date, lang) : t.tbdLabel, s.title, s.location].filter(Boolean).join(" — "))
              .join(" · ")}
          </div>
        </div>
      )}
      {project.team.length > 0 && (
        <div className="team-row">
          {t.teamLabel}: {project.team.map((m) => (m.roleLabel ? `${m.name} (${m.roleLabel})` : m.name)).join(", ")}
        </div>
      )}
    </article>
  );
}

function ProjectsPage({ lang, projects, t }: { lang: Language; projects: ProposalProject[]; t: ProposalCopy }) {
  if (projects.length === 0) return null;
  const [first, ...rest] = projects;
  return (
    <>
      <section className="pdf-page section-block">
        <h2 className="section">
          {projects.length} {projects.length === 1 ? t.projectSingular : t.projectPlural}
        </h2>
        <ProjectArticle lang={lang} project={first} index={0} t={t} />
      </section>
      {rest.map((p, idx) => (
        <section className="pdf-page section-block" key={p.id}>
          <ProjectArticle lang={lang} project={p} index={idx + 1} t={t} />
        </section>
      ))}
    </>
  );
}

function InvestmentPage({
  plan, projects, totals, t,
}: {
  lang: Language;
  plan: ProposalData["plan"];
  projects: ProposalProject[];
  totals: ProposalData["totals"];
  t: ProposalCopy;
}) {
  return (
    <section className="pdf-page section-block">
      <h2 className="section">{t.investmentEyebrow}</h2>
      <table className="invest-table">
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td className="amount">{formatEuro(p.soldPrice)}</td>
            </tr>
          ))}
          {(plan.discountType || plan.vatRate) && (
            <>
              <tr><td>{t.subtotal}</td><td className="amount">{formatEuro(totals.subtotal)}</td></tr>
              {plan.discountType && totals.discountAmount > 0 && (
                <tr>
                  <td>{t.discount}{plan.discountType === "percentage" ? ` (${plan.discountValue}%)` : ""}</td>
                  <td className="amount">− {formatEuro(totals.discountAmount)}</td>
                </tr>
              )}
              {plan.vatRate ? (
                <tr><td>{t.vat} ({plan.vatRate}%)</td><td className="amount">{formatEuro(totals.vatAmount)}</td></tr>
              ) : null}
            </>
          )}
          <tr className="total">
            <td>{plan.vatRate ? t.totalInclVat : t.total}</td>
            <td className="amount">{formatEuro(totals.total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function RatesPage({
  rates, t,
}: {
  rates: { name: string; hourlyRate: number }[];
  t: ProposalCopy;
}) {
  return (
    <section className="pdf-flow">
      <h2 className="section">{t.ratesTitle}</h2>
      <p className="lead" style={{ marginBottom: 10 }}>{t.ratesIntro}</p>
      <table className="rates-table">
        <tbody>
          {rates.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className="amount">{formatEuro(r.hourlyRate)} <span className="unit">{t.perHour}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="billing-note">{t.billingTerms}</div>
    </section>
  );
}

function LegalPage({
  legalTerms, t,
}: {
  legalTerms: { slug: string; title: string; content: string }[];
  t: ProposalCopy;
}) {
  return (
    <section className="pdf-flow">
      <h2 className="section">{t.legalTitle}</h2>
      <p className="lead" style={{ marginBottom: 10 }}>{t.legalIntro}</p>
      <div>
        {legalTerms.map((term) => (
          <div className="legal-item" key={term.slug}>
            <div className="ltitle">{term.title}</div>
            <div className="lbody">{term.content}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SignaturePage({
  plan, lang, t,
}: {
  plan: ProposalData["plan"];
  lang: Language;
  t: ProposalCopy;
}) {
  const signerName = plan.acceptedByClient?.name ?? null;
  return (
    <section className="pdf-page section-block">
      <h2 className="section">{t.officiallyAccepted}</h2>
      <div className="signature">
        <div className="label">{t.officiallyAccepted}</div>
        {signerName && <div className="name">{signerName}</div>}
        <div className="rule" />
        <div className="meta">
          {t.digitallySignedOn(formatDate(plan.acceptedAt, lang))}
          {plan.acceptedByClient?.email && <> · {plan.acceptedByClient.email}</>}
        </div>
      </div>
    </section>
  );
}
