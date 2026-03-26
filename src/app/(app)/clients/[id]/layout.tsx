import { getClientById, getProjectsByClientId } from "@/lib/data";
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
  const [client, projects] = await Promise.all([
    getClientById(id),
    getProjectsByClientId(id),
  ]);
  if (!client) notFound();

  const projectSummaries = projects.map((p) => ({ id: p.id, title: p.title }));

  return (
    <div className="flex h-full overflow-hidden">
      <Suspense fallback={null}>
        <ClientPanelNav client={client} projects={projectSummaries} />
      </Suspense>
      <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
