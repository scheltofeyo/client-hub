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
  getRecentKudosForUser,
} from "@/lib/data";
import { hasPermission } from "@/lib/auth-helpers";
import MyDayDashboardV2 from "@/components/my-day/MyDayDashboardV2";
import ClientsTimeline from "@/components/ui/ClientsTimeline";
import MyDayTasksSection from "@/components/my-day/MyDayTasksSection";
import MyDayUpcomingEventsSection from "@/components/my-day/MyDayUpcomingEventsSection";
import UserInfoCard from "@/components/my-day/UserInfoCard";
import MyDayKudosSection from "@/components/my-day/MyDayKudosSection";

export const dynamic = "force-dynamic";

async function GanttSection({ userId }: { userId: string }) {
  const ganttData = await getMyActiveProjectsForGantt(userId);
  return (
    <ClientsTimeline
      clients={ganttData.clients}
      projectsByClient={ganttData.projectsByClient}
      showHeader={false}
    />
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

async function KudosSection({ userId }: { userId: string }) {
  const kudos = await getRecentKudosForUser(userId, 3);
  return <MyDayKudosSection kudos={kudos} />;
}

function KudosSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-32 rounded" style={{ background: "var(--border)" }} />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="w-7 h-7 rounded-full flex-none" style={{ background: "var(--border)" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-1/2 rounded" style={{ background: "var(--border)" }} />
            <div className="h-3 w-3/4 rounded" style={{ background: "var(--border)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function GanttSkeleton() {
  return (
    <div className="animate-pulse">
      {[70, 45, 60, 35].map((w, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <div className="w-[18px] h-[18px] rounded flex-none" style={{ background: "var(--border)" }} />
          <div className="h-3 rounded-full flex-none" style={{ background: "var(--border)", width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-16 rounded" style={{ background: "var(--border)" }} />
        <div className="h-5 w-6 rounded-full" style={{ background: "var(--border)" }} />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="w-4 h-4 rounded border flex-none" style={{ borderColor: "var(--border)" }} />
          <div className="h-3.5 rounded flex-none" style={{ background: "var(--border)", width: "60%" }} />
        </div>
      ))}
    </div>
  );
}

function UpcomingEventsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-24 rounded" style={{ background: "var(--border)" }} />
        <div className="h-5 w-6 rounded-full" style={{ background: "var(--border)" }} />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="w-7 h-7 rounded-full flex-none" style={{ background: "var(--border)" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/5 rounded" style={{ background: "var(--border)" }} />
            <div className="h-3 w-2/5 rounded" style={{ background: "var(--border)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function UserInfoSkeleton() {
  return (
    <div
      className="w-full rounded-xl border flex flex-col sticky top-6 overflow-hidden animate-pulse"
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
  const canSeeKudos = hasPermission(session, "tools.kudos.access");

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
      kudosSlot={
        canSeeKudos ? (
          <Suspense fallback={<KudosSkeleton />}>
            <KudosSection userId={userId} />
          </Suspense>
        ) : undefined
      }
    />
  );
}
