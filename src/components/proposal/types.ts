/** Shared types for the public proposal projects section + its display variants. */

export interface TeamMember {
  userId: string;
  name: string;
  image?: string;
  roleLabel?: string | null;
  projectCount?: number;
}

export interface ProposalSession {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  info: string | null;
  participantCount: number;
}

export interface ProposalProject {
  id: string;
  title: string;
  service: string | null;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  durationDays: number | null;
  /** Gross price; the discount fields below derive the client-facing net. */
  soldPrice: number;
  discountType: "percentage" | "amount" | null;
  discountValue: number | null;
  discountAmount: number;
  netPrice: number;
  sections: {
    why: string | null;
    how: string | null;
    what: string | null;
    activities: string | null;
    deliverables: string | null;
  };
  team: TeamMember[];
  sessions: ProposalSession[];
}
