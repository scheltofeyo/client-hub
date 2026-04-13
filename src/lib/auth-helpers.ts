import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { Permission } from "./permissions";

/** Check whether the session user holds a specific global permission. */
export function hasPermission(
  session: Session | null,
  permission: Permission
): boolean {
  if (!session?.user) return false;
  return (session.user.permissions ?? []).includes(permission);
}

/** Check whether the session user holds a specific lead permission. */
export function hasLeadPermission(
  session: Session | null,
  permission: Permission
): boolean {
  if (!session?.user) return false;
  return (session.user.leadPermissions ?? []).includes(permission);
}

/** Return a 403 response if the session lacks the required permission. */
export function requirePermission(
  session: Session | null,
  permission: Permission
): NextResponse | null {
  if (hasPermission(session, permission)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── Contextual helpers ───────────────────────────────────────────────

/** True if the session user is listed in the client's leads array. */
export function isClientLead(
  session: Session,
  leads: { userId?: string }[]
): boolean {
  return (leads ?? []).some((l) => l.userId === session.user.id);
}

/** True if the session user created the resource. */
export function isResourceCreator(
  session: Session,
  createdById: string
): boolean {
  return session.user.id === createdById;
}

// ── Combined checks ──────────────────────────────────────────────────

/** Global permission OR (lead on client AND lead permission). */
export function hasPermissionOrIsLead(
  session: Session | null,
  permission: Permission,
  leads: { userId?: string }[]
): boolean {
  if (!session?.user) return false;
  return (
    hasPermission(session, permission) ||
    (isClientLead(session, leads) && hasLeadPermission(session, permission))
  );
}

/** Permission OR resource creator. */
export function hasPermissionOrIsCreator(
  session: Session | null,
  permission: Permission,
  createdById: string
): boolean {
  if (!session?.user) return false;
  return (
    hasPermission(session, permission) ||
    isResourceCreator(session, createdById)
  );
}
