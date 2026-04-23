import mongoose from "mongoose";
import { cache } from "react";
import { connectDB } from "./mongodb";
import { ClientModel } from "./models/Client";
import { UserModel } from "./models/User";
import { ProjectModel } from "./models/Project";
import { ProjectTemplateModel } from "./models/ProjectTemplate";
import { ArchetypeModel } from "./models/Archetype";
import { ServiceModel } from "./models/Service";
import { LogSignalModel } from "./models/LogSignal";
import { LogModel } from "./models/Log";
import { SheetModel } from "./models/Sheet";
import { TaskModel } from "./models/Task";
import { TemplateTaskModel } from "./models/TemplateTask";
import { ActivityEventModel } from "./models/ActivityEvent";
import { EventTypeModel, DEFAULT_EVENT_TYPES } from "./models/EventType";
import { ClientEventModel } from "./models/ClientEvent";
import { ClientStatusOptionModel, DEFAULT_CLIENT_STATUSES } from "./models/ClientStatusOption";
import { ClientPlatformOptionModel, DEFAULT_CLIENT_PLATFORMS } from "./models/ClientPlatformOption";
import { ProjectLabelModel } from "./models/ProjectLabel";
import { RoleModel } from "./models/Role";
import { LeaveTypeModel, DEFAULT_LEAVE_TYPES } from "./models/LeaveType";
import { TimeOffModel } from "./models/TimeOff";
import { CompanyHolidayModel } from "./models/CompanyHoliday";
import type { Archetype, BirthdayItem, Client, ClientLead, ClientPlatformOption, ClientStatusOption, CompanyHoliday, Contact, DashboardStats, EventType, LeaveType, Log, LogSignal, MyDayFollowUpData, MyDayTaskData, MyDayUserInfo, MyProjectOverview, Project, ProjectLabel, ProjectTemplate, RecurrenceUnit, Service, Sheet, Task, TemplateTask, TimelineEvent, TimeOffEntry, TimeOffBalance, WeekTeamData } from "@/types";
import type { WeekCalendarItem } from "@/lib/utils";
import { mapToWeekday } from "@/lib/utils";

function mapClient(doc: ReturnType<typeof Object.assign>, archetypeMap?: Map<string, string>, platformLabelMap?: Map<string, string>): Client {
  return {
    id: doc._id.toString(),
    company: doc.company,
    status: doc.status,
    platform: doc.platform,
    platformLabel: doc.platform && platformLabelMap ? (platformLabelMap.get(doc.platform) ?? undefined) : undefined,
    clientSince: doc.clientSince,
    employees: doc.employees,
    website: doc.website,
    description: doc.description,
    primaryColor: doc.primaryColor ?? undefined,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
    archetypeId: doc.archetypeId ?? undefined,
    archetype: doc.archetypeId && archetypeMap ? archetypeMap.get(doc.archetypeId) : undefined,
    folderStatus: doc.folderStatus ?? undefined,
    contacts: (doc.contacts ?? []).map((c: { id: string; firstName: string; lastName: string; role?: string; email?: string; phone?: string }) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      role: c.role,
      email: c.email,
      phone: c.phone,
    })),
    leads: (doc.leads ?? []).map((l: { userId: string; name: string; email: string }) => ({
      userId: l.userId,
      name: l.name,
      email: l.email,
    })),
    culturalDna: (doc.culturalDna ?? []).map((v: { id: string; title: string; color: string; mantra: string; description: string; behaviors?: { level: string; content: string }[] }) => ({
      id: v.id,
      title: v.title,
      color: v.color,
      mantra: v.mantra,
      description: v.description,
      behaviors: v.behaviors ?? [],
    })),
    culturalLevels: doc.culturalLevels ?? [],
  };
}

// These are cached per request render tree via React.cache(), so multiple callers
// (e.g. layout + page, or getClientById + getArchetypes) share a single DB query.
const fetchArchetypeDocs = cache(async () => {
  await connectDB();
  return ArchetypeModel.find().sort({ rank: 1, createdAt: 1 }).lean();
});

const fetchServiceDocs = cache(async () => {
  await connectDB();
  return ServiceModel.find().sort({ rank: 1, createdAt: 1 }).lean();
});

async function buildArchetypeMap(): Promise<Map<string, string>> {
  const docs = await fetchArchetypeDocs();
  const map = new Map<string, string>();
  for (const d of docs) map.set(d._id.toString(), d.name);
  return map;
}

async function buildServiceMap(): Promise<Map<string, string>> {
  const docs = await fetchServiceDocs();
  const map = new Map<string, string>();
  for (const d of docs) map.set(d._id.toString(), d.name);
  return map;
}

const fetchClientStatusDocs = cache(async () => {
  await connectDB();
  let docs = await ClientStatusOptionModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  if (docs.length === 0) {
    await Promise.all(DEFAULT_CLIENT_STATUSES.map((s, i) => ClientStatusOptionModel.create({ ...s, rank: i })));
    docs = await ClientStatusOptionModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  }
  return docs;
});

const fetchClientPlatformDocs = cache(async () => {
  await connectDB();
  let docs = await ClientPlatformOptionModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  if (docs.length === 0) {
    await Promise.all(DEFAULT_CLIENT_PLATFORMS.map((p, i) => ClientPlatformOptionModel.create({ ...p, rank: i })));
    docs = await ClientPlatformOptionModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  }
  return docs;
});

async function buildPlatformLabelMap(): Promise<Map<string, string>> {
  const docs = await fetchClientPlatformDocs();
  const map = new Map<string, string>();
  for (const d of docs) map.set(d.slug, d.label);
  return map;
}

async function buildUserImageMap(): Promise<Map<string, string>> {
  const users = await UserModel.find({}, { _id: 1, image: 1 }).lean();
  const map = new Map<string, string>();
  for (const u of users) {
    if (u.image) map.set(u._id.toString(), u.image);
  }
  return map;
}

export async function getClients(): Promise<Client[]> {
  await connectDB();
  const [docs, imageMap, archetypeMap, platformLabelMap] = await Promise.all([
    ClientModel.find().sort({ createdAt: -1 }).lean(),
    buildUserImageMap(),
    buildArchetypeMap(),
    buildPlatformLabelMap(),
  ]);
  return docs.map((doc) => {
    const client = mapClient(doc, archetypeMap, platformLabelMap);
    if (client.leads) {
      client.leads = client.leads.map((l) => ({
        ...l,
        image: imageMap.get(l.userId),
      }));
    }
    return client;
  });
}

export const getClientById = cache(async (id: string): Promise<Client | undefined> => {
  await connectDB();
  const [doc, archetypeMap, imageMap, platformLabelMap] = await Promise.all([
    ClientModel.findById(id).lean(),
    buildArchetypeMap(),
    buildUserImageMap(),
    buildPlatformLabelMap(),
  ]);
  if (!doc) return undefined;
  const client = mapClient(doc, archetypeMap, platformLabelMap);
  if (client.leads) {
    client.leads = client.leads.map((l) => ({ ...l, image: imageMap.get(l.userId) }));
  }
  return client;
});

export async function getArchetypes(): Promise<Archetype[]> {
  const docs = await fetchArchetypeDocs();
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    rank: d.rank ?? 0,
    createdAt: d.createdAt?.toISOString().split("T")[0],
  }));
}

export async function getClientStatuses(): Promise<ClientStatusOption[]> {
  const docs = await fetchClientStatusDocs();
  return docs.map((d) => ({
    id: d._id.toString(),
    slug: d.slug,
    label: d.label,
    rank: d.rank ?? 0,
    checkInDays: d.checkInDays ?? null,
    createdAt: d.createdAt?.toISOString().split("T")[0],
  }));
}

export async function getClientPlatforms(): Promise<ClientPlatformOption[]> {
  const docs = await fetchClientPlatformDocs();
  return docs.map((d) => ({
    id: d._id.toString(),
    slug: d.slug,
    label: d.label,
    rank: d.rank ?? 0,
    createdAt: d.createdAt?.toISOString().split("T")[0],
  }));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await connectDB();
  const [totalClients, activeClients, totalProjects, activeProjects] = await Promise.all([
    ClientModel.countDocuments(),
    ClientModel.countDocuments({ status: "active" }),
    ProjectModel.countDocuments(),
    ProjectModel.countDocuments({ status: "in_progress" }),
  ]);
  return { totalClients, activeClients, totalProjects, activeProjects };
}

function mapProject(doc: ReturnType<typeof Object.assign>, serviceMap?: Map<string, string>, labelMap?: Map<string, string>): Project {
  // Lazy migration: treat existing projects that already have a deliveryDate or non-not_started
  // status as already kicked off (they pre-date the kickedOffAt field).
  const kickedOffAt: string | undefined =
    doc.kickedOffAt ??
    (doc.deliveryDate || doc.status !== "not_started"
      ? (doc.createdAt?.toISOString().split("T")[0] ?? undefined)
      : undefined);

  return {
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    completedDate: doc.completedDate,
    deliveryDate: doc.deliveryDate ?? undefined,
    soldPrice: doc.soldPrice,
    templateId: doc.templateId,
    serviceId: doc.serviceId ?? undefined,
    service: doc.serviceId && serviceMap ? serviceMap.get(doc.serviceId) : undefined,
    labelId: doc.labelId ?? undefined,
    label: doc.labelId && labelMap ? labelMap.get(doc.labelId) : undefined,
    kickedOffAt,
    scheduledStartDate: doc.scheduledStartDate ?? undefined,
    scheduledEndDate: doc.scheduledEndDate ?? undefined,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  };
}

export async function getProjectsByClientId(clientId: string): Promise<Project[]> {
  await connectDB();
  const [docs, serviceDocs, labelMap] = await Promise.all([
    ProjectModel.find({ clientId }).sort({ createdAt: -1 }).lean(),
    fetchServiceDocs(),
    buildProjectLabelMap(),
  ]);
  const serviceMap = new Map<string, string>();
  const serviceRankMap = new Map<string, number>();
  serviceDocs.forEach((d, i) => {
    const sid = d._id.toString();
    serviceMap.set(sid, d.name);
    serviceRankMap.set(sid, d.rank ?? i);
  });
  const projects = docs.map((doc) => mapProject(doc, serviceMap, labelMap));
  projects.sort((a, b) => {
    const ra = a.serviceId ? (serviceRankMap.get(a.serviceId) ?? Infinity) : Infinity;
    const rb = b.serviceId ? (serviceRankMap.get(b.serviceId) ?? Infinity) : Infinity;
    return ra - rb;
  });
  return projects;
}

export const getProjectById = cache(async (projectId: string): Promise<Project | null> => {
  await connectDB();
  const [doc, serviceMap, labelMap] = await Promise.all([
    ProjectModel.findById(projectId).lean(),
    buildServiceMap(),
    buildProjectLabelMap(),
  ]);
  if (!doc) return null;
  return mapProject(doc, serviceMap, labelMap);
});

export async function getServices(): Promise<Service[]> {
  const docs = await fetchServiceDocs();
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    rank: d.rank ?? 0,
    checkInDays: d.checkInDays ?? null,
    createdAt: d.createdAt?.toISOString().split("T")[0],
  }));
}

const fetchProjectLabelDocs = cache(async () => {
  await connectDB();
  const DEFAULT_LABELS = ["New Business", "Platform", "Next Business"];
  let docs = await ProjectLabelModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  if (docs.length === 0) {
    await Promise.all(DEFAULT_LABELS.map((name, i) => ProjectLabelModel.create({ name, rank: i })));
    docs = await ProjectLabelModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  }
  return docs;
});

export async function getProjectLabels(): Promise<ProjectLabel[]> {
  const docs = await fetchProjectLabelDocs();
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    rank: d.rank ?? 0,
    createdAt: d.createdAt?.toISOString().split("T")[0],
  }));
}

async function buildProjectLabelMap(): Promise<Map<string, string>> {
  const docs = await fetchProjectLabelDocs();
  const map = new Map<string, string>();
  for (const d of docs) map.set(d._id.toString(), d.name);
  return map;
}

const fetchLogSignalDocs = cache(async () => {
  await connectDB();
  return LogSignalModel.find().sort({ rank: 1, createdAt: 1 }).lean();
});

export async function getLogSignals(): Promise<LogSignal[]> {
  const docs = await fetchLogSignalDocs();
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    rank: d.rank ?? 0,
    createdAt: d.createdAt?.toISOString().split("T")[0],
  }));
}

async function buildLogSignalMap(): Promise<Map<string, string>> {
  const docs = await fetchLogSignalDocs();
  const map = new Map<string, string>();
  for (const d of docs) map.set(d._id.toString(), d.name);
  return map;
}

export async function getLogsByClientId(clientId: string): Promise<Log[]> {
  await connectDB();
  const [docs, signalMap] = await Promise.all([
    LogModel.find({ clientId }).sort({ date: -1, createdAt: -1 }).lean(),
    buildLogSignalMap(),
  ]);
  return docs.map((doc) => ({
    id: doc._id.toString(),
    clientId: doc.clientId,
    contactIds: doc.contactIds?.length ? doc.contactIds : (doc.contactId ? [doc.contactId] : []),
    date: doc.date,
    summary: doc.summary,
    signalIds: doc.signalIds ?? [],
    serviceId: doc.serviceId ?? undefined,
    signals: (doc.signalIds ?? []).map((sid: string) => signalMap.get(sid) ?? sid),
    followUp: doc.followUp ?? false,
    followUpAction: doc.followUpAction ?? undefined,
    followUpDeadline: doc.followUpDeadline ?? undefined,
    followedUpAt: doc.followedUpAt ?? undefined,
    followedUpByName: doc.followedUpByName ?? undefined,
    isSystemGenerated: doc.isSystemGenerated ?? false,
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }));
}

export async function getSheetsByClientId(clientId: string): Promise<Sheet[]> {
  await connectDB();
  const docs = await SheetModel.find({ clientId }).sort({ createdAt: 1 }).lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    clientId: doc.clientId,
    name: doc.name,
    url: doc.url,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }));
}

export const getSheetById = cache(async (sheetId: string): Promise<Sheet | null> => {
  await connectDB();
  const doc = await SheetModel.findById(sheetId).lean();
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    clientId: doc.clientId,
    name: doc.name,
    url: doc.url,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  };
});

function mapTask(doc: ReturnType<typeof Object.assign>): Task {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId ?? undefined,
    projectId: doc.projectId ?? undefined,
    parentTaskId: doc.parentTaskId ?? undefined,
    logId: doc.logId ?? undefined,
    title: doc.title,
    description: doc.description ?? undefined,
    assignees: (doc.assignees ?? []).map((a: { userId: string; name: string; image?: string }) => ({
      userId: a.userId,
      name: a.name,
      image: a.image ?? undefined,
    })),
    completionDate: doc.completionDate ?? undefined,
    completedAt: doc.completedAt ?? undefined,
    completedById: doc.completedById ?? undefined,
    completedByName: doc.completedByName ?? undefined,
    createdById: doc.createdById,
    createdByName: doc.createdByName,
    createdAt: doc.createdAt?.toISOString(),
  };
}

export async function getTasksByProjectId(projectId: string): Promise<Task[]> {
  await connectDB();
  const docs = await TaskModel.find({ projectId }).sort({ createdAt: 1 }).lean();
  return docs.map(mapTask);
}

export async function getTaskStatsByProjectIds(
  projectIds: string[]
): Promise<Map<string, { total: number; completed: number }>> {
  await connectDB();
  const docs = await TaskModel.find(
    { projectId: { $in: projectIds } },
    { projectId: 1, completedAt: 1 }
  ).lean();
  const map = new Map<string, { total: number; completed: number }>();
  for (const doc of docs) {
    const pid = doc.projectId as string | undefined;
    if (!pid) continue;
    const entry = map.get(pid) ?? { total: 0, completed: 0 };
    entry.total++;
    if (doc.completedAt) entry.completed++;
    map.set(pid, entry);
  }
  return map;
}

export async function getClientProjectsWithTaskStats(
  projectIds: string[],
  currentUserId: string
): Promise<{
  perProject: Map<string, { total: number; completed: number }>;
  overduePerProject: Map<string, number>;
  myOpenTasks: number;
  overdueCount: number;
}> {
  if (projectIds.length === 0) return { perProject: new Map(), overduePerProject: new Map(), myOpenTasks: 0, overdueCount: 0 };
  await connectDB();
  const today = new Date().toISOString().slice(0, 10);
  const docs = await TaskModel.find(
    { projectId: { $in: projectIds } },
    { projectId: 1, completedAt: 1, completionDate: 1, assignees: 1 }
  ).lean();

  const perProject = new Map<string, { total: number; completed: number }>();
  const overduePerProject = new Map<string, number>();
  let myOpenTasks = 0;
  let overdueCount = 0;

  for (const doc of docs) {
    const pid = doc.projectId as string;
    const isOpen = !doc.completedAt;
    const entry = perProject.get(pid) ?? { total: 0, completed: 0 };
    entry.total++;
    if (!isOpen) entry.completed++;
    perProject.set(pid, entry);
    if (isOpen) {
      const assignees = (doc.assignees ?? []) as { userId: string }[];
      if (assignees.some((a) => a.userId === currentUserId)) myOpenTasks++;
      const cd = doc.completionDate as string | undefined;
      if (cd && cd < today) {
        overdueCount++;
        overduePerProject.set(pid, (overduePerProject.get(pid) ?? 0) + 1);
      }
    }
  }
  return { perProject, overduePerProject, myOpenTasks, overdueCount };
}

export async function getProjectTemplates(): Promise<ProjectTemplate[]> {
  await connectDB();
  const docs = await ProjectTemplateModel.find().sort({ createdAt: -1 }).lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    defaultDescription: doc.defaultDescription,
    defaultSoldPrice: doc.defaultSoldPrice,
    defaultServiceId: doc.defaultServiceId,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }));
}

export const getProjectTemplateById = cache(async (id: string): Promise<ProjectTemplate | null> => {
  await connectDB();
  const doc = await ProjectTemplateModel.findById(id).lean();
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    defaultDescription: doc.defaultDescription,
    defaultSoldPrice: doc.defaultSoldPrice,
    defaultServiceId: doc.defaultServiceId,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  };
});

export async function getLastActivityByClientId(
  clientId: string
): Promise<{ createdAt: string; actorName: string; type: string } | null> {
  await connectDB();
  const doc = await ActivityEventModel.findOne({ clientId }).sort({ createdAt: -1 }).lean();
  if (!doc) return null;
  return {
    createdAt: (doc.createdAt as Date).toISOString(),
    actorName: doc.actorName,
    type: doc.type,
  };
}

export async function getUpcomingTasksForProjects(
  projectIds: string[],
  fromDate: string
): Promise<Task[]> {
  if (projectIds.length === 0) return [];
  await connectDB();
  const docs = await TaskModel.find({
    projectId: { $in: projectIds },
    completedAt: null,
    completionDate: { $gte: fromDate },
  })
    .sort({ completionDate: 1 })
    .lean();
  return docs.map(mapTask);
}

export async function getUpcomingGeneralTasksByClientId(
  clientId: string,
  fromDate: string
): Promise<Task[]> {
  await connectDB();
  const docs = await TaskModel.find({
    clientId,
    projectId: { $exists: false },
    logId: { $exists: false },
    completedAt: null,
    completionDate: { $gte: fromDate },
  })
    .sort({ completionDate: 1 })
    .lean();
  return docs.map(mapTask);
}

// ── Shared events builder ─────────────────────────────────────────────────────
// Single source of truth for upcoming events — used by both the events API and
// the dashboard. Keeps both in sync automatically.

const RECURRENCE_WINDOW_DAYS = 365;

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return date.toISOString().slice(0, 10);
}

/** Map legacy recurrence strings to interval + unit */
function legacyToIntervalUnit(recurrence: string): { interval: number; unit: RecurrenceUnit } | null {
  switch (recurrence) {
    case "weekly":    return { interval: 1, unit: "weeks" };
    case "biweekly":  return { interval: 2, unit: "weeks" };
    case "monthly":   return { interval: 1, unit: "months" };
    case "quarterly": return { interval: 3, unit: "months" };
    case "yearly":    return { interval: 1, unit: "years" };
    default:          return null;
  }
}

/** Resolve recurrence from a ClientEvent doc (supports both new and legacy format) */
function resolveRecurrence(doc: { recurrenceInterval?: unknown; recurrenceUnit?: unknown; recurrence?: unknown }): { interval: number; unit: RecurrenceUnit } | null {
  if (typeof doc.recurrenceInterval === "number" && typeof doc.recurrenceUnit === "string") {
    return { interval: doc.recurrenceInterval, unit: doc.recurrenceUnit as RecurrenceUnit };
  }
  if (typeof doc.recurrence === "string" && doc.recurrence !== "none") {
    return legacyToIntervalUnit(doc.recurrence);
  }
  return null;
}

function nextOccurrenceDateByUnit(dateStr: string, interval: number, unit: RecurrenceUnit): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  let next: Date;
  switch (unit) {
    case "days":   next = new Date(y, m - 1, d + interval);       break;
    case "weeks":  next = new Date(y, m - 1, d + interval * 7);   break;
    case "months": next = new Date(y, m - 1 + interval, d);       break;
    case "years":  next = new Date(y + interval, m - 1, d);       break;
    default:       return dateStr;
  }
  return next.toISOString().slice(0, 10);
}

function expandOccurrences(
  baseDate: string,
  interval: number,
  unit: RecurrenceUnit,
  today: string,
  windowEnd: string,
  repetitions?: number | null
): string[] {
  const occurrences: string[] = [];
  let current = baseDate;
  let totalCount = 0;
  while (current <= windowEnd) {
    totalCount++;
    if (current >= today) occurrences.push(current);
    if (repetitions != null && totalCount >= repetitions) break;
    const next = nextOccurrenceDateByUnit(current, interval, unit);
    if (next <= current) break;
    current = next;
  }
  return occurrences;
}

function expandPastOccurrences(
  baseDate: string,
  interval: number,
  unit: RecurrenceUnit,
  lookbackStart: string,
  today: string,
  repetitions?: number | null
): string[] {
  const occurrences: string[] = [];
  let current = baseDate;
  let totalCount = 0;
  while (current < today) {
    totalCount++;
    if (current >= lookbackStart) occurrences.push(current);
    if (repetitions != null && totalCount >= repetitions) break;
    const next = nextOccurrenceDateByUnit(current, interval, unit);
    if (next <= current) break;
    current = next;
  }
  return occurrences;
}

/**
 * Returns the latest followedUpAt date per serviceId for a given client.
 * Used by OverviewTab to reset the service expiry timer display.
 */
export const getLatestFollowUpDatesByService = cache(async (clientId: string): Promise<Record<string, string>> => {
  await connectDB();
  const logs = await LogModel.find({
    clientId,
    serviceId: { $exists: true, $ne: null },
    followUp: true,
    followedUpAt: { $ne: null },
  }).lean();

  const result: Record<string, string> = {};
  for (const l of logs) {
    const sid = l.serviceId as string;
    const date = l.followedUpAt as string;
    if (!result[sid] || date > result[sid]) {
      result[sid] = date;
    }
  }
  return result;
});

// ── Service expiry automation ─────────────────────────────────────────────
// When a service's check-in timer expires, create an automated log entry
// with a follow-up task. Idempotent: skips if a pending log already exists.

export async function checkAndCreateServiceExpiryLogs(
  clientId: string,
): Promise<void> {
  await connectDB();

  const today = new Date().toISOString().slice(0, 10);

  const servicesWithTimer = await ServiceModel.find({ checkInDays: { $ne: null } }).lean();
  if (servicesWithTimer.length === 0) return;

  const serviceIds = servicesWithTimer.map((s) => s._id.toString());

  // Fetch project completion dates and log follow-up dates in parallel
  const [completedProjects, followedUpLogs] = await Promise.all([
    ProjectModel.find({
      clientId,
      status: "completed",
      serviceId: { $in: serviceIds },
      completedDate: { $exists: true, $ne: null },
    }).lean(),
    LogModel.find({
      clientId,
      serviceId: { $in: serviceIds },
      followUp: true,
      followedUpAt: { $ne: null },
    }).lean(),
  ]);

  // Latest project completion per service
  const latestProjectDate = new Map<string, string>();
  for (const p of completedProjects) {
    const sid = p.serviceId as string;
    const date = p.completedDate as string;
    if (!latestProjectDate.has(sid) || date > latestProjectDate.get(sid)!) {
      latestProjectDate.set(sid, date);
    }
  }

  // Latest follow-up completion per service (for timer reset)
  const latestFollowedUpDate = new Map<string, string>();
  for (const l of followedUpLogs) {
    const sid = l.serviceId as string;
    const date = l.followedUpAt as string;
    if (!latestFollowedUpDate.has(sid) || date > latestFollowedUpDate.get(sid)!) {
      latestFollowedUpDate.set(sid, date);
    }
  }

  for (const svc of servicesWithTimer) {
    const sid = svc._id.toString();
    const projectDate = latestProjectDate.get(sid);
    if (!projectDate) continue; // no completed project → nothing to expire

    const followUpDate = latestFollowedUpDate.get(sid);
    const lastInteraction = followUpDate && followUpDate > projectDate ? followUpDate : projectDate;
    const expiryDate = addDays(lastInteraction, svc.checkInDays as number);

    if (expiryDate > today) continue; // not yet expired

    // Idempotency: skip if a pending log already exists for this service
    const existing = await LogModel.findOne({
      clientId,
      serviceId: sid,
      followUp: true,
      followedUpAt: null,
    }).lean();
    if (existing) continue;

    const serviceName = svc.name as string;
    const followUpAction = `Check in about expired service: ${serviceName}`;

    const doc = await LogModel.create({
      clientId,
      serviceId: sid,
      date: today,
      summary: `${serviceName} expired today`,
      followUp: true,
      followUpAction,
      followUpDeadline: today,
      isSystemGenerated: true,
      createdById: "system",
      createdByName: "System",
    });

    const task = await TaskModel.create({
      clientId,
      logId: doc._id.toString(),
      title: followUpAction,
      completionDate: today,
      createdById: "system",
      createdByName: "System",
    });

    await LogModel.findByIdAndUpdate(doc._id, { $set: { followUpTaskId: task._id.toString() } });
  }
}

export async function getUpcomingEventsForClient(clientId: string): Promise<TimelineEvent[]> {
  await connectDB();

  const today = new Date().toISOString().slice(0, 10);
  const windowEndDate = new Date();
  windowEndDate.setDate(windowEndDate.getDate() + RECURRENCE_WINDOW_DAYS);
  const windowEnd = windowEndDate.toISOString().slice(0, 10);

  const activeProjectIds = (
    await ProjectModel.find({ clientId, status: { $ne: "completed" }, kickedOffAt: { $exists: true, $ne: null } }, { _id: 1 }).lean()
  ).map((p) => p._id.toString());

  const [logs, completionProjects, deliveryProjects, projectTasks, generalTasks, customDocs, servicesWithTimer] =
    await Promise.all([
      LogModel.find({
        clientId,
        followUp: true,
        followedUpAt: null,
        $or: [
          { followUpDeadline: { $gte: today } },
          { serviceId: { $exists: true, $ne: null } },
        ],
      }).lean(),
      ProjectModel.find({
        clientId,
        status: { $ne: "completed" },
        kickedOffAt: { $exists: true, $ne: null },
        completedDate: { $gte: today },
      }).lean(),
      ProjectModel.find({
        clientId,
        status: { $ne: "completed" },
        kickedOffAt: { $exists: true, $ne: null },
        deliveryDate: { $gte: today },
      }).lean(),
      activeProjectIds.length > 0
        ? TaskModel.find({
            projectId: { $in: activeProjectIds },
            logId: { $exists: false },
            completedAt: null,
            completionDate: { $gte: today },
          }).lean()
        : Promise.resolve([]),
      TaskModel.find({
        clientId,
        projectId: { $exists: false },
        logId: { $exists: false },
        completedAt: null,
        completionDate: { $gte: today },
      }).lean(),
      ClientEventModel.find({ clientId }).sort({ date: 1 }).lean(),
      ServiceModel.find({ checkInDays: { $ne: null } }).lean(),
    ]);

  // Build service name lookup for service-linked log events
  const serviceNameMap = new Map<string, string>();
  for (const svc of servicesWithTimer) {
    serviceNameMap.set(svc._id.toString(), svc.name as string);
  }

  const tasks = [...projectTasks, ...generalTasks];

  const events: TimelineEvent[] = [
    ...logs.map((l) => {
      const logServiceId = l.serviceId as string | undefined;
      const serviceName = logServiceId ? serviceNameMap.get(logServiceId) : undefined;
      return {
        id: `log_${l._id.toString()}`,
        date: l.followUpDeadline ?? l.date,
        title: logServiceId && serviceName
          ? `${serviceName} is expired`
          : (l.followUpAction as string | undefined)?.trim() || (l.summary as string).slice(0, 60),
        type: logServiceId ? "expired_service" : "follow_up",
        source: "log_followup" as const,
        sourceId: l._id.toString(),
        deletable: false,
      };
    }),
    ...tasks.map((t) => ({
      id: `task_${t._id.toString()}`,
      date: t.completionDate!,
      title: t.title as string,
      type: "deadline" as const,
      source: "task" as const,
      sourceId: t._id.toString(),
      projectId: (t.projectId as string | undefined)?.toString(),
      deletable: false,
    })),
    ...completionProjects.map((p) => ({
      id: `project_${p._id.toString()}`,
      date: p.completedDate!,
      title: p.title as string,
      type: "project_completion" as const,
      source: "project" as const,
      sourceId: p._id.toString(),
      deletable: false,
    })),
    ...deliveryProjects.map((p) => ({
      id: `delivery_${p._id.toString()}`,
      date: p.deliveryDate!,
      title: p.title as string,
      type: "delivery" as const,
      source: "project" as const,
      sourceId: p._id.toString(),
      deletable: false,
    })),
    ...customDocs.flatMap((doc) => {
      const rec = resolveRecurrence(doc);
      const docId = doc._id.toString();
      if (!rec) {
        if (doc.date < today) return [] as TimelineEvent[];
        return [{
          id: `custom_${docId}`,
          date: doc.date,
          title: doc.title as string,
          type: doc.type as string,
          source: "custom" as const,
          sourceId: docId,
          notes: (doc.notes as string | undefined) ?? undefined,
          deletable: true,
        }] as TimelineEvent[];
      }
      return expandOccurrences(doc.date, rec.interval, rec.unit, today, windowEnd, doc.repetitions as number | null).map(
        (occDate) => ({
          id: `custom_${docId}_${occDate}`,
          date: occDate,
          baseDate: doc.date,
          title: doc.title as string,
          type: doc.type as string,
          source: "custom" as const,
          sourceId: docId,
          notes: (doc.notes as string | undefined) ?? undefined,
          deletable: true,
          recurrenceInterval: rec.interval,
          recurrenceUnit: rec.unit,
          repetitions: (doc.repetitions as number | undefined) ?? undefined,
        })
      );
    }),
  ];

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

const PAST_LOOKBACK_DAYS = 365;

export async function getPastEventsForClient(clientId: string): Promise<TimelineEvent[]> {
  await connectDB();

  const today = new Date().toISOString().slice(0, 10);
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - PAST_LOOKBACK_DAYS);
  const lookbackStart = lookbackDate.toISOString().slice(0, 10);

  const [logs, completionProjects, deliveryProjects, projectTasks, generalTasks, customDocs, servicesWithTimer] =
    await Promise.all([
      // Past follow-ups: either already followed up, or deadline has passed
      LogModel.find({
        clientId,
        followUp: true,
        $or: [
          { followedUpAt: { $ne: null } },
          { followUpDeadline: { $lt: today } },
        ],
        $and: [
          { $or: [
            { followUpDeadline: { $gte: lookbackStart } },
            { followUpDeadline: null, date: { $gte: lookbackStart } },
          ]},
        ],
      }).lean(),
      // Completed projects with completedDate in lookback window
      ProjectModel.find({
        clientId,
        completedDate: { $lt: today, $gte: lookbackStart },
      }).lean(),
      // Completed projects with deliveryDate in lookback window
      ProjectModel.find({
        clientId,
        deliveryDate: { $lt: today, $gte: lookbackStart },
      }).lean(),
      // Completed tasks (project-level) with completionDate in lookback window
      TaskModel.find({
        clientId,
        projectId: { $exists: true },
        completedAt: { $ne: null },
        completionDate: { $lt: today, $gte: lookbackStart },
      }).lean(),
      // Completed tasks (client-level) with completionDate in lookback window
      TaskModel.find({
        clientId,
        projectId: { $exists: false },
        completedAt: { $ne: null },
        completionDate: { $lt: today, $gte: lookbackStart },
      }).lean(),
      ClientEventModel.find({ clientId }).sort({ date: 1 }).lean(),
      ServiceModel.find({ checkInDays: { $ne: null } }).lean(),
    ]);

  const serviceNameMap = new Map<string, string>();
  for (const svc of servicesWithTimer) {
    serviceNameMap.set(svc._id.toString(), svc.name as string);
  }

  const tasks = [...projectTasks, ...generalTasks];

  const events: TimelineEvent[] = [
    ...logs.flatMap((l) => {
      const deadline = l.followUpDeadline ?? l.date;
      if (deadline >= today || deadline < lookbackStart) return [];
      const logServiceId = l.serviceId as string | undefined;
      const serviceName = logServiceId ? serviceNameMap.get(logServiceId) : undefined;
      return [{
        id: `log_${l._id.toString()}`,
        date: deadline,
        title: logServiceId && serviceName
          ? `${serviceName} is expired`
          : (l.followUpAction as string | undefined)?.trim() || (l.summary as string).slice(0, 60),
        type: logServiceId ? "expired_service" : "follow_up",
        source: "log_followup" as const,
        sourceId: l._id.toString(),
        deletable: false,
      }];
    }),
    ...tasks.map((t) => ({
      id: `task_${t._id.toString()}`,
      date: t.completionDate!,
      title: t.title as string,
      type: "deadline" as const,
      source: "task" as const,
      sourceId: t._id.toString(),
      projectId: (t.projectId as string | undefined)?.toString(),
      deletable: false,
    })),
    ...completionProjects.map((p) => ({
      id: `project_${p._id.toString()}`,
      date: p.completedDate!,
      title: p.title as string,
      type: "project_completion" as const,
      source: "project" as const,
      sourceId: p._id.toString(),
      deletable: false,
    })),
    ...deliveryProjects.map((p) => ({
      id: `delivery_${p._id.toString()}`,
      date: p.deliveryDate!,
      title: p.title as string,
      type: "delivery" as const,
      source: "project" as const,
      sourceId: p._id.toString(),
      deletable: false,
    })),
    ...customDocs.flatMap((doc) => {
      const rec = resolveRecurrence(doc);
      const docId = doc._id.toString();
      if (!rec) {
        if (doc.date >= today || doc.date < lookbackStart) return [] as TimelineEvent[];
        return [{
          id: `custom_${docId}`,
          date: doc.date,
          title: doc.title as string,
          type: doc.type as string,
          source: "custom" as const,
          sourceId: docId,
          notes: (doc.notes as string | undefined) ?? undefined,
          deletable: true,
        }] as TimelineEvent[];
      }
      return expandPastOccurrences(doc.date, rec.interval, rec.unit, lookbackStart, today, doc.repetitions as number | null).map(
        (occDate) => ({
          id: `custom_${docId}_${occDate}`,
          date: occDate,
          baseDate: doc.date,
          title: doc.title as string,
          type: doc.type as string,
          source: "custom" as const,
          sourceId: docId,
          notes: (doc.notes as string | undefined) ?? undefined,
          deletable: true,
          recurrenceInterval: rec.interval,
          recurrenceUnit: rec.unit,
          repetitions: (doc.repetitions as number | undefined) ?? undefined,
        })
      );
    }),
  ];

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

export async function getAllEventsForClient(clientId: string): Promise<TimelineEvent[]> {
  const [past, upcoming] = await Promise.all([
    getPastEventsForClient(clientId),
    getUpcomingEventsForClient(clientId),
  ]);
  return [...past, ...upcoming];
}

export async function getGeneralTasksByClientId(clientId: string): Promise<Task[]> {
  await connectDB();
  const docs = await TaskModel.find({ clientId, projectId: { $exists: false } }).sort({ createdAt: 1 }).lean();
  return docs.map(mapTask);
}

export async function getTasksByProjectIds(projectIds: string[]): Promise<Map<string, Task[]>> {
  const map = new Map<string, Task[]>();
  if (projectIds.length === 0) return map;
  await connectDB();
  const docs = await TaskModel.find({ projectId: { $in: projectIds } }).sort({ createdAt: 1 }).lean();
  for (const doc of docs) {
    const pid = doc.projectId as string;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(mapTask(doc));
  }
  return map;
}

export async function getEventTypes(): Promise<EventType[]> {
  await connectDB();

  // Upsert any missing defaults (preserves existing customised entries)
  await Promise.all(
    DEFAULT_EVENT_TYPES.map((et, i) =>
      EventTypeModel.updateOne(
        { slug: et.slug },
        { $setOnInsert: { ...et, rank: i } },
        { upsert: true }
      )
    )
  );

  const docs = await EventTypeModel.find().sort({ rank: 1, createdAt: 1 }).lean();

  return docs.map((d) => ({
    id: d._id.toString(),
    slug: d.slug,
    label: d.label,
    color: d.color,
    icon: d.icon,
    rank: d.rank ?? 0,
  }));
}

// ── Bulk admin overview helpers ───────────────────────────────────────────

export async function getOpenTaskCountsByClient(): Promise<Map<string, number>> {
  await connectDB();
  const results = await TaskModel.aggregate([
    { $match: { completedAt: null, clientId: { $exists: true } } },
    { $group: { _id: "$clientId", count: { $sum: 1 } } },
  ]);
  const map = new Map<string, number>();
  for (const r of results) {
    if (r._id) map.set(r._id.toString(), r.count);
  }
  return map;
}

export async function getOpenProjectCountsByClient(): Promise<Map<string, number>> {
  await connectDB();
  const results = await ProjectModel.aggregate([
    { $match: { status: { $ne: "completed" } } },
    { $group: { _id: "$clientId", count: { $sum: 1 } } },
  ]);
  const map = new Map<string, number>();
  for (const r of results) {
    if (r._id) map.set(r._id.toString(), r.count);
  }
  return map;
}

export async function getLastActivityDateByAllClients(): Promise<Map<string, string | null>> {
  await connectDB();
  const results = await ActivityEventModel.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$clientId", lastActivity: { $first: "$createdAt" } } },
  ]);
  const map = new Map<string, string | null>();
  for (const r of results) {
    if (r._id) map.set(r._id.toString(), r.lastActivity ? new Date(r.lastActivity).toISOString() : null);
  }
  return map;
}

export type FirstEventResult = { date: string; title: string; source: string } | null;

export async function getFirstUpcomingEventByAllClients(): Promise<Map<string, FirstEventResult>> {
  await connectDB();

  const today = new Date().toISOString().slice(0, 10);
  const windowEndDate = new Date();
  windowEndDate.setDate(windowEndDate.getDate() + RECURRENCE_WINDOW_DAYS);
  const windowEnd = windowEndDate.toISOString().slice(0, 10);

  const [logs, completionProjects, deliveryProjects, tasks, customDocs] = await Promise.all([
    LogModel.find({ followUp: true, followedUpAt: null, followUpDeadline: { $gte: today } }).lean(),
    ProjectModel.find({ status: { $ne: "completed" }, kickedOffAt: { $exists: true, $ne: null }, completedDate: { $gte: today } }).lean(),
    ProjectModel.find({ status: { $ne: "completed" }, kickedOffAt: { $exists: true, $ne: null }, deliveryDate: { $gte: today } }).lean(),
    TaskModel.find({ completedAt: null, completionDate: { $gte: today }, logId: { $exists: false } }).lean(),
    ClientEventModel.find({}).sort({ date: 1 }).lean(),
  ]);

  // Collect candidates per client: { clientId -> [{date, title, source}] }
  const candidates = new Map<string, { date: string; title: string; source: string }[]>();

  function add(clientId: string, event: { date: string; title: string; source: string }) {
    if (!clientId) return;
    const cid = clientId.toString();
    if (!candidates.has(cid)) candidates.set(cid, []);
    candidates.get(cid)!.push(event);
  }

  for (const l of logs) {
    add(l.clientId as string, {
      date: l.followUpDeadline as string,
      title: (l.followUpAction as string | undefined)?.trim() || (l.summary as string).slice(0, 60),
      source: "log_followup",
    });
  }
  for (const p of completionProjects) {
    add(p.clientId as string, { date: p.completedDate as string, title: p.title as string, source: "project" });
  }
  for (const p of deliveryProjects) {
    add(p.clientId as string, { date: p.deliveryDate as string, title: p.title as string, source: "project" });
  }
  for (const t of tasks) {
    if (t.clientId) {
      add(t.clientId as string, { date: t.completionDate as string, title: t.title as string, source: "task" });
    }
  }
  for (const doc of customDocs) {
    const rec = resolveRecurrence(doc);
    const cid = (doc.clientId as string).toString();
    if (!rec) {
      if ((doc.date as string) >= today) {
        add(cid, { date: doc.date as string, title: doc.title as string, source: "custom" });
      }
    } else {
      const occurrences = expandOccurrences(doc.date as string, rec.interval, rec.unit, today, windowEnd, doc.repetitions as number | null);
      if (occurrences.length > 0) {
        add(cid, { date: occurrences[0], title: doc.title as string, source: "custom" });
      }
    }
  }

  const result = new Map<string, FirstEventResult>();
  for (const [cid, events] of candidates.entries()) {
    events.sort((a, b) => a.date.localeCompare(b.date));
    result.set(cid, events[0]);
  }
  return result;
}

export const getTemplateTasksByTemplateId = cache(async (templateId: string): Promise<TemplateTask[]> => {
  await connectDB();
  const docs = await TemplateTaskModel.find({ templateId }).sort({ order: 1 }).lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    templateId: doc.templateId,
    parentTaskId: doc.parentTaskId ?? undefined,
    title: doc.title,
    description: doc.description ?? undefined,
    assignToClientLead: doc.assignToClientLead ?? false,
    order: doc.order ?? 0,
    createdAt: doc.createdAt?.toISOString(),
  }));
});

export async function getProjectsByAllClients(): Promise<Map<string, Project[]>> {
  await connectDB();
  const [docs, serviceDocs, labelMap] = await Promise.all([
    ProjectModel.find({}).sort({ createdAt: -1 }).lean(),
    fetchServiceDocs(),
    buildProjectLabelMap(),
  ]);
  const serviceMap = new Map<string, string>();
  serviceDocs.forEach((d) => serviceMap.set(d._id.toString(), d.name));

  const map = new Map<string, Project[]>();
  for (const doc of docs) {
    const project = mapProject(doc, serviceMap, labelMap);
    const cid = project.clientId;
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid)!.push(project);
  }
  return map;
}

// ── "This Week" dashboard data ──────────────────────────────────────────────

/**
 * Returns all calendar items for the week calendar view,
 * categorized by type (deadline, delivery, kickoff, followup, event).
 */
export async function getWeekCalendarItems(start: string, end: string): Promise<WeekCalendarItem[]> {
  await connectDB();

  // Build client lookup for names and leads
  const clients = await getClients();
  const clientMap = new Map<string, { company: string; leads: ClientLead[] }>();
  for (const c of clients) {
    clientMap.set(c.id, { company: c.company, leads: c.leads ?? [] });
  }

  function resolve(clientId: string | undefined): { clientName: string; leads: ClientLead[] } {
    if (!clientId) return { clientName: "General", leads: [] };
    const c = clientMap.get(clientId.toString());
    return c ? { clientName: c.company, leads: c.leads } : { clientName: "General", leads: [] };
  }

  const [deadlineTasks, deliveryProjects, kickoffProjects, followUpLogs, customDocs] = await Promise.all([
    // Deadlines: open tasks with completionDate in range
    TaskModel.find({
      completionDate: { $gte: start, $lte: end },
      completedAt: null,
    }).lean(),
    // Deliveries: projects with deliveryDate in range
    ProjectModel.find({
      deliveryDate: { $gte: start, $lte: end },
      status: { $ne: "completed" },
    }).lean(),
    // Kick-offs: projects with scheduledStartDate in range and not yet started
    ProjectModel.find({
      scheduledStartDate: { $gte: start, $lte: end },
      status: "not_started",
    }).lean(),
    // Follow-ups: open follow-ups with deadline in range
    LogModel.find({
      followUp: true,
      followedUpAt: null,
      followUpDeadline: { $gte: start, $lte: end },
    }).lean(),
    // Events: all custom events (need full set for recurrence expansion)
    ClientEventModel.find({}).sort({ date: 1 }).lean(),
  ]);

  const items: WeekCalendarItem[] = [];

  // Deadlines (tasks)
  for (const t of deadlineTasks) {
    const cid = t.clientId?.toString();
    const { clientName, leads } = resolve(cid);
    const projectId = t.projectId?.toString();
    items.push({
      id: `task_${t._id.toString()}`,
      type: "deadline",
      date: mapToWeekday(t.completionDate as string),
      title: t.title as string,
      clientId: cid ?? "",
      clientName,
      leads,
      linkHref: projectId
        ? `/clients/${cid}/projects/${projectId}`
        : cid ? `/clients/${cid}?tab=Tasks` : "/tasks",
      meta: projectId ? undefined : undefined,
    });
  }

  // Deliveries (projects)
  for (const p of deliveryProjects) {
    const cid = (p.clientId as string).toString();
    const { clientName, leads } = resolve(cid);
    items.push({
      id: `delivery_${p._id.toString()}`,
      type: "delivery",
      date: mapToWeekday(p.deliveryDate as string),
      title: p.title as string,
      clientId: cid,
      clientName,
      leads,
      linkHref: `/clients/${cid}/projects/${p._id.toString()}`,
    });
  }

  // Kick-offs (projects)
  for (const p of kickoffProjects) {
    const cid = (p.clientId as string).toString();
    const { clientName, leads } = resolve(cid);
    items.push({
      id: `kickoff_${p._id.toString()}`,
      type: "kickoff",
      date: mapToWeekday(p.scheduledStartDate as string),
      title: p.title as string,
      clientId: cid,
      clientName,
      leads,
      linkHref: `/clients/${cid}/projects/${p._id.toString()}`,
    });
  }

  // Follow-ups (logs)
  for (const l of followUpLogs) {
    // Skip follow-ups that have already generated a task (avoid duplication)
    if (l.followUpTaskId) continue;
    const cid = (l.clientId as string).toString();
    const { clientName, leads } = resolve(cid);
    items.push({
      id: `followup_${l._id.toString()}`,
      type: "followup",
      date: mapToWeekday(l.followUpDeadline as string),
      title: (l.followUpAction as string | undefined)?.trim() || (l.summary as string).slice(0, 60),
      clientId: cid,
      clientName,
      leads,
      linkHref: `/clients/${cid}?tab=Logbook`,
    });
  }

  // Events (custom, with recurrence expansion bounded to this week)
  for (const doc of customDocs) {
    const rec = resolveRecurrence(doc);
    const docId = doc._id.toString();
    const cid = (doc.clientId as string).toString();
    const { clientName, leads } = resolve(cid);

    if (!rec) {
      // One-off event
      const d = doc.date as string;
      if (d >= start && d <= end) {
        items.push({
          id: `event_${docId}`,
          type: "event",
          date: mapToWeekday(d),
          title: doc.title as string,
          clientId: cid,
          clientName,
          leads,
          linkHref: `/clients/${cid}?tab=Events`,
        });
      }
    } else {
      // Recurring event — expand only within the week window
      const occurrences = expandOccurrences(
        doc.date as string, rec.interval, rec.unit,
        start, end,
        doc.repetitions as number | null
      );
      for (const occ of occurrences) {
        items.push({
          id: `event_${docId}_${occ}`,
          type: "event",
          date: mapToWeekday(occ),
          title: doc.title as string,
          clientId: cid,
          clientName,
          leads,
          linkHref: `/clients/${cid}?tab=Events`,
        });
      }
    }
  }

  // Sort by date, then by type priority
  const typePriority: Record<string, number> = { kickoff: 0, event: 1, followup: 2, deadline: 3, delivery: 4 };
  items.sort((a, b) => a.date.localeCompare(b.date) || (typePriority[a.type] ?? 5) - (typePriority[b.type] ?? 5));

  return items;
}

/**
 * Returns active projects grouped by client, ready for the Gantt timeline.
 */
export async function getActiveProjectsForGantt(): Promise<{ clients: Client[]; projectsByClient: Record<string, Project[]> }> {
  await connectDB();
  const [clients, projectMap] = await Promise.all([
    getClients(),
    getProjectsByAllClients(),
  ]);

  const projectsByClient: Record<string, Project[]> = {};
  for (const [cid, projects] of projectMap.entries()) {
    const active = projects.filter((p) => p.status !== "completed");
    if (active.length > 0) {
      projectsByClient[cid] = active;
    }
  }

  return { clients, projectsByClient };
}

/** Like getActiveProjectsForGantt but filtered to clients where userId is a lead. */
export async function getMyActiveProjectsForGantt(
  userId: string
): Promise<{ clients: Client[]; projectsByClient: Record<string, Project[]> }> {
  await connectDB();
  const [allClients, projectMap] = await Promise.all([
    getClients(),
    getProjectsByAllClients(),
  ]);

  const myClients = allClients.filter((c) =>
    c.leads?.some((l) => l.userId === userId)
  );

  const projectsByClient: Record<string, Project[]> = {};
  for (const client of myClients) {
    const projects = projectMap.get(client.id) ?? [];
    const active = projects.filter((p) => p.status !== "completed");
    if (active.length > 0) {
      projectsByClient[client.id] = active;
    }
  }

  const clientsWithProjects = myClients.filter((c) => projectsByClient[c.id]);
  return { clients: clientsWithProjects, projectsByClient };
}

/* ─── My Day helpers ─────────────────────────────────────────────── */

type ClientInfo = { name: string; primaryColor?: string };

const fetchClientInfoMap = cache(async (): Promise<Map<string, ClientInfo>> => {
  await connectDB();
  const docs = await ClientModel.find({}, { _id: 1, company: 1, primaryColor: 1 }).lean();
  return new Map(
    docs.map((d) => [
      d._id.toString(),
      { name: d.company as string, primaryColor: (d.primaryColor as string | undefined) ?? undefined },
    ])
  );
});

export async function getMyOverdueAndTodayTasks(
  userId: string
): Promise<(Task & { clientName: string; clientPrimaryColor?: string })[]> {
  await connectDB();
  const today = new Date().toISOString().slice(0, 10);
  const [docs, clientMap] = await Promise.all([
    TaskModel.find({
      "assignees.userId": userId,
      completedAt: null,
      completionDate: { $lte: today },
    })
      .sort({ completionDate: 1 })
      .lean(),
    fetchClientInfoMap(),
  ]);
  return docs.map((d) => {
    const info = clientMap.get(d.clientId as string);
    return {
      ...mapTask(d),
      clientName: info?.name ?? "",
      clientPrimaryColor: info?.primaryColor,
    };
  });
}

export async function getMyOpenFollowUps(
  userId: string
): Promise<(Log & { clientName: string; clientPrimaryColor?: string })[]> {
  await connectDB();
  const [docs, clientMap] = await Promise.all([
    LogModel.find({
      createdById: userId,
      followUp: true,
      followedUpAt: null,
      followUpAction: { $exists: true, $nin: [null, ""] },
    })
      .sort({ followUpDeadline: 1 })
      .lean(),
    fetchClientInfoMap(),
  ]);
  return docs.map((doc) => {
    const info = clientMap.get(doc.clientId as string);
    return {
      id: doc._id.toString(),
      clientId: doc.clientId,
      contactIds: doc.contactIds?.length ? doc.contactIds : doc.contactId ? [doc.contactId] : [],
      date: doc.date,
      summary: doc.summary,
      signalIds: doc.signalIds ?? [],
      followUp: doc.followUp ?? false,
      followUpAction: doc.followUpAction ?? undefined,
      followUpDeadline: doc.followUpDeadline ?? undefined,
      followedUpAt: doc.followedUpAt ?? undefined,
      followedUpByName: doc.followedUpByName ?? undefined,
      isSystemGenerated: doc.isSystemGenerated ?? false,
      createdById: doc.createdById,
      createdByName: doc.createdByName,
      createdAt: doc.createdAt?.toISOString().split("T")[0],
      clientName: info?.name ?? "",
      clientPrimaryColor: info?.primaryColor,
    };
  });
}

export async function getMyProjectsOverview(
  userId: string
): Promise<MyProjectOverview[]> {
  await connectDB();
  const clientDocs = await ClientModel.find(
    { "leads.userId": userId },
    { _id: 1, company: 1, primaryColor: 1 }
  ).lean();
  if (clientDocs.length === 0) return [];

  const clientIds = clientDocs.map((c) => c._id.toString());
  const clientInfoMap = new Map<string, ClientInfo>(
    clientDocs.map((c) => [
      c._id.toString(),
      { name: c.company as string, primaryColor: (c.primaryColor as string | undefined) ?? undefined },
    ])
  );

  const projects = await ProjectModel.find({
    clientId: { $in: clientIds },
    status: { $ne: "completed" },
  }).lean();
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p._id.toString());
  const [taskStats, nextDeadlines] = await Promise.all([
    getTaskStatsByProjectIds(projectIds),
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const tasks = await TaskModel.find(
        {
          projectId: { $in: projectIds },
          completedAt: null,
          completionDate: { $gte: today },
        },
        { projectId: 1, completionDate: 1 }
      ).lean();
      const map = new Map<string, string>();
      for (const t of tasks) {
        const pid = t.projectId as string;
        const cd = t.completionDate as string;
        const existing = map.get(pid);
        if (!existing || cd < existing) map.set(pid, cd);
      }
      return map;
    })(),
  ]);

  return projects.map((p) => {
    const pid = p._id.toString();
    const stats = taskStats.get(pid) ?? { total: 0, completed: 0 };
    const info = clientInfoMap.get(p.clientId as string);
    return {
      projectId: pid,
      projectTitle: p.title as string,
      clientId: p.clientId as string,
      clientName: info?.name ?? "",
      clientPrimaryColor: info?.primaryColor,
      status: p.status as "not_started" | "in_progress" | "completed",
      taskTotal: stats.total,
      taskCompleted: stats.completed,
      nextDeadline: nextDeadlines.get(pid),
      deliveryDate: (p.deliveryDate as string) ?? undefined,
    };
  });
}

export async function getMyUpcomingDeadlines(
  userId: string
): Promise<(Task & { clientName: string; clientPrimaryColor?: string })[]> {
  await connectDB();
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const weekEnd = d.toISOString().slice(0, 10);

  const [docs, clientMap] = await Promise.all([
    TaskModel.find({
      "assignees.userId": userId,
      completedAt: null,
      completionDate: { $gt: today, $lte: weekEnd },
    })
      .sort({ completionDate: 1 })
      .lean(),
    fetchClientInfoMap(),
  ]);
  return docs.map((d) => {
    const info = clientMap.get(d.clientId as string);
    return {
      ...mapTask(d),
      clientName: info?.name ?? "",
      clientPrimaryColor: info?.primaryColor,
    };
  });
}

async function buildProjectNameMap(projectIds: string[]): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();
  const docs = await ProjectModel.find(
    { _id: { $in: projectIds } },
    { _id: 1, title: 1 }
  ).lean();
  return new Map(docs.map((d) => [d._id.toString(), d.title as string]));
}

function buildMyDayTaskData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docs: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subtaskDocs: any[],
  clientMap: Map<string, ClientInfo>,
  projectNameMap: Map<string, string>,
  imageMap: Map<string, string>,
): MyDayTaskData {
  const subtasksByParent: Record<string, Task[]> = {};
  for (const sd of subtaskDocs) {
    const pid = sd.parentTaskId as string;
    if (!subtasksByParent[pid]) subtasksByParent[pid] = [];
    subtasksByParent[pid].push(mapTask(sd));
  }

  const userImages: Record<string, string> = {};
  for (const [id, img] of imageMap) userImages[id] = img;

  return {
    tasks: docs.map((d) => {
      const info = clientMap.get(d.clientId as string);
      return {
        ...mapTask(d),
        clientName: info?.name ?? "",
        clientPrimaryColor: info?.primaryColor,
        projectName: d.projectId ? projectNameMap.get(d.projectId as string) : undefined,
      };
    }),
    subtasksByParent,
    userImages,
  };
}

export async function getMyDayTasks(userId: string): Promise<MyDayTaskData> {
  await connectDB();
  const [docs, clientMap, imageMap] = await Promise.all([
    TaskModel.find({
      "assignees.userId": userId,
      completedAt: null,
      parentTaskId: { $exists: false },
    })
      .sort({ completionDate: 1, createdAt: 1 })
      .lean(),
    fetchClientInfoMap(),
    buildUserImageMap(),
  ]);

  const projectIds = [...new Set(docs.map((d) => d.projectId as string).filter(Boolean))];
  const [projectNameMap, subtaskDocs] = await Promise.all([
    buildProjectNameMap(projectIds),
    docs.length > 0
      ? TaskModel.find({ parentTaskId: { $in: docs.map((d) => d._id.toString()) } }).sort({ order: 1, createdAt: 1 }).lean()
      : Promise.resolve([]),
  ]);

  return buildMyDayTaskData(docs, subtaskDocs, clientMap, projectNameMap, imageMap);
}

/** Fetch all open tasks for clients where userId is a lead OR has assigned tasks. */
export async function getMyLeadClientTasks(userId: string): Promise<MyDayTaskData> {
  await connectDB();

  // 1. Clients the user leads
  const leadClientDocs = await ClientModel.find(
    { "leads.userId": userId },
    { _id: 1, company: 1, primaryColor: 1 }
  ).lean();
  const leadClientIds = new Set(leadClientDocs.map((c) => c._id.toString()));

  // 2. Find any additional clientIds from tasks assigned to the user
  const assignedDocs = await TaskModel.find(
    { "assignees.userId": userId, completedAt: null, parentTaskId: { $exists: false } },
    { clientId: 1 }
  ).lean();
  const extraClientIds = [...new Set(
    assignedDocs.map((d) => d.clientId as string).filter((id) => id && !leadClientIds.has(id))
  )];

  // 3. Build full client info map
  const clientMap = new Map<string, ClientInfo>(
    leadClientDocs.map((c) => [
      c._id.toString(),
      { name: c.company as string, primaryColor: (c.primaryColor as string | undefined) ?? undefined },
    ])
  );
  if (extraClientIds.length > 0) {
    const extraDocs = await ClientModel.find(
      { _id: { $in: extraClientIds } },
      { _id: 1, company: 1, primaryColor: 1 }
    ).lean();
    for (const c of extraDocs) {
      clientMap.set(c._id.toString(), {
        name: c.company as string,
        primaryColor: (c.primaryColor as string | undefined) ?? undefined,
      });
    }
  }

  const allClientIds = [...clientMap.keys()];
  if (allClientIds.length === 0) {
    return { tasks: [], subtasksByParent: {}, userImages: {} };
  }

  const [docs, imageMap] = await Promise.all([
    TaskModel.find({
      clientId: { $in: allClientIds },
      completedAt: null,
      parentTaskId: { $exists: false },
    })
      .sort({ completionDate: 1, createdAt: 1 })
      .lean(),
    buildUserImageMap(),
  ]);

  const projectIds = [...new Set(docs.map((d) => d.projectId as string).filter(Boolean))];
  const [projectNameMap, subtaskDocs] = await Promise.all([
    buildProjectNameMap(projectIds),
    docs.length > 0
      ? TaskModel.find({ parentTaskId: { $in: docs.map((d) => d._id.toString()) } }).sort({ order: 1, createdAt: 1 }).lean()
      : Promise.resolve([]),
  ]);

  return buildMyDayTaskData(docs, subtaskDocs, clientMap, projectNameMap, imageMap);
}

export async function getMyDayFollowUps(userId: string): Promise<MyDayFollowUpData> {
  await connectDB();
  const [docs, clientMap, signalMap] = await Promise.all([
    LogModel.find({
      createdById: userId,
      followUp: true,
      followedUpAt: null,
    })
      .sort({ followUpDeadline: 1 })
      .lean(),
    fetchClientInfoMap(),
    buildLogSignalMap(),
  ]);

  const uniqueClientIds = [...new Set(docs.map((d) => d.clientId as string))];
  const clientDocs = uniqueClientIds.length > 0
    ? await ClientModel.find({ _id: { $in: uniqueClientIds } }, { _id: 1, contacts: 1 }).lean()
    : [];

  const contactsByClient: Record<string, Contact[]> = {};
  for (const c of clientDocs) {
    contactsByClient[c._id.toString()] = (c.contacts ?? []).map((ct: { id: string; firstName: string; lastName: string; role?: string; email?: string; phone?: string }) => ({
      id: ct.id,
      firstName: ct.firstName,
      lastName: ct.lastName,
      role: ct.role,
      email: ct.email,
      phone: ct.phone,
    }));
  }

  const signalDocs = await fetchLogSignalDocs();
  const signals = signalDocs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    rank: d.rank ?? 0,
    createdAt: d.createdAt?.toISOString().split("T")[0],
  }));

  return {
    logs: docs.map((doc) => {
      const info = clientMap.get(doc.clientId as string);
      return {
        id: doc._id.toString(),
        clientId: doc.clientId,
        contactIds: doc.contactIds?.length ? doc.contactIds : doc.contactId ? [doc.contactId] : [],
        date: doc.date,
        summary: doc.summary,
        signalIds: doc.signalIds ?? [],
        signals: (doc.signalIds ?? []).map((sid: string) => signalMap.get(sid) ?? sid),
        followUp: doc.followUp ?? false,
        followUpAction: doc.followUpAction ?? undefined,
        followUpDeadline: doc.followUpDeadline ?? undefined,
        followedUpAt: doc.followedUpAt ?? undefined,
        followedUpByName: doc.followedUpByName ?? undefined,
        isSystemGenerated: doc.isSystemGenerated ?? false,
        createdById: doc.createdById,
        createdByName: doc.createdByName,
        createdAt: doc.createdAt?.toISOString().split("T")[0],
        clientName: info?.name ?? "",
        clientPrimaryColor: info?.primaryColor,
      };
    }),
    contactsByClient,
    signals,
  };
}

export async function getMyDayUserInfo(userId: string): Promise<MyDayUserInfo> {
  await connectDB();
  const [user, clientDocs, openTaskCount, openFollowUpCount] = await Promise.all([
    UserModel.findById(userId, { name: 1, image: 1, email: 1, role: 1 }).lean(),
    ClientModel.find({ "leads.userId": userId }, { _id: 1 }).lean(),
    TaskModel.countDocuments({ "assignees.userId": userId, completedAt: null, parentTaskId: { $exists: false } }),
    LogModel.countDocuments({ createdById: userId, followUp: true, followedUpAt: null }),
  ]);

  if (!user) {
    return { name: "", image: null, email: "", roleName: "", activeClientCount: 0, activeProjectCount: 0, openTaskCount: 0, openFollowUpCount: 0 };
  }

  const roleSlug = (user.role as string) ?? "";
  const roleDoc = roleSlug ? await RoleModel.findOne({ slug: roleSlug }, { name: 1 }).lean() : null;

  const clientIds = clientDocs.map((c) => c._id.toString());
  const activeProjectCount = clientIds.length > 0
    ? await ProjectModel.countDocuments({ clientId: { $in: clientIds }, status: { $ne: "completed" } })
    : 0;

  return {
    name: (user.name as string) ?? "",
    image: (user.image as string) ?? null,
    email: (user.email as string) ?? "",
    roleName: roleDoc ? (roleDoc.name as string) : roleSlug,
    activeClientCount: clientDocs.length,
    activeProjectCount,
    openTaskCount,
    openFollowUpCount,
  };
}

// ── Team / Holiday Calendar ─────────────────────────────────────────

export async function getLeaveTypes(): Promise<LeaveType[]> {
  await connectDB();

  // Upsert any missing defaults (preserves existing customised entries)
  await Promise.all(
    DEFAULT_LEAVE_TYPES.map((lt, i) =>
      LeaveTypeModel.updateOne(
        { slug: lt.slug },
        { $setOnInsert: { ...lt, rank: i } },
        { upsert: true }
      )
    )
  );

  const docs = await LeaveTypeModel.find().sort({ rank: 1, createdAt: 1 }).lean();
  return docs.map((d) => ({
    id: d._id.toString(),
    slug: d.slug,
    label: d.label,
    color: d.color,
    icon: d.icon,
    rank: d.rank ?? 0,
    countsAgainstAllowance: d.countsAgainstAllowance ?? false,
  }));
}

export async function getCompanyHolidays(year: number): Promise<CompanyHoliday[]> {
  await connectDB();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const docs = await CompanyHolidayModel.find({
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: 1 }).lean();
  return docs.map((d) => ({
    id: d._id.toString(),
    date: d.date,
    label: d.label,
  }));
}

export const getTimeOffByMonth = cache(async (year: number, month: number): Promise<{ entries: TimeOffEntry[]; users: { id: string; name: string; image: string | null; role: string }[] }> => {
  await connectDB();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [timeOffDocs, userDocs] = await Promise.all([
    TimeOffModel.find({
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
      status: "confirmed",
    }).lean(),
    UserModel.find({ status: "active" }, { _id: 1, name: 1, image: 1, role: 1 }).sort({ name: 1 }).lean(),
  ]);

  const userMap = new Map<string, { name: string; image: string | null }>();
  for (const u of userDocs) {
    userMap.set(u._id.toString(), { name: (u.name as string) ?? "", image: (u.image as string) ?? null });
  }

  const entries: TimeOffEntry[] = timeOffDocs.map((d) => {
    const uid = (d.userId as mongoose.Types.ObjectId).toString();
    const user = userMap.get(uid);
    return {
      id: d._id.toString(),
      userId: uid,
      userName: user?.name,
      userImage: user?.image ?? undefined,
      startDate: d.startDate,
      endDate: d.endDate,
      startDayPortion: d.startDayPortion,
      endDayPortion: d.endDayPortion,
      leaveTypeSlug: d.leaveTypeSlug,
      notes: d.notes,
      status: d.status,
      createdById: (d.createdById as mongoose.Types.ObjectId).toString(),
      createdByName: d.createdByName,
      createdAt: d.createdAt?.toISOString().split("T")[0],
    };
  });

  const users = userDocs.map((u) => ({
    id: u._id.toString(),
    name: (u.name as string) ?? "",
    image: (u.image as string) ?? null,
    role: (u.role as string) ?? "",
  }));

  return { entries, users };
});

/** Count business days (Mon–Fri) used per leave type for a set of entries within a year. */
export function calculateDaysUsed(
  entries: TimeOffEntry[],
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const entry of entries) {
    const start = new Date(entry.startDate + "T00:00:00");
    const end = new Date(entry.endDate + "T00:00:00");
    let days = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends

      let dayValue = 1;
      const dateStr = d.toISOString().split("T")[0];
      if (dateStr === entry.startDate && entry.startDayPortion !== "full") {
        dayValue = 0.5;
      } else if (dateStr === entry.endDate && entry.endDayPortion !== "full") {
        dayValue = 0.5;
      }
      days += dayValue;
    }

    result[entry.leaveTypeSlug] = (result[entry.leaveTypeSlug] ?? 0) + days;
  }

  return result;
}

export const getTimeOffBalances = cache(async (year: number): Promise<TimeOffBalance[]> => {
  await connectDB();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [userDocs, timeOffDocs, leaveTypes, roleDocs] = await Promise.all([
    UserModel.find({ status: "active" }, { _id: 1, name: 1, image: 1, role: 1, vacationDays: 1 }).sort({ name: 1 }).lean(),
    TimeOffModel.find({
      startDate: { $lte: yearEnd },
      endDate: { $gte: yearStart },
      status: "confirmed",
    }).lean(),
    getLeaveTypes(),
    RoleModel.find({}, { slug: 1, name: 1 }).lean(),
  ]);

  const roleMap = new Map<string, string>();
  for (const r of roleDocs) roleMap.set(r.slug as string, r.name as string);

  // Group time-off entries by user
  const entriesByUser = new Map<string, TimeOffEntry[]>();
  for (const d of timeOffDocs) {
    const uid = (d.userId as mongoose.Types.ObjectId).toString();
    const entry: TimeOffEntry = {
      id: d._id.toString(),
      userId: uid,
      startDate: d.startDate,
      endDate: d.endDate,
      startDayPortion: d.startDayPortion,
      endDayPortion: d.endDayPortion,
      leaveTypeSlug: d.leaveTypeSlug,
      status: d.status,
      createdById: (d.createdById as mongoose.Types.ObjectId).toString(),
      createdByName: d.createdByName,
    };
    if (!entriesByUser.has(uid)) entriesByUser.set(uid, []);
    entriesByUser.get(uid)!.push(entry);
  }

  // Find which leave types count against allowance
  const countingSlugs = new Set(leaveTypes.filter((lt) => lt.countsAgainstAllowance).map((lt) => lt.slug));

  return userDocs.map((u) => {
    const uid = u._id.toString();
    const entries = entriesByUser.get(uid) ?? [];
    const usedByType = calculateDaysUsed(entries);
    const allowance = (u.vacationDays as number) ?? 0;

    // Sum only leave types that count against allowance
    let countingUsed = 0;
    for (const [slug, days] of Object.entries(usedByType)) {
      if (countingSlugs.has(slug)) countingUsed += days;
    }

    return {
      userId: uid,
      name: (u.name as string) ?? "",
      image: (u.image as string) ?? null,
      role: roleMap.get(u.role as string) ?? (u.role as string) ?? "",
      allowance,
      usedByType,
      remaining: allowance - countingUsed,
    };
  });
});

// ── Week Team Data (dashboard) ─────────────────────────────────────

export async function getWeekTeamData(start: string, end: string): Promise<WeekTeamData> {
  await connectDB();

  const [timeOffDocs, holidayDocs, userDocs, leaveTypes] = await Promise.all([
    TimeOffModel.find({
      startDate: { $lte: end },
      endDate: { $gte: start },
      status: "confirmed",
    }).lean(),
    CompanyHolidayModel.find({
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 }).lean(),
    UserModel.find({ status: "active" }, { _id: 1, name: 1, image: 1, dateOfBirth: 1 }).sort({ name: 1 }).lean(),
    getLeaveTypes(),
  ]);

  // Build user map for enriching time-off entries
  const userMap = new Map<string, { name: string; image: string | null }>();
  for (const u of userDocs) {
    userMap.set(u._id.toString(), { name: (u.name as string) ?? "", image: (u.image as string) ?? null });
  }

  const timeOff: TimeOffEntry[] = timeOffDocs.map((d) => {
    const uid = (d.userId as mongoose.Types.ObjectId).toString();
    const user = userMap.get(uid);
    return {
      id: d._id.toString(),
      userId: uid,
      userName: user?.name,
      userImage: user?.image ?? undefined,
      startDate: d.startDate,
      endDate: d.endDate,
      startDayPortion: d.startDayPortion,
      endDayPortion: d.endDayPortion,
      leaveTypeSlug: d.leaveTypeSlug,
      notes: d.notes,
      status: d.status,
      createdById: (d.createdById as mongoose.Types.ObjectId).toString(),
      createdByName: d.createdByName,
      createdAt: d.createdAt?.toISOString().split("T")[0],
    };
  });

  const companyHolidays: CompanyHoliday[] = holidayDocs.map((d) => ({
    id: d._id.toString(),
    date: d.date,
    label: d.label,
  }));

  // Find birthdays that fall within the week (match month+day)
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const birthdays: BirthdayItem[] = [];

  for (const u of userDocs) {
    if (!u.dateOfBirth) continue;
    const dob = u.dateOfBirth as Date;
    // Check each day in the week range for a birthday match
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      if (cursor.getMonth() === dob.getMonth() && cursor.getDate() === dob.getDate()) {
        const dateStr = cursor.toISOString().split("T")[0];
        birthdays.push({
          userId: u._id.toString(),
          userName: (u.name as string) ?? "",
          userImage: (u.image as string) ?? null,
          date: dateStr,
        });
        break;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return { timeOff, companyHolidays, birthdays, leaveTypes };
}
