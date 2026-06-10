"use client";

import type { ReactNode } from "react";
import { Sunrise, Sun, Moon } from "lucide-react";

function getTimeOfDay(): { greeting: string; Icon: typeof Sun } {
  const h = new Date().getHours();
  if (h < 12) return { greeting: "Good morning", Icon: Sunrise };
  if (h < 18) return { greeting: "Good afternoon", Icon: Sun };
  return { greeting: "Good evening", Icon: Moon };
}

interface Props {
  firstName: string;
  ganttSlot: ReactNode;
  eventsSlot: ReactNode;
  tasksSlot: ReactNode;
  userInfoSlot: ReactNode;
}

export default function MyDayDashboardV2({
  firstName,
  ganttSlot,
  eventsSlot,
  tasksSlot,
  userInfoSlot,
}: Props) {
  const { greeting, Icon } = getTimeOfDay();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg-tinted)" }}>
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8 sm:px-8">
        {/* Greeting — the personal moment */}
        <div className="mb-8" suppressHydrationWarning>
          <h1
            className="typo-page-title inline-flex items-center gap-2.5"
            style={{ color: "var(--text-primary)" }}
            suppressHydrationWarning
          >
            <Icon size={22} style={{ color: "var(--primary)" }} aria-hidden />
            {greeting}, {firstName}
          </h1>
          <p className="typo-caption mt-1" style={{ color: "var(--text-muted)" }} suppressHydrationWarning>
            {today}
          </p>
        </div>

        {/* Action-first: tasks, then near-term events, then the gantt as context */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-10">
            <section>{tasksSlot}</section>
            <section>{eventsSlot}</section>
            <section>{ganttSlot}</section>
          </div>

          <div className="w-full flex-none lg:w-1/3 lg:max-w-sm">{userInfoSlot}</div>
        </div>
      </div>
    </div>
  );
}
