export type Role = "admin" | "intake" | "leader" | "telesale" | "viewer";
export type LeadStatus = "New" | "Activated" | "Onboarded" | "Closed";
export type TicketStatus = "New" | "Open" | "Solved" | "Closed";
export type Outcome =
  | "activated"
  | "called"
  | "no_answer"
  | "unresponsive"
  | "overdue"
  | "wrong_phone";
export type Decision = "none" | "agreed" | "declined" | "hungup";
export type Reason = "none" | "no_need" | "busy" | "ineligible";
export interface Member {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  teamId?: string;
  email?: string;
}
export interface Source {
  id: string;
  name: string;
  active: boolean;
}
/** Extended driver profile (BA X-01). Every field optional; stored as jsonb. */
export interface LeadProfile {
  birthYear?: string;
  gender?: "male" | "female" | "";
  district?: string;
  vehicleDetail?: string;
  hasVehicle?: "yes" | "no" | "";
  otherApps?: string[];
  referrer?: string;
  campaign?: string;
  callTime?: "morning" | "afternoon" | "evening" | "any" | "";
  idNumber?: string;
  documents?: { cccd?: boolean; license?: boolean; registration?: boolean };
}
export interface Lead {
  wrongPhone?: boolean;
  id: string;
  name: string;
  phone: string;
  city: string;
  vehicle: "Motorbike" | "Van";
  sourceId: string;
  status: LeadStatus;
  receivedAt: string;
  updatedAt: string;
  tags: string[];
  note: string;
  archived: boolean;
  profile?: LeadProfile;
  activatedAt?: string;
  onboardedAt?: string;
  version?: number;
  externalDriverId?: string;
  coreSource?: string;
  activatedSource?: string;
  activatedEventId?: string;
  activatedReceivedAt?: string;
  onboardedSource?: string;
  onboardedEventId?: string;
  onboardedReceivedAt?: string;
  firstOrderId?: string;
  milestoneSource?: string;
  milestoneRecordedAt?: string;
  coreCorrectionAt?: string;
  correctionReason?: string;
}
export interface Assignment {
  leadSnapshot?: Partial<Lead>;
  sequence?: number;
  id: string;
  leadId: string;
  assigneeId: string;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  status: TicketStatus;
  closeReason: string;
  teamId?: string;
  acceptedAt?: string;
  round?: number;
  previousId?: string;
  version?: number;
  /** Next follow-up call agreed with the driver (BA X-03, BR-61). */
  nextCallAt?: string;
}
export interface Activity {
  id: string;
  leadId: string;
  assignmentId: string;
  actorId: string;
  channel: "call" | "zalo";
  at: string;
  outcome: Outcome;
  decision: Decision;
  reason: Reason;
  note: string;
  round?: number;
  appointmentId?: string;
  attachments?: Attachment[];
  voidedAt?: string;
  voidReason?: string;
  direction?: "outbound" | "inbound";
  durationSeconds?: number;
}
export interface Attachment {
  dataUrl?: string;
  path: string;
  name: string;
  type: string;
  size: number;
}
export interface Appointment {
  id: string;
  leadId: string;
  assignmentId: string;
  activityId: string;
  actorId: string;
  at: string;
  place: string;
  status:
    | "scheduled"
    | "waiting"
    | "succeeded"
    | "failed"
    | "attended"
    | "missed"
    | "cancelled";
  round?: number;
  createdAt?: string;
  resultAt?: string;
  resultCutoff?: string;
  resultReason?: string;
  resultHistory?: { status: string; at: string; reason: string }[];
  previousId?: string;
}
export interface Reception {
  note?: string;
  id: string;
  leadId: string;
  sourceId: string;
  at: string;
  actorId: string;
}
export interface ClosureReview {
  version?: number;
  id: string;
  assignmentId: string;
  leadId: string;
  at: string;
  reason: string;
  reviewedAt?: string;
  reviewedBy?: string;
  result?: string;
  note?: string;
}
export interface Notice {
  href?: string;
  id: string;
  recipientId: string;
  at: string;
  title: string;
  readAt?: string;
}
export interface ReportFilters {
  city?: string;
  from?: string;
  to?: string;
  source?: string;
  status?: string;
  member?: string;
}
export interface ReportData {
  analytics?: Analytics;
  total: number;
  registered: number;
  onboarded: number;
  overdue: number;
  newToday: number;
  bySource: { id: string; total: number; registered: number }[];
  byStatus: Record<string, number>;
  byMember: { id: string; total: number; registered: number }[];
}
export interface AuditLog {
  id: string;
  at: string;
  actorId: string;
  action: string;
  target: string;
  detail: string;
}
export interface Database {
  analytics?: Analytics;
  version: 1;
  leads: Lead[];
  assignments: Assignment[];
  activities: Activity[];
  appointments: Appointment[];
  members: Member[];
  sources: Source[];
  audit: AuditLog[];
  receptions: Reception[];
  reviews: ClosureReview[];
  notices: Notice[];
  report?: ReportData;
  teams?: { id: string; name: string }[];
  statusCatalog?: { code: string; label: string }[];
}
export type LeadInput = Pick<
  Lead,
  "name" | "phone" | "city" | "vehicle" | "sourceId" | "tags" | "note"
> & { receivedAt?: string; profile?: LeadProfile };
export type ActivityInput = Pick<
  Activity,
  "channel" | "at" | "outcome" | "decision" | "reason" | "note"
> & {
  direction?: "outbound" | "inbound";
  durationSeconds?: number;
  appointmentAt?: string;
  place?: string;
  nextCallAt?: string;
  attachments?: Attachment[];
  ticketStatus?: TicketStatus;
};
export interface Analytics {
  performance: {
    id: string;
    total: number;
    New: number;
    Open: number;
    Solved: number;
    Closed: number;
    called: number;
    no_answer: number;
    wrong_phone: number;
    agreed: number;
    declined: number;
    hungup: number;
    assignedLeads: number;
    converted: number;
    backlog: number;
  }[];
  conversion: {
    id: string;
    total: number;
    agreed: number;
    registered: number;
    onboarded: number;
  }[];
  conversionDetails: {
    memberId: string;
    sourceId: string;
    city: string;
    total: number;
    agreed: number;
    registered: number;
    onboarded: number;
  }[];
  sources: {
    id: string;
    total: number;
    New: number;
    Activated: number;
    Onboarded: number;
    Closed: number;
    wrongPhone: number;
  }[];
  totals: {
    total: number;
    agreed: number;
    registered: number;
    onboarded: number;
    unassigned: number;
    reviewPending: number;
    consulting: number;
  };
}
export type Command =
  | { type: "memberCreate"; name: string; email: string }
  | { type: "reconcileAppointment"; id: string; reason: string }
  | { type: "memberProfile"; id: string; name: string; email: string }
  | { type: "saveLead"; id?: string; input: LeadInput }
  | { type: "leadNote"; id: string; note: string }
  | {
      type: "leadStatus";
      id: string;
      status: LeadStatus;
      reason: string;
      occurredAt?: string;
    }
  | { type: "archiveLead"; id: string }
  | { type: "receiveLead"; id: string; sourceId: string; reason: string }
  | {
      type: "correctMilestone";
      id: string;
      status: LeadStatus;
      reason: string;
      activatedAt?: string;
      onboardedAt?: string;
    }
  | { type: "voidActivity"; id: string; reason: string }
  | {
      type: "correctAppointment";
      id: string;
      status: Appointment["status"];
      reason: string;
    }
  | { type: "assign"; leadId: string; assigneeId: string; transfer?: boolean }
  | { type: "accept"; id: string }
  | { type: "followUp"; id: string; at: string | null }
  | { type: "ticketStatus"; id: string; status: TicketStatus; reason: string }
  | { type: "activity"; assignmentId: string; input: ActivityInput }
  | { type: "appointment"; id: string; status: Appointment["status"] }
  | { type: "reschedule"; id: string; at: string; place: string }
  | { type: "review"; id: string; note: string; result?: string }
  | {
      type: "amendReview";
      id: string;
      note: string;
      result: string;
      reason: string;
    }
  | { type: "noticeRead"; id: string }
  | { type: "attachment"; activityId: string; attachment: Attachment }
  | { type: "source"; name: string; id?: string; active?: boolean }
  | { type: "team"; name: string }
  | { type: "statusLabel"; code: LeadStatus; label: string }
  | { type: "member"; id: string; role: Role; active: boolean; teamId?: string }
  | { type: "expire" };
