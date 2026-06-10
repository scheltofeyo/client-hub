import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";

// The template editor now lives in the right-side panel on the admin templates
// list. This route is kept as a deep link: it redirects into the list with the
// panel auto-opened for the requested template.
export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!hasPermission(session, "admin.access")) redirect("/dashboard");

  const { id } = await params;
  redirect(`/admin?tab=templates&template=${id}`);
}
