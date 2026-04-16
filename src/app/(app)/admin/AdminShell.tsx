"use client";

import { useState, useEffect } from "react";
import AdminEmployeesTable from "./AdminEmployeesTable";
import AdminRolesTable from "./AdminRolesTable";
import AdminTemplatesTable from "./AdminTemplatesTable";
import LeadSettingsEditor from "./LeadSettingsEditor";
import EmployeeDetailEditor from "./employees/[id]/EmployeeDetailEditor";
import { AdminEmployeesSkeleton, AdminRolesSkeleton, AdminTemplatesSkeleton } from "@/components/ui/TabSkeletons";

const validTabs = ["users", "templates", "roles", "leads"] as const;
type AdminTab = (typeof validTabs)[number];

interface AdminShellProps {
  currentUserId: string;
  initialTab: AdminTab;
  initialEmployeeId: string | null;
}

// Module-level data cache for admin tab data
const dataCache = new Map<string, unknown>();

// Tab metadata
const tabMeta: Record<AdminTab, { title: string; subtitle: string }> = {
  users: { title: "Employees", subtitle: "Manage employees and access." },
  roles: { title: "Roles & Permissions", subtitle: "Define roles and assign permissions to control access." },
  leads: { title: "Lead Settings", subtitle: "Configure what client leads can do on their assigned clients. These permissions apply to all leads regardless of their role." },
  templates: { title: "Project Templates", subtitle: "Templates pre-fill project fields when creating new projects." },
};

function fmtDate(val: string | null | undefined): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export default function AdminShell({ currentUserId, initialTab, initialEmployeeId }: AdminShellProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initialEmployeeId);

  // ── Tab data state ──
  type EmployeesData = { employees: unknown[] };
  type RolesData = { roles: unknown[] };
  type TemplatesData = { templates: unknown[]; services: unknown[] };

  const [employeesData, setEmployeesData] = useState<EmployeesData | null>(null);
  const [rolesData, setRolesData] = useState<RolesData | null>(null);
  const [templatesData, setTemplatesData] = useState<TemplatesData | null>(null);

  // ── Employee detail state (triggers re-render when fetch completes) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [employeeDetail, setEmployeeDetail] = useState<Record<string, any> | null>(null);

  // ── Listen for tab-change events from AdminPanelNav ──
  useEffect(() => {
    function handleTabChange(e: Event) {
      const { tab } = (e as CustomEvent).detail ?? {};
      if (tab && (validTabs as readonly string[]).includes(tab)) {
        setActiveTab(tab as AdminTab);
        setSelectedEmployeeId(null);
        setEmployeeDetail(null);
      }
    }
    function handleEmployeeSelect(e: Event) {
      const { employeeId } = (e as CustomEvent).detail ?? {};
      if (employeeId) {
        setActiveTab("users");
        setSelectedEmployeeId(employeeId);
        // Check cache
        const cached = dataCache.get(`employee:${employeeId}`);
        if (cached) {
          setEmployeeDetail(cached as Record<string, unknown>);
        } else {
          setEmployeeDetail(null);
        }
      }
    }
    window.addEventListener("admin-tab-change", handleTabChange);
    window.addEventListener("admin-employee-select", handleEmployeeSelect);
    return () => {
      window.removeEventListener("admin-tab-change", handleTabChange);
      window.removeEventListener("admin-employee-select", handleEmployeeSelect);
    };
  }, []);

  // ── Sync URL ──
  useEffect(() => {
    const url = selectedEmployeeId
      ? `/admin?tab=users&employee=${selectedEmployeeId}`
      : `/admin?tab=${activeTab}`;
    window.history.replaceState(null, "", url);
  }, [activeTab, selectedEmployeeId]);

  // ── Respond to browser back/forward ──
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab")?.toLowerCase() ?? "users";
      const empId = params.get("employee") ?? null;
      if ((validTabs as readonly string[]).includes(tab)) {
        setActiveTab(tab as AdminTab);
      }
      setSelectedEmployeeId(empId);
      if (empId) {
        const cached = dataCache.get(`employee:${empId}`);
        if (cached) {
          setEmployeeDetail(cached as Record<string, unknown>);
        } else {
          setEmployeeDetail(null);
        }
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ── Fetch tab data ──
  useEffect(() => {
    if (selectedEmployeeId) return; // Don't fetch tab data when viewing employee detail

    const cacheKey = `admin:${activeTab}`;
    if (dataCache.has(cacheKey) || activeTab === "leads") return;

    async function fetchTabData() {
      try {
        switch (activeTab) {
          case "users": {
            const employees = await fetch("/api/users").then((r) => r.json());
            const result = { employees };
            dataCache.set(cacheKey, result);
            setEmployeesData(result);
            break;
          }
          case "roles": {
            const roles = await fetch("/api/roles").then((r) => r.json());
            const result = { roles };
            dataCache.set(cacheKey, result);
            setRolesData(result);
            break;
          }
          case "templates": {
            const [templates, services] = await Promise.all([
              fetch("/api/project-templates").then((r) => r.json()),
              fetch("/api/services").then((r) => r.json()),
            ]);
            const result = { templates, services };
            dataCache.set(cacheKey, result);
            setTemplatesData(result);
            break;
          }
        }
      } catch {
        // fetch failed — skeleton stays visible, retry on next tab switch
      }
    }

    fetchTabData();
  }, [activeTab, selectedEmployeeId]);

  // ── Fetch employee detail data ──
  useEffect(() => {
    if (!selectedEmployeeId) return;
    // Already cached — resolved in render via dataCache lookup
    if (dataCache.has(`employee:${selectedEmployeeId}`)) return;

    fetch(`/api/users/${selectedEmployeeId}`)
      .then((r) => r.json())
      .then((data) => {
        // Format dates to match EmployeeDetailEditor expectations
        const formatted = {
          ...data,
          image: data.image ?? null,
          googleName: data.googleName ?? null,
          googleImage: data.googleImage ?? null,
          displayName: data.displayName ?? "",
          displayImage: data.displayImage ?? "",
          firstName: data.firstName ?? "",
          preposition: data.preposition ?? "",
          lastName: data.lastName ?? "",
          dateOfBirth: fmtDate(data.dateOfBirth),
          dateStarted: fmtDate(data.dateStarted),
          employeeNumber: data.employeeNumber ?? "",
          vacationDays: data.vacationDays ?? null,
          contractType: data.contractType ?? "",
          contractHours: data.contractHours ?? null,
          contractEndDate: fmtDate(data.contractEndDate),
          phone: data.phone ?? "",
          emergencyContactName: data.emergencyContactName ?? "",
          emergencyContactPhone: data.emergencyContactPhone ?? "",
          notes: data.notes ?? "",
          invitedAt: data.invitedAt ?? null,
          createdAt: data.createdAt ?? "",
        };
        dataCache.set(`employee:${selectedEmployeeId}`, formatted);
        setEmployeeDetail(formatted);
      })
      .catch(() => {});
  }, [selectedEmployeeId]);

  // ── Employee detail view ──
  const resolvedEmployee = selectedEmployeeId
    ? (employeeDetail ?? (dataCache.get(`employee:${selectedEmployeeId}`) as Record<string, unknown> | undefined) ?? null)
    : null;

  if (selectedEmployeeId) {
    if (!resolvedEmployee) {
      return (
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="animate-pulse p-8 max-w-3xl space-y-6">
            <div className="h-5 w-32 rounded" style={{ background: "var(--border)" }} />
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full" style={{ background: "var(--border)" }} />
              <div className="space-y-2">
                <div className="h-5 w-40 rounded" style={{ background: "var(--border)" }} />
                <div className="h-3 w-56 rounded" style={{ background: "var(--border)" }} />
              </div>
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-full rounded" style={{ background: "var(--border)" }} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        <EmployeeDetailEditor
          key={selectedEmployeeId}
          employee={resolvedEmployee as never}
          isCurrentUser={currentUserId === selectedEmployeeId}
          mode="admin"
        />
      </div>
    );
  }

  // ── Tab content ──
  const { title, subtitle } = tabMeta[activeTab];

  const resolvedEmployees = employeesData ?? (dataCache.get("admin:users") as EmployeesData | undefined) ?? null;
  const resolvedRoles = rolesData ?? (dataCache.get("admin:roles") as RolesData | undefined) ?? null;
  const resolvedTemplates = templatesData ?? (dataCache.get("admin:templates") as TemplatesData | undefined) ?? null;

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
      <h1 className="typo-page-title mb-1" style={{ color: "var(--text-primary)" }}>
        {title}
      </h1>
      <p className={`text-sm ${activeTab === "templates" ? "mb-4" : "mb-6"}`} style={{ color: "var(--text-muted)" }}>
        {subtitle}
      </p>

      {activeTab === "users" && (
        !resolvedEmployees ? (
          <AdminEmployeesSkeleton />
        ) : (
          <AdminEmployeesTable
            employees={resolvedEmployees.employees as never[]}
            currentUserId={currentUserId}
          />
        )
      )}

      {activeTab === "roles" && (
        !resolvedRoles ? (
          <AdminRolesSkeleton />
        ) : (
          <AdminRolesTable initialRoles={resolvedRoles.roles as never[]} />
        )
      )}

      {activeTab === "templates" && (
        !resolvedTemplates ? (
          <AdminTemplatesSkeleton />
        ) : (
          <AdminTemplatesTable
            initialTemplates={resolvedTemplates.templates as never[]}
            services={resolvedTemplates.services as never[]}
          />
        )
      )}

      {activeTab === "leads" && (
        <LeadSettingsEditor />
      )}
    </div>
  );
}
