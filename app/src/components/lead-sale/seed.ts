import type { Database, LeadStatus } from "./types";

export function makeSeed(now = new Date()): Database {
  const ago = (days: number, hours = 0) =>
    new Date(now.getTime() - (days * 24 + hours) * 3600000).toISOString();
  const names = [
    "Nguyễn Văn Minh",
    "Trần Quốc Huy",
    "Lê Thanh Tùng",
    "Phạm Hoàng Nam",
    "Võ Đức Thành",
    "Đặng Minh Khoa",
    "Bùi Văn Hùng",
    "Nguyễn Hữu Phước",
    "Trần Thanh Sơn",
    "Lê Quốc Bảo",
    "Phan Anh Tuấn",
    "Ngô Văn Dũng",
    "Đỗ Thành Đạt",
    "Hoàng Minh Đức",
    "Vũ Văn Long",
    "Dương Quốc Khánh",
    "Lý Hữu Tài",
    "Mai Thanh Bình",
    "Trương Gia Hưng",
    "Hồ Văn Hải",
  ];
  const sources = [
    { id: "web", name: "Form website", active: true },
    { id: "facebook", name: "Chat mạng xã hội", active: true },
    { id: "hotline", name: "Hotline", active: true },
    { id: "referral", name: "Tài xế giới thiệu", active: true },
  ];
  const leads = names.map((name, i) => ({
    id: `LEAD-${String(i + 1).padStart(4, "0")}`,
    name,
    phone: `090${String(1000000 + i)}`,
    city: ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng"][i % 3],
    vehicle: i % 4 === 0 ? ("Van" as const) : ("Motorbike" as const),
    sourceId: sources[i % 4].id,
    status: (i < 13
      ? "New"
      : i < 17
        ? "Activated"
        : i < 19
          ? "Onboarded"
          : "Closed") as LeadStatus,
    receivedAt: ago(i < 3 ? 0 : (i % 10) + 1, 2),
    updatedAt: ago(0, 1),
    tags: i % 3 === 0 ? ["Cần gọi lại"] : [],
    note:
      i % 2 === 0
        ? "Tài xế quan tâm đăng ký, cần tư vấn điều kiện và hồ sơ."
        : "",
    archived: false,
  }));
  const assignments = leads.slice(0, 10).map((lead, i) => ({
    id: `PC-${String(i + 1).padStart(4, "0")}`,
    leadId: lead.id,
    assigneeId: i % 2 === 0 ? "sale-1" : "sale-2",
    assignedBy: "leader",
    createdAt: ago(3, 3),
    updatedAt: ago(0, 1),
    expiresAt: new Date(now.getTime() + (11 * 24 - 3) * 3600000).toISOString(),
    status:
      i < 2
        ? ("New" as const)
        : i === 9
          ? ("Solved" as const)
          : ("Open" as const),
    sequence: i + 1,
    leadSnapshot: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      city: lead.city,
      vehicle: lead.vehicle,
      sourceId: lead.sourceId,
    },
    closeReason: "",
    teamId: "default",
    round: 1,
    acceptedAt: i === 1 ? undefined : ago(3, 2),
  }));
  const activities: Database["activities"] = assignments
    .slice(2)
    .map((t, i) => ({
      id: `HD-${i + 1}`,
      leadId: t.leadId,
      assignmentId: t.id,
      actorId: t.assigneeId,
      channel: i % 3 === 0 ? "zalo" : "call",
      at: ago(0, i + 1),
      outcome: i === 0 || i === 3 ? "no_answer" : "called",
      decision: i === 0 || i === 3 ? "none" : i === 7 ? "declined" : "agreed",
      reason: i === 7 ? "no_need" : "none",
      note:
        i === 0 || i === 3
          ? "Chưa liên hệ được, cần gọi lại vào khung giờ khác."
          : i === 7
            ? "Tài xế không còn nhu cầu đăng ký."
            : "Đã tư vấn giấy tờ cần chuẩn bị. Tài xế đồng ý đến điểm đăng ký.",
    }));
  const appointments: Database["appointments"] = activities
    .filter((a) => a.decision === "agreed")
    .map((a, i) => ({
      id: `HEN-${i + 1}`,
      leadId: a.leadId,
      assignmentId: a.assignmentId,
      activityId: a.id,
      actorId: a.actorId,
      at: new Date(now.getTime() + (i - 1) * 86400000 + 3600000).toISOString(),
      place: "văn phòng HN1",
      createdAt: ago(1),
      round: 1,
      status: "scheduled",
    }));
  return {
    version: 1,
    receptions: [],
    reviews: [],
    notices: [],
    leads,
    assignments,
    activities,
    appointments,
    sources,
    members: [
      { id: "admin", name: "Nguyễn Thu Thảo", role: "admin", active: true },
      { id: "intake", name: "Lê Ngọc Anh", role: "intake", active: true },
      { id: "leader", name: "Trần Minh Trang", role: "leader", active: true },
      { id: "sale-1", name: "Nguyễn Hà Linh", role: "telesale", active: true },
      { id: "sale-2", name: "Phạm Tuấn Anh", role: "telesale", active: true },
      { id: "viewer", name: "Võ Thanh Mai", role: "viewer", active: true },
    ],
    audit: [
      {
        id: "LOG-SEED",
        at: now.toISOString(),
        actorId: "admin",
        action: "Khởi tạo dữ liệu minh họa",
        target: "DEMO",
        detail: "Dữ liệu giả lập phục vụ xem thử, không phải tài xế thật.",
      },
    ],
  };
}
