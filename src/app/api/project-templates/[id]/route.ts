import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ProjectTemplateModel } from "@/lib/models/ProjectTemplate";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectTemplates");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const body = await req.json();
  const {
    name,
    summary,
    defaultDescription,
    defaultWhy,
    defaultHow,
    defaultWhat,
    defaultActivities,
    defaultDeliverables,
    defaultSoldPrice,
    defaultServiceId,
    defaultDeliveryDays,
    defaultPricingMode,
    defaultRoleAllocation,
  } = body;

  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  const unset: Record<string, unknown> = {};
  if (name !== undefined) update.name = name.trim();
  if (summary !== undefined) {
    update.summary = summary?.trim() || null;
    unset.description = "";
  }
  if (defaultDescription !== undefined) update.defaultDescription = defaultDescription?.trim() || null;
  if (defaultWhy !== undefined) update.defaultWhy = defaultWhy?.trim() || null;
  if (defaultHow !== undefined) update.defaultHow = defaultHow?.trim() || null;
  if (defaultWhat !== undefined) update.defaultWhat = defaultWhat?.trim() || null;
  if (defaultActivities !== undefined) update.defaultActivities = defaultActivities?.trim() || null;
  if (defaultDeliverables !== undefined) update.defaultDeliverables = defaultDeliverables?.trim() || null;
  if (defaultSoldPrice !== undefined) update.defaultSoldPrice = defaultSoldPrice ? Number(defaultSoldPrice) : null;
  if (defaultServiceId !== undefined) update.defaultServiceId = defaultServiceId || null;
  if (defaultDeliveryDays !== undefined) update.defaultDeliveryDays = defaultDeliveryDays ? Number(defaultDeliveryDays) : null;
  if (defaultPricingMode !== undefined) {
    update.defaultPricingMode =
      defaultPricingMode === "rolebased" ? "rolebased" : "manual";
  }
  if (defaultRoleAllocation !== undefined) {
    update.defaultRoleAllocation = Array.isArray(defaultRoleAllocation)
      ? defaultRoleAllocation.map((l: Record<string, unknown>) => ({
          roleId: String(l.roleId ?? ""),
          roleName: String(l.roleName ?? ""),
          days: Number(l.days ?? 0),
          dayRate: Number(l.dayRate ?? 0),
          marginMultiplier: Number(l.marginMultiplier ?? 1),
          isExternal: !!l.isExternal,
          externalCostRate:
            l.externalCostRate == null || l.externalCostRate === ""
              ? undefined
              : Number(l.externalCostRate),
        }))
      : [];
  }

  const mod: Record<string, unknown> = { $set: update };
  if (Object.keys(unset).length) mod.$unset = unset;

  const doc = await ProjectTemplateModel.findByIdAndUpdate(id, mod, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    name: doc.name,
    summary: doc.summary,
    defaultDescription: doc.defaultDescription,
    defaultWhy: doc.defaultWhy,
    defaultHow: doc.defaultHow,
    defaultWhat: doc.defaultWhat,
    defaultActivities: doc.defaultActivities,
    defaultDeliverables: doc.defaultDeliverables,
    defaultSoldPrice: doc.defaultSoldPrice,
    defaultServiceId: doc.defaultServiceId,
    defaultDeliveryDays: doc.defaultDeliveryDays,
    defaultPricingMode: doc.defaultPricingMode ?? "rolebased",
    defaultRoleAllocation: doc.defaultRoleAllocation ?? [],
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectTemplates");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await ProjectTemplateModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await TemplateTaskModel.deleteMany({ templateId: id });
  return NextResponse.json({ success: true });
}
