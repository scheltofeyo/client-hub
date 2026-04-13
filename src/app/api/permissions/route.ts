import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { PERMISSION_GROUPS, LEAD_PERMISSION_GROUPS } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "roles.manage");
  if (forbidden) return forbidden;

  return NextResponse.json({
    global: PERMISSION_GROUPS,
    lead: LEAD_PERMISSION_GROUPS,
  });
}
