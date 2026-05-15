import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";

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
  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  const byId = new Map((existing.analyses ?? []).map((a) => [a.id, a]));
  const reordered = body.ids
    .filter((aid: unknown): aid is string => typeof aid === "string" && byId.has(aid))
    .map((aid: string, i: number) => ({ ...byId.get(aid)!, rank: i }));

  if (reordered.length !== (existing.analyses ?? []).length) {
    return NextResponse.json({ error: "ids must include every analysis exactly once" }, { status: 400 });
  }

  existing.analyses = reordered;
  await existing.save();

  return NextResponse.json({ success: true });
}
