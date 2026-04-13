"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import GanttTimeline, { GanttBar, GanttRow, GanttSection, GanttVariant } from "@/components/ui/GanttTimeline";
import type { Client, Project } from "@/types";
import { accentColor } from "@/lib/styles";

// ── Avatar helper ─────────────────────────────────────────────────────────────

function ClientIcon({ company }: { company: string }) {
  const abbr = company.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div
      className="rounded flex items-center justify-center text-white text-[8px] font-bold shrink-0"
      style={{ width: 18, height: 18, background: accentColor(company) }}
    >
      {abbr}
    </div>
  );
}

interface Props {
  clients: Client[];
  projectsByClient: Record<string, Project[]>;
  /** Override pixels per day to zoom in/out. */
  pxPerDay?: number;
  /** Custom title for the section header. Default: "Timeline". */
  title?: string;
  /** Whether the timeline can be collapsed. Default: true. */
  collapsible?: boolean;
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

function projectToBar(p: Project, today: Date): GanttBar | null {
  if (p.status === "completed") return null;

  if (p.kickedOffAt) {
    const start = parseDate(p.kickedOffAt);
    const rawEnd = p.deliveryDate
      ? parseDate(p.deliveryDate)
      : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const end = rawEnd < start
      ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
      : rawEnd;
    return { id: p.id, label: p.title, start, end, variant: "active" };
  }

  if (p.scheduledStartDate && p.scheduledEndDate) {
    const start = parseDate(p.scheduledStartDate);
    const rawEnd = parseDate(p.scheduledEndDate);
    const end = rawEnd < start
      ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
      : rawEnd;
    return { id: p.id, label: p.title, start, end, variant: "upcoming" };
  }

  return null;
}

const VARIANT_PRIORITY: Record<GanttVariant, number> = { active: 2, upcoming: 1, muted: 0 };

function topVariant(bars: GanttBar[]): GanttVariant {
  let best: GanttVariant = "muted";
  for (const b of bars) {
    if (VARIANT_PRIORITY[b.variant] > VARIANT_PRIORITY[best]) best = b.variant;
  }
  return best;
}

function buildClientSections(
  clients: Client[],
  projectsByClient: Record<string, Project[]>,
  today: Date
): GanttSection[] {
  const sections: GanttSection[] = [];

  for (const client of clients) {
    const projects = projectsByClient[client.id] ?? [];

    // Group bars by service
    const serviceGroups = new Map<string, { name: string; bars: GanttBar[] }>();
    for (const p of projects) {
      const bar = projectToBar(p, today);
      if (!bar) continue;
      const key = p.serviceId ?? p.service ?? p.id;
      const name = p.service ?? "Other";
      const group = serviceGroups.get(key);
      if (group) {
        group.bars.push(bar);
      } else {
        serviceGroups.set(key, { name, bars: [bar] });
      }
    }

    if (serviceGroups.size === 0) continue;

    const rows: GanttRow[] = [];
    const allBars: GanttBar[] = [];

    for (const [serviceKey, { name, bars }] of serviceGroups) {
      bars.sort((a, b) => a.start.getTime() - b.start.getTime());
      const minStart = new Date(Math.min(...bars.map((b) => b.start.getTime())));
      const maxEnd = new Date(Math.max(...bars.map((b) => b.end.getTime())));
      rows.push({
        id: `${client.id}::${serviceKey}`,
        label: name,
        start: minStart,
        end: maxEnd,
        variant: topVariant(bars),
        bars,
      });
      allBars.push(...bars);
    }

    rows.sort((a, b) => a.start.getTime() - b.start.getTime());

    const summaryBars = allBars.map((b) => ({
      start: b.start,
      end: b.end,
      variant: b.variant,
    }));

    sections.push({
      key: client.id,
      label: client.company,
      rows,
      defaultCollapsed: false,
      summaryBars,
      icon: <ClientIcon company={client.company} />,
    });
  }

  sections.sort((a, b) => {
    const aStart = a.summaryBars![0].start.getTime();
    const bStart = b.summaryBars![0].start.getTime();
    return aStart - bStart;
  });

  return sections;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientsTimeline({ clients, projectsByClient, pxPerDay, title = "Timeline", collapsible = true }: Props) {
  const router = useRouter();

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const sections = useMemo(
    () => buildClientSections(clients, projectsByClient, today),
    [clients, projectsByClient, today]
  );

  // Build a flat lookup: projectId → { project, clientId }
  const projectLookup = useMemo(() => {
    const map = new Map<string, { project: Project; clientId: string }>();
    for (const client of clients) {
      for (const p of projectsByClient[client.id] ?? []) {
        map.set(p.id, { project: p, clientId: client.id });
      }
    }
    return map;
  }, [clients, projectsByClient]);

  const handleBarClick = useCallback(
    (barId: string) => {
      const entry = projectLookup.get(barId);
      if (entry) {
        router.push(`/clients/${entry.clientId}/projects/${barId}/tasks`);
      }
    },
    [router, projectLookup]
  );

  const renderHoverCard = useCallback(
    (barId: string, x: number, y: number) => {
      const entry = projectLookup.get(barId);
      if (!entry) return null;
      const variant: GanttVariant = entry.project.kickedOffAt ? "active" : "upcoming";
      return (
        <ProjectHoverCard project={entry.project} variant={variant} x={x} y={y} />
      );
    },
    [projectLookup]
  );

  const [timelineVisible, setTimelineVisible] = useState(true);
  const Chevron = timelineVisible ? ChevronDown : ChevronRight;
  const isVisible = collapsible ? timelineVisible : true;

  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      {collapsible ? (
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
            {title}
          </span>
        </button>
      ) : (
        <h2
          className="typo-section-title"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
      )}
      {isVisible && (
        <GanttTimeline
          sections={sections}
          onBarClick={handleBarClick}
          renderHoverCard={renderHoverCard}
          pxPerDay={pxPerDay}
        />
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
}: {
  project: Project;
  variant: GanttVariant;
  x: number;
  y: number;
}) {
  const kickoffDate = p.kickedOffAt
    ? fmtLong(parseDate(p.kickedOffAt))
    : p.scheduledStartDate
    ? fmtLong(parseDate(p.scheduledStartDate))
    : null;

  const endDate = p.deliveryDate
    ? fmtLong(parseDate(p.deliveryDate))
    : p.scheduledEndDate
    ? fmtLong(parseDate(p.scheduledEndDate))
    : null;

  const endLabel = p.deliveryDate || p.scheduledEndDate ? "Delivery" : "Est. end";
  const startLabel = variant === "upcoming" ? "Scheduled start" : "Kick-off";
  const statusLabel =
    variant === "upcoming"
      ? "Upcoming"
      : p.status === "in_progress"
      ? "In progress"
      : "Not started";

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

      <div
        className="mt-2 pt-2 space-y-1"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {kickoffDate && <HoverRow label={startLabel} value={kickoffDate} />}
        {endDate && <HoverRow label={endLabel} value={endDate} />}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Status
          </span>
          <span
            className="text-[10px] font-medium"
            style={{ color: "var(--primary)" }}
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
