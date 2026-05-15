"use client";

import { Check, Copy } from "lucide-react";
import type { RefObject } from "react";
import { useCopyChartPng } from "@/lib/copy-chart-png";

interface CopyChartButtonProps {
  chartRef: RefObject<HTMLElement | null>;
  title?: string;
}

export function CopyChartButton({ chartRef, title }: CopyChartButtonProps) {
  const { copy, status } = useCopyChartPng(chartRef);

  const baseLabel = title ? `Kopieer grafiek van "${title}" als PNG` : "Kopieer grafiek als PNG";
  const label =
    status === "copied"
      ? "Gekopieerd"
      : status === "error"
        ? "Kopiëren mislukt"
        : status === "unsupported"
          ? "Kopiëren niet ondersteund in deze browser"
          : baseLabel;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
      disabled={status === "copying"}
      className="btn-icon p-1 rounded-button"
      aria-label={label}
      title={label}
    >
      {status === "copied" ? (
        <Check size={15} aria-hidden="true" />
      ) : (
        <Copy size={15} aria-hidden="true" />
      )}
      <span className="sr-only" aria-live="polite">
        {status === "copied" ? "Gekopieerd" : ""}
      </span>
    </button>
  );
}
