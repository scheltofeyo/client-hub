import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RankingSessionModel } from "@/lib/models/RankingSession";
import { RankingSubmissionModel } from "@/lib/models/RankingSubmission";

/**
 * Public: create a pending submission or complete an existing one.
 *
 * Body for creating pending: { participantName, participantEmail }
 * Body for completing:       { submissionId, rankings }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const session = await RankingSessionModel.findOne({ shareCode }).lean();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const body = await req.json();
  const sessionId = session._id.toString();

  // ── Complete an existing submission ──
  if (body.submissionId && body.rankings) {
    // Re-check session is still open
    if (session.status === "closed" || session.status === "archived") {
      return NextResponse.json({ error: "Session is closed" }, { status: 400 });
    }

    const doc = await RankingSubmissionModel.findByIdAndUpdate(
      body.submissionId,
      {
        $set: {
          rankings: body.rankings,
          status: "completed",
          submittedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!doc) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

    return NextResponse.json({
      id: doc._id.toString(),
      sessionId: doc.sessionId,
      participantName: doc.participantName,
      participantEmail: doc.participantEmail,
      rankings: doc.rankings,
      status: doc.status,
      submittedAt: doc.submittedAt?.toISOString(),
    });
  }

  // ── Create a pending submission ──
  const { participantName, participantEmail } = body;
  if (!participantName?.trim() || !participantEmail?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  if (session.status !== "open") {
    return NextResponse.json({ error: "Session is not accepting submissions" }, { status: 400 });
  }

  try {
    const doc = await RankingSubmissionModel.create({
      sessionId,
      participantName: participantName.trim(),
      participantEmail: participantEmail.trim().toLowerCase(),
      rankings: null,
      status: "in_progress",
    });

    return NextResponse.json(
      {
        id: doc._id.toString(),
        sessionId: doc.sessionId,
        participantName: doc.participantName,
        participantEmail: doc.participantEmail,
        rankings: doc.rankings,
        status: doc.status,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    // Unique constraint violation — duplicate email
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      return NextResponse.json(
        { error: "A submission with this email address already exists." },
        { status: 409 }
      );
    }
    throw err;
  }
}
