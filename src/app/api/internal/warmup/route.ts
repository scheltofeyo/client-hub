import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * Keep-warm target, hit by the scheduled function in
 * netlify/functions/warmup.mts. Running inside the same SSR function as all
 * pages, one request here boots the function instance AND establishes the
 * Mongoose pool, so the next real user request skips both cold costs.
 *
 * Deliberately unauthenticated (/api/internal/* bypasses the auth middleware
 * by design): it exposes no data and does nothing an anonymous request to any
 * page wouldn't already trigger, plus a DB ping.
 */
export async function GET() {
  const startedAt = Date.now();
  await connectDB();
  await mongoose.connection.db?.admin().command({ ping: 1 });
  return NextResponse.json({ ok: true, ms: Date.now() - startedAt });
}
