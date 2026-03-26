import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel } from "@/lib/models/Project";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const docs = await ProjectModel.find({ clientId: id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      clientId: doc.clientId,
      title: doc.title,
      description: doc.description,
      status: doc.status,
      deliveryDate: doc.deliveryDate,
      soldPrice: doc.soldPrice,
      templateId: doc.templateId,
      createdAt: doc.createdAt?.toISOString().split("T")[0],
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const client = await ClientModel.findById(id).lean();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const isLead = (client.leads ?? []).some((l) => l.userId === session.user.id);
  if (!session.user.isAdmin && !isLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, status, deliveryDate, soldPrice, templateId, serviceId } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const doc = await ProjectModel.create({
    clientId: id,
    title: title.trim(),
    description: description?.trim() || undefined,
    status: status || "planning",
    deliveryDate: deliveryDate?.trim() || undefined,
    soldPrice: soldPrice ? Number(soldPrice) : undefined,
    templateId: templateId || undefined,
    serviceId: serviceId || undefined,
  });

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    deliveryDate: doc.deliveryDate,
    soldPrice: doc.soldPrice,
    templateId: doc.templateId,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }, { status: 201 });
}
