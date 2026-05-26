import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import {
  ProposalTermsSectionModel,
  getOrSeedProposalTerms,
} from "@/lib/models/ProposalTermsSection";

function serialize(doc: {
  _id: { toString(): string };
  slug: string;
  titleNL: string;
  titleEN: string;
  contentNL: string;
  contentEN: string;
  rank: number;
}) {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    titleNL: doc.titleNL,
    titleEN: doc.titleEN,
    contentNL: doc.contentNL,
    contentEN: doc.contentEN,
    rank: doc.rank ?? 0,
  };
}

export async function GET() {
  await connectDB();
  const docs = await getOrSeedProposalTerms();
  return NextResponse.json(docs.map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.access");
  if (forbidden) return forbidden;

  const { slug, titleNL, titleEN, contentNL, contentEN } = await req.json();
  if (!slug?.trim() || !titleNL?.trim() || !titleEN?.trim()) {
    return NextResponse.json(
      { error: "slug, titleNL and titleEN are required" },
      { status: 400 }
    );
  }

  await connectDB();
  const last = await ProposalTermsSectionModel.findOne().sort({ rank: -1 }).lean();
  const rank = last ? (last.rank ?? 0) + 1 : 0;

  try {
    const doc = await ProposalTermsSectionModel.create({
      slug: slug.trim(),
      titleNL: titleNL.trim(),
      titleEN: titleEN.trim(),
      contentNL: typeof contentNL === "string" ? contentNL : "",
      contentEN: typeof contentEN === "string" ? contentEN : "",
      rank,
    });
    return NextResponse.json(serialize(doc.toObject()), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create terms section";
    const status = /duplicate/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
