/**
 * Project template seed script.
 *
 * Reads SEED_PROJECT_TEMPLATES from `scripts/data/project-templates.ts`,
 * looks up each entry's Service by name (case-insensitive), and upserts
 * the corresponding ProjectTemplate keyed on `name`.
 *
 * Usage:
 *   npm run seed:templates           # safe: never overwrites populated fields
 *   npm run seed:templates -- --force  # overwrite every field from seed
 *
 * Prerequisites:
 *   - MONGODB_URI must be set in .env.local or as an environment variable
 *   - Services referenced by `serviceName` must already exist (or the
 *     template is skipped and logged as orphaned)
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

import { SEED_PROJECT_TEMPLATES, type SeedTask } from "./data/project-templates";

const FORCE = process.argv.includes("--force");

type AllocationLine = {
  roleId: string;
  roleName: string;
  days: number;
  dayRate: number;
  marginMultiplier: number;
  isExternal: boolean;
  externalCostRate?: number;
};

type TemplatePayload = {
  name?: string;
  summary?: string;
  defaultDescription?: string;
  defaultWhy?: string;
  defaultWhat?: string;
  defaultHow?: string;
  defaultActivities?: string;
  defaultDeliverables?: string;
  defaultDeliveryDays?: number;
  defaultServiceId?: string;
  defaultPricingMode?: string;
  defaultRoleAllocation?: AllocationLine[];
};

async function main() {
  await mongoose.connect(MONGODB_URI!, { bufferCommands: false });

  const { ProjectTemplateModel } = await import("../src/lib/models/ProjectTemplate");
  const { ServiceModel } = await import("../src/lib/models/Service");
  const { TemplateSessionModel } = await import("../src/lib/models/TemplateSession");
  const { TemplateTaskModel } = await import("../src/lib/models/TemplateTask");

  // Build a case-insensitive lookup of existing Services.
  const services = await ServiceModel.find({}, { _id: 1, name: 1 }).lean();
  const serviceByName = new Map<string, string>();
  for (const s of services) {
    serviceByName.set(s.name.trim().toLowerCase(), String(s._id));
  }

  // Build a case-insensitive lookup of ProjectRoles for role allocation.
  const db = mongoose.connection.db!;
  const projectRoles = await db.collection("projectroles").find({}).toArray();
  type DBRole = { _id: unknown; name: string; dayRate: number; marginMultiplier: number; isExternal: boolean; externalCostRate?: number };
  const roleByName = new Map<string, DBRole>();
  for (const r of projectRoles as unknown as DBRole[]) {
    roleByName.set(r.name.trim().toLowerCase(), r);
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let sessionsCreated = 0;
  let sessionsReplaced = 0;
  let tasksCreated = 0;
  let tasksReplaced = 0;
  const orphans: string[] = [];

  for (const seed of SEED_PROJECT_TEMPLATES) {
    const serviceId = serviceByName.get(seed.serviceName.trim().toLowerCase());
    if (!serviceId) {
      orphans.push(`${seed.name}  (missing service: "${seed.serviceName}")`);
      continue;
    }

    const existing = await ProjectTemplateModel.findOne({ name: seed.name }).lean();

    // Resolve role allocation from role names → full lines with IDs + rates.
    let resolvedAllocation: AllocationLine[] | undefined;
    if (seed.defaultRoleAllocation && seed.defaultRoleAllocation.length > 0) {
      resolvedAllocation = [];
      for (const ra of seed.defaultRoleAllocation) {
        const dbRole = roleByName.get(ra.roleName.trim().toLowerCase());
        if (!dbRole) {
          console.warn(`  ⚠ ${seed.name}: role "${ra.roleName}" not found — skipping line`);
          continue;
        }
        resolvedAllocation.push({
          roleId: String(dbRole._id),
          roleName: dbRole.name,
          days: ra.days,
          dayRate: dbRole.dayRate,
          marginMultiplier: dbRole.marginMultiplier,
          isExternal: dbRole.isExternal,
          externalCostRate: dbRole.isExternal ? dbRole.externalCostRate : undefined,
        });
      }
    }

    const fullPayload: TemplatePayload = {
      name: seed.name,
      summary: seed.summary,
      defaultDescription: seed.defaultDescription,
      defaultWhy: seed.defaultWhy,
      defaultWhat: seed.defaultWhat,
      defaultHow: seed.defaultHow,
      defaultActivities: seed.defaultActivities,
      defaultDeliverables: seed.defaultDeliverables,
      defaultDeliveryDays: seed.defaultDeliveryDays,
      defaultServiceId: serviceId,
      defaultPricingMode: resolvedAllocation ? "rolebased" : undefined,
      defaultRoleAllocation: resolvedAllocation,
    };

    let templateId: string;
    const templateExistedBefore = !!existing;

    if (!existing) {
      const doc = await ProjectTemplateModel.create(fullPayload);
      templateId = String(doc._id);
      created += 1;
    } else {
      templateId = String(existing._id);

      if (FORCE) {
        await ProjectTemplateModel.updateOne({ _id: existing._id }, { $set: fullPayload });
        updated += 1;
      } else {
        // Safe mode: only fill fields that are currently empty in the DB —
        // never overwrite content that the admin has tweaked by hand.
        const safePayload: TemplatePayload = {};
        if (!existing.summary && seed.summary) safePayload.summary = seed.summary;
        if (!existing.defaultDescription && seed.defaultDescription) {
          safePayload.defaultDescription = seed.defaultDescription;
        }
        if (!existing.defaultWhy && seed.defaultWhy) safePayload.defaultWhy = seed.defaultWhy;
        if (!existing.defaultWhat && seed.defaultWhat) safePayload.defaultWhat = seed.defaultWhat;
        if (!existing.defaultHow && seed.defaultHow) safePayload.defaultHow = seed.defaultHow;
        if (!existing.defaultActivities && seed.defaultActivities) {
          safePayload.defaultActivities = seed.defaultActivities;
        }
        if (!existing.defaultDeliverables && seed.defaultDeliverables) {
          safePayload.defaultDeliverables = seed.defaultDeliverables;
        }
        if (existing.defaultDeliveryDays == null && seed.defaultDeliveryDays != null) {
          safePayload.defaultDeliveryDays = seed.defaultDeliveryDays;
        }
        if (!existing.defaultServiceId) {
          safePayload.defaultServiceId = serviceId;
        }

        if (Object.keys(safePayload).length === 0) {
          unchanged += 1;
        } else {
          await ProjectTemplateModel.updateOne({ _id: existing._id }, { $set: safePayload });
          updated += 1;
        }
      }
    }

    // Sync sessions for this template.
    //   --force            → delete all existing TemplateSessions for the
    //                        template and reinsert from seed (clean slate).
    //   safe mode + new    → insert all seed sessions.
    //   safe mode + exists → only insert if the template currently has zero
    //                        sessions in the DB (preserves admin edits — if
    //                        someone reordered or renamed sessions, we leave
    //                        them alone).
    if (seed.sessions && seed.sessions.length > 0) {
      const sessionDocs = seed.sessions.map((s, idx) => ({
        templateId,
        title: s.title,
        info: s.info,
        order: idx,
      }));

      if (FORCE) {
        await TemplateSessionModel.deleteMany({ templateId });
        await TemplateSessionModel.insertMany(sessionDocs);
        sessionsReplaced += seed.sessions.length;
      } else if (!templateExistedBefore) {
        await TemplateSessionModel.insertMany(sessionDocs);
        sessionsCreated += seed.sessions.length;
      } else {
        const existingCount = await TemplateSessionModel.countDocuments({ templateId });
        if (existingCount === 0) {
          await TemplateSessionModel.insertMany(sessionDocs);
          sessionsCreated += seed.sessions.length;
        }
        // else: template already has sessions in DB — preserve admin edits.
      }
    }

    // Sync tasks (with subtasks) for this template. Same idempotency logic
    // as sessions: --force replaces all, safe mode only fills if empty.
    if (seed.tasks && seed.tasks.length > 0) {
      async function insertTasks(items: readonly SeedTask[], parentId?: string) {
        let count = 0;
        for (let i = 0; i < items.length; i++) {
          const t = items[i];
          const doc = await TemplateTaskModel.create({
            templateId,
            title: t.title,
            description: t.description,
            assignToClientLead: t.assignToClientLead ?? false,
            parentTaskId: parentId,
            order: i,
          });
          count += 1;
          if (t.subtasks && t.subtasks.length > 0) {
            count += await insertTasks(t.subtasks, String(doc._id));
          }
        }
        return count;
      }

      if (FORCE) {
        await TemplateTaskModel.deleteMany({ templateId });
        tasksReplaced += await insertTasks(seed.tasks);
      } else if (!templateExistedBefore) {
        tasksCreated += await insertTasks(seed.tasks);
      } else {
        const existingTaskCount = await TemplateTaskModel.countDocuments({ templateId });
        if (existingTaskCount === 0) {
          tasksCreated += await insertTasks(seed.tasks);
        }
      }
    }
  }

  console.log("");
  console.log(`Templates:`);
  console.log(`  Created:   ${created}`);
  console.log(`  Updated:   ${updated}${FORCE ? "  (--force: full overwrite)" : "  (only empty fields filled)"}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`Sessions:`);
  console.log(`  Created:   ${sessionsCreated}  (new templates or templates with no sessions yet)`);
  console.log(`  Replaced:  ${sessionsReplaced}${FORCE ? "  (--force: full overwrite of session list per template)" : ""}`);
  console.log(`Tasks:`);
  console.log(`  Created:   ${tasksCreated}  (new templates or templates with no tasks yet)`);
  console.log(`  Replaced:  ${tasksReplaced}${FORCE ? "  (--force: full overwrite of task list per template)" : ""}`);
  if (orphans.length > 0) {
    console.log("");
    console.log(`Orphans (skipped — service not found): ${orphans.length}`);
    for (const o of orphans) console.log(`  - ${o}`);
    console.log("");
    console.log("Create the missing Services in /admin first, then re-run.");
  }
  console.log("");
  console.log("Seed complete");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
