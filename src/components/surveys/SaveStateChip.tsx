"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface SaveStateChipProps {
  state: SaveState;
  /** Timestamp (epoch ms) when the last save completed. Used to render "Saved 2s ago". */
  savedAt?: number | null;
  /** Called when user clicks "Retry" in the error state. */
  onRetry?: () => void;
}

function relativeShort(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export default function SaveStateChip({ state, savedAt, onRetry }: SaveStateChipProps) {
  // Re-render every 5s when state=saved so the relative time stays current.
  const [, force] = useState(0);
  useEffect(() => {
    if (state !== "saved" || !savedAt) return;
    const t = window.setInterval(() => force((x) => x + 1), 5000);
    return () => window.clearInterval(t);
  }, [state, savedAt]);

  if (state === "idle") return null;

  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        Saving…
      </span>
    );
  }

  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--success)" }}>
        <Check size={12} aria-hidden="true" />
        Saved {savedAt ? relativeShort(savedAt) : "just now"}
      </span>
    );
  }

  // error
  return (
    <span className="inline-flex items-center gap-2 text-xs" style={{ color: "var(--danger)" }}>
      <AlertCircle size={12} aria-hidden="true" />
      Couldn&apos;t save
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="underline font-medium"
          style={{ color: "var(--danger)" }}
        >
          Retry
        </button>
      )}
    </span>
  );
}
