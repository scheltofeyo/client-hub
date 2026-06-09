"use client";

import { cn } from "@/lib/cn";

export type ArchetypePillSize = "sm" | "md" | "lg";
export type ArchetypePillVariant = "solid" | "soft" | "outline";

export interface ArchetypeLite {
  id: string;
  name: string;
  color: string;
}

export interface ArchetypePillProps {
  archetype: ArchetypeLite;
  /** When true (the default), the dot+name combo is shown; when false, just the colored dot. */
  showName?: boolean;
  /** Visual style. `solid` is the saturated chip; `soft` uses light bg + colored text; `outline` is neutral with a tiny dot. */
  variant?: ArchetypePillVariant;
  size?: ArchetypePillSize;
  /** Optional click handler — turns the pill into a button (used by the template editor archetype toggles). */
  onClick?: () => void;
  /** When `onClick` is set, mark the pill as toggled on/off. Affects styling for `solid` and `outline`. */
  selected?: boolean;
  className?: string;
}

const SIZE_CONFIG: Record<ArchetypePillSize, { padX: string; padY: string; text: string; dot: number }> = {
  sm: { padX: "0.5rem", padY: "0.125rem", text: "10px", dot: 6 },
  md: { padX: "0.75rem", padY: "0.375rem", text: "12px", dot: 8 },
  lg: { padX: "1rem", padY: "0.5rem", text: "13px", dot: 10 },
};

export default function ArchetypePill({
  archetype,
  showName = true,
  variant = "solid",
  size = "md",
  onClick,
  selected,
  className,
}: ArchetypePillProps) {
  const config = SIZE_CONFIG[size];
  const isInteractive = typeof onClick === "function";
  const effectivelyOn = isInteractive ? !!selected : true;

  const styles = ((): React.CSSProperties => {
    if (variant === "solid") {
      return effectivelyOn
        ? { background: archetype.color, color: "#fff", borderColor: archetype.color }
        : { background: "var(--bg-neutral)", color: "var(--text-muted)", borderColor: "var(--border)" };
    }
    if (variant === "soft") {
      return {
        background: `color-mix(in srgb, ${archetype.color} 15%, var(--bg-surface))`,
        color: "var(--text-primary)",
        borderColor: `color-mix(in srgb, ${archetype.color} 30%, var(--border))`,
      };
    }
    // outline
    return {
      background: "var(--bg-surface)",
      color: "var(--text-primary)",
      borderColor: effectivelyOn ? archetype.color : "var(--border)",
    };
  })();

  const dotBg =
    variant === "solid" && effectivelyOn
      ? "rgba(255,255,255,0.9)"
      : archetype.color;

  const content = (
    <>
      <span
        aria-hidden="true"
        className="shrink-0 rounded-full"
        style={{ width: config.dot, height: config.dot, background: dotBg }}
      />
      {showName && <span className="truncate">{archetype.name}</span>}
    </>
  );

  const sharedClass = cn(
    "inline-flex items-center gap-1.5 rounded-badge border font-medium transition-colors",
    className
  );
  const sharedStyle: React.CSSProperties = {
    padding: `${config.padY} ${config.padX}`,
    fontSize: config.text,
    ...styles,
  };

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected ? "true" : "false"}
        aria-label={archetype.name}
        className={sharedClass}
        style={sharedStyle}
      >
        {content}
      </button>
    );
  }
  return (
    <span aria-label={archetype.name} className={sharedClass} style={sharedStyle}>
      {content}
    </span>
  );
}
