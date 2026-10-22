import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Inbox as InboxIcon,
  Link2,
  MessageCircle,
  PhoneIncoming,
  Plus,
  Send,
  StickyNote,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "./context";
import { canEditLead, normalizePhone } from "./domain";
import {
  Avatar,
  Badge,
  Chip,
  Empty,
  Field,
  formatDate,
  formatTime,
  Guard,
  memberName,
  RowMenu,
  SearchBox,
  textMatches,
  vnDay,
} from "./shared";
import {
  canReplyWindow,
  channelLabels,
  inboxCommand,
  sendMessengerReply,
  threadStatusLabels,
  useInbox,
  type Channel,
  type Thread,
  type ThreadStatus,
} from "./inbox-store";
import type { LeadInput } from "./types";

const channelIcon = (c: Channel) =>
  c === "hotline" ? PhoneIncoming : MessageCircle;
const when = (iso: string) =>
  vnDay(iso) === vnDay(new Date())
    ? formatTime(iso)
    : formatDate(iso).slice(0, 5);
const sourceFor = (c: Channel, sources: { id: string; active: boolean }[]) => {
  const preferred = { facebook: "facebook", hotline: "hotline", form: "web" }[
    c
  ];
  return (
    sources.find((s) => s.id === preferred && s.active)?.id ??
    sources.find((s) => s.active)?.id ??
    ""
  );
};

function HotlineDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { actor } = useWorkspace();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [missed, setMissed] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ghi cuộc gọi đến hotline</DialogTitle>
          <DialogDescription>
            Cuộc gọi được đưa vào Hộp thư để kiểm tra trùng và tạo hồ sơ.
          </DialogDescription>
        </DialogHeader>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await inboxCommand(
                { type: "hotline", phone, name, note, missed },
                actor.id,
              );
              toast.success("Đã ghi cuộc gọi vào Hộp thư.");
              setPhone("");
              setName("");
              setNote("");
              setMissed(false);
              onOpenChange(false);
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Field label="Số điện thoại gọi đến *">
            <Input
              required
              type="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901234567"
            />
          </Field>
          <Field label="Tên người gọi">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={missed}
              onChange={(e) => setMissed(e.target.checked)}
            />
            Cuộc gọi nhỡ — cần gọi lại
          </label>
          <Field label="Nội dung">
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tài xế hỏi gì, muốn chạy xe gì, ở đâu…"
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              Lưu vào Hộp thư
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Right column: find the driver's record by phone, then link or create. */
function LeadMatch({ thread }: { thread: Thread }) {
  const { db, actor, run, busy } = useWorkspace();
  const [phone, setPhone] = useState(thread.phone ?? "");
  const [pendingPhone, setPendingPhone] = useState("");
  const [form, setForm] = useState<LeadInput>({
    name: thread.name,
    phone: thread.phone ?? "",
    city: "",
    vehicle: "Motorbike",
    sourceId: sourceFor(thread.channel, db.sources),
    tags: [],
    note: "",
  });
  useEffect(() => setPhone(thread.phone ?? ""), [thread.id, thread.phone]);
  const normalized = normalizePhone(thread.phone ?? "");
  const match = normalized
    ? db.leads.find((l) => normalizePhone(l.phone) === normalized)
    : undefined;
  const linked = db.leads.find((l) => l.id === thread.lead_id);
  // After "Tạo lead" the new record arrives with the next snapshot; link it then.
  useEffect(() => {
    if (!pendingPhone) return;
    const created = db.leads.find(
      (l) => normalizePhone(l.phone) === pendingPhone,
    );
    if (!created) return;
    setPendingPhone("");
    void inboxCommand(
      { type: "link", id: thread.id, leadId: created.id },
      actor.id,
    ).catch((e) => toast.error((e as Error).message));
  }, [db.leads, pendingPhone, thread.id, actor.id]);
  const set = <K extends keyof LeadInput>(k: K, v: LeadInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  if (linked)
    return (
      <section className="panel">
        <div className="panel-head">
          <h2>Hồ sơ đã gắn</h2>
        </div>
        <div className="panel-body stack-form">
          <span className="person">
            <Avatar name={linked.name} />
            <span>
              <strong>{linked.name}</strong>
              <small className="muted">
                {linked.phone} · {linked.id}
              </small>
            </span>
          </span>
          <Badge status={linked.status} />
          <Button asChild variant="outline">
            <Link to={`/leads/${linked.id}/show`}>Mở hồ sơ</Link>
          </Button>
        </div>
      </section>
    );

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Hồ sơ tài xế</h2>
      </div>
      <div className="panel-body stack-form">
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await inboxCommand(
                { type: "phone", id: thread.id, phone },
                actor.id,
              );
              set("phone", phone);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <Input
            aria-label="Số điện thoại của tài xế"
            type="tel"
            placeholder="Nhập SĐT tài xế để kiểm tra"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button variant="outline" size="sm" type="submit">
            Kiểm tra
          </Button>
        </form>
        {!thread.phone && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {thread.channel === "facebook"
              ? "Messenger không gửi số điện thoại. Hỏi SĐT trong hội thoại rồi nhập vào đây."
              : "Nhập số điện thoại để kiểm tra trùng."}
          </p>
        )}
        {match && (
          <div className="callout info">
            <Link2 size={16} />
            <span>
              Số này đã có hồ sơ{" "}
              <Link to={`/leads/${match.id}/show`}>{match.name}</Link> (
              {match.id}).
            </span>
          </div>
        )}
        {match && canEditLead(actor) && (
          <Button
            disabled={busy}
            onClick={async () => {
              try {
                await inboxCommand(
                  { type: "link", id: thread.id, leadId: match.id },
                  actor.id,
                );
                if (match.status === "New" || match.status === "Closed")
                  await run(
                    {
                      type: "receiveLead",
                      id: match.id,
                      sourceId: sourceFor(thread.channel, db.sources),
                      reason:
                        `Liên hệ lại qua ${channelLabels[thread.channel]}: ${thread.last_text}`.slice(
                          0,
                          500,
                        ),
                    },
                    "Đã gắn hội thoại và ghi lần tiếp nhận mới.",
                  );
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <Link2 /> Gắn vào hồ sơ này
          </Button>
        )}
        {thread.phone && !match && canEditLead(actor) && (
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                {
                  type: "saveLead",
                  input: { ...form, phone: thread.phone! },
                },
                "Đã tạo hồ sơ Lead từ hội thoại.",
              );
              if (ok) setPendingPhone(normalized);
            }}
          >
            <div className="callout ok">
              <CheckCircle2 size={16} /> Số mới — chưa có hồ sơ.
            </div>
            <Field label="Họ tên *">
              <Input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Thành phố đăng ký *">
              <Input
                required
                list="inbox-cities"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
            <datalist id="inbox-cities">
              <option>Hồ Chí Minh</option>
              <option>Hà Nội</option>
              <option>Đà Nẵng</option>
            </datalist>
            <Field label="Loại xe *">
              <select
                value={form.vehicle}
                onChange={(e) =>
                  set("vehicle", e.target.value as LeadInput["vehicle"])
                }
              >
                <option value="Motorbike">Xe máy</option>
                <option value="Van">Xe Van</option>
              </select>
            </Field>
            <Field label="Nguồn *">
              <select
                required
                value={form.sourceId}
                onChange={(e) => set("sourceId", e.target.value)}
              >
                {db.sources
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Button type="submit" disabled={busy || !!pendingPhone}>
              <UserPlus /> {pendingPhone ? "Đang gắn hồ sơ…" : "Tạo lead"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

function Conversation({ thread }: { thread: Thread }) {
  const { db, actor } = useWorkspace();
  const { data } = useInbox(false);
  const [mode, setMode] = useState<"reply" | "note">(
    thread.channel === "facebook" ? "reply" : "note",
  );
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const messages = data.messages.filter((m) => m.thread_id === thread.id);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, thread.id]);
  useEffect(() => {
    setMode(thread.channel === "facebook" ? "reply" : "note");
    setText("");
    if (thread.unread)
      void inboxCommand({ type: "read", id: thread.id }, actor.id);
  }, [thread.id]);
  const replyOpen = canReplyWindow(thread);
  const Icon = channelIcon(thread.channel);
  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      if (mode === "reply") await sendMessengerReply(thread.id, text);
      else
        await inboxCommand(
          { type: "note", id: thread.id, body: text },
          actor.id,
        );
      setText("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };
  return (
    <section className="panel conv">
      <header className="conv-head">
        <Avatar name={thread.name || thread.phone || "?"} />
        <div>
          <strong>
            {thread.name || thread.phone || "Người dùng Messenger"}
          </strong>
          <small className="muted">
            <Icon size={13} /> {channelLabels[thread.channel]}
            {thread.phone && ` · ${thread.phone}`} · bắt đầu{" "}
            {formatDate(thread.created_at, true)}
          </small>
        </div>
        <Chip
          tone={
            thread.status === "linked"
              ? "solved"
              : thread.status === "open"
                ? "new"
                : "closed"
          }
        >
          {threadStatusLabels[thread.status]}
        </Chip>
        <RowMenu
          label="hội thoại"
          items={[
            ...(thread.status !== "spam"
              ? [
                  {
                    label: "Đánh dấu rác",
                    danger: true,
                    onSelect: () =>
                      void inboxCommand(
                        { type: "status", id: thread.id, status: "spam" },
                        actor.id,
                      ),
                  },
                ]
              : []),
            ...(thread.status !== "closed"
              ? [
                  {
                    label: "Đóng hội thoại",
                    onSelect: () =>
                      void inboxCommand(
                        { type: "status", id: thread.id, status: "closed" },
                        actor.id,
                      ),
                  },
                ]
              : []),
            ...(thread.status === "spam" || thread.status === "closed"
              ? [
                  {
                    label: "Mở lại",
                    onSelect: () =>
                      void inboxCommand(
                        { type: "status", id: thread.id, status: "open" },
                        actor.id,
                      ),
                  },
                ]
              : []),
          ]}
        />
      </header>
      <div className="conv-body">
        {messages.map((m) =>
          m.direction === "system" ? (
            <p className="msg-system" key={m.id}>
              {m.body} · {memberName(db, String(m.actor_id ?? ""))} ·{" "}
              {formatDate(m.at, true)}
            </p>
          ) : (
            <div className={`msg msg-${m.direction}`} key={m.id}>
              <div className="msg-bubble">{m.body}</div>
              <small>
                {m.direction === "in"
                  ? thread.name || "Tài xế"
                  : m.direction === "note"
                    ? `Ghi chú nội bộ · ${memberName(db, String(m.actor_id ?? ""))}`
                    : m.actor_id
                      ? memberName(db, String(m.actor_id))
                      : "Trang (Meta Business Suite)"}{" "}
                · {formatDate(m.at, true)}
                {m.status === "failed" && " · Gửi lỗi"}
              </small>
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      <footer className="composer">
        <div className="composer-tabs" role="tablist">
          {thread.channel === "facebook" && (
            <button
              role="tab"
              aria-selected={mode === "reply"}
              className={mode === "reply" ? "active" : ""}
              onClick={() => setMode("reply")}
            >
              <Send size={14} /> Trả lời
            </button>
          )}
          <button
            role="tab"
            aria-selected={mode === "note"}
            className={mode === "note" ? "active" : ""}
            onClick={() => setMode("note")}
          >
            <StickyNote size={14} /> Ghi chú nội bộ
          </button>
          {mode === "reply" && !replyOpen && (
            <span className="warning-text">
              Quá 24 giờ từ tin cuối của tài xế — Facebook không cho gửi tin tự
              do.
            </span>
          )}
        </div>
        <Textarea
          className={mode === "note" ? "note-input" : ""}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
          }}
          placeholder={
            mode === "reply"
              ? "Nhập tin nhắn gửi tài xế… (Ctrl+Enter để gửi)"
              : "Ghi chú chỉ nhân viên thấy… (Ctrl+Enter để lưu)"
          }
          disabled={mode === "reply" && !replyOpen}
        />
        <div className="composer-actions">
          <Button
            disabled={
              sending || !text.trim() || (mode === "reply" && !replyOpen)
            }
            onClick={() => void submit()}
          >
            {mode === "reply" ? (
              <>
                <Send /> Gửi
              </>
            ) : (
              <>
                <StickyNote /> Lưu ghi chú
              </>
            )}
          </Button>
        </div>
      </footer>
    </section>
  );
}

const otherStatuses: ThreadStatus[] = ["linked", "spam", "closed"];

export function InboxPage() {
  const { actor } = useWorkspace();
  const allowed = ["admin", "intake"].includes(actor.role);
  const { data, error, loaded } = useInbox(allowed);
  const [tab, setTab] = useState<"open" | "all">("open");
  const [other, setOther] = useState<ThreadStatus | "">("");
  const status: ThreadStatus | "all" = tab === "open" ? "open" : other || "all";
  const [channel, setChannel] = useState<Channel | "">("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState("");
  const [hotline, setHotline] = useState(false);
  const threads = useMemo(
    () =>
      data.threads
        .filter(
          (t) =>
            (status === "all" || t.status === status) &&
            (!channel || t.channel === channel) &&
            textMatches(q, t.name, t.phone ?? "", t.last_text),
        )
        .sort((a, b) => b.last_at.localeCompare(a.last_at)),
    [data.threads, status, channel, q],
  );
  const current =
    data.threads.find((t) => t.id === selected) ?? threads[0] ?? undefined;
  const count = (s: ThreadStatus | "all") =>
    data.threads.filter((t) => s === "all" || t.status === s).length;
  return (
    <Guard allowed={allowed}>
      <header className="page-head">
        <div>
          <h1>Hộp thư</h1>
          <p>
            Tin nhắn Messenger và cuộc gọi hotline đổ về một chỗ. Kiểm tra
            trùng, tạo hồ sơ hoặc gắn vào hồ sơ có sẵn.
          </p>
        </div>
        <div className="page-actions">
          <Button onClick={() => setHotline(true)}>
            <Plus /> Ghi cuộc gọi đến
          </Button>
        </div>
      </header>
      {error && (
        <div className="form-error" role="alert" style={{ marginBottom: 12 }}>
          Không tải được Hộp thư: {error}{" "}
          <Button variant="link" size="sm" onClick={() => location.reload()}>
            Thử lại
          </Button>
        </div>
      )}
      <div className="inbox">
        <section className="panel inbox-list">
          <div className="tabs">
            {(["open", "all"] as const).map((s) => (
              <button
                key={s}
                className={tab === s ? "active" : ""}
                onClick={() => setTab(s)}
              >
                {s === "all" ? "Tất cả" : threadStatusLabels.open}
                <span className="count">{count(s)}</span>
              </button>
            ))}
          </div>
          <div className="toolbar">
            <SearchBox
              className="grow"
              value={q}
              onChange={setQ}
              placeholder="Tìm tên, SĐT, nội dung…"
            />
            {tab === "all" && (
              <select
                aria-label="Lọc trạng thái"
                value={other}
                onChange={(e) => setOther(e.target.value as ThreadStatus | "")}
              >
                <option value="">Mọi trạng thái</option>
                {otherStatuses.map((s) => (
                  <option key={s} value={s}>
                    {threadStatusLabels[s]} ({count(s)})
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="Lọc kênh"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel | "")}
            >
              <option value="">Mọi kênh</option>
              <option value="facebook">Messenger</option>
              <option value="hotline">Hotline</option>
            </select>
          </div>
          <div className="thread-list" role="listbox" aria-label="Hội thoại">
            {threads.map((t) => {
              const Icon = channelIcon(t.channel);
              return (
                <button
                  key={t.id}
                  role="option"
                  aria-selected={current?.id === t.id}
                  className={`thread ${current?.id === t.id ? "active" : ""} ${t.unread ? "unread" : ""}`}
                  onClick={() => setSelected(t.id)}
                >
                  <Avatar name={t.name || t.phone || "?"} size="sm" />
                  <span className="thread-main">
                    <span className="thread-top">
                      <strong>
                        {t.name || t.phone || "Người dùng Messenger"}
                      </strong>
                      <time>{when(t.last_at)}</time>
                    </span>
                    <span className="thread-text">
                      <Icon size={12} /> {t.last_text || "—"}
                    </span>
                  </span>
                  {t.unread > 0 && (
                    <span className="thread-badge">{t.unread}</span>
                  )}
                </button>
              );
            })}
            {loaded && !threads.length && (
              <Empty
                icon={InboxIcon}
                title="Không có hội thoại"
                description={
                  status === "open"
                    ? "Đã xử lý hết. Tin nhắn mới sẽ hiện ở đây."
                    : "Thử chọn trạng thái hoặc kênh khác."
                }
              />
            )}
          </div>
        </section>
        {current ? (
          <>
            <Conversation thread={current} key={current.id} />
            <div className="inbox-side">
              <LeadMatch
                thread={current}
                key={`${current.id}-${current.phone}`}
              />
              {current.status === "spam" && (
                <p className="callout">
                  <Ban size={16} /> Hội thoại đã đánh dấu rác.
                </p>
              )}
            </div>
          </>
        ) : (
          <section className="panel inbox-empty">
            <Empty
              icon={InboxIcon}
              title={loaded ? "Chọn một hội thoại" : "Đang tải Hộp thư…"}
              description="Chọn hội thoại ở cột trái để xem nội dung và xử lý."
            />
          </section>
        )}
      </div>
      <HotlineDialog open={hotline} onOpenChange={setHotline} />
    </Guard>
  );
}
