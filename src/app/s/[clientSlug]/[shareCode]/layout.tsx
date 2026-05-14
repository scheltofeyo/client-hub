import type { Metadata } from "next";
import { connectDB } from "@/lib/mongodb";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { ClientModel } from "@/lib/models/Client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}): Promise<Metadata> {
  const { shareCode } = await params;
  await connectDB();
  const surveySession = await SurveySessionModel.findOne({ shareCode })
    .select("clientId title")
    .lean();
  if (!surveySession) return { title: "Survey" };
  const client = await ClientModel.findById(surveySession.clientId).select("company").lean();
  const company = client?.company ?? "Survey";
  return { title: `${company}: ${surveySession.title}` };
}

export default function SurveyPublicLayout({ children }: { children: React.ReactNode }) {
  // Public participant route: force light mode for v1 (no user preference stored).
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.remove('dark');`,
        }}
      />
      {children}
    </>
  );
}
