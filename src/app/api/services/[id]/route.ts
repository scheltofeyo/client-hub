import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ServiceModel } from "@/lib/models/Service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { name, checkInDays } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const parsedDays = checkInDays != null && checkInDays !== "" ? Number(checkInDays) : null;

  await connectDB();
  try {
    const doc = await ServiceModel.findByIdAndUpdate(
      id,
      { $set: { name: name.trim(), checkInDays: parsedDays } },
      { new: true }
    ).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ id: doc._id.toString(), name: doc.name, rank: doc.rank ?? 0, checkInDays: doc.checkInDays ?? null });
  } catch {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  const doc = await ServiceModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
