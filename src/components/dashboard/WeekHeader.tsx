"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  weekOffset: number;
  weekLabel: string;
}

export default function WeekHeader({ weekOffset, weekLabel }: Props) {
  const router = useRouter();

  function navigate(offset: number) {
    const params = new URLSearchParams();
    if (offset !== 0) params.set("week", String(offset));
    router.push(`/dashboard${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="typo-page-title" style={{ color: "var(--text-primary)" }}>
          This week
        </h1>
        <p className="typo-caption mt-0.5" style={{ color: "var(--text-muted)" }}>
          {weekLabel}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {weekOffset !== 0 && (
          <button
            type="button"
            className="btn-border border text-xs px-3 py-1.5 rounded-button"
            onClick={() => navigate(0)}
          >
            Today
          </button>
        )}
        <div
          className="flex items-center rounded-button border overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          <button
            type="button"
            className="btn-icon p-1.5"
            onClick={() => navigate(weekOffset - 1)}
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="w-px self-stretch" style={{ background: "var(--border)" }} />
          <button
            type="button"
            className="btn-icon p-1.5"
            onClick={() => navigate(weekOffset + 1)}
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
