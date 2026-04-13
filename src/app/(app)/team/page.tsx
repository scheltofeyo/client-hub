import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { getLeaveTypes, getTimeOffByMonth, getCompanyHolidays, getTimeOffBalances } from "@/lib/data";
import PageHeader from "@/components/layout/PageHeader";
import TeamTertiaryNav from "@/components/layout/TeamTertiaryNav";
import HolidayCalendar from "@/components/team/HolidayCalendar";
import BalancesTable from "@/components/team/BalancesTable";

export const dynamic = "force-dynamic";

const validTabs = ["calendar", "balances"] as const;
type Tab = (typeof validTabs)[number];

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [resolvedParams, session] = await Promise.all([
    searchParams,
    auth(),
    connectDB(),
  ]);

  if (!hasPermission(session, "team.viewCalendar")) redirect("/my-day");

  const tab = (resolvedParams?.tab ?? "calendar") as Tab;
  const activeTab: Tab = validTabs.includes(tab) ? tab : "calendar";
  const perms = session?.user?.permissions ?? [];

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [leaveTypes, timeOffData, companyHolidays] = await Promise.all([
    getLeaveTypes(),
    getTimeOffByMonth(year, month),
    getCompanyHolidays(year),
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Team" }]}
        title="Team"
        tertiaryNav={
          <Suspense fallback={null}>
            <TeamTertiaryNav permissions={perms} />
          </Suspense>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {activeTab === "calendar" && (
          <HolidayCalendar
            initialEntries={timeOffData.entries}
            initialUsers={timeOffData.users}
            leaveTypes={leaveTypes}
            companyHolidays={companyHolidays}
            initialYear={year}
            initialMonth={month}
            currentUserId={session?.user?.id ?? ""}
            permissions={perms}
          />
        )}
        {activeTab === "balances" && hasPermission(session, "team.viewBalances") && (
          <BalancesTableSection year={year} leaveTypes={leaveTypes} />
        )}
      </div>
    </div>
  );
}

async function BalancesTableSection({
  year,
  leaveTypes,
}: {
  year: number;
  leaveTypes: { id: string; slug: string; label: string; color: string; icon: string; rank: number; countsAgainstAllowance: boolean }[];
}) {
  const balances = await getTimeOffBalances(year);
  return (
    <div className="px-7 pb-7 pt-6">
      <BalancesTable balances={balances} leaveTypes={leaveTypes} year={year} />
    </div>
  );
}
