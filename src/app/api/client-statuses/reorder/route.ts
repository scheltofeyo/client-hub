import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ClientStatusOptionModel } from "@/lib/models/ClientStatusOption";
import { invalidateTtl, TTL_KEYS } from "@/lib/ttl-cache";

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.clientStatuses");
  if (forbidden) return forbidden;

  const { ids } = await req.json();
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  await connectDB();
  await Promise.all(
    ids.map((id: string, index: number) =>
      ClientStatusOptionModel.findByIdAndUpdate(id, { $set: { rank: index } })
    )
  );
  invalidateTtl(TTL_KEYS.clientStatuses);

  return NextResponse.json({ success: true });
}
