export type Role = "admin" | "intake" | "leader" | "telesale" | "viewer";
export type LeadStatus = "New" | "Activated" | "Onboarded" | "Closed";
export type TicketStatus = "New" | "Open" | "Solved" | "Closed";
export type Outcome = "called" | "no_answer" | "overdue" | "wrong_phone";
export type Decision = "none" | "agreed" | "declined" | "hungup";
export type Reason = "none" | "no_need" | "busy" | "ineligible";
export interface Member {
  id: string;
  name: string;
  role: Role;
  active: boolean;
}
export interface Source {
  id: string;
  name: string;
  active: boolean;
}
export interface Lead {
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
}
export interface Assignment {
  id: string;
  leadId: string;
  assigneeId: string;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  status: TicketStatus;
  closeReason: string;
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
}
export interface Appointment {
  id: string;
  leadId: string;
  assignmentId: string;
  activityId: string;
  actorId: string;
  at: string;
  place: string;
  status: "scheduled" | "attended" | "missed" | "cancelled";
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
  version: 1;
  leads: Lead[];
  assignments: Assignment[];
  activities: Activity[];
  appointments: Appointment[];
  members: Member[];
  sources: Source[];
  audit: AuditLog[];
}
export type LeadInput = Pick<
  Lead,
  "name" | "phone" | "city" | "vehicle" | "sourceId" | "tags" | "note"
>;
export type ActivityInput = Pick<
  Activity,
  "channel" | "at" | "outcome" | "decision" | "reason" | "note"
> & { appointmentAt?: string; place?: string };
export type Command =
  | { type: "saveLead"; id?: string; input: LeadInput }
  | { type: "leadStatus"; id: string; status: LeadStatus; reason: string }
  | { type: "archiveLead"; id: string }
  | { type: "assign"; leadId: string; assigneeId: string; transfer?: boolean }
  | { type: "ticketStatus"; id: string; status: TicketStatus; reason: string }
  | { type: "activity"; assignmentId: string; input: ActivityInput }
  | { type: "appointment"; id: string; status: Appointment["status"] }
  | { type: "source"; name: string; id?: string; active?: boolean }
  | { type: "member"; id: string; role: Role; active: boolean }
  | { type: "expire" };
