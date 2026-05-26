import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import DocumentsAdmin from "@/components/ui/DocumentsAdmin";

export const dynamic = "force-dynamic";

export default async function DocumentsAdminPage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");
  if (!hasPermission(session, "admin.access")) redirect("/dashboard");

  return <DocumentsAdmin />;
}
