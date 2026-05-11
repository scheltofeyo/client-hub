"use client";

import { useState } from "react";
import SteppedModal from "./SteppedModal";
import type { ReleaseNote } from "@/types";

interface WhatsNewModalProps {
  open: boolean;
  onClose: () => void;
  releaseNote: ReleaseNote;
}

// Different gradient per step so the three screens feel visually distinct
// even without illustrations. All values reference CSS custom properties so
// dark mode works automatically.
const STEP_GRADIENTS = [
  "linear-gradient(135deg, var(--primary) 0%, var(--accent-3) 100%)",
  "linear-gradient(135deg, var(--accent-1) 0%, var(--accent-5) 100%)",
  "linear-gradient(135deg, var(--accent-4) 0%, var(--primary) 100%)",
];

export default function WhatsNewModal({ open, onClose, releaseNote }: WhatsNewModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setCurrentStep(0);
  }

  if (!releaseNote.whatsNew) return null;

  const steps = releaseNote.whatsNew.steps;
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;
  const step = steps[currentStep];
  const gradient = STEP_GRADIENTS[currentStep % STEP_GRADIENTS.length];

  const footer = (
    <>
      {isFirst ? (
        <button type="button" onClick={onClose} className="btn-ghost">
          Overslaan
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          className="btn-ghost"
        >
          Terug
        </button>
      )}
      {isLast ? (
        <button type="button" onClick={onClose} className="btn-primary">
          Klaar
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
          className="btn-primary"
        >
          Volgende
        </button>
      )}
    </>
  );

  return (
    <SteppedModal
      open={open}
      onClose={onClose}
      title={releaseNote.whatsNew.title ?? releaseNote.title}
      steps={steps.map((s) => s.title)}
      currentStep={currentStep}
      footer={footer}
      maxWidth="max-w-2xl"
      hideStepLabel
    >
      <div className="flex flex-col gap-6">
        <div
          className="h-64 rounded-2xl relative overflow-hidden"
          style={{ background: gradient }}
          aria-hidden="true"
        >
          {/* Subtle spotlight overlay for depth */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 60%)",
            }}
          />
        </div>
        <div>
          <h3
            className="text-xl font-semibold leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            {step.title}
          </h3>
          <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {step.description}
          </p>
        </div>
      </div>
    </SteppedModal>
  );
}
