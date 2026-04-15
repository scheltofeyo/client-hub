/**
 * Build-time role seeding script.
 *
 * Ensures system roles (admin, member) and lead settings exist in the database.
 * Runs once per deploy via: npm run seed
 *
 * Prerequisites:
 *   - MONGODB_URI must be set in .env.local or as an environment variable
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";

// Load .env.local if MONGODB_URI is not already set (e.g., local dev)
if (!process.env.MONGODB_URI) {
  try {
    const envPath = resolve(__dirname, "..", ".env.local");
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local may not exist in CI — env vars should be set there
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

// Import models and permissions using relative paths (@ alias not available outside Next.js)
import { ADMIN_PERMISSIONS, MEMBER_PERMISSIONS } from "../src/lib/permissions";

async function main() {
  await mongoose.connect(MONGODB_URI!, { bufferCommands: false });

  // Import models after connection — they register with mongoose on import
  const { RoleModel } = await import("../src/lib/models/Role");
  const { getLeadSettings } = await import("../src/lib/models/LeadSettings");

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
    console.log(`Created roles: ${toInsert.map((r) => r.slug).join(", ")}`);
  }

  // Update existing roles if they're missing permissions
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
    console.log("Updated role permissions");
  }

  // Ensure lead settings singleton exists
  await getLeadSettings();

  console.log("Seed complete");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
