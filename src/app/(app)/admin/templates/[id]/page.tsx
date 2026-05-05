import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import { getProjectTemplateById, getTemplateTasksByTemplateId, getTemplateSessionsByTemplateId, getServices } from "@/lib/data";
import EditTemplateEditor from "./EditTemplateEditor";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!hasPermission(session, "admin.access")) redirect("/dashboard");

  const { id } = await params;
  const [template, tasks, sessions, services] = await Promise.all([
    getProjectTemplateById(id),
    getTemplateTasksByTemplateId(id),
    getTemplateSessionsByTemplateId(id),
    getServices(),
  ]);

  if (!template) notFound();

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <EditTemplateEditor
        template={template}
        initialTasks={tasks}
        initialSessions={sessions}
        services={services}
      />
    </div>
  );
}
