import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/auth-helpers";
import { SurveySessionModel } from "@/lib/models/SurveySession";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.surveys.manageTemplates");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const sessionCount = await SurveySessionModel.countDocuments({ templateId: id });

  return NextResponse.json({ sessionCount });
}
