import { ArchetypeModel } from "@/lib/models/Archetype";
import type { IArchetypeSnapshot } from "@/lib/models/SurveySession";

export interface EnrichedArchetype {
  id: string;
  name: string;
  color: string;
  description?: string;
}

/**
 * Resolve archetype name + color live from the Archetype collection.
 * Falls back to the snapshot value (legacy sessions) and finally to a
 * neutral default if both are missing — e.g., the Archetype doc was
 * deleted after the session was created.
 *
 * Use this everywhere a session's `templateSnapshot.archetypes` would
 * otherwise be read — keeps renames + recolors propagating to historical
 * sessions without a data migration.
 */
export async function enrichArchetypes(
  snapshotArchetypes: IArchetypeSnapshot[]
): Promise<EnrichedArchetype[]> {
  if (!snapshotArchetypes || snapshotArchetypes.length === 0) return [];
  const ids = snapshotArchetypes.map((a) => a.id);
  // Query with the same `rank ASC, createdAt ASC` ordering used by the admin
  // list (see lib/data.ts) so tied ranks resolve deterministically.
  const liveDocs = await ArchetypeModel.find({ _id: { $in: ids } })
    .select("name color description rank createdAt")
    .sort({ rank: 1, createdAt: 1 })
    .lean();
  const livePosition = new Map(liveDocs.map((d, idx) => [d._id.toString(), idx]));
  const liveById = new Map(liveDocs.map((d) => [d._id.toString(), d]));

  const withSort = snapshotArchetypes.map((snap, idx) => {
    const live = liveById.get(snap.id);
    return {
      enriched: {
        id: snap.id,
        name: live?.name ?? snap.name ?? "Unknown",
        color: live?.color ?? snap.color ?? "#7C3AED",
        description: live?.description ?? snap.description,
      },
      // Archetypes deleted from the admin DB fall to the bottom in their
      // original snapshot order.
      sortKey: livePosition.get(snap.id) ?? liveDocs.length + idx,
    };
  });
  withSort.sort((a, b) => a.sortKey - b.sortKey);
  return withSort.map((w) => w.enriched);
}
