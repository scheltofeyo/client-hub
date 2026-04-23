"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const validTabNames: string[] = tabItems.map((t) => t.tab);

export default function AdminPanelNav() {
  const { data: session } = useSession();
  const perms = session?.user?.permissions ?? [];

  const pathname = usePathname();

  const visibleTabs = tabItems.filter((t) => perms.includes(t.requires));

  // Track active tab locally (updated via URL reads and admin-tab-change events)
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab")?.toLowerCase() ?? "users";
      return validTabNames.includes(tab) ? tab : (visibleTabs[0]?.tab ?? "users");
    }
    return visibleTabs[0]?.tab ?? "users";
  });

  // Listen for admin-tab-change events to keep active state in sync
  useEffect(() => {
    function handleTabChange(e: Event) {
      const { tab } = (e as CustomEvent).detail ?? {};
      if (tab && validTabNames.includes(tab)) setActiveTab(tab);
    }
    window.addEventListener("admin-tab-change", handleTabChange);
    return () => window.removeEventListener("admin-tab-change", handleTabChange);
  }, []);

  const showLabels = labelsPermissions.some((p) => perms.includes(p));

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  const canViewEmployees = perms.includes("employees.view" as Permission);

  // Fetch employees on mount and when navigating back to /admin from employee detail.
  // Skip while on employee detail pages to avoid a wasted fetch during drill-down.
  useEffect(() => {
    if (!canViewEmployees) return;
    if (pathname.startsWith("/admin/employees/")) return;
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EmployeeItem[]) => setEmployees(data))
      .catch(() => {});
  }, [canViewEmployees, pathname]);

  // Track selected employee (client-side, within admin root)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("employee") ?? null;
    }
    return null;
  });

  // Listen for employee select/deselect events
  useEffect(() => {
    function handleEmployeeSelect(e: Event) {
      const { employeeId } = (e as CustomEvent).detail ?? {};
      if (employeeId) setSelectedEmployeeId(employeeId);
    }
    function handleTabChange() {
      setSelectedEmployeeId(null);
    }
    window.addEventListener("admin-employee-select", handleEmployeeSelect);
    window.addEventListener("admin-tab-change", handleTabChange);
    return () => {
      window.removeEventListener("admin-employee-select", handleEmployeeSelect);
      window.removeEventListener("admin-tab-change", handleTabChange);
    };
  }, []);

  const isOnEmployeeDetail = pathname.startsWith("/admin/employees/");
  const isOnAdminRoot = pathname === "/admin";
  const isInEmployeesArea = isOnEmployeeDetail || (activeTab === "users" && isOnAdminRoot);

  // Detect active employee id from pathname or client-side selection
  const employeeDetailMatch = pathname.match(/\/admin\/employees\/([^/]+)/);
  const activeEmployeeId = selectedEmployeeId ?? employeeDetailMatch?.[1] ?? null;

  function handleTabClick(e: React.MouseEvent, tab: string) {
    // Only intercept when on admin root — on sub-routes (e.g. /admin/employees/[id]),
    // let the <Link> navigate normally back to /admin
    if (!isOnAdminRoot) return;
    e.preventDefault();
    setActiveTab(tab);
    window.history.replaceState(null, "", `/admin?tab=${tab}`);
    window.dispatchEvent(new CustomEvent("admin-tab-change", { detail: { tab } }));
  }

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
                onClick={(e) => handleTabClick(e, tab)}
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
                        onClick={(e) => {
                          if (!isOnAdminRoot) return;
                          e.preventDefault();
                          setSelectedEmployeeId(emp.id);
                          window.history.pushState(null, "", `/admin?tab=users&employee=${emp.id}`);
                          window.dispatchEvent(new CustomEvent("admin-employee-select", { detail: { employeeId: emp.id } }));
                        }}
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
