"use client";

import { useEffect, useRef, useState } from "react";
import ProposalPlanOverview from "@/components/ui/ProposalPlanOverview";
import type { ProposalCopy } from "@/lib/proposal-copy";
import { formatDateShort } from "@/lib/proposal-format";
import { prefersReducedMotion } from "@/lib/useProposalMotion";
import { ProjectDetailPanel } from "./ProjectBody";
import type { ProposalProject } from "./types";

/**
 * Index + detail. The full project list always renders in the right column
 * (you scroll through it); the left sidebar is a scrollspy *navigator* — it
 * highlights the project currently in view and scrolls to one on click. It does
 * not filter. On mobile (no room for a persistent sidebar) the pills act as a
 * filter with an "Alle" option preselected.
 */
export default function ProjectsIndex({
  projects,
  brandColor,
  t,
  lang,
  stickyTop,
}: {
  projects: ProposalProject[];
  brandColor: string;
  t: ProposalCopy;
  lang: "nl" | "en";
  /** px offset that clears the (optionally banner-shifted) sticky bar above. */
  stickyTop: number;
}) {
  // "all" | projectId — only consulted at the mobile breakpoint.
  const [filter, setFilter] = useState<string>("all");
  // Scrollspy highlight (desktop) + timeline emphasis.
  const [activeId, setActiveId] = useState(projects[0]?.id ?? "");
  const panelRefs = useRef<Record<string, HTMLElement | null>>({});

  // Scrollspy: highlight the panel nearest the top of the viewport.
  useEffect(() => {
    const els = projects.map((p) => panelRefs.current[p.id]).filter((e): e is HTMLElement => !!e);
    if (els.length === 0 || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId((visible[0].target as HTMLElement).dataset.pid || "");
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [projects]);

  /** Sidebar / timeline navigation: scroll to a project (and reveal it on mobile). */
  function goTo(id: string) {
    setActiveId(id);
    setFilter(id);
    requestAnimationFrame(() =>
      panelRefs.current[id]?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" })
    );
  }

  function indexLabel(p: ProposalProject): string {
    if (p.scheduledStartDate && p.scheduledEndDate) {
      return `${formatDateShort(p.scheduledStartDate, lang)} – ${formatDateShort(p.scheduledEndDate, lang)}`;
    }
    return t.noPlanning;
  }

  // A single project needs neither the schedule timeline nor the navigator —
  // both only earn their place across multiple projects. Render it full-width.
  if (projects.length === 1) {
    return (
      <div className="mt-10">
        <ProjectDetailPanel project={projects[0]} index={0} showIndex={false} brandColor={brandColor} t={t} lang={lang} />
      </div>
    );
  }

  return (
    <div>
      {/* At-a-glance schedule — clicking a bar scrolls to that project. */}
      <ProposalPlanOverview projects={projects} brandColor={brandColor} onSelect={goTo} activeId={activeId} t={t} lang={lang} />

      <div className="mt-12 lg:grid lg:grid-cols-[clamp(220px,24%,300px)_1fr] lg:gap-12">
        <nav aria-label={t.navProjects(projects.length)}>
          {/* Mobile: filter pills with "Alle" preselected */}
          <ul className="lg:hidden flex gap-2 overflow-x-auto -mx-6 px-6 pb-1">
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => setFilter("all")}
                aria-current={filter === "all" ? "true" : undefined}
                className="rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap border transition-colors focus-visible:[outline:2px_solid_var(--text-primary)] focus-visible:outline-offset-2"
                style={{
                  background: filter === "all" ? `color-mix(in srgb, ${brandColor} 14%, var(--bg-surface))` : "var(--bg-surface)",
                  color: filter === "all" ? brandColor : "var(--proposal-muted)",
                  borderColor: filter === "all" ? `color-mix(in srgb, ${brandColor} 40%, var(--border))` : "var(--border)",
                }}
              >
                {t.allProjects}
              </button>
            </li>
            {projects.map((p, i) => {
              const isActive = filter === p.id;
              return (
                <li key={p.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilter(p.id)}
                    aria-current={isActive ? "true" : undefined}
                    className="rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap border transition-colors focus-visible:[outline:2px_solid_var(--text-primary)] focus-visible:outline-offset-2"
                    style={{
                      background: isActive ? `color-mix(in srgb, ${brandColor} 14%, var(--bg-surface))` : "var(--bg-surface)",
                      color: isActive ? brandColor : "var(--proposal-muted)",
                      borderColor: isActive ? `color-mix(in srgb, ${brandColor} 40%, var(--border))` : "var(--border)",
                    }}
                  >
                    <span className="tabular-nums mr-1.5">{String(i + 1).padStart(2, "0")}</span>
                    {p.title}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Desktop: sticky scrollspy navigator. stickyTop is computed by the
              parent so it clears the sticky bar — including the accepted banner
              when the proposal is signed, which otherwise pushes the bar down
              over these cards. */}
          <ul className="hidden lg:flex lg:flex-col gap-1 lg:sticky self-start" style={{ top: stickyTop }}>
            {projects.map((p, i) => {
              const isActive = activeId === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => goTo(p.id)}
                    aria-current={isActive ? "true" : undefined}
                    className="w-full text-left rounded-xl px-4 py-3 transition-colors hover:bg-elevated focus-visible:[outline:2px_solid_var(--text-primary)] focus-visible:outline-offset-2"
                    style={{ background: isActive ? `color-mix(in srgb, ${brandColor} 12%, var(--bg-surface))` : "transparent" }}
                  >
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-sm tabular-nums font-semibold" style={{ color: isActive ? brandColor : "var(--proposal-muted)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium leading-snug text-text-primary">{p.title}</span>
                    </div>
                    <p className="mt-1 pl-6 text-xs tabular-nums" style={{ color: "var(--proposal-muted)" }}>
                      {indexLabel(p)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Detail — the whole list; mobile shows the filtered subset. */}
        <div className="mt-8 lg:mt-0 min-w-0 space-y-12 lg:space-y-0">
          {projects.map((p, i) => {
            const shownOnMobile = filter === "all" || filter === p.id;
            return (
              <div
                key={p.id}
                data-pid={p.id}
                ref={(el) => {
                  panelRefs.current[p.id] = el;
                }}
                className={`${shownOnMobile ? "block" : "hidden"} lg:block ${
                  i > 0 ? "lg:mt-16 lg:pt-16 lg:border-t lg:border-border-default" : ""
                }`}
                style={{ scrollMarginTop: stickyTop }}
              >
                <ProjectDetailPanel project={p} index={i} brandColor={brandColor} t={t} lang={lang} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
