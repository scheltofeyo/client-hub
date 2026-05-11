import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await connectDB();
  await UserModel.updateOne(
    { _id: session.user.id },
    { $addToSet: { seenWhatsNewIds: id } }
  );

  return NextResponse.json({ ok: true });
}
