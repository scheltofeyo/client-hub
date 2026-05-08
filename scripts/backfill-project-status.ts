/**
 * One-time backfill: set status on projects that were kicked off before the
 * kickoff route flipped status to in_progress automatically.
 *
 * Targets projects with kickedOffAt set but status still "not_started" and
 * recalculates status from their tasks (mirrors the kickoff route logic).
 * Projects already marked "completed" are not touched.
 *
 * Run with: npx tsx scripts/backfill-project-status.ts
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
  const projects = db.collection("projects");
  const tasks = db.collection("tasks");

  const stale = await projects
    .find({
      kickedOffAt: { $exists: true, $nin: [null, ""] },
      status: "not_started",
    })
    .toArray();

  console.log(`Found ${stale.length} kicked-off project(s) still marked not_started.`);

  if (stale.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  let movedToInProgress = 0;
  let movedToCompleted = 0;

  for (const p of stale) {
    const projectId = p._id.toString();
    const projectTasks = await tasks.find({ projectId }).toArray();
    const total = projectTasks.length;
    const completedCount = projectTasks.filter((t) => !!t.completedAt).length;
    const allDone = total > 0 && completedCount === total;

    const update: Record<string, unknown> = {
      status: allDone ? "completed" : "in_progress",
    };
    if (allDone && !p.completedDate) {
      update.completedDate = today;
    }

    await projects.updateOne({ _id: p._id }, { $set: update });
    if (allDone) movedToCompleted++;
    else movedToInProgress++;
  }

  console.log(
    `Backfilled ${stale.length} project(s): ${movedToInProgress} → in_progress, ${movedToCompleted} → completed.`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
