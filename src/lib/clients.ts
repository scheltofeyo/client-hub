/**
 * Shared client writes, used by the /api/clients routes and the MCP tools so
 * the two surfaces can never drift on what creating or updating a client
 * actually does — the Google Drive folder it asks GAS to build, the permission
 * it demands, and the activity events it records.
 *
 * The reference-data and duplicate checks live here too, next to the write they
 * guard, but they are deliberately *not* wired into the create route: the Add
 * client form only ever offers configured options and shows the existing
 * clients in a list behind it, so there is nothing for them to catch there, and
 * leaving POST untouched keeps its behaviour exactly as it was. `updateClient`
 * is the opposite case — PATCH always went through this logic, so the whole
 * handler moved here and the route now calls it.
 */
import { randomUUID } from "node:crypto";
import type { Session } from "next-auth";
import { connectDB } from "./mongodb";
import { ClientModel, type IClient, type IContact } from "./models/Client";
import { ClientStatusOptionModel } from "./models/ClientStatusOption";
import { ClientPlatformOptionModel } from "./models/ClientPlatformOption";
import { getArchetypes, getClientStatuses, getClientPlatforms } from "./data";
import { recordActivity } from "./activity";
import { hasPermission, hasPermissionOrIsLead } from "./auth-helpers";

/** The lean() shape of a doc — same fields, no Document methods. */
type Lean<T> = Omit<T, keyof import("mongoose").Document> & {
  _id: import("mongoose").Types.ObjectId;
};

export type LeanClient = Lean<IClient>;

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The body POST /api/clients answers with — kept here beside the write. */
export function serializeCreatedClient(doc: LeanClient) {
  return {
    id: doc._id.toString(),
    company: doc.company,
    status: doc.status,
    platform: doc.platform,
    clientSince: doc.clientSince,
    employees: doc.employees,
    website: doc.website,
    description: doc.description,
    primaryColor: doc.primaryColor ?? undefined,
    contacts: doc.contacts ?? [],
    leads: [],
    addressStreet: doc.addressStreet ?? null,
    addressPostalCode: doc.addressPostalCode ?? null,
    addressCity: doc.addressCity ?? null,
    addressCountry: doc.addressCountry ?? null,
    folderStatus: doc.folderStatus,
  };
}

// ── Reference data ───────────────────────────────────────────────────

type RefOption = { slug: string; label: string };

/**
 * undefined — nothing to resolve; null — no such option; string — the slug to
 * store. Slug *or* label matches, case-insensitively, the way requireBoard()
 * takes a board id or its name: a caller working from a sentence has the label,
 * a caller working from find_clients has the slug, and both are unambiguous.
 */
function matchOption(value: string | undefined, options: RefOption[]): string | null | undefined {
  if (!value) return undefined;
  const needle = value.trim().toLowerCase();
  const hit = options.find(
    (o) => o.slug.toLowerCase() === needle || o.label.toLowerCase() === needle
  );
  return hit ? hit.slug : null;
}

function unknownOption(singular: string, plural: string, value: string, options: RefOption[]) {
  const available = options.map((o) => o.slug).join(", ") || "none configured";
  return `Unknown client ${singular} "${value}". Configured ${plural}: ${available}.`;
}

export type ResolveReferenceResult =
  | { ok: true; status?: string; platform?: string }
  | { ok: false; error: string };

/**
 * Turn whatever a caller said into the slugs `Client` stores, or refuse.
 *
 * Status and platform are admin-configurable reference data, not free text —
 * an unrecognised value written straight through would produce a client that
 * filters and badges as nothing at all.
 */
export async function resolveClientReferenceData(input: {
  status?: string;
  platform?: string;
}): Promise<ResolveReferenceResult> {
  if (!input.status && !input.platform) return { ok: true };

  const [statuses, platforms] = await Promise.all([getClientStatuses(), getClientPlatforms()]);

  const status = matchOption(input.status, statuses);
  if (status === null) {
    return { ok: false, error: unknownOption("status", "statuses", input.status!, statuses) };
  }

  const platform = matchOption(input.platform, platforms);
  if (platform === null) {
    return { ok: false, error: unknownOption("platform", "platforms", input.platform!, platforms) };
  }

  return { ok: true, status, platform };
}

export type ResolveArchetypeResult =
  | { ok: true; archetypeId: string }
  | { ok: false; error: string };

/**
 * Turn an archetype name into the id `Client.archetypeId` stores, or refuse.
 *
 * Separate from resolveClientReferenceData() because Archetype is shaped
 * differently from the status and platform options: it carries no slug, only a
 * unique name, so the id is the only thing worth storing and the name is the
 * only thing a caller can reasonably have said.
 */
export async function resolveArchetype(value: string): Promise<ResolveArchetypeResult> {
  const needle = value.trim().toLowerCase();
  const archetypes = await getArchetypes();
  const hit = archetypes.find((a) => a.name.toLowerCase() === needle || a.id === value.trim());
  if (hit) return { ok: true, archetypeId: hit.id };

  const available = archetypes.map((a) => a.name).join(", ") || "none configured";
  return {
    ok: false,
    error: `Unknown archetype "${value}". Configured archetypes: ${available}.`,
  };
}

// ── Duplicates ───────────────────────────────────────────────────────

/**
 * Names are compared with case, accents and punctuation removed, so "Acme
 * B.V." matches "Acme BV". Legal suffixes and extra words are deliberately
 * left in: "Acme Group" and "Acme" are plausibly different companies, and a
 * wrong refusal costs more than a duplicate the caller was warned about.
 */
function duplicateKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Existing clients whose name is effectively the one passed in.
 *
 * `company` carries no unique index, and nothing in the UI stops a second
 * "Acme" either — a person just happens to see the first one in the list
 * behind the form. A caller that cannot see that list has to be told instead.
 *
 * One projection over the whole collection rather than a query: the comparison
 * is on a normalised key no index could serve, and the collection is small
 * enough that the scan is cheaper than getting clever.
 */
export async function findDuplicateClients(
  company: string
): Promise<{ id: string; company: string }[]> {
  const needle = duplicateKey(company);
  if (!needle) return [];

  await connectDB();
  const docs = await ClientModel.find({}, { company: 1 }).lean();
  return docs
    .filter((doc) => duplicateKey(doc.company) === needle)
    .map((doc) => ({ id: doc._id.toString(), company: doc.company }));
}

// ── Create ───────────────────────────────────────────────────────────

export type CreateClientInput = {
  company?: unknown;
  status?: unknown;
  platform?: unknown;
  clientSince?: unknown;
  employees?: unknown;
  website?: unknown;
  description?: unknown;
  primaryColor?: unknown;
  contacts?: unknown;
  addressStreet?: unknown;
  addressPostalCode?: unknown;
  addressCity?: unknown;
  addressCountry?: unknown;
  createFolder?: unknown;
};

/**
 * Validation failures come back as a value rather than a thrown error or a
 * NextResponse: the REST route turns `error` into a 400 and the MCP tool turns
 * it into a readable refusal, and neither has to know how the other reports.
 */
export type CreateClientResult = { ok: true; client: LeanClient } | { ok: false; error: string };

type NormalizedContacts = { ok: true; contacts: IContact[] } | { ok: false; error: string };

/**
 * The UI mints contact ids client-side with crypto.randomUUID(); anything
 * written server-side has to do the same, or the contact is unreachable —
 * create_log_entry attributes an entry by contact id.
 */
function normalizeContacts(value: unknown): NormalizedContacts {
  if (value === undefined || value === null) return { ok: true, contacts: [] };
  if (!Array.isArray(value)) return { ok: false, error: "Contacts must be a list" };

  const contacts: IContact[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Each contact must be an object" };
    }
    const raw = entry as Record<string, unknown>;
    const firstName = trimmed(raw.firstName);
    if (!firstName) return { ok: false, error: "Each contact needs a first name" };

    contacts.push({
      id: trimmed(raw.id) || randomUUID(),
      firstName,
      lastName: trimmed(raw.lastName),
      role: trimmed(raw.role) || undefined,
      email: trimmed(raw.email) || undefined,
      phone: trimmed(raw.phone) || undefined,
    });
  }
  return { ok: true, contacts };
}

/**
 * How long we are willing to hold the request open waiting for GAS to answer.
 *
 * The whole create runs inside one Netlify Function, and a synchronous Netlify
 * Function is killed at its configured timeout — the caller then gets a bare
 * 502 Bad Gateway from the platform, not our JSON. GAS answers doPost only
 * once the script has finished building the folder tree, which on a cold
 * script takes tens of seconds, so an unbounded wait here turns every slow
 * Drive call into a 502 on an endpoint that had already done its real work.
 *
 * Bounding it does not weaken the contract: the response is thrown away either
 * way, "ready" comes from the callback, and a client we stop waiting on is
 * left exactly where a failed webhook leaves it — "pending", with the banner
 * still polling.
 */
const GAS_WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Ask GAS to build the client's Drive folder and sheet structure.
 *
 * Fire-and-forget by design: the script answers on its own schedule and calls
 * /api/internal/folder-callback when it is done, which is what flips
 * folderStatus to "ready". A failure here leaves the client on "pending" — the
 * banner keeps polling — rather than failing the create.
 */
async function requestDriveFolder(clientId: string, companyName: string): Promise<void> {
  const webhookUrl = process.env.GAS_FOLDER_WEBHOOK_URL;
  const secret = process.env.GAS_FOLDER_WEBHOOK_SECRET;
  const appUrl = process.env.APP_URL;

  if (!webhookUrl || !secret || !appUrl) {
    console.warn(
      "[folder-webhook] Missing env vars: GAS_FOLDER_WEBHOOK_URL, GAS_FOLDER_WEBHOOK_SECRET, or APP_URL"
    );
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        clientId,
        appCallbackUrl: `${appUrl}/api/internal/folder-callback`,
        secret,
      }),
      signal: AbortSignal.timeout(GAS_WEBHOOK_TIMEOUT_MS),
    });
  } catch (err) {
    // A timeout is the expected shape of "GAS is being slow", not a fault:
    // the request reached Apps Script, the script keeps running, and the
    // callback still flips folderStatus when it lands. Logged apart from a
    // real failure so a genuinely broken webhook stays visible.
    if (err instanceof Error && err.name === "TimeoutError") {
      console.warn(
        `[folder-webhook] GAS did not answer within ${GAS_WEBHOOK_TIMEOUT_MS}ms for client ` +
          `${clientId}; leaving folderStatus "pending" for the callback.`
      );
      return;
    }
    console.error("[folder-webhook] Failed to call GAS webhook:", err);
  }
}

/**
 * Create a client, and — when asked — the Drive folder structure that goes
 * with it.
 *
 * Everything that can refuse does so before the document is written, so a
 * refusal never leaves a half-made client behind.
 */
export async function createClient(
  session: Session,
  input: CreateClientInput
): Promise<CreateClientResult> {
  const company = trimmed(input.company);
  if (!company) return { ok: false, error: "Company name is required" };

  const employees = input.employees ? Number(input.employees) : undefined;
  if (employees !== undefined && !Number.isFinite(employees)) {
    return { ok: false, error: "Employees must be a number" };
  }

  const contacts = normalizeContacts(input.contacts);
  if (!contacts.ok) return { ok: false, error: contacts.error };

  const createFolder = !!input.createFolder;

  await connectDB();
  const doc = await ClientModel.create({
    company,
    status: trimmed(input.status) || undefined,
    platform: trimmed(input.platform) || undefined,
    clientSince: trimmed(input.clientSince) || undefined,
    employees,
    website: trimmed(input.website) || undefined,
    description: trimmed(input.description) || undefined,
    primaryColor: trimmed(input.primaryColor) || undefined,
    contacts: contacts.contacts,
    leads: [],
    addressStreet: trimmed(input.addressStreet) || undefined,
    addressPostalCode: trimmed(input.addressPostalCode) || undefined,
    addressCity: trimmed(input.addressCity) || undefined,
    addressCountry: trimmed(input.addressCountry) || undefined,
    folderStatus: createFolder ? "pending" : undefined,
  });

  if (createFolder) await requestDriveFolder(doc._id.toString(), doc.company);

  // `Client` keeps no creator fields, so the activity event is the whole
  // attribution story — recordActivity stamps the token it came in on itself.
  await recordActivity({
    clientId: doc._id.toString(),
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    type: "client.created",
    metadata: { company: doc.company },
  });

  return { ok: true, client: doc.toObject() as LeanClient };
}

// ── Update ───────────────────────────────────────────────────────────

export type UpdateClientInput = {
  company?: unknown;
  status?: unknown;
  platform?: unknown;
  clientSince?: unknown;
  employees?: unknown;
  website?: unknown;
  description?: unknown;
  primaryColor?: unknown;
  contacts?: unknown;
  leads?: unknown;
  archetypeId?: unknown;
  culturalDna?: unknown;
  culturalLevels?: unknown;
  addressStreet?: unknown;
  addressPostalCode?: unknown;
  addressCity?: unknown;
  addressCountry?: unknown;
};

/** Everything updateClient() knows how to set, in the order `changed` reports. */
const UPDATABLE_FIELDS: readonly (keyof UpdateClientInput)[] = [
  "company",
  "status",
  "platform",
  "archetypeId",
  "clientSince",
  "employees",
  "website",
  "description",
  "primaryColor",
  "contacts",
  "leads",
  "culturalDna",
  "culturalLevels",
  "addressStreet",
  "addressPostalCode",
  "addressCity",
  "addressCountry",
];

/**
 * `changed` lists the fields the caller actually passed. The REST route drops
 * it — the editor already knows what it sent — but a model does not, and a tool
 * that can answer "updated status and website" is what lets it confirm back
 * without reading the client again.
 */
export type UpdateClientResult =
  | { ok: true; client: LeanClient; changed: string[] }
  | { ok: false; error: string; status: 400 | 403 | 404 };

/**
 * Update a client, emitting the same granular activity the hub has always
 * emitted: contacts, status, platform and leads each get their own event, and
 * everything else collapses into one `client.updated`.
 *
 * Absent keys are left alone — this is a partial update on both surfaces. A
 * caller that wants to clear a field passes an empty string, which is what the
 * editor sends too.
 */
export async function updateClient(
  session: Session,
  clientId: string,
  input: UpdateClientInput
): Promise<UpdateClientResult> {
  await connectDB();

  const existing = await ClientModel.findById(clientId).lean();
  if (!existing) return { ok: false, error: "Not found", status: 404 };

  // A lead may edit their own client — LeadSettings decides whether
  // clients.edit is one of the permissions being a lead confers.
  if (!hasPermissionOrIsLead(session, "clients.edit", existing.leads ?? [])) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  const {
    company,
    status,
    platform,
    clientSince,
    employees,
    website,
    description,
    primaryColor,
    contacts,
    leads,
    archetypeId,
    culturalDna,
    culturalLevels,
    addressStreet,
    addressPostalCode,
    addressCity,
    addressCountry,
  } = input;

  if (company !== undefined && !trimmed(company)) {
    return { ok: false, error: "Company name cannot be empty", status: 400 };
  }

  // Reassigning leads is its own permission, and not one a lead inherits —
  // otherwise a lead could quietly write themselves off the client.
  if (leads !== undefined && !hasPermission(session, "clients.assignLeads")) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  const update: Record<string, unknown> = {};
  if (company !== undefined) update.company = trimmed(company);
  if (status !== undefined) update.status = trimmed(status) || null;
  if (platform !== undefined) update.platform = trimmed(platform) || null;
  if (clientSince !== undefined) update.clientSince = trimmed(clientSince) || null;
  if (employees !== undefined) update.employees = employees ? Number(employees) : null;
  if (website !== undefined) update.website = trimmed(website) || null;
  if (description !== undefined) update.description = trimmed(description) || null;
  if (primaryColor !== undefined) update.primaryColor = trimmed(primaryColor) || null;
  if (contacts !== undefined) update.contacts = contacts;
  if (leads !== undefined) update.leads = leads;
  if (archetypeId !== undefined) update.archetypeId = trimmed(archetypeId) || null;
  if (culturalDna !== undefined) update.culturalDna = culturalDna;
  if (culturalLevels !== undefined) update.culturalLevels = culturalLevels;
  if (addressStreet !== undefined) update.addressStreet = trimmed(addressStreet) || null;
  if (addressPostalCode !== undefined) update.addressPostalCode = trimmed(addressPostalCode) || null;
  if (addressCity !== undefined) update.addressCity = trimmed(addressCity) || null;
  if (addressCountry !== undefined) update.addressCountry = trimmed(addressCountry) || null;

  const doc = await ClientModel.findByIdAndUpdate(clientId, { $set: update }, { new: true }).lean();
  if (!doc) return { ok: false, error: "Not found", status: 404 };

  const actorId = session.user.id;
  const actorName = session.user.name ?? "Unknown";

  // Contacts — added and removed are named; an edit in place is deliberately
  // not reported, matching what the hub has always recorded.
  if (contacts !== undefined) {
    type ContactInput = { id?: string; firstName?: string; lastName?: string };
    const list = (contacts as ContactInput[]) ?? [];
    const oldIds = new Set((existing.contacts ?? []).map((c) => c.id));
    const newIds = new Set(list.map((c) => c.id ?? ""));
    const added = list.filter((c) => c.id && !oldIds.has(c.id));
    const removed = (existing.contacts ?? []).filter((c) => !newIds.has(c.id));
    if (added.length > 0 || removed.length > 0) {
      await recordActivity({
        clientId,
        actorId,
        actorName,
        type: "contact.changed",
        metadata: {
          added: added.map((c) => [c.firstName, c.lastName].filter(Boolean).join(" ")),
          removed: removed.map((c) => [c.firstName, c.lastName].filter(Boolean).join(" ")),
        },
      });
    }
  }

  if (status !== undefined) {
    const newVal = (update.status as string | null) ?? null;
    const oldVal = existing.status ?? null;
    if (oldVal !== newVal) {
      const [fromOpt, toOpt] = await Promise.all([
        oldVal ? ClientStatusOptionModel.findOne({ slug: oldVal }).lean() : null,
        newVal ? ClientStatusOptionModel.findOne({ slug: newVal }).lean() : null,
      ]);
      await recordActivity({
        clientId,
        actorId,
        actorName,
        type: "client.status_changed",
        metadata: {
          from: oldVal,
          to: newVal,
          fromLabel: fromOpt?.label ?? oldVal,
          toLabel: toOpt?.label ?? newVal,
        },
      });
    }
  }

  if (platform !== undefined) {
    const newVal = (update.platform as string | null) ?? null;
    const oldVal = existing.platform ?? null;
    if (oldVal !== newVal) {
      const [fromOpt, toOpt] = await Promise.all([
        oldVal ? ClientPlatformOptionModel.findOne({ slug: oldVal }).lean() : null,
        newVal ? ClientPlatformOptionModel.findOne({ slug: newVal }).lean() : null,
      ]);
      await recordActivity({
        clientId,
        actorId,
        actorName,
        type: "client.platform_changed",
        metadata: {
          from: oldVal,
          to: newVal,
          fromLabel: fromOpt?.label ?? oldVal,
          toLabel: toOpt?.label ?? newVal,
        },
      });
    }
  }

  if (leads !== undefined) {
    type LeadInput = { userId: string; name?: string };
    const list = (leads as LeadInput[]) ?? [];
    const oldIds = new Set((existing.leads ?? []).map((l) => l.userId));
    const newIds = new Set(list.map((l) => l.userId));
    const added = list.filter((l) => !oldIds.has(l.userId)).map((l) => l.name ?? "Unknown");
    const removed = (existing.leads ?? []).filter((l) => !newIds.has(l.userId)).map((l) => l.name);
    if (added.length > 0 || removed.length > 0) {
      await recordActivity({
        clientId,
        actorId,
        actorName,
        type: "client.leads_changed",
        metadata: { added, removed },
      });
    }
  }

  const companyFields = [
    "company",
    "clientSince",
    "employees",
    "website",
    "description",
    "primaryColor",
    "archetypeId",
  ] as const;
  const changedCompanyFields = companyFields.filter((f) => input[f] !== undefined);
  if (changedCompanyFields.length > 0) {
    await recordActivity({
      clientId,
      actorId,
      actorName,
      type: "client.updated",
      metadata: { fields: changedCompanyFields },
    });
  }

  return {
    ok: true,
    client: doc as LeanClient,
    changed: UPDATABLE_FIELDS.filter((f) => input[f] !== undefined),
  };
}

// ── Contacts ─────────────────────────────────────────────────────────

/**
 * Contact writes are their own helpers rather than a `contacts` array on
 * updateClient().
 *
 * The hub sends the whole array on every change — it holds the current list in
 * React state, so that is free and safe. A model does not: asking it to resend
 * every contact to add one makes dropping a colleague a plausible outcome of a
 * single forgotten line. These read the stored array, change exactly one entry
 * and hand the result to updateClient(), so the permission check and the
 * `contact.changed` event still live in one place.
 */
export type ContactWriteResult =
  | { ok: true; client: LeanClient; contact: IContact }
  | { ok: false; error: string; status: 400 | 403 | 404 };

function contactLabel(contact: IContact): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

/** Names the client's contacts so a wrong id can be corrected without a re-read. */
function describeContacts(contacts: IContact[]): string {
  if (!contacts.length) return "This client has no contacts yet.";
  const named = contacts.map((c) => `"${contactLabel(c)}" (id ${c.id})`).join(", ");
  return `Contacts on this client: ${named}.`;
}

export type ContactFields = {
  firstName?: unknown;
  lastName?: unknown;
  role?: unknown;
  email?: unknown;
  phone?: unknown;
};

export async function addClientContact(
  session: Session,
  clientId: string,
  input: ContactFields
): Promise<ContactWriteResult> {
  await connectDB();
  const existing = await ClientModel.findById(clientId).select("contacts").lean();
  if (!existing) return { ok: false, error: "Not found", status: 404 };

  // normalizeContacts mints the id, exactly as the create path does, so the
  // contact is usable as a create_log_entry contactId straight away.
  const normalized = normalizeContacts([input]);
  if (!normalized.ok) return { ok: false, error: normalized.error, status: 400 };
  const contact = normalized.contacts[0];

  const result = await updateClient(session, clientId, {
    contacts: [...(existing.contacts ?? []), contact],
  });
  if (!result.ok) return result;
  return { ok: true, client: result.client, contact };
}

export async function updateClientContact(
  session: Session,
  clientId: string,
  contactId: string,
  input: ContactFields
): Promise<ContactWriteResult> {
  await connectDB();
  const existing = await ClientModel.findById(clientId).select("contacts").lean();
  if (!existing) return { ok: false, error: "Not found", status: 404 };

  const contacts = existing.contacts ?? [];
  const current = contacts.find((c) => c.id === contactId);
  if (!current) {
    return {
      ok: false,
      error: `No contact with id ${contactId} on this client. ${describeContacts(contacts)}`,
      status: 404,
    };
  }

  if (input.firstName !== undefined && !trimmed(input.firstName)) {
    return { ok: false, error: "A contact needs a first name", status: 400 };
  }

  // Absent keys keep their stored value; an empty string clears an optional one.
  const merged: IContact = {
    id: current.id,
    firstName: input.firstName !== undefined ? trimmed(input.firstName) : current.firstName,
    lastName: input.lastName !== undefined ? trimmed(input.lastName) : current.lastName,
    role: input.role !== undefined ? trimmed(input.role) || undefined : current.role,
    email: input.email !== undefined ? trimmed(input.email) || undefined : current.email,
    phone: input.phone !== undefined ? trimmed(input.phone) || undefined : current.phone,
  };

  const result = await updateClient(session, clientId, {
    contacts: contacts.map((c) => (c.id === contactId ? merged : c)),
  });
  if (!result.ok) return result;
  return { ok: true, client: result.client, contact: merged };
}

export async function removeClientContact(
  session: Session,
  clientId: string,
  contactId: string
): Promise<ContactWriteResult> {
  await connectDB();
  const existing = await ClientModel.findById(clientId).select("contacts").lean();
  if (!existing) return { ok: false, error: "Not found", status: 404 };

  const contacts = existing.contacts ?? [];
  const current = contacts.find((c) => c.id === contactId);
  if (!current) {
    return {
      ok: false,
      error: `No contact with id ${contactId} on this client. ${describeContacts(contacts)}`,
      status: 404,
    };
  }

  const result = await updateClient(session, clientId, {
    contacts: contacts.filter((c) => c.id !== contactId),
  });
  if (!result.ok) return result;
  return { ok: true, client: result.client, contact: current };
}
