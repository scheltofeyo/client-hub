"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Copy, Check, Users, Pencil, ChevronDown, QrCode, Link2, MoreHorizontal } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import {
  findGreedyPairs,
  findBalancedPairs,
  normalizeDistance,
  findBestDuoForUnmatched,
} from "@/lib/ranking/matching";
import type { Submission as MatchSubmission } from "@/lib/ranking/matching";

interface RankingValue {
  id: string;
  title: string;
  color: string;
  mantra: string;
  description: string;
}

interface Session {
  id: string;
  clientId: string;
  clientName?: string;
  title: string;
  description?: string;
  values: RankingValue[];
  status: string;
  shareCode: string;
  createdBy: string;
  createdByName: string;
  createdByImage: string | null;
  submissionCount: number;
  createdAt: string;
}

interface Submission {
  id: string;
  participantName: string;
  participantEmail: string;
  status: string;
  rankings: string[] | null;
  submittedAt?: string;
}

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
  draft: { label: "Draft", dotColor: "var(--info)", bgColor: "var(--info-light)", textColor: "var(--info)" },
  open: { label: "Open", dotColor: "var(--success)", bgColor: "var(--success-light)", textColor: "var(--success)" },
  closed: { label: "Closed", dotColor: "var(--text-muted)", bgColor: "var(--bg-hover)", textColor: "var(--text-muted)" },
  archived: { label: "Archived", dotColor: "var(--border)", bgColor: "var(--bg-hover)", textColor: "var(--text-muted)" },
};

export default function RankingSessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: authSession } = useSession();
  const currentUserId = authSession?.user?.id;
  const perms = authSession?.user?.permissions ?? [];
  const canEditAny = perms.includes("tools.ranking.editAny");
  const canDeleteAny = perms.includes("tools.ranking.deleteAny");

  const [session, setSession] = useState<Session | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);

  // Share link copy handlers
  const [copied, setCopied] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/ranking-sessions/${id}`);
    if (!res.ok) { router.push("/tools/ranking"); return; }
    setSession(await res.json());
  }, [id, router]);

  const loadSubmissions = useCallback(async () => {
    const res = await fetch(`/api/ranking-sessions/${id}/submissions`);
    if (res.ok) setSubmissions(await res.json());
  }, [id]);

  useEffect(() => {
    async function load() {
      await Promise.all([loadSession(), loadSubmissions()]);
      setLoading(false);
    }
    load();
  }, [loadSession, loadSubmissions]);

  // Poll submissions when session is open
  useEffect(() => {
    if (!session || session.status !== "open") return;
    const interval = setInterval(loadSubmissions, 5000);
    return () => clearInterval(interval);
  }, [session?.status, loadSubmissions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/ranking-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setSession(await res.json());
  }

  const shareUrl = typeof window !== "undefined" && session
    ? `${window.location.origin}/ranking/${session.shareCode}`
    : session ? `/ranking/${session.shareCode}` : "";

  async function handleCopyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setQrCopied(true);
        setTimeout(() => setQrCopied(false), 2000);
      }
    } catch {
      const link = document.createElement("a");
      link.download = `qr-${session?.shareCode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  }

  if (loading || !session) return null;

  const isDraft = session.status === "draft";
  const isOpen = session.status === "open";
  const isClosed = session.status === "closed";
  const isArchived = session.status === "archived";
  const statusCfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.draft;
  const isOwner = session.createdBy === currentUserId;
  const canEdit = isOwner || canEditAny;
  void canDeleteAny; // available for future delete button on detail page

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-7 pt-6 pb-5 shrink-0">
        <nav className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/tools" className="hover:underline">Tools</Link>
          <span>/</span>
          <Link href="/tools/ranking" className="hover:underline">Ranking the Values</Link>
          <span>/</span>
          <span>...</span>
        </nav>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{session.title}</h1>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ background: statusCfg.bgColor, color: statusCfg.textColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dotColor }} />
                {statusCfg.label}
              </span>
            </div>
            {session.clientName && (
              <p className="text-sm font-medium mt-1" style={{ color: "var(--text-primary)" }}>{session.clientName}</p>
            )}
            {session.description && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{session.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDraft && canEdit && (
              <Link href={`/tools/ranking/${id}/edit`} className="btn-secondary border rounded-lg text-sm px-3 py-2 inline-flex items-center gap-1.5">
                <Pencil size={13} />
                Edit
              </Link>
            )}
            {(isOpen || isClosed) && (
              <button
                onClick={handleCopyQr}
                className="btn-primary-light rounded-lg text-sm px-3 py-2 inline-flex items-center gap-1.5 font-medium"
                style={{ color: "var(--primary)" }}
              >
                {qrCopied ? <Check size={14} style={{ color: "var(--success)" }} /> : <QrCode size={14} />}
                {qrCopied ? "Copied!" : "Copy QR"}
              </button>
            )}
            {/* Kebab menu */}
            {((isOpen || isClosed) || (isOpen && submissions.length === 0 && canEdit) || (isArchived && canEdit)) && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setShowMenu((v) => !v)}
                  className="btn-icon p-2 rounded-lg"
                >
                  <MoreHorizontal size={18} />
                </button>
                {showMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 w-48 rounded-xl border py-1 shadow-dropdown z-50"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
                  >
                    {(isOpen || isClosed) && (
                      <>
                        <button
                          onClick={() => { handleCopyLink(); setShowMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover-row"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {copied ? <Check size={14} style={{ color: "var(--success)" }} /> : <Copy size={14} style={{ color: "var(--text-muted)" }} />}
                          {copied ? "Copied!" : "Copy link"}
                        </button>
                        <button
                          onClick={() => { setShowShareLink((v) => !v); setShowMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover-row"
                          style={{ color: "var(--text-primary)" }}
                        >
                          <Link2 size={14} style={{ color: "var(--text-muted)" }} />
                          {showShareLink ? "Hide link" : "Show link"}
                        </button>
                      </>
                    )}
                    {isOpen && submissions.length === 0 && canEdit && (
                      <>
                        <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                        <button
                          onClick={() => { updateStatus("draft"); setShowMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover-row"
                          style={{ color: "var(--text-primary)" }}
                        >
                          <Pencil size={14} style={{ color: "var(--text-muted)" }} />
                          Revert to draft
                        </button>
                      </>
                    )}
                    {isArchived && canEdit && (
                      <>
                        <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                        <button
                          onClick={() => { updateStatus("closed"); setShowMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover-row"
                          style={{ color: "var(--text-primary)" }}
                        >
                          Reactivate
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Hidden QR canvas for clipboard copy */}
        <div ref={qrRef} className="hidden">
          <QRCodeCanvas value={shareUrl} size={400} level="M" marginSize={2} />
        </div>
      </div>

      <div className="px-7 pb-7">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Left column (2/3) ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* === DRAFT: values + publish CTA === */}
            {isDraft && (
              <>
                <div className="p-5 rounded-xl border" style={{ borderColor: "var(--border)", background: "white" }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                    Values ({session.values.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {session.values.map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-badge text-xs font-medium"
                        style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                        {v.title}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-xl border text-center" style={{ borderColor: "hsl(263 60% 90%)", background: "hsl(263 70% 96%)" }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "hsl(263 60% 90%)" }}>
                    <svg className="w-6 h-6" style={{ color: "var(--primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Ready to share?</h3>
                  <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    Publish the session to activate the share link and invite participants.
                  </p>
                  {canEdit && (
                    <button onClick={() => setShowPublishModal(true)} className="btn-primary rounded-lg text-sm px-5 py-2.5">
                      Publish session
                    </button>
                  )}
                </div>
              </>
            )}

            {/* === OPEN / CLOSED: share link (toggled from header) === */}
            {(isOpen || isClosed) && showShareLink && (
              <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "white" }}>
                <p className="typo-section-header mb-1" style={{ color: "var(--text-muted)" }}>Share link</p>
                <p className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>{shareUrl}</p>
              </div>
            )}

            {/* === OPEN: close CTA === */}
            {isOpen && (
              <div className="p-4 rounded-xl border flex items-center justify-between gap-4" style={{ borderColor: "var(--border)", background: "white" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Ready to match?</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Close the session to pair participants. No more submissions will be accepted after closing.
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => setShowCloseModal(true)} className="btn-primary rounded-lg text-sm px-4 py-2 shrink-0">
                    Close & match
                  </button>
                )}
              </div>
            )}

            {/* === CLOSED / ARCHIVED: archive CTA + match results === */}
            {(isClosed || isArchived) && (
              <>
                {isClosed && (
                  <div className="p-4 rounded-xl border flex items-center justify-between gap-4" style={{ borderColor: "var(--border)", background: "white" }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Wrap up session?</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Archive the session to keep your overview tidy.</p>
                    </div>
                    {canEdit && (
                      <button onClick={() => updateStatus("archived")} className="btn-ghost rounded-lg text-sm px-4 py-2 shrink-0">
                        Archive
                      </button>
                    )}
                  </div>
                )}

                <MatchResultsPanel submissions={submissions} values={session.values} />
              </>
            )}
          </div>

          {/* ── Right column (1/3): participants ── */}
          {!isDraft && (
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-6">
                <SubmissionsSection submissions={submissions} values={session.values} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Publish confirmation modal ── */}
      {showPublishModal && (
        <ConfirmModal
          title="Publish session?"
          onClose={() => setShowPublishModal(false)}
          onConfirm={() => { updateStatus("open"); setShowPublishModal(false); }}
          confirmLabel="Publish"
          confirmStyle="primary"
        >
          <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            After publishing, the following will happen:
          </p>
          <ul className="text-sm space-y-2 mb-2" style={{ color: "var(--text-primary)" }}>
            <li className="flex gap-2">
              <span className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--success)" }}>✓</span>
              <span>The share link becomes active — participants can submit their ranking</span>
            </li>
          </ul>
        </ConfirmModal>
      )}

      {/* ── Close confirmation modal ── */}
      {showCloseModal && (
        <ConfirmModal
          title="Close session?"
          onClose={() => setShowCloseModal(false)}
          onConfirm={() => { updateStatus("closed"); setShowCloseModal(false); }}
          confirmLabel="Close & match"
          confirmStyle="primary"
        >
          <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            After closing, the following will happen:
          </p>
          <ul className="text-sm space-y-2 mb-2" style={{ color: "var(--text-primary)" }}>
            <li className="flex gap-2">
              <span className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--primary)" }}>★</span>
              <span>Participants will be automatically matched based on opposing values</span>
            </li>
            <li className="flex gap-2">
              <span className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--warning)" }}>⚠</span>
              <span>No one can submit a ranking anymore</span>
            </li>
          </ul>
        </ConfirmModal>
      )}
    </div>
  );
}

// ── Confirmation modal ──────────────────────────────────────────────

function ConfirmModal({
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  confirmStyle = "primary",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmStyle?: "primary" | "danger";
}) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl p-6 shadow-dropdown" style={{ background: "var(--bg-surface)" }}>
        <h2 className="typo-modal-title mb-4" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {children}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-ghost rounded-lg flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg text-white ${confirmStyle === "danger" ? "btn-danger" : "btn-primary"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Submissions list (expandable) ───────────────────────────────────

function SubmissionsSection({ submissions, values }: { submissions: Submission[]; values: RankingValue[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const valueMap = Object.fromEntries(values.map((v) => [v.id, v]));

  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "white" }}>
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} style={{ color: "var(--text-muted)" }} />
        <h3 className="typo-section-header" style={{ color: "var(--text-muted)" }}>
          Participants ({submissions.length})
        </h3>
      </div>
      {submissions.length === 0 ? (
        <p className="text-sm py-4" style={{ color: "var(--text-muted)" }}>
          No submissions received yet.
        </p>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => {
            const isInProgress = sub.status === "in_progress";
            const isExpanded = expandedId === sub.id && !isInProgress;
            return (
              <div key={sub.id} className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => !isInProgress && setExpandedId(isExpanded ? null : sub.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                  style={{ cursor: isInProgress ? "default" : "pointer" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                      style={{
                        background: isInProgress ? "var(--warning-light)" : "var(--primary-light)",
                        color: isInProgress ? "var(--warning)" : "var(--primary)",
                      }}
                    >
                      {sub.participantName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {sub.participantName}
                        </p>
                        {isInProgress ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                            style={{ background: "var(--warning-light)", color: "var(--warning)" }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--warning)" }} />
                            In progress...
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                            style={{ background: "var(--success-light)", color: "var(--success)" }}
                          >
                            <Check size={10} strokeWidth={3} />
                            Completed
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{sub.participantEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {!isInProgress && sub.submittedAt && (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(sub.submittedAt).toLocaleString("en-GB", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    )}
                    {!isInProgress && (
                      <ChevronDown
                        size={16}
                        className="transition-transform"
                        style={{
                          color: "var(--text-muted)",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    )}
                  </div>
                </button>
                {isExpanded && sub.rankings && (
                  <div className="px-4 pb-3 border-t" style={{ borderColor: "var(--border)" }}>
                    <ol className="mt-2 space-y-1">
                      {sub.rankings.map((valueId, i) => {
                        const v = valueMap[valueId];
                        if (!v) return null;
                        return (
                          <li key={valueId} className="flex items-center gap-2 text-sm">
                            <span className="w-5 text-xs text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{i + 1}.</span>
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                            <span style={{ color: "var(--text-primary)" }}>{v.title}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Match results panel (expandable pairs, algorithm toggle, progress bars) ──

function MatchResultsPanel({ submissions, values }: { submissions: Submission[]; values: RankingValue[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [algorithm, setAlgorithm] = useState<"greedy" | "balanced">("balanced");

  const completed = submissions.filter((s) => s.status === "completed" && s.rankings);
  if (completed.length < 2) {
    return (
      <div className="p-4 rounded-xl border" style={{ borderColor: "var(--primary)", background: "white" }}>
        <h3 className="typo-section-header mb-2" style={{ color: "var(--primary)" }}>Match results</h3>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          At least 2 completed submissions are needed to calculate matches.
        </p>
      </div>
    );
  }

  const mapped: MatchSubmission[] = completed.map((s) => ({
    id: s.id,
    participantName: s.participantName,
    participantEmail: s.participantEmail,
    rankings: s.rankings!,
  }));

  const findPairs = algorithm === "greedy" ? findGreedyPairs : findBalancedPairs;
  const { pairs, unmatched } = findPairs(mapped);
  const valueMap = Object.fromEntries(values.map((v) => [v.id, v]));

  function switchAlgorithm(alg: "greedy" | "balanced") {
    setAlgorithm(alg);
    setExpandedIndex(null);
  }

  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: "var(--primary)", background: "white" }}>
      {/* Header + algorithm toggle */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="typo-section-header" style={{ color: "var(--primary)" }}>Match results</h3>
        <div className="flex items-center gap-1 p-1 rounded-button" style={{ background: "var(--bg-hover)" }}>
          {(["greedy", "balanced"] as const).map((alg) => (
            <button
              key={alg}
              onClick={() => switchAlgorithm(alg)}
              className="px-2.5 py-1 text-xs font-medium rounded-button transition-colors"
              style={{
                background: algorithm === alg ? "var(--bg-surface)" : "transparent",
                color: algorithm === alg ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: algorithm === alg ? "var(--shadow-subtle)" : "none",
              }}
            >
              {alg === "greedy" ? "Greedy" : "Balanced"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {pairs.map((pair, i) => {
          const oppositionPct = normalizeDistance(pair.distance, values.length);
          const isExpanded = expandedIndex === i;
          return (
            <div key={i} className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              {/* Compact clickable row */}
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover-row"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex -space-x-2 shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ring-2 ring-white" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                      {pair.participant1.participantName.charAt(0).toUpperCase()}
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ring-2 ring-white" style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
                      {pair.participant2.participantName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="text-sm min-w-0 truncate">
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{pair.participant1.participantName}</span>
                    <span className="mx-1.5" style={{ color: "var(--text-muted)" }}>&</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{pair.participant2.participantName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{oppositionPct}%</span>
                    <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>opposition</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className="transition-transform"
                    style={{
                      color: "var(--text-muted)",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </div>
              </button>

              {/* Expanded: progress bar + side-by-side rankings */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border)" }}>
                  {/* Opposition progress bar */}
                  <div className="mt-3 mb-4">
                    <div className="w-full h-2 rounded-full" style={{ background: "var(--bg-hover)" }}>
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${oppositionPct}%`, background: "var(--primary)" }}
                      />
                    </div>
                  </div>

                  {/* Side-by-side rankings */}
                  <div className="grid grid-cols-2 gap-4">
                    {[pair.participant1, pair.participant2].map((participant) => (
                      <div key={participant.id}>
                        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
                          {participant.participantName}
                        </p>
                        <ol className="space-y-1">
                          {participant.rankings.map((valueId, j) => {
                            const v = valueMap[valueId];
                            if (!v) return null;
                            return (
                              <li key={valueId} className="flex items-center gap-2 text-sm">
                                <span className="w-4 text-xs text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{j + 1}.</span>
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                                <span className="truncate" style={{ color: "var(--text-primary)" }}>{v.title}</span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Unmatched participant with trio suggestion */}
        {unmatched && (() => {
          const suggestedDuo = findBestDuoForUnmatched(unmatched, pairs, values.length);
          return (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--warning-light)", border: "1px solid var(--warning)" }}>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                <strong>{unmatched.participantName}</strong> has no match (odd number of participants).
              </p>
              {suggestedDuo && (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Suggestion: have {unmatched.participantName} join{" "}
                  <strong>{suggestedDuo.pair.participant1.participantName}</strong> &{" "}
                  <strong>{suggestedDuo.pair.participant2.participantName}</strong>{" "}
                  <span style={{ color: "var(--text-muted)" }}>
                    (average {suggestedDuo.avgOpposition}% opposition)
                  </span>
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
