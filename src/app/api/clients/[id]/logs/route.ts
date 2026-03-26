import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { LogModel } from "@/lib/models/Log";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  await connectDB();
  const docs = await LogModel.find({ clientId }).sort({ date: -1, createdAt: -1 }).lean();
  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      clientId: doc.clientId,
      contactId: doc.contactId ?? undefined,
      date: doc.date,
      summary: doc.summary,
      signalIds: doc.signalIds ?? [],
      followUp: doc.followUp ?? false,
      followUpDeadline: doc.followUpDeadline ?? undefined,
      followedUpAt: doc.followedUpAt ?? undefined,
      followedUpByName: doc.followedUpByName ?? undefined,
      createdById: doc.createdById,
      createdByName: doc.createdByName,
      createdAt: doc.createdAt?.toISOString().split("T")[0],
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  const body = await req.json();
  const { contactId, date, summary, signalIds, followUp, followUpDeadline } = body;

  if (!date?.trim()) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }
  if (!summary?.trim()) {
    return NextResponse.json({ error: "Summary is required" }, { status: 400 });
  }

  await connectDB();
  const doc = await LogModel.create({
    clientId,
    contactId: contactId || undefined,
    date: date.trim(),
    summary: summary.trim(),
    signalIds: Array.isArray(signalIds) ? signalIds : [],
    followUp: !!followUp,
    followUpDeadline: followUp && followUpDeadline ? followUpDeadline : undefined,
    createdById: session.user.id,
    createdByName: session.user.name ?? "Unknown",
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      clientId: doc.clientId,
      contactId: doc.contactId ?? undefined,
      date: doc.date,
      summary: doc.summary,
      signalIds: doc.signalIds ?? [],
      followUp: doc.followUp ?? false,
      followUpDeadline: doc.followUpDeadline ?? undefined,
      createdById: doc.createdById,
      createdByName: doc.createdByName,
      createdAt: doc.createdAt?.toISOString().split("T")[0],
    },
    { status: 201 }
  );
}
