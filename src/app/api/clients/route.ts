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
  const { company, status, platform, clientSince, employees, website, description, createFolder } = body;

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
    folderStatus: createFolder ? "pending" : undefined,
  });

  if (createFolder) {
    const webhookUrl = process.env.GAS_FOLDER_WEBHOOK_URL;
    const secret = process.env.GAS_FOLDER_WEBHOOK_SECRET;
    const appUrl = process.env.APP_URL;
    if (webhookUrl && secret && appUrl) {
      try {
        console.log("[folder-webhook] Calling GAS webhook:", webhookUrl);
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: doc.company,
            clientId: doc._id.toString(),
            appCallbackUrl: `${appUrl}/api/internal/folder-callback`,
            secret,
          }),
        });
        const text = await res.text();
        console.log("[folder-webhook] GAS response:", res.status, text);
      } catch (err) {
        console.error("[folder-webhook] Failed to call GAS webhook:", err);
      }
    } else {
      console.warn("[folder-webhook] Missing env vars: GAS_FOLDER_WEBHOOK_URL, GAS_FOLDER_WEBHOOK_SECRET, or APP_URL");
    }
  }

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
      folderStatus: doc.folderStatus,
    },
    { status: 201 }
  );
}
