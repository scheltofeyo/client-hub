import type { Metadata } from "next";
import { connectDB } from "@/lib/mongodb";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { ClientModel } from "@/lib/models/Client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}): Promise<Metadata> {
  const { shareCode } = await params;
  await connectDB();

  const session = await RankingSessionModel.findOne({ shareCode })
    .select("clientId")
    .lean();
  if (!session) return { title: "Ranking the Values" };

  const client = await ClientModel.findById(session.clientId)
    .select("company")
    .lean();

  const clientName = client?.company ?? "Unknown";
  return { title: `${clientName} - Ranking the Values` };
}

export default function RankingPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
