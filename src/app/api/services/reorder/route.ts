import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ServiceModel } from "@/lib/models/Service";
import { invalidateTtl, TTL_KEYS } from "@/lib/ttl-cache";

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.services");
  if (forbidden) return forbidden;

  const { ids } = await req.json();
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  await connectDB();
  await Promise.all(
    ids.map((id: string, index: number) =>
      ServiceModel.findByIdAndUpdate(id, { $set: { rank: index } })
    )
  );
  invalidateTtl(TTL_KEYS.services);

  return NextResponse.json({ success: true });
}
