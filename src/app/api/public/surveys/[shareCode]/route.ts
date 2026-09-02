import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { ClientModel } from "@/lib/models/Client";
import { serializeQuestionForPublic } from "@/lib/surveys/serializers";
import { effectiveRespondentVariable } from "@/lib/surveys/cultural-dna";

export async function GET(
  req: NextRequest,
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

  /**
   * Preview lets a colleague walk a draft in the real runner before it is ever
   * published. `auth()` is only reached when preview is asked for, so the route
   * stays anonymous — and as cheap — for the participants it exists to serve.
   *
   * The rule is the one that already governs reading this session in the hub
   * (see the GET in /api/surveys/sessions/[id]). Failing it does not 403: an
   * outsider who appends the flag drops through to the same "not open yet"
   * screen as before and learns nothing about what is behind it.
   *
   * Nothing about writing changes. /start, /save and /submit still refuse any
   * session that is not open, so a preview cannot leave a submission behind
   * even if the runner asked them to.
   */
  const preview = await (async () => {
    if (req.nextUrl.searchParams.get("preview") !== "1") return false;
    const session = await auth();
    if (!hasPermission(session, "tools.surveys.access")) return false;
    if (doc.createdBy === session!.user.id) return true;
    return hasPermission(session, "tools.surveys.viewOthers");
  })();

  if (doc.status !== "open" && !preview) {
    return NextResponse.json({
      status: doc.status,
      title: doc.title,
      // Even the "not open yet" message is written in the survey's own language.
      locale: doc.templateSnapshot?.locale ?? "nl",
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
    // The runner reads its read-only mode off this rather than off the query
    // string, so a flag the server did not honour cannot silence the banner.
    preview,
    // The language the whole runner renders in. Set on the survey rather than
    // picked by the participant: the authored copy is written in one language, so
    // a switch could only ever translate the chrome around it.
    locale: doc.templateSnapshot.locale ?? "nl",
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
      closingScreen: doc.templateSnapshot.closingScreen ?? undefined,
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
