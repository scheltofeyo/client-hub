import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getMyDayTasks,
  getMyLeadClientTasks,
  getMyLeadClientUpcomingEvents,
  getMyActiveProjectsForGantt,
  getMyDayUserInfo,
  getEventTypes,
} from "@/lib/data";
import MyDayDashboardV2 from "@/components/my-day/MyDayDashboardV2";
import ClientsTimeline from "@/components/ui/ClientsTimeline";
import MyDayTasksSection from "@/components/my-day/MyDayTasksSection";
import MyDayUpcomingEventsSection from "@/components/my-day/MyDayUpcomingEventsSection";
import UserInfoCard from "@/components/my-day/UserInfoCard";

export const dynamic = "force-dynamic";

async function GanttSection({ userId }: { userId: string }) {
  const ganttData = await getMyActiveProjectsForGantt(userId);
  const hasProjects = Object.values(ganttData.projectsByClient).some((ps) => ps.length > 0);
  if (!hasProjects) return null;
  return (
    <div className="space-y-3">
      <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>
        Active projects
      </h2>
      {/* The gantt's own root is a rounded, bordered surface — give it a light
          elevation so it lifts off the page (no extra panel). */}
      <div className="rounded-xl shadow-subtle">
        <ClientsTimeline
          clients={ganttData.clients}
          projectsByClient={ganttData.projectsByClient}
          showHeader={false}
          collapsible={false}
          defaultSectionsCollapsed
        />
      </div>
    </div>
  );
}

async function TasksSection({ userId, todayISO }: { userId: string; todayISO: string }) {
  const [myTasks, allTasks] = await Promise.all([
    getMyDayTasks(userId),
    getMyLeadClientTasks(userId),
  ]);
  return (
    <MyDayTasksSection
      myTasks={myTasks}
      allTasks={allTasks}
      currentUserId={userId}
      today={todayISO}
    />
  );
}

async function UpcomingEventsSection({ userId, todayISO }: { userId: string; todayISO: string }) {
  const [upcomingEvents, eventTypes] = await Promise.all([
    getMyLeadClientUpcomingEvents(userId, todayISO),
    getEventTypes(),
  ]);
  return (
    <MyDayUpcomingEventsSection
      events={upcomingEvents}
      eventTypes={eventTypes}
      todayISO={todayISO}
    />
  );
}

async function UserInfoSection({ userId }: { userId: string }) {
  const userInfo = await getMyDayUserInfo(userId);
  return <UserInfoCard info={userInfo} />;
}

function GanttSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-32 rounded" style={{ background: "var(--border)" }} />
      <div
        className="rounded-xl border p-4 shadow-subtle"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
      >
        {[70, 45, 60, 35].map((w, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div className="h-[18px] w-[18px] flex-none rounded" style={{ background: "var(--border)" }} />
            <div className="h-3 flex-none rounded-full" style={{ background: "var(--border)", width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div
      className="rounded-card border p-5 shadow-subtle animate-pulse sm:p-6"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="h-4 w-4 rounded" style={{ background: "var(--border)" }} />
        <div className="h-4 w-16 rounded" style={{ background: "var(--border)" }} />
        <div className="ml-auto h-7 w-36 rounded-button" style={{ background: "var(--border)" }} />
      </div>
      <div className="mb-5 flex gap-4 border-b pb-2.5" style={{ borderColor: "var(--border)" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 w-5 rounded" style={{ background: "var(--border)" }} />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="h-4 w-4 flex-none rounded border" style={{ borderColor: "var(--border)" }} />
          <div className="h-3.5 flex-none rounded" style={{ background: "var(--border)", width: "60%" }} />
        </div>
      ))}
    </div>
  );
}

function UpcomingEventsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-36 rounded" style={{ background: "var(--border)" }} />
      <div className="flex flex-col gap-5 sm:flex-row">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="min-w-0 flex-1 space-y-2.5">
            <div className="h-3 w-16 rounded" style={{ background: "var(--border)" }} />
            <div
              className="flex overflow-hidden rounded-card border shadow-subtle"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
            >
              <div className="h-[58px] w-14 flex-none" style={{ background: "var(--border)", opacity: 0.5 }} />
              <div className="flex-1 space-y-1.5 px-3 py-3">
                <div className="h-3 w-2/5 rounded" style={{ background: "var(--border)" }} />
                <div className="h-3.5 w-4/5 rounded" style={{ background: "var(--border)" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserInfoSkeleton() {
  return (
    <div
      className="w-full rounded-card border flex flex-col sticky top-6 overflow-hidden shadow-subtle animate-pulse"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="relative px-5 pt-5 shrink-0" style={{ background: "var(--border)", height: "52px", opacity: 0.3 }}>
        <div className="relative" style={{ marginBottom: "-24px", zIndex: 10 }}>
          <div className="w-12 h-12 rounded-full" style={{ background: "var(--border)" }} />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-5 pt-9 pb-5">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-32 rounded" style={{ background: "var(--border)" }} />
          <div className="h-3.5 w-40 rounded" style={{ background: "var(--border)" }} />
        </div>
        <hr style={{ borderColor: "var(--border)" }} />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded" style={{ background: "var(--border)" }} />
                <div className="h-3 rounded" style={{ background: "var(--border)", width: `${80 + i * 12}px` }} />
              </div>
              <div className="h-3.5 w-6 rounded" style={{ background: "var(--border)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function MyDayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const userId = session.user.id;
  const fullName = session.user.name ?? "";
  const firstName = fullName.split(" ")[0] || fullName;
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <MyDayDashboardV2
      firstName={firstName}
      ganttSlot={
        <Suspense fallback={<GanttSkeleton />}>
          <GanttSection userId={userId} />
        </Suspense>
      }
      eventsSlot={
        <Suspense fallback={<UpcomingEventsSkeleton />}>
          <UpcomingEventsSection userId={userId} todayISO={todayISO} />
        </Suspense>
      }
      tasksSlot={
        <Suspense fallback={<TasksSkeleton />}>
          <TasksSection userId={userId} todayISO={todayISO} />
        </Suspense>
      }
      userInfoSlot={
        <Suspense fallback={<UserInfoSkeleton />}>
          <UserInfoSection userId={userId} />
        </Suspense>
      }
    />
  );
}
