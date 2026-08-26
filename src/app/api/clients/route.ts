import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { requirePermission } from "@/lib/auth-helpers";
import { createClient, serializeCreatedClient } from "@/lib/clients";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const docs = await ClientModel.find().sort({ createdAt: -1 }).lean();
  const clients = docs.map((doc) => ({
    id: doc._id.toString(),
    company: doc.company,
    status: doc.status,
    employees: doc.employees,
    website: doc.website,
    description: doc.description,
    primaryColor: doc.primaryColor ?? undefined,
    createdAt: doc.createdAt.toISOString().split("T")[0],
    contacts: doc.contacts ?? [],
    leads: doc.leads ?? [],
    culturalDna: doc.culturalDna ?? [],
    culturalLevels: doc.culturalLevels ?? [],
  }));
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "clients.create");
  if (forbidden) return forbidden;

  const body = await req.json();

  const created = await createClient(session!, body);
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });

  return NextResponse.json(serializeCreatedClient(created.client), { status: 201 });
}
