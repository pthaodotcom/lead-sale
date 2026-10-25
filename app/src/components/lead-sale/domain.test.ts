import { describe, expect, it } from "vitest";
import { applyCommand, counts, normalizePhone } from "./domain";
import { makeSeed } from "./seed";
import type { ActivityInput, LeadInput } from "./types";

const now = new Date("2026-10-20T08:00:00.000Z");
const input: LeadInput = {
  name: "Tài Xế Kiểm Thử",
  phone: "+84 912 345 678",
  city: "Hà Nội",
  vehicle: "Motorbike",
  sourceId: "web",
  tags: [],
  note: "",
};
const activity: ActivityInput = {
  channel: "call",
  at: now.toISOString(),
  outcome: "called",
  decision: "none",
  reason: "none",
  note: "Đã trao đổi điều kiện đăng ký.",
  ticketStatus: "Open",
  attachments: [
    {
      path: "sale-1/fixture/audio",
      name: "call.wav",
      type: "audio/wav",
      size: 20,
    },
    {
      path: "sale-1/fixture/image",
      name: "log.png",
      type: "image/png",
      size: 20,
    },
  ],
};

describe("Hồ sơ và phân quyền", () => {
  it("chuẩn hóa +84 và từ chối trùng cả hồ sơ lưu trữ, không sửa dữ liệu gốc", () => {
    expect(normalizePhone("+84 (912) 345-678")).toBe("0912345678");
    const db = applyCommand(
      makeSeed(now),
      "intake",
      { type: "saveLead", input },
      now,
    );
    const original = structuredClone(db);
    db.leads[0].archived = true;
    expect(() =>
      applyCommand(
        db,
        "intake",
        { type: "saveLead", input: { ...input, phone: "0912345678" } },
        now,
      ),
    ).toThrow("đã có");
    expect(db.leads).toHaveLength(original.leads.length);
  });
  it("Telesale không được sửa hồ sơ hoặc phân công", () => {
    for (const actor of ["sale-1"]) {
      expect(() =>
        applyCommand(makeSeed(now), actor, { type: "saveLead", input }, now),
      ).toThrow("không có quyền");
      expect(() =>
        applyCommand(
          makeSeed(now),
          actor,
          { type: "assign", leadId: "LEAD-0011", assigneeId: "sale-1" },
          now,
        ),
      ).toThrow("trưởng nhóm");
    }
  });
  it("cập nhật hồ sơ giữ ngày tiếp nhận đầu tiên và ghi audit trước/sau", () => {
    const db = makeSeed(now);
    const lead = db.leads[0];
    const updated = applyCommand(
      db,
      "intake",
      {
        type: "saveLead",
        id: lead.id,
        input: { ...lead, note: "Bổ sung giấy tờ" },
      },
      now,
    );
    expect(updated.leads[0].receivedAt).toBe(lead.receivedAt);
    expect(updated.audit[0].detail).toContain('"before"');
    expect(updated.audit[0].detail).toContain('"after"');
    expect(db.leads[0].note).not.toBe("Bổ sung giấy tờ");
  });
  it("không cho nhảy thẳng từ New sang Onboarded", () => {
    expect(() =>
      applyCommand(
        makeSeed(now),
        "intake",
        {
          type: "leadStatus",
          id: "LEAD-0001",
          status: "Onboarded",
          reason: "Thử",
        },
        now,
      ),
    ).toThrow("không hợp lệ");
  });
});
describe("Phân công và hoạt động", () => {
  it("từ chối giao song song; chuyển tạo phiếu mới và giữ nguyên lịch sử cũ", () => {
    const db = makeSeed(now);
    const old = db.assignments[2];
    expect(() =>
      applyCommand(
        db,
        "leader",
        { type: "assign", leadId: old.leadId, assigneeId: "sale-2" },
        now,
      ),
    ).toThrow("đang hiệu lực");
    const next = applyCommand(
      db,
      "leader",
      {
        type: "assign",
        leadId: old.leadId,
        assigneeId: "sale-2",
        transfer: true,
      },
      now,
    );
    expect(next.assignments.find((t) => t.id === old.id)?.status).toBe(
      "Closed",
    );
    expect(next.assignments[0].assigneeId).toBe("sale-2");
    expect(next.activities.filter((a) => !a.appointmentId)).toEqual(
      db.activities,
    );
  });
  it("nhân viên khác không được ghi tư vấn, phiếu Closed không nhận hoạt động", () => {
    const db = makeSeed(now);
    expect(() =>
      applyCommand(
        db,
        "sale-2",
        { type: "activity", assignmentId: "PC-0001", input: activity },
        now,
      ),
    ).toThrow("phiếu của bạn");
    db.assignments[0].status = "Closed";
    expect(() =>
      applyCommand(
        db,
        "sale-1",
        { type: "activity", assignmentId: "PC-0001", input: activity },
        now,
      ),
    ).toThrow("phiếu của bạn");
  });
  it("lần không nghe máy thứ 3 Solved theo quyết định đã chốt", () => {
    let db = makeSeed(now);
    for (let i = 1; i <= 3; i++) {
      db = applyCommand(
        db,
        "sale-1",
        {
          type: "activity",
          assignmentId: "PC-0001",
          input: { ...activity, outcome: "no_answer" },
        },
        now,
      );
      expect(db.assignments.find((t) => t.id === "PC-0001")?.status).toBe(
        i < 3 ? "Open" : "Solved",
      );
    }
    expect(counts(db, "PC-0001").noAnswer).toBe(3);
  });
  it("lịch hẹn không hợp lệ không lưu dở dang Activity hoặc Appointment", () => {
    const db = makeSeed(now);
    const original = structuredClone(db);
    expect(() =>
      applyCommand(
        db,
        "sale-1",
        {
          type: "activity",
          assignmentId: "PC-0001",
          input: {
            ...activity,
            decision: "agreed",
            appointmentAt: "2026-10-19T08:00:00Z",
            place: "văn phòng HN1",
          },
        },
        now,
      ),
    ).toThrow("Lịch hẹn");
    expect(db).toEqual(original);
  });
  it("lịch hẹn tương lai được tạo cùng hoạt động tư vấn", () => {
    const db = makeSeed(now);
    const next = applyCommand(
      db,
      "sale-1",
      {
        type: "activity",
        assignmentId: "PC-0001",
        input: {
          ...activity,
          decision: "agreed",
          appointmentAt: "2026-10-21T08:00:00Z",
          place: "văn phòng HN1",
        },
      },
      now,
    );
    expect(next.appointments[0].activityId).toBe(next.activities[0].id);
    expect(next.assignments[0].status).toBe("Open");
  });
  it("ghi nhận cuộc gọi lưu đúng chiều cuộc gọi và thời lượng", () => {
    const db = makeSeed(now);
    const next = applyCommand(
      db,
      "sale-1",
      {
        type: "activity",
        assignmentId: "PC-0001",
        input: {
          ...activity,
          direction: "inbound",
          durationSeconds: 155,
        },
      },
      now,
    );
    expect(next.activities[0].direction).toBe("inbound");
    expect(next.activities[0].durationSeconds).toBe(155);
  });
  it("nhân viên tiếp nhận được cập nhật ghi chú Lead, telesale không được trực tiếp sửa", () => {
    const db = makeSeed(now);
    const next = applyCommand(
      db,
      "intake",
      {
        type: "leadNote",
        id: "LEAD-0001",
        note: "Tài xế hẹn nộp hồ sơ buổi sáng",
      },
      now,
    );
    expect(next.leads[0].note).toBe("Tài xế hẹn nộp hồ sơ buổi sáng");

    expect(() =>
      applyCommand(
        db,
        "sale-1",
        {
          type: "leadNote",
          id: "LEAD-0001",
          note: "Telesale cố tình sửa ghi chú",
        },
        now,
      ),
    ).toThrow("Chỉ nhân viên tiếp nhận");
  });
  it("không tạm ngưng nhân viên còn phiếu hiệu lực", () => {
    expect(() =>
      applyCommand(
        makeSeed(now),
        "admin",
        { type: "member", id: "sale-1", role: "telesale", active: false },
        now,
      ),
    ).toThrow("Chuyển các phiếu");
  });
});
describe("Ranh giới thời gian và trạng thái", () => {
  it("ngay trước hạn vẫn Open; đúng và sau hạn Closed nhưng Lead vẫn New", () => {
    for (const delta of [-1, 0, 1]) {
      const db = makeSeed(now);
      const t = db.assignments[0];
      t.status = "Open";
      t.expiresAt = now.toISOString();
      const next = applyCommand(
        db,
        "admin",
        { type: "expire" },
        new Date(now.getTime() + delta),
      );
      expect(next.assignments[0].status).toBe(delta < 0 ? "Open" : "Closed");
      expect(next.leads[0].status).toBe("New");
    }
  });
  it("Solved mở lại trong hạn, hết hạn không được mở lại", () => {
    const db = makeSeed(now);
    const t = db.assignments[0];
    t.status = "Solved";
    expect(
      applyCommand(
        db,
        "sale-1",
        {
          type: "ticketStatus",
          id: t.id,
          status: "Open",
          reason: "Tài xế muốn đăng ký lại",
        },
        now,
      ).assignments[0].status,
    ).toBe("Open");
    expect(() =>
      applyCommand(
        db,
        "sale-1",
        { type: "ticketStatus", id: t.id, status: "Open", reason: "Mở lại" },
        new Date(t.expiresAt),
      ),
    ).toThrow("đã đóng");
  });
  it("đăng ký thành công giải quyết phiếu, không làm Lead Closed", () => {
    const next = applyCommand(
      makeSeed(now),
      "intake",
      {
        type: "leadStatus",
        id: "LEAD-0001",
        status: "Activated",
        reason: "Đã đối chiếu đăng ký",
      },
      now,
    );
    expect(next.leads[0].status).toBe("Activated");
    expect(next.assignments[0].status).toBe("Solved");
  });
  it("nhân viên tiếp nhận đối soát lịch hẹn thất bại khi có dữ liệu Onboarding đến muộn", () => {
    const db = makeSeed(now);
    const ap = db.appointments[0];
    ap.status = "failed";
    ap.resultCutoff = new Date(Date.parse(ap.at) + 86400000).toISOString();
    const lead = db.leads.find((l) => l.id === ap.leadId)!;
    lead.activatedAt = ap.at; // Đăng ký ngày hẹn
    db.activities.unshift({
      id: "HEN-RESULT-TEST",
      assignmentId: ap.assignmentId,
      leadId: ap.leadId,
      actorId: "system",
      at: ap.resultCutoff,
      channel: "call",
      outcome: "overdue",
      decision: "none",
      reason: "none",
      note: "Chưa có mốc đăng ký",
      round: 1,
      appointmentId: ap.id,
    });

    const next = applyCommand(
      db,
      "intake",
      {
        type: "reconcileAppointment",
        id: ap.id,
        reason: "Chi nhánh gửi bổ sung biên lai đăng ký trong ngày hẹn",
      },
      now,
    );

    const reconciledAp = next.appointments.find((a) => a.id === ap.id)!;
    expect(reconciledAp.status).toBe("succeeded");
    expect(reconciledAp.resultHistory).toHaveLength(1);
    expect(reconciledAp.resultHistory![0].status).toBe("failed");
    expect(next.activities.find((a) => a.id === "HEN-RESULT-TEST")?.voidedAt).toBeDefined();
  });
});
