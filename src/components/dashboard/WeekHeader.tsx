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
    <div className="flex items-center justify-between">
      <div>
        <h1
          className="text-xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          This Week
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          {weekLabel}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {weekOffset !== 0 && (
          <button
            type="button"
            className="btn-ghost text-xs px-2.5 py-1.5 rounded-lg mr-1"
            onClick={() => navigate(0)}
          >
            Today
          </button>
        )}
        <button
          type="button"
          className="btn-icon p-1.5 rounded-lg"
          onClick={() => navigate(weekOffset - 1)}
          aria-label="Previous week"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="btn-icon p-1.5 rounded-lg"
          onClick={() => navigate(weekOffset + 1)}
          aria-label="Next week"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
