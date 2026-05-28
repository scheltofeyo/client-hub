import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { getProjectRoles } from "@/lib/data";
import PlanDetail from "@/components/ui/PlanDetail";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");
  if (!hasPermission(session, "projectPlans.view")) redirect("/dashboard");

  const { id, planId } = await params;
  await connectDB();
  const [client, plan, projectRoles] = await Promise.all([
    ClientModel.findById(id).lean(),
    ProjectPlanModel.findOne({ _id: planId, clientId: id }).lean(),
    getProjectRoles(),
  ]);
  if (!client || !plan) notFound();

  // Finalized plans are hidden from the editor; they're only accessible as a
  // PDF entry in the plans list. Send admins back to the client projects view.
  if (plan.status === "finalized") redirect(`/clients/${id}`);

  return (
    <PlanDetail
      clientId={id}
      planId={planId}
      clientCompany={client.company}
      projectRoles={projectRoles}
      clientLeads={(client.leads ?? []).map((l) => ({ userId: l.userId, name: l.name }))}
    />
  );
}
