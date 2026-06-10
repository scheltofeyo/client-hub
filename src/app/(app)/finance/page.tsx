import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { getRevenueAnalytics } from "@/lib/data";
import PageHeader from "@/components/layout/PageHeader";
import RevenueDashboard from "@/components/finance/RevenueDashboard";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const session = await auth();
  if (!session || !hasPermission(session, "finance.access")) redirect("/dashboard");

  const data = await getRevenueAnalytics();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Omzet" }]}
        title="Omzet"
      />
      <div
        className="flex-1 overflow-y-auto px-7 py-6"
        style={{ background: "var(--bg-tinted)" }}
      >
        <RevenueDashboard data={data} />
      </div>
    </div>
  );
}
