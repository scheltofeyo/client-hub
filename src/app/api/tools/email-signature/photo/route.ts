import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { hasPermission, requirePermission } from "@/lib/auth-helpers";

/** Well under the function budget — a missing photo degrades to `dataUrl: null`. */
const PHOTO_FETCH_TIMEOUT_MS = 4000;

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
    // Bounded: this fetches a third-party URL (a Google avatar host) from
    // inside a Netlify Function, and a synchronous function that outlives its
    // timeout is killed by the platform with a 502 rather than returning the
    // null this route already handles gracefully.
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS) });
    if (!res.ok) return NextResponse.json({ dataUrl: null });

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ dataUrl });
  } catch {
    return NextResponse.json({ dataUrl: null });
  }
}
