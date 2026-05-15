import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { validateAnalysisInput } from "@/lib/surveys/analyses-validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const existing = await SurveySessionModel.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = existing.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.editAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const rank = (existing.analyses ?? []).length;
  const result = validateAnalysisInput(body, existing, undefined, rank);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  existing.analyses = [...(existing.analyses ?? []), result.analysis];
  await existing.save();

  return NextResponse.json({ analysis: result.analysis });
}
