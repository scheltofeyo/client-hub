import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { CompanyHolidayModel } from "@/lib/models/CompanyHoliday";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.companyHolidays");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();

  const doc = await CompanyHolidayModel.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await CompanyHolidayModel.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
