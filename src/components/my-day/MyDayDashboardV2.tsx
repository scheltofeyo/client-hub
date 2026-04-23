"use client";

import UserInfoCard from "./UserInfoCard";
import MyDayTasksSection from "./MyDayTasksSection";
import MyDayFollowUpsSection from "./MyDayFollowUpsSection";
import type { Log, MyDayUserInfo, MyDayTaskData } from "@/types";
import type { ReactNode } from "react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

interface Props {
  // Tasks
  myTasks: MyDayTaskData;
  allTasks: MyDayTaskData;
  // Follow-ups
  followUpLogs: (Log & { clientName: string; clientPrimaryColor?: string })[];
  // Gantt timeline — streamed separately via Suspense
  ganttSlot: ReactNode;
  // User info
  userInfo: MyDayUserInfo;
  // Auth context
  currentUserId: string;
  currentUserName: string;
  firstName: string;
}

export default function MyDayDashboardV2({
  myTasks,
  allTasks,
  followUpLogs,
  ganttSlot,
  userInfo,
  currentUserId,
  firstName,
  todayISO,
}: Props & { todayISO?: string }) {
  const greeting = getGreeting();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <h1 className="typo-page-title" style={{ color: "var(--text-primary)" }} suppressHydrationWarning>
          {greeting}, {firstName}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }} suppressHydrationWarning>{today}</p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* LEFT: Content sections (2/3) */}
        <div className="flex-1 flex flex-col gap-8 min-w-0">
          {/* Timeline section */}
          <section>{ganttSlot}</section>

          {/* Follow-ups section */}
          <section>
            <MyDayFollowUpsSection logs={followUpLogs} />
          </section>

          {/* Tasks section */}
          <section>
            <MyDayTasksSection
              myTasks={myTasks}
              allTasks={allTasks}
              currentUserId={currentUserId}
              today={todayISO}
            />
          </section>
        </div>

        {/* RIGHT: User info card (1/3) */}
        <div className="w-1/3 flex-none">
          <UserInfoCard info={userInfo} />
        </div>
      </div>
    </div>
  );
}
