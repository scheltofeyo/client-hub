import { getClientById } from "@/lib/data";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { notFound } from "next/navigation";
import ClientDetailShell from "@/components/ui/ClientDetailShell";

export const dynamic = "force-dynamic";

const tabs = ["Dashboard", "Projects", "Tasks", "Sheets", "Logbook", "Events", "Activity", "Settings"] as const;
type Tab = (typeof tabs)[number];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; section?: string }>;
}) {
  const { id } = await params;
  const { tab, section } = await searchParams;

  const [client, session] = await Promise.all([
    getClientById(id),
    auth(),
  ]);

  if (!client) notFound();

  const activeTab: Tab =
    tabs.find((t) => t.toLowerCase() === tab?.toLowerCase()) ?? "Dashboard";

  const isAdmin = hasPermission(session, "admin.access");
  const userPermissions = session?.user?.permissions ?? [];
  const currentUserId = session?.user?.id ?? "";

  const isLead = (client.leads ?? []).some((l) => l.userId === currentUserId);
  const canEdit = isAdmin || isLead;
  const canAssignLeads = userPermissions.includes("clients.assignLeads");

  let allUsers: { id: string; name: string; email: string; image: string | null }[] = [];
  if (canAssignLeads) {
    await connectDB();
    const docs = await UserModel.find().sort({ name: 1 }).lean();
    allUsers = docs.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      image: u.image ?? null,
    }));
  }

  return (
    <ClientDetailShell
      client={client}
      clientId={id}
      permissions={userPermissions}
      currentUserId={currentUserId}
      currentUserName={session?.user?.name ?? ""}
      isAdmin={isAdmin}
      canEdit={canEdit}
      canAssignLeads={canAssignLeads}
      allUsers={allUsers}
      initialTab={activeTab}
      initialSection={section ?? "about"}
    />
  );
}
