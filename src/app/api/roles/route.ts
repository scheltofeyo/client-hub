import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { RoleModel } from "@/lib/models/Role";
import { UserModel } from "@/lib/models/User";
import { hasPermission, requirePermission } from "@/lib/auth-helpers";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "roles.manage");
  if (forbidden) return forbidden;

  await connectDB();
  const roles = await RoleModel.find().sort({ rank: 1, createdAt: 1 }).lean();

  // Count users per role
  const userCounts = await UserModel.aggregate([
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(userCounts.map((r) => [r._id, r.count]));

  return NextResponse.json(
    roles.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      slug: r.slug,
      description: r.description ?? "",
      permissions: r.permissions,
      isSystem: r.isSystem,
      rank: r.rank ?? 0,
      userCount: countMap.get(r.slug) ?? 0,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "roles.manage");
  if (forbidden) return forbidden;

  const { name, description, permissions } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  // Validate permission strings
  const permSet = new Set<string>(ALL_PERMISSIONS);
  const perms: string[] = Array.isArray(permissions)
    ? permissions.filter((p: string) => permSet.has(p))
    : [];

  await connectDB();

  const existing = await RoleModel.findOne({ slug }).lean();
  if (existing) {
    return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
  }

  const last = await RoleModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;

  const doc = await RoleModel.create({
    name: name.trim(),
    slug,
    description: description?.trim() ?? "",
    permissions: perms,
    isSystem: false,
    rank,
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      permissions: doc.permissions,
      isSystem: doc.isSystem,
      rank: doc.rank,
      userCount: 0,
    },
    { status: 201 }
  );
}
