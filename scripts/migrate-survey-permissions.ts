/**
 * Migrates Role documents so that the legacy `archetypeAsIsSurvey` permission
 * keys are renamed to the new `surveys` keys. Run once after deploying the
 * tool rename:
 *
 *   tools.archetypeAsIsSurvey.access      → tools.surveys.access
 *   tools.archetypeAsIsSurvey.viewOthers  → tools.surveys.viewOthers
 *   tools.archetypeAsIsSurvey.editAny     → tools.surveys.editAny
 *   tools.archetypeAsIsSurvey.deleteAny   → tools.surveys.deleteAny
 *   admin.archetypeAsIsSurvey.manageTemplates → admin.surveys.manageTemplates
 *
 * Idempotent: re-running the script is safe — already-migrated roles are
 * skipped.
 *
 * Run:
 *   npx tsx scripts/migrate-survey-permissions.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  try {
    const envPath = resolve(__dirname, "..", ".env.local");
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not set in environment or .env.local");
  process.exit(1);
}

const RENAMES: Record<string, string> = {
  "tools.archetypeAsIsSurvey.access": "tools.surveys.access",
  "tools.archetypeAsIsSurvey.viewOthers": "tools.surveys.viewOthers",
  "tools.archetypeAsIsSurvey.editAny": "tools.surveys.editAny",
  "tools.archetypeAsIsSurvey.deleteAny": "tools.surveys.deleteAny",
  "admin.archetypeAsIsSurvey.manageTemplates": "admin.surveys.manageTemplates",
};

function rewriteList(list: string[] | undefined | null): { next: string[]; changed: boolean } {
  if (!Array.isArray(list)) return { next: [], changed: false };
  let changed = false;
  const seen = new Set<string>();
  const next: string[] = [];
  for (const entry of list) {
    const mapped = RENAMES[entry] ?? entry;
    if (mapped !== entry) changed = true;
    if (!seen.has(mapped)) {
      seen.add(mapped);
      next.push(mapped);
    }
  }
  return { next, changed };
}

async function main() {
  await mongoose.connect(MONGODB_URI!);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No DB handle");

  const Roles = db.collection("roles");
  const LeadSettings = db.collection("leadsettings");

  let rolesUpdated = 0;
  const cursor = Roles.find({});
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) continue;
    const perms = rewriteList(doc.permissions);
    const leadPerms = rewriteList(doc.leadPermissions);
    if (perms.changed || leadPerms.changed) {
      await Roles.updateOne(
        { _id: doc._id },
        {
          $set: {
            permissions: perms.next,
            leadPermissions: leadPerms.next,
            updatedAt: new Date(),
          },
        }
      );
      rolesUpdated++;
      console.log(`  ✓ migrated role ${doc.name ?? doc._id}`);
    }
  }
  console.log(`Roles migrated: ${rolesUpdated}`);

  // LeadSettings is a singleton listing default lead permissions
  const leadSettings = await LeadSettings.findOne({});
  if (leadSettings) {
    const ls = rewriteList(leadSettings.leadPermissions);
    if (ls.changed) {
      await LeadSettings.updateOne(
        { _id: leadSettings._id },
        { $set: { leadPermissions: ls.next, updatedAt: new Date() } }
      );
      console.log("LeadSettings: migrated");
    } else {
      console.log("LeadSettings: nothing to migrate");
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
