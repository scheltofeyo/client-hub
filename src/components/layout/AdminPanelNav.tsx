"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Users, LayoutTemplate, Tag, Wrench, Radio } from "lucide-react";

const tabItems = [
  { tab: "users", label: "Users", icon: Users },
  { tab: "templates", label: "Project Templates", icon: LayoutTemplate },
  { tab: "archetypes", label: "Archetypes", icon: Tag },
  { tab: "services", label: "Services", icon: Wrench },
  { tab: "signals", label: "Log Signals", icon: Radio },
];

export default function AdminPanelNav() {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab")?.toLowerCase() ?? "users";
  const activeTab = tabItems.some((t) => t.tab === rawTab) ? rawTab : "users";

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="px-4 pt-5 pb-3 shrink-0">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          Admin
        </span>
      </div>

      <div className="px-2 space-y-0.5">
        {tabItems.map(({ tab, label, icon: Icon }) => {
          const active = activeTab === tab;
          return (
            <Link
              key={tab}
              href={`/admin?tab=${tab}`}
              data-active={active}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors nav-panel-item"
            >
              <Icon size={14} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="mx-3 my-3 border-t" style={{ borderColor: "var(--border)" }} />
    </aside>
  );
}
