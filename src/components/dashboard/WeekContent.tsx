"use client";

import { useState, useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import WeekOverviewStrip from "./WeekOverviewStrip";
import DayDetailPanel from "./DayDetailPanel";
import type { DayColumn, WeekCalendarItem } from "@/lib/utils";
import type { WeekTeamData } from "@/types";

interface Props {
  days: DayColumn[];
  items: WeekCalendarItem[];
  teamData: WeekTeamData;
}

export default function WeekContent({ days, items, teamData }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = days.find((d) => d.isToday);
    return today ? today.date : days[0]?.date ?? "";
  });

  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) ?? days[0],
    [days, selectedDate]
  );

  const allClear =
    items.length === 0 &&
    teamData.timeOff.length === 0 &&
    teamData.birthdays.length === 0 &&
    teamData.companyHolidays.length === 0;

  if (allClear) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <CheckCircle2 size={48} style={{ color: "var(--primary)" }} />
        <h2 className="typo-modal-title" style={{ color: "var(--text-primary)" }}>
          All clear this week
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No deadlines, deliveries, events, or follow-ups scheduled
        </p>
      </div>
    );
  }

  return (
    <>
      <WeekOverviewStrip
        days={days}
        items={items}
        teamData={teamData}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      {selectedDay && (
        <DayDetailPanel day={selectedDay} items={items} teamData={teamData} />
      )}
    </>
  );
}
