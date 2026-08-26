/**
 * The tool surface exposed over MCP.
 *
 * Every tool maps onto a permission the hub already enforces elsewhere — the
 * MCP endpoint grants no capability a token holder does not already have over
 * the REST API, which is why it needs no permission of its own. Writes go
 * through the same shared helpers the REST routes call (createLogEntry,
 * moveSalesCard), so behaviour cannot drift between the two surfaces and the
 * "via" attribution from the API-token work keeps working for free.
 */
import type { Session } from "next-auth";
import mongoose from "mongoose";
import type { Permission } from "@/lib/permissions";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { LogModel } from "@/lib/models/Log";
import { ProjectModel } from "@/lib/models/Project";
import { TaskModel } from "@/lib/models/Task";
import { UserModel } from "@/lib/models/User";
import { SalesBoardModel } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { moveSalesCard } from "@/lib/sales";
import { createLogEntry, serializeLog } from "@/lib/logs";
import {
  canEditTask,
  checkParent,
  checkReparent,
  createTask,
  updateTask,
  type LeanTask,
} from "@/lib/tasks";
import type { TaskAssignee } from "@/types";

/**
 * A failure the model should read and act on — a wrong id, a column that does
 * not exist, a missing permission. Surfaces as an MCP tool result with
 * isError: true rather than a JSON-RPC error, which is reserved for protocol
 * faults the model can do nothing about.
 */
export class ToolError extends Error {}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Absent means "any authenticated caller", matching GET /api/clients. */
  permission?: Permission;
  handler: (session: Session, args: Record<string, unknown>) => Promise<unknown>;
}

// ── Argument helpers ─────────────────────────────────────────────────

function str(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new ToolError(`"${key}" must be a string.`);
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function requiredStr(args: Record<string, unknown>, key: string): string {
  const value = str(args, key);
  if (!value) throw new ToolError(`"${key}" is required.`);
  return value;
}

/**
 * Like str(), but keeps an explicit `null` distinct from an absent key.
 *
 * Re-parenting needs that distinction: "parentTaskId" absent means leave the
 * task where it is, while `null` means promote it to top level. str() collapses
 * both to undefined.
 */
function nullableStr(args: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in args)) return undefined;
  const value = args[key];
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new ToolError(`"${key}" must be a string or null.`);
  return value.trim() === "" ? null : value.trim();
}

function bool(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new ToolError(`"${key}" must be true or false.`);
  return value;
}

function num(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ToolError(`"${key}" must be a number.`);
  }
  return value;
}

function strArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new ToolError(`"${key}" must be an array of strings.`);
  }
  return value as string[];
}

function limit(args: Record<string, unknown>, fallback: number, max = 100): number {
  const value = num(args, "limit");
  if (value === undefined) return fallback;
  return Math.max(1, Math.min(Math.floor(value), max));
}

/** Escape a user string so it can go into a regex as a literal. */
function literal(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requireClient(clientId: string) {
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    throw new ToolError(`"${clientId}" is not a valid client id. Use find_clients to look one up.`);
  }
  const client = await ClientModel.findById(clientId).select("company contacts").lean();
  if (!client) throw new ToolError(`No client found with id ${clientId}.`);
  return client;
}

/**
 * Projects resolve by id or title, but always *within a client that has already
 * been resolved by id*.
 *
 * There is no list_projects tool, so an id-only contract would leave a model
 * unable to file a task under a project at all. Scoping the title lookup to one
 * client keeps the ambiguity bounded — two clients may both have a "Website
 * redesign", one client rarely does.
 */
async function requireProject(clientId: string, idOrName: string) {
  const byId = mongoose.Types.ObjectId.isValid(idOrName)
    ? await ProjectModel.findOne({ _id: idOrName, clientId }).select("title status").lean()
    : null;
  if (byId) return byId;

  const matches = await ProjectModel.find({
    clientId,
    title: new RegExp(`^${literal(idOrName)}$`, "i"),
  })
    .select("title status")
    .lean();

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new ToolError(
      `"${idOrName}" matches ${matches.length} projects for this client. Pass the project id instead.`
    );
  }

  const all = await ProjectModel.find({ clientId }, { title: 1 }).lean();
  const available = all.map((p) => p.title).join(", ") || "none";
  throw new ToolError(
    `No project matches "${idOrName}" for this client. Available projects: ${available}.`
  );
}

async function requireTask(taskId: string): Promise<LeanTask> {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ToolError(`"${taskId}" is not a valid task id. Use list_tasks to look one up.`);
  }
  const task = await TaskModel.findById(taskId).lean();
  if (!task) throw new ToolError(`No task found with id ${taskId}.`);
  return task as LeanTask;
}

/**
 * Turn assignee names into the stored snapshot.
 *
 * The `image` must travel with the name: list endpoints read
 * `assignees[].image` rather than joining against User, so an assignee written
 * without one shows a blank avatar until that person next signs in.
 *
 * An unknown or ambiguous name is refused rather than dropped — a task silently
 * assigned to nobody is a quiet data-quality bug, the same reasoning
 * create_log_entry applies to contact ids.
 */
async function resolveAssignees(names: string[]): Promise<TaskAssignee[]> {
  const users = await UserModel.find({
    $or: [{ status: "active" }, { status: { $exists: false } }],
  })
    .select("name email image")
    .lean();

  const resolved: TaskAssignee[] = [];
  for (const raw of names) {
    const needle = raw.trim().toLowerCase();
    if (!needle) continue;
    const matches = users.filter(
      (u) => u.name?.toLowerCase() === needle || u.email?.toLowerCase() === needle
    );
    if (matches.length === 0) {
      const available = users.map((u) => u.name).filter(Boolean).join(", ");
      throw new ToolError(`No active user matches "${raw}". Available: ${available}.`);
    }
    if (matches.length > 1) {
      throw new ToolError(
        `"${raw}" matches ${matches.length} users. Use the person's email address instead.`
      );
    }
    const user = matches[0];
    resolved.push({
      userId: user._id.toString(),
      name: user.name,
      image: user.image ?? undefined,
    });
  }
  return resolved;
}

/** Boards resolve by id or name — a model reasoning about the funnel has the name. */
async function requireBoard(idOrName: string) {
  const board = mongoose.Types.ObjectId.isValid(idOrName)
    ? await SalesBoardModel.findById(idOrName).lean()
    : null;
  if (board) return board;

  const byName = await SalesBoardModel.findOne({
    name: new RegExp(`^${literal(idOrName)}$`, "i"),
  }).lean();
  if (byName) return byName;

  const all = await SalesBoardModel.find({}, { name: 1 }).lean();
  const available = all.map((b) => b.name).join(", ") || "none";
  throw new ToolError(`No board matches "${idOrName}". Available boards: ${available}.`);
}

function serializeClient(doc: {
  _id: mongoose.Types.ObjectId;
  company: string;
  status?: string;
  platform?: string;
  website?: string;
  employees?: number;
  contacts?: { id: string; firstName: string; lastName: string; role?: string; email?: string }[];
  leads?: { userId: string; name: string }[];
}) {
  return {
    id: doc._id.toString(),
    company: doc.company,
    status: doc.status ?? null,
    platform: doc.platform ?? null,
    website: doc.website ?? null,
    employees: doc.employees ?? null,
    contacts: (doc.contacts ?? []).map((c) => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" "),
      role: c.role ?? null,
      email: c.email ?? null,
    })),
    leads: (doc.leads ?? []).map((l) => l.name),
  };
}

const CLIENT_SELECT = "company status platform website employees contacts leads";

// ── Tools ────────────────────────────────────────────────────────────

export const MCP_TOOLS: McpTool[] = [
  {
    name: "find_clients",
    description:
      "Search clients and prospects by company name. Returns their id, status, contacts and " +
      "leads. Call this first to get the clientId the write tools need. Omit `query` to list " +
      "everything.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Case-insensitive substring of the company name." },
        status: {
          type: "string",
          description: 'Filter by client status, e.g. "prospect" or "active".',
        },
        limit: { type: "number", description: "Maximum results (default 25, max 100)." },
      },
      additionalProperties: false,
    },
    handler: async (_session, args) => {
      const query = str(args, "query");
      const status = str(args, "status");
      const max = limit(args, 25);

      await connectDB();
      const filter: Record<string, unknown> = {};
      if (query) filter.company = new RegExp(literal(query), "i");
      if (status) filter.status = status;

      const docs = await ClientModel.find(filter)
        .select(CLIENT_SELECT)
        .sort({ company: 1 })
        .limit(max)
        .lean();

      return { count: docs.length, clients: docs.map(serializeClient) };
    },
  },

  {
    name: "list_prospects",
    description:
      "List every client with status \"prospect\" — the ones eligible for a sales board. " +
      "Use get_sales_board to see which funnel stage each one sits in.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum results (default 50, max 100)." },
      },
      additionalProperties: false,
    },
    handler: async (_session, args) => {
      const max = limit(args, 50);
      await connectDB();
      const docs = await ClientModel.find({ status: "prospect" })
        .select(CLIENT_SELECT)
        .sort({ company: 1 })
        .limit(max)
        .lean();
      return { count: docs.length, prospects: docs.map(serializeClient) };
    },
  },

  {
    name: "list_sales_boards",
    description:
      "List the sales funnel boards with their columns (funnel stages), the number of open " +
      "cards and the total deal value on each.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    permission: "sales.access",
    handler: async () => {
      await connectDB();
      const [docs, totals] = await Promise.all([
        SalesBoardModel.find().sort({ rank: 1, createdAt: 1 }).lean(),
        SalesCardModel.aggregate<{ _id: string; count: number; value: number }>([
          { $match: { outcome: { $exists: false } } },
          {
            $group: {
              _id: "$boardId",
              count: { $sum: 1 },
              value: { $sum: { $ifNull: ["$dealValue", 0] } },
            },
          },
        ]),
      ]);
      const totalsMap = new Map(totals.map((t) => [t._id, t]));

      return {
        boards: docs.map((doc) => {
          const id = doc._id.toString();
          const t = totalsMap.get(id);
          return {
            id,
            name: doc.name,
            description: doc.description ?? null,
            columns: (doc.columns ?? [])
              .slice()
              .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
              .map((c) => ({ id: c.id, title: c.title })),
            openCards: t?.count ?? 0,
            totalValue: t?.value ?? 0,
          };
        }),
      };
    },
  },

  {
    name: "get_sales_board",
    description:
      "Read one sales board: every column (funnel stage) with the prospect cards in it. " +
      "The board can be named by id or by name. Card ids from here are what move_sales_card " +
      "expects.",
    inputSchema: {
      type: "object",
      properties: {
        board: { type: "string", description: "Board id or board name." },
        includeArchived: {
          type: "boolean",
          description: "Include cards already marked won or lost (default false).",
        },
      },
      required: ["board"],
      additionalProperties: false,
    },
    permission: "sales.access",
    handler: async (_session, args) => {
      const boardRef = requiredStr(args, "board");
      const includeArchived = args.includeArchived === true;

      await connectDB();
      const board = await requireBoard(boardRef);
      const boardId = board._id.toString();

      const filter: Record<string, unknown> = { boardId };
      if (!includeArchived) filter.outcome = { $exists: false };
      const cards = await SalesCardModel.find(filter).sort({ order: 1, createdAt: 1 }).lean();

      const clients = await ClientModel.find({
        _id: { $in: cards.map((c) => c.clientId).filter((id) => mongoose.Types.ObjectId.isValid(id)) },
      })
        .select("company website contacts")
        .lean();
      const clientMap = new Map(clients.map((c) => [c._id.toString(), c]));

      const columns = (board.columns ?? [])
        .slice()
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

      return {
        id: boardId,
        name: board.name,
        columns: columns.map((column) => ({
          id: column.id,
          title: column.title,
          cards: cards
            .filter((card) => card.columnId === column.id)
            .map((card) => {
              const client = clientMap.get(card.clientId);
              const contact = card.contactId
                ? (client?.contacts ?? []).find((c) => c.id === card.contactId)
                : undefined;
              return {
                cardId: card._id.toString(),
                clientId: card.clientId,
                // A deleted client leaves the card readable rather than blowing up.
                company: client?.company ?? "Onbekende prospect",
                dealValue: card.dealValue ?? null,
                expectedCloseDate: card.expectedCloseDate ?? null,
                source: card.source ?? null,
                labels: card.labels ?? [],
                notes: card.notes ?? null,
                owners: (card.owners ?? []).map((o) => o.name),
                contact: contact
                  ? { name: [contact.firstName, contact.lastName].filter(Boolean).join(" "), email: contact.email ?? null }
                  : null,
                outcome: card.outcome ?? null,
              };
            }),
        })),
      };
    },
  },

  {
    name: "move_sales_card",
    description:
      "Move a prospect card to another column (funnel stage) on its board, or reorder it " +
      "within one. Call get_sales_board first to get the cardId. The destination may be given " +
      "as a column id or its title.",
    inputSchema: {
      type: "object",
      properties: {
        board: { type: "string", description: "Board id or board name." },
        cardId: { type: "string", description: "Card id, as returned by get_sales_board." },
        toColumn: { type: "string", description: "Destination column id or title." },
        position: {
          type: "number",
          description: "Zero-based slot in the destination column. Defaults to the end.",
        },
      },
      required: ["board", "cardId", "toColumn"],
      additionalProperties: false,
    },
    permission: "sales.cards.manage",
    handler: async (session, args) => {
      const boardRef = requiredStr(args, "board");
      const cardId = requiredStr(args, "cardId");
      const toColumn = requiredStr(args, "toColumn");
      const position = num(args, "position");

      await connectDB();
      const board = await requireBoard(boardRef);

      if (!mongoose.Types.ObjectId.isValid(cardId)) {
        throw new ToolError(`"${cardId}" is not a valid card id. Use get_sales_board to look one up.`);
      }

      const moved = await moveSalesCard(session, board._id.toString(), cardId, toColumn, {
        position,
      });
      if (!moved.ok) throw new ToolError(moved.error);

      return {
        moved: true,
        board: board.name,
        from: moved.from ?? null,
        to: moved.to,
      };
    },
  },

  {
    name: "create_log_entry",
    description:
      "Write an entry into a client's logbook. Use find_clients to get the clientId and its " +
      "contact ids first. Setting followUp true also creates a follow-up task, and then " +
      "followUpAction is required.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client id from find_clients." },
        summary: { type: "string", description: "What happened. Plain text." },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        contactIds: {
          type: "array",
          items: { type: "string" },
          description: "Contact ids from the client's contacts list.",
        },
        followUp: { type: "boolean", description: "Whether this needs a follow-up." },
        followUpAction: { type: "string", description: "Required when followUp is true." },
        followUpDeadline: { type: "string", description: "YYYY-MM-DD deadline for the follow-up." },
      },
      required: ["clientId", "summary"],
      additionalProperties: false,
    },
    permission: "logs.create",
    handler: async (session, args) => {
      const clientId = requiredStr(args, "clientId");
      const summary = requiredStr(args, "summary");
      const date = str(args, "date") ?? new Date().toISOString().split("T")[0];
      const contactIds = strArray(args, "contactIds");

      await connectDB();
      const client = await requireClient(clientId);

      // Reject unknown contact ids rather than silently dropping them — a log
      // attributed to nobody is a quiet data-quality bug.
      if (contactIds?.length) {
        const known = new Set((client.contacts ?? []).map((c) => c.id));
        const unknown = contactIds.filter((id) => !known.has(id));
        if (unknown.length) {
          throw new ToolError(
            `Unknown contact id(s) for ${client.company}: ${unknown.join(", ")}. ` +
              `Use find_clients to get valid contact ids.`
          );
        }
      }

      const created = await createLogEntry(session, clientId, {
        date,
        summary,
        contactIds: contactIds ?? [],
        followUp: args.followUp === true,
        followUpAction: str(args, "followUpAction"),
        followUpDeadline: str(args, "followUpDeadline"),
      });
      if (!created.ok) throw new ToolError(created.error);

      return { created: true, company: client.company, log: created.log };
    },
  },

  {
    name: "list_client_logs",
    description:
      "Read the most recent logbook entries for one client. Useful to check whether something " +
      "has already been recorded before writing a new entry.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client id from find_clients." },
        limit: { type: "number", description: "Maximum entries (default 10, max 100)." },
      },
      required: ["clientId"],
      additionalProperties: false,
    },
    handler: async (_session, args) => {
      const clientId = requiredStr(args, "clientId");
      const max = limit(args, 10);

      await connectDB();
      const client = await requireClient(clientId);
      const docs = await LogModel.find({ clientId })
        .sort({ date: -1, createdAt: -1 })
        .limit(max)
        .lean();

      return { company: client.company, count: docs.length, logs: docs.map(serializeLog) };
    },
  },

  {
    name: "create_task",
    description:
      "Create a task for a client, optionally inside one of that client's projects and " +
      "optionally as a subtask of an existing task. Use find_clients to get the clientId " +
      "first. A subtask always inherits its parent's assignees, so `assignees` cannot be " +
      "combined with `parentTaskId`.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client id from find_clients." },
        title: { type: "string", description: "What needs doing." },
        project: {
          type: "string",
          description:
            "Optional project id or exact project title, belonging to this client. Omit for a " +
            "client-level task.",
        },
        description: { type: "string", description: "Optional longer description." },
        deadline: { type: "string", description: "YYYY-MM-DD due date." },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "Names or email addresses of active hub users.",
        },
        parentTaskId: {
          type: "string",
          description: "Optional id of an existing top-level task to nest this one under.",
        },
      },
      required: ["clientId", "title"],
      additionalProperties: false,
    },
    permission: "tasks.create",
    handler: async (session, args) => {
      const clientId = requiredStr(args, "clientId");
      const title = requiredStr(args, "title");
      const projectRef = str(args, "project");
      const parentTaskId = str(args, "parentTaskId");
      const assigneeNames = strArray(args, "assignees");

      await connectDB();
      const client = await requireClient(clientId);

      const project = projectRef ? await requireProject(clientId, projectRef) : null;
      const projectId = project?._id.toString();

      // Everything is resolved before the write, so a bad reference refuses
      // without having created anything.
      if (parentTaskId) {
        if (assigneeNames?.length) {
          // Refused rather than quietly dropped: a subtask always follows its
          // parent's assignees, so honouring this would be impossible and
          // ignoring it would hand back a task assigned to someone else.
          throw new ToolError(
            "A subtask always inherits its parent's assignees, so `assignees` cannot be set on " +
              "one. Assign the parent task instead, or create this as a top-level task."
          );
        }
        const checked = await checkParent(parentTaskId, { clientId, projectId });
        if ("error" in checked) throw new ToolError(checked.error);
      }

      const assignees = assigneeNames?.length ? await resolveAssignees(assigneeNames) : undefined;

      const created = await createTask(session, {
        clientId,
        projectId,
        title,
        description: str(args, "description"),
        completionDate: str(args, "deadline"),
        assignees,
        parentTaskId,
      });
      if (!created.ok) throw new ToolError(created.error);

      return {
        created: true,
        company: client.company,
        project: project?.title ?? null,
        task: created.task,
      };
    },
  },

  {
    name: "list_tasks",
    description:
      "Read a client's tasks, open ones by default. Pass `project` to narrow to a single " +
      "project. Every task carries its id, deadline, assignees and its parentTaskId — the ids " +
      "the other task tools expect.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "Client id from find_clients." },
        project: {
          type: "string",
          description:
            "Optional project id or exact project title. Omit to get every task for the client, " +
            "project-level and client-level alike.",
        },
        includeCompleted: {
          type: "boolean",
          description: "Include tasks already ticked off (default false).",
        },
        limit: { type: "number", description: "Maximum results (default 50, max 100)." },
      },
      required: ["clientId"],
      additionalProperties: false,
    },
    handler: async (_session, args) => {
      const clientId = requiredStr(args, "clientId");
      const projectRef = str(args, "project");
      const includeCompleted = args.includeCompleted === true;
      const max = limit(args, 50);

      await connectDB();
      const client = await requireClient(clientId);
      const project = projectRef ? await requireProject(clientId, projectRef) : null;

      const filter: Record<string, unknown> = { clientId };
      if (project) filter.projectId = project._id.toString();
      // `null` matches both an explicit null (a reopened task) and a missing
      // field (one never completed) — `$exists: false` would miss the former.
      if (!includeCompleted) filter.completedAt = null;

      // Newest first, unlike the hub's own lists, which sort by the manual
      // `order`. That order is assigned per scope, so it means nothing once a
      // client's project and client-level tasks are mixed — and when the limit
      // bites, dropping the stale tail beats dropping the work just written.
      // (Sorting by deadline would read better still, but Mongo ranks a missing
      // field lowest, which would float every undated task above the urgent ones.)
      const [docs, total] = await Promise.all([
        TaskModel.find(filter).sort({ createdAt: -1 }).limit(max).lean(),
        TaskModel.countDocuments(filter),
      ]);

      // One lookup for the project titles rather than one per task.
      const projectIds = [...new Set(docs.map((d) => d.projectId).filter(Boolean))] as string[];
      const projects = await ProjectModel.find({ _id: { $in: projectIds } }, { title: 1 }).lean();
      const titles = new Map(projects.map((p) => [p._id.toString(), p.title]));

      return {
        company: client.company,
        count: docs.length,
        // Say so when the limit cut the list short, rather than letting a
        // partial answer read as the whole picture.
        ...(total > docs.length ? { total, truncated: true } : {}),
        tasks: docs.map((doc) => ({
          id: doc._id.toString(),
          title: doc.title,
          description: doc.description ?? null,
          project: doc.projectId ? titles.get(doc.projectId) ?? null : null,
          projectId: doc.projectId ?? null,
          parentTaskId: doc.parentTaskId ?? null,
          deadline: doc.completionDate ?? null,
          assignees: (doc.assignees ?? []).map((a) => a.name),
          completed: !!doc.completedAt,
          completedByName: doc.completedByName ?? null,
          // A follow-up came out of a logbook entry; ticking it off marks that
          // entry as followed up, which is worth knowing before touching it.
          isFollowUp: !!doc.logId,
          createdByName: doc.createdByName,
          createdVia: doc.createdVia ?? null,
        })),
      };
    },
  },

  {
    name: "update_task",
    description:
      "Change an existing task's title, description, deadline, assignees or parent. Use " +
      "list_tasks to get the taskId. Completion is a separate tool — set_task_completion. " +
      "Requires permission to edit the task; a task you created counts as your own.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task id from list_tasks." },
        title: { type: "string", description: "New title." },
        description: { type: "string", description: "New description; empty string clears it." },
        deadline: { type: "string", description: "YYYY-MM-DD; empty string clears it." },
        assignees: {
          type: "array",
          items: { type: "string" },
          description:
            "Names or emails of active hub users. Replaces the current set, and cascades to " +
            "any subtasks.",
        },
        parentTaskId: {
          type: ["string", "null"],
          description:
            "Id of a top-level task in the same client and project to nest this task under, or " +
            "null to promote it back to top level.",
        },
      },
      required: ["taskId"],
      additionalProperties: false,
    },
    handler: async (session, args) => {
      const taskId = requiredStr(args, "taskId");
      const title = str(args, "title");
      const assigneeNames = strArray(args, "assignees");
      const parentTaskId = nullableStr(args, "parentTaskId");

      // Absent and empty are different here: "description": "" clears the
      // field, while omitting it leaves the field alone.
      const description = "description" in args ? str(args, "description") ?? "" : undefined;
      const deadline = "deadline" in args ? str(args, "deadline") ?? "" : undefined;

      if (
        title === undefined &&
        description === undefined &&
        deadline === undefined &&
        assigneeNames === undefined &&
        parentTaskId === undefined
      ) {
        throw new ToolError(
          "Nothing to change. Pass at least one of title, description, deadline, assignees or " +
            "parentTaskId."
        );
      }

      await connectDB();
      const existing = await requireTask(taskId);

      // Resolve and validate everything before writing, so a refusal cannot
      // leave the task half-updated.
      if (parentTaskId) {
        const refusal = await checkReparent(existing, parentTaskId);
        if (refusal) throw new ToolError(refusal);
      }
      const assignees = assigneeNames ? await resolveAssignees(assigneeNames) : undefined;

      const updated = await updateTask(session, taskId, {
        title,
        description,
        completionDate: deadline,
        assignees,
        parentTaskId: parentTaskId === null ? "" : parentTaskId,
      });
      if (!updated.ok) {
        throw new ToolError(
          updated.status === 403
            ? `Not allowed to edit "${existing.title}". Editing a task you did not create needs ` +
                `the "tasks.editAny" permission.`
            : updated.error
        );
      }

      return { updated: true, task: updated.task };
    },
  },

  {
    name: "set_task_completion",
    description:
      "Tick a task off, or reopen a completed one. Completing a top-level task also completes " +
      "its open subtasks, as ticking it off in the hub does; reopening leaves subtasks closed. " +
      "Completing a task that came from a logbook follow-up marks that entry as followed up.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task id from list_tasks." },
        completed: {
          type: "boolean",
          description: "True to complete the task, false to reopen it.",
        },
      },
      required: ["taskId", "completed"],
      additionalProperties: false,
    },
    handler: async (session, args) => {
      const taskId = requiredStr(args, "taskId");
      const completed = bool(args, "completed");
      if (completed === undefined) throw new ToolError('"completed" is required.');

      await connectDB();
      const existing = await requireTask(taskId);

      const refuse = (title: string) =>
        new ToolError(
          `Not allowed to change "${title}". Completing a task you did not create needs the ` +
            `"tasks.editAny" permission — except for a logbook follow-up, which anyone may tick off.`
        );

      // Completing a top-level task closes its open subtasks too, mirroring
      // what the hub's own checkbox does client-side. Without it a parent could
      // be ticked off while its children stayed open, and the project would
      // never reach "completed".
      const subtasks =
        completed && !existing.parentTaskId
          ? ((await TaskModel.find({ parentTaskId: taskId, completedAt: null })
              .lean()) as LeanTask[])
          : [];

      // Every task involved is checked before any of them is written, so a
      // refusal on the parent cannot leave its subtasks already closed.
      for (const task of [existing, ...subtasks]) {
        if (!canEditTask(session, task, { completed })) throw refuse(task.title);
      }

      // Subtasks first, so the single project-status recalculation triggered by
      // the parent sees the finished state instead of firing once per child
      // against a stale one.
      const closedSubtasks: string[] = [];
      for (const subtask of subtasks) {
        const done = await updateTask(session, subtask._id.toString(), { completed: true });
        if (!done.ok) throw new ToolError(done.error);
        closedSubtasks.push(subtask.title);
      }

      const updated = await updateTask(session, taskId, { completed });
      if (!updated.ok) {
        throw updated.status === 403 ? refuse(existing.title) : new ToolError(updated.error);
      }

      return {
        task: updated.task,
        completed,
        closedSubtasks,
      };
    },
  },
];

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name);
}
