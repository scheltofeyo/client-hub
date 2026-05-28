import { notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import ProposalView from "./ProposalView";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;
  await connectDB();
  const exists = await ProjectPlanModel.findOne({ shareCode })
    .select("_id")
    .lean();
  if (!exists) notFound();

  return <ProposalView shareCode={shareCode} />;
}
