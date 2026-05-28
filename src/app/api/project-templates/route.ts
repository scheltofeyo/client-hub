import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ProjectTemplateModel } from "@/lib/models/ProjectTemplate";
import { TemplateTaskModel } from "@/lib/models/TemplateTask";
import { ServiceModel } from "@/lib/models/Service";
import { ProjectRoleModel } from "@/lib/models/ProjectRole";
import { calculateRolebasedPrice, type IRoleAllocationLine } from "@/lib/models/Project";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const rawDocs = await ProjectTemplateModel.find().lean();

  const templateIds = rawDocs.map((d) => d._id.toString());
  const taskCounts = await TemplateTaskModel.aggregate([
    { $match: { templateId: { $in: templateIds } } },
    { $group: { _id: "$templateId", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(taskCounts.map((t) => [t._id, t.count as number]));

  const serviceIds = [...new Set(rawDocs.map((d) => d.defaultServiceId).filter((id): id is string => !!id))];
  const services = serviceIds.length > 0
    ? await ServiceModel.find({ _id: { $in: serviceIds } }).select("name rank").lean()
    : [];
  const serviceNameMap = Object.fromEntries(services.map((s) => [s._id.toString(), s.name]));
  const serviceRankMap = Object.fromEntries(services.map((s) => [s._id.toString(), s.rank ?? Number.MAX_SAFE_INTEGER]));

  // Sort by service rank (matches admin ordering) then createdAt-desc within a service.
  const docs = [...rawDocs].sort((a, b) => {
    const ra = a.defaultServiceId ? serviceRankMap[a.defaultServiceId] ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const rb = b.defaultServiceId ? serviceRankMap[b.defaultServiceId] ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  });

  // Resolve effective price per template using live role rates for rolebased
  // templates (matches what the draft POST endpoint produces on creation).
  const roleIds = [...new Set(
    docs.flatMap((d) => (d.defaultRoleAllocation ?? []).map((l) => String(l.roleId ?? "")).filter((s) => s.length > 0))
  )];
  const roles = roleIds.length > 0
    ? await ProjectRoleModel.find({ _id: { $in: roleIds } }).lean()
    : [];
  const roleById = new Map(roles.map((r) => [r._id.toString(), r]));

  function effectivePriceFor(doc: typeof docs[number]): number | undefined {
    const mode = doc.defaultPricingMode ?? "rolebased";
    if (mode === "manual") return doc.defaultSoldPrice;
    const lines: IRoleAllocationLine[] = (doc.defaultRoleAllocation ?? []).map((l) => {
      const role = roleById.get(String(l.roleId ?? ""));
      return {
        roleId: String(l.roleId ?? ""),
        roleName: String(role?.name ?? l.roleName ?? ""),
        days: Number(l.days ?? 0),
        dayRate: Number(role?.dayRate ?? l.dayRate ?? 0),
        marginMultiplier: Number(role?.marginMultiplier ?? l.marginMultiplier ?? 1),
        isExternal: !!(role?.isExternal ?? l.isExternal),
        externalCostRate: role?.externalCostRate ?? l.externalCostRate,
      };
    });
    const price = calculateRolebasedPrice(lines);
    return price > 0 ? price : undefined;
  }

  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      summary: doc.summary ?? (doc as { description?: string }).description,
      defaultDescription: doc.defaultDescription,
      defaultWhy: doc.defaultWhy,
      defaultHow: doc.defaultHow,
      defaultWhat: doc.defaultWhat,
      defaultActivities: doc.defaultActivities,
      defaultDeliverables: doc.defaultDeliverables,
      defaultSoldPrice: doc.defaultSoldPrice,
      defaultServiceId: doc.defaultServiceId,
      defaultServiceName: doc.defaultServiceId ? serviceNameMap[doc.defaultServiceId] ?? null : null,
      defaultDeliveryDays: doc.defaultDeliveryDays,
      taskCount: countMap[doc._id.toString()] ?? 0,
      effectivePrice: effectivePriceFor(doc),
      createdAt: doc.createdAt?.toISOString().split("T")[0],
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectTemplates");
  if (forbidden) return forbidden;

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
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const doc = await ProjectTemplateModel.create({
    name: name.trim(),
    summary: summary?.trim() || undefined,
    defaultDescription: defaultDescription?.trim() || undefined,
    defaultWhy: defaultWhy?.trim() || undefined,
    defaultHow: defaultHow?.trim() || undefined,
    defaultWhat: defaultWhat?.trim() || undefined,
    defaultActivities: defaultActivities?.trim() || undefined,
    defaultDeliverables: defaultDeliverables?.trim() || undefined,
    defaultSoldPrice: defaultSoldPrice ? Number(defaultSoldPrice) : undefined,
    defaultServiceId: defaultServiceId || undefined,
    defaultDeliveryDays: defaultDeliveryDays ? Number(defaultDeliveryDays) : undefined,
  });

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
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }, { status: 201 });
}
