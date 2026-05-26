"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export default function DownloadPdfButton({ shareCode }: { shareCode: string }) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/public/plans/${shareCode}/pdf`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "PDF export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/i.exec(disposition);
      const filename = match?.[1] ?? "proposal.pdf";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={downloading}
      className="pdf-download-btn"
      aria-label="Download as PDF"
    >
      {downloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
      <span>{downloading ? "Preparing…" : "Download as PDF"}</span>
    </button>
  );
}
