"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";

export default function SheetActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={copyLink}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border btn-secondary"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied!" : "Copy"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border btn-secondary"
      >
        <ExternalLink size={14} />
        Open
      </a>
    </div>
  );
}
