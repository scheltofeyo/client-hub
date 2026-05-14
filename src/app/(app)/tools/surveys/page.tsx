"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  SessionStatusBadge,
  SessionStatusFilterChips,
  SESSION_STATUS_FILTER_ORDER,
} from "@/components/ui/SessionStatusBadge";

interface SessionSummary {
  id: string;
  clientId: string;
  clientName: string;
  templateName: string;
  title: string;
  status: string;
  shareCode: string;
  submissionCount: number;
  completedCount: number;
  createdBy: string;
  createdByName: string;
  createdByImage: string | null;
  createdAt: string;
}

export default function ArchetypeAsIsSurveyListPage() {
  const { data: authSession } = useSession();
  const currentUserId = authSession?.user?.id;
  const perms = authSession?.user?.permissions ?? [];
  const canDeleteAny = perms.includes("tools.surveys.deleteAny");

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>(["open", "draft"]);
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  useEffect(() => {
    fetch("/api/surveys/sessions")
      .then((r) => r.json())
      .then((data) => {
        setSessions(data);
        setLoading(false);
      });
  }, []);

  function toggleFilter(key: string) {
    setActiveFilters((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/surveys/sessions/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
  }

  const visible = activeFilters.length === 0 ? sessions : sessions.filter((s) => activeFilters.includes(s.status));

  const statusCounts = SESSION_STATUS_FILTER_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = sessions.filter((sess) => sess.status === s).length;
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg-tinted)" }}>
      <div
        className="sticky top-0 z-20 px-7 pt-6 pb-5 shrink-0 border-b"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <nav className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/tools" className="hover:underline">Tools</Link>
          <span>/</span>
          <span>Surveys</span>
        </nav>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Surveys</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Build, share, and analyze surveys with your clients.
            </p>
          </div>
          <Link
            href="/tools/surveys/new"
            className="btn-primary rounded-lg text-sm px-4 py-2.5 inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            New session
          </Link>
        </div>
      </div>

      <div className="px-7 pb-7 pt-6">
        {sessions.length > 0 && (
          <SessionStatusFilterChips
            counts={statusCounts}
            active={activeFilters}
            onToggle={toggleFilter}
          />
        )}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>No sessions yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Create your first session to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((s) => {
              const isOwner = s.createdBy === currentUserId;
              const canDelete = isOwner || canDeleteAny;
              return (
                <Link
                  key={s.id}
                  href={`/tools/surveys/${s.id}`}
                  className="group block rounded-xl border transition-all hover:shadow-card"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg-surface)",
                    opacity: s.status === "archived" ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center justify-between p-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {s.clientName} · {s.templateName}
                      </p>
                      <div className="flex items-center gap-3">
                        <h2 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{s.title}</h2>
                        <SessionStatusBadge status={s.status} />
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        <span className="inline-flex items-center gap-1.5">
                          <UserAvatar name={s.createdByName} image={s.createdByImage} size={16} />
                          {s.createdByName}
                        </span>
                        <span>
                          {s.completedCount} / {s.submissionCount} completed
                        </span>
                        <span>{new Date(s.createdAt).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {canDelete && (
                        <button
                          onClick={(e) => { e.preventDefault(); setDeleteTarget(s); }}
                          className="btn-icon p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:!text-[var(--danger)]"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-card p-6 shadow-dropdown" style={{ background: "var(--bg-surface)" }}>
            <h2 className="typo-modal-title mb-4" style={{ color: "var(--text-primary)" }}>Delete session?</h2>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Deletes the session and all {deleteTarget.submissionCount} submissions. Cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost rounded-lg flex-1 py-2.5 text-sm">Cancel</button>
              <button onClick={handleDelete} className="btn-danger rounded-lg flex-1 py-2.5 text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
