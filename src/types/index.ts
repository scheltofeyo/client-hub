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

export type ProjectStatus = "planning" | "in_progress" | "review" | "completed" | "on_hold";

export interface Project {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  deliveryDate?: string;
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
  contactId?: string;
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
