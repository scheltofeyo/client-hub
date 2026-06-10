/**
 * One-time cleanup: delete tasks and sessions that are orphaned — i.e. they
 * carry a projectId that no longer matches any existing project. These are left
 * behind by past project deletes that didn't cascade (now fixed in the
 * single-project DELETE handler). Orphaned tasks surface as broken "General"
 * groups in My Day and inflate client task stats while being invisible on the
 * per-client Tasks board.
 *
 * Dry-run by default — prints what it would delete. Pass --confirm to delete.
 *
 * Run with:
 *   npx tsx scripts/cleanup-orphaned-tasks.ts            (dry run)
 *   npx tsx scripts/cleanup-orphaned-tasks.ts --confirm  (delete)
 *
 * Prerequisites:
 *   - MONGODB_URI must be set in .env.local or environment
 *   - Back up the database before running with --confirm
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

const confirm = process.argv.includes("--confirm");

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db!;
  const projects = db.collection("projects");
  const tasks = db.collection("tasks");
  const sessions = db.collection("sessions");

  // Set of all existing project ids (as strings — tasks store projectId as a string).
  const projDocs = await projects.find({}, { projection: { _id: 1 } }).toArray();
  const existing = new Set(projDocs.map((p) => p._id.toString()));
  console.log(`Existing projects: ${existing.size}`);

  const isOrphan = (doc: Record<string, unknown>) => {
    const pid = doc.projectId;
    return typeof pid === "string" && pid.length > 0 && !existing.has(pid);
  };

  const orphanTasks = (await tasks.find({ projectId: { $type: "string", $ne: "" } }).toArray()).filter(isOrphan);
  const orphanSessions = (await sessions.find({ projectId: { $type: "string", $ne: "" } }).toArray()).filter(isOrphan);

  console.log(`\nOrphaned tasks: ${orphanTasks.length}`);
  for (const t of orphanTasks.slice(0, 15)) {
    console.log(`  - "${t.title}" (projectId ${t.projectId}, clientId ${t.clientId})`);
  }
  if (orphanTasks.length > 15) console.log(`  …and ${orphanTasks.length - 15} more`);

  console.log(`\nOrphaned sessions: ${orphanSessions.length}`);
  for (const s of orphanSessions.slice(0, 15)) {
    console.log(`  - "${s.title}" (projectId ${s.projectId}, clientId ${s.clientId})`);
  }
  if (orphanSessions.length > 15) console.log(`  …and ${orphanSessions.length - 15} more`);

  if (orphanTasks.length === 0 && orphanSessions.length === 0) {
    console.log("\nNothing to clean up.");
    await mongoose.disconnect();
    return;
  }

  if (!confirm) {
    console.log("\nDry run — no changes made. Re-run with --confirm to delete.");
    await mongoose.disconnect();
    return;
  }

  const taskIds = orphanTasks.map((t) => t._id);
  const sessionIds = orphanSessions.map((s) => s._id);
  const [taskRes, sessionRes] = await Promise.all([
    taskIds.length > 0 ? tasks.deleteMany({ _id: { $in: taskIds } }) : Promise.resolve({ deletedCount: 0 }),
    sessionIds.length > 0 ? sessions.deleteMany({ _id: { $in: sessionIds } }) : Promise.resolve({ deletedCount: 0 }),
  ]);

  console.log(`\nDeleted ${taskRes.deletedCount} task(s) and ${sessionRes.deletedCount} session(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
