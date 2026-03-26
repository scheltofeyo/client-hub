import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";

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
    createdAt: doc.createdAt.toISOString().split("T")[0],
    contacts: doc.contacts ?? [],
    leads: doc.leads ?? [],
  }));
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { company, status, platform, clientSince, employees, website, description } = body;

  if (!company?.trim()) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  await connectDB();
  const doc = await ClientModel.create({
    company: company.trim(),
    status: status || undefined,
    platform: platform || undefined,
    clientSince: clientSince?.trim() || undefined,
    employees: employees ? Number(employees) : undefined,
    website: website?.trim() || undefined,
    description: description?.trim() || undefined,
    contacts: [],
    leads: [],
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      company: doc.company,
      status: doc.status,
      employees: doc.employees,
      website: doc.website,
      description: doc.description,
      contacts: [],
      leads: [],
    },
    { status: 201 }
  );
}
