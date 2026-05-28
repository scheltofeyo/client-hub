/**
 * One-time migration: the `archived` ProjectPlan status is removed. Existing
 * archived plans are flipped back to "draft" so the user can review and
 * (optionally) delete them via the UI. Hard delete is intentionally avoided
 * because archived plans may carry meaningful `acceptanceLog` history or
 * content worth keeping.
 *
 * Run with: npx tsx scripts/migrate-archived-plans-to-draft.ts
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

  const archived = await plans
    .find({ status: "archived" }, { projection: { _id: 1, title: 1, clientId: 1 } })
    .toArray();
  console.log(`Found ${archived.length} plan(s) with status "archived".`);
  for (const p of archived) {
    console.log(`  - ${p._id.toString()}  client=${p.clientId}  title="${p.title}"`);
  }

  if (archived.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const res = await plans.updateMany(
    { status: "archived" },
    { $set: { status: "draft" } }
  );
  console.log(`Reverted ${res.modifiedCount} plan(s) to "draft".`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
