import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import OrganizationSettingsAdmin from "@/components/ui/OrganizationSettingsAdmin";

export const dynamic = "force-dynamic";

export default async function OrganizationSettingsPage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");
  if (!hasPermission(session, "admin.access")) redirect("/dashboard");

  return <OrganizationSettingsAdmin />;
}
