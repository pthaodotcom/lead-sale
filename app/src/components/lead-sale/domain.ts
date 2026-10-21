import type {
  ActivityInput,
  Assignment,
  Command,
  Database,
  LeadInput,
  Member,
  Role,
} from "./types";

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
  (canAssign(actor) ||
    (actor.role === "telesale" && ticket.assigneeId === actor.id));
export const isLive = (ticket: Assignment) => ticket.status !== "Closed";
export const isPending = (ticket: Assignment) =>
  ticket.status === "New" || ticket.status === "Open";
export const normalizePhone = (value: string) =>
  value.replace(/[^\d+]/g, "").replace(/^\+?84(?=\d{9}$)/, "0");
const fail = (message: string): never => {
  throw new Error(message);
};
const ensure = (condition: unknown, message: string) => {
  if (!condition) fail(message);
};
const id = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
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
  const items = db.activities.filter((a) => a.assignmentId === ticketId);
  return {
    noAnswer: items.filter((a) => a.outcome === "no_answer").length,
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
  const actor =
    db.members.find((m) => m.id === actorId) ??
    fail("Không tìm thấy người thao tác.");
  ensure(actor.active, "Tài khoản đang tạm ngưng.");
  const stamp = now.toISOString();
  const log = (action: string, target: string, detail: string) =>
    db.audit.unshift({
      id: id("LOG"),
      at: stamp,
      actorId,
      action,
      target,
      detail,
    });
  // Preview expiry is evaluated on access; the future backend must schedule this independently.
  for (const ticket of db.assignments) {
    if (
      isLive(ticket) &&
      new Date(ticket.expiresAt).getTime() <= now.getTime()
    ) {
      ticket.status = "Closed";
      ticket.updatedAt = stamp;
      ticket.closeReason = "Hết thời hạn phân công 14 ngày";
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
      } else {
        const lead = {
          ...input,
          id: id("LEAD"),
          status: "New" as const,
          receivedAt: stamp,
          updatedAt: stamp,
          archived: false,
        };
        db.leads.unshift(lead);
        log("Tiếp nhận Lead", lead.id, `${lead.name} · ${lead.phone}`);
      }
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
        Activated: ["Onboarded", "Closed"],
        Onboarded: [],
        Closed: ["New"],
      };
      ensure(
        (allowed[lead.status] as string[]).includes(command.status),
        "Chuyển trạng thái hồ sơ không hợp lệ.",
      );
      ensure(command.reason.trim(), "Nhập căn cứ cập nhật trạng thái.");
      const before = lead.status;
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
        !lead.archived && lead.status === "New",
        "Chỉ phân công hồ sơ Mới đang sử dụng.",
      );
      const member = db.members.find((m) => m.id === command.assigneeId);
      ensure(
        member?.active && member.role === "telesale",
        "Chọn nhân viên Telesale đang hoạt động.",
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
        t.status = "Closed";
        t.updatedAt = stamp;
        t.closeReason = "Chuyển người phụ trách";
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
      };
      db.assignments.unshift(ticket);
      log("Tạo phiếu phân công", ticket.id, `${lead.id} → ${member?.name}`);
      break;
    }
    case "ticketStatus": {
      const ticket = ticketById(command.id);
      ensure(canWork(actor, ticket), "Bạn không có quyền xử lý phiếu này.");
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
      ticket.status = command.status;
      ticket.updatedAt = stamp;
      if (command.status === "Closed")
        ticket.closeReason = command.reason.trim();
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
        canWork(actor, ticket) && isPending(ticket),
        "Chỉ ghi tư vấn trên phiếu của bạn đang Chưa liên hệ hoặc Đang tư vấn.",
      );
      const input: ActivityInput = command.input;
      ensure(
        ["call", "zalo"].includes(input.channel) &&
          input.outcome in outcomeLabels &&
          input.decision in decisionLabels &&
          input.reason in reasonLabels,
        "Thông tin hoạt động không hợp lệ.",
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
      };
      db.activities.unshift(activity);
      if (input.appointmentAt)
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
      const totals = counts(db, ticket.id);
      // The source leaves count=3 ambiguous: keep Open and surface a review cue; do not silently resolve it.
      ticket.status =
        totals.noAnswer > 3 ||
        totals.overdue > 3 ||
        (input.decision === "declined" &&
          ["no_need", "ineligible"].includes(input.reason)) ||
        input.outcome === "wrong_phone"
          ? "Solved"
          : "Open";
      ticket.updatedAt = stamp;
      log(
        "Ghi hoạt động tư vấn",
        ticket.id,
        `${outcomeLabels[input.outcome]} · ${decisionLabels[input.decision]}`,
      );
      break;
    }
    case "appointment": {
      const appointment =
        db.appointments.find((a) => a.id === command.id) ??
        fail("Không tìm thấy lịch hẹn.");
      const ticket = ticketById(appointment.assignmentId);
      ensure(
        canWork(actor, ticket) && isLive(ticket),
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
      log("Cập nhật lịch hẹn", appointment.id, command.status);
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
      break;
    }
  }
  return db;
}
