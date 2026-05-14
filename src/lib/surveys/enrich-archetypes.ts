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
  const liveDocs = await ArchetypeModel.find({ _id: { $in: ids } })
    .select("name color description")
    .lean();
  const liveById = new Map(liveDocs.map((d) => [d._id.toString(), d]));
  return snapshotArchetypes.map((snap) => {
    const live = liveById.get(snap.id);
    return {
      id: snap.id,
      name: live?.name ?? snap.name ?? "Unknown",
      color: live?.color ?? snap.color ?? "#7C3AED",
      description: live?.description ?? snap.description,
    };
  });
}
