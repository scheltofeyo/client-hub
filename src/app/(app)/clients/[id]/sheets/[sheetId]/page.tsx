import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getClientById, getSheetById } from "@/lib/data";
import { toEmbedUrl } from "@/lib/sheets";
import PageHeader from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function SheetDetailPage({
  params,
}: {
  params: Promise<{ id: string; sheetId: string }>;
}) {
  const { id, sheetId } = await params;
  const [client, sheet] = await Promise.all([getClientById(id), getSheetById(sheetId)]);

  if (!client || !sheet) notFound();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { label: "Clients", href: "/clients" },
          { label: client.company, href: `/clients/${id}` },
          { label: "Sheets", href: `/clients/${id}?tab=sheets` },
          { label: "..." },
        ]}
        title={sheet.name}
        actions={
          <a
            href={sheet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-secondary"
          >
            <ExternalLink size={14} />
            Open fullscreen
          </a>
        }
      />

      {/* Embedded sheet */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={toEmbedUrl(sheet.url)}
          className="w-full h-full border-0"
          title={sheet.name}
          allowFullScreen
        />
      </div>
    </div>
  );
}
