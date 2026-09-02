/**
 * Brings existing surveys onto the two rules the copy system changed under them.
 *
 * **Pass 1 — the language.** The runner used to open in English and let the
 * participant switch. It now takes the language off the survey itself, falling
 * back to Dutch, so without this an English survey that is already open would
 * start greeting people in Dutch — and a published session cannot be edited to fix
 * it. Templates get `defaultLocale` from their name ("… (EN)" → English), sessions
 * get `templateSnapshot.locale` from the template they were created from, falling
 * back to their own snapshot name.
 *
 * **Pass 2 — the empty level-question heading.** A blank copy field now means
 * "leave this line out" rather than "use the built-in text", and the level
 * question used to store `label: ""` for "never authored". Left alone, every
 * untouched level step would lose its question. Unsetting the field restores the
 * built-in one.
 *
 * Only `label` is unset, not `helpText`: nothing ever wrote a blank help text, so
 * a blank one now could only be a deliberate one.
 *
 * Idempotent: documents already carrying a language, or with no blank label, are
 * skipped.
 *
 * Run:
 *   npm run backfill:surveys
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

/** The naming convention every seeded template follows: "Something (EN)". */
function localeFromName(name: string | undefined): "nl" | "en" {
  return /\(\s*en\s*\)|\bEnglish\b/i.test(name ?? "") ? "en" : "nl";
}

async function main() {
  await mongoose.connect(MONGODB_URI!);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No DB handle");

  const Templates = db.collection("archetypesurveytemplates");
  const Sessions = db.collection("archetypesurveysessions");

  const localeByTemplateId = new Map<string, "nl" | "en">();
  let templatesUpdated = 0;
  for await (const doc of Templates.find({})) {
    const locale = doc.defaultLocale === "en" || doc.defaultLocale === "nl"
      ? (doc.defaultLocale as "nl" | "en")
      : localeFromName(doc.name);
    localeByTemplateId.set(String(doc._id), locale);
    if (doc.defaultLocale === locale) continue;
    await Templates.updateOne({ _id: doc._id }, { $set: { defaultLocale: locale } });
    templatesUpdated++;
    console.log(`  template "${doc.name}" → ${locale}`);
  }

  let sessionsUpdated = 0;
  for await (const doc of Sessions.find({})) {
    const current = doc.templateSnapshot?.locale;
    if (current === "nl" || current === "en") continue;
    // The template the session was made from is the better witness: a session is
    // usually titled after the client, not after the language.
    const locale =
      localeByTemplateId.get(String(doc.templateId ?? "")) ??
      localeFromName(doc.templateSnapshot?.name);
    await Sessions.updateOne(
      { _id: doc._id },
      { $set: { "templateSnapshot.locale": locale } }
    );
    sessionsUpdated++;
    console.log(`  session "${doc.title}" → ${locale}`);
  }

  console.log(
    `\nLanguage — ${templatesUpdated} template(s) and ${sessionsUpdated} session(s) stamped.`
  );

  // ── Pass 2: retire the "" that used to mean "no level question authored" ──
  const templateLabels = await Templates.updateMany(
    { "defaultRespondentVariable.label": "" },
    { $unset: { "defaultRespondentVariable.label": "" } }
  );
  const sessionLabels = await Sessions.updateMany(
    { "respondentVariable.label": "" },
    { $unset: { "respondentVariable.label": "" } }
  );
  console.log(
    `Level question — cleared the legacy empty heading on ${templateLabels.modifiedCount} template(s) and ${sessionLabels.modifiedCount} session(s).`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
