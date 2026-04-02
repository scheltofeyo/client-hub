"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import GanttTimeline, { GanttRow, GanttSection, GanttVariant } from "@/components/ui/GanttTimeline";
import type { Client, Project } from "@/types";

// ── Avatar helper ─────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#D97706",
  "#DC2626", "#DB2777", "#0891B2", "#0D9488",
];

function accentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

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

function projectToRow(p: Project, today: Date): GanttRow | null {
  if (p.status === "completed") return null;

  if (p.kickedOffAt) {
    const start = parseDate(p.kickedOffAt);
    const rawEnd = p.deliveryDate
      ? parseDate(p.deliveryDate)
      : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const end = rawEnd < start
      ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
      : rawEnd;
    return {
      id: p.id,
      label: p.title,
      sublabel: p.service,
      start,
      end,
      variant: "active",
    };
  }

  if (p.scheduledStartDate && p.scheduledEndDate) {
    const start = parseDate(p.scheduledStartDate);
    const rawEnd = parseDate(p.scheduledEndDate);
    const end = rawEnd < start
      ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
      : rawEnd;
    return {
      id: p.id,
      label: p.title,
      sublabel: p.service,
      start,
      end,
      variant: "upcoming",
    };
  }

  return null;
}

function buildClientSections(
  clients: Client[],
  projectsByClient: Record<string, Project[]>,
  today: Date
): GanttSection[] {
  const sections: GanttSection[] = [];

  for (const client of clients) {
    const projects = projectsByClient[client.id] ?? [];
    const rows: GanttRow[] = [];
    for (const p of projects) {
      const row = projectToRow(p, today);
      if (row) rows.push(row);
    }
    if (rows.length === 0) continue;

    rows.sort((a, b) => a.start.getTime() - b.start.getTime());

    const summaryBars = rows.map((r) => ({
      start: r.start,
      end: r.end,
      variant: r.variant,
    }));

    sections.push({
      key: client.id,
      label: client.company,
      rows,
      defaultCollapsed: true,
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

export default function ClientsTimeline({ clients, projectsByClient }: Props) {
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

  const handleRowClick = useCallback(
    (rowId: string) => {
      const entry = projectLookup.get(rowId);
      if (entry) {
        router.push(`/clients/${entry.clientId}/projects/${rowId}/tasks`);
      }
    },
    [router, projectLookup]
  );

  const renderHoverCard = useCallback(
    (row: GanttRow, x: number, y: number) => {
      const entry = projectLookup.get(row.id);
      if (!entry) return null;
      return (
        <ProjectHoverCard project={entry.project} variant={row.variant} x={x} y={y} />
      );
    },
    [projectLookup]
  );

  const [timelineVisible, setTimelineVisible] = useState(true);
  const Chevron = timelineVisible ? ChevronDown : ChevronRight;

  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="flex items-center gap-1.5 cursor-pointer select-none"
        style={{ background: "none", border: "none", padding: 0 }}
        onClick={() => setTimelineVisible((v) => !v)}
      >
        <Chevron size={12} style={{ color: "var(--text-muted)" }} />
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Timeline
        </span>
      </button>
      {timelineVisible && (
        <GanttTimeline
          sections={sections}
          onRowClick={handleRowClick}
          renderHoverCard={renderHoverCard}
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
