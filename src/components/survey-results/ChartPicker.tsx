"use client";

export interface ChartOption {
  key: string;
  label: string;
}

interface ChartPickerProps {
  options: ChartOption[];
  value: string;
  onChange: (next: string) => void;
}

/**
 * Pill-button group for picking the chart variant of a single question.
 * Sits inline under the question header. Active button = filled with
 * primary-light + primary text. Inactive = bg-elevated with muted text.
 */
export function ChartPicker({ options, value, onChange }: ChartPickerProps) {
  return (
    <div role="tablist" className="inline-flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className="rounded-button border px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              background: active ? "var(--primary-light)" : "var(--bg-surface)",
              borderColor: active ? "var(--primary)" : "var(--border)",
              color: active ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
