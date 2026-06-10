"use client";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * Compact toggle group. Track is a static neutral fill (--bg-neutral, not an
 * interactive tint); the active segment lifts onto a surface pill with the
 * brand accent. Full keyboard + focus states.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 p-0.5 rounded-button"
      style={{ background: "var(--bg-neutral)" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className="px-2.5 py-1 rounded-[0.4rem] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
            style={{
              background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--primary)" : "var(--text-muted)",
              boxShadow: active ? "var(--shadow-subtle)" : "none",
              // ring color via box-shadow fallback handled by Tailwind ring; set ring color token
              ["--tw-ring-color" as string]: "var(--primary)",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
