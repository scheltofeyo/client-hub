"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const tabs = [
  { label: "Calendar", value: "calendar" },
  { label: "Balances", value: "balances" },
];

export default function TeamTertiaryNav({ permissions }: { permissions: string[] }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "calendar";

  const visibleTabs = tabs.filter((t) => {
    if (t.value === "balances") return permissions.includes("team.viewBalances");
    return true;
  });

  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {visibleTabs.map(({ label, value }) => {
        const active = tab === value;
        return (
          <Link
            key={value}
            href={`/team?tab=${value}`}
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
