"use client";

import { useState, useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import WeekOverviewStrip from "./WeekOverviewStrip";
import WeekSummary from "./WeekSummary";
import DayDetailPanel from "./DayDetailPanel";
import type { DayColumn, WeekCalendarItem } from "@/lib/utils";
import type { WeekTeamData } from "@/types";

interface Props {
  days: DayColumn[];
  items: WeekCalendarItem[];
  teamData: WeekTeamData;
}

export default function WeekContent({ days, items, teamData }: Props) {
  const reduceMotion = useReducedMotion();
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
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-card border py-24 shadow-subtle"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--primary-light)" }}
        >
          <CheckCircle2 size={28} style={{ color: "var(--primary)" }} />
        </div>
        <h2 className="typo-modal-title" style={{ color: "var(--text-primary)" }}>
          All clear this week
        </h2>
        <p className="typo-body" style={{ color: "var(--text-muted)" }}>
          No deadlines, deliveries, events, or follow-ups scheduled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WeekSummary items={items} teamData={teamData} />
      <WeekOverviewStrip
        days={days}
        items={items}
        teamData={teamData}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      {selectedDay && (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDay.date}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <DayDetailPanel day={selectedDay} items={items} teamData={teamData} />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
