"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const tabs = [
  { label: "Archetypes",      value: "archetypes" },
  { label: "Services",        value: "services" },
  { label: "Log Signals",     value: "signals" },
  { label: "Event Types",     value: "event-types" },
  { label: "Client Statuses", value: "client-statuses" },
  { label: "Client Platforms", value: "client-platforms" },
  { label: "Project Labels",  value: "project-labels" },
];

export default function LabelsAndTypesTertiaryNav() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "archetypes";

  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2 overflow-x-auto whitespace-nowrap"
      style={{ borderColor: "var(--border)" }}
    >
      {tabs.map(({ label, value }) => {
        const active = activeTab === value;
        return (
          <Link
            key={value}
            href={`/admin/labels-and-types?tab=${value}`}
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
