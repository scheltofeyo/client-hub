/**
 * Ranking the Values — the one place a session's matching comes from.
 *
 * The admin overview and the participant results page used to each compute the
 * pairing themselves, from lists sorted differently (`createdAt` vs
 * `submittedAt`). Since the algorithm breaks ties on array order, the two
 * screens could hand out different duos for the same session — a facilitator
 * briefing the room from the admin screen was sometimes simply wrong.
 *
 * Both surfaces now call `resolveSessionMatching()` and render what it returns.
 * Nothing else may pair participants up.
 */
import { RankingSessionModel, type IRankingValue } from "@/lib/models/RankingSession";
import { RankingSubmissionModel } from "@/lib/models/RankingSubmission";
import {
  calculateSquaredDistance,
  findBestDuoForUnmatched,
  findPairs,
  normalizeDistance,
  type MatchPair,
  type Submission,
} from "./matching";

export interface ResolvedPair {
  participant1Id: string;
  participant2Id: string;
  opposition: number;
}

export interface ResolvedMatching {
  pairs: ResolvedPair[];
  unmatchedId: string | null;
  /** The duo the leftover participant should join, if there is one. */
  bestDuo: { participant1Id: string; participant2Id: string; avgOpposition: number } | null;
  /** Everyone in the matching, for rendering names and side-by-side rankings. */
  participants: { id: string; participantName: string; rankings: string[] }[];
  /**
   * Submissions whose rankings do not fit the session's values, so they could
   * not be matched. Surfaced rather than skipped: a ranking that cannot be
   * scored is a problem someone has to see.
   */
  invalid: { id: string; participantName: string; reason: string }[];
  /** True once the pairing is stored on the session and will not change again. */
  frozen: boolean;
}

/** Sessions past this point have handed their results to participants. */
function isFinal(status: string): boolean {
  return status === "closed" || status === "archived";
}

/**
 * The session fields this module needs. Structural rather than the full
 * document so both `findById().lean()` and `findOne({ shareCode }).lean()`
 * results fit without casting.
 */
export interface MatchableSession {
  _id: unknown;
  status: string;
  values: Pick<IRankingValue, "id">[];
  matching?: {
    pairs: ResolvedPair[];
    unmatchedId?: string | null;
    computedAt: Date;
  } | null;
}

/**
 * Load completed submissions in a canonical order and split off the ones whose
 * rankings do not describe this session's values.
 *
 * Sorting by `_id` is the point: it is stable, it is the same for every caller,
 * and it does not depend on when anyone started or finished. Everything
 * downstream breaks ties on array position, so this is what makes the result
 * reproducible.
 */
async function collectRankings(session: MatchableSession, sessionId: string) {
  const docs = await RankingSubmissionModel.find({
    sessionId,
    status: "completed",
  })
    .sort({ _id: 1 })
    .lean();

  const valueIds = new Set(session.values.map((v) => v.id));
  const valid: Submission[] = [];
  const invalid: ResolvedMatching["invalid"] = [];

  for (const doc of docs) {
    const id = doc._id.toString();
    const rankings = doc.rankings ?? [];
    const unique = new Set(rankings);

    let reason: string | null = null;
    if (rankings.length !== valueIds.size) {
      reason = `ranked ${rankings.length} values, the session has ${valueIds.size}`;
    } else if (unique.size !== rankings.length) {
      reason = "the same value appears more than once";
    } else if (rankings.some((valueId) => !valueIds.has(valueId))) {
      reason = "ranked a value that is not part of this session";
    }

    if (reason) {
      invalid.push({ id, participantName: doc.participantName, reason });
      continue;
    }

    valid.push({
      id,
      participantName: doc.participantName,
      participantEmail: doc.participantEmail,
      rankings,
    });
  }

  return { valid, invalid };
}

/**
 * Rebuild the stored pairing against the submissions that exist now, keeping
 * every pair that is still intact.
 *
 * A pair only disappears if one of its members does; the survivor then rejoins
 * the pool. Anyone not covered by a surviving pair — a newcomer, a survivor, or
 * the participant who was left over last time — is matched among themselves and
 * appended. Nobody who has already been told who they are talking to gets moved.
 */
function reconcile(
  stored: NonNullable<MatchableSession["matching"]>,
  valid: Submission[]
): { pairs: MatchPair[]; unmatched: Submission | null; changed: boolean } {
  const byId = new Map(valid.map((s) => [s.id, s]));
  const kept: MatchPair[] = [];
  const covered = new Set<string>();
  let changed = false;

  for (const pair of stored.pairs) {
    const first = byId.get(pair.participant1Id);
    const second = byId.get(pair.participant2Id);
    if (!first || !second) {
      changed = true;
      continue;
    }
    kept.push({
      participant1: first,
      participant2: second,
      // Needed for ordering and the trio suggestion; the opposition percentage
      // these two were shown is preserved separately by the caller.
      distance: calculateSquaredDistance(first.rankings, second.rankings),
    });
    covered.add(first.id);
    covered.add(second.id);
  }

  const pool = valid.filter((s) => !covered.has(s.id));
  const fresh = pool.length > 0 ? findPairs(pool) : { pairs: [], unmatched: null };

  if (fresh.pairs.length > 0) changed = true;
  if ((fresh.unmatched?.id ?? null) !== (stored.unmatchedId ?? null)) changed = true;

  return { pairs: [...kept, ...fresh.pairs], unmatched: fresh.unmatched, changed };
}

/**
 * The matching for a session: stored if it has one, computed and stored if the
 * session is finished, computed on the fly while it is still running.
 */
export async function resolveSessionMatching(
  session: MatchableSession
): Promise<ResolvedMatching> {
  const sessionId = String(session._id);
  const numValues = session.values.length;
  const { valid, invalid } = await collectRankings(session, sessionId);

  const stored = session.matching;
  const { pairs, unmatched, changed } = stored
    ? reconcile(stored, valid)
    : { ...findPairs(valid), changed: true };

  // Opposition percentages come from the stored value where we have one, so a
  // frozen pair keeps the exact number the participants saw.
  const storedOpposition = new Map(
    (stored?.pairs ?? []).map((p) => [`${p.participant1Id}:${p.participant2Id}`, p.opposition])
  );
  const resolvedPairs: ResolvedPair[] = pairs.map((p) => ({
    participant1Id: p.participant1.id,
    participant2Id: p.participant2.id,
    opposition:
      storedOpposition.get(`${p.participant1.id}:${p.participant2.id}`) ??
      normalizeDistance(p.distance, numValues),
  }));

  const duo = unmatched ? findBestDuoForUnmatched(unmatched, pairs, numValues) : null;

  const frozen = isFinal(session.status);
  if (frozen && changed) {
    await RankingSessionModel.updateOne(
      { _id: sessionId },
      {
        $set: {
          matching: {
            pairs: resolvedPairs,
            unmatchedId: unmatched?.id ?? null,
            computedAt: new Date(),
          },
        },
      }
    );
  }

  return {
    pairs: resolvedPairs,
    unmatchedId: unmatched?.id ?? null,
    bestDuo: duo
      ? {
          participant1Id: duo.pair.participant1.id,
          participant2Id: duo.pair.participant2.id,
          avgOpposition: duo.avgOpposition,
        }
      : null,
    participants: valid.map((s) => ({
      id: s.id,
      participantName: s.participantName,
      rankings: s.rankings,
    })),
    invalid,
    frozen,
  };
}
