import { useSyncExternalStore } from "react";
import { applyCommand } from "./domain";
import { makeSeed } from "./seed";
import type { Command, Database } from "./types";

const KEY = "lead-sale.demo.v1";
let snapshot: Database;
let storageError = "";
try {
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
  snapshot = parsed ?? makeSeed();
  if (!raw) localStorage.setItem(KEY, JSON.stringify(snapshot));
} catch {
  snapshot = makeSeed();
  storageError =
    "Không đọc được dữ liệu đã lưu. Đang dùng dữ liệu mẫu; dữ liệu cũ chưa bị ghi đè.";
}
const listeners = new Set<() => void>();
export function getDatabase() {
  return snapshot;
}
export function execute(actorId: string, command: Command) {
  if (storageError)
    throw new Error(
      "Bộ nhớ demo không khả dụng. Sao lưu dữ liệu hoặc dùng trình duyệt cho phép localStorage trước khi chỉnh sửa.",
    );
  const next = applyCommand(snapshot, actorId, command);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error(
      "Không thể lưu vào trình duyệt. Kiểm tra dung lượng hoặc quyền lưu dữ liệu rồi thử lại.",
    );
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
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
