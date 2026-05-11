"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { ReleaseNote } from "@/types";

interface WhatsNewPopupProps {
  open: boolean;
  releaseNote: ReleaseNote;
  onClose: () => void;
  onShowMore: () => void;
}

export default function WhatsNewPopup({ open, releaseNote, onClose, onShowMore }: WhatsNewPopupProps) {
  const [visible, setVisible] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setVisible(false);
  }

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="What's new in SUMM Hub"
      className="fixed bottom-6 right-6 z-40 w-[420px] rounded-2xl border overflow-hidden transition-all duration-300 ease-out"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
      }}
    >
      {/* Gradient header strip — decorative, no image */}
      <div
        className="h-32 relative"
        style={{
          background:
            "linear-gradient(135deg, var(--primary) 0%, var(--accent-3) 100%)",
        }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 25% 30%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 60%)",
          }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluit popup"
          className="absolute top-2.5 right-2.5 p-1.5 rounded-md transition-colors"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-1.5 mb-2.5" style={{ color: "var(--primary)" }}>
          <Sparkles size={14} />
          <span className="typo-tag">What&apos;s new in SUMM Hub</span>
        </div>
        <p className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
          {releaseNote.whatsNew?.title ?? releaseNote.title}
        </p>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-muted)" }}>
          Drie nieuwe dingen waar je werk een stuk leuker van wordt — even kijken?
        </p>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Sluit
          </button>
          <button type="button" onClick={onShowMore} className="btn-primary">
            Toon meer
          </button>
        </div>
      </div>
    </div>
  );
}
