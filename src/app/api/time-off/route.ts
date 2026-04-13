import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission, hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { TimeOffModel } from "@/lib/models/TimeOff";
import { UserModel } from "@/lib/models/User";

export async function GET(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "team.viewCalendar");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  const userId = searchParams.get("userId");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month query param required (YYYY-MM)" }, { status: 400 });
  }

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mo = parseInt(monthStr, 10);
  const lastDay = new Date(year, mo, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  await connectDB();

  const filter: Record<string, unknown> = {
    startDate: { $lte: monthEnd },
    endDate: { $gte: monthStart },
    status: "confirmed",
  };
  if (userId) filter.userId = userId;

  const [timeOffDocs, userDocs] = await Promise.all([
    TimeOffModel.find(filter).lean(),
    UserModel.find({ status: "active" }, { _id: 1, name: 1, image: 1, role: 1 }).sort({ name: 1 }).lean(),
  ]);

  const userMap = new Map<string, { name: string; image: string | null }>();
  for (const u of userDocs) {
    userMap.set(u._id.toString(), { name: (u.name as string) ?? "", image: (u.image as string) ?? null });
  }

  const entries = timeOffDocs.map((d) => {
    const uid = d.userId.toString();
    const user = userMap.get(uid);
    return {
      id: d._id.toString(),
      userId: uid,
      userName: user?.name,
      userImage: user?.image ?? undefined,
      startDate: d.startDate,
      endDate: d.endDate,
      startDayPortion: d.startDayPortion,
      endDayPortion: d.endDayPortion,
      leaveTypeSlug: d.leaveTypeSlug,
      notes: d.notes,
      status: d.status,
      createdById: d.createdById.toString(),
      createdByName: d.createdByName,
      createdAt: d.createdAt?.toISOString().split("T")[0],
    };
  });

  const users = userDocs.map((u) => ({
    id: u._id.toString(),
    name: (u.name as string) ?? "",
    image: (u.image as string) ?? null,
    role: (u.role as string) ?? "",
  }));

  return NextResponse.json({ entries, users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const targetUserId = body.userId || session.user.id;
  const isOwnLeave = targetUserId === session.user.id;

  // Permission check: own leave or any leave
  if (isOwnLeave) {
    const forbidden = requirePermission(session, "team.manageOwnLeave");
    if (forbidden) return forbidden;
  } else {
    const forbidden = requirePermission(session, "team.manageAnyLeave");
    if (forbidden) return forbidden;
  }

  const { startDate, endDate, startDayPortion, endDayPortion, leaveTypeSlug, notes } = body;

  if (!startDate || !endDate || !leaveTypeSlug) {
    return NextResponse.json({ error: "startDate, endDate, and leaveTypeSlug are required" }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
  }

  await connectDB();

  // Check for overlapping entries
  const overlap = await TimeOffModel.findOne({
    userId: targetUserId,
    status: "confirmed",
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  }).lean();

  if (overlap) {
    return NextResponse.json(
      { error: "This time off overlaps with an existing entry" },
      { status: 409 }
    );
  }

  const doc = await TimeOffModel.create({
    userId: targetUserId,
    startDate,
    endDate,
    startDayPortion: startDayPortion ?? "full",
    endDayPortion: endDayPortion ?? "full",
    leaveTypeSlug,
    notes: notes?.slice(0, 200),
    status: "confirmed",
    createdById: session.user.id,
    createdByName: session.user.name ?? "",
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      startDate: doc.startDate,
      endDate: doc.endDate,
      startDayPortion: doc.startDayPortion,
      endDayPortion: doc.endDayPortion,
      leaveTypeSlug: doc.leaveTypeSlug,
      notes: doc.notes,
      status: doc.status,
      createdById: doc.createdById.toString(),
      createdByName: doc.createdByName,
    },
    { status: 201 }
  );
}
