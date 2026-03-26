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
import type { Archetype, Client, DashboardStats, Log, LogSignal, Project, ProjectTemplate, Service, Sheet } from "@/types";

function mapClient(doc: ReturnType<typeof Object.assign>, archetypeMap?: Map<string, string>): Client {
  return {
    id: doc._id.toString(),
    company: doc.company,
    status: doc.status,
    platform: doc.platform,
    clientSince: doc.clientSince,
    employees: doc.employees,
    website: doc.website,
    description: doc.description,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
    archetypeId: doc.archetypeId ?? undefined,
    archetype: doc.archetypeId && archetypeMap ? archetypeMap.get(doc.archetypeId) : undefined,
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
  const [docs, imageMap, archetypeMap] = await Promise.all([
    ClientModel.find().sort({ createdAt: -1 }).lean(),
    buildUserImageMap(),
    buildArchetypeMap(),
  ]);
  return docs.map((doc) => {
    const client = mapClient(doc, archetypeMap);
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
  const [doc, archetypeMap] = await Promise.all([
    ClientModel.findById(id).lean(),
    buildArchetypeMap(),
  ]);
  if (!doc) return undefined;
  return mapClient(doc, archetypeMap);
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

function mapProject(doc: ReturnType<typeof Object.assign>, serviceMap?: Map<string, string>): Project {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    deliveryDate: doc.deliveryDate,
    soldPrice: doc.soldPrice,
    templateId: doc.templateId,
    serviceId: doc.serviceId ?? undefined,
    service: doc.serviceId && serviceMap ? serviceMap.get(doc.serviceId) : undefined,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  };
}

export async function getProjectsByClientId(clientId: string): Promise<Project[]> {
  await connectDB();
  const [docs, serviceMap] = await Promise.all([
    ProjectModel.find({ clientId }).sort({ createdAt: -1 }).lean(),
    buildServiceMap(),
  ]);
  return docs.map((doc) => mapProject(doc, serviceMap));
}

export const getProjectById = cache(async (projectId: string): Promise<Project | null> => {
  await connectDB();
  const [doc, serviceMap] = await Promise.all([
    ProjectModel.findById(projectId).lean(),
    buildServiceMap(),
  ]);
  if (!doc) return null;
  return mapProject(doc, serviceMap);
});

export async function getServices(): Promise<Service[]> {
  const docs = await fetchServiceDocs();
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    rank: d.rank ?? 0,
    createdAt: d.createdAt?.toISOString().split("T")[0],
  }));
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
    contactId: doc.contactId ?? undefined,
    date: doc.date,
    summary: doc.summary,
    signalIds: doc.signalIds ?? [],
    signals: (doc.signalIds ?? []).map((sid: string) => signalMap.get(sid) ?? sid),
    followUp: doc.followUp ?? false,
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
