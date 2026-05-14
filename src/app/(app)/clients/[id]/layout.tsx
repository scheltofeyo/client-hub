import { getClientById, getProjectSummariesByClientId, getSheetSummariesByClientId } from "@/lib/data";
import { notFound } from "next/navigation";
import ClientPanelNav from "@/components/layout/ClientPanelNav";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, projectSummaries, sheetSummaries] = await Promise.all([
    getClientById(id),
    getProjectSummariesByClientId(id),
    getSheetSummariesByClientId(id),
  ]);
  if (!client) notFound();

  return (
    <div className="flex h-full overflow-hidden">
      <Suspense fallback={null}>
        <ClientPanelNav client={client} projects={projectSummaries} sheets={sheetSummaries} />
      </Suspense>
      <div
        className="flex-1 overflow-hidden flex flex-col"
        style={{ background: "var(--bg-tinted)" }}
      >
        {children}
      </div>
    </div>
  );
}
