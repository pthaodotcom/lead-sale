import { useEffect, useSyncExternalStore } from "react";
import { demoMode, supabase } from "./backend";
import { normalizePhone } from "./domain";

export type Channel = "facebook" | "hotline" | "form";
export type ThreadStatus = "open" | "linked" | "spam" | "closed";
export interface Thread {
  id: string;
  channel: Channel;
  page_id: string;
  external_id: string;
  name: string;
  phone: string | null;
  status: ThreadStatus;
  lead_id: string | null;
  unread: number;
  last_text: string;
  last_at: string;
  last_inbound_at: string | null;
  created_at: string;
}
export interface InboxMessage {
  id: string;
  thread_id: string;
  direction: "in" | "out" | "note" | "system";
  body: string;
  actor_id: number | string | null;
  status: "sent" | "failed" | "pending";
  at: string;
}
export interface InboxData {
  threads: Thread[];
  messages: InboxMessage[];
}
export type InboxCommand =
  | { type: "read"; id: string }
  | { type: "note"; id: string; body: string }
  | { type: "status"; id: string; status: "open" | "spam" | "closed" }
  | { type: "phone"; id: string; phone: string }
  | { type: "link"; id: string; leadId: string }
  | {
      type: "hotline";
      phone: string;
      name: string;
      note: string;
      missed: boolean;
    };

export const channelLabels: Record<Channel, string> = {
  facebook: "Messenger",
  hotline: "Hotline",
  form: "Form web",
};
export const threadStatusLabels: Record<ThreadStatus, string> = {
  open: "Chưa xử lý",
  linked: "Đã gắn hồ sơ",
  spam: "Rác",
  closed: "Đã đóng",
};

/* ---------- demo store (browser only, clearly a preview) ---------- */
const DEMO_KEY = "lead-sale.inbox.demo.v1";
const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60000).toISOString();
function demoSeed(): InboxData {
  const t = (
    id: string,
    channel: Channel,
    name: string,
    phone: string | null,
    minutes: number,
    unread: number,
    status: ThreadStatus = "open",
  ): Thread => ({
    id,
    channel,
    page_id: channel === "facebook" ? "demo-page" : "",
    external_id: id,
    name,
    phone,
    status,
    lead_id: null,
    unread,
    last_text: "",
    last_at: ago(minutes),
    last_inbound_at: ago(minutes),
    created_at: ago(minutes + 30),
  });
  const threads = [
    t("HT-DEMO-1", "facebook", "Nguyễn Văn Tú", null, 6, 2),
    t("HT-DEMO-2", "hotline", "", "0901000002", 25, 1),
    t("HT-DEMO-3", "facebook", "Lê Thị Hoa", "0912345678", 48, 0),
    t("HT-DEMO-4", "facebook", "Mua bán sim số đẹp", null, 300, 0, "spam"),
  ];
  const m = (
    id: string,
    thread: string,
    direction: InboxMessage["direction"],
    body: string,
    minutes: number,
  ): InboxMessage => ({
    id,
    thread_id: thread,
    direction,
    body,
    actor_id: direction === "out" || direction === "note" ? "intake" : null,
    status: "sent",
    at: ago(minutes),
  });
  const messages = [
    m(
      "M1",
      "HT-DEMO-1",
      "in",
      "Chào shop, mình muốn chạy xe tải Van ở HCM thì cần giấy tờ gì ạ?",
      9,
    ),
    m("M2", "HT-DEMO-1", "in", "Mình có xe Van 500kg rồi", 6),
    m("M3", "HT-DEMO-2", "in", "Cuộc gọi nhỡ", 25),
    m("M4", "HT-DEMO-3", "in", "Em ở Hà Nội, muốn đăng ký chạy xe máy", 60),
    m(
      "M5",
      "HT-DEMO-3",
      "out",
      "Chào chị Hoa, chị cho em xin số điện thoại để bên em gọi tư vấn nhé.",
      55,
    ),
    m("M6", "HT-DEMO-3", "in", "0912345678", 48),
    m("M7", "HT-DEMO-4", "in", "Bán sim số đẹp giá rẻ, liên hệ ngay", 300),
  ];
  for (const th of threads)
    th.last_text =
      messages.filter((x) => x.thread_id === th.id).at(-1)?.body ?? "";
  return { threads, messages };
}
function demoLoad(): InboxData {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to seed */
  }
  const seed = demoSeed();
  demoSave(seed);
  return seed;
}
function demoSave(data: InboxData) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  } catch {
    /* preview only */
  }
}
function demoApply(data: InboxData, c: InboxCommand, actorId: string) {
  const now = new Date().toISOString();
  const msg = (
    thread: string,
    direction: InboxMessage["direction"],
    body: string,
  ) =>
    data.messages.push({
      id: `TM-${crypto.randomUUID()}`,
      thread_id: thread,
      direction,
      body,
      actor_id: actorId,
      status: "sent",
      at: now,
    });
  if (c.type === "hotline") {
    const phone = normalizePhone(c.phone);
    if (!/^0\d{9}$/.test(phone))
      throw new Error("Số điện thoại cần 10 chữ số, bắt đầu bằng 0.");
    let th = data.threads.find(
      (x) => x.channel === "hotline" && x.external_id === phone,
    );
    const body = c.note.trim() || (c.missed ? "Cuộc gọi nhỡ" : "Cuộc gọi đến");
    if (!th) {
      th = {
        id: `HT-${crypto.randomUUID()}`,
        channel: "hotline",
        page_id: "",
        external_id: phone,
        name: c.name.trim(),
        phone,
        status: "open",
        lead_id: null,
        unread: 0,
        last_text: "",
        last_at: now,
        last_inbound_at: now,
        created_at: now,
      };
      data.threads.unshift(th);
    }
    th.last_text = body;
    th.last_at = now;
    th.unread += 1;
    if (c.name.trim()) th.name = c.name.trim();
    msg(th.id, "in", body);
    return;
  }
  const th = data.threads.find((x) => x.id === c.id);
  if (!th) throw new Error("Không tìm thấy hội thoại.");
  if (c.type === "read") th.unread = 0;
  if (c.type === "note") {
    if (!c.body.trim()) throw new Error("Nhập nội dung ghi chú.");
    msg(th.id, "note", c.body.trim());
  }
  if (c.type === "status") {
    th.status = c.status;
    th.unread = 0;
    msg(
      th.id,
      "system",
      {
        spam: "Đánh dấu rác",
        closed: "Đóng hội thoại",
        open: "Mở lại hội thoại",
      }[c.status],
    );
  }
  if (c.type === "phone") {
    const phone = normalizePhone(c.phone);
    if (!/^0\d{9}$/.test(phone))
      throw new Error("Số điện thoại cần 10 chữ số, bắt đầu bằng 0.");
    th.phone = phone;
  }
  if (c.type === "link") {
    th.lead_id = c.leadId;
    th.status = "linked";
    th.unread = 0;
    msg(th.id, "system", `Gắn vào hồ sơ ${c.leadId}`);
  }
}

/* ---------- shared store with polling ---------- */
let state: { data: InboxData; error: string; loaded: boolean } = {
  data: { threads: [], messages: [] },
  error: "",
  loaded: false,
};
const listeners = new Set<() => void>();
const emit = (next: Partial<typeof state>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
export async function refreshInbox() {
  try {
    if (demoMode || !supabase) {
      emit({ data: demoLoad(), loaded: true, error: "" });
      return;
    }
    const { data, error } = await supabase.rpc("lead_inbox_snapshot");
    if (error) throw new Error(error.message);
    emit({ data, loaded: true, error: "" });
  } catch (e) {
    emit({ loaded: true, error: (e as Error).message });
  }
}
export async function inboxCommand(command: InboxCommand, actorId: string) {
  if (demoMode || !supabase) {
    const data = demoLoad();
    demoApply(data, command, actorId);
    demoSave(data);
    emit({ data });
    return;
  }
  const { error } = await supabase.rpc("lead_inbox_command", { p: command });
  if (error) throw new Error(error.message);
  await refreshInbox();
}
export async function sendMessengerReply(threadId: string, text: string) {
  if (demoMode || !supabase)
    throw new Error(
      "Bản xem thử không kết nối Facebook. Gửi tin thật cần chạy với Supabase và webhook đã cài.",
    );
  const { data } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook/send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ threadId, text }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Gửi thất bại (${res.status}).`);
  await refreshInbox();
}

let pollers = 0;
let timer: ReturnType<typeof setInterval> | undefined;
/** Inbox data shared by the nav badge and the inbox page; one 20s poll. */
export function useInbox(enabled: boolean) {
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => {
    if (!enabled) return;
    if (pollers++ === 0) {
      void refreshInbox();
      timer = setInterval(() => void refreshInbox(), 20000);
    }
    return () => {
      if (--pollers === 0) clearInterval(timer);
    };
  }, [enabled]);
  return snapshot;
}

export const canReplyWindow = (t: Thread) =>
  t.channel === "facebook" &&
  !!t.last_inbound_at &&
  Date.now() - Date.parse(t.last_inbound_at) < 24 * 3600 * 1000;
