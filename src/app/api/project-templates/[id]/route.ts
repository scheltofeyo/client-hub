import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ProjectTemplateModel } from "@/lib/models/ProjectTemplate";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  const body = await req.json();
  const { name, description, defaultDescription, defaultSoldPrice, defaultServiceId, defaultDeliveryDays } = body;

  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name.trim();
  if (description !== undefined) update.description = description?.trim() || null;
  if (defaultDescription !== undefined) update.defaultDescription = defaultDescription?.trim() || null;
  if (defaultSoldPrice !== undefined) update.defaultSoldPrice = defaultSoldPrice ? Number(defaultSoldPrice) : null;
  if (defaultServiceId !== undefined) update.defaultServiceId = defaultServiceId || null;
  if (defaultDeliveryDays !== undefined) update.defaultDeliveryDays = defaultDeliveryDays ? Number(defaultDeliveryDays) : null;

  const doc = await ProjectTemplateModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    defaultDescription: doc.defaultDescription,
    defaultSoldPrice: doc.defaultSoldPrice,
    defaultServiceId: doc.defaultServiceId,
    defaultDeliveryDays: doc.defaultDeliveryDays,
  });
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
  const doc = await ProjectTemplateModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await TemplateTaskModel.deleteMany({ templateId: id });
  return NextResponse.json({ success: true });
}
