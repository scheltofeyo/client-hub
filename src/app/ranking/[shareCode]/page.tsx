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

// ── Locale switcher ────────────────────────────────────────────────

function LocaleSwitcher({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--bg-hover)" }}>
      {(["nl", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className="px-2.5 py-1 rounded-full text-xs font-medium uppercase transition-colors"
          style={{
            background: locale === l ? "var(--bg-surface)" : "transparent",
            color: locale === l ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: locale === l ? "var(--shadow-subtle)" : "none",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
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
          />
        )}
      </div>

      {/* SUMM logo */}
      <div className="py-6 flex justify-center opacity-30">
        <svg width="60" height="24" viewBox="0 0 1359 535" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="SUMM">
          <path d="M539.326 325.462C545.014 325.462 549.717 324.988 553.418 324.04C557.119 323.092 560.09 321.798 562.333 320.157C564.575 318.516 566.125 316.584 566.981 314.342C567.838 312.1 568.276 309.602 568.276 306.85C568.276 300.998 565.523 296.112 559.999 292.247C554.476 288.364 544.996 284.189 531.56 279.705C525.69 277.645 519.839 275.275 513.987 272.595C508.117 269.934 502.866 266.561 498.218 262.514C493.569 258.466 489.777 253.544 486.842 247.784C483.907 242.005 482.449 234.986 482.449 226.709C482.449 218.433 483.998 210.977 487.097 204.341C490.196 197.705 494.59 192.055 500.278 187.406C505.965 182.758 512.856 179.184 520.969 176.669C529.063 174.171 538.196 172.913 548.368 172.913C560.437 172.913 570.864 174.207 579.651 176.796C588.438 179.385 595.675 182.229 601.363 185.328L589.732 217.121C584.737 214.532 579.177 212.253 573.052 210.266C566.927 208.279 559.562 207.295 550.939 207.295C541.277 207.295 534.35 208.626 530.12 211.306C525.891 213.985 523.794 218.069 523.794 223.592C523.794 226.874 524.578 229.626 526.128 231.869C527.677 234.111 529.883 236.135 532.727 237.939C535.571 239.744 538.852 241.385 542.553 242.843C546.254 244.302 550.356 245.815 554.84 247.364C564.156 250.81 572.25 254.219 579.141 257.573C586.032 260.928 591.774 264.866 596.332 269.332C600.889 273.817 604.298 279.067 606.541 285.101C608.783 291.135 609.895 298.463 609.895 307.086C609.895 323.803 604.025 336.783 592.321 346.008C580.599 355.232 562.934 359.844 539.326 359.844C531.396 359.844 524.25 359.369 517.87 358.421C511.489 357.473 505.838 356.307 500.934 354.921C496.03 353.536 491.801 352.078 488.264 350.529C484.727 348.979 481.756 347.52 479.35 346.135L490.725 314.069C496.067 317.004 502.666 319.628 510.505 321.961C518.325 324.313 527.951 325.462 539.326 325.462Z" fill="var(--text-muted)"/>
          <path d="M710.998 359.862C698.42 359.862 687.554 358.094 678.421 354.558C669.288 351.021 661.741 346.117 655.798 339.828C649.855 333.538 645.461 326.046 642.617 317.332C639.774 308.636 638.352 299.011 638.352 288.51V177.069H678.695V285.137C678.695 292.375 679.515 298.537 681.156 303.623C682.796 308.709 685.039 312.847 687.883 316.037C690.726 319.227 694.172 321.506 698.219 322.892C702.266 324.277 706.714 324.952 711.527 324.952C721.353 324.952 729.319 321.944 735.445 315.91C741.57 309.875 744.614 299.63 744.614 285.137V177.069H784.958V288.51C784.958 299.029 783.499 308.672 780.564 317.459C777.629 326.246 773.144 333.794 767.11 340.083C761.076 346.372 753.401 351.239 744.104 354.685C734.788 358.13 723.759 359.862 710.998 359.862Z" fill="var(--text-muted)"/>
          <path d="M871.295 177.051C874.412 182.739 877.985 189.758 882.05 198.125C886.116 206.493 890.345 215.535 894.757 225.27C899.169 235.005 903.526 244.958 907.846 255.131C912.167 265.303 916.232 274.873 920.024 283.824C923.834 274.855 927.881 265.303 932.201 255.131C936.522 244.958 940.879 235.005 945.29 225.27C949.702 215.535 953.932 206.475 957.997 198.125C962.062 189.758 965.653 182.739 968.753 177.051H1005.49C1007.2 188.937 1008.8 202.264 1010.26 216.994C1011.72 231.723 1013.02 247.073 1014.15 263.024C1015.26 278.976 1016.3 294.963 1017.24 310.987C1018.19 327.011 1019.01 342.106 1019.71 356.234H980.402C979.891 338.825 979.198 319.865 978.342 299.356C977.485 278.847 976.19 258.156 974.459 237.301C971.341 244.538 967.877 252.56 964.086 261.346C960.276 270.133 956.52 278.921 952.801 287.726C949.082 296.513 945.491 304.917 942.046 312.938C938.582 320.959 935.647 327.813 933.222 333.501H905.039C902.614 327.813 899.679 320.959 896.215 312.938C892.752 304.917 889.16 296.513 885.441 287.726C881.722 278.939 877.967 270.152 874.157 261.346C870.347 252.56 866.901 244.538 863.784 237.301C862.052 258.156 860.758 278.847 859.901 299.356C859.044 319.865 858.351 338.825 857.841 356.234H818.537C819.23 342.106 820.05 327.011 820.998 310.987C821.946 294.963 822.985 278.976 824.097 263.024C825.209 247.091 826.504 231.742 827.98 216.994C829.439 202.264 831.043 188.937 832.757 177.051H871.295Z" fill="var(--text-muted)"/>
          <path d="M1103.22 177.051C1106.33 182.739 1109.91 189.758 1113.97 198.125C1118.04 206.493 1122.27 215.535 1126.68 225.27C1131.09 235.005 1135.45 244.958 1139.77 255.131C1144.09 265.303 1148.15 274.873 1151.95 283.824C1155.76 274.855 1159.8 265.303 1164.12 255.131C1168.44 244.958 1172.8 235.005 1177.21 225.27C1181.62 215.535 1185.85 206.475 1189.92 198.125C1193.98 189.758 1197.56 182.739 1200.68 177.051H1237.39C1239.1 188.937 1240.71 202.264 1242.17 216.994C1243.63 231.723 1244.92 247.073 1246.05 263.024C1247.16 278.976 1248.2 294.963 1249.15 310.987C1250.1 327.011 1250.92 342.106 1251.61 356.234H1212.31C1211.8 338.825 1211.1 319.865 1210.25 299.356C1209.39 278.847 1208.09 258.156 1206.36 237.301C1203.25 244.538 1199.78 252.56 1195.99 261.346C1192.18 270.133 1188.42 278.921 1184.71 287.726C1180.99 296.513 1177.4 304.917 1173.95 312.938C1170.49 320.959 1167.55 327.813 1165.13 333.501H1136.94C1134.52 327.813 1131.58 320.959 1128.12 312.938C1124.66 304.917 1121.06 296.513 1117.35 287.726C1113.63 278.939 1109.87 270.152 1106.06 261.346C1102.25 252.56 1098.81 244.538 1095.69 237.301C1093.96 258.156 1092.66 278.847 1091.81 299.356C1090.95 319.865 1090.26 338.825 1089.75 356.234H1050.44C1051.13 342.106 1051.95 327.011 1052.9 310.987C1053.85 294.963 1054.89 278.976 1056 263.024C1057.11 247.091 1058.41 231.742 1059.88 216.994C1061.34 202.264 1062.95 188.937 1064.66 177.051H1103.22Z" fill="var(--text-muted)"/>
          <path d="M252.875 275.822H158.516L125.228 309.109C99.2507 335.087 99.2689 377.18 125.228 403.158C151.188 429.117 193.299 429.136 219.277 403.158L252.893 369.542V275.822H252.875Z" fill="#402D9B"/>
          <path d="M350.77 134.229C362.437 134.229 373.412 138.768 381.67 147.026C398.715 164.071 398.715 191.782 381.67 208.827L355.364 235.132H293.254V173.642L319.87 147.026C328.128 138.768 339.103 134.229 350.77 134.229ZM350.77 111.423C333.743 111.423 316.735 117.914 303.755 130.893L270.467 167.554V257.92H360.979L397.804 224.942C423.781 198.964 423.763 156.871 397.804 130.893C384.806 117.914 367.797 111.423 350.77 111.423Z" fill="#402D9B"/>
          <path d="M397.786 403.304C423.764 377.326 423.746 335.233 397.786 309.256C397.786 309.256 362.11 276.278 360.961 276.278H270.449V369.542L303.737 403.304C329.715 429.282 371.826 429.282 397.786 403.304Z" fill="#9381EA"/>
          <path d="M252.876 258.084V167.571C252.876 166.605 219.26 130.747 219.26 130.747C193.3 104.769 151.189 104.769 125.211 130.747C99.2513 156.725 99.2331 198.818 125.211 224.795L158.499 258.084H252.876Z" fill="#6F3FF3"/>
        </svg>
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
}: {
  session: SessionData;
  existingSubmission: { id: string; rankings: string[] } | null;
  matchData: unknown;
  matchPromptIndex: number;
  valueMap: Record<string, RankingValue>;
  locale: Locale;
}) {
  const matchPrompt = MATCH_PROMPTS[locale][matchPromptIndex];

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
    </div>
  );
}
