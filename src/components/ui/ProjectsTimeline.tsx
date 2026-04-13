"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import GanttTimeline, { GanttBar, GanttRow, GanttSection, GanttVariant } from "@/components/ui/GanttTimeline";
import type { Project } from "@/types";

interface Props {
  projects: Project[];
  clientId: string;
  openTaskCounts?: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDate(str: string): Date {
  return new Date(str + "T00:00:00");
}

function fmtLong(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const VARIANT_PRIORITY: Record<GanttVariant, number> = { active: 2, upcoming: 1, muted: 0 };

function topVariant(bars: GanttBar[]): GanttVariant {
  let best: GanttVariant = "muted";
  for (const b of bars) {
    if (VARIANT_PRIORITY[b.variant] > VARIANT_PRIORITY[best]) best = b.variant;
  }
  return best;
}

/** Determine which section a project belongs to. */
function projectSection(p: Project): "current" | "upcoming" | "completed" | null {
  if (p.status === "completed" && p.kickedOffAt && p.completedDate) return "completed";
  if (p.kickedOffAt) return "current";
  if (p.scheduledStartDate && p.scheduledEndDate) return "upcoming";
  return null;
}

/** Convert a project to a GanttBar. */
function projectToBar(p: Project, today: Date): GanttBar | null {
  const section = projectSection(p);
  if (!section) return null;

  if (section === "completed") {
    return {
      id: p.id,
      label: p.title,
      start: parseDate(p.kickedOffAt!),
      end: parseDate(p.completedDate!),
      variant: "muted",
    };
  }

  if (section === "current") {
    const start = parseDate(p.kickedOffAt!);
    const rawEnd = p.deliveryDate
      ? parseDate(p.deliveryDate)
      : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const end = rawEnd < start
      ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
      : rawEnd;
    return { id: p.id, label: p.title, start, end, variant: "active" };
  }

  // upcoming
  const start = parseDate(p.scheduledStartDate!);
  const rawEnd = parseDate(p.scheduledEndDate!);
  const end = rawEnd < start
    ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
    : rawEnd;
  return { id: p.id, label: p.title, start, end, variant: "upcoming" };
}

/** Section priority: current > upcoming > completed. */
const SECTION_PRIORITY: Record<string, number> = { current: 2, upcoming: 1, completed: 0 };

function buildSections(
  projects: Project[],
  today: Date
): { sections: GanttSection[]; noDates: Project[] } {
  const noDates: Project[] = [];

  // Group projects by service, tracking bars and which section
  const serviceGroups = new Map<
    string,
    { name: string; bars: GanttBar[]; bestSection: string }
  >();

  for (const p of projects) {
    const sec = projectSection(p);
    if (!sec) {
      noDates.push(p);
      continue;
    }

    const bar = projectToBar(p, today);
    if (!bar) continue;

    const key = p.serviceId ?? p.service ?? p.id;
    const name = p.service ?? p.title;
    const group = serviceGroups.get(key);

    if (group) {
      group.bars.push(bar);
      // Promote to higher-priority section
      if (SECTION_PRIORITY[sec] > SECTION_PRIORITY[group.bestSection]) {
        group.bestSection = sec;
      }
    } else {
      serviceGroups.set(key, { name, bars: [bar], bestSection: sec });
    }
  }

  // Build section buckets
  const buckets: Record<string, GanttRow[]> = {
    current: [],
    upcoming: [],
    completed: [],
  };

  for (const [serviceKey, { name, bars, bestSection }] of serviceGroups) {
    bars.sort((a, b) => a.start.getTime() - b.start.getTime());
    const minStart = new Date(Math.min(...bars.map((b) => b.start.getTime())));
    const maxEnd = new Date(Math.max(...bars.map((b) => b.end.getTime())));
    buckets[bestSection].push({
      id: serviceKey,
      label: name,
      start: minStart,
      end: maxEnd,
      variant: topVariant(bars),
      bars,
    });
  }

  const byStart = (a: GanttRow, b: GanttRow) =>
    a.start.getTime() - b.start.getTime();

  const sections: GanttSection[] = [
    { key: "current",   label: "Current",   rows: buckets.current.sort(byStart),   defaultCollapsed: false },
    { key: "upcoming",  label: "Upcoming",  rows: buckets.upcoming.sort(byStart),  defaultCollapsed: false },
    { key: "completed", label: "Completed", rows: buckets.completed.sort(byStart), defaultCollapsed: true  },
  ].filter((s) => s.rows.length > 0);

  return { sections, noDates };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectsTimeline({
  projects,
  clientId,
  openTaskCounts = {},
}: Props) {
  const router = useRouter();

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const { sections, noDates } = useMemo(
    () => buildSections(projects, today),
    [projects, today]
  );

  const handleBarClick = useCallback(
    (barId: string) => {
      router.push(`/clients/${clientId}/projects/${barId}/tasks`);
    },
    [router, clientId]
  );

  const renderHoverCard = useCallback(
    (barId: string, x: number, y: number) => {
      const project = projects.find((p) => p.id === barId);
      if (!project) return null;
      const variant: GanttVariant =
        project.status === "completed"
          ? "muted"
          : project.kickedOffAt
          ? "active"
          : "upcoming";
      return (
        <ProjectHoverCard
          project={project}
          variant={variant}
          x={x}
          y={y}
          openTasks={openTaskCounts[barId]}
        />
      );
    },
    [projects, openTaskCounts]
  );

  if (sections.length === 0 && noDates.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        No projects yet.
      </p>
    );
  }

  const [timelineVisible, setTimelineVisible] = useState(true);
  const Chevron = timelineVisible ? ChevronDown : ChevronRight;

  return (
    <div className="space-y-6">
      {sections.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            className="flex items-center gap-1.5 cursor-pointer select-none"
            style={{ background: "none", border: "none", padding: 0 }}
            onClick={() => setTimelineVisible((v) => !v)}
          >
            <Chevron size={12} style={{ color: "var(--text-muted)" }} />
            <span
              className="typo-section-header"
              style={{ color: "var(--text-muted)" }}
            >
              Timeline
            </span>
          </button>
          {timelineVisible && (
            <GanttTimeline
              sections={sections}
              onBarClick={handleBarClick}
              renderHoverCard={renderHoverCard}
            />
          )}
        </div>
      )}

      {noDates.length > 0 && (
        <div className="space-y-2">
          <h3
            className="typo-section-header"
            style={{ color: "var(--text-muted)" }}
          >
            No dates set
          </h3>
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            {noDates.map((p, idx) => (
              <a
                key={p.id}
                href={`/clients/${clientId}/projects/${p.id}/tasks`}
                className="flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                style={
                  idx < noDates.length - 1
                    ? { borderBottom: "1px solid var(--border)" }
                    : undefined
                }
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--primary-light)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "")
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "var(--border)" }}
                />
                <span
                  className="font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {p.title}
                </span>
                {p.service && (
                  <span
                    className="text-xs ml-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {p.service}
                  </span>
                )}
                <span
                  className="ml-auto text-xs"
                  style={{ color: "var(--primary)" }}
                >
                  Set dates →
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hover card ────────────────────────────────────────────────────────────────

function ProjectHoverCard({
  project: p,
  variant,
  x,
  y,
  openTasks,
}: {
  project: Project;
  variant: GanttVariant;
  x: number;
  y: number;
  openTasks?: number;
}) {
  const kickoffDate = p.kickedOffAt
    ? fmtLong(parseDate(p.kickedOffAt))
    : p.scheduledStartDate
    ? fmtLong(parseDate(p.scheduledStartDate))
    : null;

  const endDate = p.completedDate
    ? fmtLong(parseDate(p.completedDate))
    : p.deliveryDate
    ? fmtLong(parseDate(p.deliveryDate))
    : p.scheduledEndDate
    ? fmtLong(parseDate(p.scheduledEndDate))
    : null;

  const endLabel =
    variant === "muted"
      ? "Completed"
      : p.deliveryDate || p.scheduledEndDate
      ? "Delivery"
      : "Est. end";

  const startLabel = variant === "upcoming" ? "Scheduled start" : "Kick-off";

  const statusLabel =
    variant === "muted"
      ? "Completed"
      : variant === "upcoming"
      ? "Upcoming"
      : p.status === "in_progress"
      ? "In progress"
      : "Not started";

  const statusColor =
    variant === "muted"
      ? "var(--text-muted)"
      : "var(--primary)";

  return (
    <div
      style={{
        position: "fixed",
        left: x + 14,
        top: y - 10,
        zIndex: 1000,
        width: 232,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
        pointerEvents: "none",
      }}
    >
      <p
        className="text-xs font-semibold leading-snug"
        style={{ color: "var(--text-primary)" }}
      >
        {p.title}
      </p>
      {p.service && (
        <p
          className="text-[10px] mt-0.5 font-medium"
          style={{ color: "var(--primary)" }}
        >
          {p.service}
        </p>
      )}
      {p.label && (
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {p.label}
        </p>
      )}

      <div
        className="mt-2 pt-2 space-y-1"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {kickoffDate && <HoverRow label={startLabel} value={kickoffDate} />}
        {endDate && <HoverRow label={endLabel} value={endDate} />}
        {openTasks !== undefined && (
          <HoverRow
            label="Open tasks"
            value={openTasks === 0 ? "None" : String(openTasks)}
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Status
          </span>
          <span
            className="text-[10px] font-medium"
            style={{ color: statusColor }}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function HoverRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span
        className="text-[10px] font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
