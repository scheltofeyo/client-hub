"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, Search } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/tasks", label: "My Tasks", icon: CheckSquare },
  { href: "/search", label: "Browse", icon: Search },
];

export default function PanelNav() {
  const pathname = usePathname();

  const hasSecondaryNav =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/tasks" ||
    pathname.startsWith("/tasks/") ||
    pathname === "/search" ||
    pathname.startsWith("/search/");

  if (!hasSecondaryNav) return null;

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Workspace header */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          Client Hub
        </span>
      </div>

      {/* Top-level nav */}
      <div className="px-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
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
