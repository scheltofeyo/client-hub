"use client";

import Link from "next/link";
import { FolderKanban, Calendar } from "lucide-react";
import type { MyProjectOverview } from "@/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusLabel(status: string) {
  switch (status) {
    case "in_progress": return "In progress";
    case "not_started": return "Not started";
    case "completed": return "Completed";
    default: return status;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "in_progress": return "var(--primary)";
    case "not_started": return "var(--text-muted)";
    case "completed": return "#059669";
    default: return "var(--text-muted)";
  }
}

export default function MyDayProjectsSection({ projects }: { projects: MyProjectOverview[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <FolderKanban size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No active projects.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {projects.map((p) => {
        const pct = p.taskTotal > 0 ? Math.round((p.taskCompleted / p.taskTotal) * 100) : 0;
        return (
          <Link
            key={p.projectId}
            href={`/clients/${p.clientId}/projects/${p.projectId}/tasks`}
            className="rounded-xl border p-4 flex flex-col gap-3 transition-colors hover:border-[var(--primary)]"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            {/* Title + client */}
            <div className="flex flex-col gap-0.5">
              <span className="typo-card-title leading-tight" style={{ color: "var(--text-primary)" }}>
                {p.projectTitle}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {p.clientName}
              </span>
            </div>

            {/* Progress bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: statusColor(p.status) }}>
                  {statusLabel(p.status)}
                </span>
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {p.taskCompleted}/{p.taskTotal} tasks
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: statusColor(p.status),
                  }}
                />
              </div>
            </div>

            {/* Delivery / next deadline */}
            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
              {p.deliveryDate && (
                <div className="flex items-center gap-1">
                  <Calendar size={11} className="flex-none" />
                  <span>Delivery {fmtDate(p.deliveryDate)}</span>
                </div>
              )}
              {p.nextDeadline && (
                <div className="flex items-center gap-1">
                  <Calendar size={11} className="flex-none" />
                  <span>Next deadline {fmtDate(p.nextDeadline)}</span>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
