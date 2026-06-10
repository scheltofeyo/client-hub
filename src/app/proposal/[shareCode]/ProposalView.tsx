"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, FileText, ShieldCheck, Clock, Download } from "lucide-react";
import RichTextDisplay from "@/components/ui/RichTextDisplay";
import UserAvatar from "@/components/ui/UserAvatar";
import SummLogo from "@/components/ui/SummLogo";
import ProposalHeroBackdrop from "@/components/ui/ProposalHeroBackdrop";
import ProposalHeroLine from "@/components/proposal/ProposalHeroLine";
import ProjectsIndex from "@/components/proposal/ProjectsIndex";
import { InlineLabel } from "@/components/proposal/primitives";
import type { ProposalProject, TeamMember } from "@/components/proposal/types";
import { formatEuro, formatDate } from "@/lib/proposal-format";
import { readableFg } from "@/lib/styles";
import { copyFor, type ProposalCopy } from "@/lib/proposal-copy";
import { useReveal, useCountUp, prefersReducedMotion } from "@/lib/useProposalMotion";

// ── Types ────────────────────────────────────────────────────────────────────

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
    status: "draft" | "ready" | "accepted" | "finalized";
    presentedAt: string | null;
    acceptedAt: string | null;
    acceptedByClient: { name: string; email: string } | null;
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
  client: { company: string; primaryColor: string | null; cultureColors?: string[] };
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

/** Resolve a usable accept-button foreground color for any brand color (CSS var or hex). */
function buttonFg(brand: string): string {
  if (brand.startsWith("#")) return readableFg(brand);
  return "#ffffff";
}

/** Consistent keyboard focus ring, visible on any background. */
const FOCUS = "focus-visible:[outline:2px_solid_var(--text-primary)] focus-visible:outline-offset-2";

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
      style={{ height: ACCEPTED_BANNER_HEIGHT, background: "var(--success)", color: "white" }}
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
      className={`fixed bottom-5 left-1/2 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-95 ${FOCUS}`}
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

// ── Section primitives ───────────────────────────────────────────────────────

function SectionTitle({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return <h2 className={large ? "typo-proposal-h2-large" : "typo-proposal-h2"}>{children}</h2>;
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
  const heroSentinelRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    overview: null,
    projects: null,
    investment: null,
    accept: null,
  });

  useEffect(() => {
    fetch(`/api/public/plans/${shareCode}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error ?? "Could not load proposal");
        }
        return r.json();
      })
      .then((payload: ProposalData | InProgressData) => setData(payload))
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

  // Scrollspy for the sticky sub-nav. A scroll-position approach rather than a
  // thin IntersectionObserver band: the untracked sections between the tracked
  // ones (aanleiding, rates, legal) would otherwise leave the highlight
  // stranded on a stale entry whenever one of them filled the band.
  useEffect(() => {
    if (!data || (data as InProgressData).inProgress) return;
    const order = Object.keys(sectionRefs.current) as SectionId[];
    const LINE = 150; // reference line just below the sticky bar
    let raf = 0;
    const update = () => {
      raf = 0;
      let current: SectionId | null = null;
      let lastPresent: SectionId | null = null;
      for (const id of order) {
        const el = sectionRefs.current[id];
        if (!el) continue;
        lastPresent = id;
        if (current === null) current = id; // first rendered section = default
        if (el.getBoundingClientRect().top <= LINE) current = id;
      }
      // At the very bottom, the last section wins even if it's too short for its
      // top to ever cross the line (e.g. the accept block under a tall one).
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom && lastPresent) current = lastPresent;
      if (current) setActiveSection(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [data]);

  if (error) {
    const tFallback = copyFor("nl");
    return (
      <div className="proposal-surface min-h-screen flex items-center justify-center px-6 bg-app">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <FileText size={40} className="text-text-muted mx-auto" />
          <h1 className="typo-proposal-h2">{tFallback.proposalUnavailable}</h1>
          <p className="typo-proposal-lead">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="proposal-surface min-h-screen flex items-center justify-center bg-app">
        <Loader2 size={28} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if ((data as InProgressData).inProgress) {
    const d = data as InProgressData;
    return <InProgressView plan={d.plan} client={d.client} />;
  }

  const fullData = data as ProposalData;
  const { plan, client, projects, totals, rates, legalTerms } = fullData;
  const isAccepted = plan.status === "accepted" || plan.status === "finalized";
  const brandColor = client.primaryColor ?? "var(--primary)";
  const acceptFg = buttonFg(brandColor);
  const showSubNav = projects.length >= 3;
  const lang = plan.language ?? "nl";
  const t = copyFor(lang);

  // Top offset for the sticky project navigator + scroll anchors. It must clear
  // everything pinned above it: the accepted banner (when present), the sticky
  // bar's main row, and its sub-nav row (only shown at ≥3 projects), plus a gap.
  const STICKY_BAR_BASE = 59; // brand top-border + h-14 row + bottom border
  const STICKY_SUBNAV_ROW = 45; // sub-nav row + its top border
  const projectsStickyTop =
    (isAccepted ? ACCEPTED_BANNER_HEIGHT : 0) +
    STICKY_BAR_BASE +
    (showSubNav ? STICKY_SUBNAV_ROW : 0) +
    20;

  function scrollToSection(id: SectionId) {
    setActiveSection(id); // immediate feedback; the spy keeps it in sync after
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    // "Overzicht" returns to the very top of the proposal (hero + intro), not
    // just the summary section that sits below the hero.
    if (id === SECTION_IDS.overview) {
      window.scrollTo({ top: 0, behavior });
      return;
    }
    sectionRefs.current[id]?.scrollIntoView({ behavior, block: "start" });
  }

  function setSectionRef(id: SectionId): (el: HTMLElement | null) => void {
    return (el) => {
      sectionRefs.current[id] = el;
    };
  }

  return (
    <div className="proposal-surface min-h-screen bg-app" style={{ paddingTop: isAccepted ? ACCEPTED_BANNER_HEIGHT : 0 }}>
      {isAccepted && (
        <AcceptedBanner
          acceptedByName={plan.acceptedByClient?.name ?? null}
          acceptedAt={plan.acceptedAt}
          t={t}
          lang={lang}
        />
      )}
      {!isAccepted && activeSection !== SECTION_IDS.accept && (
        <ScrollToAcceptChip
          brandColor={brandColor}
          acceptFg={acceptFg}
          onJump={() => scrollToSection(SECTION_IDS.accept)}
          t={t}
        />
      )}
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

      {/* ─── Hero — brand-wave canvas, full width ─── */}
      <header className="relative overflow-hidden">
        <ProposalHeroBackdrop brandColor={brandColor} />
        <div className="relative z-[1] max-w-5xl mx-auto px-6 md:px-10 lg:px-12 pt-10 md:pt-14 pb-20 md:pb-28">
          <SummLogo width={74} height={29} className="text-text-primary mb-10 md:mb-12" />

          <p className="typo-proposal-eyebrow mb-1" style={{ color: brandColor }}>
            {t.proposalEyebrow}
            {(plan.presentedAt || plan.acceptedAt) && (
              <span style={{ color: "var(--proposal-muted)" }} className="ml-2">
                · {formatDate(plan.acceptedAt ?? plan.presentedAt, lang)}
              </span>
            )}
          </p>
          {(plan.versionLabel || plan.proposalNumber) && (
            <p className="typo-proposal-inline-label mb-5">
              {[plan.versionLabel, plan.proposalNumber].filter(Boolean).join(" · ")}
            </p>
          )}

          <h1 className="typo-proposal-h1 mb-5 max-w-4xl text-balance break-words" style={{ fontWeight: 600 }}>
            {plan.title}
          </h1>

          <p className="text-lg md:text-xl">
            <span style={{ color: "var(--proposal-muted)" }}>{t.preparedFor} </span>
            <span className="text-text-primary font-medium">{client.company}</span>
          </p>

          {/* Proposer — one deliberate frosted card over the wave */}
          <div
            className="mt-12 max-w-xl rounded-2xl border border-border-default p-5 md:p-6 md:backdrop-blur"
            style={{
              background: "color-mix(in srgb, var(--bg-surface) 86%, transparent)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-start gap-4">
              <UserAvatar name={plan.createdBy.name} image={plan.createdBy.image} size={56} />
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="typo-proposal-inline-label !mb-1">{t.yourContact}</p>
                <p className="font-medium text-base text-text-primary">{plan.createdBy.name}</p>
                {plan.createdBy.roleName && (
                  <p className="text-sm mt-0.5" style={{ color: "var(--proposal-muted)" }}>
                    {plan.createdBy.roleName}
                  </p>
                )}
              </div>
            </div>
            {plan.proposerStatement && (
              <p className="mt-4 text-base md:text-lg italic text-text-primary" style={{ lineHeight: 1.6 }}>
                <span style={{ color: brandColor }}>&ldquo;</span>
                {plan.proposerStatement}
                <span style={{ color: brandColor }}>&rdquo;</span>
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Full-width interactive line — closes the hero, seams into the body */}
      <ProposalHeroLine brandColor={brandColor} cultureColors={client.cultureColors} />

      <div ref={heroSentinelRef} aria-hidden style={{ height: 1, marginTop: -1 }} />

      {/* Summary — readable measure */}
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

      {/* Aanleiding & aanpak — readable measure */}
      {(plan.challenge || plan.context || plan.approach) && (
        <section style={{ scrollMarginTop: showSubNav ? 120 : 80 }}>
          <div className="max-w-3xl mx-auto px-6 md:px-10 pt-10 md:pt-14 pb-16 md:pb-20">
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

      {/* Projects — wide, variant-driven */}
      {projects.length > 0 && (
        <section
          id={SECTION_IDS.projects}
          ref={setSectionRef(SECTION_IDS.projects)}
          style={{ scrollMarginTop: showSubNav ? 120 : 80 }}
        >
          <div
            className={`${projects.length === 1 ? "max-w-3xl" : "max-w-5xl"} mx-auto px-6 md:px-10 lg:px-12 pt-8 md:pt-10 pb-16 md:pb-24`}
          >
            <SectionTitle>
              {projects.length} {projects.length === 1 ? t.projectSingular : t.projectPlural}
            </SectionTitle>
            <p className="typo-proposal-lead mt-4 max-w-xl">{t.projectsLead}</p>

            <ProjectsIndex projects={projects} brandColor={brandColor} t={t} lang={lang} stickyTop={projectsStickyTop} />
          </div>
        </section>
      )}

      {/* ─────────── Frozen below this line (from "Wat het kost") ─────────── */}

      {/* Investment */}
      <section
        id={SECTION_IDS.investment}
        ref={setSectionRef(SECTION_IDS.investment)}
        style={{ scrollMarginTop: showSubNav ? 120 : 80 }}
      >
        <div className="max-w-3xl mx-auto px-6 md:px-10 pt-16 md:pt-20 pb-16 md:pb-20">
          <SectionTitle>{t.whatItCosts}</SectionTitle>

          <div
            className="mt-10 rounded-2xl border border-border-default overflow-hidden bg-surface"
            style={{ boxShadow: "var(--shadow-sheet)" }}
          >
            <div>
              {projects.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-6 py-5${i === 0 ? "" : " border-t border-border-default"}`}
                >
                  <div className="min-w-0 pr-4">
                    <p className="font-medium text-text-primary">{p.title}</p>
                    {p.discountAmount > 0 && (
                      <p className="text-sm mt-0.5 tabular-nums" style={{ color: "var(--proposal-muted)" }}>
                        {t.discount}
                        {p.discountType === "percentage" ? ` (${p.discountValue}%)` : ""}: − {formatEuro(p.discountAmount)}
                      </p>
                    )}
                  </div>
                  <p className="text-base tabular-nums font-medium shrink-0 text-text-primary">
                    {p.discountAmount > 0 && (
                      <span className="mr-2 font-normal line-through" style={{ color: "var(--proposal-muted)" }}>
                        <span className="sr-only">{t.originalPrice}: </span>
                        {formatEuro(p.soldPrice)}
                      </span>
                    )}
                    {formatEuro(p.netPrice)}
                  </p>
                </div>
              ))}
            </div>

            {totals.discountAmount > 0 && (
              <div className="px-6 py-4 space-y-1.5 text-sm border-t border-border-default">
                <div className="flex justify-between">
                  <span style={{ color: "var(--proposal-muted)" }}>{t.subtotal}</span>
                  <span className="tabular-nums text-text-primary">{formatEuro(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--proposal-muted)" }}>{t.discount}</span>
                  <span className="tabular-nums text-text-primary">− {formatEuro(totals.discountAmount)}</span>
                </div>
              </div>
            )}

            <InvestmentTotal
              netValue={totals.net}
              vatAmount={totals.vatAmount}
              vatRate={plan.vatRate ?? null}
              totalInclVat={totals.total}
              brandColor={brandColor}
              t={t}
            />
          </div>
        </div>
      </section>

      {/* Voorbehoud & Tarieven */}
      {rates && rates.length > 0 && (
        <RatesSection rates={rates} validUntilDate={plan.validUntilDate ?? null} t={t} lang={lang} />
      )}

      {/* Juridisch */}
      {legalTerms && legalTerms.length > 0 && <LegalSection legalTerms={legalTerms} t={t} />}

      {/* Accept */}
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
        <p className="typo-proposal-inline-label !mb-0">{t.preparedBySumm(new Date().getFullYear())}</p>
        <p className="text-xs" style={{ color: "var(--proposal-muted)" }}>
          {t.confidentialNote(client.company)}
        </p>
      </footer>

      <style jsx global>{`
        .prose-proposal { font-size: 15px; }
        .prose-proposal :where(p) { margin: 0 0 0.85em 0; line-height: 1.7; }
        .prose-proposal :where(p:last-child) { margin-bottom: 0; }
        .prose-proposal :where(ul) { margin: 0 0 0.85em 1.5em; list-style: disc; }
        .prose-proposal :where(ol) { margin: 0 0 0.85em 1.5em; list-style: decimal; }
        .prose-proposal :where(li) { margin-bottom: 0.3em; line-height: 1.65; }
        .prose-proposal :where(strong) { font-weight: 600; }
        .prose-proposal :where(em) { font-style: italic; }
        @media (max-width: 640px) {
          .prose-proposal { font-size: 14px; }
        }
      `}</style>
    </div>
  );
}

// ── Investment total (count-up) ──────────────────────────────────────────────

function InvestmentTotal({
  netValue,
  vatAmount,
  vatRate,
  totalInclVat,
  brandColor,
  t,
}: {
  netValue: number;
  vatAmount: number;
  vatRate: number | null;
  totalInclVat: number;
  brandColor: string;
  t: ProposalCopy;
}) {
  // The ex-VAT figure is the headline — for a business client it's the number
  // that matters. VAT (when it applies) drops to a quiet line beneath it.
  const { ref, value: shown } = useCountUp<HTMLDivElement>(netValue);
  return (
    <div ref={ref} className="px-6 py-8 md:py-10 border-t border-border-default bg-elevated">
      <div className="flex items-baseline justify-between gap-4">
        <span className="typo-proposal-inline-label !mb-0" style={{ color: brandColor }}>
          {vatRate ? t.totalExclVat : t.total}
        </span>
        <span
          className="text-4xl md:text-5xl font-semibold tabular-nums"
          style={{ color: brandColor, letterSpacing: "-0.02em" }}
        >
          {formatEuro(shown)}
        </span>
      </div>
      {vatRate ? (
        <p className="mt-2 text-right text-sm tabular-nums" style={{ color: "var(--proposal-muted)" }}>
          {t.vatOnTop(formatEuro(vatAmount), vatRate, formatEuro(totalInclVat))}
        </p>
      ) : null}
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
        borderTop: `2px solid ${brandColor}`,
      }}
    >
      <div className="flex items-center h-14 max-w-5xl mx-auto px-6 md:px-10 gap-4">
        <div className="flex-1 flex items-center min-w-0">
          <p className="font-medium text-sm truncate hidden sm:block text-text-primary">
            {plan.title}
            <span className="ml-2 font-normal" style={{ color: "var(--proposal-muted)" }}>
              · {client.company}
            </span>
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
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 ${FOCUS}`}
              style={{ background: brandColor, color: acceptFg }}
            >
              {t.acceptShort}
            </button>
          )}
        </div>
      </div>

      {showSubNav && (
        <nav className="max-w-5xl mx-auto px-6 md:px-10 flex items-stretch gap-6 h-11 overflow-x-auto whitespace-nowrap border-t border-border-default">
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
                type="button"
                onClick={() => onJumpSection(id)}
                aria-current={active ? "page" : undefined}
                // Full-height tab so its 2px underline lands flush on the bar's
                // bottom border (-mb-px overlaps it). Inactive tabs darken to ink
                // on hover; the active one carries the brand color + underline.
                className={`typo-proposal-inline-label !mb-0 inline-flex items-center border-b-2 -mb-px transition-colors ${
                  active ? "" : "hover:!text-text-primary"
                } ${FOCUS}`}
                style={{
                  color: active ? brandColor : undefined,
                  borderColor: active ? brandColor : "transparent",
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

// ── Rates section (Voorbehoud & Tarieven) ──────────────────────────────────

function RatesSection({
  rates,
  validUntilDate,
  t,
  lang,
}: {
  rates: RateRow[];
  validUntilDate: string | null;
  t: ProposalCopy;
  lang: "nl" | "en";
}) {
  return (
    <section style={{ scrollMarginTop: 80 }}>
      <div className="max-w-3xl mx-auto px-6 md:px-10 pt-16 md:pt-20 pb-16 md:pb-20">
        <SectionTitle>{t.ratesTitle}</SectionTitle>

        <div className="mt-10 rounded-2xl border border-border-default bg-surface overflow-hidden" style={{ boxShadow: "var(--shadow-sheet)" }}>
          <div className="px-6 py-5 text-sm border-b border-border-default" style={{ lineHeight: 1.55, color: "var(--proposal-muted)" }}>
            {t.ratesIntro}
          </div>
          <div>
            {rates.map((r, i) => (
              <div
                key={r.name}
                className={`flex items-center justify-between px-6 py-4${i === 0 ? "" : " border-t border-border-default"}`}
              >
                <p className="font-medium text-text-primary">{r.name}</p>
                <p className="text-base tabular-nums font-medium text-text-primary">
                  {formatEuro(r.hourlyRate)} <span style={{ color: "var(--proposal-muted)" }}>{t.perHour}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 text-sm border-t border-border-default" style={{ color: "var(--proposal-muted)" }}>
            {t.billingTerms}
          </div>
        </div>

        {validUntilDate && (
          <div
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-border-default bg-surface px-4 py-2 text-sm"
            style={{ color: "var(--proposal-muted)" }}
          >
            <Clock size={14} />
            {t.validUntil(formatDate(validUntilDate, lang))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Legal section (Juridisch) ─────────────────────────────────────────────

function LegalSection({ legalTerms, t }: { legalTerms: LegalTerm[]; t: ProposalCopy }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ scrollMarginTop: 80 }}>
      <div className="max-w-3xl mx-auto px-6 md:px-10 pt-10 md:pt-12 pb-16 md:pb-20">
        <SectionTitle>{t.legalTitle}</SectionTitle>
        <p className="typo-proposal-lead mt-4">{t.legalIntro}</p>

        <div className="mt-8 rounded-2xl border border-border-default bg-surface overflow-hidden" style={{ boxShadow: "var(--shadow-sheet)" }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="legal-terms-body"
            className={`w-full flex items-center justify-between px-6 py-4 text-left hover:bg-elevated transition-colors ${FOCUS}`}
          >
            <span className="font-semibold text-text-primary">{open ? t.hideTerms : t.showTerms}</span>
            <ChevronDown
              size={18}
              className="transition-transform duration-300"
              style={{ color: "var(--proposal-muted)", transform: open ? "rotate(180deg)" : "none" }}
            />
          </button>
          <div id="legal-terms-body" className={`proposal-collapse ${open ? "is-open" : ""}`}>
            <div className="proposal-collapse-inner">
              <div className="border-t border-border-default">
                {legalTerms.map((term, i) => (
                  <div key={term.slug} className={`px-6 py-5${i === 0 ? "" : " border-t border-border-default"}`}>
                    <p className="typo-card-title mb-2">{term.title}</p>
                    <p className="text-sm" style={{ color: "var(--proposal-muted)", lineHeight: 1.55 }}>
                      {term.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
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

  // Deterministic per-index spread (no Math.random — keeps render pure).
  const particles = useMemo(() => {
    const colors = [brandColor, "var(--accent-3)", "var(--accent-6)", "var(--success)"];
    return Array.from({ length: 10 }).map((_, i) => {
      const rand = (o: number) => Math.sin(i * 17.17 + o * 91.7) * 0.5 + 0.5;
      const angle = rand(1) * 360;
      const distance = 60 + rand(2) * 70;
      return {
        key: i,
        tx: Math.cos((angle * Math.PI) / 180) * distance,
        ty: -Math.abs(Math.sin((angle * Math.PI) / 180) * distance) - 20,
        r: (rand(3) - 0.5) * 360,
        delay: rand(4) * 140,
        color: colors[i % colors.length],
      };
    });
  }, [brandColor]);

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
      <div className="max-w-2xl mx-auto text-center py-8 px-6 relative">
        <div className="absolute inset-x-0 top-6 flex justify-center pointer-events-none" aria-hidden="true">
          <div className="relative">
            {particles.map((p) => (
              <span
                key={p.key}
                className="survey-confetti-particle absolute block rounded-full"
                style={
                  {
                    width: 8,
                    height: 8,
                    background: p.color,
                    left: 0,
                    top: 0,
                    ["--confetti-tx" as string]: `${p.tx}px`,
                    ["--confetti-ty" as string]: `${p.ty}px`,
                    ["--confetti-r" as string]: `${p.r}deg`,
                    animation: `survey-confetti-drift 900ms ease-out ${p.delay}ms forwards`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>

        <div
          className="survey-check-icon w-14 h-14 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ background: "var(--success)", animation: "survey-check-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
        >
          <Check size={28} strokeWidth={3} color="#fff" />
        </div>
        <h3 className="typo-proposal-h2 mb-3">{t.thankYou(name)}</h3>
        <p className="typo-proposal-lead max-w-md mx-auto mb-8">{t.thankYouBody}</p>
        <a
          href={`/proposal/${shareCode}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-2 px-6 py-4 rounded-lg text-base font-semibold tracking-wide transition-opacity hover:opacity-95 ${FOCUS}`}
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
      <SectionTitle>{t.readyToStart}</SectionTitle>
      <p className="typo-proposal-lead mt-4">{t.acceptLead(clientCompany)}</p>

      <form onSubmit={submit} className="mt-10 space-y-5">
        {error && <p className="text-sm px-4 py-3 rounded-lg bg-danger-light text-danger">{error}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="accept-name" className="typo-proposal-inline-label block mb-2">
              {t.yourName}
            </label>
            <input
              id="accept-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-default px-4 py-4 text-base outline-none focus:ring-2 focus:ring-[var(--primary)]/30 bg-surface text-text-primary"
            />
          </div>
          <div>
            <label htmlFor="accept-email" className="typo-proposal-inline-label block mb-2">
              {t.yourEmail}
            </label>
            <input
              id="accept-email"
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
          className={`w-full flex items-center justify-center gap-2 px-6 py-6 rounded-lg text-base font-semibold tracking-wide transition-opacity disabled:opacity-50 hover:opacity-95 ${FOCUS}`}
          style={{
            background: brandColor,
            color: acceptFg,
            boxShadow: submitting || !name.trim() || !email.trim() ? undefined : "var(--shadow-subtle)",
          }}
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {submitting ? t.submitting : t.signOffAndStart}
        </button>
        <p className="text-xs text-center" style={{ color: "var(--proposal-muted)" }}>
          {t.acceptDisclaimer}
        </p>
      </form>
    </div>
  );
}

// ── In-progress / maintenance state ─────────────────────────────────────────

function InProgressView({
  plan,
  client,
}: {
  plan: InProgressData["plan"];
  client: InProgressData["client"];
}) {
  const t = copyFor("nl");
  const brandColor = client.primaryColor ?? "var(--primary)";
  return (
    <div className="proposal-surface min-h-screen flex flex-col bg-app">
      <div style={{ height: 4, background: brandColor }} />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full mx-auto text-center">
          <p className="typo-proposal-eyebrow mb-6" style={{ color: brandColor }}>
            {t.proposalEyebrow} · {client.company}
          </p>
          <div className="w-14 h-14 rounded-full mx-auto mb-7 flex items-center justify-center bg-elevated" style={{ color: brandColor }}>
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
  const revealRef = useReveal<HTMLDivElement>();
  return (
    <div className="max-w-2xl mx-auto py-8 px-2 sm:px-6">
      <div
        ref={revealRef}
        className="proposal-reveal rounded-2xl border bg-surface px-8 py-10 md:px-12 md:py-12"
        style={{
          borderColor: `color-mix(in srgb, ${brandColor} 30%, var(--border))`,
          boxShadow: "var(--shadow-sheet)",
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--success)", color: "white" }}>
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
              style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: "var(--text-primary)", letterSpacing: "-0.01em" }}
            >
              {signerName}
            </p>
            <div className="h-px w-48 mb-4" style={{ background: `color-mix(in srgb, ${brandColor} 40%, var(--border))` }} />
            <p className="text-sm" style={{ color: "var(--proposal-muted)" }}>
              {t.digitallySignedOn(formatDate(plan.acceptedAt, lang))}
              {plan.acceptedByClient?.email && <> · {plan.acceptedByClient.email}</>}
            </p>
          </>
        ) : (
          <p className="typo-proposal-lead">{t.acceptedOn(formatDate(plan.acceptedAt, lang))}</p>
        )}

        <a
          href={`/proposal/${shareCode}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-8 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold tracking-wide transition-opacity hover:opacity-95 ${FOCUS}`}
          style={{ background: brandColor, color: buttonFg(brandColor), boxShadow: "var(--shadow-subtle)" }}
        >
          <Download size={16} />
          {t.downloadPdf}
        </a>
      </div>
    </div>
  );
}
