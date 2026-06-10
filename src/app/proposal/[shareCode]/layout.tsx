import type { Metadata } from "next";
import { connectDB } from "@/lib/mongodb";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ClientModel } from "@/lib/models/Client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}): Promise<Metadata> {
  const { shareCode } = await params;
  await connectDB();

  const plan = await ProjectPlanModel.findOne({ shareCode }).select("clientId title").lean();
  if (!plan) return { title: "Proposal" };

  const client = await ClientModel.findById(plan.clientId).select("company").lean();
  const clientName = client?.company ?? "";
  return { title: clientName ? `${plan.title} — ${clientName}` : plan.title };
}

export default function ProposalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* The proposal is a client-facing document, presented light-only. Strip
          the .dark class (set by the root theme-init script for visitors whose
          system / localStorage prefers dark) before paint to avoid a flash. */}
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.remove('dark');` }} />
      {children}
    </>
  );
}
