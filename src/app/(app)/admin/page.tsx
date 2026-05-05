import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import type { Permission } from "@/lib/permissions";
import AdminShell from "./AdminShell";

const validTabs = ["users", "templates", "roles", "leads"] as const;
type AdminTab = (typeof validTabs)[number];

const tabPermissions: Record<AdminTab, Permission> = {
  users: "employees.view",
  templates: "admin.projectTemplates",
  roles: "roles.manage",
  leads: "roles.manage",
};

const labelsPermissions: Permission[] = [
  "admin.archetypes",
  "admin.services",
  "admin.logSignals",
  "admin.clientStatuses",
  "admin.clientPlatforms",
  "admin.eventTypes",
  "admin.projectLabels",
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; employee?: string }>;
}) {
  const session = await auth();
  if (!session || !hasPermission(session, "admin.access")) redirect("/dashboard");

  const { tab, employee } = await searchParams;
  const requestedTab = (validTabs as readonly string[]).includes(tab ?? "")
    ? (tab as AdminTab)
    : null;

  const firstAllowedTab = validTabs.find((t) => hasPermission(session, tabPermissions[t])) ?? null;

  const initialTab: AdminTab | null =
    requestedTab && hasPermission(session, tabPermissions[requestedTab])
      ? requestedTab
      : firstAllowedTab;

  if (!initialTab) {
    if (labelsPermissions.some((p) => hasPermission(session, p))) {
      redirect("/admin/labels-and-types");
    }
    redirect("/dashboard");
  }

  return (
    <AdminShell
      currentUserId={session.user.id}
      initialTab={initialTab}
      initialEmployeeId={employee ?? null}
    />
  );
}
