import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  AlarmClock,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  Save,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "./context";
import { AssignmentDialog } from "./AssignmentDialog";
import { Evidence } from "./Evidence";
import { ActivityCorrection } from "./Corrections";
import { AppointmentActions, appointmentLabels } from "./Appointments";
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
  isPending,
  outcomeLabels,
  reasonLabels,
  ticketLabels,
} from "./domain";
import {
  expiresSoon,
  inGroup,
  latestActivity,
  taskGroups,
  visibleTickets,
  type TaskGroup,
} from "./tasks";
import type { ActivityInput, TicketStatus } from "./types";
import { serverNow } from "./dates";
import { VoicePanel } from "./VoicePanel";

export function TasksPage() {
  const { db, actor } = useWorkspace();
  const navigate = useNavigate();
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
        textMatches(q, t.id, l?.name ?? "", l?.phone ?? "")
      );
    })
    .sort((a, b) =>
      selected.id === "pending" || selected.id.startsWith("no_answer")
        ? a.expiresAt.localeCompare(b.expiresAt)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const leader = canAssign(actor);
  return (
    <Guard allowed={["telesale", "leader", "admin"].includes(actor.role)}>
      <PageHeading
        title="Nhiệm vụ"
        description={
          actor.role === "telesale"
            ? "Các phiếu tư vấn được giao cho bạn, chia theo kết quả liên hệ."
            : "Phiếu tư vấn của nhóm, chia theo kết quả liên hệ."
        }
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
                      (actor.role === "admin" || m.teamId === actor.teamId),
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
          {rows.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tài xế</th>
                    <th>Phiếu</th>
                    {leader && <th>Chuyên viên</th>}
                    <th>Kết quả gần nhất</th>
                    <th>Trạng thái</th>
                    <th>Hạn xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const l = db.leads.find((l) => l.id === t.leadId)!;
                    const last = latestActivity(db, t.id);
                    const c = counts(db, t.id);
                    return (
                      <tr
                        key={t.id}
                        className="clickable"
                        onClick={() => navigate(`/tasks/${t.id}`)}
                      >
                        <td>
                          <Link
                            className="record-link"
                            to={`/tasks/${t.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {l.name}
                          </Link>
                          <small>{l.phone}</small>
                        </td>
                        <td>
                          {t.id}
                          <small>Tạo {formatDate(t.createdAt)}</small>
                        </td>
                        {leader && <td>{memberName(db, t.assigneeId)}</td>}
                        <td>
                          {last ? outcomeLabels[last.outcome] : "Chưa liên hệ"}
                          <small>
                            {c.noAnswer
                              ? `Không nghe ${c.noAnswer}/3`
                              : c.overdue
                                ? `Quá hẹn ${c.overdue}/3`
                                : last && last.decision !== "none"
                                  ? decisionLabels[last.decision]
                                  : t.acceptedAt
                                    ? "Đã nhận việc"
                                    : "Chưa nhận việc"}
                          </small>
                        </td>
                        <td>
                          <Badge status={t.status} ticket />
                        </td>
                        <td>
                          {formatDate(t.expiresAt)}
                          <small
                            className={
                              expiresSoon(t) ? "warning-text" : undefined
                            }
                          >
                            {t.status === "Closed"
                              ? t.closeReason || "Đã đóng"
                              : relativeDeadline(t.expiresAt)}
                          </small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={ClipboardList}
              title="Không có phiếu trong mục này"
              description="Chọn mục khác ở bên trái hoặc xóa bộ lọc."
            />
          )}
        </section>
      </div>
    </Guard>
  );
}

const blankForm = (): ActivityInput => ({
  channel: "call",
  at: localDateTime(),
  outcome: "called",
  decision: "none",
  reason: "none",
  note: "",
  appointmentAt: "",
  place: "",
});

function LogForm({ ticketId }: { ticketId: string }) {
  const { run, busy } = useWorkspace();
  const [form, setForm] = useState<ActivityInput>(blankForm);
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
        if (
          await run(
            { type: "activity", assignmentId: ticketId, input: form },
            "Đã ghi nhận lần liên hệ.",
          )
        )
          setForm(blankForm());
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
              }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <Field label="Ngày giờ liên hệ (call date)">
          <Input
            type="datetime-local"
            step="any"
            required
            value={form.at}
            onChange={(e) => set("at", e.target.value)}
          />
        </Field>
        <Field label="Kết quả liên hệ (status)">
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
          <Field label="Quyết định của tài xế (decision)">
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
          <Field label="Lý do không đồng ý (reason) *">
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
            <Field label="Ngày giờ hẹn (decision date)">
              <Input
                type="datetime-local"
                step="any"
                value={form.appointmentAt}
                onChange={(e) => set("appointmentAt", e.target.value)}
              />
            </Field>
            <Field label="Nơi hẹn (decision place)">
              <Input
                required={!!form.appointmentAt}
                value={form.place}
                onChange={(e) => set("place", e.target.value)}
                placeholder="Điểm đăng ký / địa chỉ"
              />
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
        <Button type="submit" disabled={busy}>
          <Save /> Lưu lần liên hệ
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
              {s === "Open" ? "Mở lại (Open)" : `${ticketLabels[s]} (${s})`}
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
  const { db, actor, run, cloud, busy } = useWorkspace();
  const t = db.assignments.find((t) => t.id === id);
  const [, force] = useState(0);
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
  const editable =
    canWork(actor, t) &&
    isPending(t) &&
    (!!t.acceptedAt || actor.role === "admin");
  const mustAccept =
    t.assigneeId === actor.id && !t.acceptedAt && t.status !== "Closed";
  const c = counts(db, t.id);
  const activities = db.activities.filter((a) => a.assignmentId === t.id);
  const appointments = db.appointments.filter((a) => a.assignmentId === t.id);
  const timeline = [
    ...activities.map((a) => ({ kind: "activity" as const, at: a.at, a })),
    ...appointments.map((p) => ({ kind: "appt" as const, at: p.at, p })),
  ].sort((x, y) => y.at.localeCompare(x.at));
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
            <span>Phiếu {t.id}</span>
            <span>Chuyên viên: {memberName(db, t.assigneeId)}</span>
            <span>
              <AlarmClock size={14} />
              {t.status === "Closed"
                ? "Đã đóng"
                : `Hạn ${formatDate(t.expiresAt, true)} · ${relativeDeadline(t.expiresAt)}`}
            </span>
          </div>
        </div>
        <div className="page-actions">
          <Badge status={t.status} ticket />
          <Button asChild variant="outline" size="sm">
            <Link to={`/leads/${l.id}/show`}>Mở hồ sơ</Link>
          </Button>
        </div>
      </div>
      {(c.noAnswer >= 3 || c.overdue >= 3) && t.status === "Solved" && (
        <p className="callout" style={{ marginBottom: 16 }}>
          Đã đủ 3 lần {c.noAnswer >= 3 ? "không nghe máy" : "quá hẹn"} — phiếu
          chuyển sang Đã giải quyết. Có thể mở lại trong hạn để chăm sóc tiếp.
        </p>
      )}
      {t.status === "Closed" && (
        <p className="callout info" style={{ marginBottom: 16 }}>
          Phiếu đã đóng: {t.closeReason || "hết hạn"}. Lịch sử được giữ lại,
          không ghi nhận thêm.
        </p>
      )}
      <VoicePanel leadId={l.id} ticketId={t.id} canCall={editable} />
      <div className="ticket-grid">
        {editable ? (
          <LogForm key={`${t.id}-${t.round}`} ticketId={t.id} />
        ) : (
          <section className="panel log-form">
            <div className="panel-head">
              <h2>Ghi nhận liên hệ</h2>
            </div>
            {mustAccept ? (
              <div className="panel-body stack-form">
                <p className="muted" style={{ margin: 0 }}>
                  Nhận việc để bắt đầu gọi và ghi kết quả cho phiếu này.
                </p>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run({ type: "accept", id: t.id }, "Đã nhận việc.")
                  }
                >
                  <UserCheck /> Nhận việc
                </Button>
              </div>
            ) : (
              <p className="locked-note">
                {t.status === "Solved"
                  ? "Phiếu đã giải quyết. Mở lại phiếu (cột phải) để ghi nhận thêm."
                  : t.status === "Closed" || !isPending(t)
                    ? "Phiếu đã đóng hoặc hết hạn, không ghi nhận thêm."
                    : "Chỉ chuyên viên được giao mới ghi nhận liên hệ trên phiếu này."}
              </p>
            )}
          </section>
        )}
        <section className="panel">
          <div className="panel-head">
            <h2>Lịch sử chăm sóc</h2>
            <span>
              {activities.length} lần liên hệ · {appointments.length} lịch hẹn
            </span>
          </div>
          {timeline.length ? (
            <div className="timeline">
              {timeline.map((item) =>
                item.kind === "activity" ? (
                  <article
                    key={item.a.id}
                    className={`tl-item ${item.a.voidedAt ? "voided" : ""}`}
                  >
                    <span
                      className={`tl-icon ${item.a.voidedAt ? "void" : item.a.channel === "zalo" ? "zalo" : ""}`}
                    >
                      {item.a.channel === "call" ? (
                        <Phone size={15} />
                      ) : (
                        <MessageCircle size={15} />
                      )}
                    </span>
                    <div>
                      <div className="tl-top">
                        <strong>
                          {item.a.channel === "call" ? "Cuộc gọi" : "Nhắn Zalo"}{" "}
                          · {memberName(db, item.a.actorId)}
                        </strong>
                        <time>{formatDate(item.a.at, true)}</time>
                        {(item.a.round ?? 1) > 1 && (
                          <Chip plain>Đợt {item.a.round}</Chip>
                        )}
                      </div>
                      <div className="tl-chips">
                        <Chip
                          tone={
                            item.a.outcome === "called"
                              ? "new"
                              : item.a.outcome === "wrong_phone"
                                ? "missed"
                                : "open"
                          }
                        >
                          {outcomeLabels[item.a.outcome]}
                        </Chip>
                        {item.a.decision !== "none" && (
                          <Chip
                            tone={
                              item.a.decision === "agreed" ? "solved" : "closed"
                            }
                          >
                            {decisionLabels[item.a.decision]}
                          </Chip>
                        )}
                        {item.a.reason !== "none" && (
                          <Chip plain>{reasonLabels[item.a.reason]}</Chip>
                        )}
                      </div>
                      {item.a.note && <p className="tl-note">{item.a.note}</p>}
                      <div className="tl-extra">
                        {cloud && (
                          <Evidence
                            activity={item.a}
                            ticketId={t.id}
                            editable={canWork(actor, t) && !item.a.voidedAt}
                          />
                        )}
                        {(actor.role === "admin" ||
                          (actor.role === "telesale" &&
                            t.assigneeId === actor.id)) && (
                          <ActivityCorrection activity={item.a} />
                        )}
                      </div>
                    </div>
                  </article>
                ) : (
                  <article key={item.p.id} className="tl-item">
                    <span className="tl-icon appt">
                      <CalendarDays size={15} />
                    </span>
                    <div>
                      <div className="tl-top">
                        <strong>Lịch hẹn đăng ký</strong>
                        <time>{formatDate(item.p.at, true)}</time>
                        <Chip
                          tone={
                            item.p.status === "scheduled" &&
                            Date.parse(item.p.at) < serverNow().getTime()
                              ? "late"
                              : item.p.status
                          }
                        >
                          {item.p.status === "scheduled" &&
                          Date.parse(item.p.at) < serverNow().getTime()
                            ? "Quá giờ, chờ xác nhận"
                            : appointmentLabels[item.p.status]}
                        </Chip>
                      </div>
                      <div className="tl-chips">
                        <span className="muted">
                          <MapPin size={13} style={{ display: "inline" }} />{" "}
                          {item.p.place}
                        </span>
                      </div>
                      <div className="tl-extra">
                        <AppointmentActions appointment={item.p} />
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>
          ) : (
            <Empty
              icon={PhoneCall}
              title="Chưa có lần liên hệ nào"
              description="Gọi hoặc nhắn Zalo cho tài xế, rồi ghi kết quả ở cột bên trái."
            />
          )}
        </section>
        <div className="ticket-side stack">
          <Panel title="Tài xế">
            <div className="info-row">
              <span>Mã hồ sơ</span>
              <strong>
                <Link className="record-link" to={`/leads/${l.id}/show`}>
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
          <Panel title="Phiếu phân công">
            <div className="info-row">
              <span>Tạo lúc</span>
              <strong>{formatDate(t.createdAt, true)}</strong>
            </div>
            <div className="info-row">
              <span>Cập nhật</span>
              <strong>{formatDate(t.updatedAt, true)}</strong>
            </div>
            <div className="info-row">
              <span>Người giao</span>
              <strong>{memberName(db, t.assignedBy)}</strong>
            </div>
            <div className="info-row">
              <span>Nhận việc</span>
              <strong>
                {t.acceptedAt ? formatDate(t.acceptedAt, true) : "Chưa nhận"}
              </strong>
            </div>
            <div className="bar-row" style={{ marginTop: 10 }}>
              <div>
                <span>Không nghe máy</span>
                <strong>{c.noAnswer}/3</strong>
              </div>
              <div className="bar thin amber">
                <span style={{ width: `${Math.min(c.noAnswer, 3) * 33.4}%` }} />
              </div>
            </div>
            <div className="bar-row" style={{ marginTop: 10 }}>
              <div>
                <span>Quá hẹn</span>
                <strong>{c.overdue}/3</strong>
              </div>
              <div className="bar thin amber">
                <span style={{ width: `${Math.min(c.overdue, 3) * 33.4}%` }} />
              </div>
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
      </div>
    </Guard>
  );
}
