// ── Permission Registry ──────────────────────────────────────────────
// Single source of truth for all permission strings in the app.
// The Role model stores subsets of these; the admin UI renders them grouped.

export const ALL_PERMISSIONS = [
  // Client management
  "clients.create",
  "clients.edit",
  "clients.delete",
  "clients.assignLeads",

  // Project management
  "projects.create",
  "projects.edit",
  "projects.delete",
  "projects.kickoff",
  "projects.resetToUpcoming",

  // Task management
  "tasks.create",
  "tasks.editOwn",
  "tasks.editAny",
  "tasks.deleteOwn",
  "tasks.deleteAny",

  // Log management
  "logs.create",
  "logs.editOwn",
  "logs.editAny",
  "logs.deleteOwn",
  "logs.deleteAny",

  // Event management
  "events.create",
  "events.edit",
  "events.delete",

  // Sheet management
  "sheets.create",
  "sheets.edit",
  "sheets.delete",

  // Employee / user management
  "employees.view",
  "employees.invite",
  "employees.edit",
  "employees.archive",

  // Profile
  "profile.editOwn",

  // Admin reference data
  "admin.archetypes",
  "admin.services",
  "admin.logSignals",
  "admin.clientStatuses",
  "admin.clientPlatforms",
  "admin.eventTypes",
  "admin.projectLabels",
  "admin.projectTemplates",

  // Team / Time Off
  "team.viewCalendar",
  "team.viewBalances",
  "team.manageOwnLeave",
  "team.manageAnyLeave",

  // Dashboard
  "dashboard.viewOverview",

  // Admin panel access
  "admin.access",

  // Admin reference data — leave types & company holidays
  "admin.leaveTypes",
  "admin.companyHolidays",

  // Role management
  "roles.manage",

  // Tools
  "tools.access",
  "tools.ranking.access",
  "tools.rankingValues",
  "tools.ranking.editAny",
  "tools.ranking.deleteAny",
  "tools.spinTheWheel.access",
  "tools.emailSignature.access",
  "tools.emailSignature.generateAny",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

// ── Dependency map ───────────────────────────────────────────────────
// If permission A requires permission B, checking A without B is meaningless.
// The UI uses this to auto-enable parents and disable orphaned children.
export const PERMISSION_DEPENDENCIES: Partial<Record<Permission, Permission>> = {
  // Assign leads requires being able to edit the client
  "clients.assignLeads": "clients.edit",

  // Employee invite/edit require being able to view employees
  "employees.invite": "employees.view",
  "employees.edit": "employees.view",
  "employees.archive": "employees.edit",

  // Team permissions (under tools)
  "team.viewCalendar": "tools.access",
  "team.viewBalances": "team.viewCalendar",
  "team.manageOwnLeave": "team.viewCalendar",
  "team.manageAnyLeave": "team.manageOwnLeave",

  // All admin sub-features require admin panel access
  "admin.archetypes": "admin.access",
  "admin.services": "admin.access",
  "admin.logSignals": "admin.access",
  "admin.clientStatuses": "admin.access",
  "admin.clientPlatforms": "admin.access",
  "admin.eventTypes": "admin.access",
  "admin.projectLabels": "admin.access",
  "admin.projectTemplates": "admin.access",
  "employees.view": "admin.access",
  "admin.leaveTypes": "admin.access",
  "admin.companyHolidays": "admin.access",
  "roles.manage": "admin.access",

  // Tools sub-features require tools access
  "tools.ranking.access": "tools.access",
  "tools.rankingValues": "tools.ranking.access",
  "tools.ranking.editAny": "tools.rankingValues",
  "tools.ranking.deleteAny": "tools.rankingValues",
  "tools.spinTheWheel.access": "tools.access",
  "tools.emailSignature.access": "tools.access",
  "tools.emailSignature.generateAny": "tools.emailSignature.access",
};

/** Given a permission, return all permissions it transitively depends on. */
export function getDependencyChain(perm: Permission): Permission[] {
  const chain: Permission[] = [];
  let current: Permission | undefined = PERMISSION_DEPENDENCIES[perm];
  while (current) {
    chain.push(current);
    current = PERMISSION_DEPENDENCIES[current];
  }
  return chain;
}

/** Given a permission being unchecked, return all permissions that depend on it (directly or transitively). */
export function getDependents(perm: Permission): Permission[] {
  const result: Permission[] = [];
  for (const [child, parent] of Object.entries(PERMISSION_DEPENDENCIES)) {
    if (parent === perm) {
      result.push(child as Permission);
      result.push(...getDependents(child as Permission));
    }
  }
  return result;
}

// ── Grouped for admin UI ─────────────────────────────────────────────
export interface PermissionItem {
  key: Permission;
  label: string;
  requires?: Permission; // shown as hint in UI
}

export interface PermissionGroup {
  label: string;
  description: string;
  permissions: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Clients",
    description: "Control who can create, edit, and remove client records and assign leads.",
    permissions: [
      { key: "clients.create", label: "Create clients" },
      { key: "clients.edit", label: "Edit client details" },
      { key: "clients.delete", label: "Delete clients" },
      { key: "clients.assignLeads", label: "Assign / reassign leads", requires: "clients.edit" },
    ],
  },
  {
    label: "Projects",
    description: "Manage projects within clients — creation, editing, kick-off, and deletion.",
    permissions: [
      { key: "projects.create", label: "Create projects" },
      { key: "projects.edit", label: "Edit projects" },
      { key: "projects.delete", label: "Delete projects" },
      { key: "projects.kickoff", label: "Kick off projects" },
      { key: "projects.resetToUpcoming", label: "Reset projects to upcoming" },
    ],
  },
  {
    label: "Tasks",
    description: "Create, edit, and delete tasks across all clients and projects.",
    permissions: [
      { key: "tasks.create", label: "Create tasks" },
      { key: "tasks.editOwn", label: "Edit own tasks" },
      { key: "tasks.editAny", label: "Edit any task" },
      { key: "tasks.deleteOwn", label: "Delete own tasks" },
      { key: "tasks.deleteAny", label: "Delete any task" },
    ],
  },
  {
    label: "Logs",
    description: "Logbook entries track client interactions. Separate controls for own vs. any entries.",
    permissions: [
      { key: "logs.create", label: "Create log entries" },
      { key: "logs.editOwn", label: "Edit own log entries" },
      { key: "logs.editAny", label: "Edit any log entry" },
      { key: "logs.deleteOwn", label: "Delete own log entries" },
      { key: "logs.deleteAny", label: "Delete any log entry" },
    ],
  },
  {
    label: "Events",
    description: "Custom timeline events on client pages — milestones, meetings, deadlines.",
    permissions: [
      { key: "events.create", label: "Create events" },
      { key: "events.edit", label: "Edit events" },
      { key: "events.delete", label: "Delete events" },
    ],
  },
  {
    label: "Sheets",
    description: "Linked Google Sheets and documents attached to clients.",
    permissions: [
      { key: "sheets.create", label: "Create sheets" },
      { key: "sheets.edit", label: "Edit sheets" },
      { key: "sheets.delete", label: "Delete sheets" },
    ],
  },
  {
    label: "Admin Settings",
    description: "Access to the admin panel, employee management, roles, templates, and reference data.",
    permissions: [
      { key: "admin.access", label: "Access the admin panel" },
      { key: "employees.view", label: "View employee details", requires: "admin.access" },
      { key: "employees.invite", label: "Invite new employees", requires: "employees.view" },
      { key: "employees.edit", label: "Edit employee profiles", requires: "employees.view" },
      { key: "employees.archive", label: "Archive employees", requires: "employees.edit" },
      { key: "roles.manage", label: "Manage roles & permissions", requires: "admin.access" },
      { key: "admin.projectTemplates", label: "Manage project templates", requires: "admin.access" },
      { key: "admin.archetypes", label: "Manage archetypes", requires: "admin.access" },
      { key: "admin.services", label: "Manage services", requires: "admin.access" },
      { key: "admin.logSignals", label: "Manage log signals", requires: "admin.access" },
      { key: "admin.clientStatuses", label: "Manage client statuses", requires: "admin.access" },
      { key: "admin.clientPlatforms", label: "Manage client platforms", requires: "admin.access" },
      { key: "admin.eventTypes", label: "Manage event types", requires: "admin.access" },
      { key: "admin.projectLabels", label: "Manage project labels", requires: "admin.access" },
      { key: "admin.leaveTypes", label: "Manage leave types", requires: "admin.access" },
      { key: "admin.companyHolidays", label: "Manage company holidays", requires: "admin.access" },
    ],
  },
  {
    label: "Profile",
    description: "Self-service access to edit personal information via the profile page.",
    permissions: [
      { key: "profile.editOwn", label: "Edit own profile" },
    ],
  },
  {
    label: "Dashboard",
    description: "The team overview dashboard on the clients page with aggregated metrics.",
    permissions: [
      { key: "dashboard.viewOverview", label: "View team overview dashboard" },
    ],
  },
  {
    label: "Tools",
    description: "Workshop tools, holiday planner, and facilitation features.",
    permissions: [
      { key: "tools.access", label: "Access the tools section" },
      { key: "team.viewCalendar", label: "View holiday calendar", requires: "tools.access" },
      { key: "team.viewBalances", label: "View leave balances", requires: "team.viewCalendar" },
      { key: "team.manageOwnLeave", label: "Manage own time off", requires: "team.viewCalendar" },
      { key: "team.manageAnyLeave", label: "Manage any team member's time off", requires: "team.manageOwnLeave" },
      { key: "tools.ranking.access", label: "Access Ranking the Values", requires: "tools.access" },
      { key: "tools.rankingValues", label: "View sessions from others", requires: "tools.ranking.access" },
      { key: "tools.ranking.editAny", label: "Edit anyone's sessions", requires: "tools.rankingValues" },
      { key: "tools.ranking.deleteAny", label: "Delete anyone's sessions", requires: "tools.rankingValues" },
      { key: "tools.spinTheWheel.access", label: "Access Spin the Wheel", requires: "tools.access" },
      { key: "tools.emailSignature.access", label: "Access email signature generator", requires: "tools.access" },
      { key: "tools.emailSignature.generateAny", label: "Generate signatures for others", requires: "tools.emailSignature.access" },
    ],
  },
];

// ── Lead-eligible permissions ────────────────────────────────────────
// Only permissions whose API routes honor lead scope via hasPermissionOrIsLead.
// Other permissions are enforced globally in the API, so granting them here
// would have no effect.
export const LEAD_ELIGIBLE_PERMISSIONS: Permission[] = [
  "clients.edit",
  "projects.create",
  "projects.edit",
  "projects.kickoff",
];

export const LEAD_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Clients",
    description: "What leads can do with client records they are assigned to.",
    permissions: [
      { key: "clients.edit", label: "Edit client details" },
    ],
  },
  {
    label: "Projects",
    description: "Project management on assigned clients.",
    permissions: [
      { key: "projects.create", label: "Create projects" },
      { key: "projects.edit", label: "Edit projects" },
      { key: "projects.kickoff", label: "Kick off projects" },
    ],
  },
];

// ── Default permission sets for seeded roles ─────────────────────────
export const ADMIN_PERMISSIONS: Permission[] = [...ALL_PERMISSIONS];
// Note: tools.access and tools.rankingValues are included via ALL_PERMISSIONS for admin role.

export const MEMBER_PERMISSIONS: Permission[] = [
  // Tools access — needed for team/holiday planner
  "tools.access",

  // Team — view calendar + manage own leave
  "team.viewCalendar",
  "team.manageOwnLeave",

  // Tasks — create + own (matches current any-auth behavior)
  "tasks.create",
  "tasks.editOwn",
  "tasks.editAny",
  "tasks.deleteOwn",
  "tasks.deleteAny",

  // Events — full access
  "events.create",
  "events.edit",
  "events.delete",

  // Sheets — full access
  "sheets.create",
  "sheets.edit",
  "sheets.delete",

  // Logs — create + own
  "logs.create",
  "logs.editOwn",
  "logs.deleteOwn",

  // Projects — with lead check applied at route level
  "projects.create",
  "projects.edit",
  "projects.kickoff",

  // Clients — edit with lead check applied at route level
  "clients.edit",

  // Profile — self-service
  "profile.editOwn",

  // Workshop tools
  "tools.spinTheWheel.access",
  "tools.emailSignature.access",
];
