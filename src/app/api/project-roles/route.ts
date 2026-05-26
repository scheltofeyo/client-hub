import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ProjectRoleModel } from "@/lib/models/ProjectRole";

function serialize(d: { _id: { toString(): string }; name: string; dayRate?: number; marginMultiplier?: number; isExternal?: boolean; externalCostRate?: number; rank?: number; bioNL?: string; bioEN?: string; createdAt?: Date }) {
  return {
    id: d._id.toString(),
    name: d.name,
    dayRate: d.dayRate ?? 0,
    marginMultiplier: d.marginMultiplier ?? 1,
    isExternal: !!d.isExternal,
    externalCostRate: d.externalCostRate ?? undefined,
    rank: d.rank ?? 0,
    bioNL: d.bioNL ?? "",
    bioEN: d.bioEN ?? "",
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : undefined,
  };
}

export async function GET() {
  await connectDB();
  const docs = await ProjectRoleModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  return NextResponse.json(docs.map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.projectRoles");
  if (forbidden) return forbidden;

  const { name, dayRate, marginMultiplier, isExternal, externalCostRate, bioNL, bioEN } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await connectDB();
  const last = await ProjectRoleModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;

  try {
    const doc = await ProjectRoleModel.create({
      name: name.trim(),
      dayRate: Number(dayRate ?? 0),
      marginMultiplier: Number(marginMultiplier ?? 1),
      isExternal: !!isExternal,
      externalCostRate:
        isExternal && externalCostRate != null && externalCostRate !== ""
          ? Number(externalCostRate)
          : undefined,
      rank,
      bioNL: typeof bioNL === "string" ? bioNL.trim() : undefined,
      bioEN: typeof bioEN === "string" ? bioEN.trim() : undefined,
    });
    return NextResponse.json(serialize(doc.toObject()), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 });
  }
}
