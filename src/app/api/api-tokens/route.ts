import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { ApiTokenModel, type IApiToken } from "@/lib/models/ApiToken";
import { bearerFromHeaders, generateApiToken } from "@/lib/api-token";
import { ALL_PERMISSIONS, isTokenGrantable } from "@/lib/permissions";

/**
 * Token management always requires a real browser session. Without this a
 * narrowly-scoped token could mint a second token carrying its owner's full
 * role, escaping the very scope it was given.
 */
async function requireBrowserSession(): Promise<NextResponse | null> {
  if (await bearerFromHeaders()) {
    return NextResponse.json(
      { error: "Token management requires a browser session" },
      { status: 403 }
    );
  }
  return null;
}

function serialize(doc: Pick<IApiToken, "name" | "prefix" | "permissions" | "expiresAt" | "lastUsedAt" | "revokedAt" | "createdAt"> & { _id: { toString(): string } }) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    prefix: doc.prefix,
    permissions: doc.permissions ?? null,
    expiresAt: doc.expiresAt ?? undefined,
    lastUsedAt: doc.lastUsedAt ?? undefined,
    revokedAt: doc.revokedAt ?? undefined,
    createdAt: doc.createdAt?.toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "integrations.tokens");
  if (forbidden) return forbidden;
  const notBrowser = await requireBrowserSession();
  if (notBrowser) return notBrowser;

  await connectDB();
  const docs = await ApiTokenModel.find({ userId: session!.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(docs.map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "integrations.tokens");
  if (forbidden) return forbidden;
  const notBrowser = await requireBrowserSession();
  if (notBrowser) return notBrowser;

  const { name, permissions, expiresAt } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let scope: string[] | undefined;
  if (Array.isArray(permissions) && permissions.length > 0) {
    const known = new Set<string>(ALL_PERMISSIONS);
    const owned = new Set(session!.user.permissions ?? []);
    const unknown = permissions.filter((p: string) => !known.has(p));
    if (unknown.length > 0) {
      return NextResponse.json({ error: `Unknown permission: ${unknown[0]}` }, { status: 400 });
    }
    // A token may narrow, never widen. Rejecting here gives a clear error
    // instead of silently handing back a token that does less than requested.
    const notOwned = permissions.filter((p: string) => !owned.has(p));
    if (notOwned.length > 0) {
      return NextResponse.json(
        { error: `You do not have the permission you tried to grant: ${notOwned[0]}` },
        { status: 400 }
      );
    }
    const notGrantable = permissions.filter((p: string) => !isTokenGrantable(p));
    if (notGrantable.length > 0) {
      return NextResponse.json(
        { error: `This permission can never be granted to a token: ${notGrantable[0]}` },
        { status: 400 }
      );
    }
    scope = permissions;
  }

  if (expiresAt && expiresAt <= new Date().toISOString().split("T")[0]) {
    return NextResponse.json({ error: "Expiry must be in the future" }, { status: 400 });
  }

  const { raw, tokenHash, prefix } = generateApiToken();

  await connectDB();
  const doc = await ApiTokenModel.create({
    userId: session!.user.id,
    name: name.trim(),
    tokenHash,
    prefix,
    permissions: scope,
    // Stored as an end-of-day instant so a date-only input covers its whole day.
    expiresAt: expiresAt ? `${expiresAt}T23:59:59.999Z` : undefined,
  });

  // The only time the secret ever leaves the server.
  return NextResponse.json({ token: raw, record: serialize(doc.toObject()) }, { status: 201 });
}
