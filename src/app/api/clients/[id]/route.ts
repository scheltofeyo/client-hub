import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel } from "@/lib/models/Project";
import { TaskModel } from "@/lib/models/Task";
import { LogModel } from "@/lib/models/Log";
import { ClientEventModel } from "@/lib/models/ClientEvent";
import { SheetModel } from "@/lib/models/Sheet";
import { ActivityEventModel } from "@/lib/models/ActivityEvent";
import { recordActivity } from "@/lib/activity";
import { hasPermission, hasPermissionOrIsLead, requirePermission } from "@/lib/auth-helpers";
import { ClientStatusOptionModel } from "@/lib/models/ClientStatusOption";
import { ClientPlatformOptionModel } from "@/lib/models/ClientPlatformOption";

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

  if (!hasPermissionOrIsLead(session, "clients.edit", existing.leads ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { company, status, platform, clientSince, employees, website, description, primaryColor, contacts, leads, archetypeId, culturalDna, culturalLevels } = body;

  if (company !== undefined && !company?.trim()) {
    return NextResponse.json({ error: "Company name cannot be empty" }, { status: 400 });
  }

  // Only users with assignLeads permission can reassign leads
  if (leads !== undefined && !hasPermission(session, "clients.assignLeads")) {
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
  if (primaryColor !== undefined) update.primaryColor = primaryColor?.trim() || null;
  if (contacts !== undefined) update.contacts = contacts;
  if (leads !== undefined) update.leads = leads;
  if (archetypeId !== undefined) update.archetypeId = archetypeId || null;
  if (culturalDna !== undefined) update.culturalDna = culturalDna;
  if (culturalLevels !== undefined) update.culturalLevels = culturalLevels;

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

  // Emit granular activity for status changes
  if (status !== undefined) {
    const newVal = status || null;
    const oldVal = existing.status ?? null;
    if (oldVal !== newVal) {
      const [fromOpt, toOpt] = await Promise.all([
        oldVal ? ClientStatusOptionModel.findOne({ slug: oldVal }).lean() : null,
        newVal ? ClientStatusOptionModel.findOne({ slug: newVal }).lean() : null,
      ]);
      await recordActivity({
        clientId: id,
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        type: "client.status_changed",
        metadata: {
          from: oldVal, to: newVal,
          fromLabel: fromOpt?.label ?? oldVal, toLabel: toOpt?.label ?? newVal,
        },
      });
    }
  }

  // Emit granular activity for platform changes
  if (platform !== undefined) {
    const newVal = platform || null;
    const oldVal = existing.platform ?? null;
    if (oldVal !== newVal) {
      const [fromOpt, toOpt] = await Promise.all([
        oldVal ? ClientPlatformOptionModel.findOne({ slug: oldVal }).lean() : null,
        newVal ? ClientPlatformOptionModel.findOne({ slug: newVal }).lean() : null,
      ]);
      await recordActivity({
        clientId: id,
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        type: "client.platform_changed",
        metadata: {
          from: oldVal, to: newVal,
          fromLabel: fromOpt?.label ?? oldVal, toLabel: toOpt?.label ?? newVal,
        },
      });
    }
  }

  // Emit activity for lead changes
  if (leads !== undefined) {
    type LeadInput = { userId: string; name?: string };
    const oldIds = new Set((existing.leads ?? []).map((l) => l.userId));
    const newIds = new Set((leads as LeadInput[]).map((l) => l.userId));
    const added = (leads as LeadInput[]).filter((l) => !oldIds.has(l.userId)).map((l) => l.name ?? "Unknown");
    const removed = (existing.leads ?? []).filter((l) => !newIds.has(l.userId)).map((l) => l.name);
    if (added.length > 0 || removed.length > 0) {
      await recordActivity({
        clientId: id,
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        type: "client.leads_changed",
        metadata: { added, removed },
      });
    }
  }

  // Emit activity for remaining company data changes (non-contact, non-status, non-platform, non-leads)
  const companyFields = ["company", "clientSince", "employees", "website", "description", "primaryColor", "archetypeId"] as const;
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
    primaryColor: doc.primaryColor ?? undefined,
    contacts: doc.contacts ?? [],
    leads: doc.leads ?? [],
    culturalDna: doc.culturalDna ?? [],
    culturalLevels: doc.culturalLevels ?? [],
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "clients.delete");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await ClientModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await Promise.all([
    ProjectModel.deleteMany({ clientId: id }),
    TaskModel.deleteMany({ clientId: id }),
    LogModel.deleteMany({ clientId: id }),
    ClientEventModel.deleteMany({ clientId: id }),
    SheetModel.deleteMany({ clientId: id }),
    ActivityEventModel.deleteMany({ clientId: id }),
  ]);

  return NextResponse.json({ success: true });
}
