"use client";

import { useState, useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import WeekHeader from "./WeekHeader";
import ActiveProjectsSection from "./ActiveProjectsSection";
import WeekOverviewStrip from "./WeekOverviewStrip";
import DayDetailPanel from "./DayDetailPanel";
import type { DayColumn, WeekCalendarItem } from "@/lib/utils";
import type { Client, Project, WeekTeamData } from "@/types";

interface Props {
  weekOffset: number;
  weekLabel: string;
  days: DayColumn[];
  items: WeekCalendarItem[];
  ganttClients: Client[];
  ganttProjectsByClient: Record<string, Project[]>;
  teamData: WeekTeamData;
}

export default function ThisWeekDashboard({
  weekOffset,
  weekLabel,
  days,
  items,
  ganttClients,
  ganttProjectsByClient,
  teamData,
}: Props) {
  // Default selected date: today if it's in this week, otherwise Monday
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = days.find((d) => d.isToday);
    return today ? today.date : days[0]?.date ?? "";
  });

  // Find the selected day column
  const selectedDay = useMemo(
    () => days.find((d) => d.date === selectedDate) ?? days[0],
    [days, selectedDate]
  );

  const allClear = items.length === 0 && teamData.timeOff.length === 0 && teamData.birthdays.length === 0 && teamData.companyHolidays.length === 0;

  return (
    <div
      className="flex-1 overflow-y-auto p-8 space-y-6"
      style={{ background: "var(--bg-surface)" }}
    >
      <WeekHeader weekOffset={weekOffset} weekLabel={weekLabel} />

      {allClear ? (
        /* All-clear celebration state */
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <CheckCircle2 size={48} style={{ color: "var(--primary)" }} />
          <h2
            className="typo-modal-title"
            style={{ color: "var(--text-primary)" }}
          >
            All clear this week
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No deadlines, deliveries, events, or follow-ups scheduled
          </p>
        </div>
      ) : (
        <>
          {/* Week overview strip */}
          <WeekOverviewStrip
            days={days}
            items={items}
            teamData={teamData}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          {/* Day detail panel — always visible */}
          {selectedDay && (
            <DayDetailPanel
              day={selectedDay}
              items={items}
              teamData={teamData}
            />
          )}
        </>
      )}

      {/* Project timeline — at the bottom, always visible */}
      <ActiveProjectsSection
        clients={ganttClients}
        projectsByClient={ganttProjectsByClient}
      />
    </div>
  );
}
