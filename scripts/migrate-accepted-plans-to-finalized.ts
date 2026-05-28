/**
 * One-time migration: plans accepted under the old auto-promote behavior
 * already have their projects promoted (status "not_started" or beyond),
 * so they should live under the new "finalized" plan status — not the
 * new in-between "accepted" state which now means "client agreed, projects
 * still draft, awaiting finalize".
 *
 * For each ProjectPlan with status "accepted":
 *   - If at least one project on the plan is no longer "draft" → flip the
 *     plan to status "finalized", copy acceptedAt/By into finalizedAt/By,
 *     and push a retroactive "finalized" entry onto acceptanceLog.
 *   - Otherwise → leave the plan as "accepted" (the new flow kicks in).
 *
 * Idempotent: re-running has no effect because we only touch plans whose
 * status is still "accepted".
 *
 * Run with: npx tsx scripts/migrate-accepted-plans-to-finalized.ts
 *
 * Prerequisites:
 *   - MONGODB_URI must be set in .env.local or environment
 *   - Back up the database before running
 */

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db!;
  const plans = db.collection("projectplans");
  const projects = db.collection("projects");

  const acceptedPlans = await plans.find({ status: "accepted" }).toArray();
  console.log(`Found ${acceptedPlans.length} plan(s) with status "accepted".`);

  let migrated = 0;
  let leftAsAccepted = 0;

  for (const plan of acceptedPlans) {
    const planId = plan._id.toString();
    const nonDraftCount = await projects.countDocuments({
      planId,
      status: { $ne: "draft" },
    });

    if (nonDraftCount === 0) {
      leftAsAccepted++;
      continue;
    }

    const finalizedAt = plan.acceptedAt ?? new Date().toISOString().split("T")[0];
    const finalizedBy = plan.acceptedBy ?? {
      userId: "system",
      name: "Migration (auto-finalized from legacy accept)",
    };
    const logEvent = {
      type: "finalized",
      at: new Date(`${finalizedAt}T00:00:00Z`).toISOString(),
      source: "internal",
      by: finalizedBy,
    };

    await plans.updateOne({ _id: plan._id }, {
      $set: { status: "finalized", finalizedAt, finalizedBy },
      $push: { acceptanceLog: logEvent },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    migrated++;
  }

  console.log(
    `Migrated ${migrated} plan(s) to "finalized". Left ${leftAsAccepted} as "accepted" (no promoted projects yet).`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
