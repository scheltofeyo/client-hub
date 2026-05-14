"use client";

export type Locale = "nl" | "en";

export default function LocaleSwitcher({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (l: Locale) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: "var(--bg-hover)" }}>
      {(["nl", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
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
