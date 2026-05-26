"use client";

import { useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { readableFg } from "@/lib/styles";

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
}

interface DatedProject extends OverviewProject {
  startMs: number;
  endMs: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function parseDate(s: string | null): number | null {
  if (!s) return null;
  const t = new Date(s + "T00:00:00").getTime();
  return Number.isNaN(t) ? null : t;
}

function formatRangeLabel(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatFullDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ProposalPlanOverview({
  projects,
  brandColor,
  onSelect,
}: ProposalPlanOverviewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  return (
    <div className="mt-10 mb-2">
      {dated.length > 0 && (
        <>
          <div
            className="flex justify-between text-[10px] font-semibold uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--text-muted)", paddingLeft: 4, paddingRight: 4 }}
          >
            <span>{formatRangeLabel(minMs)}</span>
            <span>{formatRangeLabel(maxMs)}</span>
          </div>

          <div className="space-y-2">
            {dated.map((p) => {
              const leftPct = ((p.startMs - minMs) / totalMs) * 100;
              const widthPct = Math.max(((p.endMs - p.startMs + DAY_MS) / totalMs) * 100, 5);
              return (
                <ProjectRow
                  key={p.id}
                  project={p}
                  leftPct={leftPct}
                  widthPct={widthPct}
                  isHovered={hoveredId === p.id}
                  setHovered={setHoveredId}
                  brandColor={brandColor}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </>
      )}

      {undated.length > 0 && (
        <div className={dated.length > 0 ? "mt-6" : ""}>
          {dated.length > 0 && (
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              Nog te plannen
            </p>
          )}
          <div className="space-y-2">
            {undated.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                leftPct={0}
                widthPct={100}
                isHovered={hoveredId === p.id}
                setHovered={setHoveredId}
                brandColor={brandColor}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  leftPct,
  widthPct,
  isHovered,
  setHovered,
  brandColor,
  onSelect,
}: {
  project: OverviewProject;
  leftPct: number;
  widthPct: number;
  isHovered: boolean;
  setHovered: (id: string | null) => void;
  brandColor: string;
  onSelect: (id: string) => void;
}) {
  const fg = brandColor.startsWith("#") ? readableFg(brandColor) : "#ffffff";
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
          className="absolute top-0 bottom-0 rounded-md text-left transition-opacity focus:outline-none focus-visible:ring-2"
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            background: brandColor,
            opacity: isHovered ? 1 : 0.85,
            color: fg,
            paddingLeft: 10,
            paddingRight: 10,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
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
          />
        )}
      </div>
    </div>
  );
}

function FloatingTooltip({
  project,
  anchorLeftPct,
}: {
  project: OverviewProject;
  anchorLeftPct: number;
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

      <div
        className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        <span>Start</span>
        <span style={{ color: "var(--text-primary)" }}>
          {formatFullDate(project.scheduledStartDate)}
        </span>
        <span>End</span>
        <span style={{ color: "var(--text-primary)" }}>
          {formatFullDate(project.scheduledEndDate)}
        </span>
      </div>

      {project.sessions.length > 0 && (
        <div className="mt-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Sessions ({project.sessions.length})
          </p>
          <ul className="text-xs space-y-0.5">
            {project.sessions.slice(0, 3).map((s) => (
              <li key={s.id} className="truncate" style={{ color: "var(--text-primary)" }}>
                {s.title}
              </li>
            ))}
            {project.sessions.length > 3 && (
              <li className="text-xs" style={{ color: "var(--text-muted)" }}>
                + {project.sessions.length - 3} more
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
            <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>
              +{project.team.length - 6}
            </span>
          )}
        </div>
      )}

      <p
        className="mt-3 text-[10px] uppercase tracking-[0.16em]"
        style={{ color: "var(--text-muted)" }}
      >
        Klik voor meer info
      </p>
    </div>
  );
}
