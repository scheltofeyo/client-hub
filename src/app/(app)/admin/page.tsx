import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { getProjectTemplates } from "@/lib/data";
import AdminUsersTable from "./AdminUsersTable";
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
    const templates = await getProjectTemplates();
    return (
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
        <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Project Templates
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Templates pre-fill project fields when creating new projects.
        </p>
        <AdminTemplatesTable initialTemplates={templates} />
      </div>
    );
  }

  const docs = await UserModel.find().sort({ createdAt: 1 }).lean();
  const users = docs.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    isAdmin: u.isAdmin,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        Users
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        Manage user access and roles.
      </p>
      <AdminUsersTable users={users} currentUserId={session.user.id} />
    </div>
  );
}
