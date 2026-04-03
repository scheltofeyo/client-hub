/**
 * One-time migration: extend existing User documents with employee fields.
 *
 * Run with: npx tsx scripts/migrate-users-to-employees.ts
 *
 * Prerequisites:
 *   - MONGODB_URI must be set in .env.local or environment
 *   - Back up the database before running
 *
 * This script is non-destructive — it only adds new fields to existing documents.
 */

import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db!;
  const collection = db.collection("users");

  // Count users to migrate
  const total = await collection.countDocuments();
  console.log(`Found ${total} user(s) to migrate.`);

  if (total === 0) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  // Migrate each user
  const cursor = collection.find({});
  let migrated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    // Skip if already migrated (has role field)
    if (doc.role) {
      skipped++;
      continue;
    }

    const update: Record<string, unknown> = {
      googleName: doc.name,
      googleImage: doc.image ?? undefined,
      role: doc.isAdmin ? "admin" : "member",
      status: "active",
    };

    await collection.updateOne({ _id: doc._id }, { $set: update });
    migrated++;
    console.log(`  Migrated: ${doc.email} → role=${update.role}, status=${update.status}`);
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} already migrated.`);

  // Update indexes
  console.log("\nUpdating indexes...");

  // Drop old googleId unique index and recreate as sparse
  try {
    await collection.dropIndex("googleId_1");
    console.log("  Dropped old googleId_1 index");
  } catch {
    console.log("  googleId_1 index not found (may already be sparse)");
  }

  await collection.createIndex({ googleId: 1 }, { unique: true, sparse: true });
  console.log("  Created sparse unique index on googleId");

  // Add unique index on email
  try {
    await collection.createIndex({ email: 1 }, { unique: true });
    console.log("  Created unique index on email");
  } catch {
    console.log("  email unique index already exists or failed (check for duplicates)");
  }

  console.log("\nDone!");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
