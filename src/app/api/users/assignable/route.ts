import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const users = await UserModel.find({
    $or: [{ status: "active" }, { status: { $exists: false } }],
  }).sort({ name: 1 }).lean();

  return NextResponse.json(
    users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      image: u.image ?? null,
    }))
  );
}
