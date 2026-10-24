import { canReadLead, counts, isPending } from "./domain";
import { serverNow } from "./dates";
import { needsRebooking } from "./workflow";
import type { Assignment, Database, Member } from "./types";

// Sub-queues of "Nhiệm vụ" (BA §6.6, BR-50). Counts are tickets and may overlap.
export const taskGroups = [
  { id: "pending", name: "Phiếu chưa giải quyết" },
  { id: "unaccepted", name: "Chưa nhận việc", child: true },
  { id: "new", name: "Chưa liên hệ", child: true },
  { id: "agreed", name: "Đồng ý đăng ký" },
  { id: "no_answer", name: "Không nghe máy" },
  { id: "no_answer_1", name: "Không nghe lần 1", child: true },
  { id: "no_answer_2", name: "Không nghe lần 2", child: true },
  { id: "overdue", name: "Cần hẹn lại" },
  { id: "overdue_1", name: "Cần hẹn lại lần 1", child: true },
  { id: "overdue_2", name: "Cần hẹn lại lần 2", child: true },
  { id: "overdue_3", name: "Cần hẹn lại lần 3", child: true },
  { id: "recent", name: "Cập nhật gần đây", divider: true },
  { id: "solved", name: "Đã giải quyết" },
  { id: "closed", name: "Phiếu đã đóng" },
] as const;
export type TaskGroup = (typeof taskGroups)[number]["id"];

export function visibleTickets(db: Database, actor: Member) {
  return db.assignments.filter(
    (t) =>
      canReadLead(db, actor, t.leadId) &&
      (actor.role !== "telesale" ||
        (t.assigneeId === actor.id && t.status !== "Closed")),
  );
}

export function latestActivity(db: Database, ticketId: string) {
  return db.activities
    .filter((a) => a.assignmentId === ticketId && !a.voidedAt)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
}

export function inGroup(db: Database, t: Assignment, key: TaskGroup) {
  const c = counts(db, t.id);
  if (key === "closed") return t.status === "Closed";
  if (key === "solved") return t.status === "Solved";
  if (key === "recent")
    return Date.parse(t.updatedAt) >= serverNow().getTime() - 3 * 86400000;
  if (!isPending(t)) return false;
  if (key === "pending") return true;
  if (key === "unaccepted") return t.status === "New" && !t.acceptedAt;
  if (key === "new") return t.status === "New";
  if (key === "agreed") return latestActivity(db, t.id)?.decision === "agreed";
  if (key === "no_answer") return c.noAnswer > 0;
  if (key === "no_answer_1") return c.noAnswer === 1;
  if (key === "no_answer_2") return c.noAnswer === 2;
  // 00:00 after the appointment day; failures are only counted at 08:00.
  if (key.startsWith("overdue")) {
    if (!needsRebooking(db, t, serverNow())) return false;
    return (
      key === "overdue" || Math.max(1, c.overdue) === Number(key.slice(-1))
    );
  }
  return false;
}

export const expiresSoon = (t: Assignment) =>
  isPending(t) &&
  Date.parse(t.expiresAt) - serverNow().getTime() < 2 * 86400000;
