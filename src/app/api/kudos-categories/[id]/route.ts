import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { KudosCategoryModel } from "@/lib/models/KudosCategory";
import { KudosModel } from "@/lib/models/Kudos";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.kudosCategories");
  if (forbidden) return forbidden;

  const { id } = await params;
  const { label, color, icon } = await req.json();

  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  await connectDB();
  const doc = await KudosCategoryModel.findByIdAndUpdate(
    id,
    { $set: { label: label.trim(), color, icon } },
    { new: true }
  ).lean();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await KudosModel.updateMany(
    { categoryId: id },
    {
      $set: {
        "categorySnapshot.label": doc.label,
        "categorySnapshot.color": doc.color,
        "categorySnapshot.icon": doc.icon,
        "categorySnapshot.slug": doc.slug,
      },
    }
  );

  return NextResponse.json({
    id: doc._id.toString(),
    slug: doc.slug,
    label: doc.label,
    color: doc.color,
    icon: doc.icon,
    rank: doc.rank,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.kudosCategories");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await KudosCategoryModel.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await KudosCategoryModel.findByIdAndDelete(id);
  await KudosModel.updateMany(
    { categoryId: id },
    { $unset: { categoryId: "", categorySnapshot: "" } }
  );

  return NextResponse.json({ success: true });
}
