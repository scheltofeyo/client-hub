"use client";

import { Fragment, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

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
  /** When provided, completed steps in the indicator become clickable */
  onStepClick?: (index: number) => void;
  /** Scrollable middle content */
  children: ReactNode;
  /** Fixed footer content (primary action buttons, right-aligned) */
  footer: ReactNode;
  /** Optional left-aligned footer slot (Cancel/Back buttons) */
  footerLeft?: ReactNode;
  /** Max width class override, defaults to "max-w-2xl" */
  maxWidth?: string;
  /** Hide step labels; show compact dots in the footer instead (carousel-style flows) */
  hideStepLabel?: boolean;
}

export default function SteppedModal({
  open,
  onClose,
  title,
  steps,
  currentStep = 0,
  onStepClick,
  children,
  footer,
  footerLeft,
  maxWidth = "max-w-2xl",
  hideStepLabel = false,
}: SteppedModalProps) {
  const [visible, setVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Direction of the last step change, for the enter animation
  const [prevStep, setPrevStep] = useState(currentStep);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");
  if (prevStep !== currentStep) {
    setDirection(currentStep > prevStep ? "fwd" : "back");
    setPrevStep(currentStep);
  }

  // Animate in/out
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      requestAnimationFrame(() => setVisible(false));
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
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
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
            <h2
              className="typo-modal-title truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg transition-colors btn-icon"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Labeled step indicator */}
          {!hideStepLabel && steps && steps.length > 1 && (
            <nav
              aria-label="Progress"
              className="shrink-0 flex items-center gap-2 px-6 pt-4"
            >
              {steps.map((label, i) => {
                const done = i < currentStep;
                const current = i === currentStep;
                const clickable = done && !!onStepClick;
                const inner = (
                  <>
                    <span
                      className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 transition-colors"
                      style={
                        done
                          ? {
                              background: "var(--primary-light)",
                              color: "var(--primary)",
                            }
                          : current
                            ? { background: "var(--primary)", color: "#fff" }
                            : {
                                boxShadow: "inset 0 0 0 1px var(--border)",
                                color: "var(--text-muted)",
                              }
                      }
                    >
                      {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{
                        color: current || done ? "var(--text-primary)" : "var(--text-muted)",
                      }}
                    >
                      {label}
                    </span>
                  </>
                );
                return (
                  <Fragment key={label}>
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => onStepClick(i)}
                        aria-label={`Go back to step ${i + 1}: ${label}`}
                        className="flex items-center gap-2 rounded-lg -mx-1.5 px-1.5 py-1 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        {inner}
                      </button>
                    ) : (
                      <div
                        className="flex items-center gap-2"
                        aria-current={current ? "step" : undefined}
                      >
                        {inner}
                      </div>
                    )}
                    {i < steps.length - 1 && (
                      <div
                        className="h-px w-6 shrink-0 transition-colors"
                        style={{ background: done ? "var(--primary)" : "var(--border)" }}
                      />
                    )}
                  </Fragment>
                );
              })}
            </nav>
          )}

          {/* Scrollable body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {steps && steps.length > 1 ? (
              <div
                key={currentStep}
                className={direction === "fwd" ? "modal-step-fwd" : "modal-step-back"}
              >
                {children}
              </div>
            ) : (
              children
            )}
          </div>

          {/* Fixed footer */}
          <div
            className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            {hideStepLabel && steps && steps.length > 1 ? (
              <div className="flex items-center gap-1.5">
                {steps.map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full transition-colors"
                      style={{
                        background:
                          i <= currentStep ? "var(--primary)" : "var(--border)",
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
            ) : (
              <div className="flex items-center gap-2">{footerLeft}</div>
            )}
            <div className="flex items-center gap-2">{footer}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
