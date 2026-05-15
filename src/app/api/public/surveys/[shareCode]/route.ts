import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { ClientModel } from "@/lib/models/Client";
import { serializeQuestionForPublic } from "@/lib/surveys/serializers";

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
    template: {
      name: doc.templateSnapshot.name,
      description: doc.templateSnapshot.description ?? undefined,
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
