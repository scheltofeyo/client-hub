import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ClientPlatformOptionModel } from "@/lib/models/ClientPlatformOption";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.clientPlatforms");
  if (forbidden) return forbidden;

  const { id } = await params;
  const { label } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  await connectDB();
  try {
    const doc = await ClientPlatformOptionModel.findByIdAndUpdate(
      id,
      { $set: { label: label.trim() } },
      { new: true }
    ).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ id: doc._id.toString(), slug: doc.slug, label: doc.label, rank: doc.rank });
  } catch {
    return NextResponse.json({ error: "Label already exists" }, { status: 409 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.clientPlatforms");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await ClientPlatformOptionModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
