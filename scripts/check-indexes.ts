/**
 * Read-only verification for the three targeted compound indexes added for the
 * hottest My Day / client queries (Task, Log, Project).
 *
 * What it does:
 *   1. Builds the schema-defined indexes via Model.createIndexes() — ADDITIVE
 *      only (never drops anything; this is exactly what a deploy does via
 *      Mongoose autoIndex). No documents are touched.
 *   2. Prints every index on tasks / logs / projects.
 *   3. Runs explain("executionStats") on the four hot query shapes and reports
 *      whether each uses an index (IXSCAN) or a full scan (COLLSCAN), which
 *      index, and whether the sort is index-backed or done in memory.
 *
 * Run with:
 *   npx tsx scripts/check-indexes.ts
 *
 * Prerequisites:
 *   - MONGODB_URI must be set in .env.local or environment
 */

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { TaskModel } from "../src/lib/models/Task";
import { LogModel } from "../src/lib/models/Log";
import { ProjectModel } from "../src/lib/models/Project";

// Load .env.local manually (avoids a dotenv dependency) — same as the other scripts.
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

type Plan = Record<string, unknown> | undefined | null;

/** Walk a query plan tree (classic + SBE queryPlan nesting), calling cb on each node. */
function walk(plan: Plan, cb: (node: Record<string, unknown>) => void) {
  if (!plan || typeof plan !== "object") return;
  cb(plan as Record<string, unknown>);
  const p = plan as Record<string, unknown>;
  if (p.inputStage) walk(p.inputStage as Plan, cb);
  if (Array.isArray(p.inputStages)) (p.inputStages as Plan[]).forEach((s) => walk(s, cb));
  if (p.queryPlan) walk(p.queryPlan as Plan, cb);
}

function analyzePlan(winningPlan: Plan) {
  const stages: string[] = [];
  let indexName: string | undefined;
  walk(winningPlan, (node) => {
    if (typeof node.stage === "string") stages.push(node.stage);
    if (typeof node.indexName === "string") indexName = node.indexName as string;
  });
  return {
    usesIndex: stages.includes("IXSCAN"),
    fullScan: stages.includes("COLLSCAN"),
    inMemorySort: stages.includes("SORT"),
    indexName,
  };
}

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI as string);

  // Build schema-defined indexes (additive — never drops). Mirrors a deploy.
  console.log("Ensuring schema-defined indexes exist (additive)...\n");
  await Promise.all([TaskModel.createIndexes(), LogModel.createIndexes(), ProjectModel.createIndexes()]);

  const db = mongoose.connection.db!;

  // 1. Print current indexes.
  for (const coll of ["tasks", "logs", "projects"]) {
    const idx = await db.collection(coll).indexes();
    console.log(`── ${coll} indexes ──`);
    for (const i of idx) console.log(`   ${i.name}: ${JSON.stringify(i.key)}`);
    console.log("");
  }

  // 2. Sample real ids so executionStats are meaningful.
  const [sampleUser, sampleClient, count] = await Promise.all([
    db.collection("users").findOne({}, { projection: { _id: 1 } }),
    db.collection("clients").findOne({}, { projection: { _id: 1 } }),
    {
      tasks: await db.collection("tasks").estimatedDocumentCount(),
      logs: await db.collection("logs").estimatedDocumentCount(),
      projects: await db.collection("projects").estimatedDocumentCount(),
    },
  ]);
  const userId = sampleUser?._id.toString() ?? "000000000000000000000000";
  const clientId = sampleClient?._id.toString() ?? "000000000000000000000000";
  const today = new Date().toISOString().slice(0, 10);

  console.log(`Collection sizes: tasks=${count.tasks} logs=${count.logs} projects=${count.projects}`);
  console.log(`Sample userId=${userId} clientId=${clientId} today=${today}\n`);

  const checks: { label: string; coll: string; filter: Record<string, unknown>; sort: Record<string, 1 | -1> }[] = [
    {
      label: "Task — overdue/today (My Day)",
      coll: "tasks",
      filter: { "assignees.userId": userId, completedAt: null, completionDate: { $lte: today } },
      sort: { completionDate: 1 },
    },
    {
      label: "Task — My Day top-level list",
      coll: "tasks",
      filter: { "assignees.userId": userId, completedAt: null, parentTaskId: { $exists: false } },
      sort: { completionDate: 1, createdAt: 1 },
    },
    {
      label: "Log  — open follow-ups (My Day)",
      coll: "logs",
      filter: { createdById: userId, followUp: true, followedUpAt: null },
      sort: { followUpDeadline: 1 },
    },
    {
      label: "Project — active per client",
      coll: "projects",
      filter: { clientId, status: { $ne: "draft" } },
      sort: { createdAt: -1 },
    },
  ];

  console.log("── explain() on the hot queries ──");
  for (const c of checks) {
    const exp = (await db
      .collection(c.coll)
      .find(c.filter)
      .sort(c.sort)
      .explain("executionStats")) as Record<string, any>;
    const a = analyzePlan(exp.queryPlanner?.winningPlan);
    const es = exp.executionStats ?? {};
    const verdict = a.fullScan ? "COLLSCAN ❌" : a.usesIndex ? `IXSCAN ✅ (${a.indexName})` : "??";
    const sortNote = a.inMemorySort ? "  ⚠ in-memory SORT" : "  sort: index-backed";
    console.log(`\n${c.label}`);
    console.log(`   ${verdict}${sortNote}`);
    console.log(
      `   keysExamined=${es.totalKeysExamined ?? "?"} docsExamined=${es.totalDocsExamined ?? "?"} returned=${es.nReturned ?? "?"}`
    );
  }

  console.log("\nDone — read-only (only index catalog was ensured).");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
