import type { Metadata } from "next";
import { connectDB } from "@/lib/mongodb";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { ClientModel } from "@/lib/models/Client";
import { estimateSurveyMinutes } from "@/lib/surveys/time-estimate";

const GENERIC_DESCRIPTION =
  "Een korte survey. Je antwoorden zijn anoniem en worden alleen geaggregeerd verwerkt.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}): Promise<Metadata> {
  const { shareCode } = await params;
  await connectDB();
  const surveySession = await SurveySessionModel.findOne({ shareCode })
    .select(
      "clientId title templateSnapshot.sections templateSnapshot.closingOpenQuestion"
    )
    .lean();

  if (!surveySession) {
    return {
      title: "Survey",
      description: GENERIC_DESCRIPTION,
      robots: { index: false, follow: false },
      openGraph: {
        title: "Survey",
        description: GENERIC_DESCRIPTION,
        siteName: "SUMM",
        locale: "nl_NL",
        type: "website",
      },
      twitter: { card: "summary", title: "Survey", description: GENERIC_DESCRIPTION },
    };
  }

  const client = await ClientModel.findById(surveySession.clientId)
    .select("company")
    .lean();
  const company = client?.company ?? "een opdrachtgever";

  const minutes = estimateSurveyMinutes(
    surveySession.templateSnapshot?.sections ?? [],
    !!surveySession.templateSnapshot?.closingOpenQuestion?.enabled
  );

  const title = `${company} — ${surveySession.title}`;
  const description = `Een korte survey voor ${company} — duurt ongeveer ${minutes} ${
    minutes === 1 ? "minuut" : "minuten"
  }. Je antwoorden zijn anoniem en worden alleen geaggregeerd verwerkt.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      siteName: "SUMM",
      locale: "nl_NL",
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
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
