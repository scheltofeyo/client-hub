import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { RoleModel } from "@/lib/models/Role";
import { UserModel } from "@/lib/models/User";
import { requirePermission } from "@/lib/auth-helpers";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "roles.manage");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await RoleModel.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userCount = await UserModel.countDocuments({ role: doc.slug });

  return NextResponse.json({
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? "",
    permissions: doc.permissions,
    isSystem: doc.isSystem,
    rank: doc.rank ?? 0,
    userCount,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "roles.manage");
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await req.json();

  await connectDB();
  const existing = await RoleModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    update.name = body.name.trim();
    // Don't allow slug change on system roles
    if (!existing.isSystem) {
      update.slug = body.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
  }

  if (body.description !== undefined) {
    update.description = body.description?.trim() ?? "";
  }

  if (body.permissions !== undefined) {
    const permSet = new Set<string>(ALL_PERMISSIONS);
    const perms: string[] = Array.isArray(body.permissions)
      ? body.permissions.filter((p: string) => permSet.has(p))
      : [];

    // Prevent removing roles.manage from the admin system role (lockout protection)
    if (existing.isSystem && existing.slug === "admin" && !perms.includes("roles.manage")) {
      perms.push("roles.manage");
    }

    update.permissions = perms;
  }

  const doc = await RoleModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? "",
    permissions: doc.permissions,
    isSystem: doc.isSystem,
    rank: doc.rank ?? 0,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "roles.manage");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const existing = await RoleModel.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.isSystem) {
    return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 400 });
  }

  const userCount = await UserModel.countDocuments({ role: existing.slug });
  if (userCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete role — ${userCount} user(s) still assigned` },
      { status: 400 }
    );
  }

  await RoleModel.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
