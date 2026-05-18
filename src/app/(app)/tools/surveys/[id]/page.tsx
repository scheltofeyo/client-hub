"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Check,
  Copy,
  Link2,
  MoreHorizontal,
  Pencil,
  QrCode,
  Trash2,
  Users,
} from "lucide-react";
import { SessionStatusBadge } from "@/components/ui/SessionStatusBadge";
import {
  HiddenQrCanvas,
  ShareLinkRow,
  useShareLink,
  useShareQr,
} from "@/components/ui/SharePanel";
import SessionTabNav, { type SessionTab } from "@/components/surveys/SessionTabNav";
import { ConfigureSheet } from "@/components/surveys/ConfigureSheet";
import { ResultsTab } from "@/components/survey-results/ResultsTab";
import type { ResultsData } from "@/components/survey-results/types";
import type { AnalysisResult } from "@/lib/surveys/analyses";
import { AnalysisForm } from "@/components/surveys/AnalysisForm";
import { useRightPanel } from "@/components/layout/RightPanel";
import { normalizeQuestionType } from "@/lib/surveys/types";
import type { QuestionMeta } from "@/lib/surveys/distributions";
import { slugify } from "@/lib/slug";

interface ArchetypeSnapshot {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface SessionDetail {
  id: string;
  clientId: string;
  clientName: string | null;
  templateId: string;
  templateSnapshot: {
    name: string;
    description?: string;
    archetypes: ArchetypeSnapshot[];
    rankWeights: number[];
    top3Weights: number[];
    sections: {
      id: string;
      title: string;
      questions: { id: string; title: string; type?: string; bodyHtml?: string }[];
    }[];
  };
  title: string;
  status: "draft" | "open" | "closed" | "archived";
  shareCode: string;
  createdBy: string;
  createdByName: string;
  createdByImage: string | null;
  submissionCount: number;
  completedCount: number;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

interface SubmissionRow {
  id: string;
  participantName: string;
  participantEmail: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
}

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: authSession } = useSession();
  const { openPanel, closePanel } = useRightPanel();
  const currentUserId = authSession?.user?.id;
  const perms = authSession?.user?.permissions ?? [];
  const canEditAny = perms.includes("tools.surveys.editAny");
  const canDeleteAny = perms.includes("tools.surveys.deleteAny");

  const initialTab = (searchParams.get("tab") as SessionTab) || "algemeen";
  const [tab, setTab] = useState<SessionTab>(
    initialTab === "results" || initialTab === "settings" ? initialTab : "algemeen"
  );

  const [data, setData] = useState<SessionDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareLink, setShowShareLink] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);

  // Share helpers
  const sharePath = data
    ? `/s/${slugify(data.clientName ?? "survey")}/${data.shareCode}`
    : "";
  const shareUrl = typeof window !== "undefined" && sharePath
    ? `${window.location.origin}${sharePath}`
    : sharePath;
  const { copied, copyLink: handleCopyLink } = useShareLink(shareUrl);
  const { qrRef, qrCopied, copyQr: handleCopyQr } = useShareQr(data?.shareCode);

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/surveys/sessions/${id}`);
    if (!res.ok) { router.push("/tools/surveys"); return; }
    const json = (await res.json()) as SessionDetail;
    setData(json);
  }, [id, router]);

  const loadSubmissions = useCallback(async () => {
    const res = await fetch(`/api/surveys/sessions/${id}/submissions`);
    if (!res.ok) return;
    const json = await res.json();
    if (Array.isArray(json)) setSubmissions(json);
  }, [id]);

  const loadResults = useCallback(async () => {
    const res = await fetch(`/api/surveys/sessions/${id}/results`);
    if (!res.ok) return;
    setResults((await res.json()) as ResultsData);
  }, [id]);

  useEffect(() => {
    async function load() {
      await Promise.all([loadSession(), loadSubmissions(), loadResults()]);
      setLoading(false);
    }
    load();
  }, [loadSession, loadSubmissions, loadResults]);

  useEffect(() => {
    if (!data || data.status !== "open") return;
    const interval = setInterval(() => {
      loadSession();
      loadSubmissions();
      loadResults();
    }, 5000);
    return () => clearInterval(interval);
  }, [data?.status, loadSession, loadSubmissions, loadResults]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback((next: SessionTab) => {
    setTab(next);
    const url = next === "algemeen"
      ? `/tools/surveys/${id}`
      : `/tools/surveys/${id}?tab=${next}`;
    window.history.replaceState(null, "", url);
  }, [id]);

  const persistSettings = useCallback(async (payload: Record<string, unknown>): Promise<boolean> => {
    const res = await fetch(`/api/surveys/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    await Promise.all([loadSession(), loadResults()]);
    return true;
  }, [id, loadSession, loadResults]);

  const deleteAnalysis = useCallback(async (analysisId: string) => {
    if (!confirm("Delete analysis?")) return;
    const res = await fetch(`/api/surveys/sessions/${id}/analyses/${analysisId}`, { method: "DELETE" });
    if (res.ok) await loadResults();
  }, [id, loadResults]);

  const duplicateAnalysis = useCallback(async (a: AnalysisResult) => {
    const payload = {
      title: `${a.title} (copy)`,
      type: a.type,
      operation: a.operation,
      sides: a.sides.map((s) => ({ id: s.id, label: s.label, questionIds: s.questionIds })),
      chartKey: a.chartKey,
    };
    const res = await fetch(`/api/surveys/sessions/${id}/analyses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) await loadResults();
  }, [id, loadResults]);

  const moveAnalysis = useCallback(async (analysisId: string, direction: "up" | "down") => {
    if (!results) return;
    const nativeIds = results.analyses.map((a) => a.id);
    const idx = nativeIds.indexOf(analysisId);
    if (idx === -1) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= nativeIds.length) return;
    const next = [...nativeIds];
    [next[idx], next[target]] = [next[target], next[idx]];
    const res = await fetch(`/api/surveys/sessions/${id}/analyses/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next }),
    });
    if (res.ok) await loadResults();
  }, [id, results, loadResults]);

  const openAnalysisForm = useCallback(
    (initial?: { id?: string; title?: string; analysis?: AnalysisResult }) => {
      if (!data) return;
      const questionMetas: QuestionMeta[] = (data.templateSnapshot.sections ?? []).flatMap((s) =>
        (s.questions ?? []).map((q) => ({
          ...q,
          sectionId: s.id,
          type: normalizeQuestionType(q.type),
        })) as QuestionMeta[]
      );
      const initialPayload = initial?.analysis
        ? {
            id: initial.id,
            title: initial.title ?? initial.analysis.title,
            type: initial.analysis.type,
            operation: initial.analysis.operation,
            sides: initial.analysis.sides.map((s) => ({
              id: s.id,
              label: s.label,
              questionIds: s.questionIds,
            })),
            chartKey: initial.analysis.chartKey,
          }
        : undefined;
      openPanel(
        initial?.id ? "Edit analysis" : "New analysis",
        <AnalysisForm
          sessionId={id}
          questions={questionMetas}
          initial={initialPayload}
          onSaved={() => {
            void loadResults();
          }}
          onClose={closePanel}
        />
      );
    },
    [data, id, openPanel, closePanel, loadResults]
  );

  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/surveys/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await loadSession();
  }

  async function handleDelete() {
    const res = await fetch(`/api/surveys/sessions/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/tools/surveys");
  }

  if (loading || !data) return null;

  const isDraft = data.status === "draft";
  const isOpen = data.status === "open";
  const isClosed = data.status === "closed";
  const isArchived = data.status === "archived";
  const isOwner = data.createdBy === currentUserId;
  const canEdit = isOwner || canEditAny;
  const canDelete = isOwner || canDeleteAny;

  const totalQuestions = (data.templateSnapshot.sections ?? []).reduce(
    (sum, s) => sum + (s.questions?.length ?? 0),
    0
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div
        ref={headerRef}
        className="sticky top-0 z-30 px-7 pt-6 pb-0"
        style={{ background: "var(--bg-surface)" }}
      >
        <nav className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/tools" className="hover:underline">Tools</Link>
          <span>/</span>
          <Link href="/tools/surveys" className="hover:underline">Surveys</Link>
          <span>/</span>
          <span>...</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-bold truncate" style={{ color: "var(--text-primary)" }}>{data.title}</h1>
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              {data.clientName ?? "Unknown client"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SessionStatusBadge status={data.status} />
            {isDraft && canEdit && (
              <Link
                href={`/tools/surveys/${id}/edit`}
                className="btn-secondary border rounded-lg text-sm px-3 py-2 inline-flex items-center gap-1.5"
              >
                <Pencil size={13} />
                Edit content
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
            <div ref={menuRef} className="relative">
              <button onClick={() => setShowMenu((v) => !v)} className="btn-icon p-2 rounded-lg">
                <MoreHorizontal size={18} />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 w-52 rounded-xl border py-1 shadow-dropdown z-50"
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
                        Revert to draft
                      </button>
                    </>
                  )}
                  {isClosed && canEdit && (
                    <>
                      <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                      <button
                        onClick={() => { updateStatus("archived"); setShowMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover-row"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Archive
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
                  {canDelete && (
                    <>
                      <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                      <button
                        onClick={() => { setShowDeleteModal(true); setShowMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover-row"
                        style={{ color: "var(--danger)" }}
                      >
                        <Trash2 size={14} />
                        Delete session
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <HiddenQrCanvas shareUrl={shareUrl} qrRef={qrRef} />
        <div>
          <SessionTabNav tab={tab} onChange={handleTabChange} />
        </div>
      </div>

      {tab === "algemeen" && (
      <div
        style={{
          background: "var(--bg-tinted)",
          minHeight: `calc(100vh - ${headerHeight}px)`,
        }}
        className="px-7 py-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {isDraft && (
              <>
                <div className="p-5 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                  <h3 className="typo-section-header mb-3" style={{ color: "var(--text-muted)" }}>
                    Archetypes ({data.templateSnapshot.archetypes.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {data.templateSnapshot.archetypes.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-badge text-xs font-medium"
                        style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                    {data.templateSnapshot.sections.length} sections · {totalQuestions} questions
                  </p>
                </div>

                <div
                  className="p-6 rounded-xl border text-center"
                  style={{ borderColor: "var(--primary-light)", background: "var(--primary-light)" }}
                >
                  <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Ready to share?</h3>
                  <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    {totalQuestions === 0
                      ? "Add at least one question in the editor before publishing."
                      : "Publish the session to activate the share link and invite participants."}
                  </p>
                  {canEdit && (
                    <button
                      onClick={() => setShowPublishModal(true)}
                      disabled={totalQuestions === 0}
                      className="btn-primary rounded-lg text-sm px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Publish session
                    </button>
                  )}
                </div>
              </>
            )}

            {(isOpen || isClosed) && showShareLink && <ShareLinkRow shareUrl={shareUrl} />}

            {isOpen && (
              <div className="p-4 rounded-xl border flex items-center justify-between gap-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Wrap up the survey?</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Close the session to lock in responses. No more submissions will be accepted after closing.
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => setShowCloseModal(true)} className="btn-primary rounded-lg text-sm px-4 py-2 shrink-0">
                    Close session
                  </button>
                )}
              </div>
            )}

            {!isDraft && (
              <div className="p-5 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>Participants</p>
                    <p className="typo-metric mt-1" style={{ color: "var(--text-primary)" }}>{submissions.length}</p>
                  </div>
                  <div>
                    <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>Completed</p>
                    <p className="typo-metric mt-1" style={{ color: "var(--text-primary)" }}>{submissions.filter((s) => s.status === "completed").length}</p>
                  </div>
                  <div>
                    <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>Questions</p>
                    <p className="typo-metric mt-1" style={{ color: "var(--text-primary)" }}>{totalQuestions}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isDraft && (
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-6">
                <ParticipantsList submissions={submissions} />
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {tab === "results" && (
        <div
          style={{
            background: "var(--bg-tinted)",
            minHeight: `calc(100vh - ${headerHeight}px)`,
          }}
        >
          <div className="mx-auto max-w-5xl px-7 py-6">
            <ResultsTab
              results={results}
              loading={loading}
              shareUrl={shareUrl}
              introBodyByQuestionId={Object.fromEntries(
                (data.templateSnapshot.sections ?? []).flatMap((s) =>
                  (s.questions ?? [])
                    .filter((q) => q.type === "intro" && q.bodyHtml)
                    .map((q) => [q.id, q.bodyHtml as string])
                )
              )}
              canEditAnalyses={canEdit}
              onCreateAnalysis={() => openAnalysisForm()}
              onEditAnalysis={(a) => openAnalysisForm({ id: a.id, analysis: a })}
              onDeleteAnalysis={(a) => deleteAnalysis(a.id)}
              onDuplicateAnalysis={(a) => duplicateAnalysis(a)}
              onMoveAnalysisUp={(a) => moveAnalysis(a.id, "up")}
              onMoveAnalysisDown={(a) => moveAnalysis(a.id, "down")}
            />
          </div>
        </div>
      )}

      {tab === "settings" && results && (
        <div className="px-7 py-6 max-w-5xl">
          <ConfigureSheet
            key={data.id}
            meta={{
              templateSnapshot: {
                rankWeights: data.templateSnapshot.rankWeights,
                top3Weights: data.templateSnapshot.top3Weights ?? [5, 3, 1],
              },
            }}
            canEdit={canEdit}
            onSaveRankWeights={(next) => persistSettings({ rankWeights: next })}
            onSaveTop3Weights={(next) => persistSettings({ top3Weights: next })}
          />
        </div>
      )}

      {showPublishModal && (
        <ConfirmModal
          title="Publish session?"
          onClose={() => setShowPublishModal(false)}
          onConfirm={() => { updateStatus("open"); setShowPublishModal(false); }}
          confirmLabel="Publish"
        >
          <p className="text-sm mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            After publishing, the following will happen:
          </p>
          <ul className="text-sm space-y-2" style={{ color: "var(--text-primary)" }}>
            <li className="flex gap-2">
              <span className="shrink-0 mt-0.5" style={{ color: "var(--success)" }}>✓</span>
              <span>The share link becomes active — participants can submit responses.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 mt-0.5" style={{ color: "var(--warning)" }}>⚠</span>
              <span>The template snapshot is locked. Template edits made afterwards will not affect this session.</span>
            </li>
          </ul>
        </ConfirmModal>
      )}

      {showCloseModal && (
        <ConfirmModal
          title="Close session?"
          onClose={() => setShowCloseModal(false)}
          onConfirm={() => { updateStatus("closed"); setShowCloseModal(false); }}
          confirmLabel="Close session"
        >
          <p className="text-sm mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Closing the session does this:
          </p>
          <ul className="text-sm space-y-2" style={{ color: "var(--text-primary)" }}>
            <li className="flex gap-2">
              <span className="shrink-0 mt-0.5" style={{ color: "var(--warning)" }}>⚠</span>
              <span>No further submissions are accepted.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 mt-0.5" style={{ color: "var(--primary)" }}>★</span>
              <span>Results stay available on the Results page.</span>
            </li>
          </ul>
        </ConfirmModal>
      )}

      {showDeleteModal && (
        <ConfirmModal
          title="Delete session?"
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          confirmLabel="Delete"
          confirmStyle="danger"
        >
          <p className="text-sm mb-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Deletes the session and all {submissions.length} submissions. This cannot be undone.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

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
          <button onClick={onClose} className="btn-ghost rounded-lg flex-1 py-2.5 text-sm">Cancel</button>
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

function ParticipantsList({ submissions }: { submissions: SubmissionRow[] }) {
  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
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
            return (
              <div
                key={sub.id}
                className="border rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {isInProgress ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                      style={{ background: "var(--warning-light)", color: "var(--warning)" }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: "var(--warning)" }}
                      />
                      In progress
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
                  <p
                    className="text-sm truncate min-w-0"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {sub.participantEmail}
                  </p>
                </div>
                {sub.submittedAt && !isInProgress && (
                  <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                    {new Date(sub.submittedAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
