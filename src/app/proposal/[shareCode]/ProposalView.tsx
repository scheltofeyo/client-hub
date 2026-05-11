"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, FileText } from "lucide-react";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import UserAvatar from "@/components/ui/UserAvatar";
import ProposalPlanOverview from "@/components/ui/ProposalPlanOverview";
import { readableFg } from "@/lib/styles";

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  userId: string;
  name: string;
  image?: string;
  roleLabel?: string | null;
  projectCount?: number;
}

interface ProposalSession {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  info: string | null;
  participantCount: number;
}

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
  team: TeamMember[];
  sessions: ProposalSession[];
}

interface InProgressData {
  inProgress: true;
  plan: { title: string; status: "draft" };
  client: { company: string; primaryColor: string | null };
}

interface ProposalData {
  inProgress?: false;
  plan: {
    title: string;
    summary: string | null;
    proposerStatement: string | null;
    status: "draft" | "ready" | "accepted" | "archived";
    presentedAt: string | null;
    acceptedAt: string | null;
    acceptedByClient: { name: string; email: string } | null;
    discountType: "percentage" | "amount" | null;
    discountValue: number | null;
    vatRate: number | null;
    createdBy: { name: string; image: string | null };
  };
  client: { company: string; primaryColor: string | null };
  projects: ProposalProject[];
  team: TeamMember[];
  totals: {
    subtotal: number;
    discountAmount: number;
    net: number;
    vatAmount: number;
    total: number;
  };
}

// ── Format helpers ───────────────────────────────────────────────────────────

function formatEuro(n: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(s: string | null): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(s: string | null): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Resolve a usable accept-button foreground color for any brand color (CSS var or hex). */
function buttonFg(brand: string): string {
  if (brand.startsWith("#")) return readableFg(brand);
  return "#ffffff";
}

// ── Section primitives ───────────────────────────────────────────────────────

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-4"
      style={{ color: color ?? "var(--text-muted)" }}
    >
      {children}
    </p>
  );
}

function SectionTitle({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return (
    <h2
      className={
        large
          ? "text-4xl md:text-5xl font-medium tracking-tight"
          : "text-3xl md:text-4xl font-semibold tracking-tight"
      }
      style={{ color: "var(--text-primary)", lineHeight: 1.05, letterSpacing: "-0.02em" }}
    >
      {children}
    </h2>
  );
}

function InlineLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-3"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </p>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

const SECTION_IDS = {
  overview: "overview",
  team: "team",
  projects: "projects",
  investment: "investment",
  accept: "accept",
} as const;
type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS];

export default function ProposalView({ shareCode }: { shareCode: string }) {
  const [data, setData] = useState<ProposalData | InProgressData | null>(null);
  const [error, setError] = useState("");
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>(SECTION_IDS.overview);
  const [openProjectIds, setOpenProjectIds] = useState<Set<string>>(new Set());
  const heroSentinelRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    overview: null,
    team: null,
    projects: null,
    investment: null,
    accept: null,
  });
  const projectArticleRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    fetch(`/api/public/plans/${shareCode}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error ?? "Could not load proposal");
        }
        return r.json();
      })
      .then((payload: ProposalData | InProgressData) => {
        setData(payload);
        if (!(payload as InProgressData).inProgress) {
          const full = payload as ProposalData;
          // Match the previous default-open rule: all open if <3 projects, else just the first.
          const initial = new Set<string>();
          if (full.projects.length < 3) {
            full.projects.forEach((p) => initial.add(p.id));
          } else if (full.projects.length > 0) {
            initial.add(full.projects[0].id);
          }
          setOpenProjectIds(initial);
        }
      })
      .catch((e) => setError(e.message));
  }, [shareCode]);

  // Sticky bar appears when hero sentinel scrolls out
  useEffect(() => {
    if (!data) return;
    const el = heroSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { rootMargin: "-32px 0px 0px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [data]);

  // Scrollspy for sub-nav (only meaningful when sub-nav is shown but harmless otherwise)
  useEffect(() => {
    if (!data) return;
    const entries = (Object.keys(sectionRefs.current) as SectionId[])
      .map((key) => ({ key, el: sectionRefs.current[key] }))
      .filter((e) => e.el !== null);
    if (entries.length === 0) return;

    const obs = new IntersectionObserver(
      (intersections) => {
        // Pick the entry highest on screen that's currently intersecting top half
        const visible = intersections
          .filter((i) => i.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = (visible[0].target as HTMLElement).id as SectionId;
          if (id) setActiveSection(id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    entries.forEach((e) => obs.observe(e.el!));
    return () => obs.disconnect();
  }, [data]);

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--bg-app)" }}
      >
        <div className="max-w-md text-center space-y-3">
          <FileText size={40} style={{ color: "var(--text-muted)", margin: "0 auto" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Proposal unavailable
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-app)" }}
      >
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  // In-progress short-circuit: plan is in draft (was revoked or not yet sent).
  // Render a friendly maintenance state instead of the full proposal.
  if ((data as InProgressData).inProgress) {
    const d = data as InProgressData;
    return <InProgressView plan={d.plan} client={d.client} />;
  }

  const fullData = data as ProposalData;
  const { plan, client, projects, team, totals } = fullData;
  const isAccepted = plan.status === "accepted";
  const brandColor = client.primaryColor ?? "var(--primary)";
  const acceptFg = buttonFg(brandColor);
  const showSubNav = projects.length >= 3;

  function scrollToSection(id: SectionId) {
    const el = sectionRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setSectionRef(id: SectionId): (el: HTMLElement | null) => void {
    return (el) => {
      sectionRefs.current[id] = el;
    };
  }

  function toggleProject(id: string) {
    setOpenProjectIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function scrollToProject(id: string) {
    setOpenProjectIds((s) => {
      if (s.has(id)) return s;
      const n = new Set(s);
      n.add(id);
      return n;
    });
    requestAnimationFrame(() => {
      const el = projectArticleRefs.current[id];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-app)" }}>
      {/* ─── Sticky mini-bar ─── */}
      <StickyBar
        visible={showStickyBar}
        plan={plan}
        client={client}
        brandColor={brandColor}
        total={totals.total}
        isAccepted={isAccepted}
        showSubNav={showSubNav}
        activeSection={activeSection}
        projectCount={projects.length}
        acceptFg={acceptFg}
        onJumpAccept={() => scrollToSection(SECTION_IDS.accept)}
        onJumpSection={scrollToSection}
      />

      {/* Brand band at top of page */}
      <div style={{ height: 4, background: brandColor }} />

      {/* ─── Document container ─── */}
      <main className="max-w-3xl mx-auto px-6 md:px-10 pb-24">
        {/* Hero */}
        <header className="pt-20 md:pt-28 pb-20">
          <Eyebrow color={brandColor}>Proposal</Eyebrow>
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-medium mb-5"
            style={{ color: "var(--text-primary)", lineHeight: 0.98, letterSpacing: "-0.03em" }}
          >
            {plan.title}
          </h1>
          <p className="text-lg md:text-xl" style={{ color: "var(--text-muted)" }}>
            Prepared for <span style={{ color: "var(--text-primary)" }}>{client.company}</span>
          </p>

          {/* Proposer card — humanizes the document */}
          <div className="mt-12 flex items-start gap-4">
            <UserAvatar name={plan.createdBy.name} image={plan.createdBy.image} size={56} />
            <div className="min-w-0 flex-1 pt-1">
              <p className="font-medium text-base" style={{ color: "var(--text-primary)" }}>
                {plan.createdBy.name}
              </p>
              {plan.proposerStatement && (
                <p
                  className="mt-1 text-base md:text-lg italic max-w-prose"
                  style={{ color: "var(--text-muted)", lineHeight: 1.5 }}
                >
                  &ldquo;{plan.proposerStatement}&rdquo;
                </p>
              )}
            </div>
          </div>

          <div
            className="mt-10 flex flex-wrap gap-x-10 gap-y-3 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {(plan.presentedAt || plan.acceptedAt) && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] mb-1">Date</p>
                <p style={{ color: "var(--text-primary)" }}>
                  {formatDate(plan.acceptedAt ?? plan.presentedAt)}
                </p>
              </div>
            )}
          </div>

          {isAccepted && plan.acceptedByClient && (
            <div
              className="mt-10 rounded-xl border px-5 py-4 flex items-center gap-3"
              style={{
                borderColor: "var(--success)",
                background: "var(--success-light)",
                color: "var(--success)",
              }}
            >
              <Check size={18} />
              <p className="text-sm">
                Accepted by <strong>{plan.acceptedByClient.name}</strong> on {formatDate(plan.acceptedAt)}
              </p>
            </div>
          )}
        </header>

        {/* Sentinel — triggers the sticky bar when out of view */}
        <div ref={heroSentinelRef} aria-hidden style={{ height: 1, marginTop: -1 }} />

        {/* Summary */}
        {plan.summary && (
          <section
            id={SECTION_IDS.overview}
            ref={setSectionRef(SECTION_IDS.overview)}
            className="pt-10 md:pt-14 pb-16 md:pb-20"
            style={{ borderTop: "1px solid var(--border)", scrollMarginTop: showSubNav ? 120 : 80 }}
          >
            <SectionTitle large>What we propose</SectionTitle>
            <div className="mt-8 prose-proposal" style={{ color: "var(--text-primary)" }}>
              <RichTextDisplay html={plan.summary} />
            </div>
          </section>
        )}

        {/* Team */}
        {team.length > 0 && (
          <section
            id={SECTION_IDS.team}
            ref={setSectionRef(SECTION_IDS.team)}
            className="pt-16 md:pt-20 pb-16 md:pb-20"
            style={{ borderTop: "1px solid var(--border)", scrollMarginTop: showSubNav ? 120 : 80 }}
          >
            <SectionTitle>The people on this</SectionTitle>
            <p className="mt-4 text-base md:text-lg max-w-xl" style={{ color: "var(--text-muted)" }}>
              The team we have lined up for this engagement.
            </p>
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
              {team.map((m) => (
                <div key={m.userId} className="flex items-start gap-4">
                  <UserAvatar name={m.name} image={m.image ?? null} size={64} />
                  <div className="min-w-0 pt-1">
                    <p className="font-medium text-base" style={{ color: "var(--text-primary)" }}>
                      {m.name}
                    </p>
                    {m.roleLabel && (
                      <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {m.roleLabel}
                      </p>
                    )}
                    {m.projectCount && m.projectCount > 1 && (
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        On {m.projectCount} projects
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <section
            id={SECTION_IDS.projects}
            ref={setSectionRef(SECTION_IDS.projects)}
            className="pt-16 md:pt-20 pb-16 md:pb-20"
            style={{ borderTop: "1px solid var(--border)", scrollMarginTop: showSubNav ? 120 : 80 }}
          >
            <Eyebrow>What we&apos;ll do</Eyebrow>
            <SectionTitle>
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </SectionTitle>
            <p className="mt-4 text-base md:text-lg max-w-xl" style={{ color: "var(--text-muted)" }}>
              A breakdown of each project we&apos;re proposing.
            </p>

            <ProposalPlanOverview
              projects={projects}
              brandColor={brandColor}
              onSelect={scrollToProject}
            />

            <div className="mt-14 space-y-12">
              {projects.map((p, i) => (
                <ProjectBlock
                  key={p.id}
                  project={p}
                  index={i}
                  brandColor={brandColor}
                  collapsibleMode={projects.length >= 2}
                  scrollOffset={showSubNav ? 160 : 96}
                  isOpen={openProjectIds.has(p.id)}
                  onToggle={() => toggleProject(p.id)}
                  articleRef={(el) => {
                    projectArticleRefs.current[p.id] = el;
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Investment */}
        <section
          id={SECTION_IDS.investment}
          ref={setSectionRef(SECTION_IDS.investment)}
          className="pt-16 md:pt-20 pb-16 md:pb-20"
          style={{ borderTop: "1px solid var(--border)", scrollMarginTop: showSubNav ? 120 : 80 }}
        >
          <Eyebrow>Investment</Eyebrow>
          <SectionTitle>What it costs</SectionTitle>

          <div
            className="mt-10 rounded-2xl border overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            <div>
              {projects.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-6 py-5"
                  style={{
                    borderTop: i === 0 ? undefined : "1px solid var(--border)",
                  }}
                >
                  <div className="min-w-0 pr-4">
                    <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {p.title}
                    </p>
                  </div>
                  <p
                    className="text-base tabular-nums font-medium shrink-0"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatEuro(p.soldPrice)}
                  </p>
                </div>
              ))}
            </div>

            {/* Discount/VAT mini-line items */}
            {(plan.discountType || plan.vatRate) && (
              <div
                className="px-6 py-4 space-y-1.5 text-sm"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-muted)" }}>Subtotal</span>
                  <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatEuro(totals.subtotal)}
                  </span>
                </div>
                {plan.discountType && totals.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>
                      Discount
                      {plan.discountType === "percentage" ? ` (${plan.discountValue}%)` : ""}
                    </span>
                    <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                      − {formatEuro(totals.discountAmount)}
                    </span>
                  </div>
                )}
                {plan.discountType && totals.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>Net</span>
                    <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {formatEuro(totals.net)}
                    </span>
                  </div>
                )}
                {plan.vatRate ? (
                  <>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>VAT ({plan.vatRate}%)</span>
                      <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                        {formatEuro(totals.vatAmount)}
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* Total — the moment that matters */}
            <div
              className="px-6 py-7 md:py-8 flex items-baseline justify-between"
              style={{ borderTop: "1px solid var(--border)", background: "var(--bg-elevated)" }}
            >
              <span
                className="text-sm font-medium uppercase tracking-[0.16em]"
                style={{ color: "var(--text-muted)" }}
              >
                Total{plan.vatRate ? " incl. VAT" : ""}
              </span>
              <span
                className="text-3xl md:text-4xl font-semibold tabular-nums"
                style={{ color: brandColor, letterSpacing: "-0.02em" }}
              >
                {formatEuro(totals.total)}
              </span>
            </div>
          </div>
        </section>

        {/* Accept — full-bleed tinted section */}
        <section
          id={SECTION_IDS.accept}
          ref={setSectionRef(SECTION_IDS.accept)}
          className="relative pt-16 md:pt-20 pb-20"
          style={{ borderTop: "1px solid var(--border)", scrollMarginTop: showSubNav ? 120 : 80 }}
        >
          {/* Full-bleed background */}
          <div
            aria-hidden
            className="absolute inset-y-0"
            style={{
              left: "calc(50% - 50vw)",
              right: "calc(50% - 50vw)",
              background: "var(--bg-elevated)",
            }}
          />
          <div className="relative">
            {isAccepted ? (
              <AlreadyAccepted plan={plan} />
            ) : (
              <AcceptBlock shareCode={shareCode} brandColor={brandColor} acceptFg={acceptFg} />
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
          Prepared by SUMM &middot; This proposal is confidential and intended for {client.company}.
        </footer>
      </main>

      <style jsx global>{`
        .prose-proposal { font-size: 17px; }
        .prose-proposal :where(p) { margin: 0 0 0.85em 0; line-height: 1.7; }
        .prose-proposal :where(p:last-child) { margin-bottom: 0; }
        .prose-proposal :where(ul) { margin: 0 0 0.85em 1.5em; list-style: disc; }
        .prose-proposal :where(ol) { margin: 0 0 0.85em 1.5em; list-style: decimal; }
        .prose-proposal :where(li) { margin-bottom: 0.3em; line-height: 1.65; }
        .prose-proposal :where(strong) { font-weight: 600; }
        .prose-proposal :where(em) { font-style: italic; }
        @media (max-width: 640px) {
          .prose-proposal { font-size: 16px; }
        }
      `}</style>
    </div>
  );
}

// ── Sticky mini-bar ──────────────────────────────────────────────────────────

function StickyBar({
  visible,
  plan,
  client,
  brandColor,
  total,
  isAccepted,
  showSubNav,
  activeSection,
  projectCount,
  acceptFg,
  onJumpAccept,
  onJumpSection,
}: {
  visible: boolean;
  plan: ProposalData["plan"];
  client: ProposalData["client"];
  brandColor: string;
  total: number;
  isAccepted: boolean;
  showSubNav: boolean;
  activeSection: SectionId;
  projectCount: number;
  acceptFg: string;
  onJumpAccept: () => void;
  onJumpSection: (id: SectionId) => void;
}) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 transition-opacity duration-200"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        backdropFilter: "saturate(180%) blur(8px)",
        WebkitBackdropFilter: "saturate(180%) blur(8px)",
        background: "color-mix(in srgb, var(--bg-app) 92%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Brand stripe accent */}
      <div className="flex items-stretch h-14 max-w-5xl mx-auto px-6 md:px-10">
        <div className="w-1 self-stretch mr-4" style={{ background: brandColor }} aria-hidden />
        <div className="flex-1 flex items-center min-w-0">
          <p
            className="font-medium text-sm truncate hidden sm:block"
            style={{ color: "var(--text-primary)" }}
          >
            {plan.title}
            <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>
              · {client.company}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
            {new Intl.NumberFormat("nl-NL", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(total)}
          </span>
          {isAccepted ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ background: "var(--success-light)", color: "var(--success)" }}
            >
              <Check size={13} /> Accepted
            </span>
          ) : (
            <button
              onClick={onJumpAccept}
              className="px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: brandColor, color: acceptFg }}
            >
              Accept
            </button>
          )}
        </div>
      </div>

      {/* Sub-nav row (only ≥3 projects) */}
      {showSubNav && (
        <div
          className="max-w-5xl mx-auto px-6 md:px-10 flex items-center gap-6 h-11 overflow-x-auto whitespace-nowrap"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {(
            [
              { id: SECTION_IDS.overview, label: "Overview" },
              { id: SECTION_IDS.team, label: "Team" },
              { id: SECTION_IDS.projects, label: `Projects (${projectCount})` },
              { id: SECTION_IDS.investment, label: "Investment" },
              { id: SECTION_IDS.accept, label: "Accept" },
            ] as const
          ).map(({ id, label }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => onJumpSection(id)}
                className="text-xs font-medium uppercase tracking-[0.14em] transition-colors"
                style={{
                  color: active ? brandColor : "var(--text-muted)",
                  borderBottom: active ? `2px solid ${brandColor}` : "2px solid transparent",
                  paddingBottom: 4,
                  marginBottom: -4,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Per-project block (collapsible) ──────────────────────────────────────────

function ProjectBlock({
  project,
  index,
  brandColor,
  collapsibleMode,
  scrollOffset,
  isOpen,
  onToggle,
  articleRef,
}: {
  project: ProposalProject;
  index: number;
  brandColor: string;
  collapsibleMode: boolean;
  scrollOffset: number;
  isOpen: boolean;
  onToggle: () => void;
  articleRef: (el: HTMLElement | null) => void;
}) {
  const open = isOpen;
  const hasAnySection = useMemo(
    () => Object.values(project.sections).some((v) => v),
    [project.sections]
  );

  return (
    <article
      id={`project-${project.id}`}
      ref={articleRef}
      className="relative"
      style={{ scrollMarginTop: scrollOffset }}
    >
      {/* Large ghost number in left gutter on lg+ */}
      <div
        aria-hidden
        className="hidden lg:block absolute font-light tabular-nums"
        style={{
          left: -80,
          top: -8,
          fontSize: 64,
          lineHeight: 1,
          color: brandColor,
          opacity: 0.18,
          letterSpacing: "-0.04em",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* Header — always visible */}
      <button
        onClick={() => collapsibleMode && onToggle()}
        disabled={!collapsibleMode}
        className="w-full text-left group"
        style={{ cursor: collapsibleMode ? "pointer" : "default" }}
      >
        <div className="flex items-baseline gap-4 mb-3">
          <span
            className="lg:hidden text-sm font-mono tabular-nums"
            style={{ color: brandColor, letterSpacing: "0.08em" }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          {project.service && (
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text-muted)" }}
            >
              {project.service}
            </span>
          )}
        </div>

        <div className="flex items-start gap-4">
          <h3
            className="flex-1 text-2xl md:text-3xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.015em" }}
          >
            {project.title}
          </h3>
          {collapsibleMode && (
            <div
              className="shrink-0 mt-1 transition-transform"
              style={{ color: "var(--text-muted)" }}
            >
              {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          )}
        </div>

        {/* Compact meta row */}
        {(project.scheduledStartDate || project.durationDays != null || project.soldPrice > 0) && (
          <div
            className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {project.scheduledStartDate && project.scheduledEndDate && (
              <span>
                <span className="text-[10px] uppercase tracking-[0.18em] block mb-0.5">When</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {formatDateShort(project.scheduledStartDate)} – {formatDateShort(project.scheduledEndDate)}
                </span>
              </span>
            )}
            {project.durationDays != null && (
              <span>
                <span className="text-[10px] uppercase tracking-[0.18em] block mb-0.5">Duration</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {project.durationDays} {project.durationDays === 1 ? "day" : "days"}
                </span>
              </span>
            )}
            {project.soldPrice > 0 && (
              <span>
                <span className="text-[10px] uppercase tracking-[0.18em] block mb-0.5">Investment</span>
                <span className="tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
                  {formatEuro(project.soldPrice)}
                </span>
              </span>
            )}
          </div>
        )}
      </button>

      {/* Body — only when open */}
      {open && (
        <div className="mt-10 space-y-10">
          {hasAnySection && (
            <>
              {project.sections.why && <FieldBlock label="Why" content={project.sections.why} />}
              {project.sections.how && <FieldBlock label="How" content={project.sections.how} />}
              {project.sections.what && <FieldBlock label="What" content={project.sections.what} />}
              {project.sections.activities && (
                <FieldBlock label="Activities" content={project.sections.activities} />
              )}
              {project.sections.deliverables && (
                <FieldBlock label="Deliverables" content={project.sections.deliverables} />
              )}
            </>
          )}

          {project.sessions.length > 0 && (
            <div>
              <InlineLabel>Sessions</InlineLabel>
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                {project.sessions.map((s, i) => (
                  <SessionRow key={s.id} session={s} first={i === 0} />
                ))}
              </div>
            </div>
          )}

          {project.team.length > 0 && (
            <div>
              <InlineLabel>Team</InlineLabel>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {project.team.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2.5">
                    <UserAvatar name={m.name} image={m.image ?? null} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {m.name}
                      </p>
                      {m.roleLabel && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {m.roleLabel}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── Session row (renders inside a project's body) ───────────────────────────

function SessionRow({ session, first }: { session: ProposalSession; first: boolean }) {
  const d = session.date ? new Date(session.date + "T00:00:00") : null;
  const validDate = d && !isNaN(d.getTime()) ? d : null;
  const day = validDate ? validDate.getDate() : null;
  const month = validDate
    ? validDate.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()
    : null;

  const metaParts: string[] = [];
  if (session.location) metaParts.push(session.location);
  if (session.participantCount > 0) {
    metaParts.push(
      `${session.participantCount} ${session.participantCount === 1 ? "participant" : "participants"}`
    );
  }

  return (
    <div
      className="flex gap-5 px-5 py-5"
      style={{
        background: "var(--bg-surface)",
        borderTop: first ? undefined : "1px solid var(--border)",
      }}
    >
      {/* Date column */}
      <div
        className="shrink-0 flex flex-col items-center justify-center rounded-lg py-2 text-center"
        style={{
          width: 64,
          minHeight: 64,
          background: validDate ? "var(--bg-elevated)" : "transparent",
          border: validDate ? undefined : "1px dashed var(--border)",
        }}
      >
        {validDate ? (
          <>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
            >
              {month}
            </span>
            <span
              className="text-2xl font-semibold tabular-nums leading-none mt-1"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              {day}
            </span>
          </>
        ) : (
          <span
            className="text-[10px] uppercase tracking-[0.16em] px-1 leading-tight"
            style={{ color: "var(--text-muted)" }}
          >
            TBD
          </span>
        )}
      </div>

      {/* Body column */}
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
          {session.title}
        </p>
        {metaParts.length > 0 && (
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {metaParts.join(" · ")}
          </p>
        )}
        {session.info && (
          <div className="mt-3 prose-proposal text-sm" style={{ color: "var(--text-primary)" }}>
            <RichTextDisplay html={session.info} />
          </div>
        )}
      </div>
    </div>
  );
}

function FieldBlock({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <InlineLabel>{label}</InlineLabel>
      <div className="prose-proposal" style={{ color: "var(--text-primary)" }}>
        <RichTextDisplay html={content} />
      </div>
    </div>
  );
}

// ── Accept block ─────────────────────────────────────────────────────────────

function AcceptBlock({
  shareCode,
  brandColor,
  acceptFg,
}: {
  shareCode: string;
  brandColor: string;
  acceptFg: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/public/plans/${shareCode}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong");
      return;
    }
    setAccepted(true);
  }

  if (accepted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-8">
        <div
          className="w-14 h-14 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ background: "var(--success)", color: "white" }}
        >
          <Check size={28} />
        </div>
        <h3
          className="text-3xl md:text-4xl font-semibold tracking-tight mb-3"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          Thank you, {name}.
        </h3>
        <p className="text-base md:text-lg max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          We&apos;ve received your acceptance. We&apos;ll be in touch shortly to kick things off.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Eyebrow>Next steps</Eyebrow>
      <SectionTitle>Ready to start?</SectionTitle>
      <p className="mt-4 text-base md:text-lg" style={{ color: "var(--text-muted)" }}>
        Accept the proposal below and we&apos;ll get to work. You&apos;ll receive a confirmation by email.
      </p>

      <form onSubmit={submit} className="mt-10 space-y-5">
        {error && (
          <p
            className="text-sm px-4 py-3 rounded-lg"
            style={{ background: "var(--danger-light)", color: "var(--danger)" }}
          >
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.14em] block mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Your name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-lg border px-4 py-4 text-base outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div>
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.14em] block mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Your email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border px-4 py-4 text-base outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || !name.trim() || !email.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-5 rounded-lg text-base font-semibold tracking-wide transition-opacity disabled:opacity-50 hover:opacity-95"
          style={{ background: brandColor, color: acceptFg }}
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {submitting ? "Submitting…" : "Sign off and start"}
        </button>
        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          By accepting, you confirm the scope and investment outlined above.
        </p>
      </form>
    </div>
  );
}

// ── In-progress / maintenance state ─────────────────────────────────────────
// Shown when the consultant is still working on (or has temporarily revoked) the
// proposal. The link stays valid but content is intentionally hidden until the
// next "Mark as ready" lands.

function InProgressView({
  plan,
  client,
}: {
  plan: InProgressData["plan"];
  client: InProgressData["client"];
}) {
  const brandColor = client.primaryColor ?? "var(--primary)";
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-app)" }}>
      <div style={{ height: 4, background: brandColor }} />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-6"
            style={{ color: brandColor }}
          >
            Proposal · {client.company}
          </p>
          <div
            className="w-14 h-14 rounded-full mx-auto mb-7 flex items-center justify-center"
            style={{ background: "var(--bg-elevated)", color: brandColor }}
          >
            <Loader2 size={26} className="animate-spin" />
          </div>
          <h1
            className="text-3xl md:text-4xl font-semibold tracking-tight mb-4"
            style={{ color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.025em" }}
          >
            Working on some changes
          </h1>
          <p className="text-base md:text-lg" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
            We&apos;re refining{plan.title ? <> <span style={{ color: "var(--text-primary)" }}>&ldquo;{plan.title}&rdquo;</span></> : " your proposal"}.
            Your link will keep working — please check back shortly.
          </p>
        </div>
      </div>
    </div>
  );
}

function AlreadyAccepted({ plan }: { plan: ProposalData["plan"] }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-8">
      <div
        className="w-14 h-14 rounded-full mx-auto mb-6 flex items-center justify-center"
        style={{ background: "var(--success)", color: "white" }}
      >
        <Check size={28} />
      </div>
      <h3
        className="text-3xl md:text-4xl font-semibold tracking-tight mb-3"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
      >
        Proposal accepted
      </h3>
      <p className="text-base md:text-lg max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
        {plan.acceptedByClient
          ? `Accepted by ${plan.acceptedByClient.name} on ${formatDate(plan.acceptedAt)}.`
          : `Accepted on ${formatDate(plan.acceptedAt)}.`}
      </p>
    </div>
  );
}
