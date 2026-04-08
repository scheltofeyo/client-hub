export type ClientStatus = string;

export interface ClientStatusOption {
  id: string;
  slug: string;
  label: string;
  rank: number;
  checkInDays?: number | null;
  createdAt?: string;
}

export interface EventType {
  id: string;
  slug: string;
  label: string;
  color: string;
  icon: string;
  rank: number;
}
export type ClientPlatform = string;

export interface ClientPlatformOption {
  id: string;
  slug: string;
  label: string;
  rank: number;
  createdAt?: string;
}

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
  checkInDays?: number | null;
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
  platformLabel?: string;
  clientSince?: string;
  archetypeId?: string;
  archetype?: string;
  folderStatus?: "pending" | "ready";
}

export type ProjectStatus = "not_started" | "in_progress" | "completed";

export interface Project {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  completedDate?: string;
  deliveryDate?: string;
  soldPrice?: number;
  templateId?: string;
  serviceId?: string;
  service?: string;
  labelId?: string;
  label?: string;
  kickedOffAt?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  createdAt?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  defaultDescription?: string;
  defaultSoldPrice?: number;
  defaultServiceId?: string;
  defaultDeliveryDays?: number;
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

export interface ProjectLabel {
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
  serviceId?: string;
  signals?: string[];
  followUp: boolean;
  followUpAction?: string;
  followUpDeadline?: string;
  followedUpAt?: string;
  followedUpByName?: string;
  isSystemGenerated?: boolean;
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
  clientId?: string;
  projectId?: string;
  parentTaskId?: string;
  logId?: string;
  title: string;
  description?: string;
  assignees: TaskAssignee[];
  completionDate?: string;
  completedAt?: string;
  completedById?: string;
  completedByName?: string;
  order?: number;
  createdById: string;
  createdByName: string;
  createdAt?: string;
}

export type ClientEventType = string;
export type TimelineEventSource = "log_followup" | "task" | "project" | "custom";
export type TimelineEventType = string;
export type RecurrenceUnit = "days" | "weeks" | "months" | "years";
/** @deprecated kept for backward compat with old ClientEvent docs */
export type RecurrenceFrequency = "none" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export interface TimelineEvent {
  id: string;
  date: string;         // occurrence date (may differ from baseDate for recurring events)
  baseDate?: string;    // the DB start date, only set for recurring custom events
  title: string;
  type: TimelineEventType;
  source: TimelineEventSource;
  sourceId: string;
  projectId?: string;
  notes?: string;
  deletable: boolean;
  recurrenceInterval?: number;  // e.g. 2
  recurrenceUnit?: RecurrenceUnit; // e.g. "weeks" → "every 2 weeks"
  /** @deprecated old format, kept for backward compat */
  recurrence?: RecurrenceFrequency;
  repetitions?: number; // total occurrences; undefined = unlimited
}

export interface ReleaseNote {
  date: string;       // YYYY-MM-DD
  title: string;
  details?: string[];
}
