import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { ClientModel } from "@/lib/models/Client";
import { slugify } from "@/lib/slug";

/**
 * Legacy redirect. Old share URLs `/archetype-as-is-survey/<shareCode>` resolve
 * to the canonical `/s/<companySlug>/<shareCode>` path. New shares emit the new
 * URL directly from the admin UI.
 */
export default async function LegacySurveyRedirect({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;
  await connectDB();
  const surveySession = await SurveySessionModel.findOne({ shareCode })
    .select("clientId")
    .lean();
  if (!surveySession) redirect(`/s/survey/${shareCode}`);
  const client = await ClientModel.findById(surveySession.clientId).select("company").lean();
  const slug = slugify(client?.company ?? "survey");
  redirect(`/s/${slug}/${shareCode}`);
}
