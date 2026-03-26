import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { SheetModel } from "@/lib/models/Sheet";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sheetId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sheetId } = await params;
  await connectDB();
  const existing = await SheetModel.findById(sheetId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, url } = body;

  const update: Record<string, string> = {};
  if (name !== undefined) {
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    update.name = name.trim();
  }
  if (url !== undefined) {
    if (!url?.trim()) return NextResponse.json({ error: "URL is required" }, { status: 400 });
    update.url = url.trim();
  }

  const doc = await SheetModel.findByIdAndUpdate(sheetId, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    name: doc.name,
    url: doc.url,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sheetId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sheetId } = await params;
  await connectDB();
  const existing = await SheetModel.findById(sheetId).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await SheetModel.findByIdAndDelete(sheetId);
  return new NextResponse(null, { status: 204 });
}
