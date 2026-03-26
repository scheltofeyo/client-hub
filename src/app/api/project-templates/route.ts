import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ProjectTemplateModel } from "@/lib/models/ProjectTemplate";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const docs = await ProjectTemplateModel.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      defaultDescription: doc.defaultDescription,
      defaultSoldPrice: doc.defaultSoldPrice,
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
  const { name, description, defaultDescription, defaultSoldPrice } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const doc = await ProjectTemplateModel.create({
    name: name.trim(),
    description: description?.trim() || undefined,
    defaultDescription: defaultDescription?.trim() || undefined,
    defaultSoldPrice: defaultSoldPrice ? Number(defaultSoldPrice) : undefined,
  });

  return NextResponse.json({
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    defaultDescription: doc.defaultDescription,
    defaultSoldPrice: doc.defaultSoldPrice,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }, { status: 201 });
}
