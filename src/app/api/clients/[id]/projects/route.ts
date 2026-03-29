import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel } from "@/lib/models/Project";
import { TaskModel } from "@/lib/models/Task";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";
import { UserModel } from "@/lib/models/User";
import { recordActivity } from "@/lib/activity";
import type { TaskAssignee } from "@/types";

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
      completedDate: doc.completedDate,
      deliveryDate: doc.deliveryDate,
      soldPrice: doc.soldPrice,
      templateId: doc.templateId,
      serviceId: doc.serviceId,
      labelId: doc.labelId,
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
  const { title, description, soldPrice, templateId, serviceId, labelId, deliveryDate } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const doc = await ProjectModel.create({
    clientId: id,
    title: title.trim(),
    description: description?.trim() || undefined,
    status: "not_started",
    soldPrice: soldPrice ? Number(soldPrice) : undefined,
    templateId: templateId || undefined,
    serviceId: serviceId || undefined,
    labelId: labelId || undefined,
    deliveryDate: deliveryDate || undefined,
  });

  // Bulk-create tasks from template if one was used
  if (templateId) {
    const templateTasks = await TemplateTaskModel.find({ templateId })
      .sort({ order: 1 })
      .lean();

    if (templateTasks.length > 0) {
      // Resolve client lead assignees if any task needs them
      const needsLeads = templateTasks.some((t) => t.assignToClientLead);
      let leadAssignees: TaskAssignee[] = [];
      if (needsLeads && (client.leads ?? []).length > 0) {
        const leadIds = (client.leads ?? []).map((l) => l.userId);
        const leadUsers = await UserModel.find(
          { _id: { $in: leadIds } },
          { _id: 1, image: 1 }
        ).lean();
        const imgMap = Object.fromEntries(
          leadUsers.map((u) => [u._id.toString(), u.image ?? undefined])
        );
        leadAssignees = (client.leads ?? []).map((l) => ({
          userId: l.userId,
          name: l.name,
          image: imgMap[l.userId],
        }));
      }

      const projectId = doc._id.toString();
      const idMap: Record<string, string> = {};

      // Pass 1: top-level tasks (no parentTaskId)
      const topLevel = templateTasks.filter((t) => !t.parentTaskId);
      for (const tt of topLevel) {
        const created = await TaskModel.create({
          projectId,
          title: tt.title,
          description: tt.description || undefined,
          assignees: tt.assignToClientLead ? leadAssignees : [],
          createdById: session.user.id,
          createdByName: session.user.name ?? "Unknown",
        });
        idMap[tt._id.toString()] = created._id.toString();
      }

      // Pass 2: subtasks
      const subtasks = templateTasks.filter((t) => !!t.parentTaskId);
      for (const tt of subtasks) {
        const resolvedParentId = idMap[tt.parentTaskId!];
        if (!resolvedParentId) continue; // orphan — skip gracefully
        const created = await TaskModel.create({
          projectId,
          parentTaskId: resolvedParentId,
          title: tt.title,
          description: tt.description || undefined,
          assignees: tt.assignToClientLead ? leadAssignees : [],
          createdById: session.user.id,
          createdByName: session.user.name ?? "Unknown",
        });
        idMap[tt._id.toString()] = created._id.toString();
      }
    }
  }

  await recordActivity({
    clientId: id,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "project.created",
    metadata: { projectId: doc._id.toString(), title: doc.title },
  });

  return NextResponse.json({
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    completedDate: doc.completedDate,
    deliveryDate: doc.deliveryDate,
    soldPrice: doc.soldPrice,
    templateId: doc.templateId,
    serviceId: doc.serviceId,
    labelId: doc.labelId,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }, { status: 201 });
}
