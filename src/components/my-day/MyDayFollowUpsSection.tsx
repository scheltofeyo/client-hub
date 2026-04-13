"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { Log } from "@/types";
import { accentColor } from "@/lib/styles";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function monogram(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

type Filter = "week" | "month";

interface Props {
  logs: (Log & { clientName: string })[];
}

export default function MyDayFollowUpsSection({ logs }: Props) {
  const [filter, setFilter] = useState<Filter>("week");

  const today = new Date().toISOString().slice(0, 10);

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekCutoff = weekEnd.toISOString().slice(0, 10);

  const monthEnd = new Date();
  monthEnd.setDate(monthEnd.getDate() + 30);
  const monthCutoff = monthEnd.toISOString().slice(0, 10);

  const cutoff = filter === "week" ? weekCutoff : monthCutoff;

  // Always include overdue (deadline < today) + upcoming within cutoff
  const filtered = logs.filter((l) => {
    if (!l.followUpDeadline) return true; // no deadline = always show
    if (l.followUpDeadline < today) return true; // overdue = always show
    return l.followUpDeadline <= cutoff;
  });

  const header = (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>Open Follow-ups</h2>
      {logs.length > 0 && (
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          {logs.length}
        </span>
      )}
      <div className="ml-auto flex gap-1">
        {(["week", "month"] as const).map((f) => {
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: isActive ? "var(--primary-light)" : "transparent",
                color: isActive ? "var(--primary)" : "var(--text-muted)",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--primary)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              {f === "week" ? "This week" : "This month"}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (filtered.length === 0) {
    return (
      <div>
        {header}
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <BookOpen size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No upcoming follow-ups.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              <th className="text-left px-4 py-2 font-medium text-xs w-[42%]" style={{ color: "var(--text-muted)" }}>Follow-up action</th>
              <th className="text-left px-4 py-2 font-medium text-xs w-[42%]" style={{ color: "var(--text-muted)" }}>Client</th>
              <th className="text-right px-4 py-2 font-medium text-xs w-[16%]" style={{ color: "var(--text-muted)" }}>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => {
              const overdue = log.followUpDeadline ? log.followUpDeadline < today : false;
              const color = accentColor(log.clientName);
              return (
                <tr key={log.id} className="border-b last:border-b-0 hover-row" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/clients/${log.clientId}?tab=Logbook`}
                      className="text-sm hover:underline truncate block"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {log.followUpAction || log.summary}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/clients/${log.clientId}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <div
                        className="w-5 h-5 rounded flex-none flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ background: color }}
                      >
                        {monogram(log.clientName)}
                      </div>
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {log.clientName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {log.followUpDeadline && (
                      <span
                        className="text-xs font-medium"
                        style={{ color: overdue ? "var(--danger)" : "var(--text-muted)" }}
                      >
                        {fmtDate(log.followUpDeadline)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

