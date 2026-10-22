// Facebook Messenger channel for the Lead Sale inbox (Supabase Edge Function).
//   GET  /facebook         webhook verification (hub.challenge)
//   POST /facebook         webhook events from Meta, signed with the App Secret
//   POST /facebook/send    staff reply; caller's Supabase JWT decides permission
// Deploy with JWT verification OFF: Meta cannot send a Supabase token, so the
// webhook is authenticated by X-Hub-Signature-256 and /send checks the JWT itself.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const env = (key: string) => Deno.env.get(key) ?? "";
const GRAPH = `https://graph.facebook.com/${env("FB_GRAPH_VERSION") || "v23.0"}`;
const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function validSignature(raw: string, header: string | null) {
  const secret = env("FB_APP_SECRET");
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)),
  );
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7);
  // Constant-time comparison.
  let diff = hex.length ^ given.length;
  for (let i = 0; i < hex.length; i++)
    diff |= hex.charCodeAt(i) ^ (given.charCodeAt(i) || 0);
  return diff === 0;
}

const names = new Map<string, string>();
async function profileName(psid: string) {
  if (names.has(psid)) return names.get(psid)!;
  try {
    const res = await fetch(
      `${GRAPH}/${psid}?fields=name&access_token=${encodeURIComponent(env("FB_PAGE_ACCESS_TOKEN"))}`,
    );
    const name = res.ok ? ((await res.json()).name ?? "") : "";
    names.set(psid, name);
    return name;
  } catch {
    return "";
  }
}

type Messaging = {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type: string; payload?: { url?: string } }[];
  };
  postback?: { title?: string; payload?: string; mid?: string };
  referral?: { ref?: string; source?: string; ad_id?: string };
};

function describe(m: Messaging) {
  if (m.message?.text) return m.message.text;
  const kinds: Record<string, string> = {
    image: "[Hình ảnh]",
    video: "[Video]",
    audio: "[Ghi âm]",
    file: "[Tệp]",
    location: "[Vị trí]",
  };
  if (m.message?.attachments?.length)
    return m.message.attachments.map((a) => kinds[a.type] ?? "[Đính kèm]").join(" ");
  if (m.postback) return `[Bấm nút] ${m.postback.title ?? m.postback.payload ?? ""}`;
  if (m.referral) return `[Vào từ ${m.referral.source ?? "liên kết"}] ${m.referral.ref ?? ""}`;
  return "";
}

async function receive(event: Messaging) {
  const echo = !!event.message?.is_echo;
  const page = echo ? event.sender.id : event.recipient.id;
  const psid = echo ? event.recipient.id : event.sender.id;
  const body = describe(event);
  if (!body) return; // delivery/read receipts and other non-content events
  const { error } = await service.rpc("lead_inbox_receive", {
    p: {
      channel: "facebook",
      pageId: page,
      externalId: psid,
      name: echo ? "" : await profileName(psid),
      body,
      mid: event.message?.mid ?? event.postback?.mid ?? "",
      direction: echo ? "out" : "in",
      data: {
        at: new Date(event.timestamp).toISOString(),
        attachments: event.message?.attachments ?? [],
        referral: event.referral ?? null,
      },
    },
  });
  if (error) console.error("lead_inbox_receive", error.message);
}

async function send(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Cần đăng nhập." }, 401);
  const { threadId, text } = await req.json().catch(() => ({}));
  const message = String(text ?? "").trim();
  if (!threadId || !message || message.length > 2000)
    return json({ error: "Nhập nội dung từ 1 đến 2000 ký tự." }, 400);
  const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: target, error } = await asUser.rpc("lead_inbox_reply_target", {
    p_thread: threadId,
  });
  if (error) return json({ error: error.message }, 403);
  const last = Date.parse(target.lastInboundAt ?? "");
  if (!Number.isFinite(last) || Date.now() - last > 24 * 3600 * 1000)
    return json(
      {
        error:
          "Đã quá 24 giờ kể từ tin nhắn cuối của tài xế. Facebook không cho gửi tin tự do; hãy gọi điện hoặc chờ tài xế nhắn lại.",
      },
      409,
    );
  const res = await fetch(
    `${GRAPH}/me/messages?access_token=${encodeURIComponent(env("FB_PAGE_ACCESS_TOKEN"))}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: target.psid },
        messaging_type: "RESPONSE",
        message: { text: message },
      }),
    },
  );
  const result = await res.json().catch(() => ({}));
  if (!res.ok)
    return json(
      { error: `Facebook từ chối: ${result?.error?.message ?? res.status}` },
      502,
    );
  // The echo webhook carries the same mid, so this record is not duplicated.
  await service.rpc("lead_inbox_receive", {
    p: {
      channel: "facebook",
      pageId: target.pageId,
      externalId: target.psid,
      body: message,
      mid: result.message_id,
      direction: "out",
      data: { actorId: target.actorId },
    },
  });
  return json({ ok: true });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") {
    const ok =
      url.searchParams.get("hub.mode") === "subscribe" &&
      !!env("FB_VERIFY_TOKEN") &&
      url.searchParams.get("hub.verify_token") === env("FB_VERIFY_TOKEN");
    return ok
      ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 })
      : new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (url.pathname.endsWith("/send")) return send(req);

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("X-Hub-Signature-256"))))
    return new Response("Invalid signature", { status: 401 });
  const payload = JSON.parse(raw);
  if (payload.object !== "page") return new Response("ignored", { status: 200 });
  const allowedPage = env("FB_PAGE_ID");
  for (const entry of payload.entry ?? [])
    for (const event of (entry.messaging ?? []) as Messaging[]) {
      const page = event.message?.is_echo ? event.sender.id : event.recipient.id;
      if (allowedPage && page !== allowedPage) continue;
      await receive(event);
    }
  // Meta retries on non-200; always acknowledge once processed.
  return new Response("EVENT_RECEIVED", { status: 200 });
});
