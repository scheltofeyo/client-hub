import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";
import { validateAnalysisInput } from "@/lib/surveys/analyses-validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id, aid } = await params;
  await connectDB();

  const existing = await SurveySessionModel.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = existing.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.editAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const idx = (existing.analyses ?? []).findIndex((a) => a.id === aid);
  if (idx === -1) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  const current = existing.analyses[idx];

  const body = await req.json();
  const result = validateAnalysisInput(body, existing, current.id, current.rank);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  existing.analyses.splice(idx, 1, result.analysis);
  await existing.save();

  return NextResponse.json({ analysis: result.analysis });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.surveys.access");
  if (forbidden) return forbidden;

  const { id, aid } = await params;
  await connectDB();

  const existing = await SurveySessionModel.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = existing.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.surveys.editAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filtered = (existing.analyses ?? []).filter((a) => a.id !== aid);
  if (filtered.length === (existing.analyses ?? []).length) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }
  existing.analyses = filtered.map((a, i) => ({ ...a, rank: i }));
  await existing.save();

  return NextResponse.json({ success: true });
}
