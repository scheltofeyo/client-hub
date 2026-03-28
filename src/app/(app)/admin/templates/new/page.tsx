import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getServices } from "@/lib/data";
import NewTemplateEditor from "./NewTemplateEditor";

export default async function NewTemplatePage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/dashboard");

  const services = await getServices();

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <NewTemplateEditor services={services} />
    </div>
  );
}
