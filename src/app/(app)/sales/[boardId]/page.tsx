import { notFound, redirect } from "next/navigation";
import { getSession } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { getProspectClients, getSalesBoardById, getSalesCards } from "@/lib/data";
import SalesBoardView from "@/components/sales/SalesBoardView";

export const dynamic = "force-dynamic";

export default async function SalesBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const session = await getSession();
  if (!session || !hasPermission(session, "sales.access")) redirect("/my-day");

  const { boardId } = await params;
  const board = await getSalesBoardById(boardId);
  if (!board) notFound();

  const [cards, prospects] = await Promise.all([
    getSalesCards(boardId, true),
    getProspectClients(),
  ]);

  return (
    <SalesBoardView
      board={board}
      cards={cards}
      prospects={prospects}
      canManageBoards={hasPermission(session, "sales.boards.manage")}
      canManageCards={hasPermission(session, "sales.cards.manage")}
      canConvert={hasPermission(session, "sales.convert")}
      canCreateClient={hasPermission(session, "clients.create")}
      canEditClient={hasPermission(session, "clients.edit")}
      canDeleteClient={hasPermission(session, "clients.delete")}
    />
  );
}
