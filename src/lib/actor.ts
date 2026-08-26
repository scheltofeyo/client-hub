import type { Session } from "next-auth";
import { activeTokenName } from "./api-token";

/**
 * The creator snapshot every record keeps, plus how the write arrived.
 *
 * `createdVia` holds the name of the API token that made the call, or stays
 * undefined for an ordinary browser session — so "absent" means "typed by a
 * human", which is the reading the UI relies on.
 *
 * Deliberately a sibling field rather than a suffix on createdByName: the name
 * feeds UserAvatar's initials (which would turn "Schelto (via mail-taak)" into
 * "SM") and the logbook's author filter labels, so decorating it corrupts both.
 */
export async function creatorFields(session: Session): Promise<{
  createdById: string;
  createdByName: string;
  createdVia?: string;
}> {
  const via = await activeTokenName();
  return {
    createdById: session.user.id,
    createdByName: session.user.name ?? "Unknown",
    ...(via ? { createdVia: via } : {}),
  };
}
