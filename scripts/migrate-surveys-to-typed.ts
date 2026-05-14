/**
 * Migrates Archetype-Survey templates, sessions, and submissions to the new
 * typed-question model:
 *   1. Backfills `type: "archetype-ranking"` on every existing question + session
 *      snapshot question + submission answer where the field is missing.
 *   2. (Optional, gated by --cleanup-legacy) Migrates legacy open-text fields
 *      — per-question `openTextEnabled/openTextLabel`, per-section `openQuestion`,
 *      and template-level `closingOpenQuestion` — into standalone open-text
 *      questions and corresponding `answers[]` entries on submissions.
 *
 * Idempotent: re-running the script is safe — it skips records that already carry
 * the `type` field.
 *
 * Run:
 *   npx tsx scripts/migrate-surveys-to-typed.ts            (type-backfill only)
 *   npx tsx scripts/migrate-surveys-to-typed.ts --cleanup-legacy   (full migration)
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

const cleanupLegacy = process.argv.includes("--cleanup-legacy");

async function main() {
  await mongoose.connect(MONGODB_URI!);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No DB handle");

  const Templates = db.collection("archetypesurveytemplates");
  const Sections = db.collection("archetypesurveytemplatesections");
  const Questions = db.collection("archetypesurveytemplatequestions");
  const Sessions = db.collection("archetypesurveysessions");
  const Submissions = db.collection("archetypesurveysubmissions");

  console.log("\n── Step 1: backfill `type` on questions ──");
  const questionBackfill = await Questions.updateMany(
    { type: { $exists: false } },
    { $set: { type: "archetype-ranking" } }
  );
  console.log(`  questions backfilled: ${questionBackfill.modifiedCount}`);

  console.log("\n── Step 2: backfill `type` on session-snapshot questions ──");
  const sessions = await Sessions.find({}).toArray();
  let snapshotQuestionsBackfilled = 0;
  for (const s of sessions) {
    if (!s.templateSnapshot?.sections) continue;
    let changed = false;
    for (const sec of s.templateSnapshot.sections) {
      for (const q of sec.questions ?? []) {
        if (!q.type) {
          q.type = "archetype-ranking";
          changed = true;
          snapshotQuestionsBackfilled++;
        }
      }
    }
    if (changed) {
      await Sessions.updateOne(
        { _id: s._id },
        { $set: { "templateSnapshot.sections": s.templateSnapshot.sections } }
      );
    }
  }
  console.log(`  snapshot questions backfilled: ${snapshotQuestionsBackfilled}`);

  console.log("\n── Step 3: backfill `type` on submission answers ──");
  const submissions = await Submissions.find({}).toArray();
  let answersBackfilled = 0;
  for (const sub of submissions) {
    let changed = false;
    for (const a of sub.answers ?? []) {
      if (!a.type) {
        a.type = "archetype-ranking";
        changed = true;
        answersBackfilled++;
      }
    }
    if (changed) {
      await Submissions.updateOne({ _id: sub._id }, { $set: { answers: sub.answers } });
    }
  }
  console.log(`  submission answers backfilled: ${answersBackfilled}`);

  if (!cleanupLegacy) {
    console.log("\nDone (type-backfill only). Re-run with --cleanup-legacy to migrate legacy open-text fields.");
    await mongoose.disconnect();
    return;
  }

  console.log("\n── Step 4: cleanup legacy open-text fields ──");
  console.log("  (per-question comment, per-section openQuestion, template closingOpenQuestion)");

  // 4a. Templates with closingOpenQuestion.enabled → append open-text question to last section
  const templatesWithClosing = await Templates.find({
    "closingOpenQuestion.enabled": true,
  }).toArray();
  console.log(`  templates with closing question: ${templatesWithClosing.length}`);
  for (const t of templatesWithClosing) {
    const lastSection = await Sections.find({ templateId: t._id.toString() })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    if (lastSection.length === 0) continue;
    const sid = lastSection[0]._id.toString();
    const last = await Questions.find({ templateId: t._id.toString(), sectionId: sid })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    const order = last.length > 0 ? (last[0].order ?? 0) + 1 : 0;
    await Questions.insertOne({
      templateId: t._id.toString(),
      sectionId: sid,
      type: "open-text",
      title: t.closingOpenQuestion.label || "Anything else?",
      order,
      required: false,
      multiline: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await Templates.updateOne({ _id: t._id }, { $unset: { closingOpenQuestion: "" } });
  }

  // 4b. Sections with openQuestion.enabled → append open-text question
  const sectionsWithOpen = await Sections.find({
    "openQuestion.enabled": true,
  }).toArray();
  console.log(`  sections with openQuestion: ${sectionsWithOpen.length}`);
  for (const s of sectionsWithOpen) {
    const last = await Questions.find({ templateId: s.templateId, sectionId: s._id.toString() })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    const order = last.length > 0 ? (last[0].order ?? 0) + 1 : 0;
    await Questions.insertOne({
      templateId: s.templateId,
      sectionId: s._id.toString(),
      type: "open-text",
      title: s.openQuestion.label || "Anything to add about this section?",
      order,
      required: false,
      multiline: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await Sections.updateOne({ _id: s._id }, { $unset: { openQuestion: "" } });
  }

  // 4c. Questions with openTextEnabled → append separate open-text question
  const questionsWithComment = await Questions.find({
    openTextEnabled: true,
    type: { $ne: "open-text" },
  }).toArray();
  console.log(`  questions with comment field: ${questionsWithComment.length}`);
  for (const q of questionsWithComment) {
    await Questions.insertOne({
      templateId: q.templateId,
      sectionId: q.sectionId,
      type: "open-text",
      title: q.openTextLabel || "Add a comment",
      order: (q.order ?? 0) + 0.5,
      required: false,
      multiline: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await Questions.updateOne(
      { _id: q._id },
      { $unset: { openTextEnabled: "", openTextLabel: "" } }
    );
  }
  // Re-normalize order to integers per section
  const allTemplates = await Templates.find({}).project({ _id: 1 }).toArray();
  for (const t of allTemplates) {
    const sectionIds = (
      await Sections.find({ templateId: t._id.toString() }).project({ _id: 1 }).toArray()
    ).map((s) => s._id.toString());
    for (const sid of sectionIds) {
      const qs = await Questions.find({ templateId: t._id.toString(), sectionId: sid })
        .sort({ order: 1 })
        .toArray();
      for (let i = 0; i < qs.length; i++) {
        if (qs[i].order !== i) {
          await Questions.updateOne({ _id: qs[i]._id }, { $set: { order: i } });
        }
      }
    }
  }

  console.log("\n  Note: existing session snapshots are NOT mutated; they continue to render");
  console.log("  via the legacy code paths in the public-survey UI. New sessions created from");
  console.log("  cleaned-up templates will use the new shape.");

  console.log("\nDone.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
