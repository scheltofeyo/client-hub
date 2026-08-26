import { NextRequest, NextResponse } from "next/server";
import { revokeByToken } from "@/lib/oauth";

/**
 * Token revocation (RFC 7009), so disconnecting from inside the Claude app
 * actually drops the grant here instead of leaving a live connection nobody
 * remembers granting.
 *
 * The RFC requires 200 even for an unknown token: telling a caller whether a
 * token exists would turn this endpoint into an oracle for probing them. So
 * the answer is always the same, and the return value of revokeByToken is
 * deliberately ignored.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let token: string | null = null;

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : null;
  } else {
    const form = await req.formData().catch(() => null);
    const value = form?.get("token");
    token = typeof value === "string" ? value : null;
  }

  if (token) await revokeByToken(token);

  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
