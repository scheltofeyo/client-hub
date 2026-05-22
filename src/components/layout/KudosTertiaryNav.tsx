"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const tabs = [
  { label: "Feed", value: "feed" },
  { label: "Dashboard", value: "dashboard" },
];

export default function KudosTertiaryNav() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "feed";

  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {tabs.map(({ label, value }) => {
        const active = tab === value;
        return (
          <Link
            key={value}
            href={`/tools/kudos?tab=${value}`}
            className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: active ? "var(--primary)" : "transparent",
              color:       active ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
