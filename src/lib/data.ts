import { connectDB } from "./mongodb";
import { ClientModel } from "./models/Client";
import { UserModel } from "./models/User";
import { ProjectModel } from "./models/Project";
import { ProjectTemplateModel } from "./models/ProjectTemplate";
import type { Client, DashboardStats, Project, ProjectTemplate } from "@/types";

function mapClient(doc: ReturnType<typeof Object.assign>): Client {
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
  const [docs, imageMap] = await Promise.all([
    ClientModel.find().sort({ createdAt: -1 }).lean(),
    buildUserImageMap(),
  ]);
  return docs.map((doc) => {
    const client = mapClient(doc);
    if (client.leads) {
      client.leads = client.leads.map((l) => ({
        ...l,
        image: imageMap.get(l.userId),
      }));
    }
    return client;
  });
}

export async function getClientById(id: string): Promise<Client | undefined> {
  await connectDB();
  const doc = await ClientModel.findById(id).lean();
  if (!doc) return undefined;
  return mapClient(doc);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await connectDB();
  const totalClients = await ClientModel.countDocuments();
  const activeClients = await ClientModel.countDocuments({ status: "active" });
  const totalProjects = await ProjectModel.countDocuments();
  const activeProjects = await ProjectModel.countDocuments({ status: "in_progress" });
  return { totalClients, activeClients, totalProjects, activeProjects };
}

function mapProject(doc: ReturnType<typeof Object.assign>): Project {
  return {
    id: doc._id.toString(),
    clientId: doc.clientId,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    deliveryDate: doc.deliveryDate,
    soldPrice: doc.soldPrice,
    templateId: doc.templateId,
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  };
}

export async function getProjectsByClientId(clientId: string): Promise<Project[]> {
  await connectDB();
  const docs = await ProjectModel.find({ clientId }).sort({ createdAt: -1 }).lean();
  return docs.map(mapProject);
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  await connectDB();
  const doc = await ProjectModel.findById(projectId).lean();
  if (!doc) return null;
  return mapProject(doc);
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
    createdAt: doc.createdAt?.toISOString().split("T")[0],
  }));
}
