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

  // Ensure new permissions are present on existing system roles
  await RoleModel.updateOne(
    { slug: "admin", isSystem: true },
    { $addToSet: { permissions: { $each: [...ADMIN_PERMISSIONS] } } }
  );
  await RoleModel.updateOne(
    { slug: "member", isSystem: true },
    { $addToSet: { permissions: { $each: [...MEMBER_PERMISSIONS] } } }
  );

  // Ensure lead settings singleton exists (creates with defaults if missing)
  await getLeadSettings();
}
