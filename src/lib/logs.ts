/**
 * Shared logbook writes, used by both the REST route and the MCP tool so the
 * two surfaces can never drift on the rules that matter — the follow-up task a
 * log spawns, and the activity event it records.
 */
import type { Session } from "next-auth";
import type { Log } from "@/types";
import { creatorFields } from "./actor";
import { connectDB } from "./mongodb";
import { LogModel, type ILog } from "./models/Log";
import { TaskModel } from "./models/Task";
import { recordActivity } from "./activity";

/** The lean() shape of a doc — same fields, no Document methods. */
type Lean<T> = Omit<T, keyof import("mongoose").Document> & {
  _id: import("mongoose").Types.ObjectId;
};

export function serializeLog(doc: Lean<ILog>): Log {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId,
    // contactId is the pre-multi-contact field; fall back so old rows still read.
    contactIds: doc.contactIds?.length ? doc.contactIds : doc.contactId ? [doc.contactId] : [],
    date: doc.date,
    summary: doc.summary,
    signalIds: doc.signalIds ?? [],
    serviceId: doc.serviceId ?? undefined,
    followUp: doc.followUp ?? false,
    followUpAction: doc.followUpAction ?? undefined,
    followUpDeadline: doc.followUpDeadline ?? undefined,
    followedUpAt: doc.followedUpAt ?? undefined,
    followedUpByName: doc.followedUpByName ?? undefined,
    isSystemGenerated: doc.isSystemGenerated ?? false,
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdVia: doc.createdVia ?? undefined,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  };
}

export type CreateLogInput = {
  date?: unknown;
  summary?: unknown;
  contactIds?: unknown;
  signalIds?: unknown;
  followUp?: unknown;
  followUpAction?: unknown;
  followUpDeadline?: unknown;
};

/**
 * Validation failures come back as a value rather than a thrown error or a
 * NextResponse: the REST route turns `error` into a 400 and the MCP tool turns
 * it into a readable refusal, and neither has to know how the other reports.
 */
export type CreateLogResult = { ok: true; log: Log } | { ok: false; error: string };

/**
 * Create a log entry and, when it carries a follow-up, the derived task that
 * makes the follow-up show up in the tasks view.
 *
 * `completionDate` is stored on that task so the due date is visible there,
 * while the events query excludes tasks with a logId — otherwise the same
 * deadline would appear twice on the timeline.
 */
export async function createLogEntry(
  session: Session,
  clientId: string,
  input: CreateLogInput
): Promise<CreateLogResult> {
  const date = typeof input.date === "string" ? input.date.trim() : "";
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  const followUp = !!input.followUp;
  const followUpAction =
    typeof input.followUpAction === "string" ? input.followUpAction.trim() : "";
  const followUpDeadline =
    typeof input.followUpDeadline === "string" && input.followUpDeadline.trim()
      ? input.followUpDeadline.trim()
      : undefined;

  if (!date) return { ok: false, error: "Date is required" };
  if (!summary) return { ok: false, error: "Summary is required" };
  if (followUp && !followUpAction) {
    return { ok: false, error: "A follow-up action is required when follow-up is enabled." };
  }

  await connectDB();

  // One lookup for both writes — creatorFields() hits the DB to resolve the
  // token name, and the log and its task are always the same actor.
  const creator = await creatorFields(session);

  const doc = await LogModel.create({
    clientId,
    contactIds: Array.isArray(input.contactIds) ? input.contactIds : [],
    date,
    summary,
    signalIds: Array.isArray(input.signalIds) ? input.signalIds : [],
    followUp,
    followUpAction: followUp && followUpAction ? followUpAction : undefined,
    followUpDeadline: followUp ? followUpDeadline : undefined,
    ...creator,
  });

  if (doc.followUp && doc.followUpAction) {
    const task = await TaskModel.create({
      clientId,
      logId: doc._id.toString(),
      title: doc.followUpAction,
      completionDate: doc.followUpDeadline || undefined,
      ...creator,
    });
    await LogModel.findByIdAndUpdate(doc._id, { $set: { followUpTaskId: task._id.toString() } });
  }

  await recordActivity({
    clientId,
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "log.created",
    metadata: {
      logId: doc._id.toString(),
      summary: doc.summary.slice(0, 80),
      followUp: doc.followUp ?? false,
      followUpAction: doc.followUpAction,
    },
  });

  return { ok: true, log: serializeLog(doc.toObject()) };
}
