import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  AlarmClock,
  ArrowLeft,
  CalendarDays,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  RotateCcw,
  Save,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "./context";
import { AssignmentDialog } from "./AssignmentDialog";
import { Evidence, EvidenceUpload } from "./Evidence";
import {
  AppointmentActions,
  appointmentLabels,
  appointmentTone,
} from "./Appointments";
import { TicketTable } from "./TicketTable";
import { ReopenTicketDialog } from "./ReopenTicketDialog";
import { ticketCode } from "./workflow";
import { offices } from "./catalog";
import {
  Avatar,
  Badge,
  Chip,
  Empty,
  Field,
  formatDate,
  Guard,
  localDateTime,
  memberName,
  PageHeading,
  Panel,
  relativeDeadline,
  SearchBox,
  sourceName,
  textMatches,
  vehicleLabel,
  vnDay,
} from "./shared";
import {
  canAssign,
  canReadLead,
  canWork,
  counts,
  decisionLabels,
  isLive,
  isPending,
  outcomeLabels,
  reasonLabels,
  ticketLabels,
} from "./domain";
import { inGroup, taskGroups, visibleTickets, type TaskGroup } from "./tasks";
import type { ActivityInput, Attachment, TicketStatus } from "./types";

export function TasksPage() {
  const { db, actor } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const group = (params.get("group") ?? "pending") as TaskGroup;
  const [q, setQ] = useState("");
  const [member, setMember] = useState("");
  const [deadline, setDeadline] = useState("");
  const tickets = visibleTickets(db, actor);
  const scoped = tickets.filter((t) => !member || t.assigneeId === member);
  const selected = taskGroups.find((g) => g.id === group) ?? taskGroups[0];
  const rows = scoped
    .filter((t) => {
      const l = db.leads.find((l) => l.id === t.leadId);
      return (
        inGroup(db, t, selected.id) &&
        (!deadline || vnDay(t.expiresAt) <= deadline) &&
        textMatches(q, t.id, ticketCode(t), l?.name ?? "", l?.phone ?? "")
      );
    })
    .sort((a, b) =>
      selected.id === "pending" || selected.id.startsWith("no_answer")
        ? a.expiresAt.localeCompare(b.expiresAt)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const leader = canAssign(actor);
  return (
    <Guard allowed={["telesale", "leader"].includes(actor.role)}>
      <PageHeading
        title="Nhiệm vụ"
        action={leader && <AssignmentDialog />}
      />
      <div className="tasks-layout">
        <nav className="panel queue-nav" aria-label="Nhóm phiếu">
          {taskGroups.map((g) => {
            const n = scoped.filter((t) => inGroup(db, t, g.id)).length;
            return (
              <div key={g.id} style={{ display: "contents" }}>
                {"divider" in g && <hr />}
                <button
                  className={`${selected.id === g.id ? "active" : ""} ${"child" in g ? "child" : ""} ${n ? "" : "zero"}`}
                  aria-current={selected.id === g.id ? "true" : undefined}
                  onClick={() => setParams({ group: g.id })}
                >
                  <span>{g.name}</span>
                  <span className="count">{n}</span>
                </button>
              </div>
            );
          })}
        </nav>
        <section className="panel">
          <div className="panel-head">
            <h2>{selected.name}</h2>
            <span>{rows.length} phiếu</span>
          </div>
          <div className="toolbar">
            <SearchBox
              className="grow"
              value={q}
              onChange={setQ}
              placeholder="Tìm mã phiếu, tên hoặc SĐT…"
            />
            {leader && (
              <select
                aria-label="Lọc nhân viên"
                value={member}
                onChange={(e) => setMember(e.target.value)}
              >
                <option value="">Tất cả nhân viên</option>
                {db.members
                  .filter(
                    (m) =>
                      m.role === "telesale" &&
                      (actor.role === "admin" ||
                        (m.teamId ?? "default") ===
                          (actor.teamId ?? "default")),
                  )
                  .map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            )}
            <input
              type="date"
              aria-label="Hạn xử lý đến ngày"
              title="Hạn xử lý đến ngày"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <TicketTable tickets={rows} />
        </section>
      </div>
    </Guard>
  );
}

const blankForm = (): ActivityInput => ({
  channel: "call",
  at: localDateTime(undefined, true),
  outcome: "called",
  decision: "none",
  reason: "none",
  note: "",
  appointmentAt: "",
  place: "",
});

function LogForm({ ticketId }: { ticketId: string }) {
  const { db, actor, run, busy } = useWorkspace();
  const [form, setForm] = useState<ActivityInput>(blankForm);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof ActivityInput>(
    key: K,
    value: ActivityInput[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));
  const outcomes = Object.entries(outcomeLabels).filter(
    ([key]) =>
      key !== "overdue" &&
      (form.channel === "zalo" ? key !== "no_answer" : key !== "unresponsive"),
  );
  return (
    <form
      className="panel log-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = db.assignments.find((a) => a.id === ticketId);
        if (t && !t.acceptedAt && t.assigneeId === actor.id) {
          await run({ type: "accept", id: ticketId });
        }
        if (
          await run(
            {
              type: "activity",
              assignmentId: ticketId,
              input: { ...form, attachments },
            },
            "Đã ghi nhận lần liên hệ và trạng thái phiếu.",
          )
        ) {
          setForm(blankForm());
          setAttachments([]);
        }
      }}
    >
      <div className="panel-head">
        <h2>Ghi nhận liên hệ</h2>
      </div>
      <div className="panel-body">
        <div className="seg" role="group" aria-label="Kênh liên hệ">
          {(
            [
              ["call", "Gọi điện", PhoneCall],
              ["zalo", "Zalo", MessageCircle],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              className={form.channel === key ? "active" : ""}
              aria-pressed={form.channel === key}
              onClick={() => {
                set("channel", key);
                set("outcome", "called");
                setAttachments([]);
              }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        {form.channel === "call" && (
          <>
            <Field label="Chiều cuộc gọi">
              <div className="seg" role="group">
                <button
                  type="button"
                  className={form.direction !== "inbound" ? "active" : ""}
                  onClick={() => set("direction", "outbound")}
                >
                  <PhoneCall size={14} /> Cuộc gọi đi
                </button>
                <button
                  type="button"
                  className={form.direction === "inbound" ? "active" : ""}
                  onClick={() => set("direction", "inbound")}
                >
                  <Phone size={14} /> Cuộc gọi đến
                </button>
              </div>
            </Field>
            <Field label="Thời lượng cuộc gọi">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  placeholder="0"
                  defaultValue={1}
                  onChange={(e) => {
                    const mins = Math.max(0, parseInt(e.target.value) || 0);
                    const currentSecs = (form.durationSeconds ?? 90) % 60;
                    set("durationSeconds", mins * 60 + currentSecs);
                  }}
                  style={{ width: "80px" }}
                />
                <span className="muted" style={{ fontSize: 13 }}>phút</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="30"
                  defaultValue={30}
                  onChange={(e) => {
                    const secs = Math.max(0, parseInt(e.target.value) || 0);
                    const currentMins = Math.floor((form.durationSeconds ?? 90) / 60);
                    set("durationSeconds", currentMins * 60 + secs);
                  }}
                  style={{ width: "80px" }}
                />
                <span className="muted" style={{ fontSize: 13 }}>giây</span>
              </div>
            </Field>
          </>
        )}
        <Field label="Thời gian liên hệ *">
          <Input
            type="datetime-local"
            step="any"
            required
            value={form.at}
            onChange={(e) => set("at", e.target.value)}
          />
        </Field>
        <Field label="Kết quả liên hệ *">
          <select
            value={form.outcome}
            onChange={(e) => {
              set("outcome", e.target.value as ActivityInput["outcome"]);
              if (e.target.value !== "called") {
                set("decision", "none");
                set("reason", "none");
                set("appointmentAt", "");
              }
            }}
          >
            {outcomes.map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {form.outcome === "called" && (
          <Field label="Quyết định của tài xế *">
            <select
              value={form.decision}
              onChange={(e) => {
                set("decision", e.target.value as ActivityInput["decision"]);
                if (e.target.value !== "agreed") set("appointmentAt", "");
                if (e.target.value !== "declined") set("reason", "none");
              }}
            >
              {Object.entries(decisionLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {form.decision === "declined" && (
          <Field label="Lý do từ chối *">
            <select
              required
              value={form.reason === "none" ? "" : form.reason}
              onChange={(e) =>
                set("reason", e.target.value as ActivityInput["reason"])
              }
            >
              <option value="" disabled>
                Chọn lý do
              </option>
              {Object.entries(reasonLabels)
                .filter(([k]) => k !== "none")
                .map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {form.decision === "agreed" && (
          <div className="sub-box">
            <h3>Hẹn đến đăng ký</h3>
            <Field label="Thời gian hẹn *">
              <Input
                type="datetime-local"
                value={form.appointmentAt}
                onChange={(e) => set("appointmentAt", e.target.value)}
              />
            </Field>
            <Field label="Địa điểm hẹn *">
              <select
                aria-label="Địa điểm hẹn"
                required={!!form.appointmentAt}
                value={form.place}
                onChange={(e) => set("place", e.target.value)}
              >
                <option value="">Chọn văn phòng</option>
                {offices.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="Ghi chú *">
          <Textarea
            required
            rows={4}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Nội dung đã trao đổi, việc cần theo dõi…"
          />
        </Field>
        {form.outcome === "activated" && (
          <p className="muted" style={{ margin: 0 }}>
            Ghi nhận lời xác nhận của chuyên viên; Tiếp nhận xác minh và cập
            nhật trạng thái hồ sơ.
          </p>
        )}
        <Field label="Trạng thái phiếu sau liên hệ *">
          <select
            required
            aria-label="Trạng thái phiếu sau liên hệ"
            value={form.ticketStatus ?? ""}
            onChange={(e) =>
              set("ticketStatus", e.target.value as TicketStatus)
            }
          >
            <option value="">Chọn trạng thái</option>
            <option value="Open">Đang tư vấn</option>
            <option value="Solved">Đã giải quyết</option>
          </select>
        </Field>
        <EvidenceUpload
          ticketId={ticketId}
          channel={form.channel}
          outcome={form.outcome}
          value={attachments}
          onChange={setAttachments}
          onBusy={setUploading}
        />
        <Button
          type="submit"
          disabled={busy || uploading || !attachments.length}
        >
          <Save /> {uploading ? "Đang tải bằng chứng…" : "Lưu lần liên hệ"}
        </Button>
      </div>
    </form>
  );
}

function TicketActions({ ticketId }: { ticketId: string }) {
  const { db, actor, run, busy } = useWorkspace();
  const t = db.assignments.find((t) => t.id === ticketId)!;
  const l = db.leads.find((l) => l.id === t.leadId)!;
  const [target, setTarget] = useState<TicketStatus | "">("");
  const [reason, setReason] = useState("");
  const options = (
    [
      "Open",
      "Solved",
      ...(canAssign(actor) ? ["Closed"] : []),
    ] as TicketStatus[]
  ).filter(
    (s) =>
      s !== t.status &&
      (s !== "Open" || (l.status === "New" && t.status === "Solved")),
  );
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          target &&
          (await run(
            { type: "ticketStatus", id: t.id, status: target, reason },
            "Đã cập nhật trạng thái phiếu.",
          ))
        ) {
          setReason("");
          setTarget("");
        }
      }}
    >
      <Field label="Chuyển phiếu sang">
        <select
          required
          value={target}
          onChange={(e) => setTarget(e.target.value as TicketStatus)}
        >
          <option value="">Chọn trạng thái</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {s === "Open" ? "Đang tư vấn (mở lại)" : ticketLabels[s]}
            </option>
          ))}
        </select>
      </Field>
      {target && (
        <Field label="Lý do *">
          <Textarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Căn cứ đổi trạng thái phiếu…"
          />
        </Field>
      )}
      <Button variant="outline" type="submit" disabled={busy || !target}>
        Cập nhật phiếu
      </Button>
    </form>
  );
}

export function TicketPage() {
  const { id } = useParams();
  const { db, actor, run, busy } = useWorkspace();
  const t = db.assignments.find((t) => t.id === id);
  const [, force] = useState(0);
  const [reopenOpen, setReopenOpen] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => force((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  if (!t)
    return (
      <div className="panel">
        <Empty
          title="Không tìm thấy phiếu"
          description="Phiếu không tồn tại hoặc bạn không còn quyền xem."
          action={
            <Button asChild variant="outline">
              <Link to="/tasks">Về Nhiệm vụ</Link>
            </Button>
          }
        />
      </div>
    );
  const l = db.leads.find((l) => l.id === t.leadId)!;
  const allowed =
    actor.role !== "viewer" &&
    canReadLead(db, actor, t.leadId) &&
    (canAssign(actor) || actor.role === "intake" || t.assigneeId === actor.id);
  const permitted =
    canWork(actor, t) ||
    (actor.role === "leader" &&
      (t.teamId ?? "default") === (actor.teamId ?? "default"));
  const editable = canWork(actor, t) && isPending(t);
  const mustAccept =
    t.assigneeId === actor.id && !t.acceptedAt && t.status !== "Closed";
  const c = counts(db, t.id);
  const activities = db.activities.filter((a) => a.assignmentId === t.id);
  const appointments = db.appointments.filter((a) => a.assignmentId === t.id);
  return (
    <Guard allowed={allowed}>
      <Link className="back-link" to="/tasks">
        <ArrowLeft size={14} /> Nhiệm vụ
      </Link>
      <div className="ticket-head">
        <Avatar name={l.name} size="lg" />
        <div>
          <h1>{l.name}</h1>
          <div className="meta">
            <span>
              <Phone size={14} />
              <a href={`tel:${l.phone}`}>{l.phone}</a>
            </span>
            <span>
              <AlarmClock size={14} />
              {t.status === "Closed"
                ? "Đã đóng"
                : `Hạn ${formatDate(t.expiresAt, true)} · ${relativeDeadline(t.expiresAt)}`}
            </span>
          </div>
        </div>
        <div className="page-actions">
          {mustAccept && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run({ type: "accept", id: t.id }, "Đã nhận việc.")
              }
            >
              <UserCheck size={14} /> Nhận việc
            </Button>
          )}
          {l.phone && (
            <Button asChild size="sm" variant="default">
              <a href={`tel:${l.phone}`}>
                <PhoneCall size={14} /> Bấm gọi ngay
              </a>
            </Button>
          )}
          <Badge status={t.status} ticket />
          {t.status === "Solved" && permitted && isLive(t) && l.status === "New" && (
            <Button
              size="sm"
              variant="default"
              onClick={() => setReopenOpen(true)}
            >
              <RotateCcw size={14} /> Mở lại phiếu
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to={`/leads/${l.id}/show`}>Mở hồ sơ</Link>
          </Button>
        </div>
      </div>
      {(c.noAnswer >= 3 || c.overdue >= 3) && t.status === "Solved" && (
        <div
          className="callout"
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <p style={{ margin: 0 }}>
            Đã đủ 3 lần {c.noAnswer >= 3 ? "không nghe máy" : "quá hẹn"} — phiếu
            chuyển sang Đã giải quyết. Có thể mở lại trong hạn để chăm sóc tiếp.
          </p>
          {permitted && isLive(t) && l.status === "New" && (
            <Button
              size="sm"
              variant="default"
              onClick={() => setReopenOpen(true)}
              style={{ whiteSpace: "nowrap" }}
            >
              <RotateCcw size={14} /> Mở lại phiếu
            </Button>
          )}
        </div>
      )}
      {t.status === "Closed" && (
        <p className="callout info" style={{ marginBottom: 16 }}>
          Phiếu đã đóng: {t.closeReason || "hết hạn"}. Lịch sử được giữ lại,
          không ghi nhận thêm.
        </p>
      )}
      <div className="ticket-grid two">
        <div className="stack">
          {editable ? (
            <LogForm key={`${t.id}-${t.round}`} ticketId={t.id} />
          ) : (
            <section className="panel log-form">
              <div className="panel-head">
                <h2>Ghi nhận liên hệ</h2>
              </div>
              <div
                className="locked-note"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <p style={{ margin: 0 }}>
                  {t.status === "Solved"
                    ? "Phiếu đã giải quyết. Bấm nút Mở lại phiếu để tiếp tục chăm sóc tài xế."
                    : t.status === "Closed" || !isPending(t)
                      ? "Phiếu đã đóng hoặc hết hạn, không ghi nhận thêm."
                      : "Chỉ chuyên viên được giao mới ghi nhận liên hệ trên phiếu này."}
                </p>
                {t.status === "Solved" && permitted && isLive(t) && l.status === "New" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setReopenOpen(true)}
                  >
                    <RotateCcw size={14} /> Mở lại phiếu này
                  </Button>
                )}
              </div>
            </section>
          )}
          <Panel title="Tài xế">
            <div className="info-row">
              <span className="nowrap">Mã hồ sơ</span>
              <strong>
                <Link
                  className="record-link font-mono text-xs"
                  to={`/leads/${l.id}/show`}
                  title={l.id}
                >
                  {l.id}
                </Link>
              </strong>
            </div>
            <div className="info-row">
              <span>Trạng thái Lead</span>
              <Badge status={l.status} />
            </div>
            <div className="info-row">
              <span>Thành phố</span>
              <strong>{l.city}</strong>
            </div>
            <div className="info-row">
              <span>Phương tiện</span>
              <strong>{vehicleLabel(l.vehicle)}</strong>
            </div>
            <div className="info-row">
              <span>Nguồn</span>
              <strong>{sourceName(db, l.sourceId)}</strong>
            </div>
            <div className="info-row">
              <span>Ngày tiếp nhận</span>
              <strong>{formatDate(l.receivedAt)}</strong>
            </div>
          </Panel>
          {permitted && t.status !== "Closed" && (
            <Panel title="Xử lý phiếu">
              <TicketActions ticketId={t.id} />
              {canAssign(actor) && l.status === "New" && (
                <div style={{ marginTop: 12 }}>
                  <AssignmentDialog leadId={l.id} transfer />
                </div>
              )}
            </Panel>
          )}
        </div>
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Ghi chú liên hệ</h2>
              <span>{activities.length} lần liên hệ</span>
            </div>
            {activities.length ? (
              <div className="timeline">
                {[...activities]
                  .sort((x, y) => y.at.localeCompare(x.at))
                  .map((a) => (
                    <article
                      key={a.id}
                      className={`tl-item ${a.voidedAt ? "voided" : ""}`}
                    >
                      <span
                        className={`tl-icon ${a.voidedAt ? "void" : a.channel === "zalo" ? "zalo" : ""}`}
                      >
                        {a.channel === "call" ? (
                          <Phone size={15} />
                        ) : (
                          <MessageCircle size={15} />
                        )}
                      </span>
                      <div>
                        <div className="tl-top">
                          <strong>
                            {a.channel === "call"
                              ? a.direction === "inbound"
                                ? "Cuộc gọi đến"
                                : "Cuộc gọi đi"
                              : "Nhắn Zalo"}{" "}
                            · {memberName(db, a.actorId)}
                          </strong>
                          <time>{formatDate(a.at, true)}</time>
                          {(a.round ?? 1) > 1 && (
                            <Chip plain>Đợt {a.round}</Chip>
                          )}
                        </div>
                        <div className="tl-chips">
                          {a.durationSeconds ? (
                            <Chip plain>
                              {Math.floor(a.durationSeconds / 60)}p{" "}
                              {a.durationSeconds % 60}s
                            </Chip>
                          ) : null}
                          <Chip
                            tone={
                              a.outcome === "called" ||
                              a.outcome === "activated"
                                ? "new"
                                : a.outcome === "wrong_phone"
                                  ? "missed"
                                  : "open"
                            }
                          >
                            {outcomeLabels[a.outcome]}
                          </Chip>
                          {a.decision !== "none" && (
                            <Chip
                              tone={
                                a.decision === "agreed" ? "solved" : "closed"
                              }
                            >
                              {decisionLabels[a.decision]}
                            </Chip>
                          )}
                          {a.reason !== "none" && (
                            <Chip plain>{reasonLabels[a.reason]}</Chip>
                          )}
                        </div>
                        {a.note && <p className="tl-note">{a.note}</p>}
                        {a.voidedAt ? (
                          <p className="muted">Đã đính chính: {a.voidReason}</p>
                        ) : (
                          <div className="tl-extra">
                            <Evidence
                              activity={a}
                              ticketId={t.id}
                              editable={false}
                            />
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            ) : (
              <Empty
                icon={PhoneCall}
                title="Chưa có lần liên hệ nào"
                description="Gọi hoặc nhắn Zalo ngoài web, rồi ghi kết quả kèm ghi âm/ảnh chat."
              />
            )}
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Danh sách lịch hẹn</h2>
              <span>{appointments.length} lịch hẹn</span>
            </div>
            {appointments.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Thời gian hẹn</th>
                      <th>Địa điểm hẹn</th>
                      <th>Trạng thái</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...appointments]
                      .sort((x, y) => y.at.localeCompare(x.at))
                      .map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.at, true)}</td>
                          <td>
                            <MapPin size={13} style={{ display: "inline" }} />{" "}
                            {p.place}
                          </td>
                          <td>
                            <Chip tone={appointmentTone(p.status)}>
                              {appointmentLabels[p.status]}
                            </Chip>
                          </td>
                          <td className="end">
                            <AppointmentActions appointment={p} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                icon={CalendarDays}
                title="Chưa có lịch hẹn"
                description="Lịch hẹn được tạo khi tài xế Đồng ý và có ngày giờ hẹn."
              />
            )}
          </section>
        </div>
      </div>
      <ReopenTicketDialog
        ticket={t}
        open={reopenOpen}
        onOpenChange={setReopenOpen}
      />
    </Guard>
  );
}
