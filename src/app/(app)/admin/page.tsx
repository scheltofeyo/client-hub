import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import AdminShell from "./AdminShell";

const validTabs = ["users", "templates", "roles", "leads"] as const;
type AdminTab = (typeof validTabs)[number];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session || !hasPermission(session, "admin.access")) redirect("/dashboard");

  const { tab } = await searchParams;
  const initialTab: AdminTab = (validTabs as readonly string[]).includes(tab ?? "")
    ? (tab as AdminTab)
    : "users";

  return (
    <AdminShell
      currentUserId={session.user.id}
      initialTab={initialTab}
    />
  );
}
