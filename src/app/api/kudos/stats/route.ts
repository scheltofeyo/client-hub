import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { KudosModel } from "@/lib/models/Kudos";
import { UserModel } from "@/lib/models/User";

function startOfWeek(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay(); // 0 = sun
  const diff = day === 0 ? 6 : day - 1; // make Monday start
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

type LeaderRow = { userId: string; name: string; image?: string; count: number };

async function topReceivers(since: Date, limit = 5): Promise<LeaderRow[]> {
  const rows = await KudosModel.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: since } } },
    { $unwind: "$toUserIds" },
    { $group: { _id: "$toUserIds", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return hydrateUsers(rows);
}

async function topGivers(since: Date, limit = 5): Promise<LeaderRow[]> {
  const rows = await KudosModel.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: "$fromUserId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return hydrateUsers(rows);
}

async function hydrateUsers(rows: { _id: string; count: number }[]): Promise<LeaderRow[]> {
  if (rows.length === 0) return [];
  const users = await UserModel.find({ _id: { $in: rows.map((r) => r._id) } })
    .select("_id name image")
    .lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return rows.map((r) => {
    const u = byId.get(r._id);
    return {
      userId: r._id,
      name: u?.name ?? "Onbekend",
      image: u?.image ?? undefined,
      count: r.count,
    };
  });
}

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "tools.kudos.access");
  if (forbidden) return forbidden;

  await connectDB();
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const [weekTotal, monthTotal, topReceiversWeek, topGiversWeek, topReceiversMonth, topGiversMonth] =
    await Promise.all([
      KudosModel.countDocuments({ createdAt: { $gte: weekStart } }),
      KudosModel.countDocuments({ createdAt: { $gte: monthStart } }),
      topReceivers(weekStart),
      topGivers(weekStart),
      topReceivers(monthStart),
      topGivers(monthStart),
    ]);

  return NextResponse.json({
    weekTotal,
    monthTotal,
    topReceiversWeek,
    topGiversWeek,
    topReceiversMonth,
    topGiversMonth,
  });
}
