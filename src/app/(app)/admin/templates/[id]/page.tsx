import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getProjectTemplateById, getTemplateTasksByTemplateId, getServices } from "@/lib/data";
import EditTemplateEditor from "./EditTemplateEditor";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/dashboard");

  const { id } = await params;
  const [template, tasks, services] = await Promise.all([
    getProjectTemplateById(id),
    getTemplateTasksByTemplateId(id),
    getServices(),
  ]);

  if (!template) notFound();

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <EditTemplateEditor template={template} initialTasks={tasks} services={services} />
    </div>
  );
}
