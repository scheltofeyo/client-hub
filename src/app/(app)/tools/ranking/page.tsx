"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Copy, Trash2, ChevronRight } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";

interface SessionSummary {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description?: string;
  status: string;
  shareCode: string;
  submissionCount: number;
  createdBy: string;
  createdByName: string;
  createdByImage: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
  draft: { label: "Draft", dotColor: "var(--info)", bgColor: "var(--info-light)", textColor: "var(--info)" },
  open: { label: "Open", dotColor: "var(--success)", bgColor: "var(--success-light)", textColor: "var(--success)" },
  closed: { label: "Closed", dotColor: "var(--text-muted)", bgColor: "var(--bg-hover)", textColor: "var(--text-muted)" },
  archived: { label: "Archived", dotColor: "var(--border)", bgColor: "var(--bg-hover)", textColor: "var(--text-muted)" },
};

const STATUS_FILTERS = [
  { key: "open", label: "Open" },
  { key: "draft", label: "Draft" },
  { key: "closed", label: "Closed" },
  { key: "archived", label: "Archived" },
];

export default function RankingSessionListPage() {
  const router = useRouter();
  const { data: authSession } = useSession();
  const currentUserId = authSession?.user?.id;
  const perms = authSession?.user?.permissions ?? [];
  const canEditAny = perms.includes("tools.ranking.editAny");
  const canDeleteAny = perms.includes("tools.ranking.deleteAny");

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>(["open", "draft"]);
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  useEffect(() => {
    fetch("/api/ranking-sessions")
      .then((r) => r.json())
      .then((data) => { setSessions(data); setLoading(false); });
  }, []);

  function toggleFilter(key: string) {
    setActiveFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/ranking-sessions/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
  }

  async function handleDuplicate(session: SessionSummary) {
    // Create a new session for the same client
    const res = await fetch("/api/ranking-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: session.clientId,
        title: session.title,
        description: session.description,
      }),
    });
    if (res.ok) {
      const newSession = await res.json();
      router.push(`/tools/ranking/${newSession.id}/edit`);
    }
  }

  const visibleSessions = activeFilters.length === 0
    ? sessions
    : sessions.filter((s) => activeFilters.includes(s.status));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-7 pt-6 pb-5 shrink-0">
        <nav className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/tools" className="hover:underline">Tools</Link>
          <span>/</span>
          <span>Ranking the Values</span>
        </nav>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Ranking the Values</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Manage your sessions and view results.</p>
          </div>
          <Link href="/tools/ranking/new" className="btn-primary rounded-lg text-sm px-4 py-2.5 inline-flex items-center gap-1.5">
            <Plus size={14} />
            New session
          </Link>
        </div>
      </div>

      <div className="px-7 pb-7">
        {/* Multi-select filter toggles with counts */}
        {sessions.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            {STATUS_FILTERS.map(({ key, label }) => {
              const active = activeFilters.includes(key);
              const count = sessions.filter((s) => s.status === key).length;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => toggleFilter(key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-sm font-medium transition-colors"
                  style={{
                    background: active ? "var(--primary-light)" : "var(--bg-hover)",
                    color: active ? "var(--primary)" : "var(--text-muted)",
                    border: active ? "1px solid var(--primary)" : "1px solid transparent",
                    opacity: active ? 1 : 0.8,
                  }}
                >
                  {label}
                  <span className="text-xs" style={{ opacity: 0.6 }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--border)", background: "white" }}>
            <div className="w-12 h-12 rounded-card flex items-center justify-center mx-auto mb-4" style={{ background: "var(--primary-light)" }}>
              <svg className="w-6 h-6" style={{ color: "var(--primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </div>
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>No sessions yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Create your first session to get started.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleSessions.map((s) => {
                const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.draft;
                const isOwner = s.createdBy === currentUserId;
                const canEdit = isOwner || canEditAny;
                const canDelete = isOwner || canDeleteAny;
                return (
                  <Link
                    key={s.id}
                    href={`/tools/ranking/${s.id}`}
                    className="group block rounded-xl border transition-all hover:shadow-card"
                    style={{
                      borderColor: "var(--border)",
                      background: "white",
                      opacity: s.status === "archived" ? 0.6 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between p-5">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>{s.clientName}</p>
                        <div className="flex items-center gap-3">
                          <h2 className="text-base font-semibold truncate transition-colors" style={{ color: "var(--text-primary)" }}>
                            {s.title}
                          </h2>
                          {/* Status badge with dot */}
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0"
                            style={{ background: cfg.bgColor, color: cfg.textColor }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dotColor }} />
                            {cfg.label}
                          </span>
                        </div>
                        {s.description && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{s.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                          <span className="inline-flex items-center gap-1.5">
                            <UserAvatar name={s.createdByName} image={s.createdByImage} size={16} />
                            {s.createdByName}
                          </span>
                          <span>{new Date(s.createdAt).toLocaleDateString("en-GB")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        {/* Duplicate button */}
                        {canEdit && (
                          <button
                            onClick={(e) => { e.preventDefault(); handleDuplicate(s); }}
                            className="btn-icon p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
                        )}
                        {/* Delete button */}
                        {canDelete && (
                          <button
                            onClick={(e) => { e.preventDefault(); setDeleteTarget(s); }}
                            className="btn-icon p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:!text-[var(--danger)]"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <ChevronRight size={16} className="transition-colors" style={{ color: "var(--text-muted)" }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {visibleSessions.length === 0 && (
              <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
                No sessions match these filters.
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-card p-6 shadow-dropdown" style={{ background: "var(--bg-surface)" }}>
            <h2 className="typo-modal-title mb-4" style={{ color: "var(--text-primary)" }}>Delete session?</h2>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              This action cannot be undone. The following will be permanently deleted:
            </p>
            <ul className="text-sm space-y-2 mb-6" style={{ color: "var(--text-primary)" }}>
              <li className="flex gap-2">
                <Trash2 size={14} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
                <span>The session <strong>&ldquo;{deleteTarget.title}&rdquo;</strong> and all settings</span>
              </li>
              <li className="flex gap-2">
                <Trash2 size={14} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
                <span>All {deleteTarget.submissionCount} {deleteTarget.submissionCount === 1 ? "submission" : "submissions"} from participants</span>
              </li>
            </ul>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost rounded-lg flex-1 py-2.5 text-sm">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn-danger rounded-lg flex-1 py-2.5 text-sm">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
