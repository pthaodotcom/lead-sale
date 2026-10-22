import { useSyncExternalStore } from "react";
import { applyCommand, leadLabels, normalizePhone } from "./domain";
import type { IntakeInput } from "./public-intake";
import { makeSeed } from "./seed";
import type { Command, Database } from "./types";

const KEY = "lead-sale.demo.v1";
let snapshot: Database;
let storageError = "";
try {
  const enabled = import.meta.env.VITE_DEMO_MODE === "true";
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : null;
  if (
    parsed &&
    (parsed.version !== 1 ||
      ![
        "leads",
        "assignments",
        "activities",
        "appointments",
        "members",
        "sources",
        "audit",
      ].every((k) => Array.isArray(parsed[k])))
  )
    throw new Error("Định dạng dữ liệu không hợp lệ");
  snapshot = enabled
    ? (parsed ?? makeSeed())
    : {
        version: 1,
        leads: [],
        assignments: [],
        activities: [],
        appointments: [],
        members: [],
        sources: [],
        audit: [],
        receptions: [],
        reviews: [],
        notices: [],
      };
  snapshot.receptions ??= [];
  snapshot.reviews ??= [];
  snapshot.notices ??= [];
  if (enabled && !raw) localStorage.setItem(KEY, JSON.stringify(snapshot));
} catch {
  snapshot = makeSeed();
  storageError =
    "Không đọc được dữ liệu đã lưu. Đang dùng dữ liệu mẫu; dữ liệu cũ chưa bị ghi đè.";
}
const listeners = new Set<() => void>();
function applyLabels(db: Database) {
  for (const s of db.statusCatalog ?? [])
    if (s.code in leadLabels)
      leadLabels[s.code as keyof typeof leadLabels] = s.label;
}
applyLabels(snapshot);
export function getDatabase() {
  return snapshot;
}
export function execute(actorId: string, command: Command) {
  if (storageError)
    throw new Error(
      "Bộ nhớ demo không khả dụng. Sao lưu dữ liệu hoặc dùng trình duyệt cho phép localStorage trước khi chỉnh sửa.",
    );
  const next = applyCommand(snapshot, actorId, command);
  persist(next);
}
function persist(next: Database) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error(
      "Không thể lưu vào trình duyệt. Kiểm tra dung lượng hoặc quyền lưu dữ liệu rồi thử lại.",
    );
  }
  snapshot = next;
  applyLabels(snapshot);
  listeners.forEach((listener) => listener());
}
export function receiveDemoIntake(input: IntakeInput) {
  if (import.meta.env.VITE_DEMO_MODE !== "true" || storageError)
    throw new Error("Bộ nhớ xem thử không khả dụng.");
  const next = structuredClone(snapshot);
  const at = new Date().toISOString();
  const phone = normalizePhone(input.phone);
  const existing = next.leads.find((lead) => lead.phone === phone);
  const leadId = existing?.id ?? `LEAD-${crypto.randomUUID()}`;
  const note = `Tài xế tự đăng ký: ${input.name} · ${input.city} · ${input.vehicle === "Van" ? "Xe Van" : "Xe máy"}. Quận/huyện: ${input.district || "Chưa cung cấp"}. Tiện liên hệ: ${{ any: "Bất kỳ lúc nào", morning: "Buổi sáng", afternoon: "Buổi chiều", evening: "Buổi tối" }[input.callTime]}. ${input.note}`;
  if (!existing)
    next.leads.unshift({
      id: leadId,
      name: input.name.trim(),
      phone,
      city: input.city.trim(),
      vehicle: input.vehicle,
      sourceId: "web",
      tags: [],
      note: input.note.trim(),
      status: "New",
      archived: false,
      receivedAt: at,
      updatedAt: at,
      version: 1,
      profile: {
        district: input.district,
        hasVehicle: input.hasVehicle,
        callTime: input.callTime,
        documents: input.documents,
      },
    });
  next.receptions.unshift({
    id: `TN-${crypto.randomUUID()}`,
    leadId,
    sourceId: "web",
    actorId: "public-form",
    at,
    note,
  });
  next.audit.unshift({
    id: `LOG-${crypto.randomUUID()}`,
    actorId: "public-form",
    at,
    action: "publicIntake",
    target: leadId,
    detail: note,
  });
  for (const member of next.members.filter(
    (m) => m.active && ["intake", "admin"].includes(m.role),
  ))
    next.notices.unshift({
      id: `NOT-${crypto.randomUUID()}`,
      recipientId: member.id,
      at,
      href: `/leads/${leadId}/show`,
      title: existing
        ? "Tài xế gửi lại đăng ký qua form website"
        : "Đăng ký tài xế mới từ form website",
    });
  persist(next);
}
export function useDatabase() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => snapshot,
  );
}
export function getStorageError() {
  return storageError;
}
window.addEventListener("storage", (event) => {
  if (event.key !== KEY) return;
  // Avoid overwriting a second tab's changes with stale in-memory state.
  window.location.reload();
});
