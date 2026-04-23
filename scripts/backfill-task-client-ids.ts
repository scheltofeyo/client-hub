/**
 * One-time backfill: set clientId on tasks that have a projectId but no clientId.
 *
 * Tasks created by the template-based project flow before this fix were saved
 * without a clientId, which broke client grouping on My Day and elsewhere.
 *
 * Run with: npx tsx scripts/backfill-task-client-ids.ts
 *
 * Prerequisites:
 *   - MONGODB_URI must be set in .env.local or environment
 *   - Back up the database before running
 */

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

// Load .env.local manually (avoids a dotenv dependency).
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
  const tasks = db.collection("tasks");
  const projects = db.collection("projects");

  const orphaned = await tasks
    .find({
      projectId: { $exists: true, $nin: [null, ""] },
      $or: [{ clientId: { $exists: false } }, { clientId: null }, { clientId: "" }],
    })
    .toArray();

  console.log(`Found ${orphaned.length} task(s) missing clientId.`);

  if (orphaned.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const projectIds = [...new Set(orphaned.map((t) => t.projectId as string))];
  const objectIds = projectIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const projectDocs = await projects
    .find({ _id: { $in: objectIds } }, { projection: { clientId: 1 } })
    .toArray();
  const projectToClient = new Map(
    projectDocs.map((p) => [p._id.toString(), p.clientId as string | undefined])
  );

  let fixed = 0;
  let skipped = 0;
  for (const t of orphaned) {
    const clientId = projectToClient.get(t.projectId as string);
    if (!clientId) {
      skipped++;
      continue;
    }
    await tasks.updateOne({ _id: t._id }, { $set: { clientId } });
    fixed++;
  }

  console.log(`Backfilled ${fixed} task(s). Skipped ${skipped} (project missing or has no clientId).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
