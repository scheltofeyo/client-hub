import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { recordActivity } from "@/lib/activity";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  // Check if user is admin or a lead on this client
  const existing = await ClientModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isLead = (existing.leads ?? []).some((l) => l.userId === session.user.id);
  if (!session.user.isAdmin && !isLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { company, status, platform, clientSince, employees, website, description, contacts, leads, archetypeId } = body;

  if (company !== undefined && !company?.trim()) {
    return NextResponse.json({ error: "Company name cannot be empty" }, { status: 400 });
  }

  // Only admins can reassign leads
  if (leads !== undefined && !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = {};
  if (company !== undefined) update.company = company.trim();
  if (status !== undefined) update.status = status || null;
  if (platform !== undefined) update.platform = platform || null;
  if (clientSince !== undefined) update.clientSince = clientSince?.trim() || null;
  if (employees !== undefined) update.employees = employees ? Number(employees) : null;
  if (website !== undefined) update.website = website.trim() || null;
  if (description !== undefined) update.description = description.trim() || null;
  if (contacts !== undefined) update.contacts = contacts;
  if (leads !== undefined) update.leads = leads;
  if (archetypeId !== undefined) update.archetypeId = archetypeId || null;

  const doc = await ClientModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Emit activity for contact changes
  if (contacts !== undefined) {
    type ContactInput = { id?: string; firstName?: string; lastName?: string };
    const oldIds = new Set((existing.contacts ?? []).map((c) => c.id));
    const newIds = new Set((contacts as ContactInput[]).map((c) => c.id ?? ""));
    const added = (contacts as ContactInput[]).filter((c) => c.id && !oldIds.has(c.id));
    const removed = (existing.contacts ?? []).filter((c) => !newIds.has(c.id));
    if (added.length > 0 || removed.length > 0) {
      await recordActivity({
        clientId: id,
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        type: "contact.changed",
        metadata: {
          added: added.map((c) => [c.firstName, c.lastName].filter(Boolean).join(" ")),
          removed: removed.map((c) => [c.firstName, c.lastName].filter(Boolean).join(" ")),
        },
      });
    }
  }

  // Emit activity for company data changes (non-contact fields)
  const companyFields = ["company", "status", "platform", "clientSince", "employees", "website", "description", "archetypeId"] as const;
  const changedFields = companyFields.filter((f) => body[f] !== undefined);
  if (changedFields.length > 0) {
    await recordActivity({
      clientId: id,
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      type: "client.updated",
      metadata: { fields: changedFields },
    });
  }

  return NextResponse.json({
    id: doc._id.toString(),
    company: doc.company,
    status: doc.status,
    employees: doc.employees,
    website: doc.website,
    description: doc.description,
    contacts: doc.contacts ?? [],
    leads: doc.leads ?? [],
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
  const doc = await ClientModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
