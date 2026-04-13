import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { CompanyHolidayModel } from "@/lib/models/CompanyHoliday";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get("year") ?? String(new Date().getFullYear());
  const year = parseInt(yearStr, 10);

  await connectDB();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const docs = await CompanyHolidayModel.find({
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: 1 }).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: d._id.toString(),
      date: d.date,
      label: d.label,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.companyHolidays");
  if (forbidden) return forbidden;

  const { date, label } = await req.json();
  if (!date || !label?.trim()) {
    return NextResponse.json({ error: "date and label are required" }, { status: 400 });
  }

  await connectDB();

  const existing = await CompanyHolidayModel.findOne({ date }).lean();
  if (existing) {
    return NextResponse.json({ error: "A company holiday on this date already exists" }, { status: 409 });
  }

  const doc = await CompanyHolidayModel.create({ date, label: label.trim() });

  return NextResponse.json(
    { id: doc._id.toString(), date: doc.date, label: doc.label },
    { status: 201 }
  );
}
