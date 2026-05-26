import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ProjectRoleModel } from "@/lib/models/ProjectRole";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectRoles");
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    update.name = trimmed;
  }
  if (body.dayRate !== undefined) update.dayRate = Number(body.dayRate);
  if (body.marginMultiplier !== undefined) update.marginMultiplier = Number(body.marginMultiplier);
  if (body.isExternal !== undefined) update.isExternal = !!body.isExternal;
  if (body.externalCostRate !== undefined) {
    update.externalCostRate =
      body.externalCostRate === null || body.externalCostRate === ""
        ? null
        : Number(body.externalCostRate);
  }
  // Clear externalCostRate if role is being switched to internal.
  if (body.isExternal === false) update.externalCostRate = null;

  if (body.bioNL !== undefined) {
    const trimmed = typeof body.bioNL === "string" ? body.bioNL.trim() : "";
    update.bioNL = trimmed || null;
  }
  if (body.bioEN !== undefined) {
    const trimmed = typeof body.bioEN === "string" ? body.bioEN.trim() : "";
    update.bioEN = trimmed || null;
  }

  await connectDB();
  const setEntries = Object.entries(update).filter(([, v]) => v !== null);
  const unsetEntries = Object.entries(update).filter(([, v]) => v === null);
  const mongoUpdate: Record<string, unknown> = {};
  if (setEntries.length > 0) mongoUpdate.$set = Object.fromEntries(setEntries);
  if (unsetEntries.length > 0) {
    mongoUpdate.$unset = Object.fromEntries(unsetEntries.map(([k]) => [k, 1]));
  }
  try {
    const doc = await ProjectRoleModel.findByIdAndUpdate(id, mongoUpdate, { new: true }).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: doc._id.toString(),
      name: doc.name,
      dayRate: doc.dayRate ?? 0,
      marginMultiplier: doc.marginMultiplier ?? 1,
      isExternal: !!doc.isExternal,
      externalCostRate: doc.externalCostRate ?? undefined,
      rank: doc.rank ?? 0,
      bioNL: doc.bioNL ?? "",
      bioEN: doc.bioEN ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectRoles");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await ProjectRoleModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
