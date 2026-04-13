"use client";

import UserInfoCard from "./UserInfoCard";
import MyDayTasksSection from "./MyDayTasksSection";
import MyDayFollowUpsSection from "./MyDayFollowUpsSection";
import ClientsTimeline from "@/components/ui/ClientsTimeline";
import type { Task, Log, Client, Project, MyDayUserInfo, MyDayTaskData } from "@/types";

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
  followUpLogs: (Log & { clientName: string })[];
  // Gantt timeline
  ganttClients: Client[];
  ganttProjectsByClient: Record<string, Project[]>;
  // User info
  userInfo: MyDayUserInfo;
  // Auth context
  currentUserId: string;
  currentUserName: string;
  firstName: string;
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {count > 0 && (
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

export default function MyDayDashboardV2({
  myTasks,
  allTasks,
  followUpLogs,
  ganttClients,
  ganttProjectsByClient,
  userInfo,
  currentUserId,
  currentUserName,
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
          <section>
            <ClientsTimeline
              clients={ganttClients}
              projectsByClient={ganttProjectsByClient}
            />
          </section>

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
