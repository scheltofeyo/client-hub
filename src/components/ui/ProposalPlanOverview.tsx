"use client";

import { useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { readableFg } from "@/lib/styles";
import { useRevealGroup } from "@/lib/useProposalMotion";
import type { ProposalCopy } from "@/lib/proposal-copy";

interface OverviewSession {
  id: string;
  title: string;
  date: string | null;
}

interface OverviewTeamMember {
  userId: string;
  name: string;
  image?: string;
}

interface OverviewProject {
  id: string;
  title: string;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  durationDays: number | null;
  soldPrice: number;
  sessions: OverviewSession[];
  team: OverviewTeamMember[];
}

interface ProposalPlanOverviewProps {
  projects: OverviewProject[];
  brandColor: string;
  onSelect: (projectId: string) => void;
  t: ProposalCopy;
  lang: "nl" | "en";
  /** When set, the matching bar/row is emphasised (used by the timeline-driven variant). */
  activeId?: string;
}

interface DatedProject extends OverviewProject {
  startMs: number;
  endMs: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function locale(lang: "nl" | "en"): string {
  return lang === "en" ? "en-GB" : "nl-NL";
}

function parseDate(s: string | null): number | null {
  if (!s) return null;
  const t = new Date(s + "T00:00:00").getTime();
  return Number.isNaN(t) ? null : t;
}

function formatRangeLabel(ms: number, lang: "nl" | "en"): string {
  return new Date(ms).toLocaleDateString(locale(lang), { month: "short", year: "numeric" });
}

function formatFullDate(s: string | null, lang: "nl" | "en"): string {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale(lang), { day: "numeric", month: "short", year: "numeric" });
}

function rangeLabel(p: OverviewProject, lang: "nl" | "en", t: ProposalCopy): string {
  if (!p.scheduledStartDate || !p.scheduledEndDate) return t.noPlanning;
  return `${formatFullDate(p.scheduledStartDate, lang)} – ${formatFullDate(p.scheduledEndDate, lang)}`;
}

export default function ProposalPlanOverview({
  projects,
  brandColor,
  onSelect,
  t,
  lang,
  activeId,
}: ProposalPlanOverviewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const groupRef = useRevealGroup<HTMLDivElement>(".proposal-bar");

  const dated: DatedProject[] = [];
  const undated: OverviewProject[] = [];

  for (const p of projects) {
    const startMs = parseDate(p.scheduledStartDate);
    const endMs = parseDate(p.scheduledEndDate);
    if (startMs != null && endMs != null) {
      const safeEnd = endMs >= startMs ? endMs : startMs + DAY_MS;
      dated.push({ ...p, startMs, endMs: safeEnd });
    } else {
      undated.push(p);
    }
  }

  if (dated.length === 0 && undated.length === 0) return null;

  let minMs = 0;
  let maxMs = 0;
  let totalMs = DAY_MS;
  if (dated.length > 0) {
    minMs = dated.reduce((m, p) => Math.min(m, p.startMs), Infinity);
    maxMs = dated.reduce((m, p) => Math.max(m, p.endMs), -Infinity);
    totalMs = Math.max(maxMs - minMs + DAY_MS, DAY_MS);
  }

  const fg = brandColor.startsWith("#") ? readableFg(brandColor) : "#ffffff";

  return (
    <div className="mt-10 mb-2">
      {/* Tablet / desktop — proportional timeline */}
      <div ref={groupRef} className="hidden sm:block">
        {dated.length > 0 && (
          <>
            <div
              className="flex justify-between typo-proposal-inline-label !mb-2"
              style={{ paddingLeft: 4, paddingRight: 4 }}
            >
              <span>{formatRangeLabel(minMs, lang)}</span>
              <span>{formatRangeLabel(maxMs, lang)}</span>
            </div>

            <div className="space-y-2">
              {dated.map((p, i) => {
                const leftPct = ((p.startMs - minMs) / totalMs) * 100;
                const widthPct = Math.max(((p.endMs - p.startMs + DAY_MS) / totalMs) * 100, 5);
                return (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    index={i}
                    leftPct={leftPct}
                    widthPct={widthPct}
                    isHovered={hoveredId === p.id}
                    isActive={activeId === p.id}
                    setHovered={setHoveredId}
                    brandColor={brandColor}
                    fg={fg}
                    onSelect={onSelect}
                    t={t}
                    lang={lang}
                  />
                );
              })}
            </div>
          </>
        )}

        {undated.length > 0 && (
          <div className={dated.length > 0 ? "mt-6" : ""}>
            {dated.length > 0 && (
              <p className="typo-proposal-inline-label !mb-3">{t.noPlanning}</p>
            )}
            <div className="space-y-2">
              {undated.map((p, i) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  index={dated.length + i}
                  leftPct={0}
                  widthPct={100}
                  isHovered={hoveredId === p.id}
                  setHovered={setHoveredId}
                  brandColor={brandColor}
                  fg={fg}
                  onSelect={onSelect}
                  t={t}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile — proportional bars are unreadable on a ~340px column, so the
          timeline collapses to a tappable stacked list. */}
      <ul className="sm:hidden space-y-2">
        {projects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              aria-current={activeId === p.id ? "true" : undefined}
              className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
              style={{
                background: activeId === p.id ? `color-mix(in srgb, ${brandColor} 10%, var(--bg-surface))` : "var(--bg-surface)",
                borderColor: activeId === p.id ? `color-mix(in srgb, ${brandColor} 40%, var(--border))` : "var(--border)",
              }}
            >
              <span
                className="w-1.5 h-8 rounded-full shrink-0"
                style={{ background: brandColor }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text-primary truncate">
                  {p.title}
                </span>
                <span className="block text-xs mt-0.5" style={{ color: "var(--proposal-muted)" }}>
                  {rangeLabel(p, lang, t)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectRow({
  project,
  index,
  leftPct,
  widthPct,
  isHovered,
  isActive,
  setHovered,
  brandColor,
  fg,
  onSelect,
  t,
  lang,
}: {
  project: OverviewProject;
  index: number;
  leftPct: number;
  widthPct: number;
  isHovered: boolean;
  isActive?: boolean;
  setHovered: (id: string | null) => void;
  brandColor: string;
  fg: string;
  onSelect: (id: string) => void;
  t: ProposalCopy;
  lang: "nl" | "en";
}) {
  return (
    <div
      className="relative"
      style={{ height: 36, paddingLeft: 4, paddingRight: 4, overflow: "visible" }}
    >
      <div className="relative w-full h-full">
        <button
          type="button"
          onClick={() => onSelect(project.id)}
          onMouseEnter={() => setHovered(project.id)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(project.id)}
          onBlur={() => setHovered(null)}
          aria-current={isActive ? "true" : undefined}
          className="proposal-bar absolute top-0 bottom-0 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
          style={
            {
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              background: brandColor,
              opacity: isHovered || isActive ? 1 : 0.85,
              color: fg,
              paddingLeft: 10,
              paddingRight: 10,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              outline: isActive ? `2px solid ${brandColor}` : undefined,
              outlineOffset: 2,
              ["--reveal-i" as string]: index,
            } as React.CSSProperties
          }
          title={project.title}
        >
          <span className="text-xs font-medium block truncate leading-tight">
            {project.title}
          </span>
        </button>

        {isHovered && (
          <FloatingTooltip
            project={project}
            anchorLeftPct={leftPct + widthPct / 2}
            t={t}
            lang={lang}
          />
        )}
      </div>
    </div>
  );
}

function FloatingTooltip({
  project,
  anchorLeftPct,
  t,
  lang,
}: {
  project: OverviewProject;
  anchorLeftPct: number;
  t: ProposalCopy;
  lang: "nl" | "en";
}) {
  // Clamp horizontal anchor so the 280px tooltip stays within the row.
  const clamped = Math.min(Math.max(anchorLeftPct, 20), 80);

  return (
    <div
      className="absolute z-30 rounded-lg pointer-events-none bg-surface border border-border-default text-text-primary"
      style={{
        bottom: "calc(100% + 8px)",
        left: `${clamped}%`,
        transform: "translateX(-50%)",
        width: 280,
        padding: 12,
        boxShadow: "var(--shadow-sheet)",
      }}
    >
      <p className="text-sm font-semibold leading-tight">{project.title}</p>

      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs" style={{ color: "var(--proposal-muted)" }}>
        <span>{t.timelineStart}</span>
        <span style={{ color: "var(--text-primary)" }}>{formatFullDate(project.scheduledStartDate, lang)}</span>
        <span>{t.timelineEnd}</span>
        <span style={{ color: "var(--text-primary)" }}>{formatFullDate(project.scheduledEndDate, lang)}</span>
      </div>

      {project.sessions.length > 0 && (
        <div className="mt-3">
          <p className="typo-proposal-inline-label !mb-1" style={{ letterSpacing: "0.16em" }}>
            {t.timelineSessions(project.sessions.length)}
          </p>
          <ul className="text-xs space-y-0.5">
            {project.sessions.slice(0, 3).map((s) => (
              <li key={s.id} className="truncate" style={{ color: "var(--text-primary)" }}>
                {s.title}
              </li>
            ))}
            {project.sessions.length > 3 && (
              <li className="text-xs" style={{ color: "var(--proposal-muted)" }}>
                {t.timelineMore(project.sessions.length - 3)}
              </li>
            )}
          </ul>
        </div>
      )}

      {project.team.length > 0 && (
        <div className="mt-3 flex items-center gap-1">
          {project.team.slice(0, 6).map((m) => (
            <UserAvatar key={m.userId} name={m.name} image={m.image ?? null} size={22} />
          ))}
          {project.team.length > 6 && (
            <span className="text-xs ml-1" style={{ color: "var(--proposal-muted)" }}>
              +{project.team.length - 6}
            </span>
          )}
        </div>
      )}

      <p className="mt-3 typo-proposal-inline-label !mb-0" style={{ letterSpacing: "0.16em" }}>
        {t.timelineClickHint}
      </p>
    </div>
  );
}
