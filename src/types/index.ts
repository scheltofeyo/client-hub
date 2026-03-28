export type ClientStatus = "active" | "inactive" | "prospect";
export type ClientPlatform = "summ_core" | "summ_suite";

export interface Archetype {
  id: string;
  name: string;
  rank: number;
  createdAt?: string;
}

export interface Service {
  id: string;
  name: string;
  rank: number;
  createdAt?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface ClientLead {
  userId: string;
  name: string;
  email: string;
  image?: string;
}

export interface Client {
  id: string;
  company: string;
  status?: ClientStatus;
  projects?: Project[];
  createdAt?: string;
  employees?: number;
  website?: string;
  description?: string;
  contacts?: Contact[];
  leads?: ClientLead[];
  platform?: ClientPlatform;
  clientSince?: string;
  archetypeId?: string;
  archetype?: string;
}

export type ProjectStatus = "not_started" | "in_progress" | "completed";

export interface Project {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  completedDate?: string;
  soldPrice?: number;
  templateId?: string;
  serviceId?: string;
  service?: string;
  createdAt?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  defaultDescription?: string;
  defaultSoldPrice?: number;
  defaultServiceId?: string;
  taskCount?: number;
  createdAt?: string;
}

export interface TemplateTask {
  id: string;
  templateId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  assignToClientLead: boolean;
  order: number;
  createdAt?: string;
}

export interface LogSignal {
  id: string;
  name: string;
  rank: number;
  createdAt?: string;
}

export interface Log {
  id: string;
  clientId: string;
  contactId?: string; // legacy
  contactIds: string[];
  date: string;
  summary: string;
  signalIds: string[];
  signals?: string[];
  followUp: boolean;
  followUpDeadline?: string;
  followedUpAt?: string;
  followedUpByName?: string;
  createdById: string;
  createdByName: string;
  createdAt?: string;
}

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalProjects: number;
  activeProjects: number;
}

export interface Sheet {
  id: string;
  clientId: string;
  name: string;
  url: string;
  createdAt?: string;
}

export interface TaskAssignee {
  userId: string;
  name: string;
  image?: string;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  assignees: TaskAssignee[];
  completionDate?: string;
  completedAt?: string;
  completedById?: string;
  completedByName?: string;
  createdById: string;
  createdByName: string;
  createdAt?: string;
}
