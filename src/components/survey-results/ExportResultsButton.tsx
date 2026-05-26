"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clipboard, Download, FileText, Loader2 } from "lucide-react";

interface ExportResultsButtonProps {
  sessionId: string;
}

/**
 * Compact dropdown button that fetches /api/surveys/sessions/[id]/export and
 * either triggers a browser download or copies the markdown to clipboard.
 *
 * Visually matches the existing "Show all / Collapse all" pill in ResultsTab.
 */
export function ExportResultsButton({ sessionId }: ExportResultsButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"download" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function fetchMarkdown(): Promise<{ blob: Blob; text: string; filename: string }> {
    const res = await fetch(`/api/surveys/sessions/${sessionId}/export`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Export failed");
    }
    const text = await res.text();
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    const filename = match?.[1] ?? "survey-results.md";
    return { blob, text, filename };
  }

  async function downloadFile() {
    if (busy) return;
    setBusy("download");
    setOpen(false);
    try {
      const { blob, filename } = await fetchMarkdown();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function copyToClipboard() {
    if (busy) return;
    setBusy("copy");
    setOpen(false);
    try {
      const { text } = await fetchMarkdown();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  const Icon = copied ? Check : busy ? Loader2 : FileText;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-button px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface disabled:opacity-60"
        style={{ color: "var(--text-muted)" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon size={13} className={busy ? "animate-spin" : undefined} />
        {copied ? "Gekopieerd" : busy ? "Bezig…" : "Exporteer"}
        <ChevronDown size={12} className="opacity-70" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 rounded-card border bg-surface shadow-dropdown py-1"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={downloadFile}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-hover"
            style={{ color: "var(--text-primary)" }}
          >
            <Download size={14} className="opacity-70" />
            Download als .md
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={copyToClipboard}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-hover"
            style={{ color: "var(--text-primary)" }}
          >
            <Clipboard size={14} className="opacity-70" />
            Kopieer naar klembord
          </button>
        </div>
      )}
    </div>
  );
}
