import { connectDB } from "./mongodb";
import { sendEmail } from "./email";
import { RankingSessionModel } from "./models/RankingSession";
import { RankingSubmissionModel } from "./models/RankingSubmission";
import { findBalancedPairs, findBestDuoForUnmatched } from "./ranking/matching";
import type { Submission as MatchSubmission } from "./ranking/matching";
import RankingResultsEmail, { type RankingResultsEmailMatchInfo } from "@/emails/RankingResultsEmail";

export interface SendRankingResultsOptions {
  onlyUnsent?: boolean;
  senderLabel?: string;
}

export interface SendRankingResultsResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: { email: string; error: string }[];
}

export async function sendRankingResults(
  sessionId: string,
  options: SendRankingResultsOptions = {},
): Promise<SendRankingResultsResult> {
  await connectDB();

  const result: SendRankingResultsResult = { sent: 0, failed: 0, skipped: 0, errors: [] };

  const session = await RankingSessionModel.findById(sessionId).lean();
  if (!session || session.status !== "closed") return result;

  const submissions = await RankingSubmissionModel.find({
    sessionId,
    status: "completed",
  });
  if (submissions.length === 0) return result;

  const valueMap = new Map(session.values.map((v) => [v.id, v]));
  const numValues = session.values.length;

  const matchInputs: MatchSubmission[] = submissions
    .filter((s) => s.rankings && s.rankings.length > 0)
    .map((s) => ({
      id: s._id.toString(),
      participantName: s.participantName,
      participantEmail: s.participantEmail,
      rankings: s.rankings ?? [],
    }));

  const { pairs, unmatched } = findBalancedPairs(matchInputs);
  const bestDuo = unmatched ? findBestDuoForUnmatched(unmatched, pairs, numValues) : null;

  function matchInfoFor(submissionId: string): RankingResultsEmailMatchInfo | undefined {
    for (const pair of pairs) {
      const isP1 = pair.participant1.id === submissionId;
      const isP2 = pair.participant2.id === submissionId;
      if (!isP1 && !isP2) continue;

      const inTrio = !!(
        bestDuo &&
        (bestDuo.pair.participant1.id === submissionId || bestDuo.pair.participant2.id === submissionId)
      );

      if (inTrio && bestDuo && unmatched) {
        const partner = isP1 ? pair.participant2 : pair.participant1;
        return {
          kind: "trio",
          partnerNames: [partner.participantName, unmatched.participantName],
        };
      }

      const partner = isP1 ? pair.participant2 : pair.participant1;
      return {
        kind: "pair",
        partnerName: partner.participantName,
      };
    }

    if (unmatched && unmatched.id === submissionId && bestDuo) {
      return {
        kind: "trio",
        partnerNames: [bestDuo.pair.participant1.participantName, bestDuo.pair.participant2.participantName],
      };
    }
    if (unmatched && unmatched.id === submissionId) {
      return { kind: "none" };
    }
    return undefined;
  }

  const appUrl = process.env.APP_URL ?? "";
  const resultsUrl = appUrl
    ? `${appUrl}/ranking/${session.shareCode}`
    : `/ranking/${session.shareCode}`;

  for (const submission of submissions) {
    if (options.onlyUnsent && submission.resultsEmailedAt) {
      result.skipped++;
      continue;
    }
    if (!submission.rankings || submission.rankings.length === 0) {
      result.skipped++;
      continue;
    }

    const rankedValues = submission.rankings
      .map((vid) => valueMap.get(vid))
      .filter((v): v is NonNullable<typeof v> => !!v)
      .map((v) => ({ title: v.title, mantra: v.mantra, color: v.color }));

    const sendResult = await sendEmail({
      to: submission.participantEmail,
      subject: `Your ranking results — ${session.title}`,
      react: RankingResultsEmail({
        participantName: submission.participantName,
        sessionTitle: session.title,
        rankedValues,
        resultsUrl,
        senderLabel: options.senderLabel,
        match: matchInfoFor(submission._id.toString()),
      }),
      tags: [
        { name: "type", value: "ranking_results" },
        { name: "sessionId", value: sessionId },
      ],
    });

    if (sendResult.ok) {
      result.sent++;
      submission.resultsEmailedAt = new Date();
      await submission.save();
    } else {
      result.failed++;
      result.errors.push({ email: submission.participantEmail, error: sendResult.error ?? "Unknown error" });
    }
  }

  return result;
}
