import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ProjectTemplateModel } from "@/lib/models/ProjectTemplate";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const docs = await ProjectTemplateModel.find().sort({ createdAt: -1 }).lean();

  const templateIds = docs.map((d) => d._id.toString());
  const taskCounts = await TemplateTaskModel.aggregate([
    { $match: { templateId: { $in: templateIds } } },
    { $group: { _id: "$templateId", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(taskCounts.map((t) => [t._id, t.count as number]));

  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      defaultDescription: doc.defaultDescription,
      defaultSoldPrice: doc.defaultSoldPrice,
      defaultServiceId: doc.defaultServiceId,
      defaultDeliveryDays: doc.defaultDeliveryDays,
      taskCount: countMap[doc._id.toString()] ?? 0,
      createdAt: doc.createdAt?.toISOString().split("T")[0],
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();
  const { name, description, defaultDescription, defaultSoldPrice, defaultServiceId, defaultDeliveryDays } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const doc = await ProjectTemplateModel.create({
    name: name.trim(),
    description: description?.trim() || undefined,
    defaultDescription: defaultDescription?.trim() || undefined,
    defaultSoldPrice: defaultSoldPrice ? Number(defaultSoldPrice) : undefined,
    defaultServiceId: defaultServiceId || undefined,
    defaultDeliveryDays: defaultDeliveryDays ? Number(defaultDeliveryDays) : undefined,
  });

  return NextResponse.json({
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    defaultDescription: doc.defaultDescription,
    defaultSoldPrice: doc.defaultSoldPrice,
    defaultServiceId: doc.defaultServiceId,
    defaultDeliveryDays: doc.defaultDeliveryDays,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }, { status: 201 });
}
