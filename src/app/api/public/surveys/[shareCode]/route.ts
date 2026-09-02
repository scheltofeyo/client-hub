import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { ClientModel } from "@/lib/models/Client";
import { serializeQuestionForPublic } from "@/lib/surveys/serializers";
import { effectiveRespondentVariable } from "@/lib/surveys/cultural-dna";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const doc = await SurveySessionModel.findOne({ shareCode }).lean();
  if (!doc) return NextResponse.json({ error: "Survey not found" }, { status: 404 });

  const client = doc.clientId
    ? await ClientModel.findById(doc.clientId).select("company primaryColor").lean()
    : null;
  const clientCompany = client?.company ?? undefined;
  const clientPrimaryColor = client?.primaryColor ?? undefined;

  if (doc.status !== "open") {
    return NextResponse.json({
      status: doc.status,
      title: doc.title,
      clientCompany,
      clientPrimaryColor,
      message:
        doc.status === "draft"
          ? "This survey is not open yet. Please check back later."
          : doc.status === "closed"
          ? "This survey is closed."
          : "This survey is no longer available.",
    });
  }

  // Participants must not see which archetype an option maps to.
  // serializeQuestionForPublic handles the strip + type-aware shape.
  return NextResponse.json({
    status: doc.status,
    title: doc.title,
    clientCompany,
    clientPrimaryColor,
    // The full cultural values, every level included. Deliberate: the runner needs
    // to switch behaviours as soon as the respondent picks a level, and doing that
    // client-side keeps this a single stateless fetch. Unlike `archetypeId` — which
    // would leak the scoring mapping — seeing another level's behaviours is harmless.
    culturalValues: doc.templateSnapshot.culturalValues ?? [],
    respondentVariable: effectiveRespondentVariable(doc) ?? null,
    template: {
      name: doc.templateSnapshot.name,
      // `description` is deliberately not sent: it is an internal note for
      // colleagues, shown in the editor and the results export only.
      thankYouText: doc.templateSnapshot.thankYouText ?? undefined,
      welcomeScreen: doc.templateSnapshot.welcomeScreen ?? undefined,
      // legacy section + closing open-question fields kept for pre-migration sessions
      closingOpenQuestion: doc.templateSnapshot.closingOpenQuestion ?? undefined,
      sections: (doc.templateSnapshot.sections ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description ?? undefined,
        imageUrl: s.imageUrl ?? undefined,
        order: s.order ?? 0,
        openQuestion: s.openQuestion ?? undefined,
        questions: (s.questions ?? []).map((q) => serializeQuestionForPublic(q)),
      })),
    },
  });
}
