"use client";

import { useState, useEffect } from "react";
import AdminEmployeesTable from "./AdminEmployeesTable";
import AdminRolesTable from "./AdminRolesTable";
import AdminTemplatesTable from "./AdminTemplatesTable";
import LeadSettingsEditor from "./LeadSettingsEditor";
import { AdminEmployeesSkeleton, AdminRolesSkeleton, AdminTemplatesSkeleton } from "@/components/ui/TabSkeletons";

const validTabs = ["users", "templates", "roles", "leads"] as const;
type AdminTab = (typeof validTabs)[number];

interface AdminShellProps {
  currentUserId: string;
  initialTab: AdminTab;
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

export default function AdminShell({ currentUserId, initialTab }: AdminShellProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  // ── Tab data state ──
  type EmployeesData = { employees: unknown[] };
  type RolesData = { roles: unknown[] };
  type TemplatesData = { templates: unknown[]; services: unknown[] };

  const [employeesData, setEmployeesData] = useState<EmployeesData | null>(
    (dataCache.get("admin:users") as EmployeesData) ?? null
  );
  const [rolesData, setRolesData] = useState<RolesData | null>(
    (dataCache.get("admin:roles") as RolesData) ?? null
  );
  const [templatesData, setTemplatesData] = useState<TemplatesData | null>(
    (dataCache.get("admin:templates") as TemplatesData) ?? null
  );

  // ── Listen for tab-change events from AdminPanelNav ──
  useEffect(() => {
    function handleTabChange(e: Event) {
      const { tab } = (e as CustomEvent).detail ?? {};
      if (tab && (validTabs as readonly string[]).includes(tab)) {
        setActiveTab(tab as AdminTab);
      }
    }
    window.addEventListener("admin-tab-change", handleTabChange);
    return () => window.removeEventListener("admin-tab-change", handleTabChange);
  }, []);

  // ── Sync URL when tab changes ──
  useEffect(() => {
    window.history.replaceState(null, "", `/admin?tab=${activeTab}`);
  }, [activeTab]);

  // ── Respond to browser back/forward ──
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab")?.toLowerCase() ?? "users";
      if ((validTabs as readonly string[]).includes(tab)) {
        setActiveTab(tab as AdminTab);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ── Fetch data for active tab on first visit ──
  useEffect(() => {
    const cacheKey = `admin:${activeTab}`;

    // Already cached or leads (self-fetches) — skip
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
  }, [activeTab]);

  const { title, subtitle } = tabMeta[activeTab];

  // Resolve data: prefer state (updated by fetch), fall back to cache
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
