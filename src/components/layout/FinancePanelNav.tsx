"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp } from "lucide-react";

const navItems = [{ href: "/finance", label: "Omzet", icon: TrendingUp }];

export default function FinancePanelNav() {
  const pathname = usePathname();

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Section header */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          Finance
        </span>
      </div>

      {/* Section nav */}
      <div className="px-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              data-active={active}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors nav-panel-item"
            >
              <Icon size={14} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 my-3 border-t" style={{ borderColor: "var(--border)" }} />
    </aside>
  );
}
