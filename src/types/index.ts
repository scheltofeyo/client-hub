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

export interface CulturalBehavior {
  level: string;
  content: string;
}

export interface CulturalDnaValue {
  id: string;
  title: string;
  color: string;
  mantra: string;
  description: string;
  behaviors?: CulturalBehavior[];
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
  primaryColor?: string;
  contacts?: Contact[];
  leads?: ClientLead[];
  culturalDna?: CulturalDnaValue[];
  culturalLevels?: string[];
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

export interface MyProjectOverview {
  projectId: string;
  projectTitle: string;
  clientId: string;
  clientName: string;
  clientPrimaryColor?: string;
  status: ProjectStatus;
  taskTotal: number;
  taskCompleted: number;
  nextDeadline?: string;
  deliveryDate?: string;
}

export interface MyDayUserInfo {
  name: string;
  image: string | null;
  email: string;
  roleName: string;
  activeClientCount: number;
  activeProjectCount: number;
  openTaskCount: number;
  openFollowUpCount: number;
}

export interface MyDayTaskData {
  tasks: (Task & { clientName: string; clientPrimaryColor?: string; projectName?: string })[];
  subtasksByParent: Record<string, Task[]>;
  userImages: Record<string, string>;
}

export interface MyDayFollowUpData {
  logs: (Log & { clientName: string; clientPrimaryColor?: string; signals?: string[] })[];
  contactsByClient: Record<string, Contact[]>;
  signals: LogSignal[];
}

export interface ReleaseNote {
  date: string;       // YYYY-MM-DD
  title: string;
  details?: string[];
}

// ── Team / Holiday Calendar ─────────────────────────────────────────

export interface LeaveType {
  id: string;
  slug: string;
  label: string;
  color: string;
  icon: string;
  rank: number;
  countsAgainstAllowance: boolean;
}

export type DayPortion = "full" | "am" | "pm";

export interface TimeOffEntry {
  id: string;
  userId: string;
  userName?: string;
  userImage?: string;
  startDate: string;
  endDate: string;
  startDayPortion: DayPortion;
  endDayPortion: DayPortion;
  leaveTypeSlug: string;
  notes?: string;
  status: string;
  createdById: string;
  createdByName: string;
  createdAt?: string;
}

export interface TimeOffBalance {
  userId: string;
  name: string;
  image: string | null;
  role: string;
  allowance: number;
  usedByType: Record<string, number>;
  remaining: number;
}

export interface CompanyHoliday {
  id: string;
  date: string;
  label: string;
}

// ── Week Team Data (dashboard) ─────────────────────────────────────

export interface BirthdayItem {
  userId: string;
  userName: string;
  userImage: string | null;
  date: string; // YYYY-MM-DD of the birthday this week
}

export interface WeekTeamData {
  timeOff: TimeOffEntry[];
  companyHolidays: CompanyHoliday[];
  birthdays: BirthdayItem[];
  leaveTypes: LeaveType[];
}
