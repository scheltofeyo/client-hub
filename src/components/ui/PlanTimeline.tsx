"use client";

import GanttTimeline, { type GanttBar, type GanttRow, type GanttSection } from "@/components/ui/GanttTimeline";

interface DraftRow {
  id: string;
  title: string;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  serviceName?: string | null;
}

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

const NO_SERVICE_LABEL = "Unassigned";

/**
 * Render plan drafts on a single Gantt timeline, grouped per service.
 * Each service becomes its own section; projects within a service become bars
 * on a single row in that section. Projects without a service fall under
 * "Unassigned" at the bottom.
 */
export default function PlanTimeline({ drafts }: { drafts: DraftRow[] }) {
  // Bucket drafts by service name (stable insertion order)
  const groups = new Map<string, DraftRow[]>();
  for (const d of drafts) {
    if (!d.scheduledStartDate || !d.scheduledEndDate) continue;
    const key = d.serviceName?.trim() || NO_SERVICE_LABEL;
    const arr = groups.get(key);
    if (arr) arr.push(d);
    else groups.set(key, [d]);
  }

  if (groups.size === 0) return null;

  // Sort: named services first (in insertion order = creation/rank order from API),
  // "Unassigned" last regardless of position.
  const orderedEntries = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === NO_SERVICE_LABEL && b !== NO_SERVICE_LABEL) return 1;
    if (b === NO_SERVICE_LABEL && a !== NO_SERVICE_LABEL) return -1;
    return 0;
  });

  const sections: GanttSection[] = orderedEntries.map(([serviceName, items]) => {
    const bars: GanttBar[] = items.map((d): GanttBar => {
      const start = parseDate(d.scheduledStartDate!);
      const rawEnd = parseDate(d.scheduledEndDate!);
      const end = rawEnd < start ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : rawEnd;
      return {
        id: d.id,
        label: d.title,
        start,
        end,
        variant: "upcoming",
      };
    });
    const envelopeStart = bars.reduce((min, b) => (b.start < min ? b.start : min), bars[0].start);
    const envelopeEnd = bars.reduce((max, b) => (b.end > max ? b.end : max), bars[0].end);

    const row: GanttRow = {
      id: `service-row-${serviceName}`,
      label: `${bars.length} ${bars.length === 1 ? "project" : "projects"}`,
      start: envelopeStart,
      end: envelopeEnd,
      variant: "upcoming",
      bars,
    };

    return {
      key: `service-${serviceName}`,
      label: serviceName,
      rows: [row],
    };
  });

  return <GanttTimeline sections={sections} />;
}
