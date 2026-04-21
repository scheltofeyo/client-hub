import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { hasPermission, requirePermission } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.emailSignature.access");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? session!.user.id;

  if (userId !== session!.user.id && !hasPermission(session, "tools.emailSignature.generateAny")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const user = await UserModel.findById(userId).lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const imageUrl = user.image;
  if (!imageUrl) return NextResponse.json({ dataUrl: null });

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return NextResponse.json({ dataUrl: null });

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ dataUrl });
  } catch {
    return NextResponse.json({ dataUrl: null });
  }
}
