import { describe, it, expect } from "vitest";
import { makeSeed } from "./seed";
import { applyCommand } from "./domain";
import { needsRebooking, settleAppointments, resultDeadline } from "./workflow";
import { calculateAnalytics } from "./analytics";
import { routeAllowed } from "./access";
function fixture() {
  const db = makeSeed(new Date("2026-10-24T01:00:00Z"));
  db.appointments = [
    {
      id: "AP",
      assignmentId: db.assignments[0].id,
      leadId: db.leads[0].id,
      actorId: "sale-1",
      activityId: "a",
      at: "2026-10-24T03:00:00Z",
      place: "văn phòng HN1",
      status: "scheduled",
      round: 1,
    },
  ];
  db.activities = [];
  return db;
}
describe("Reviewed boundaries", () => {
  it("00:00 creates a task queue entry; 08:00 alone creates a failed result", () => {
    const db = fixture();
    const t = db.assignments[0];
    settleAppointments(db, new Date("2026-10-24T03:01:00Z"));
    expect(db.appointments[0].status).toBe("waiting");
    expect(needsRebooking(db, t, new Date("2026-10-24T16:59:59Z"))).toBe(false);
    expect(needsRebooking(db, t, new Date("2026-10-24T17:00:00Z"))).toBe(true);
    settleAppointments(db, new Date("2026-10-25T00:59:59Z"));
    expect(db.activities).toHaveLength(0);
    settleAppointments(db, new Date("2026-10-25T01:00:00Z"));
    settleAppointments(db, new Date("2026-10-26T01:00:00Z"));
    expect(db.appointments[0].status).toBe("failed");
    expect(db.activities).toHaveLength(1);
    expect(resultDeadline(db.appointments[0].at)).toBe(
      Date.parse("2026-10-25T01:00:00Z"),
    );
  });
  it("registration on appointment day succeeds; pre-existing registration does not", () => {
    const db = fixture();
    db.leads[0].activatedAt = "2026-10-24T05:00:00Z";
    settleAppointments(db, new Date("2026-10-25T01:00:00Z"));
    expect(db.appointments[0].status).toBe("succeeded");
    const other = fixture();
    other.leads[0].activatedAt = "2026-10-23T05:00:00Z";
    settleAppointments(other, new Date("2026-10-25T01:00:00Z"));
    expect(other.appointments[0].status).toBe("failed");
  });
  it("cancelled schedules never reappear, and a replacement removes the old rebooking flag", () => {
    const db = fixture();
    db.appointments[0].status = "cancelled";
    settleAppointments(db, new Date("2026-10-25T01:00:00Z"));
    expect(db.appointments[0].status).toBe("cancelled");
    db.appointments[0].status = "failed";
    db.appointments.push({
      ...db.appointments[0],
      id: "AP2",
      previousId: "AP",
      status: "scheduled",
      at: "2026-10-26T03:00:00Z",
    });
    expect(
      needsRebooking(db, db.assignments[0], new Date("2026-10-25T02:00:00Z")),
    ).toBe(false);
  });
  it("preserves pending results when the ticket reaches its 14-day expiry", () => {
    const db = fixture();
    db.assignments[0].expiresAt = "2026-10-24T04:00:00Z";
    const next = applyCommand(
      db,
      "sale-1",
      { type: "expire" },
      new Date("2026-10-25T01:00:00Z"),
    );
    expect(next.assignments[0].status).toBe("Closed");
    expect(next.appointments[0].status).toBe("failed");
  });
  it("Admin and Telesale direct routes enforce the approved matrix", () => {
    for (const path of [
      "/leads",
      "/dispatch",
      "/tasks",
      "/appointments",
      "/inbox",
      "/handover",
    ]) {
      expect(routeAllowed("admin", path)).toBe(false);
    }
    expect(routeAllowed("admin", "/admin/users")).toBe(true);
    expect(routeAllowed("admin", "/reports")).toBe(false);
    expect(routeAllowed("telesale", "/reports")).toBe(false);
    expect(routeAllowed("leader", "/reports")).toBe(true);
    expect(routeAllowed("intake", "/reports")).toBe(true);
    expect(routeAllowed("viewer", "/reports")).toBe(true);
    expect(routeAllowed("intake", "/tasks")).toBe(false);
    expect(routeAllowed("intake", "/appointments")).toBe(true);
  });
  it("deduplicates Leads across transferred tickets and credits onboarding only once", () => {
    const db = fixture();
    const old = db.assignments[0];
    old.createdAt = "2026-10-20T01:00:00Z";
    old.status = "Closed";
    db.assignments.push({
      ...old,
      id: "new",
      sequence: 100,
      assigneeId: "sale-2",
      createdAt: "2026-10-23T01:00:00Z",
      status: "Solved",
    });
    db.leads[0].activatedAt = "2026-10-23T05:00:00Z";
    db.leads[0].onboardedAt = "2026-10-24T05:00:00Z";
    db.leads[0].status = "Onboarded";
    const a = calculateAnalytics(
      db,
      db.members.find((m) => m.id === "leader")!,
      { source: db.leads[0].sourceId },
    );
    expect(a.performance.find((p) => p.id === "sale-1")!.converted).toBe(0);
    expect(a.performance.find((p) => p.id === "sale-2")!.converted).toBe(1);
    expect(a.conversion.reduce((n, r) => n + r.onboarded, 0)).toBe(1);
  });
});
