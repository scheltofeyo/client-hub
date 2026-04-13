"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SteppedModalProps {
  /** Controls visibility */
  open: boolean;
  /** Called when user clicks backdrop, X button, or presses Escape */
  onClose: () => void;
  /** Bold title displayed in fixed header */
  title: string;
  /** Optional step labels for multi-step flows */
  steps?: string[];
  /** 0-indexed current step */
  currentStep?: number;
  /** Scrollable middle content */
  children: ReactNode;
  /** Fixed footer content (action buttons) */
  footer: ReactNode;
  /** Max width class override, defaults to "max-w-xl" */
  maxWidth?: string;
}

export default function SteppedModal({
  open,
  onClose,
  title,
  steps,
  currentStep = 0,
  children,
  footer,
  maxWidth = "max-w-xl",
}: SteppedModalProps) {
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Animate in
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
    }
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    []
  );

  // Auto-focus first input on open / step change
  useEffect(() => {
    if (!open || !modalRef.current) return;
    const timer = setTimeout(() => {
      const input = modalRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]), textarea, select"
      );
      if (input) {
        input.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [open, currentStep]);

  // Restore focus on close
  useEffect(() => {
    if (!open && previousFocus.current) {
      previousFocus.current.focus();
      previousFocus.current = null;
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          background: "rgba(0, 0, 0, 0.5)",
          opacity: visible ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Centering wrapper */}
      <div className="flex items-center justify-center min-h-full p-4 pointer-events-none">
        {/* Modal card */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`${maxWidth} w-full pointer-events-auto flex flex-col rounded-2xl shadow-2xl transition-all duration-200 ease-out`}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            maxHeight: "calc(100vh - 2rem)",
            opacity: visible ? 1 : 0,
            transform: visible ? "scale(1)" : "scale(0.95)",
          }}
        >
          {/* Fixed header */}
          <div
            className="shrink-0 flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-4 min-w-0">
              <h2
                className="typo-modal-title truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </h2>
              {steps && steps.length > 1 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {steps.map((label, i) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full transition-colors"
                        style={{
                          background:
                            i === currentStep
                              ? "var(--primary)"
                              : i < currentStep
                                ? "var(--primary)"
                                : "var(--border)",
                          opacity: i <= currentStep ? 1 : 0.5,
                        }}
                        title={label}
                      />
                      {i < steps.length - 1 && (
                        <div
                          className="w-4 h-px"
                          style={{
                            background:
                              i < currentStep
                                ? "var(--primary)"
                                : "var(--border)",
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg transition-colors btn-icon"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Step label */}
          {steps && steps.length > 1 && steps[currentStep] && (
            <div
              className="shrink-0 px-6 pt-4 pb-0"
            >
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                Step {currentStep + 1} of {steps.length} — {steps[currentStep]}
              </p>
            </div>
          )}

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {children}
          </div>

          {/* Fixed footer */}
          <div
            className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            {footer}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
