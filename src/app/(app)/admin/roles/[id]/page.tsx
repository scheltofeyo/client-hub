import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { RoleModel } from "@/lib/models/Role";
import { hasPermission } from "@/lib/auth-helpers";
import RoleDetailEditor from "./RoleDetailEditor";

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!hasPermission(session, "roles.manage")) redirect("/dashboard");

  const { id } = await params;
  await connectDB();

  const doc = await RoleModel.findById(id).lean();
  if (!doc) notFound();

  const role = {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? "",
    permissions: doc.permissions as string[],
    isSystem: doc.isSystem,
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <RoleDetailEditor role={role} />
    </div>
  );
}
