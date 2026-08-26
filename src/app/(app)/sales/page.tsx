import { redirect } from "next/navigation";
import { getSession } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { getSalesBoards } from "@/lib/data";
import PageHeader from "@/components/layout/PageHeader";
import SalesBoardsList from "@/components/sales/SalesBoardsList";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const session = await getSession();
  if (!session || !hasPermission(session, "sales.access")) redirect("/my-day");

  const boards = await getSalesBoards();
  const canManageBoards = hasPermission(session, "sales.boards.manage");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader breadcrumbs={[{ label: "Sales", href: "/sales" }, { label: "Borden" }]} title="Salesfunnel" />
      <div className="flex-1 overflow-y-auto px-7 py-6" style={{ background: "var(--bg-tinted)" }}>
        <SalesBoardsList initialBoards={boards} canManageBoards={canManageBoards} />
      </div>
    </div>
  );
}
