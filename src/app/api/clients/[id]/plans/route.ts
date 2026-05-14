import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { ProjectModel, calculateRolebasedPrice } from "@/lib/models/Project";
import { hasPermission, hasPermissionOrIsLead } from "@/lib/auth-helpers";
import { ensureUniqueShareCode } from "@/lib/share-codes";

function serializePlan(input: unknown) {
  const d = input as Record<string, unknown> & { _id: { toString(): string }; createdAt?: Date; updatedAt?: Date };
  return {
    id: d._id.toString(),
    clientId: d.clientId,
    title: d.title,
    summary: d.summary ?? null,
    status: d.status,
    discountType: d.discountType ?? null,
    discountValue: d.discountValue ?? null,
    vatRate: d.vatRate ?? null,
    createdBy: d.createdBy,
    acceptedBy: d.acceptedBy ?? null,
    acceptedAt: d.acceptedAt ?? null,
    presentedAt: d.presentedAt ?? null,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : undefined,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : undefined,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, "projectPlans.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  const [plansRaw, draftProjects] = await Promise.all([
    ProjectPlanModel.find({ clientId: id }).sort({ createdAt: -1 }).lean(),
    ProjectModel.find({ clientId: id, status: "draft" }, { planId: 1, soldPrice: 1 }).lean(),
  ]);

  // Lazy backfill: ensure every plan has a shareCode.
  const plans = await Promise.all(
    plansRaw.map(async (p) => {
      if ((p as { shareCode?: string }).shareCode) return p;
      const code = await ensureUniqueShareCode((c) => ProjectPlanModel.exists({ shareCode: c }));
      await ProjectPlanModel.findByIdAndUpdate(p._id, { $set: { shareCode: code } });
      return { ...p, shareCode: code };
    })
  );

  // Pre-compute draft count and subtotal per plan
  const summaryByPlan = new Map<string, { draftCount: number; subtotal: number }>();
  for (const p of draftProjects) {
    const pid = (p.planId as string | undefined)?.toString();
    if (!pid) continue;
    const entry = summaryByPlan.get(pid) ?? { draftCount: 0, subtotal: 0 };
    entry.draftCount += 1;
    entry.subtotal += Number(p.soldPrice ?? 0);
    summaryByPlan.set(pid, entry);
  }

  return NextResponse.json(
    plans.map((p) => {
      const planId = p._id.toString();
      const summary = summaryByPlan.get(planId) ?? { draftCount: 0, subtotal: 0 };
      return {
        ...serializePlan(p),
        shareCode: (p as { shareCode?: string }).shareCode ?? null,
        draftCount: summary.draftCount,
        subtotal: summary.subtotal,
      };
    })
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

  if (!hasPermissionOrIsLead(session, "projectPlans.create", client.leads ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, summary, discountType, discountValue, vatRate } = body;
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const shareCode = await ensureUniqueShareCode((code) =>
    ProjectPlanModel.exists({ shareCode: code })
  );

  const createdByActor = {
    userId: session.user.id,
    name: session.user.name ?? "Unknown",
    image: session.user.image ?? undefined,
  };

  const doc = await ProjectPlanModel.create({
    clientId: id,
    title: title.trim(),
    summary: summary || undefined,
    status: "draft",
    discountType: discountType === "percentage" || discountType === "amount" ? discountType : undefined,
    discountValue: discountValue != null ? Number(discountValue) : undefined,
    vatRate: vatRate != null ? Number(vatRate) : undefined,
    shareCode,
    createdBy: createdByActor,
    acceptanceLog: [
      {
        type: "created",
        at: new Date().toISOString(),
        source: "internal",
        by: createdByActor,
      },
    ],
  });

  // Force re-derivation of soldPrice for any drafts (none expected at create time)
  void calculateRolebasedPrice;

  return NextResponse.json(
    { ...serializePlan(doc.toObject()), shareCode, draftCount: 0, subtotal: 0 },
    { status: 201 }
  );
}
