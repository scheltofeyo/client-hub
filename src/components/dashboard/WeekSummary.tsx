"use client";

import { useMemo } from "react";
import { Cake, Plane } from "lucide-react";
import { WEEK_CARD_TYPES } from "@/lib/utils";
import type { WeekCalendarItem, WeekCardType } from "@/lib/utils";
import type { WeekTeamData } from "@/types";

interface Props {
  items: WeekCalendarItem[];
  teamData: WeekTeamData;
}

// Display order + plural forms for the work-event stats. Singular comes from
// WEEK_CARD_TYPES so the label vocabulary stays in one place.
const SUMMARY_ORDER: { type: WeekCardType; plural: string }[] = [
  { type: "deadline", plural: "deadlines" },
  { type: "delivery", plural: "deliveries" },
  { type: "kickoff", plural: "kick-offs" },
  { type: "followup", plural: "follow-ups" },
  { type: "event", plural: "events" },
];

function Stat({
  count,
  label,
  dotColor,
}: {
  count: number;
  label: string;
  dotColor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ background: dotColor }}
        aria-hidden
      />
      <span
        className="typo-card-title tabular-nums"
        style={{ color: "var(--text-primary)" }}
      >
        {count}
      </span>
      <span className="typo-caption" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

export default function WeekSummary({ items, teamData }: Props) {
  const typeCounts = useMemo(() => {
    const map = new Map<WeekCardType, number>();
    for (const item of items) map.set(item.type, (map.get(item.type) ?? 0) + 1);
    return map;
  }, [items]);

  const peopleOff = useMemo(
    () => new Set(teamData.timeOff.map((e) => e.userId)).size,
    [teamData.timeOff]
  );
  const birthdays = teamData.birthdays.length;

  const workStats = SUMMARY_ORDER.map(({ type, plural }) => ({
    type,
    count: typeCounts.get(type) ?? 0,
    label: (typeCounts.get(type) ?? 0) === 1 ? WEEK_CARD_TYPES[type].label.toLowerCase() : plural,
    color: WEEK_CARD_TYPES[type].color,
  })).filter((s) => s.count > 0);

  const hasTeam = peopleOff > 0 || birthdays > 0;

  // Nothing to summarize — the parent renders its own "all clear" state.
  if (workStats.length === 0 && !hasTeam) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-card border px-5 py-3.5 shadow-subtle"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      {workStats.map((s) => (
        <Stat key={s.type} count={s.count} label={s.label} dotColor={s.color} />
      ))}

      {workStats.length > 0 && hasTeam && (
        <div
          className="h-5 w-px self-center"
          style={{ background: "var(--border)" }}
          aria-hidden
        />
      )}

      {peopleOff > 0 && (
        <div className="flex items-center gap-2">
          <Plane size={14} style={{ color: "var(--text-muted)" }} aria-hidden />
          <span
            className="typo-card-title tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {peopleOff}
          </span>
          <span className="typo-caption" style={{ color: "var(--text-muted)" }}>
            {peopleOff === 1 ? "person off" : "people off"}
          </span>
        </div>
      )}

      {birthdays > 0 && (
        <div className="flex items-center gap-2">
          <Cake size={14} style={{ color: "var(--birthday)" }} aria-hidden />
          <span
            className="typo-card-title tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {birthdays}
          </span>
          <span className="typo-caption" style={{ color: "var(--text-muted)" }}>
            {birthdays === 1 ? "birthday" : "birthdays"}
          </span>
        </div>
      )}
    </div>
  );
}
