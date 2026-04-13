"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Permission } from "@/lib/permissions";

const tabs: { label: string; value: string; requires: Permission }[] = [
  { label: "Archetypes",       value: "archetypes",       requires: "admin.archetypes" },
  { label: "Services",         value: "services",         requires: "admin.services" },
  { label: "Log Signals",      value: "signals",          requires: "admin.logSignals" },
  { label: "Event Types",      value: "event-types",      requires: "admin.eventTypes" },
  { label: "Client Statuses",  value: "client-statuses",  requires: "admin.clientStatuses" },
  { label: "Client Platforms",  value: "client-platforms",  requires: "admin.clientPlatforms" },
  { label: "Project Labels",   value: "project-labels",   requires: "admin.projectLabels" },
  { label: "Leave Types",      value: "leave-types",      requires: "admin.leaveTypes" },
  { label: "Company Holidays", value: "company-holidays",  requires: "admin.companyHolidays" },
];

export default function LabelsAndTypesTertiaryNav({ permissions = [] }: { permissions?: string[] }) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "archetypes";

  const visibleTabs = tabs.filter((t) => permissions.includes(t.requires));

  return (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2 overflow-x-auto whitespace-nowrap"
      style={{ borderColor: "var(--border)" }}
    >
      {visibleTabs.map(({ label, value }) => {
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
