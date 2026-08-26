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
import { SalesBoardModel } from "@/lib/models/SalesBoard";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { moveSalesCard } from "@/lib/sales";
import { createLogEntry, serializeLog } from "@/lib/logs";

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
];

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name);
}
