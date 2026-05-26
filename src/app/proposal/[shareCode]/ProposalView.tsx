"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, FileText, Moon, Sun, ShieldCheck, Clock, Download } from "lucide-react";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import UserAvatar from "@/components/ui/UserAvatar";
import ProposalPlanOverview from "@/components/ui/ProposalPlanOverview";
import { readableFg } from "@/lib/styles";
import { copyFor, type ProposalCopy } from "@/lib/proposal-copy";

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

interface LegalTerm {
  slug: string;
  title: string;
  content: string;
}

interface RateRow {
  name: string;
  hourlyRate: number;
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
    createdBy: { name: string; image: string | null; roleName?: string | null };
    language?: "nl" | "en";
    validUntilDate?: string | null;
    proposalNumber?: string | null;
    versionLabel?: string | null;
    challenge?: string | null;
    context?: string | null;
    approach?: string | null;
  };
  client: { company: string; primaryColor: string | null };
  projects: ProposalProject[];
  team: TeamMember[];
  rates?: RateRow[];
  legalTerms?: LegalTerm[];
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

function localeFor(lang?: "nl" | "en" | null): string {
  return lang === "en" ? "en-GB" : "nl-NL";
}

function formatDate(s: string | null, lang: "nl" | "en" = "nl"): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(localeFor(lang), { day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(s: string | null, lang: "nl" | "en" = "nl"): string {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(localeFor(lang), { day: "numeric", month: "short" });
}

/** Resolve a usable accept-button foreground color for any brand color (CSS var or hex). */
function buttonFg(brand: string): string {
  if (brand.startsWith("#")) return readableFg(brand);
  return "#ffffff";
}

// ── Accepted banner (fixed, full-width, top of page) ─────────────────────────

const ACCEPTED_BANNER_HEIGHT = 40;

function AcceptedBanner({
  acceptedByName,
  acceptedAt,
  t,
  lang,
}: {
  acceptedByName: string | null;
  acceptedAt: string | null;
  t: ProposalCopy;
  lang: "nl" | "en";
}) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 px-4 text-sm"
      style={{
        height: ACCEPTED_BANNER_HEIGHT,
        background: "var(--success)",
        color: "white",
      }}
    >
      <Check size={15} />
      <p className="truncate">
        {acceptedByName
          ? t.acceptedByPill(acceptedByName, formatDate(acceptedAt, lang))
          : acceptedAt
            ? t.proposalAcceptedAnonymous(formatDate(acceptedAt, lang))
            : t.proposalAccepted}
      </p>
    </div>
  );
}

// ── Floating "scroll to accept" chip ─────────────────────────────────────────

function ScrollToAcceptChip({
  brandColor,
  acceptFg,
  onJump,
  t,
}: {
  brandColor: string;
  acceptFg: string;
  onJump: () => void;
  t: ProposalCopy;
}) {
  return (
    <button
      type="button"
      onClick={onJump}
      className="fixed bottom-5 left-1/2 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-95"
      style={{
        background: brandColor,
        color: acceptFg,
        boxShadow: "var(--shadow-sheet)",
        transform: "translateX(-50%)",
      }}
      aria-label={t.scrollToAccept}
    >
      {t.scrollToAccept}
      <ChevronDown size={16} />
    </button>
  );
}

// ── Theme toggle (floating, bottom-right, scoped to proposal views) ──────────

function ProposalThemeToggle({ t }: { t: ProposalCopy }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setDark(document.documentElement.classList.contains("dark"));
      setMounted(true);
    });
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t.switchToLight : t.switchToDark}
      title={dark ? t.switchToLight : t.switchToDark}
      className="fixed bottom-5 right-5 z-50 w-10 h-10 rounded-full flex items-center justify-center bg-surface text-text-muted border border-border-default hover:text-text-primary transition-colors"
      style={{ boxShadow: "var(--shadow-subtle)" }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

// ── Section primitives ───────────────────────────────────────────────────────

function Eyebrow({ children, color, className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <p
      className={`typo-proposal-eyebrow mb-4${className ? ` ${className}` : ""}`}
      style={color ? { color } : undefined}
    >
      {children}
    </p>
  );
}

function SectionTitle({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return <h2 className={large ? "typo-proposal-h2-large" : "typo-proposal-h2"}>{children}</h2>;
}

function InlineLabel({ children, brand }: { children: React.ReactNode; brand?: string }) {
  return (
    <p className="typo-proposal-inline-label mb-3" style={brand ? { color: brand } : undefined}>
      {children}
    </p>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

const SECTION_IDS = {
  overview: "overview",
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
    const tFallback = copyFor("nl");
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-app">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <FileText size={40} className="text-text-muted mx-auto" />
          <h1 className="typo-proposal-h2">{tFallback.proposalUnavailable}</h1>
          <p className="typo-proposal-lead">{error}</p>
        </div>
        <ProposalThemeToggle t={tFallback} />
      </div>
    );
  }

  if (!data) {
    const tFallback = copyFor("nl");
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Loader2 size={28} className="animate-spin text-text-muted" />
        <ProposalThemeToggle t={tFallback} />
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
  const { plan, client, projects, totals, rates, legalTerms } = fullData;
  const isAccepted = plan.status === "accepted";
  const brandColor = client.primaryColor ?? "var(--primary)";
  const acceptFg = buttonFg(brandColor);
  const showSubNav = projects.length >= 3;
  const lang = plan.language ?? "nl";
  const t = copyFor(lang);

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
    <div className="min-h-screen bg-app" style={{ paddingTop: isAccepted ? ACCEPTED_BANNER_HEIGHT : 0 }}>
      {isAccepted && (
        <AcceptedBanner
          acceptedByName={plan.acceptedByClient?.name ?? null}
          acceptedAt={plan.acceptedAt}
          t={t}
          lang={lang}
        />
      )}
      <ProposalThemeToggle t={t} />
      {!isAccepted && activeSection !== SECTION_IDS.accept && (
        <ScrollToAcceptChip
          brandColor={brandColor}
          acceptFg={acceptFg}
          onJump={() => scrollToSection(SECTION_IDS.accept)}
          t={t}
        />
      )}
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
        topOffset={isAccepted ? ACCEPTED_BANNER_HEIGHT : 0}
        onJumpAccept={() => scrollToSection(SECTION_IDS.accept)}
        onJumpSection={scrollToSection}
        t={t}
      />

      {/* Brand band at top of page */}
      <div style={{ height: 4, background: brandColor }} />

      {/* ─── Hero — full-width, slightly darker bg ─── */}
      <header style={{ background: "var(--bg-hover)" }}>
        <div className="max-w-3xl mx-auto px-6 md:px-10 pt-14 md:pt-20 pb-16 md:pb-20">
          {/* Consolidated meta line: Proposal · date  (version / number on a second line if present) */}
          <p className="typo-proposal-eyebrow mb-1" style={{ color: brandColor }}>
            {t.proposalEyebrow}
            {(plan.presentedAt || plan.acceptedAt) && (
              <span className="text-text-muted ml-2">
                · {formatDate(plan.acceptedAt ?? plan.presentedAt, lang)}
              </span>
            )}
          </p>
          {(plan.versionLabel || plan.proposalNumber) && (
            <p className="typo-proposal-inline-label mb-5 text-text-muted">
              {[plan.versionLabel, plan.proposalNumber].filter(Boolean).join(" · ")}
            </p>
          )}

          <h1 className="typo-proposal-h1 mb-5">{plan.title}</h1>

          <p className="text-lg md:text-xl text-text-muted">
            {t.preparedFor} <span className="text-text-primary">{client.company}</span>
          </p>

          {/* Proposer card — humanizes the document */}
          <div className="mt-12 flex items-start gap-4">
            <UserAvatar name={plan.createdBy.name} image={plan.createdBy.image} size={56} />
            <div className="min-w-0 flex-1 pt-1">
              <p className="typo-proposal-inline-label mb-1">{t.yourContact}</p>
              <p className="font-medium text-base text-text-primary">{plan.createdBy.name}</p>
              {plan.createdBy.roleName && (
                <p className="text-sm text-text-muted mt-0.5">{plan.createdBy.roleName}</p>
              )}
              {plan.proposerStatement && (
                <p
                  className="mt-3 text-base md:text-lg italic max-w-prose text-text-muted border-l-2 pl-4"
                  style={{
                    lineHeight: 1.5,
                    borderColor: `color-mix(in srgb, ${brandColor} 35%, transparent)`,
                  }}
                >
                  &ldquo;{plan.proposerStatement}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sentinel — triggers the sticky bar when out of view */}
      <div ref={heroSentinelRef} aria-hidden style={{ height: 1, marginTop: -1 }} />

      {/* Summary */}
      {plan.summary && (
        <section
          id={SECTION_IDS.overview}
          ref={setSectionRef(SECTION_IDS.overview)}
          style={{ scrollMarginTop: showSubNav ? 120 : 80 }}
        >
          <div className="max-w-3xl mx-auto px-6 md:px-10 pt-10 md:pt-14 pb-16 md:pb-20">
            <SectionTitle large>{t.whatWePropose}</SectionTitle>
            <div className="mt-8 prose-proposal text-text-primary">
              <RichTextDisplay html={plan.summary} />
            </div>
          </div>
        </section>
      )}

      {/* Aanleiding & aanpak — challenge, context, approach */}
      {(plan.challenge || plan.context || plan.approach) && (
        <section style={{ scrollMarginTop: showSubNav ? 120 : 80 }}>
          <div className="max-w-3xl mx-auto px-6 md:px-10 pt-10 md:pt-14 pb-16 md:pb-20">
            <Eyebrow color={brandColor}>{t.aanleidingEyebrow}</Eyebrow>
            <SectionTitle>{t.aanleidingTitle}</SectionTitle>
            <div className="mt-8 space-y-8">
              {plan.challenge && (
                <div>
                  <InlineLabel>{t.challengeLabel}</InlineLabel>
                  <div className="prose-proposal text-text-primary">
                    <RichTextDisplay html={plan.challenge} />
                  </div>
                </div>
              )}
              {plan.context && (
                <div>
                  <InlineLabel>{t.contextLabel}</InlineLabel>
                  <div className="prose-proposal text-text-primary">
                    <RichTextDisplay html={plan.context} />
                  </div>
                </div>
              )}
              {plan.approach && (
                <div>
                  <InlineLabel>{t.approachLabel}</InlineLabel>
                  <div className="prose-proposal text-text-primary">
                    <RichTextDisplay html={plan.approach} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <section
          id={SECTION_IDS.projects}
          ref={setSectionRef(SECTION_IDS.projects)}
          style={{ scrollMarginTop: showSubNav ? 120 : 80 }}
        >
          {/* Intro + timeline overview (default bg) */}
          <div className="max-w-3xl mx-auto px-6 md:px-10 pt-8 md:pt-10 pb-10 md:pb-12">
            <Eyebrow color={brandColor}>{t.whatWellDo}</Eyebrow>
            <SectionTitle>
              {projects.length} {projects.length === 1 ? t.projectSingular : t.projectPlural}
            </SectionTitle>
            <p className="typo-proposal-lead mt-4 max-w-xl">{t.projectsLead}</p>

            <ProposalPlanOverview
              projects={projects}
              brandColor={brandColor}
              onSelect={scrollToProject}
            />
          </div>

          {/* Project detail cards — full-width white surface */}
          <div className="bg-surface">
            <div className="max-w-3xl mx-auto px-6 md:px-10 pt-14 md:pt-16 pb-16 md:pb-20 space-y-12">
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
                  t={t}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Investment */}
      <section
        id={SECTION_IDS.investment}
        ref={setSectionRef(SECTION_IDS.investment)}
        style={{ scrollMarginTop: showSubNav ? 120 : 80 }}
      >
        <div className="max-w-3xl mx-auto px-6 md:px-10 pt-16 md:pt-20 pb-16 md:pb-20">
          <Eyebrow color={brandColor}>{t.investmentEyebrow}</Eyebrow>
          <SectionTitle>{t.whatItCosts}</SectionTitle>

          <div
            className="mt-10 rounded-2xl border border-border-default overflow-hidden bg-surface"
            style={{ boxShadow: "var(--shadow-sheet)" }}
          >
            <div>
              {projects.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-6 py-5${
                    i === 0 ? "" : " border-t border-border-default"
                  }`}
                >
                  <div className="min-w-0 pr-4">
                    <p className="font-medium text-text-primary">{p.title}</p>
                  </div>
                  <p className="text-base tabular-nums font-medium shrink-0 text-text-primary">
                    {formatEuro(p.soldPrice)}
                  </p>
                </div>
              ))}
            </div>

            {/* Discount/VAT mini-line items */}
            {(plan.discountType || plan.vatRate) && (
              <div className="px-6 py-4 space-y-1.5 text-sm border-t border-border-default">
                <div className="flex justify-between">
                  <span className="text-text-muted">{t.subtotal}</span>
                  <span className="tabular-nums text-text-primary">
                    {formatEuro(totals.subtotal)}
                  </span>
                </div>
                {plan.discountType && totals.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">
                      {t.discount}
                      {plan.discountType === "percentage" ? ` (${plan.discountValue}%)` : ""}
                    </span>
                    <span className="tabular-nums text-text-primary">
                      − {formatEuro(totals.discountAmount)}
                    </span>
                  </div>
                )}
                {plan.discountType && totals.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t.net}</span>
                    <span className="tabular-nums text-text-primary">{formatEuro(totals.net)}</span>
                  </div>
                )}
                {plan.vatRate ? (
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t.vat} ({plan.vatRate}%)</span>
                    <span className="tabular-nums text-text-primary">
                      {formatEuro(totals.vatAmount)}
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Total — the moment that matters */}
            <div className="px-6 py-8 md:py-10 flex items-baseline justify-between border-t border-border-default bg-elevated">
              <span className="typo-proposal-inline-label !mb-0" style={{ color: brandColor }}>
                {plan.vatRate ? t.totalInclVat : t.total}
              </span>
              <span
                className="text-4xl md:text-5xl font-semibold tabular-nums"
                style={{ color: brandColor, letterSpacing: "-0.02em" }}
              >
                {formatEuro(totals.total)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Voorbehoud & Tarieven */}
      {rates && rates.length > 0 && (
        <RatesSection
          rates={rates}
          brandColor={brandColor}
          validUntilDate={plan.validUntilDate ?? null}
          t={t}
          lang={lang}
        />
      )}

      {/* Juridisch */}
      {legalTerms && legalTerms.length > 0 && (
        <LegalSection legalTerms={legalTerms} brandColor={brandColor} t={t} />
      )}

      {/* Accept — full-width tinted section */}
      <section
        id={SECTION_IDS.accept}
        ref={setSectionRef(SECTION_IDS.accept)}
        className="bg-elevated"
        style={{ scrollMarginTop: showSubNav ? 120 : 80 }}
      >
        <div className="max-w-3xl mx-auto px-6 md:px-10 pt-16 md:pt-20 pb-20">
          {isAccepted ? (
            <AlreadyAccepted plan={plan} brandColor={brandColor} shareCode={shareCode} t={t} lang={lang} />
          ) : (
            <AcceptBlock
              shareCode={shareCode}
              brandColor={brandColor}
              acceptFg={acceptFg}
              clientCompany={client.company}
              t={t}
            />
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-6 md:px-10 pt-12 pb-12 text-center space-y-2">
        <p className="typo-proposal-inline-label !mb-0">
          {t.preparedBySumm(new Date().getFullYear())}
        </p>
        <p className="text-xs text-text-muted">
          {t.confidentialNote(client.company)}
        </p>
      </footer>

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
  topOffset,
  onJumpAccept,
  onJumpSection,
  t,
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
  topOffset: number;
  onJumpAccept: () => void;
  onJumpSection: (id: SectionId) => void;
  t: ProposalCopy;
}) {
  return (
    <div
      className="fixed left-0 right-0 z-50 transition-opacity duration-200 border-b border-border-default"
      style={{
        top: topOffset,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        backdropFilter: "saturate(180%) blur(8px)",
        WebkitBackdropFilter: "saturate(180%) blur(8px)",
        background: "color-mix(in srgb, var(--bg-app) 92%, transparent)",
      }}
    >
      {/* Brand stripe accent */}
      <div className="flex items-stretch h-14 max-w-5xl mx-auto px-6 md:px-10">
        <div className="w-1 self-stretch mr-4" style={{ background: brandColor }} aria-hidden />
        <div className="flex-1 flex items-center min-w-0">
          <p className="font-medium text-sm truncate hidden sm:block text-text-primary">
            {plan.title}
            <span className="ml-2 font-normal text-text-muted">· {client.company}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm tabular-nums font-medium text-text-primary">
            {new Intl.NumberFormat("nl-NL", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(total)}
          </span>
          {isAccepted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-success-light text-success">
              <Check size={13} /> {t.acceptedShort}
            </span>
          ) : (
            <button
              onClick={onJumpAccept}
              className="px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: brandColor, color: acceptFg }}
            >
              {t.acceptShort}
            </button>
          )}
        </div>
      </div>

      {/* Sub-nav row (only ≥3 projects) */}
      {showSubNav && (
        <div className="max-w-5xl mx-auto px-6 md:px-10 flex items-center gap-6 h-11 overflow-x-auto whitespace-nowrap border-t border-border-default">
          {(
            [
              { id: SECTION_IDS.overview, label: t.navOverview },
              { id: SECTION_IDS.projects, label: t.navProjects(projectCount) },
              { id: SECTION_IDS.investment, label: t.navInvestment },
              { id: SECTION_IDS.accept, label: t.navAccept },
            ] as const
          ).map(({ id, label }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => onJumpSection(id)}
                className="typo-proposal-inline-label !mb-0 transition-colors"
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
  t,
  lang,
}: {
  project: ProposalProject;
  index: number;
  brandColor: string;
  collapsibleMode: boolean;
  scrollOffset: number;
  isOpen: boolean;
  onToggle: () => void;
  articleRef: (el: HTMLElement | null) => void;
  t: ProposalCopy;
  lang: "nl" | "en";
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
            <span className="typo-proposal-inline-label !mb-0">{project.service}</span>
          )}
        </div>

        <div className="flex items-start gap-4">
          <h3 className="flex-1 typo-proposal-h3">{project.title}</h3>
          {collapsibleMode && (
            <div className="shrink-0 mt-1.5 transition-transform text-text-muted flex items-center gap-1.5">
              <span className="text-xs font-medium">{open ? t.lessInfo : t.moreInfo}</span>
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          )}
        </div>

        {/* Compact meta row */}
        {(project.scheduledStartDate || project.durationDays != null || project.soldPrice > 0) && (
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-text-muted">
            {project.scheduledStartDate && project.scheduledEndDate && (
              <span>
                <span className="typo-proposal-inline-label !mb-0.5 block">{t.whenLabel}</span>
                <span className="text-text-primary">
                  {formatDateShort(project.scheduledStartDate, lang)} – {formatDateShort(project.scheduledEndDate, lang)}
                </span>
              </span>
            )}
            {project.durationDays != null && (
              <span>
                <span className="typo-proposal-inline-label !mb-0.5 block">{t.durationLabel}</span>
                <span className="text-text-primary">
                  {project.durationDays} {project.durationDays === 1 ? t.dayLabel : t.daysLabel}
                </span>
              </span>
            )}
            {project.soldPrice > 0 && (
              <span>
                <span className="typo-proposal-inline-label !mb-0.5 block">{t.investmentLabel}</span>
                <span className="tabular-nums font-medium text-text-primary">
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
              {project.sections.why && <FieldBlock label={t.whyLabel} content={project.sections.why} />}
              {project.sections.how && <FieldBlock label={t.howLabel} content={project.sections.how} />}
              {project.sections.what && <FieldBlock label={t.whatLabel} content={project.sections.what} />}
              {project.sections.activities && (
                <FieldBlock label={t.activitiesLabel} content={project.sections.activities} />
              )}
              {project.sections.deliverables && (
                <FieldBlock label={t.deliverablesLabel} content={project.sections.deliverables} />
              )}
            </>
          )}

          {project.sessions.length > 0 && (
            <div>
              <InlineLabel>{t.sessionsLabel}</InlineLabel>
              <div className="rounded-2xl border border-border-default overflow-hidden">
                {project.sessions.map((s, i) => (
                  <SessionRow key={s.id} session={s} first={i === 0} t={t} lang={lang} />
                ))}
              </div>
            </div>
          )}

          {project.team.length > 0 && (
            <div>
              <InlineLabel>{t.teamLabel}</InlineLabel>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {project.team.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2.5">
                    <UserAvatar name={m.name} image={m.image ?? null} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{m.name}</p>
                      {m.roleLabel && (
                        <p className="text-xs text-text-muted">{m.roleLabel}</p>
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

function SessionRow({ session, first, t, lang }: { session: ProposalSession; first: boolean; t: ProposalCopy; lang: "nl" | "en" }) {
  const d = session.date ? new Date(session.date + "T00:00:00") : null;
  const validDate = d && !isNaN(d.getTime()) ? d : null;
  const day = validDate ? validDate.getDate() : null;
  const month = validDate
    ? validDate.toLocaleDateString(localeFor(lang), { month: "short" }).toUpperCase()
    : null;

  const metaParts: string[] = [];
  if (session.location) metaParts.push(session.location);
  if (session.participantCount > 0) {
    metaParts.push(
      `${session.participantCount} ${session.participantCount === 1 ? t.participantSingular : t.participantPlural}`
    );
  }

  return (
    <div className={`flex gap-5 px-5 py-5 bg-surface${first ? "" : " border-t border-border-default"}`}>
      {/* Date column */}
      <div
        className={`shrink-0 flex flex-col items-center justify-center rounded-lg py-2 text-center ${
          validDate ? "bg-elevated" : "border border-dashed border-border-default"
        }`}
        style={{ width: 64, minHeight: 64 }}
      >
        {validDate ? (
          <>
            <span className="typo-proposal-inline-label !mb-0" style={{ letterSpacing: "0.16em" }}>
              {month}
            </span>
            <span
              className="text-2xl font-semibold tabular-nums leading-none mt-1 text-text-primary"
              style={{ letterSpacing: "-0.02em" }}
            >
              {day}
            </span>
          </>
        ) : (
          <span
            className="typo-proposal-inline-label !mb-0 px-1 leading-tight"
            style={{ letterSpacing: "0.16em" }}
          >
            {t.tbdLabel}
          </span>
        )}
      </div>

      {/* Body column */}
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-text-primary">{session.title}</p>
        {metaParts.length > 0 && (
          <p className="text-sm mt-1 text-text-muted">{metaParts.join(" · ")}</p>
        )}
        {session.info && (
          <div className="mt-3 prose-proposal text-sm text-text-primary">
            <RichTextDisplay html={session.info} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rates section (Voorbehoud & Tarieven) ──────────────────────────────────

function RatesSection({
  rates,
  brandColor,
  validUntilDate,
  t,
  lang,
}: {
  rates: RateRow[];
  brandColor: string;
  validUntilDate: string | null;
  t: ProposalCopy;
  lang: "nl" | "en";
}) {
  return (
    <section style={{ scrollMarginTop: 80 }}>
      <div className="max-w-3xl mx-auto px-6 md:px-10 pt-16 md:pt-20 pb-16 md:pb-20">
        <Eyebrow color={brandColor}>{t.ratesEyebrow}</Eyebrow>
        <SectionTitle>{t.ratesTitle}</SectionTitle>

        <div
          className="mt-10 rounded-2xl border border-border-default bg-surface overflow-hidden"
          style={{ boxShadow: "var(--shadow-sheet)" }}
        >
          <div className="px-6 py-5 text-sm text-text-muted border-b border-border-default" style={{ lineHeight: 1.55 }}>
            {t.ratesIntro}
          </div>
          <div>
            {rates.map((r, i) => (
              <div
                key={r.name}
                className={`flex items-center justify-between px-6 py-4${
                  i === 0 ? "" : " border-t border-border-default"
                }`}
              >
                <p className="font-medium text-text-primary">{r.name}</p>
                <p className="text-base tabular-nums font-medium text-text-primary">
                  {formatEuro(r.hourlyRate)} <span className="text-text-muted">{t.perHour}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 text-sm text-text-muted border-t border-border-default">
            {t.billingTerms}
          </div>
        </div>

        {validUntilDate && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border-default bg-surface px-4 py-2 text-sm text-text-muted">
            <Clock size={14} />
            {t.validUntil(formatDate(validUntilDate, lang))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Legal section (Juridisch) ─────────────────────────────────────────────

function LegalSection({
  legalTerms,
  brandColor,
  t,
}: {
  legalTerms: LegalTerm[];
  brandColor: string;
  t: ProposalCopy;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ scrollMarginTop: 80 }}>
      <div className="max-w-3xl mx-auto px-6 md:px-10 pt-10 md:pt-12 pb-16 md:pb-20">
        <Eyebrow color={brandColor}>{t.legalEyebrow}</Eyebrow>
        <SectionTitle>{t.legalTitle}</SectionTitle>
        <p className="typo-proposal-lead mt-4">{t.legalIntro}</p>

        <div
          className="mt-8 rounded-2xl border border-border-default bg-surface overflow-hidden"
          style={{ boxShadow: "var(--shadow-sheet)" }}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-elevated transition-colors"
          >
            <span className="font-semibold text-text-primary">
              {open ? t.hideTerms : t.showTerms}
            </span>
            {open ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
          </button>
          {open && (
            <div className="border-t border-border-default">
              {legalTerms.map((term, i) => (
                <div
                  key={term.slug}
                  className={`px-6 py-5${i === 0 ? "" : " border-t border-border-default"}`}
                >
                  <p className="typo-card-title mb-2">{term.title}</p>
                  <p className="text-sm text-text-muted" style={{ lineHeight: 1.55 }}>{term.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FieldBlock({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <InlineLabel>{label}</InlineLabel>
      <div className="prose-proposal text-text-primary">
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
  clientCompany,
  t,
}: {
  shareCode: string;
  brandColor: string;
  acceptFg: string;
  clientCompany: string;
  t: ProposalCopy;
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
      setError(d.error ?? t.somethingWrong);
      return;
    }
    setAccepted(true);
  }

  if (accepted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-8 px-6">
        <div
          className="w-14 h-14 rounded-full mx-auto mb-6 flex items-center justify-center bg-success"
          style={{ color: "white" }}
        >
          <Check size={28} />
        </div>
        <h3 className="typo-proposal-h2 mb-3">{t.thankYou(name)}</h3>
        <p className="typo-proposal-lead max-w-md mx-auto mb-8">{t.thankYouBody}</p>
        <a
          href={`/proposal/${shareCode}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-lg text-base font-semibold tracking-wide transition-opacity hover:opacity-95"
          style={{ background: brandColor, color: acceptFg, boxShadow: "var(--shadow-subtle)" }}
        >
          <Download size={18} />
          {t.downloadPdf}
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Eyebrow color={brandColor}>{t.nextStepsEyebrow}</Eyebrow>
      <SectionTitle>{t.readyToStart}</SectionTitle>
      <p className="typo-proposal-lead mt-4">{t.acceptLead(clientCompany)}</p>

      <form onSubmit={submit} className="mt-10 space-y-5">
        {error && (
          <p className="text-sm px-4 py-3 rounded-lg bg-danger-light text-danger">{error}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="typo-proposal-inline-label block mb-2">{t.yourName}</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-default px-4 py-4 text-base outline-none focus:ring-2 focus:ring-[var(--primary)]/30 bg-surface text-text-primary"
            />
          </div>
          <div>
            <label className="typo-proposal-inline-label block mb-2">{t.yourEmail}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-border-default px-4 py-4 text-base outline-none focus:ring-2 focus:ring-[var(--primary)]/30 bg-surface text-text-primary"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || !name.trim() || !email.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-6 rounded-lg text-base font-semibold tracking-wide transition-opacity disabled:opacity-50 hover:opacity-95"
          style={{
            background: brandColor,
            color: acceptFg,
            boxShadow: submitting || !name.trim() || !email.trim() ? undefined : "var(--shadow-subtle)",
          }}
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {submitting ? t.submitting : t.signOffAndStart}
        </button>
        <p className="text-xs text-center text-text-muted">{t.acceptDisclaimer}</p>
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
  // Language isn't sent in the in-progress payload; default to NL.
  const t = copyFor("nl");
  const brandColor = client.primaryColor ?? "var(--primary)";
  return (
    <div className="min-h-screen flex flex-col bg-app">
      <ProposalThemeToggle t={t} />
      <div style={{ height: 4, background: brandColor }} />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full mx-auto text-center">
          <p className="typo-proposal-eyebrow mb-6" style={{ color: brandColor }}>
            {t.proposalEyebrow} · {client.company}
          </p>
          <div
            className="w-14 h-14 rounded-full mx-auto mb-7 flex items-center justify-center bg-elevated"
            style={{ color: brandColor }}
          >
            <Loader2 size={26} className="animate-spin" />
          </div>
          <h1 className="typo-proposal-h2 mb-4">{t.inProgressTitle}</h1>
          <p className="typo-proposal-lead">
            {plan.title ? t.inProgressBodyWithTitle(plan.title) : t.inProgressBodyNoTitle}
          </p>
        </div>
      </div>
    </div>
  );
}

function AlreadyAccepted({
  plan,
  brandColor,
  shareCode,
  t,
  lang,
}: {
  plan: ProposalData["plan"];
  brandColor: string;
  shareCode: string;
  t: ProposalCopy;
  lang: "nl" | "en";
}) {
  const signerName = plan.acceptedByClient?.name ?? null;
  return (
    <div className="max-w-2xl mx-auto py-8 px-2 sm:px-6">
      <div
        className="rounded-2xl border bg-surface px-8 py-10 md:px-12 md:py-12"
        style={{
          borderColor: `color-mix(in srgb, ${brandColor} 30%, var(--border))`,
          boxShadow: "var(--shadow-sheet)",
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "var(--success)", color: "white" }}
          >
            <ShieldCheck size={20} />
          </div>
          <p className="typo-proposal-eyebrow !mb-0" style={{ color: "var(--success)" }}>
            {t.officiallyAccepted}
          </p>
        </div>

        {signerName ? (
          <>
            <p
              className="text-3xl md:text-4xl italic mb-3"
              style={{
                fontFamily: '"Georgia", "Times New Roman", serif',
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              {signerName}
            </p>
            <div
              className="h-px w-48 mb-4"
              style={{ background: `color-mix(in srgb, ${brandColor} 40%, var(--border))` }}
            />
            <p className="text-sm text-text-muted">
              {t.digitallySignedOn(formatDate(plan.acceptedAt, lang))}
              {plan.acceptedByClient?.email && (
                <> · {plan.acceptedByClient.email}</>
              )}
            </p>
          </>
        ) : (
          <p className="typo-proposal-lead">{t.acceptedOn(formatDate(plan.acceptedAt, lang))}</p>
        )}

        <a
          href={`/proposal/${shareCode}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold tracking-wide transition-opacity hover:opacity-95"
          style={{ background: brandColor, color: buttonFg(brandColor), boxShadow: "var(--shadow-subtle)" }}
        >
          <Download size={16} />
          {t.downloadPdf}
        </a>
      </div>
    </div>
  );
}
