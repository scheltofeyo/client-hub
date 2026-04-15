import { RoleModel } from "@/lib/models/Role";
import { getLeadSettings } from "@/lib/models/LeadSettings";
import { ADMIN_PERMISSIONS, MEMBER_PERMISSIONS } from "@/lib/permissions";

let seeded = false;

/**
 * Ensure system roles and lead settings exist in the database.
 * Runs at most once per process lifetime (idempotent, no-op after first call).
 * Does NOT overwrite existing data so admin-customized permissions are preserved.
 */
export async function seedRoles(): Promise<void> {
  if (seeded) return;
  seeded = true;

  const existing = await RoleModel.find({ isSystem: true }).lean();
  const slugs = new Set(existing.map((r) => r.slug));

  const toInsert = [];

  if (!slugs.has("admin")) {
    toInsert.push({
      name: "Admin",
      slug: "admin",
      description: "Full access to all features",
      permissions: [...ADMIN_PERMISSIONS],
      isSystem: true,
      rank: 0,
    });
  }

  if (!slugs.has("member")) {
    toInsert.push({
      name: "Member",
      slug: "member",
      description: "Standard team member",
      permissions: [...MEMBER_PERMISSIONS],
      isSystem: true,
      rank: 1,
    });
  }

  if (toInsert.length > 0) {
    await RoleModel.insertMany(toInsert);
  }

  // Only update existing roles if they're missing permissions
  const updates: Promise<unknown>[] = [];

  const adminRole = existing.find((r) => r.slug === "admin");
  if (adminRole && !ADMIN_PERMISSIONS.every((p) => adminRole.permissions.includes(p))) {
    updates.push(
      RoleModel.updateOne(
        { slug: "admin", isSystem: true },
        { $addToSet: { permissions: { $each: [...ADMIN_PERMISSIONS] } } }
      )
    );
  }

  const memberRole = existing.find((r) => r.slug === "member");
  if (memberRole && !MEMBER_PERMISSIONS.every((p) => memberRole.permissions.includes(p))) {
    updates.push(
      RoleModel.updateOne(
        { slug: "member", isSystem: true },
        { $addToSet: { permissions: { $each: [...MEMBER_PERMISSIONS] } } }
      )
    );
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  // Ensure lead settings singleton exists (creates with defaults if missing)
  await getLeadSettings();
}
