"use client";

import { useMemo } from "react";
import ProjectEventsColumn from "./ProjectEventsColumn";
import OtherEventsColumn from "./OtherEventsColumn";
import TeamColumn from "./TeamColumn";
import type { DayColumn, WeekCalendarItem } from "@/lib/utils";
import type { WeekTeamData } from "@/types";

interface Props {
  day: DayColumn;
  items: WeekCalendarItem[];
  teamData: WeekTeamData;
}

const PROJECT_TYPES = new Set(["delivery", "kickoff"]);

export default function DayDetailPanel({ day, items, teamData }: Props) {
  // Filter items for the selected day
  const dayItems = useMemo(
    () => items.filter((item) => item.date === day.date),
    [items, day.date]
  );

  const projectEvents = useMemo(
    () => dayItems.filter((item) => PROJECT_TYPES.has(item.type)),
    [dayItems]
  );

  const otherEvents = useMemo(
    () => dayItems.filter((item) => !PROJECT_TYPES.has(item.type)),
    [dayItems]
  );

  // Format the day name: "Wednesday, April 8"
  const [year, month, dateNum] = day.date.split("-").map(Number);
  const fullDate = new Date(year, month - 1, dateNum);
  const dayLabel = fullDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <h2
        className="typo-section-title mb-4"
        style={{ color: "var(--text-primary)" }}
      >
        {dayLabel}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ProjectEventsColumn items={projectEvents} />
        <OtherEventsColumn items={otherEvents} />
        <TeamColumn
          selectedDate={day.date}
          teamData={teamData}
          items={dayItems}
        />
      </div>
    </div>
  );
}
