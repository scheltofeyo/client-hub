/**
 * Budget-only restore for ProjectTemplate documents.
 *
 * A pricing bug (GET /api/project-templates dropped defaultRoleAllocation /
 * defaultPricingMode) caused some templates to be re-saved with an empty
 * budget. This script restores the role-based budget from the seed data,
 * touching ONLY the budget fields:
 *
 *   - defaultRoleAllocation   (resolved from seed role names → live DB rates)
 *   - defaultPricingMode      (set to "rolebased")
 *
 * It does NOT touch any other content (description, why/what/how, sessions,
 * tasks, delivery days, service, …) — those edits made by hand are preserved.
 *
 * By default it only fills templates whose budget is currently EMPTY, so a
 * template that still has (or has had re-entered) a budget is left alone.
 *
 * Usage:
 *   npm run restore:template-budgets             # DRY RUN — reports, writes nothing
 *   npm run restore:template-budgets -- --apply  # actually write the restores
 *   npm run restore:template-budgets -- --apply --all
 *                                                # also overwrite NON-empty budgets
 *                                                # from seed (use with care)
 *
 * Prerequisites:
 *   - MONGODB_URI set in .env.local or the environment
 *   - The ProjectRoles referenced by the seed allocations must exist
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

import { SEED_PROJECT_TEMPLATES } from "./data/project-templates";

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");

type AllocationLine = {
  roleId: string;
  roleName: string;
  days: number;
  dayRate: number;
  marginMultiplier: number;
  isExternal: boolean;
  externalCostRate?: number;
};

function grossOf(lines: AllocationLine[]): number {
  return lines.reduce((sum, l) => sum + l.days * l.dayRate * l.marginMultiplier, 0);
}

function euro(n: number): string {
  return `€${Math.round(n).toLocaleString("nl-NL")}`;
}

async function main() {
  await mongoose.connect(MONGODB_URI!, { bufferCommands: false });

  const { ProjectTemplateModel } = await import("../src/lib/models/ProjectTemplate");

  // Case-insensitive lookup of ProjectRoles → live rates.
  const db = mongoose.connection.db!;
  const projectRoles = await db.collection("projectroles").find({}).toArray();
  type DBRole = {
    _id: unknown;
    name: string;
    dayRate: number;
    marginMultiplier: number;
    isExternal: boolean;
    externalCostRate?: number;
  };
  const roleByName = new Map<string, DBRole>();
  for (const r of projectRoles as unknown as DBRole[]) {
    roleByName.set(r.name.trim().toLowerCase(), r);
  }

  let restored = 0;
  let skippedPopulated = 0;
  let skippedNoSeedBudget = 0;
  const notFound: string[] = [];
  const roleWarnings: string[] = [];

  console.log("");
  console.log(APPLY ? "APPLYING budget restores" : "DRY RUN — no writes (pass --apply to write)");
  console.log(ALL ? "Scope: ALL seed budgets (overwrites non-empty budgets too)" : "Scope: only templates with an empty budget");
  console.log("─".repeat(72));

  for (const seed of SEED_PROJECT_TEMPLATES) {
    if (!seed.defaultRoleAllocation || seed.defaultRoleAllocation.length === 0) {
      skippedNoSeedBudget += 1;
      continue;
    }

    const existing = await ProjectTemplateModel.findOne({ name: seed.name }).lean();
    if (!existing) {
      notFound.push(seed.name);
      continue;
    }

    const currentLines = (existing.defaultRoleAllocation ?? []) as AllocationLine[];
    const isEmpty = currentLines.length === 0;

    if (!isEmpty && !ALL) {
      skippedPopulated += 1;
      console.log(`  ✓ keep    ${seed.name}  (already has ${currentLines.length} role line(s), ${euro(grossOf(currentLines))})`);
      continue;
    }

    // Resolve seed role names → full allocation lines with live IDs + rates.
    const resolved: AllocationLine[] = [];
    for (const ra of seed.defaultRoleAllocation) {
      const dbRole = roleByName.get(ra.roleName.trim().toLowerCase());
      if (!dbRole) {
        roleWarnings.push(`${seed.name}: role "${ra.roleName}" not found — line skipped`);
        continue;
      }
      resolved.push({
        roleId: String(dbRole._id),
        roleName: dbRole.name,
        days: ra.days,
        dayRate: dbRole.dayRate,
        marginMultiplier: dbRole.marginMultiplier,
        isExternal: dbRole.isExternal,
        externalCostRate: dbRole.isExternal ? dbRole.externalCostRate : undefined,
      });
    }

    if (resolved.length === 0) {
      console.log(`  ⚠ skip    ${seed.name}  (no roles could be resolved — nothing to restore)`);
      continue;
    }

    const tag = isEmpty ? "restore" : "OVERWRITE";
    console.log(`  → ${tag} ${seed.name}  →  ${resolved.length} line(s), ${euro(grossOf(resolved))}`);

    if (APPLY) {
      await ProjectTemplateModel.updateOne(
        { _id: existing._id },
        { $set: { defaultRoleAllocation: resolved, defaultPricingMode: "rolebased" } }
      );
    }
    restored += 1;
  }

  console.log("─".repeat(72));
  console.log(`${APPLY ? "Restored" : "Would restore"}:        ${restored}`);
  console.log(`Skipped (has budget):  ${skippedPopulated}`);
  console.log(`Skipped (no seed budget): ${skippedNoSeedBudget}`);
  if (notFound.length > 0) {
    console.log(`Not found in DB (${notFound.length}):`);
    for (const n of notFound) console.log(`  - ${n}`);
  }
  if (roleWarnings.length > 0) {
    console.log(`Role warnings (${roleWarnings.length}):`);
    for (const w of roleWarnings) console.log(`  - ${w}`);
  }
  console.log("");
  if (!APPLY && restored > 0) {
    console.log("Re-run with --apply to write these changes.");
  } else if (APPLY) {
    console.log("Done.");
  }
  console.log("");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
