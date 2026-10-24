import type { Appointment, Assignment, Database, ActivityInput } from "./types";
export const dayVN = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(value),
  );
export const nextMidnight = (at: string) =>
  Date.parse(dayVN(at) + "T00:00:00+07:00") + 86400000;
export const resultDeadline = (at: string) => nextMidnight(at) + 8 * 3600000;
export const appointmentLabels: Record<Appointment["status"], string> = {
  scheduled: "Đã lên lịch",
  waiting: "Chờ cập nhật kết quả",
  succeeded: "Thành công",
  failed: "Thất bại",
  cancelled: "Đã hủy",
  attended: "Đã đến (dữ liệu cũ)",
  missed: "Không đến (dữ liệu cũ)",
};
export const ticketCode = (t: Assignment) =>
  t.sequence
    ? `PC-${String(t.sequence).padStart(6, "0")}`
    : /^PC-\d+$/.test(t.id)
      ? `PC-${t.id.slice(3).padStart(6, "0")}`
      : t.id;
export function needsRebooking(db: Database, t: Assignment, now = new Date()) {
  if (!["New", "Open"].includes(t.status) || Date.parse(t.expiresAt) <= +now)
    return false;
  const l = db.leads.find((l) => l.id === t.leadId);
  if (l && (l.status !== "New" || l.activatedAt || l.onboardedAt)) return false;
  return db.appointments.some(
    (a) =>
      a.assignmentId === t.id &&
      ["scheduled", "waiting", "failed", "missed"].includes(a.status) &&
      nextMidnight(a.at) <= +now &&
      !db.appointments.some((n) => n.previousId === a.id),
  );
}
export function hasRegistration(db: Database, ap: Appointment, cutoff: number) {
  const lead = db.leads.find((l) => l.id === ap.leadId);
  return (
    !!lead?.activatedAt &&
    dayVN(lead.activatedAt) === dayVN(ap.at) &&
    Date.parse(lead.activatedAt) <= cutoff
  );
}
/** Runs before expiry: elapsed appointments retain their result even if the ticket expires. */
export function settleAppointments(db: Database, now: Date) {
  for (const ap of db.appointments) {
    if (ap.status === "scheduled" && Date.parse(ap.at) <= +now)
      ap.status = "waiting";
    if (ap.status !== "waiting" || resultDeadline(ap.at) > +now) continue;
    ap.status = hasRegistration(db, ap, resultDeadline(ap.at))
      ? "succeeded"
      : "failed";
    ap.resultAt = now.toISOString();
    ap.resultCutoff = new Date(resultDeadline(ap.at)).toISOString();
    ap.resultReason =
      ap.status === "succeeded"
        ? "Đã đối chiếu mốc đăng ký trong ngày hẹn"
        : "Chưa có mốc đăng ký hợp lệ lúc 08:00 hôm sau";
    const t = db.assignments.find((t) => t.id === ap.assignmentId);
    if (
      ap.status === "failed" &&
      t &&
      !db.activities.some((a) => a.appointmentId === ap.id)
    ) {
      db.activities.unshift({
        id: `HEN-RESULT-${ap.id}`,
        assignmentId: t.id,
        leadId: t.leadId,
        actorId: "system",
        at: now.toISOString(),
        channel: "call",
        outcome: "overdue",
        decision: "none",
        reason: "none",
        note: ap.resultReason,
        round: ap.round ?? t.round ?? 1,
        appointmentId: ap.id,
      });
      const n = db.activities.filter(
        (a) =>
          a.assignmentId === t.id &&
          (a.round ?? 1) === (t.round ?? 1) &&
          a.outcome === "overdue" &&
          !a.voidedAt,
      ).length;
      if (
        n >= 3 &&
        ["New", "Open"].includes(t.status) &&
        Date.parse(t.expiresAt) > +now
      ) {
        t.status = "Solved";
        t.updatedAt = now.toISOString();
      }
    }
  }
}
export function validateEvidence(input: ActivityInput) {
  const files = input.attachments ?? [];
  if (!files.length)
    throw new Error("Đính kèm bằng chứng trước khi lưu kết quả tư vấn.");
  if (
    files.some(
      (f) => !f.path || !f.name || f.size <= 0 || f.size > 20 * 1024 * 1024,
    )
  )
    throw new Error("Tệp bằng chứng cần có dữ liệu và không quá 20 MB.");
  const imageAllowed =
    input.channel === "zalo" ||
    ["no_answer", "wrong_phone"].includes(input.outcome);
  if (
    !files.some((f) =>
      imageAllowed ? f.type.startsWith("image/") : f.type.startsWith("audio/"),
    )
  )
    throw new Error(
      imageAllowed
        ? "Cần ảnh chat hoặc ảnh nhật ký cuộc gọi."
        : "Cần tệp ghi âm cuộc gọi.",
    );
  if (!["Open", "Solved"].includes(input.ticketStatus ?? ""))
    throw new Error("Chọn trạng thái phiếu sau khi ghi nhận liên hệ.");
}
