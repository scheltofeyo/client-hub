"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ClipboardPaste } from "lucide-react";
import { useRightPanel } from "@/components/layout/RightPanel";
import BehaviorDisplay from "@/components/ui/BehaviorDisplay";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { parseCulturalDnaTsv } from "@/lib/ranking/parseTsv";
import type { CulturalDnaValue, CulturalBehavior } from "@/types";

interface ContentTabProps {
  clientId: string;
  initialDna: CulturalDnaValue[];
  initialLevels: string[];
  canEdit: boolean;
}

/** Darken a hex color by a factor (0–1, where 0 = same, 1 = black) */
function darkenColor(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - factor));
  const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - factor));
  const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - factor));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Lighten a hex color by mixing with white */
function lightenColor(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) + (255 - parseInt(h.substring(0, 2), 16)) * factor);
  const g = Math.round(parseInt(h.substring(2, 4), 16) + (255 - parseInt(h.substring(2, 4), 16)) * factor);
  const b = Math.round(parseInt(h.substring(4, 6), 16) + (255 - parseInt(h.substring(4, 6), 16)) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Relative luminance (WCAG formula) — returns 0 (black) to 1 (white) */
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

/** True when light-colored text would be more readable on this background */
function shouldUseLightText(hex: string): boolean {
  return relativeLuminance(hex) < 0.4;
}

export default function ContentTab({ clientId, initialDna, initialLevels, canEdit }: ContentTabProps) {
  const [dna, setDna] = useState<CulturalDnaValue[]>(initialDna);
  const [levels, setLevels] = useState<string[]>(initialLevels);
  const [saving, setSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    initialDna.length > 0 ? Math.floor(Math.random() * initialDna.length) : 0
  );
  const [detailValue, setDetailValue] = useState<CulturalDnaValue | null>(null);
  const [showImport, setShowImport] = useState(false);
  const { openPanel, closePanel } = useRightPanel();

  async function saveDna(updated: CulturalDnaValue[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ culturalDna: updated }),
      });
      if (res.ok) setDna(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleImportConfirm(values: CulturalDnaValue[], newLevels: string[]) {
    setSaving(true);
    try {
      const merged = [...dna, ...values];
      const body: Record<string, unknown> = { culturalDna: merged };
      // Update levels if they changed
      if (newLevels.length > 0 && JSON.stringify(newLevels) !== JSON.stringify(levels)) {
        body.culturalLevels = newLevels;
      }
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDna(merged);
        if (body.culturalLevels) setLevels(newLevels);
      }
    } finally {
      setSaving(false);
      setShowImport(false);
    }
  }

  function handleAdd() {
    openPanel(
      "Add value",
      <DnaValueForm
        culturalLevels={levels}
        onSave={(value) => {
          saveDna([...dna, value]);
          closePanel();
        }}
        onCancel={closePanel}
      />
    );
  }

  function handleEdit(value: CulturalDnaValue) {
    openPanel(
      "Edit value",
      <DnaValueForm
        initial={value}
        culturalLevels={levels}
        onSave={(updated) => {
          saveDna(dna.map((v) => (v.id === updated.id ? updated : v)));
          closePanel();
        }}
        onCancel={closePanel}
        onDelete={() => {
          handleDelete(value.id);
          closePanel();
        }}
      />
    );
  }

  function handleDelete(id: string) {
    const updated = dna.filter((v) => v.id !== id);
    saveDna(updated);
    if (activeIndex >= updated.length && updated.length > 0) {
      setActiveIndex(updated.length - 1);
    }
  }

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i + 1) % dna.length);
  }, [dna.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + dna.length) % dna.length);
  }, [dna.length]);

  if (dna.length === 0) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "var(--primary-light)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 15c6.667-6 13.333 0 20-6" />
              <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
              <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
              <path d="M17 6l-2.5-2.5" />
              <path d="M14 8l-1-1" />
              <path d="M7 18l2.5 2.5" />
              <path d="M10 16l1 1" />
            </svg>
          </div>
          <h3 className="typo-section-title" style={{ color: "var(--text-primary)" }}>
            No cultural DNA
          </h3>
          <p className="text-sm mt-1 max-w-xs" style={{ color: "var(--text-muted)" }}>
            Add this company&#39;s core values to use them in workshops and tools.
          </p>
          {canEdit && (
            <div className="flex items-center gap-2 mt-4">
              <button onClick={handleAdd} className="btn-primary rounded-lg text-sm px-4 py-2 inline-flex items-center gap-1.5">
                <Plus size={14} />
                Add value
              </button>
              <button onClick={() => setShowImport(true)} className="btn-secondary border rounded-lg text-sm px-4 py-2 inline-flex items-center gap-1.5">
                <ClipboardPaste size={14} />
                Import
              </button>
            </div>
          )}
        </div>

        {/* Import modal */}
        {showImport && (
          <ImportDnaModal
            existingLevels={levels}
            onConfirm={handleImportConfirm}
            onClose={() => setShowImport(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>
          Cultural DNA
        </h2>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)} disabled={saving} className="flex items-center gap-1.5 text-sm py-1.5 px-2 rounded-lg btn-tertiary">
              <ClipboardPaste size={14} />
              Import
            </button>
            <button onClick={handleAdd} disabled={saving} className="flex items-center gap-1.5 text-sm py-1.5 px-2 rounded-lg btn-tertiary">
              <Plus size={14} />
              Add value
            </button>
          </div>
        )}
      </div>

      {/* Carousel */}
      <DnaCarousel
        dna={dna}
        levels={levels}
        activeIndex={activeIndex}
        canEdit={canEdit}
        onNext={goNext}
        onPrev={goPrev}
        onDotClick={setActiveIndex}
        onEdit={handleEdit}
        onShowDetail={setDetailValue}
      />

      {/* Import modal */}
      {showImport && (
        <ImportDnaModal
          existingLevels={levels}
          onConfirm={handleImportConfirm}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Detail modal */}
      {detailValue && (
        <DnaDetailModal
          value={detailValue}
          levels={levels}
          onClose={() => setDetailValue(null)}
        />
      )}
    </div>
  );
}

// ── DNA carousel ────────────────────────────────────────────────────

function DnaCarousel({
  dna,
  levels,
  activeIndex,
  canEdit,
  onNext,
  onPrev,
  onDotClick,
  onEdit,
  onShowDetail,
}: {
  dna: CulturalDnaValue[];
  levels: string[];
  activeIndex: number;
  canEdit: boolean;
  onNext: () => void;
  onPrev: () => void;
  onDotClick: (i: number) => void;
  onEdit: (value: CulturalDnaValue) => void;
  onShowDetail: (value: CulturalDnaValue) => void;
}) {
  const total = dna.length;

  // Show up to 4 cards behind the active one
  const visibleCards: { value: CulturalDnaValue; offset: number }[] = [];
  const maxBehind = Math.min(4, total - 1);
  for (let offset = maxBehind; offset >= 0; offset--) {
    const idx = (activeIndex + offset) % total;
    visibleCards.push({ value: dna[idx], offset });
  }

  const cardHeight = 360;

  return (
    <div className="flex flex-col items-center">
      {/* Card stack container */}
      <div className="relative w-full max-w-sm mx-auto" style={{ height: cardHeight }}>
        {visibleCards.map(({ value, offset }) => {
          const translateX = offset * 18;
          const translateY = offset * -4;
          const rotate = offset * 3;
          const scale = 1 - offset * 0.04;
          const zIndex = 10 - offset;
          const opacity = offset === 0 ? 1 : Math.max(0.3, 1 - offset * 0.2);

          return (
            <div
              key={value.id}
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{
                transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`,
                zIndex,
                opacity,
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                transformOrigin: "bottom left",
              }}
            >
              <DnaCardFull
                value={value}
                levels={levels}
                canEdit={canEdit && offset === 0}
                onEdit={() => onEdit(value)}
                onShowDetail={() => onShowDetail(value)}
              />
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      {total > 1 && (
        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={onPrev}
            className="btn-icon p-1.5 rounded-full"
            aria-label="Previous value"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-1.5">
            {dna.map((_, i) => (
              <button
                key={i}
                onClick={() => onDotClick(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === activeIndex ? 20 : 8,
                  height: 8,
                  backgroundColor: i === activeIndex ? dna[activeIndex].color : "var(--border-strong)",
                  opacity: i === activeIndex ? 1 : 0.4,
                }}
                aria-label={`Go to value ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={onNext}
            className="btn-icon p-1.5 rounded-full"
            aria-label="Next value"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Full-color DNA card ─────────────────────────────────────────────

function DnaCardFull({
  value,
  levels,
  canEdit,
  onEdit,
  onShowDetail,
}: {
  value: CulturalDnaValue;
  levels: string[];
  canEdit: boolean;
  onEdit: () => void;
  onShowDetail: () => void;
}) {
  const bg = value.color;
  const bgDark = darkenColor(bg, 0.15);
  const bgLight = lightenColor(bg, 0.15);
  const lightText = shouldUseLightText(bg);
  const textColor = lightText ? "#ffffff" : darkenColor(bg, 0.75);
  const textMuted = lightText ? "rgba(255, 255, 255, 0.75)" : darkenColor(bg, 0.55);
  const badgeBg = lightText ? darkenColor(bg, 0.2) : "rgba(0, 0, 0, 0.1)";
  const editBg = lightText ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)";

  const hasBehaviorContent = levels.length > 0 && value.behaviors && value.behaviors.some((b) => b.content.trim());

  return (
    <div
      className={`w-full h-full flex flex-col justify-between p-6 relative group${hasBehaviorContent ? " cursor-pointer" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${bgLight} 0%, ${bg} 40%, ${bgDark} 100%)`,
        color: textColor,
        borderRadius: 16,
      }}
      onClick={() => { if (hasBehaviorContent) onShowDetail(); }}
    >
      {/* Title label at top */}
      <div className="text-center">
        <span
          className="inline-block px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: badgeBg,
            color: textColor,
          }}
        >
          {value.title}
        </span>
      </div>

      {/* Mantra */}
      <div className="flex-1 flex items-center justify-center text-center py-4">
        <h3
          className="text-2xl font-bold leading-snug"
          style={{ color: textColor }}
        >
          {value.mantra || value.title}
        </h3>
      </div>

      {/* Description */}
      {value.description && (
        <p
          className="text-sm leading-relaxed text-center"
          style={{ color: textMuted }}
        >
          {value.description}
        </p>
      )}

      {/* Edit button */}
      {canEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: editBg }}
          aria-label="Edit"
        >
          <Pencil size={14} color={textColor} />
        </button>
      )}
    </div>
  );
}

// ── Detail modal (shows behaviors) ──────────────────────────────────

function DnaDetailModal({
  value,
  levels,
  onClose,
}: {
  value: CulturalDnaValue;
  levels: string[];
  onClose: () => void;
}) {
  const bg = value.color;
  const lightText = shouldUseLightText(bg);
  const textColor = lightText ? "#ffffff" : darkenColor(bg, 0.75);
  const textMuted = lightText ? "rgba(255, 255, 255, 0.75)" : darkenColor(bg, 0.55);
  const badgeBg = lightText ? darkenColor(bg, 0.2) : "rgba(0, 0, 0, 0.1)";

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-md overflow-hidden shadow-dropdown flex flex-col"
        style={{
          background: `linear-gradient(135deg, ${lightenColor(bg, 0.15)} 0%, ${bg} 40%, ${darkenColor(bg, 0.15)} 100%)`,
          borderRadius: 16,
          minHeight: 320,
          maxHeight: "85vh",
        }}
      >
        <div className="flex-1 overflow-y-auto">
          {/* Title label */}
          <div className="px-6 pt-6">
            <span
              className="inline-block px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider"
              style={{ backgroundColor: badgeBg, color: textColor }}
            >
              {value.title}
            </span>
          </div>

          {/* Mantra */}
          <div className="px-6 py-4">
            <h3 className="text-2xl font-bold leading-snug" style={{ color: textColor }}>
              {value.mantra || value.title}
            </h3>
          </div>

          {/* Description */}
          {value.description && (
            <div className="px-6 pb-2">
              <p className="text-sm leading-relaxed" style={{ color: textMuted }}>
                {value.description}
              </p>
            </div>
          )}

          {/* Behavior examples */}
          {value.behaviors && value.behaviors.length > 0 && (
            <div className="px-6 pb-2">
              <BehaviorDisplay
                levels={levels}
                behaviors={value.behaviors}
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
            style={{ backgroundColor: lightText ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)", color: textColor }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import DNA modal ────────────────────────────────────────────────

function ImportDnaModal({
  existingLevels,
  onConfirm,
  onClose,
}: {
  existingLevels: string[];
  onConfirm: (values: CulturalDnaValue[], levels: string[]) => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseCulturalDnaTsv> | null>(null);
  const [editedLevels, setEditedLevels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);

  function updateValueColor(id: string, color: string) {
    if (!parsed) return;
    setParsed({
      ...parsed,
      values: parsed.values.map((v) => (v.id === id ? { ...v, color } : v)),
    });
  }

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  function handleParse() {
    setError(null);
    const result = parseCulturalDnaTsv(raw);
    if (result.values.length === 0) {
      setError("No values found. Paste tab-separated content with columns: Title, Mantra, Description, [Levels...]");
      return;
    }
    setParsed(result);
    // If client already has levels, keep those + add new ones if the TSV has more columns
    if (existingLevels.length > 0 && result.levels.length > existingLevels.length) {
      const merged = [
        ...existingLevels,
        ...result.levels.slice(existingLevels.length),
      ];
      setEditedLevels(merged);
    } else if (existingLevels.length > 0) {
      setEditedLevels(existingLevels);
    } else {
      setEditedLevels(result.levels);
    }
  }

  function handleConfirm() {
    if (!parsed) return;
    // Remap behavior levels to the edited level names
    const values = parsed.values.map((v) => ({
      ...v,
      behaviors: v.behaviors?.map((b) => ({
        ...b,
        level: editedLevels[parsed.levels.indexOf(b.level)] ?? b.level,
      })),
    }));
    onConfirm(values, editedLevels);
  }

  function updateLevel(idx: number, name: string) {
    setEditedLevels((prev) => prev.map((l, i) => (i === idx ? name : l)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-2xl rounded-card shadow-dropdown flex flex-col"
        style={{ background: "var(--bg-surface)", maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="typo-modal-title" style={{ color: "var(--text-primary)" }}>
            Import from spreadsheet
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Paste tab-separated content (TSV) from Google Sheets. Columns: Title, Mantra, Description, then one column per behavior level.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!parsed ? (
            <>
              {/* Paste area */}
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={"Creativity\tWe think outside the box\tWe encourage imaginative approaches...\t\"- Bullet 1\\n- Bullet 2\"\t..."}
                rows={10}
                autoFocus
                className="w-full px-3 py-2 rounded-button border text-sm font-mono resize-none"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                }}
              />
              {error && (
                <div className="p-3 rounded-button text-sm" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Preview */}
              <div className="p-3 rounded-card border" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="typo-section-header" style={{ color: "var(--text-muted)" }}>
                    {parsed.values.length} values found
                  </span>
                  {parsed.hasHeader && (
                    <span className="px-2 py-0.5 rounded-badge text-[10px] font-medium" style={{ background: "var(--info-light)", color: "var(--info)" }}>
                      Column names detected
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {parsed.values.map((v) => (
                    <div key={v.id} className="relative flex items-center gap-2.5 px-3 py-2 rounded-button" style={{ background: "var(--bg-surface)" }}>
                      <button
                        type="button"
                        onClick={() => setColorPickerId(colorPickerId === v.id ? null : v.id)}
                        className="w-5 h-5 rounded-full shrink-0 border-2 transition-transform hover:scale-110 cursor-pointer"
                        style={{
                          backgroundColor: v.color,
                          borderColor: colorPickerId === v.id ? "var(--text-primary)" : "transparent",
                        }}
                      />
                      {colorPickerId === v.id && (
                        <div className="absolute left-8 top-0 z-50">
                          <ColorPickerPopover
                            color={v.color}
                            onChange={(c) => updateValueColor(v.id, c)}
                            onClose={() => setColorPickerId(null)}
                          />
                        </div>
                      )}
                      <span className="text-sm font-medium min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                        {v.title}
                      </span>
                      {v.mantra && (
                        <span className="text-xs truncate max-w-[200px]" style={{ color: "var(--text-muted)" }}>
                          {v.mantra}
                        </span>
                      )}
                      {(v.behaviors?.length ?? 0) > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-badge shrink-0" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                          {v.behaviors!.length} levels
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Level name editor */}
              {editedLevels.length > 0 && (
                <div>
                  <label className="typo-label" style={{ color: "var(--text-muted)" }}>
                    Behavior levels
                    {existingLevels.length > 0 && editedLevels.length > existingLevels.length && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-badge font-normal" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
                        {editedLevels.length - existingLevels.length} new
                      </span>
                    )}
                  </label>
                  <div className="space-y-2">
                    {editedLevels.map((level, idx) => {
                      const isExisting = idx < existingLevels.length && existingLevels[idx] === level;
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs font-mono w-5 text-right shrink-0" style={{ color: "var(--text-muted)" }}>
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={level}
                            onChange={(e) => updateLevel(idx, e.target.value)}
                            disabled={isExisting}
                            className="flex-1 px-3 py-1.5 rounded-button border text-sm"
                            style={{
                              borderColor: "var(--border)",
                              background: isExisting ? "var(--bg-hover)" : "var(--bg-surface)",
                              color: "var(--text-primary)",
                              opacity: isExisting ? 0.7 : 1,
                            }}
                          />
                          {isExisting && (
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>existing</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--border)" }}>
          {parsed && (
            <button
              onClick={() => { setParsed(null); setError(null); }}
              className="btn-ghost rounded-lg px-4 py-2 text-sm mr-auto"
            >
              Back
            </button>
          )}
          <button onClick={onClose} className="btn-ghost rounded-lg px-4 py-2 text-sm">
            Cancel
          </button>
          {!parsed ? (
            <button
              onClick={handleParse}
              disabled={!raw.trim()}
              className="btn-primary rounded-lg px-4 py-2 text-sm"
            >
              Process
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={editedLevels.some((l) => !l.trim())}
              className="btn-primary rounded-lg px-4 py-2 text-sm"
            >
              Import {parsed.values.length} values
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Color picker popover ───────────────────────────────────────────

const DEFAULT_COLOR = "#7C5CFC";

function ColorPickerPopover({
  color,
  onChange,
  onClose,
}: {
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  const [hexInput, setHexInput] = useState(color.replace("#", ""));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function applyHex(val: string) {
    const clean = val.replace("#", "").slice(0, 6);
    setHexInput(clean);
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      onChange(`#${clean}`);
    }
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 p-3 rounded-card shadow-dropdown border"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)", width: 220 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>#</span>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => applyHex(e.target.value)}
          onBlur={() => { if (!/^[0-9a-fA-F]{6}$/.test(hexInput)) setHexInput(color.replace("#", "")); }}
          maxLength={6}
          className="flex-1 px-2 py-1 rounded-button border text-xs font-mono"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
          }}
          placeholder="7C5CFC"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => { onChange(e.target.value); setHexInput(e.target.value.replace("#", "")); }}
          className="w-6 h-6 rounded-full shrink-0 cursor-pointer border-0 p-0"
          style={{ backgroundColor: "transparent" }}
          title="Pick a colour"
        />
      </div>
    </div>
  );
}

// ── DNA value form (right panel) ────────────────────────────────────

function DnaValueForm({
  initial,
  culturalLevels,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: CulturalDnaValue;
  culturalLevels: string[];
  onSave: (value: CulturalDnaValue) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR);
  const [hexInput, setHexInput] = useState((initial?.color ?? DEFAULT_COLOR).replace("#", ""));
  const [mantra, setMantra] = useState(initial?.mantra ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  // Initialize behaviors from existing data or create empty ones for each level
  const [behaviors, setBehaviors] = useState<CulturalBehavior[]>(() => {
    return culturalLevels.map((level) => {
      const existing = initial?.behaviors?.find((b) => b.level === level);
      return { level, content: existing?.content ?? "" };
    });
  });
  const [activeBehaviorTab, setActiveBehaviorTab] = useState(culturalLevels[0] ?? "");

  function updateBehavior(level: string, content: string) {
    setBehaviors((prev) =>
      prev.map((b) => (b.level === level ? { ...b, content } : b))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      color,
      mantra: mantra.trim(),
      description: description.trim(),
      behaviors: behaviors.filter((b) => b.content.trim()),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        {/* Color */}
        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Color</label>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>#</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => {
                const clean = e.target.value.replace("#", "").slice(0, 6);
                setHexInput(clean);
                if (/^[0-9a-fA-F]{6}$/.test(clean)) setColor(`#${clean}`);
              }}
              onBlur={() => { if (!/^[0-9a-fA-F]{6}$/.test(hexInput)) setHexInput(color.replace("#", "")); }}
              maxLength={6}
              className="w-20 px-2 py-1 rounded-button border text-xs font-mono"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
              }}
              placeholder="7C5CFC"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); setHexInput(e.target.value.replace("#", "")); }}
              className="w-6 h-6 rounded-full shrink-0 cursor-pointer border-0 p-0"
              style={{ backgroundColor: "transparent" }}
              title="Pick a colour"
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Ownership"
            className="w-full px-3 py-2 rounded-button border text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Mantra */}
        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Mantra</label>
          <input
            type="text"
            value={mantra}
            onChange={(e) => setMantra(e.target.value)}
            placeholder="Short tagline"
            className="w-full px-3 py-2 rounded-button border text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Description */}
        <div>
          <label className="typo-label" style={{ color: "var(--text-muted)" }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this value mean for the company?"
            rows={3}
            className="w-full px-3 py-2 rounded-button border text-sm resize-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Behavior editors per level */}
        {culturalLevels.length > 0 && (
          <div>
            <label className="typo-label" style={{ color: "var(--text-muted)" }}>Behavior examples</label>
            {/* Level tabs */}
            <div className="flex gap-1 mb-2">
              {culturalLevels.map((level) => {
                const isActive = level === activeBehaviorTab;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setActiveBehaviorTab(level)}
                    className="px-2.5 py-1 rounded-button text-xs font-medium transition-colors"
                    style={{
                      background: isActive ? "var(--primary-light)" : "var(--bg-hover)",
                      color: isActive ? "var(--primary)" : "var(--text-muted)",
                    }}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
            {/* Active editor */}
            {culturalLevels.map((level) => (
              <div key={level} style={{ display: level === activeBehaviorTab ? "block" : "none" }}>
                <RichTextEditor
                  content={behaviors.find((b) => b.level === level)?.content ?? ""}
                  onChange={(html) => updateBehavior(level, html)}
                  placeholder={`Behavior examples for ${level}...`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="btn-icon p-2 rounded-lg hover:!text-[var(--danger)] hover:!bg-[var(--danger-light)]"
            aria-label="Delete"
          >
            <Trash2 size={16} />
          </button>
        )}
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="btn-ghost rounded-lg px-4 py-2 text-sm">
          Cancel
        </button>
        <button type="submit" disabled={!title.trim()} className="btn-primary rounded-lg px-4 py-2 text-sm">
          {initial ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}
