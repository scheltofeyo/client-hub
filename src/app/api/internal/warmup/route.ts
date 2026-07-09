import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * Keep-warm target, hit by the scheduled function in
 * netlify/functions/warmup.mts. Running inside the same SSR function as all
 * pages, one request here boots the function instance AND establishes the
 * Mongoose pool, so the next real user request skips both cold costs.
 *
 * Like every /api/internal/ route it bypasses the auth middleware and is
 * secured by a shared secret instead: the caller sends `x-warmup-key`, a
 * digest both sides derive from AUTH_SECRET (same Netlify env), so no extra
 * env var is needed and the raw secret never travels.
 */
// Twin derivation lives in netlify/functions/warmup.mts (that bundle can't
// share this module; route files may only export route handlers anyway).
function warmupKey(): string {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:warmup`)
    .digest("hex");
}

export async function GET(request: NextRequest) {
  if (request.headers.get("x-warmup-key") !== warmupKey()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  await connectDB();
  await mongoose.connection.db?.admin().command({ ping: 1 });
  return NextResponse.json({ ok: true, ms: Date.now() - startedAt });
}
