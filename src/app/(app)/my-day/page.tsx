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

export const dynamic = "force-dynamic";

export default async function MyDayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const userId = session.user.id;
  const fullName = session.user.name ?? "";
  const firstName = fullName.split(" ")[0] || fullName;

  const [myTasks, allTasks, followUps, ganttData, userInfo] = await Promise.all([
    getMyDayTasks(userId),
    getMyLeadClientTasks(userId),
    getMyOpenFollowUps(userId),
    getMyActiveProjectsForGantt(userId),
    getMyDayUserInfo(userId),
  ]);

  return (
    <MyDayDashboardV2
      myTasks={myTasks}
      allTasks={allTasks}
      followUpLogs={followUps}
      ganttClients={ganttData.clients}
      ganttProjectsByClient={ganttData.projectsByClient}
      userInfo={userInfo}
      currentUserId={userId}
      currentUserName={fullName}
      firstName={firstName}
      todayISO={new Date().toISOString().slice(0, 10)}
    />
  );
}
