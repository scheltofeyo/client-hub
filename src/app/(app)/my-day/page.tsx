import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getMyDayTasks,
  getMyLeadClientTasks,
  getMyOpenFollowUps,
  getMyActiveProjectsForGantt,
  getMyDayUserInfo,
} from "@/lib/data";
import MyDayDashboardV2 from "@/components/my-day/MyDayDashboardV2";
import ClientsTimeline from "@/components/ui/ClientsTimeline";

export const dynamic = "force-dynamic";

async function GanttSection({ userId }: { userId: string }) {
  const ganttData = await getMyActiveProjectsForGantt(userId);
  return (
    <ClientsTimeline
      clients={ganttData.clients}
      projectsByClient={ganttData.projectsByClient}
    />
  );
}

function GanttSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-20 rounded mb-3" style={{ background: "var(--border)" }} />
      {[70, 45, 60, 35].map((w, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <div className="w-[18px] h-[18px] rounded flex-none" style={{ background: "var(--border)" }} />
          <div className="h-3 rounded-full flex-none" style={{ background: "var(--border)", width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

export default async function MyDayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const userId = session.user.id;
  const fullName = session.user.name ?? "";
  const firstName = fullName.split(" ")[0] || fullName;

  const [myTasks, allTasks, followUps, userInfo] = await Promise.all([
    getMyDayTasks(userId),
    getMyLeadClientTasks(userId),
    getMyOpenFollowUps(userId),
    getMyDayUserInfo(userId),
  ]);

  return (
    <MyDayDashboardV2
      myTasks={myTasks}
      allTasks={allTasks}
      followUpLogs={followUps}
      userInfo={userInfo}
      currentUserId={userId}
      currentUserName={fullName}
      firstName={firstName}
      todayISO={new Date().toISOString().slice(0, 10)}
      ganttSlot={
        <Suspense fallback={<GanttSkeleton />}>
          <GanttSection userId={userId} />
        </Suspense>
      }
    />
  );
}
