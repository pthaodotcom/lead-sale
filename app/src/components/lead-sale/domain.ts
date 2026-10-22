import type {
  ActivityInput,
  Assignment,
  Command,
  Database,
  LeadInput,
  Member,
  Role,
  ReportData,
  ReportFilters,
} from "./types";
import { serverNow } from "./dates";

export const roleLabels: Record<Role, string> = {
  admin: "Quản trị viên",
  intake: "Tiếp nhận hồ sơ",
  leader: "Trưởng nhóm",
  telesale: "Telesale",
  viewer: "Xem báo cáo",
};
export const leadLabels = {
  New: "Mới",
  Activated: "Đã đăng ký",
  Onboarded: "Đã chạy đơn đầu",
  Closed: "Đã đóng",
};
export const ticketLabels = {
  New: "Chưa liên hệ",
  Open: "Đang tư vấn",
  Solved: "Đã giải quyết",
  Closed: "Đã đóng",
};
export const outcomeLabels = {
  called: "Đã liên hệ",
  no_answer: "Không nghe máy",
  unresponsive: "Chat chưa phản hồi",
  overdue: "Quá hẹn đăng ký",
  wrong_phone: "Sai số điện thoại",
};
export const decisionLabels = {
  none: "Chưa có quyết định",
  agreed: "Đồng ý",
  declined: "Không đồng ý",
  hungup: "Cúp ngang",
};
export const reasonLabels = {
  none: "Chưa có",
  no_need: "Không có nhu cầu",
  busy: "Tạm thời bận",
  ineligible: "Không đủ điều kiện",
};
export const canEditLead = (actor: Member) =>
  actor.active && ["admin", "intake"].includes(actor.role);
export const canAssign = (actor: Member) =>
  actor.active && ["admin", "leader"].includes(actor.role);
export const canWork = (actor: Member, ticket: Assignment) =>
  actor.active &&
  ticket.status !== "Closed" &&
  Date.parse(ticket.expiresAt) > serverNow().getTime() &&
  (actor.role === "admin" ||
    (actor.role === "telesale" && ticket.assigneeId === actor.id));
export const isLive = (ticket: Assignment) => ticket.status !== "Closed";
export const isPending = (ticket: Assignment, now = serverNow()) =>
  (ticket.status === "New" || ticket.status === "Open") &&
  Date.parse(ticket.expiresAt) > now.getTime();
export const normalizePhone = (value: string) =>
  value.replace(/[\s().-]/g, "").replace(/^\+?84(?=\d{9}$)/, "0");
export const latestAssignment = (db: Database, leadId: string) =>
  db.assignments
    .filter((t) => t.leadId === leadId)
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        (b.sequence ?? 0) - (a.sequence ?? 0) ||
        b.id.localeCompare(a.id),
    )[0];
export function canReadLead(
  db: Database,
  actor: Member,
  leadId: string,
  now = serverNow(),
) {
  if (!actor.active || actor.role === "viewer") return false;
  if (["admin", "intake"].includes(actor.role)) return true;
  const t = latestAssignment(db, leadId);
  if (actor.role === "leader")
    return (
      (t && (t.teamId ?? "default") === (actor.teamId ?? "default")) ||
      db.leads.some(
        (l) =>
          l.id === leadId &&
          l.status === "New" &&
          !l.archived &&
          !db.assignments.some(
            (a) =>
              a.leadId === leadId &&
              isLive(a) &&
              Date.parse(a.expiresAt) > now.getTime(),
          ),
      )
    );
  return (
    !!t &&
    t.assigneeId === actor.id &&
    isLive(t) &&
    Date.parse(t.expiresAt) > now.getTime()
  );
}
export function calculateReport(
  db: Database,
  actor: Member,
  filters: ReportFilters = {},
  now = new Date(),
): ReportData {
  if (filters.from && filters.to && filters.from > filters.to)
    throw new Error("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
  const day = (s: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(s),
    );
  const leads = db.leads.filter((l) => {
    const t = latestAssignment(db, l.id);
    return (
      !l.archived &&
      (!filters.from || day(l.receivedAt) >= filters.from) &&
      (!filters.to || day(l.receivedAt) <= filters.to) &&
      (!filters.source || l.sourceId === filters.source) &&
      (!filters.status || l.status === filters.status) &&
      (!filters.member || (t?.assigneeId ?? "unassigned") === filters.member) &&
      (actor.role === "leader"
        ? t?.teamId === actor.teamId
        : actor.role === "telesale"
          ? t?.assigneeId === actor.id
          : true)
    );
  });
  const registered = (l: Database["leads"][number]) =>
    !!l.activatedAt || ["Activated", "Onboarded"].includes(l.status);
  const overdueIds = new Set(
    db.appointments
      .filter((a) => {
        const t = db.assignments.find((t) => t.id === a.assignmentId);
        return (
          a.status === "scheduled" &&
          Date.parse(a.at) < now.getTime() &&
          t &&
          isPending(t, now) &&
          Date.parse(t.expiresAt) > now.getTime()
        );
      })
      .map((a) => a.leadId),
  );
  return {
    total: leads.length,
    registered: leads.filter(registered).length,
    onboarded: leads.filter((l) => !!l.onboardedAt || l.status === "Onboarded")
      .length,
    overdue: leads.filter((l) => overdueIds.has(l.id)).length,
    newToday: leads.filter((l) => day(l.receivedAt) === day(now.toISOString()))
      .length,
    bySource: db.sources.map((s) => {
      const ls = leads.filter((l) => l.sourceId === s.id);
      return {
        id: s.id,
        total: ls.length,
        registered: ls.filter(registered).length,
      };
    }),
    byStatus: Object.fromEntries(
      Object.keys(leadLabels).map((s) => [
        s,
        leads.filter((l) => l.status === s).length,
      ]),
    ),
    byMember: [
      ...db.members.filter((m) => m.role === "telesale").map((m) => m.id),
      "unassigned",
    ].map((id) => {
      const ls = leads.filter(
        (l) => (latestAssignment(db, l.id)?.assigneeId ?? "unassigned") === id,
      );
      return { id, total: ls.length, registered: ls.filter(registered).length };
    }),
  };
}
const fail = (message: string): never => {
  throw new Error(message);
};
const ensure = (condition: unknown, message: string) => {
  if (!condition) fail(message);
};
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().toUpperCase()}`;
export function validateLead(
  input: LeadInput,
  db: Database,
  currentId?: string,
) {
  const clean = {
    ...input,
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    city: input.city.trim(),
    note: input.note.trim(),
    tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))],
  };
  ensure(clean.name.length >= 2, "Nhập họ tên tài xế từ 2 ký tự.");
  ensure(
    /^0\d{9}$/.test(clean.phone),
    "Số điện thoại cần có 10 chữ số, bắt đầu bằng 0 hoặc dùng mã +84.",
  );
  const duplicate = db.leads.find(
    (l) => l.id !== currentId && normalizePhone(l.phone) === clean.phone,
  );
  if (duplicate)
    fail(
      `Số điện thoại đã có trong hồ sơ ${duplicate.id} — ${duplicate.name}. Hãy mở hồ sơ này để bổ sung thông tin.`,
    );
  ensure(clean.city, "Nhập thành phố đăng ký chạy xe.");
  if (clean.receivedAt)
    ensure(
      Number.isFinite(Date.parse(clean.receivedAt)) &&
        new Date(clean.receivedAt) <= serverNow() &&
        new Date(clean.receivedAt) >= new Date("2000-01-01"),
      "Ngày tiếp nhận không hợp lệ.",
    );
  ensure(
    ["Motorbike", "Van"].includes(clean.vehicle),
    "Chọn loại phương tiện hợp lệ.",
  );
  ensure(
    db.sources.some(
      (s) =>
        s.id === clean.sourceId &&
        (s.active ||
          db.leads.find((l) => l.id === currentId)?.sourceId === s.id),
    ),
    "Chọn nguồn Lead đang sử dụng.",
  );
  return clean;
}
export function counts(db: Database, ticketId: string) {
  const round = db.assignments.find((t) => t.id === ticketId)?.round ?? 1;
  const items = db.activities.filter(
    (a) =>
      a.assignmentId === ticketId && (a.round ?? 1) === round && !a.voidedAt,
  );
  return {
    noAnswer: items.filter(
      (a) => a.outcome === "no_answer" && a.channel === "call",
    ).length,
    overdue: items.filter((a) => a.outcome === "overdue").length,
  };
}
export function applyCommand(
  original: Database,
  actorId: string,
  command: Command,
  now = new Date(),
): Database {
  const db = structuredClone(original);
  db.receptions ??= [];
  db.reviews ??= [];
  db.notices ??= [];
  const actor =
    db.members.find((m) => m.id === actorId) ??
    fail("Không tìm thấy người thao tác.");
  ensure(actor.active, "Tài khoản đang tạm ngưng.");
  const stamp = now.toISOString();
  const isPending = (ticket: Assignment) =>
    (ticket.status === "New" || ticket.status === "Open") &&
    Date.parse(ticket.expiresAt) > now.getTime();
  const log = (action: string, target: string, detail: string) =>
    db.audit.unshift({
      id: id("LOG"),
      at: stamp,
      actorId,
      action,
      target,
      detail,
    });
  const cancelAppointments = (ticketId: string) => {
    for (const a of db.appointments.filter(
      (a) => a.assignmentId === ticketId && a.status === "scheduled",
    ))
      a.status = "cancelled";
  };
  const closeTicket = (ticket: Assignment, reason: string) => {
    ticket.status = "Closed";
    ticket.updatedAt = stamp;
    ticket.closeReason = reason;
    cancelAppointments(ticket.id);
    if (!db.reviews.some((r) => r.assignmentId === ticket.id))
      db.reviews.unshift({
        id: id("BG"),
        assignmentId: ticket.id,
        leadId: ticket.leadId,
        at: stamp,
        reason,
        ...(reason === "Chuyển người phụ trách"
          ? { reviewedAt: stamp, reviewedBy: actorId, result: "transferred" }
          : {}),
      });
  };
  const writable = (ticket: Assignment) =>
    actor.role === "admin" ||
    (actor.role === "telesale" && ticket.assigneeId === actor.id);
  // Preview expiry is evaluated on access; the future backend must schedule this independently.
  for (const ticket of db.assignments) {
    if (
      isLive(ticket) &&
      new Date(ticket.expiresAt).getTime() <= now.getTime()
    ) {
      closeTicket(ticket, "Hết thời hạn phân công 14 ngày");
      log("Tự đóng phiếu", ticket.id, ticket.closeReason);
    }
  }
  const ticketById = (ticketId: string) =>
    db.assignments.find((t) => t.id === ticketId) ??
    fail("Không tìm thấy phiếu phân công.");
  const leadById = (leadId: string) =>
    db.leads.find((l) => l.id === leadId) ?? fail("Không tìm thấy hồ sơ Lead.");
  switch (command.type) {
    case "expire":
      break;
    case "saveLead": {
      ensure(canEditLead(actor), "Bạn không có quyền sửa hồ sơ Lead.");
      const input = validateLead(command.input, db, command.id);
      if (command.id) {
        const lead = leadById(command.id);
        ensure(!lead.archived, "Khôi phục hồ sơ trước khi chỉnh sửa.");
        const before = JSON.stringify(lead);
        Object.assign(lead, input, { updatedAt: stamp });
        log(
          "Cập nhật hồ sơ",
          lead.id,
          JSON.stringify({ before: JSON.parse(before), after: lead }),
        );
        lead.sourceId = original.leads.find((l) => l.id === lead.id)!.sourceId;
      } else {
        const lead = {
          ...input,
          id: id("LEAD"),
          status: "New" as const,
          receivedAt: input.receivedAt
            ? new Date(input.receivedAt).toISOString()
            : stamp,
          updatedAt: stamp,
          archived: false,
        };
        db.leads.unshift(lead);
        log("Tiếp nhận Lead", lead.id, `${lead.name} · ${lead.phone}`);
      }
      if (!command.id)
        db.receptions.unshift({
          id: id("TN"),
          leadId: db.leads[0].id,
          sourceId: input.sourceId,
          at: db.leads[0].receivedAt,
          actorId,
        });
      break;
    }
    case "leadStatus": {
      ensure(
        canEditLead(actor),
        "Chỉ bộ phận tiếp nhận hoặc quản trị được cập nhật hồ sơ.",
      );
      const lead = leadById(command.id);
      ensure(!lead.archived, "Hồ sơ đã được lưu trữ.");
      const allowed = {
        New: ["Activated", "Closed"],
        Activated: ["Onboarded"],
        Onboarded: [],
        Closed: ["New"],
      };
      ensure(
        (allowed[lead.status] as string[]).includes(command.status),
        "Chuyển trạng thái hồ sơ không hợp lệ.",
      );
      ensure(command.reason.trim(), "Nhập căn cứ cập nhật trạng thái.");
      const before = lead.status;
      const occurred = command.occurredAt ? new Date(command.occurredAt) : now;
      ensure(
        Number.isFinite(occurred.getTime()) &&
          occurred <= now &&
          occurred >= new Date("2000-01-01"),
        "Thời điểm xác nhận không hợp lệ.",
      );
      if (command.status === "Activated") {
        lead.activatedAt = occurred.toISOString();
        lead.activatedSource = "manual";
      }
      if (command.status === "Onboarded") {
        ensure(
          !lead.activatedAt || occurred >= new Date(lead.activatedAt),
          "Đơn đầu phải sau đăng ký.",
        );
        lead.onboardedAt = occurred.toISOString();
        lead.onboardedSource = "manual";
      }
      lead.status = command.status;
      lead.updatedAt = stamp;
      log(
        "Đổi trạng thái Lead",
        lead.id,
        `${before} → ${lead.status}: ${command.reason.trim()}`,
      );
      if (lead.status === "Activated" || lead.status === "Closed")
        for (const t of db.assignments.filter(
          (t) => t.leadId === lead.id && isPending(t),
        )) {
          t.status = "Solved";
          t.updatedAt = stamp;
          cancelAppointments(t.id);
          log(
            "Giải quyết phiếu",
            t.id,
            `Hồ sơ chuyển ${lead.status}: ${command.reason.trim()}`,
          );
        }
      break;
    }
    case "archiveLead": {
      ensure(canEditLead(actor), "Bạn không có quyền lưu trữ hồ sơ.");
      const lead = leadById(command.id);
      ensure(
        !db.assignments.some((t) => t.leadId === lead.id && isLive(t)),
        "Đóng các phiếu đang hiệu lực trước khi lưu trữ hồ sơ.",
      );
      lead.archived = !lead.archived;
      lead.updatedAt = stamp;
      log(
        lead.archived ? "Lưu trữ hồ sơ" : "Khôi phục hồ sơ",
        lead.id,
        "Giữ nguyên lịch sử liên quan",
      );
      break;
    }
    case "assign": {
      ensure(canAssign(actor), "Chỉ trưởng nhóm hoặc quản trị được phân công.");
      const lead = leadById(command.leadId);
      ensure(
        !db.reviews.some((r) => r.leadId === lead.id && !r.reviewedAt),
        "Xác nhận bàn giao trước khi phân công lại.",
      );
      ensure(
        !["follow_up", "closed"].includes(
          db.reviews
            .filter((r) => r.leadId === lead.id)
            .sort((a, b) =>
              (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""),
            )[0]?.result ?? "",
        ),
        "Kết quả bàn giao chưa đủ điều kiện phân công lại.",
      );
      ensure(
        !lead.archived && lead.status === "New",
        "Chỉ phân công hồ sơ Mới đang sử dụng.",
      );
      const member = db.members.find((m) => m.id === command.assigneeId);
      ensure(
        member?.active && member.role === "telesale",
        "Chọn nhân viên Telesale đang hoạt động.",
      );
      ensure(
        actor.role === "admin" ||
          (member?.teamId ?? "default") === (actor.teamId ?? "default"),
        "Chỉ phân công trong nhóm của bạn.",
      );
      const current = latestAssignment(db, lead.id);
      ensure(
        actor.role === "admin" ||
          !current ||
          (current.teamId ?? "default") === (actor.teamId ?? "default"),
        "Hồ sơ thuộc nhóm khác.",
      );
      const existing = db.assignments.filter(
        (t) => t.leadId === lead.id && isLive(t),
      );
      ensure(
        !existing.length || command.transfer,
        "Lead đã có phiếu đang hiệu lực. Dùng Chuyển người phụ trách để giữ lịch sử.",
      );
      ensure(
        !existing.some((t) => t.assigneeId === command.assigneeId),
        "Lead đã được phân công cho nhân viên này.",
      );
      for (const t of existing) {
        closeTicket(t, "Chuyển người phụ trách");
        log(
          "Chuyển phân công",
          t.id,
          `${t.assigneeId} → ${command.assigneeId}`,
        );
      }
      const ticket: Assignment = {
        id: id("PC"),
        leadId: lead.id,
        assigneeId: command.assigneeId,
        assignedBy: actorId,
        createdAt: stamp,
        updatedAt: stamp,
        expiresAt: new Date(now.getTime() + 14 * 86400000).toISOString(),
        status: "New",
        closeReason: "",
        teamId: member?.teamId ?? "default",
        round: 1,
        previousId: existing[0]?.id,
      };
      db.assignments.unshift(ticket);
      log("Tạo phiếu phân công", ticket.id, `${lead.id} → ${member?.name}`);
      break;
    }
    case "accept": {
      const ticket = ticketById(command.id);
      ensure(
        ticket.assigneeId === actorId && isLive(ticket),
        "Chỉ người được giao được nhận việc.",
      );
      ticket.acceptedAt ??= stamp;
      log("Nhận việc", ticket.id, actor.name);
      break;
    }
    case "ticketStatus": {
      const ticket = ticketById(command.id);
      ensure(
        writable(ticket) ||
          (actor.role === "leader" &&
            (ticket.teamId ?? "default") === (actor.teamId ?? "default")),
        "Bạn không có quyền xử lý phiếu này.",
      );
      ensure(isLive(ticket), "Phiếu đã đóng, không thể mở lại hoặc chỉnh sửa.");
      ensure(
        command.status === "Open" ||
          command.status === "Solved" ||
          (command.status === "Closed" && canAssign(actor)),
        "Bạn không có quyền chuyển trạng thái này.",
      );
      ensure(ticket.status !== command.status, "Phiếu đã ở trạng thái này.");
      ensure(
        command.status !== "Open" || leadById(ticket.leadId).status === "New",
        "Chỉ tiếp tục tư vấn cho hồ sơ Lead Mới.",
      );
      ensure(command.reason.trim(), "Nhập lý do cập nhật phiếu.");
      const before = ticket.status;
      if (command.status === "Open") {
        ensure(
          before === "Solved",
          "Phiếu chỉ chuyển Open khi ghi hoạt động hoặc mở lại Solved.",
        );
        ticket.round = (ticket.round ?? 1) + 1;
      }
      ticket.status = command.status;
      ticket.updatedAt = stamp;
      if (command.status === "Closed")
        closeTicket(ticket, command.reason.trim());
      if (command.status === "Solved") cancelAppointments(ticket.id);
      log(
        "Đổi trạng thái phiếu",
        ticket.id,
        `${before} → ${ticket.status}: ${command.reason.trim()}`,
      );
      break;
    }
    case "activity": {
      const ticket = ticketById(command.assignmentId);
      ensure(
        writable(ticket) && isPending(ticket),
        "Chỉ ghi tư vấn trên phiếu của bạn đang Chưa liên hệ hoặc Đang tư vấn.",
      );
      ensure(
        ticket.acceptedAt || actor.role === "admin",
        "Nhận việc trước khi ghi tư vấn.",
      );
      const input: ActivityInput = command.input;
      ensure(
        !(input.channel === "zalo" && input.outcome === "no_answer") &&
          !(input.channel === "call" && input.outcome === "unresponsive"),
        "Chat chưa phản hồi không tính KNM.",
      );
      ensure(
        ["call", "zalo"].includes(input.channel) &&
          input.outcome in outcomeLabels &&
          input.decision in decisionLabels &&
          input.reason in reasonLabels,
        "Thông tin hoạt động không hợp lệ.",
      );
      ensure(
        input.outcome !== "overdue",
        "Ghi Không đến trên lịch hẹn để tránh đếm quá hẹn trùng.",
      );
      const at = new Date(input.at);
      ensure(
        Number.isFinite(at.getTime()) &&
          at <= now &&
          at >= new Date(ticket.createdAt),
        "Thời điểm liên hệ phải từ lúc phân công đến hiện tại.",
      );
      ensure(input.note.trim(), "Nhập nội dung hoặc kết quả tư vấn.");
      ensure(
        input.decision !== "declined" || input.reason !== "none",
        "Chọn lý do tài xế không đồng ý.",
      );
      ensure(
        input.outcome === "called" || input.decision === "none",
        "Không ghi quyết định khi chưa liên hệ được tài xế.",
      );
      if (input.appointmentAt)
        ensure(
          input.decision === "agreed" &&
            new Date(input.appointmentAt) > now &&
            new Date(input.appointmentAt) < new Date(ticket.expiresAt) &&
            input.place?.trim(),
          "Lịch hẹn cần ngày giờ trong tương lai, địa điểm và quyết định Đồng ý.",
        );
      const activity = {
        id: id("HD"),
        leadId: ticket.leadId,
        assignmentId: ticket.id,
        actorId,
        channel: input.channel,
        at: at.toISOString(),
        outcome: input.outcome,
        decision: input.decision,
        reason:
          input.decision === "declined" ? input.reason : ("none" as const),
        note: input.note.trim(),
        round: ticket.round ?? 1,
      };
      db.activities.unshift(activity);
      if (input.appointmentAt) {
        ensure(
          !db.appointments.some(
            (a) => a.assignmentId === ticket.id && a.status === "scheduled",
          ),
          "Phiếu đã có lịch hẹn. Dùng Hẹn lại để giữ lịch sử.",
        );
        db.appointments.unshift({
          id: id("HEN"),
          activityId: activity.id,
          leadId: ticket.leadId,
          assignmentId: ticket.id,
          actorId,
          at: new Date(input.appointmentAt).toISOString(),
          place: input.place!.trim(),
          status: "scheduled",
        });
      }
      const totals = counts(db, ticket.id);
      ticket.status =
        totals.noAnswer >= 3 ||
        totals.overdue >= 3 ||
        (input.decision === "declined" &&
          ["no_need", "ineligible"].includes(input.reason)) ||
        input.outcome === "wrong_phone"
          ? "Solved"
          : "Open";
      ticket.updatedAt = stamp;
      if (ticket.status === "Solved") cancelAppointments(ticket.id);
      // BR-61: a new contact replaces (or clears) the follow-up call.
      if (input.nextCallAt && ticket.status !== "Solved") {
        const next = new Date(input.nextCallAt);
        ensure(
          next > now && next < new Date(ticket.expiresAt),
          "Hẹn gọi lại phải ở tương lai và trước hạn phiếu.",
        );
        ticket.nextCallAt = next.toISOString();
      } else delete ticket.nextCallAt;
      log(
        "Ghi hoạt động tư vấn",
        ticket.id,
        `${outcomeLabels[input.outcome]} · ${decisionLabels[input.decision]}`,
      );
      break;
    }
    case "followUp": {
      const ticket = ticketById(command.id);
      ensure(
        writable(ticket) && isPending(ticket),
        "Chỉ đặt hẹn gọi lại trên phiếu của bạn đang xử lý.",
      );
      if (command.at) {
        const next = new Date(command.at);
        ensure(
          next > now && next < new Date(ticket.expiresAt),
          "Hẹn gọi lại phải ở tương lai và trước hạn phiếu.",
        );
        ticket.nextCallAt = next.toISOString();
      } else delete ticket.nextCallAt;
      ticket.updatedAt = stamp;
      log("Hẹn gọi lại", ticket.id, ticket.nextCallAt ?? "Bỏ hẹn gọi lại");
      break;
    }
    case "appointment": {
      const appointment =
        db.appointments.find((a) => a.id === command.id) ??
        fail("Không tìm thấy lịch hẹn.");
      const ticket = ticketById(appointment.assignmentId);
      ensure(
        writable(ticket) && isPending(ticket),
        "Bạn không có quyền cập nhật lịch hẹn này.",
      );
      ensure(
        appointment.status === "scheduled" &&
          ["attended", "missed", "cancelled"].includes(command.status),
        "Lịch hẹn đã được xử lý hoặc kết quả không hợp lệ.",
      );
      if (command.status === "missed")
        ensure(new Date(appointment.at) <= now, "Lịch hẹn chưa đến hạn.");
      appointment.status = command.status;
      if (command.status === "attended")
        ensure(new Date(appointment.at) <= now, "Lịch hẹn chưa đến giờ.");
      if (command.status === "missed") {
        db.activities.unshift({
          id: id("HD"),
          leadId: ticket.leadId,
          assignmentId: ticket.id,
          actorId,
          channel: "call",
          at: stamp,
          outcome: "overdue",
          decision: "none",
          reason: "none",
          note: "Không đến lịch hẹn",
          round: ticket.round ?? 1,
          appointmentId: appointment.id,
        });
        if (counts(db, ticket.id).overdue >= 3) {
          ticket.status = "Solved";
          cancelAppointments(ticket.id);
        }
      }
      log("Cập nhật lịch hẹn", appointment.id, command.status);
      break;
    }
    case "reschedule": {
      const appointment =
        db.appointments.find((a) => a.id === command.id) ??
        fail("Không tìm thấy lịch hẹn.");
      const ticket = ticketById(appointment.assignmentId);
      ensure(
        writable(ticket) &&
          isPending(ticket) &&
          appointment.status === "scheduled",
        "Bạn không có quyền hẹn lại lịch này.",
      );
      ensure(
        new Date(command.at) > now &&
          new Date(command.at) < new Date(ticket.expiresAt) &&
          command.place.trim(),
        "Ngày giờ hẹn phải trong tương lai, trong hạn phiếu và có địa điểm.",
      );
      appointment.status = "cancelled";
      db.appointments.unshift({
        ...appointment,
        id: id("HEN"),
        at: new Date(command.at).toISOString(),
        place: command.place.trim(),
        status: "scheduled",
        previousId: appointment.id,
      });
      log("Hẹn lại", appointment.id, command.at);
      break;
    }
    case "review":
    case "amendReview": {
      ensure(
        canEditLead(actor),
        "Chỉ bộ phận tiếp nhận được rà soát bàn giao.",
      );
      const review =
        db.reviews.find((r) => r.id === command.id) ??
        fail("Không tìm thấy bàn giao.");
      ensure(command.note.trim(), "Nhập kết quả rà soát.");
      if (command.type === "review")
        ensure(
          !review.reviewedAt,
          "Bàn giao đã được xác nhận, không được ghi đè.",
        );
      else {
        ensure(
          review.reviewedAt && command.reason.trim(),
          "Đính chính cần lý do và rà soát đã xác nhận.",
        );
        log(
          "Đính chính rà soát",
          review.id,
          JSON.stringify({ before: review, reason: command.reason }),
        );
      }
      Object.assign(review, {
        reviewedAt: stamp,
        reviewedBy: actorId,
        note: command.note.trim(),
        result: command.result ?? "reviewed",
      });
      log("Rà soát bàn giao", review.id, command.note);
      break;
    }
    case "receiveLead": {
      ensure(canEditLead(actor), "Không có quyền tiếp nhận.");
      const lead = leadById(command.id);
      ensure(
        !lead.archived &&
          command.reason.trim() &&
          db.sources.some((s) => s.id === command.sourceId && s.active),
        "Nguồn hoặc căn cứ tiếp nhận không hợp lệ.",
      );
      db.receptions.unshift({
        id: id("TN"),
        leadId: lead.id,
        sourceId: command.sourceId,
        at: stamp,
        actorId,
      });
      lead.updatedAt = stamp;
      log("Tái tiếp nhận", lead.id, command.reason);
      break;
    }
    case "correctMilestone": {
      ensure(canEditLead(actor), "Không có quyền đính chính.");
      const lead = leadById(command.id);
      ensure(!lead.archived && command.reason.trim(), "Nhập lý do đính chính.");
      delete lead.activatedAt;
      delete lead.onboardedAt;
      delete lead.activatedSource;
      delete lead.onboardedSource;
      delete lead.firstOrderId;
      if (["Activated", "Onboarded"].includes(command.status)) {
        const at = new Date(command.activatedAt ?? "");
        ensure(
          at <= now && at >= new Date("2000-01-01"),
          "Ngày đăng ký không hợp lệ.",
        );
        lead.activatedAt = at.toISOString();
        lead.activatedSource = "manual_correction";
      }
      if (command.status === "Onboarded") {
        const at = new Date(command.onboardedAt ?? "");
        ensure(
          at <= now && at >= new Date(lead.activatedAt!),
          "Ngày đơn đầu không hợp lệ.",
        );
        lead.onboardedAt = at.toISOString();
        lead.onboardedSource = "manual_correction";
      }
      lead.status = command.status;
      lead.coreCorrectionAt = stamp;
      lead.correctionReason = command.reason;
      lead.updatedAt = stamp;
      if (command.status !== "New")
        for (const t of db.assignments.filter(
          (t) => t.leadId === lead.id && ["New", "Open"].includes(t.status),
        )) {
          t.status = "Solved";
          cancelAppointments(t.id);
        }
      log("Đính chính kết quả", lead.id, command.reason);
      break;
    }
    case "voidActivity": {
      const activity =
        db.activities.find((a) => a.id === command.id) ??
        fail("Không tìm thấy hoạt động.");
      const ticket = ticketById(activity.assignmentId);
      ensure(
        writable(ticket) &&
          !activity.voidedAt &&
          !activity.appointmentId &&
          command.reason.trim(),
        "Không thể hủy kết quả này.",
      );
      activity.voidedAt = stamp;
      activity.voidReason = command.reason;
      for (const a of db.appointments.filter(
        (a) => a.activityId === activity.id && a.status === "scheduled",
      ))
        a.status = "cancelled";
      log("Hủy tính kết quả", activity.id, command.reason);
      break;
    }
    case "correctAppointment": {
      const ap =
        db.appointments.find((a) => a.id === command.id) ??
        fail("Không tìm thấy lịch.");
      const ticket = ticketById(ap.assignmentId);
      ensure(
        writable(ticket) &&
          ["attended", "missed"].includes(ap.status) &&
          ["attended", "missed", "cancelled"].includes(command.status) &&
          command.reason.trim(),
        "Không thể đính chính lịch này.",
      );
      ap.status = command.status;
      const activity = db.activities.find((a) => a.appointmentId === ap.id);
      if (activity) {
        if (command.status === "missed") {
          delete activity.voidedAt;
          delete activity.voidReason;
        } else {
          activity.voidedAt = stamp;
          activity.voidReason = command.reason;
        }
      } else if (command.status === "missed")
        db.activities.unshift({
          id: id("HD"),
          leadId: ap.leadId,
          assignmentId: ticket.id,
          actorId,
          channel: "call",
          at: stamp,
          outcome: "overdue",
          decision: "none",
          reason: "none",
          note: command.reason,
          round:
            db.activities.find((a) => a.id === ap.activityId)?.round ??
            ticket.round ??
            1,
          appointmentId: ap.id,
        });
      if (isPending(ticket) && counts(db, ticket.id).overdue >= 3) {
        ticket.status = "Solved";
        cancelAppointments(ticket.id);
      }
      log("Đính chính lịch", ap.id, command.reason);
      break;
    }
    case "noticeRead": {
      const notice =
        db.notices.find(
          (n) => n.id === command.id && n.recipientId === actorId,
        ) ?? fail("Không tìm thấy thông báo.");
      notice.readAt = stamp;
      break;
    }
    case "attachment": {
      const activity =
        db.activities.find((a) => a.id === command.activityId) ??
        fail("Không tìm thấy hoạt động.");
      const ticket = ticketById(activity.assignmentId);
      ensure(
        writable(ticket) && isLive(ticket),
        "Bạn không có quyền đính kèm.",
      );
      activity.attachments = [
        ...(activity.attachments ?? []),
        command.attachment,
      ];
      log("Đính kèm bằng chứng", activity.id, command.attachment.name);
      break;
    }
    case "team": {
      ensure(actor.role === "admin", "Chỉ quản trị được tạo nhóm.");
      const name = command.name.trim();
      ensure(
        name.length >= 2 && name.length <= 120,
        "Tên nhóm cần từ 2–120 ký tự.",
      );
      db.teams ??= [{ id: "default", name: "Nhóm tuyển tài xế" }];
      ensure(
        !db.teams.some(
          (t) =>
            t.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"),
        ),
        "Tên nhóm đã tồn tại.",
      );
      db.teams.push({ id: id("TEAM"), name });
      log("Tạo nhóm", name, name);
      break;
    }
    case "statusLabel": {
      ensure(actor.role === "admin", "Chỉ quản trị được đổi nhãn trạng thái.");
      const label = command.label.trim();
      ensure(
        command.code in leadLabels && label.length > 0 && label.length <= 120,
        "Nhãn trạng thái không hợp lệ.",
      );
      db.statusCatalog ??= Object.entries(leadLabels).map(([code, label]) => ({
        code,
        label,
      }));
      const status = db.statusCatalog.find((s) => s.code === command.code);
      ensure(status, "Không tìm thấy trạng thái.");
      status!.label = label;
      log("Đổi nhãn trạng thái", command.code, label);
      break;
    }
    case "source": {
      ensure(
        actor.role === "admin",
        "Chỉ quản trị viên được quản lý danh mục.",
      );
      const name = command.name.trim();
      ensure(name.length > 1, "Nhập tên nguồn từ 2 ký tự.");
      ensure(
        !db.sources.some(
          (s) =>
            s.id !== command.id &&
            s.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"),
        ),
        "Tên nguồn đã tồn tại.",
      );
      if (command.id)
        Object.assign(
          db.sources.find((s) => s.id === command.id) ??
            fail("Không tìm thấy nguồn."),
          { name, active: command.active ?? true },
        );
      else db.sources.push({ id: id("NGUON"), name, active: true });
      log("Cập nhật nguồn Lead", command.id ?? name, name);
      break;
    }
    case "member": {
      ensure(
        actor.role === "admin",
        "Chỉ quản trị viên được quản lý tài khoản.",
      );
      ensure(
        command.id !== actor.id,
        "Không thay đổi quyền của tài khoản đang sử dụng.",
      );
      const member =
        db.members.find((m) => m.id === command.id) ??
        fail("Không tìm thấy tài khoản.");
      ensure(command.role in roleLabels, "Vai trò không hợp lệ.");
      ensure(
        !db.assignments.some((t) => t.assigneeId === member.id && isLive(t)) ||
          (command.active && command.role === "telesale"),
        "Chuyển các phiếu đang hiệu lực trước khi đổi vai trò hoặc tạm ngưng nhân viên.",
      );
      log(
        "Cập nhật người dùng",
        member.id,
        `${member.role}/${member.active} → ${command.role}/${command.active}`,
      );
      member.role = command.role;
      member.active = command.active;
      if (command.teamId) member.teamId = command.teamId;
      break;
    }
  }
  return db;
}
