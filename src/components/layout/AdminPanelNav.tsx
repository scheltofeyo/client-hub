"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Users, LayoutTemplate, Tag, Palette, ChevronRight, Shield, UserCheck } from "lucide-react";
import type { Permission } from "@/lib/permissions";

interface EmployeeItem {
  id: string;
  name: string;
  status: string;
}

const tabItems: { tab: string; label: string; icon: typeof Users; expandable: boolean; requires: Permission }[] = [
  { tab: "users",     label: "Employees",         icon: Users,          expandable: true,  requires: "employees.view" },
  { tab: "roles",     label: "Roles",             icon: Shield,         expandable: false, requires: "roles.manage" },
  { tab: "leads",     label: "Lead Settings",     icon: UserCheck,      expandable: false, requires: "roles.manage" },
  { tab: "templates", label: "Project Templates",  icon: LayoutTemplate, expandable: false, requires: "admin.projectTemplates" },
];

const labelsPermissions: Permission[] = [
  "admin.archetypes", "admin.services", "admin.logSignals",
  "admin.clientStatuses", "admin.clientPlatforms", "admin.eventTypes", "admin.projectLabels",
];

const standaloneItems = [
  { href: "/admin/stylesheet", label: "Stylesheet", icon: Palette },
];

export default function AdminPanelNav() {
  const { data: session } = useSession();
  const perms = session?.user?.permissions ?? [];

  const searchParams = useSearchParams();
  const pathname = usePathname();

  const visibleTabs = tabItems.filter((t) => perms.includes(t.requires));
  const rawTab = searchParams.get("tab")?.toLowerCase() ?? "users";
  const activeTab = visibleTabs.some((t) => t.tab === rawTab) ? rawTab : (visibleTabs[0]?.tab ?? "users");

  const showLabels = labelsPermissions.some((p) => perms.includes(p));

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  const canViewEmployees = perms.includes("employees.view" as Permission);

  // Fetch employees for the sidebar list
  useEffect(() => {
    if (!canViewEmployees) return;
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EmployeeItem[]) => setEmployees(data))
      .catch(() => {});
  }, [canViewEmployees]);

  // Refresh when navigating back from employee detail
  useEffect(() => {
    if (!canViewEmployees) return;
    if (activeTab === "users" && pathname === "/admin") {
      fetch("/api/users")
        .then((r) => (r.ok ? r.json() : []))
        .then((data: EmployeeItem[]) => setEmployees(data))
        .catch(() => {});
    }
  }, [activeTab, pathname, canViewEmployees]);

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
        {visibleTabs.map(({ tab, label, icon: Icon, expandable }) => {
          const isEmployeesTab = tab === "users";
          const active = isEmployeesTab
            ? activeTab === "users" && isOnAdminRoot
            : activeTab === tab ||
              (tab === "templates" && pathname.startsWith("/admin/templates")) ||
              (tab === "roles" && pathname.startsWith("/admin/roles"));

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

              {/* Employee children — shown when in employees area (exclude archived) */}
              {isEmployeesTab && isInEmployeesArea && employees.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {employees.filter((emp) => emp.status !== "inactive").map((emp) => {
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
                            opacity: emp.status === "invited" ? 0.7 : 1,
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

        {showLabels && (
          <Link
            href="/admin/labels-and-types"
            data-active={pathname.startsWith("/admin/labels-and-types")}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors nav-panel-item"
          >
            <Tag size={14} strokeWidth={1.8} />
            <span className="flex-1">Labels and Types</span>
          </Link>
        )}
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
