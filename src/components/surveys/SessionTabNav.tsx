"use client";

export type SessionTab = "algemeen" | "results" | "settings";

const TABS: { label: string; value: SessionTab }[] = [
  { label: "Voortgang", value: "algemeen" },
  { label: "Results", value: "results" },
  { label: "Settings", value: "settings" },
];

interface SessionTabNavProps {
  tab: SessionTab;
  onChange: (next: SessionTab) => void;
}

export default function SessionTabNav({ tab, onChange }: SessionTabNavProps) {
  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {TABS.map(({ label, value }) => {
        const active = tab === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: active ? "var(--primary)" : "transparent",
              color: active ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
