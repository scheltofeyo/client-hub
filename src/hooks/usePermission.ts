"use client";

import { useSession } from "next-auth/react";
import type { Permission } from "@/lib/permissions";

/** Returns true if the current user holds the given permission. */
export function usePermission(permission: Permission): boolean {
  const { data: session } = useSession();
  return (session?.user?.permissions ?? []).includes(permission);
}

/** Returns true if the current user holds ANY of the given permissions. */
export function useAnyPermission(...permissions: Permission[]): boolean {
  const { data: session } = useSession();
  const userPerms = session?.user?.permissions ?? [];
  return permissions.some((p) => userPerms.includes(p));
}

/** Returns the full permissions array for the current user. */
export function usePermissions(): string[] {
  const { data: session } = useSession();
  return session?.user?.permissions ?? [];
}

/** Returns true if the current user holds the given lead permission. */
export function useLeadPermission(permission: Permission): boolean {
  const { data: session } = useSession();
  return (session?.user?.leadPermissions ?? []).includes(permission);
}

/** Returns the full lead permissions array for the current user. */
export function useLeadPermissions(): string[] {
  const { data: session } = useSession();
  return session?.user?.leadPermissions ?? [];
}
