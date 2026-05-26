import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission, requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import {
  OrganizationSettingsModel,
  getOrganizationSettings,
} from "@/lib/models/OrganizationSettings";

const PUBLIC_FIELDS = [
  "addressStreet",
  "addressCity",
  "addressPostalCode",
  "addressCountry",
  "kvkNumber",
  "btwNumber",
  "iban",
  "website",
  "email",
] as const;

function serialize(doc: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) out[key] = doc[key] ?? null;
  return out;
}

/**
 * GET — public to authenticated SUMM Hub members (anyone with admin.access OR logged in).
 * The settings are read-only here; only the embedded values are returned.
 * Used by the admin form AND by the public proposal data fetch (server-side).
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const doc = await getOrganizationSettings();
  return NextResponse.json(serialize(doc as unknown as Record<string, unknown>));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const forbidden = requirePermission(session, "admin.access");
  if (forbidden) return forbidden;
  // Belt-and-braces — only admins should be able to write SUMM identity.
  if (!hasPermission(session!, "admin.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    if (key in body) {
      const value = body[key];
      update[key] = typeof value === "string" ? value.trim() || undefined : value ?? undefined;
    }
  }

  await connectDB();
  // Upsert the singleton.
  await OrganizationSettingsModel.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true });
  const doc = await getOrganizationSettings();
  return NextResponse.json(serialize(doc as unknown as Record<string, unknown>));
}
