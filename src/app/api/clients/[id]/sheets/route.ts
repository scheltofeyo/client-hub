import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { SheetModel } from "@/lib/models/Sheet";
import { recordActivity } from "@/lib/activity";

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
  const docs = await SheetModel.find({ clientId }).sort({ createdAt: 1 }).lean();
  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      clientId: doc.clientId,
      name: doc.name,
      url: doc.url,
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
  if (!hasPermission(session, "sheets.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: clientId } = await params;
  const body = await req.json();
  const { name, url } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!url?.trim()) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  await connectDB();
  const doc = await SheetModel.create({
    clientId,
    name: name.trim(),
    url: url.trim(),
  });

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "sheet.created",
    metadata: { sheetId: doc._id.toString(), name: doc.name },
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      clientId: doc.clientId,
      name: doc.name,
      url: doc.url,
      createdAt: doc.createdAt?.toISOString().split("T")[0],
    },
    { status: 201 }
  );
}
