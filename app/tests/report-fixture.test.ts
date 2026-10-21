import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { calculateReport } from "../src/components/lead-sale/domain";
import type { Database, Member } from "../src/components/lead-sale/types";
const fixture = JSON.parse(
  readFileSync("../docs/design/fixtures/report-cases.json", "utf8"),
);
const db: Database = {
  version: 1,
  audit: [],
  receptions: [],
  reviews: [],
  notices: [],
  activities: [],
  members: fixture.members.map((m: any) => ({
    id: m.id,
    name: m.id,
    role: "telesale",
    active: true,
    teamId: m.team_id,
  })),
  sources: fixture.sources.map((id: string) => ({
    id,
    name: id,
    active: true,
  })),
  leads: fixture.leads.map((l: any, i: number) => ({
    id: l.id,
    name: l.id,
    phone: "090000000" + i,
    city: "Hà Nội",
    vehicle: "Motorbike",
    sourceId: l.source,
    status: l.status,
    receivedAt: l.first_received_at,
    updatedAt: l.first_received_at,
    archived: !!l.archived_at,
    tags: [],
    note: "",
    activatedAt: l.activated_at ?? undefined,
    onboardedAt: l.onboarded_at ?? undefined,
  })),
  assignments: fixture.assignments.map((t: any) => ({
    id: t.id,
    leadId: t.lead_id,
    assigneeId: t.assignee_id,
    teamId: t.team_id,
    createdAt: t.created_at,
    updatedAt: t.created_at,
    expiresAt: t.expires_at,
    status: t.status,
    assignedBy: "admin",
    closeReason: "",
  })),
  appointments: fixture.appointments.map((a: any) => ({
    id: a.id,
    leadId: a.lead_id,
    assignmentId: a.assignment_id,
    activityId: "fixture",
    actorId: "fixture",
    at: a.scheduled_at,
    status: a.status,
    place: "Hà Nội",
  })),
};
describe("KPI acceptance fixture", () => {
  for (const c of fixture.cases)
    it(c.id, () => {
      const actor: Member = {
        id: "report-actor",
        name: "Report",
        role: c.filters.team_id ? "leader" : "admin",
        teamId: c.filters.team_id,
        active: true,
      };
      const filters = {
        from: c.filters.from_date,
        to: c.filters.to_date,
        source: c.filters.source,
        member: c.filters.assignee_id,
      };
      if (c.expected.error) {
        expect(() =>
          calculateReport(db, actor, filters, new Date(fixture.as_of)),
        ).toThrow();
        return;
      }
      const report = calculateReport(
        db,
        actor,
        filters,
        new Date(fixture.as_of),
      );
      for (const key of ["total", "registered", "onboarded", "overdue"])
        expect(report[key as keyof typeof report]).toBe(c.expected[key]);
      expect(report.newToday).toBe(c.expected.new_today);
    });
});
