"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Users, LayoutTemplate, Tag, Palette, ChevronRight } from "lucide-react";

interface EmployeeItem {
  id: string;
  name: string;
  status: string;
}

const tabItems = [
  { tab: "users",     label: "Employees",         icon: Users,          expandable: true },
  { tab: "templates", label: "Project Templates",  icon: LayoutTemplate, expandable: false },
];

const standaloneItems = [
  { href: "/admin/stylesheet", label: "Stylesheet", icon: Palette },
];

export default function AdminPanelNav() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const rawTab = searchParams.get("tab")?.toLowerCase() ?? "users";
  const activeTab = tabItems.some((t) => t.tab === rawTab) ? rawTab : "users";

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  // Fetch employees for the sidebar list
  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EmployeeItem[]) => setEmployees(data))
      .catch(() => {});
  }, []);

  // Refresh when navigating back from employee detail
  useEffect(() => {
    if (activeTab === "users" && pathname === "/admin") {
      fetch("/api/users")
        .then((r) => (r.ok ? r.json() : []))
        .then((data: EmployeeItem[]) => setEmployees(data))
        .catch(() => {});
    }
  }, [activeTab, pathname]);

  const isOnEmployeeDetail = pathname.startsWith("/admin/employees/");
  const isOnAdminRoot = pathname === "/admin";
  const isInEmployeesArea = isOnEmployeeDetail || (activeTab === "users" && isOnAdminRoot);

  // Detect active employee id from pathname
  const employeeDetailMatch = pathname.match(/\/admin\/employees\/([^/]+)/);
  const activeEmployeeId = employeeDetailMatch?.[1] ?? null;

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
        {tabItems.map(({ tab, label, icon: Icon, expandable }) => {
          const isEmployeesTab = tab === "users";
          const active = isEmployeesTab
            ? activeTab === "users" && isOnAdminRoot
            : activeTab === tab ||
              (tab === "templates" && pathname.startsWith("/admin/templates"));

          return (
            <div key={tab}>
              <Link
                href={`/admin?tab=${tab}`}
                data-active={active}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors nav-panel-item"
              >
                <Icon size={14} strokeWidth={1.8} />
                <span className="flex-1">{label}</span>
                {expandable && employees.length > 0 && (
                  <ChevronRight
                    size={12}
                    strokeWidth={2}
                    className="transition-transform"
                    style={{
                      transform: isInEmployeesArea ? "rotate(90deg)" : "rotate(0deg)",
                      color: "var(--text-muted)",
                    }}
                  />
                )}
              </Link>

              {/* Employee children — shown when in employees area */}
              {isEmployeesTab && isInEmployeesArea && employees.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {employees.map((emp) => {
                    const empActive = activeEmployeeId === emp.id;
                    return (
                      <Link
                        key={emp.id}
                        href={`/admin/employees/${emp.id}`}
                        data-active={empActive}
                        className="flex items-center gap-2 pl-4 pr-2 py-1.5 ml-4 rounded-lg text-sm transition-colors nav-panel-item truncate"
                      >
                        <span
                          className="truncate"
                          style={{
                            opacity: emp.status === "inactive" ? 0.5 : emp.status === "invited" ? 0.7 : 1,
                          }}
                        >
                          {emp.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <Link
          href="/admin/labels-and-types"
          data-active={pathname.startsWith("/admin/labels-and-types")}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors nav-panel-item"
        >
          <Tag size={14} strokeWidth={1.8} />
          <span className="flex-1">Labels and Types</span>
        </Link>
      </div>

      <div className="mx-3 my-3 border-t" style={{ borderColor: "var(--border)" }} />

      <div className="px-2 space-y-0.5">
        {standaloneItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            data-active={pathname === href}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors nav-panel-item"
          >
            <Icon size={14} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
