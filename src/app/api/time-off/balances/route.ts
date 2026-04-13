import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { getTimeOffBalances } from "@/lib/data";

export async function GET(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "team.viewBalances");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get("year") ?? String(new Date().getFullYear());
  const year = parseInt(yearStr, 10);

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const balances = await getTimeOffBalances(year);
  return NextResponse.json(balances);
}
