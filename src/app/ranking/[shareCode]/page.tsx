"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MATCH_PROMPTS, TRIO_PROMPTS, t, type Locale } from "@/lib/ranking/translations";
import BehaviorDisplay from "@/components/ui/BehaviorDisplay";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import SummLogo from "@/components/ui/SummLogo";

interface RankingValue {
  id: string;
  title: string;
  color: string;
  mantra: string;
  description: string;
  behaviors?: { level: string; content: string }[];
}

interface SessionData {
  id: string;
  title: string;
  description?: string;
  values: RankingValue[];
  status: string;
  culturalLevels?: string[];
  showBehaviors?: boolean;
}

// ── Step indicator ──────────────────────────────────────────────────

function StepIndicator({ currentStep, locale }: { currentStep: number; locale: Locale }) {
  const steps = [
    { label: t(locale, "step.details") },
    { label: t(locale, "step.ranking") },
    { label: t(locale, "step.match") },
  ];

  return (
    <div className="flex items-center w-full max-w-xs mx-auto mb-8">
      {steps.map((step, i) => {
        const num = i + 1;
        const done = num < currentStep;
        const active = num === currentStep;
        return (
          <div key={num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"
                style={{
                  background: done ? "var(--primary)" : active ? "var(--bg-surface)" : "var(--bg-hover)",
                  color: done ? "white" : active ? "var(--primary)" : "var(--text-muted)",
                  border: active ? "2px solid var(--primary)" : "none",
                }}
              >
                {done ? (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : num}
              </div>
              <span className="text-xs mt-1 whitespace-nowrap" style={{ color: active ? "var(--primary)" : "var(--text-muted)", fontWeight: active ? 500 : 400 }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="h-0.5 flex-1 mx-2 -mt-4" style={{ background: num < currentStep ? "var(--primary)" : "var(--border)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sortable value card ─────────────────────────────────────────────

function SortableValueCard({ value, index, onShowDetail, locale }: { value: RankingValue; index: number; onShowDetail: (v: RankingValue) => void; locale: Locale }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value.id });
  const hasDetail = !!(value.mantra || value.description);
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
        borderColor: isDragging ? "var(--primary)" : "var(--border)",
        background: "var(--bg-elevated)",
        boxShadow: isDragging ? "var(--shadow-card)" : "none",
      }}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 px-4 py-3 rounded-card border cursor-grab active:cursor-grabbing touch-none"
    >
      {/* Drag handle (left) */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="shrink-0" strokeLinecap="round">
        <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
      </svg>
      <span
        className="w-6 h-6 rounded-button flex items-center justify-center text-xs tabular-nums shrink-0"
        style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
      >
        {index + 1}
      </span>
      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: value.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value.title}</p>
      </div>
      {hasDetail && (
        <button
          onClick={(e) => { e.stopPropagation(); onShowDetail(value); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors"
          style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
          aria-label={t(locale, "aria.viewDetails")}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Read-again value card (match step, no drag, tap to open detail) ─

function ValueReadAgainCard({ value, onShowDetail, locale }: { value: RankingValue; onShowDetail: (v: RankingValue) => void; locale: Locale }) {
  const hasDetail = !!(value.mantra || value.description);

  const content = (
    <>
      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: value.color }} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value.title}</p>
      </div>
      {hasDetail && (
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </span>
      )}
    </>
  );

  const baseClass = "flex items-center gap-3 px-4 py-3 rounded-card border border-border-default bg-elevated w-full";

  if (!hasDetail) {
    return <div className={baseClass}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onShowDetail(value)}
      className={`${baseClass} cursor-pointer transition-colors hover:bg-hover`}
      aria-label={t(locale, "aria.viewDetails")}
    >
      {content}
    </button>
  );
}

// ── Color utilities ────────────────────────────────────────────────

function darkenHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - factor));
  const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - factor));
  const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - factor));
  return `rgb(${r}, ${g}, ${b})`;
}

function lightenHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) + (255 - parseInt(h.substring(0, 2), 16)) * factor);
  const g = Math.round(parseInt(h.substring(2, 4), 16) + (255 - parseInt(h.substring(2, 4), 16)) * factor);
  const b = Math.round(parseInt(h.substring(4, 6), 16) + (255 - parseInt(h.substring(4, 6), 16)) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const [rs, gs, bs] = [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(rs) + 0.7152 * toLinear(gs) + 0.0722 * toLinear(bs);
}

function shouldUseLightText(hex: string): boolean {
  return relativeLuminance(hex) < 0.4;
}

// ── Value detail modal (read-only, for public form) ─────────────────

function ValueDetailModal({ value, onClose, locale, culturalLevels, showBehaviors }: { value: RankingValue; onClose: () => void; locale: Locale; culturalLevels?: string[]; showBehaviors?: boolean }) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const bg = value.color;
  const lightText = shouldUseLightText(bg);
  const textColor = lightText ? "#ffffff" : darkenHex(bg, 0.75);
  const textMuted = lightText ? "rgba(255, 255, 255, 0.75)" : darkenHex(bg, 0.55);
  const badgeBg = lightText ? darkenHex(bg, 0.2) : "rgba(0, 0, 0, 0.1)";
  const btnBg = lightText ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)";
  const hasBehaviors = showBehaviors && culturalLevels && culturalLevels.length > 0 && value.behaviors && value.behaviors.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-md overflow-hidden shadow-dropdown flex flex-col"
        style={{
          background: `linear-gradient(135deg, ${lightenHex(bg, 0.15)} 0%, ${bg} 40%, ${darkenHex(bg, 0.15)} 100%)`,
          borderRadius: 16,
          minHeight: 320,
          maxHeight: "85vh",
        }}
      >
        <div className="flex-1 overflow-y-auto">
          {/* Title label */}
          <div className="px-6 pt-6 text-center">
            <span
              className="inline-block px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider"
              style={{ backgroundColor: badgeBg, color: textColor }}
            >
              {value.title}
            </span>
          </div>

          {/* Mantra */}
          <div className="flex items-center justify-center text-center px-6 py-4">
            <h3 className="text-2xl font-bold leading-snug" style={{ color: textColor }}>
              {value.mantra || value.title}
            </h3>
          </div>

          {/* Description */}
          {value.description && (
            <div className="px-6 pb-2 text-center">
              <p className="text-sm leading-relaxed" style={{ color: textMuted }}>
                {value.description}
              </p>
            </div>
          )}

          {/* Behavior examples */}
          {hasBehaviors && (
            <div className="px-6 pb-2">
              <BehaviorDisplay
                levels={culturalLevels!}
                behaviors={value.behaviors!}
                color={bg}
                variant="card"
                lightText={lightText}
              />
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="px-6 pb-5 pt-3">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: btnBg, color: textColor }}
          >
            {t(locale, "btn.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export default function PublicRankingPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [locale, setLocale] = useState<Locale>("en");

  // Step 1
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Step 2
  const [order, setOrder] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Step 3
  const [existingSubmission, setExistingSubmission] = useState<{ id: string; rankings: string[] } | null>(null);
  const [matchData, setMatchData] = useState<unknown>(null);

  const [error, setError] = useState<string | null>(null);
  const [matchPromptIndex] = useState(() => Math.floor(Math.random() * MATCH_PROMPTS.nl.length));
  const [detailValue, setDetailValue] = useState<RankingValue | null>(null);

  // DnD sensors (pointer + touch + keyboard)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load session
  useEffect(() => {
    fetch(`/api/public/ranking/${shareCode}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setSession(data);
        if (data) {
          // Shuffle values (Fisher-Yates) to avoid order bias
          const ids = data.values.map((v: RankingValue) => v.id);
          for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
          }
          setOrder(ids);
        }
        setLoading(false);
      });
  }, [shareCode]);

  // Poll for session close (step 3)
  useEffect(() => {
    if (currentStep !== 3 || !session || session.status === "closed" || session.status === "archived") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/public/ranking/${shareCode}/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "closed" || data.status === "archived") {
        setSession((prev) => prev ? { ...prev, status: data.status } : prev);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentStep, session?.status, shareCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch results when session closes
  useEffect(() => {
    if (!session || (session.status !== "closed" && session.status !== "archived") || currentStep !== 3) return;
    fetch(`/api/public/ranking/${shareCode}/results`)
      .then((r) => r.json())
      .then(setMatchData);
  }, [session?.status, currentStep, shareCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 1 handler ──
  async function handleIdentify() {
    setError(null);
    if (!name.trim() || !email.trim()) { setError(t(locale, "error.nameEmail")); return; }

    // Check if email already exists
    const checkRes = await fetch(`/api/public/ranking/${shareCode}/check-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const checkData = await checkRes.json();

    if (checkData.exists) {
      if (checkData.submission.status === "in_progress") {
        setSubmissionId(checkData.submission.id);
        setCurrentStep(2);
      } else {
        setExistingSubmission(checkData.submission);
        setCurrentStep(3);
      }
      return;
    }

    if (session?.status === "closed") {
      setError(t(locale, "error.sessionClosed"));
      return;
    }

    // Create pending submission
    const res = await fetch(`/api/public/ranking/${shareCode}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantName: name.trim(), participantEmail: email.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? t(locale, "error.generic")); return; }
    setSubmissionId(data.id);
    setCurrentStep(2);
  }

  // ── Step 2 handler ──
  async function handleSubmitRanking() {
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/public/ranking/${shareCode}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, rankings: order }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) { setError(data.error ?? t(locale, "error.generic")); return; }
    setExistingSubmission({ id: data.id, rankings: data.rankings });
    setCurrentStep(3);
  }

  // ── Drag end ──
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  if (loading) return null;

  // Error states
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-surface)" }}>
        <div className="absolute top-4 right-4"><LocaleSwitcher locale={locale} onChange={setLocale} /></div>
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{t(locale, "error.notFound")}</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t(locale, "error.notFoundExplain")}
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "draft") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-surface)" }}>
        <div className="absolute top-4 right-4"><LocaleSwitcher locale={locale} onChange={setLocale} /></div>
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{t(locale, "error.notStarted")}</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t(locale, "error.notStartedExplain")}
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "archived") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-surface)" }}>
        <div className="absolute top-4 right-4"><LocaleSwitcher locale={locale} onChange={setLocale} /></div>
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{t(locale, "error.archived")}</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t(locale, "error.archivedExplain")}
          </p>
        </div>
      </div>
    );
  }

  const valueMap = Object.fromEntries(session.values.map((v) => [v.id, v]));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-surface)" }}>
      <div className="w-full max-w-md mx-auto px-4 py-8 flex-1">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-end mb-2">
            <LocaleSwitcher locale={locale} onChange={setLocale} />
          </div>
          <p className="typo-section-header" style={{ color: "var(--text-muted)" }}>Ranking the Values</p>
          <h1 className="text-2xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>{session.title}</h1>
          {session.description && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{session.description}</p>
          )}
        </div>

        <StepIndicator currentStep={currentStep} locale={locale} />

        {/* Step 1: Identify */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="p-5 rounded-card border space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
              <div>
                <label className="typo-label" style={{ color: "var(--text-muted)" }}>{t(locale, "label.name")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t(locale, "placeholder.name")}
                  className="w-full px-4 py-3 border rounded-button text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="typo-label" style={{ color: "var(--text-muted)" }}>{t(locale, "label.email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t(locale, "placeholder.email")}
                  className="w-full px-4 py-3 border rounded-button text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>
            </div>
            {error && <div className="p-3 rounded-button text-sm" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>{error}</div>}
            <button onClick={handleIdentify} className="btn-primary w-full py-3 rounded-button text-sm font-semibold">
              {t(locale, "btn.next")}
            </button>
          </div>
        )}

        {/* Step 2: Rank */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-card" style={{ background: "var(--primary-light)" }}>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                <strong>{t(locale, "ranking.instructionBold")}</strong> {t(locale, "ranking.instruction")}
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: "var(--success)" }}>{t(locale, "ranking.mostApplicable")}</span>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={order} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5" role="list">
                    {order.map((valueId, index) => {
                      const v = valueMap[valueId];
                      if (!v) return null;
                      return <SortableValueCard key={v.id} value={v} index={index} onShowDetail={setDetailValue} locale={locale} />;
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="flex justify-between mt-2">
                <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>{t(locale, "ranking.leastApplicable")}</span>
              </div>
            </div>

            {error && <div className="p-3 rounded-button text-sm" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>{error}</div>}
            <button onClick={handleSubmitRanking} disabled={submitting} className="btn-primary w-full py-3 rounded-button text-sm font-semibold disabled:opacity-50">
              {submitting ? t(locale, "btn.submitting") : t(locale, "btn.submit")}
            </button>
          </div>
        )}

        {/* Step 3: Match */}
        {currentStep === 3 && (
          <StepMatchContent
            session={session}
            existingSubmission={existingSubmission}
            matchData={matchData}
            matchPromptIndex={matchPromptIndex}
            valueMap={valueMap}
            locale={locale}
            onShowDetail={setDetailValue}
          />
        )}
      </div>

      {/* SUMM logo */}
      <div className="py-6 flex justify-center opacity-30 text-text-muted">
        <SummLogo width={60} height={24} />
      </div>

      {/* Value detail modal */}
      {detailValue && <ValueDetailModal value={detailValue} onClose={() => setDetailValue(null)} locale={locale} culturalLevels={session?.culturalLevels} showBehaviors={session?.showBehaviors} />}
    </div>
  );
}

// ── Step 3 content ──────────────────────────────────────────────────

function StepMatchContent({
  session,
  existingSubmission,
  matchData,
  matchPromptIndex,
  valueMap,
  locale,
  onShowDetail,
}: {
  session: SessionData;
  existingSubmission: { id: string; rankings: string[] } | null;
  matchData: unknown;
  matchPromptIndex: number;
  valueMap: Record<string, RankingValue>;
  locale: Locale;
  onShowDetail: (v: RankingValue) => void;
}) {
  const matchPrompt = MATCH_PROMPTS[locale][matchPromptIndex];

  const readAgainSection = (
    <div>
      <h3 className="typo-card-title mb-3" style={{ color: "var(--text-primary)" }}>{t(locale, "match.readAgain")}</h3>
      <div className="space-y-1.5">
        {session.values.map((v) => (
          <ValueReadAgainCard key={v.id} value={v} onShowDetail={onShowDetail} locale={locale} />
        ))}
      </div>
    </div>
  );

  // Waiting for session to close
  if (session.status !== "closed" && session.status !== "archived") {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "var(--primary-light)" }}>
          <svg className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{t(locale, "match.thanks")}</h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          {t(locale, "match.waiting")}
        </p>
        <div className="p-4 rounded-card" style={{ background: "var(--primary-light)" }}>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            <strong>{t(locale, "match.dontClose")}</strong> {t(locale, "match.autoAppear")}
          </p>
        </div>
      </div>
    );
  }

  // Loading results
  if (!matchData) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const data = matchData as {
    pairs: { participant1: { id: string; participantName: string }; participant2: { id: string; participantName: string }; opposition: number }[];
    unmatched: { id: string; participantName: string } | null;
    bestDuo: { pairParticipant1: string; pairParticipant1Id: string; pairParticipant2: string; pairParticipant2Id: string; avgOpposition: number } | null;
    submissions: { id: string; participantName: string; rankings: string[] }[];
    values: RankingValue[];
  };

  if (!existingSubmission) return null;

  // Determine if I'm part of a trio (either the unmatched person or one of the bestDuo pair)
  const isUnmatched = data.unmatched?.id === existingSubmission.id;
  const isInTrioDuo = data.bestDuo && (
    data.bestDuo.pairParticipant1Id === existingSubmission.id ||
    data.bestDuo.pairParticipant2Id === existingSubmission.id
  );
  const isInTrio = isUnmatched || isInTrioDuo;

  if (isInTrio && data.bestDuo && data.unmatched) {
    // Collect all three trio member IDs
    const trioIds = [data.bestDuo.pairParticipant1Id, data.bestDuo.pairParticipant2Id, data.unmatched.id];
    const otherIds = trioIds.filter((id) => id !== existingSubmission.id);
    const otherSubs = otherIds.map((id) => data.submissions.find((s) => s.id === id)).filter(Boolean) as { id: string; participantName: string; rankings: string[] }[];

    const trioPrompt = TRIO_PROMPTS[locale][matchPromptIndex % TRIO_PROMPTS[locale].length];

    return (
      <div className="space-y-4">
        {/* Trio header */}
        <div className="p-5 rounded-card border text-center" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
          <p className="typo-section-header mb-4" style={{ color: "var(--text-muted)" }}>{t(locale, "match.yourGroup")}</p>
          <div className="flex justify-center mb-4">
            <div className="flex -space-x-3">
              {/* Me */}
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ring-2 ring-white"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                {data.submissions.find((s) => s.id === existingSubmission.id)?.participantName.charAt(0).toUpperCase()}
              </div>
              {/* Other two */}
              {otherSubs.map((s) => (
                <div key={s.id} className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ring-2 ring-white"
                  style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
                  {s.participantName.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            <span className="font-medium">{data.submissions.find((s) => s.id === existingSubmission.id)?.participantName}</span>
            {otherSubs.map((s, i) => (
              <span key={s.id}>
                <span className="mx-1.5" style={{ color: "var(--text-muted)" }}>{i === otherSubs.length - 1 ? "&" : ","}</span>
                <span className="font-medium">{s.participantName}</span>
              </span>
            ))}
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            {t(locale, "match.trioExplain")}
          </p>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>{trioPrompt}</p>
        </div>

        {/* Three-column ranking comparison */}
        {otherSubs.length > 0 && (
          <div className="p-5 rounded-card border" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
            <h3 className="typo-card-title mb-4" style={{ color: "var(--text-primary)" }}>{t(locale, "match.compareTitleTrio")}</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t(locale, "match.you"), rankings: existingSubmission.rankings },
                ...otherSubs.map((s) => ({ label: s.participantName, rankings: s.rankings })),
              ].map(({ label, rankings }) => (
                <div key={label}>
                  <p className="text-xs font-medium mb-2 truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <ol className="space-y-1.5">
                    {rankings.map((valueId, j) => {
                      const v = valueMap[valueId];
                      if (!v) return null;
                      return (
                        <li key={valueId} className="flex items-center gap-1.5 text-xs">
                          <span className="w-3 text-right tabular-nums shrink-0" style={{ color: "var(--text-muted)", fontSize: "10px" }}>{j + 1}.</span>
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

        {readAgainSection}
      </div>
    );
  }

  // Find my match (regular duo)
  const myPair = data.pairs.find(
    (p) => p.participant1.id === existingSubmission.id || p.participant2.id === existingSubmission.id
  );

  if (!myPair) {
    return (
      <div className="text-center py-8">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t(locale, "match.noResult")}</p>
      </div>
    );
  }

  const isMe1 = myPair.participant1.id === existingSubmission.id;
  const partner = isMe1 ? myPair.participant2 : myPair.participant1;
  const partnerSub = data.submissions.find((s) => s.id === partner.id);

  return (
    <div className="space-y-4">
      {/* Match header */}
      <div className="p-5 rounded-card border text-center" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
        <p className="typo-section-header mb-4" style={{ color: "var(--text-muted)" }}>{t(locale, "match.yourMatch")}</p>
        <div className="flex justify-center mb-4">
          <div className="flex -space-x-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ring-2 ring-white"
              style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              {(isMe1 ? myPair.participant1 : myPair.participant2).participantName.charAt(0).toUpperCase()}
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ring-2 ring-white"
              style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
              {partner.participantName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <span className="font-medium">{(isMe1 ? myPair.participant1 : myPair.participant2).participantName}</span>
          <span className="mx-1.5" style={{ color: "var(--text-muted)" }}>&</span>
          <span className="font-medium">{partner.participantName}</span>
        </p>
        <p className="text-xs mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>{matchPrompt}</p>
      </div>

      {/* Side-by-side rankings */}
      {partnerSub && (
        <div className="p-5 rounded-card border" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
          <h3 className="typo-card-title mb-4" style={{ color: "var(--text-primary)" }}>{t(locale, "match.compareTitle")}</h3>
          <div className="grid grid-cols-2 gap-6">
            {[
              { label: t(locale, "match.you"), rankings: existingSubmission.rankings },
              { label: partner.participantName, rankings: partnerSub.rankings },
            ].map(({ label, rankings }) => (
              <div key={label}>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>
                <ol className="space-y-1.5">
                  {rankings.map((valueId, j) => {
                    const v = valueMap[valueId];
                    if (!v) return null;
                    return (
                      <li key={valueId} className="flex items-center gap-2 text-sm">
                        <span className="w-4 text-xs text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{j + 1}.</span>
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                        <span style={{ color: "var(--text-primary)" }}>{v.title}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      {readAgainSection}
    </div>
  );
}
