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
import type { Archetype, Client, ClientPlatformOption, ClientStatusOption, DashboardStats, EventType, Log, LogSignal, Project, ProjectLabel, ProjectTemplate, RecurrenceFrequency, Service, Sheet, Task, TemplateTask, TimelineEvent } from "@/types";

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

function nextOccurrenceDate(dateStr: string, recurrence: RecurrenceFrequency): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  let next: Date;
  switch (recurrence) {
    case "weekly":    next = new Date(y, m - 1, d + 7);  break;
    case "biweekly":  next = new Date(y, m - 1, d + 14); break;
    case "monthly":   next = new Date(y, m,     d);      break;
    case "quarterly": next = new Date(y, m + 2, d);      break;
    case "yearly":    next = new Date(y + 1, m - 1, d);  break;
    default:          return dateStr;
  }
  return next.toISOString().slice(0, 10);
}

function expandOccurrences(
  baseDate: string,
  recurrence: RecurrenceFrequency,
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
    const next = nextOccurrenceDate(current, recurrence);
    if (next <= current) break;
    current = next;
  }
  return occurrences;
}

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
      const recurrence = (doc.recurrence ?? "none") as RecurrenceFrequency;
      const docId = doc._id.toString();
      if (recurrence === "none") {
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
          recurrence: "none" as const,
        }] as TimelineEvent[];
      }
      return expandOccurrences(doc.date, recurrence, today, windowEnd, doc.repetitions as number | null).map(
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
          recurrence,
          repetitions: (doc.repetitions as number | undefined) ?? undefined,
        })
      );
    }),
  ];

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
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
    const recurrence = (doc.recurrence ?? "none") as RecurrenceFrequency;
    const cid = (doc.clientId as string).toString();
    if (recurrence === "none") {
      if ((doc.date as string) >= today) {
        add(cid, { date: doc.date as string, title: doc.title as string, source: "custom" });
      }
    } else {
      const occurrences = expandOccurrences(doc.date as string, recurrence, today, windowEnd, doc.repetitions as number | null);
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
