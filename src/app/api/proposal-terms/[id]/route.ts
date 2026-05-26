import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ProposalTermsSectionModel } from "@/lib/models/ProposalTermsSection";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  const { slug, titleNL, titleEN, contentNL, contentEN } = await req.json();

  const update: Record<string, unknown> = {};
  if (slug !== undefined) {
    if (!slug?.trim()) return NextResponse.json({ error: "slug cannot be empty" }, { status: 400 });
    update.slug = slug.trim();
  }
  if (titleNL !== undefined) {
    if (!titleNL?.trim()) return NextResponse.json({ error: "titleNL cannot be empty" }, { status: 400 });
    update.titleNL = titleNL.trim();
  }
  if (titleEN !== undefined) {
    if (!titleEN?.trim()) return NextResponse.json({ error: "titleEN cannot be empty" }, { status: 400 });
    update.titleEN = titleEN.trim();
  }
  if (contentNL !== undefined) update.contentNL = typeof contentNL === "string" ? contentNL : "";
  if (contentEN !== undefined) update.contentEN = typeof contentEN === "string" ? contentEN : "";

  await connectDB();
  try {
    const doc = await ProposalTermsSectionModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: doc._id.toString(),
      slug: doc.slug,
      titleNL: doc.titleNL,
      titleEN: doc.titleEN,
      contentNL: doc.contentNL,
      contentEN: doc.contentEN,
      rank: doc.rank ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update terms section";
    const status = /duplicate/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.access");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await ProposalTermsSectionModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
