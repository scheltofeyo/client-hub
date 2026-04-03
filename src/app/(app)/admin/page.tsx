import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { getProjectTemplates, getServices } from "@/lib/data";
import AdminEmployeesTable from "./AdminEmployeesTable";
import AdminTemplatesTable from "./AdminTemplatesTable";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/dashboard");

  const { tab } = await searchParams;
  const activeTab = tab === "templates" ? "templates" : "users";

  await connectDB();

  if (activeTab === "templates") {
    const [templates, services] = await Promise.all([getProjectTemplates(), getServices()]);
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
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
    isAdmin: u.isAdmin,
    role: u.role ?? "member",
    status: u.status ?? "active",
    firstName: u.firstName,
    preposition: u.preposition,
    lastName: u.lastName,
    employeeNumber: u.employeeNumber,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Employees
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Manage employees and access.
      </p>
      <AdminEmployeesTable employees={employees} currentUserId={session.user.id} />
    </div>
  );
}
