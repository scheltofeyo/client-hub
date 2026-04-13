import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { RoleModel } from "@/lib/models/Role";
import { getProjectTemplates, getServices } from "@/lib/data";
import { hasPermission } from "@/lib/auth-helpers";
import AdminEmployeesTable from "./AdminEmployeesTable";
import AdminTemplatesTable from "./AdminTemplatesTable";
import AdminRolesTable from "./AdminRolesTable";
import LeadSettingsEditor from "./LeadSettingsEditor";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session || !hasPermission(session, "admin.access")) redirect("/dashboard");

  const { tab } = await searchParams;
  const validTabs = ["users", "templates", "roles", "leads"];
  const activeTab = validTabs.includes(tab ?? "") ? tab! : "users";

  await connectDB();

  if (activeTab === "leads") {
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="typo-page-title mb-1" style={{ color: "var(--text-primary)" }}>
          Lead Settings
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Configure what client leads can do on their assigned clients. These permissions apply to all leads regardless of their role.
        </p>
        <LeadSettingsEditor />
      </div>
    );
  }

  if (activeTab === "roles") {
    const roleDocs = await RoleModel.find().sort({ rank: 1, createdAt: 1 }).lean();
    // Count users per role
    const userCounts = await UserModel.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(userCounts.map((r: { _id: string; count: number }) => [r._id, r.count]));
    const roles = roleDocs.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      slug: r.slug,
      description: r.description ?? "",
      permissions: r.permissions as string[],
      isSystem: r.isSystem,
      rank: r.rank ?? 0,
      userCount: (countMap.get(r.slug) ?? 0) as number,
    }));

    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="typo-page-title mb-1" style={{ color: "var(--text-primary)" }}>
          Roles & Permissions
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Define roles and assign permissions to control access.
        </p>
        <AdminRolesTable initialRoles={roles} />
      </div>
    );
  }

  if (activeTab === "templates") {
    const [templates, services] = await Promise.all([getProjectTemplates(), getServices()]);
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="typo-page-title mb-1" style={{ color: "var(--text-primary)" }}>
          Project Templates
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Templates pre-fill project fields when creating new projects.
        </p>
        <AdminTemplatesTable initialTemplates={templates} services={services} />
      </div>
    );
  }

  const docs = await UserModel.find().sort({ createdAt: 1 }).lean();
  const employees = docs.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    role: u.role ?? "member",
    status: u.status ?? "active",
    firstName: u.firstName,
    preposition: u.preposition,
    lastName: u.lastName,
    employeeNumber: u.employeeNumber,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
      <h1 className="typo-page-title mb-1" style={{ color: "var(--text-primary)" }}>
        Employees
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Manage employees and access.
      </p>
      <AdminEmployeesTable employees={employees} currentUserId={session.user.id} />
    </div>
  );
}
