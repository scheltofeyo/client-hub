"use client";

import type { ReactNode } from "react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
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
  const greeting = getGreeting();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
      <div>
        <h1 className="typo-page-title" style={{ color: "var(--text-primary)" }} suppressHydrationWarning>
          {greeting}, {firstName}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }} suppressHydrationWarning>{today}</p>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 flex flex-col gap-8 min-w-0">
          <section>{ganttSlot}</section>
          <section>{eventsSlot}</section>
          <section>{tasksSlot}</section>
        </div>

        <div className="w-1/3 flex-none">{userInfoSlot}</div>
      </div>
    </div>
  );
}
