import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getClientById, getSheetById } from "@/lib/data";
import { toEmbedUrl } from "@/lib/sheets";

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
      {/* Header */}
      <div
        className="px-7 pt-6 pb-5 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <nav className="flex items-center gap-1.5 mb-2">
          <Link href="/clients" className="text-xs breadcrumb-link">
            Clients
          </Link>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>
          <Link href={`/clients/${id}`} className="text-xs breadcrumb-link">
            {client.company}
          </Link>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>
          <Link href={`/clients/${id}?tab=sheets`} className="text-xs breadcrumb-link">
            Sheets
          </Link>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>...</span>
        </nav>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {sheet.name}
          </h1>
          <a
            href={sheet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm btn-secondary"
          >
            <ExternalLink size={14} />
            Open fullscreen
          </a>
        </div>
      </div>

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
