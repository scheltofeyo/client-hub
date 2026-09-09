import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { RankingSubmissionModel } from "@/lib/models/RankingSubmission";

/**
 * Remove one participant's submission so they can fill the ranking in again.
 *
 * Only while the session is still collecting: after closing, the matches are
 * computed from exactly these submissions and shown to the participants, so
 * pulling one out would rewrite a result people have already been given.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.ranking.access");
  if (forbidden) return forbidden;

  const { id, submissionId } = await params;
  await connectDB();

  const doc = await RankingSessionModel.findById(id).select("createdBy status").lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Same gate as editing the session — removing a submission is running it, not deleting it
  const isOwner = doc.createdBy === session!.user.id;
  if (!isOwner && !hasPermission(session, "tools.ranking.editAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (doc.status !== "draft" && doc.status !== "open") {
    return NextResponse.json(
      { error: "Submissions can only be removed while the session is open" },
      { status: 400 }
    );
  }

  const deleted = await RankingSubmissionModel.findOneAndDelete({
    _id: submissionId,
    sessionId: id,
  }).lean();
  if (!deleted) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
