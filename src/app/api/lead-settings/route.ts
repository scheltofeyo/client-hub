import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { LeadSettingsModel, DEFAULT_LEAD_PERMISSIONS } from "@/lib/models/LeadSettings";
import { requirePermission } from "@/lib/auth-helpers";
import { LEAD_ELIGIBLE_PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "roles.manage");
  if (forbidden) return forbidden;

  await connectDB();
  const doc = await LeadSettingsModel.findOne().lean();

  return NextResponse.json({
    permissions: doc?.permissions ?? DEFAULT_LEAD_PERMISSIONS,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "roles.manage");
  if (forbidden) return forbidden;

  const { permissions } = await req.json();

  const eligible = new Set<string>(LEAD_ELIGIBLE_PERMISSIONS);
  const validated: string[] = Array.isArray(permissions)
    ? permissions.filter((p: string) => eligible.has(p))
    : [];

  await connectDB();
  const doc = await LeadSettingsModel.findOneAndUpdate(
    {},
    { $set: { permissions: validated } },
    { new: true, upsert: true }
  ).lean();

  return NextResponse.json({
    permissions: doc.permissions,
  });
}
