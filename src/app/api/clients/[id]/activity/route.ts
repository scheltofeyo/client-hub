import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ActivityEventModel } from "@/lib/models/ActivityEvent";
import { UserModel } from "@/lib/models/User";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 200);

  await connectDB();
  const docs = await ActivityEventModel.find({ clientId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Live lookup of current user images by actorId.
  // Some events use sentinel actorIds (e.g. "public" for client-side plan
  // acceptance) that aren't ObjectIds — filter those out so Mongoose doesn't
  // throw a CastError on the $in query.
  const actorIds = [...new Set(docs.map((d) => d.actorId))].filter((id) =>
    /^[a-f0-9]{24}$/i.test(id)
  );
  const users = await UserModel.find({ _id: { $in: actorIds } }, { _id: 1, image: 1 }).lean();
  const imgMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.image ?? null]));

  return NextResponse.json(
    docs.map((doc) => ({
      id: doc._id.toString(),
      clientId: doc.clientId,
      actorId: doc.actorId,
      actorName: doc.actorName,
      actorImage: imgMap[doc.actorId] ?? null,
      type: doc.type,
      metadata: doc.metadata ?? {},
      createdAt: doc.createdAt.toISOString(),
    }))
  );
}
