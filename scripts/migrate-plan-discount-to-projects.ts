/**
 * One-time migration: move the plan-level discount (ProjectPlan.discountType /
 * discountValue) onto the plan's projects, then remove the plan fields.
 *
 * Per plan with a discount:
 *   - percentage  → the same percentage is set on every project of the plan
 *   - amount      → distributed across the plan's projects proportionally to
 *                   their gross price (rounded to cents; the rounding remainder
 *                   goes to the largest project so the sum is exact)
 *
 * Projects that already have their own discountType are skipped (idempotency
 * guard). Afterwards discountType/discountValue are $unset on ALL projectplans.
 *
 * Dry-run by default — prints the per-plan before/after net totals so the
 * client-facing amounts can be verified to stay identical. Pass --confirm to
 * write.
 *
 * Run with:
 *   npx tsx scripts/migrate-plan-discount-to-projects.ts            (dry run)
 *   npx tsx scripts/migrate-plan-discount-to-projects.ts --confirm  (write)
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

type AllocationLine = { days?: number; dayRate?: number; marginMultiplier?: number };

/** Gross sell value of a project doc (mirrors calculateRolebasedPrice / soldPrice fallback). */
function grossOf(p: Record<string, unknown>): number {
  if (p.pricingMode === "rolebased" && Array.isArray(p.roleAllocation)) {
    return (p.roleAllocation as AllocationLine[]).reduce(
      (sum, l) => sum + (l.days || 0) * (l.dayRate || 0) * (l.marginMultiplier || 1),
      0
    );
  }
  return Number(p.soldPrice ?? 0);
}

function discountAmountFor(gross: number, type: string | undefined, value: number | undefined): number {
  if (!type || value == null || value <= 0) return 0;
  const raw = type === "percentage" ? gross * (value / 100) : value;
  return Math.min(Math.max(0, raw), Math.max(0, gross));
}

const eur = (n: number) => `€${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db!;
  const plansCol = db.collection("projectplans");
  const projectsCol = db.collection("projects");

  const plans = await plansCol
    .find({ discountType: { $in: ["percentage", "amount"] }, discountValue: { $gt: 0 } })
    .toArray();
  console.log(`Plans with a plan-level discount: ${plans.length}`);

  // projectId -> { discountType, discountValue }
  const projectUpdates = new Map<string, { discountType: string; discountValue: number }>();

  for (const plan of plans) {
    const planId = plan._id.toString();
    const projects = await projectsCol.find({ planId }).toArray();
    const planType = plan.discountType as "percentage" | "amount";
    const planValue = Number(plan.discountValue);

    const grosses = projects.map((p) => grossOf(p));
    const totalGross = grosses.reduce((s, g) => s + g, 0);
    const oldDiscount = discountAmountFor(totalGross, planType, planValue);
    const oldNet = totalGross - oldDiscount;

    console.log(`\nPlan "${plan.title}" (${planId})`);
    console.log(`  ${projects.length} project(s) · gross ${eur(totalGross)} · plan discount ${planType} ${planValue} → old net ${eur(oldNet)}`);

    if (projects.length === 0) {
      console.log("  ⚠ No projects — plan discount will simply be dropped.");
      continue;
    }

    const skipped = projects.filter((p) => p.discountType);
    if (skipped.length > 0) {
      console.log(`  ⚠ ${skipped.length} project(s) already have their own discount — skipped (idempotency guard).`);
    }
    const targets = projects.filter((p) => !p.discountType);
    if (targets.length === 0) {
      console.log("  Nothing to write for this plan.");
      continue;
    }

    if (planType === "percentage") {
      for (const p of targets) {
        projectUpdates.set(p._id.toString(), { discountType: "percentage", discountValue: planValue });
      }
    } else {
      // amount: distribute proportionally by gross, capped at the total gross.
      const targetGrosses = targets.map((p) => grossOf(p));
      const targetTotal = targetGrosses.reduce((s, g) => s + g, 0);
      const capped = Math.min(planValue, totalGross);
      if (planValue > totalGross) {
        console.log(`  ⚠ Plan discount ${eur(planValue)} exceeds total gross ${eur(totalGross)} — capped.`);
      }
      const shares = targets.map((_, i) => {
        const weight = targetTotal > 0 ? targetGrosses[i] / targetTotal : 1 / targets.length;
        return Math.round(capped * weight * 100) / 100;
      });
      // Assign the rounding remainder to the largest target so the sum is exact.
      const assigned = shares.reduce((s, v) => s + v, 0);
      const remainder = Math.round((capped - assigned) * 100) / 100;
      if (remainder !== 0) {
        const largestIdx = targetGrosses.indexOf(Math.max(...targetGrosses));
        shares[largestIdx] = Math.round((shares[largestIdx] + remainder) * 100) / 100;
      }
      targets.forEach((p, i) => {
        if (shares[i] <= 0) return;
        projectUpdates.set(p._id.toString(), { discountType: "amount", discountValue: shares[i] });
      });
    }

    // Verify equivalence: recompute net with the planned per-project discounts.
    let newNet = 0;
    for (const p of projects) {
      const gross = grossOf(p);
      const upd = projectUpdates.get(p._id.toString());
      const type = (upd?.discountType ?? p.discountType) as string | undefined;
      const value = upd?.discountValue ?? (p.discountValue as number | undefined);
      newNet += gross - discountAmountFor(gross, type, value);
    }
    const match = Math.abs(newNet - oldNet) < 0.01 ? "✓" : "✗ MISMATCH";
    console.log(`  New net ${eur(newNet)} vs old net ${eur(oldNet)} ${match}`);
    for (const p of targets) {
      const upd = projectUpdates.get(p._id.toString());
      if (upd) console.log(`    - "${p.title}": ${upd.discountType} ${upd.discountValue}`);
    }
  }

  if (!confirm) {
    console.log(`\nDry run — no changes made (${projectUpdates.size} project update(s) planned). Re-run with --confirm to write.`);
    await mongoose.disconnect();
    return;
  }

  let written = 0;
  for (const [projectId, upd] of projectUpdates) {
    await projectsCol.updateOne(
      { _id: new mongoose.Types.ObjectId(projectId) },
      { $set: { discountType: upd.discountType, discountValue: upd.discountValue } }
    );
    written += 1;
  }
  const unsetRes = await plansCol.updateMany(
    {},
    { $unset: { discountType: "", discountValue: "" } }
  );

  console.log(`\nUpdated ${written} project(s); removed plan discount fields from ${unsetRes.modifiedCount} plan(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
