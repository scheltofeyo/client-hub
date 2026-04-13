"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Task } from "@/types";

function ConfirmModal({
  openTaskCount,
  onConfirm,
  onCancel,
  completing,
}: {
  openTaskCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  completing: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6 shadow-xl flex flex-col gap-4"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="typo-card-title" style={{ color: "var(--text-primary)" }}>
              {openTaskCount} open task{openTaskCount === 1 ? "" : "s"} remaining
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Complete {openTaskCount === 1 ? "it" : "them all"} and mark this project as done?
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={completing}
            className="px-3 py-1.5 rounded-lg text-sm font-medium btn-ghost disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={completing}
            className="px-3 py-1.5 rounded-lg text-sm font-medium btn-primary disabled:opacity-50"
          >
            {completing ? "Completing…" : "Complete & close"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CompleteProjectButton({
  projectId,
  clientId,
  isCompleted,
}: {
  projectId: string;
  clientId: string;
  isCompleted: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<Task[] | null>(null);
  const [completing, setCompleting] = useState(false);
  const [reopenHovered, setReopenHovered] = useState(false);
  const router = useRouter();

  async function handleReopen() {
    setLoading(true);
    await fetch(`/api/clients/${clientId}/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });
    setLoading(false);
    router.refresh();
  }

  if (isCompleted) {
    return (
      <button
        onClick={handleReopen}
        disabled={loading}
        onMouseEnter={() => setReopenHovered(true)}
        onMouseLeave={() => setReopenHovered(false)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border disabled:opacity-50 transition-colors"
        style={{
          borderColor: reopenHovered ? "#fca5a5" : "var(--border)",
          background: reopenHovered ? "#fef2f2" : "#dcfce7",
          color: reopenHovered ? "#b91c1c" : "#166534",
        }}
      >
        {reopenHovered ? <RotateCcw size={13} /> : <CheckCircle size={13} />}
        {loading ? "Reopening…" : reopenHovered ? "Mark as in progress" : "Completed"}
      </button>
    );
  }

  async function handleClick() {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/projects/${projectId}/tasks`);
    const tasks: Task[] = await res.json();
    const openTasks = tasks.filter((t) => !t.completedAt);
    setLoading(false);

    if (openTasks.length > 0) {
      setPendingTasks(openTasks);
      return;
    }

    await completeProject([]);
  }

  async function completeProject(openTasks: Task[]) {
    setCompleting(true);

    if (openTasks.length > 0) {
      await Promise.all(
        openTasks.map((task) =>
          fetch(`/api/clients/${clientId}/projects/${projectId}/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: true }),
          })
        )
      );
    }

    await fetch(`/api/clients/${clientId}/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });

    setCompleting(false);
    setPendingTasks(null);
    router.refresh();
  }

  return (
    <>
      {pendingTasks && (
        <ConfirmModal
          openTaskCount={pendingTasks.length}
          completing={completing}
          onConfirm={() => completeProject(pendingTasks)}
          onCancel={() => setPendingTasks(null)}
        />
      )}
      <button
        onClick={handleClick}
        disabled={loading || completing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border btn-secondary disabled:opacity-50"
      >
        <CheckCircle size={13} />
        {loading ? "Checking…" : "Mark as Completed"}
      </button>
    </>
  );
}
