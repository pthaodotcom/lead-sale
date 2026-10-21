import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowUpRight, Clock3, MessageSquare, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "./context";
import { AssignmentDialog } from "./AssignmentDialog";
import { Evidence } from "./Evidence";
import {
  Badge,
  Empty,
  Field,
  formatDate,
  Guard,
  localDateTime,
  PageHeading,
  SearchBox,
  textMatches,
} from "./shared";
import {
  canAssign,
  canWork,
  counts,
  decisionLabels,
  isPending,
  outcomeLabels,
  reasonLabels,
  ticketLabels,
  canReadLead,
} from "./domain";
import type { ActivityInput, TicketStatus } from "./types";

const groups = [
  { id: "pending", name: "Chưa giải quyết" },
  { id: "unaccepted", name: "Chưa nhận việc" },
  { id: "new", name: "Chưa liên hệ" },
  { id: "agreed", name: "Đồng ý đăng ký" },
  { id: "no_answer", name: "Không nghe máy" },
  { id: "no_answer_1", name: "Không nghe lần 1", child: true },
  { id: "no_answer_2", name: "Không nghe lần 2", child: true },
  { id: "no_answer_3", name: "Không nghe lần 3", child: true },
  { id: "overdue", name: "Quá hẹn đăng ký" },
  { id: "overdue_1", name: "Quá hẹn lần 1", child: true },
  { id: "overdue_2", name: "Quá hẹn lần 2", child: true },
  { id: "overdue_3", name: "Quá hẹn lần 3", child: true },
  { id: "recent", name: "Cập nhật gần đây" },
  { id: "solved", name: "Đã giải quyết" },
  { id: "closed", name: "Phiếu đã đóng" },
];
export function AssignmentsList() {
  const { db, actor } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const group = params.get("group") ?? "pending";
  const [q, setQ] = useState("");
  const [member, setMember] = useState("");
  const [deadline, setDeadline] = useState("");
  const tickets = db.assignments.filter(
    (t) =>
      canReadLead(db, actor, t.leadId) &&
      (actor.role !== "telesale" ||
        (t.assigneeId === actor.id && t.status !== "Closed")),
  );
  const matches = (t: (typeof tickets)[number], key: string) => {
    const c = counts(db, t.id);
    const activities = db.activities
      .filter((a) => a.assignmentId === t.id)
      .sort((a, b) => b.at.localeCompare(a.at));
    if (key === "closed") return t.status === "Closed";
    if (key === "unaccepted") return t.status === "New" && !t.acceptedAt;
    if (key === "solved") return t.status === "Solved";
    if (key === "recent")
      return new Date(t.updatedAt).getTime() >= Date.now() - 3 * 86400000;
    if ((key === "no_answer_3" || key === "overdue_3") && t.status === "Solved")
      return key === "no_answer_3" ? c.noAnswer >= 3 : c.overdue >= 3;
    if (!isPending(t)) return false;
    if (key === "new") return t.status === "New";
    if (key === "agreed") return activities[0]?.decision === "agreed";
    if (key.startsWith("no_answer"))
      return key === "no_answer"
        ? c.noAnswer > 0
        : c.noAnswer === Number(key.slice(-1));
    if (key.startsWith("overdue"))
      return key === "overdue"
        ? c.overdue > 0 ||
            db.appointments.some(
              (a) =>
                a.assignmentId === t.id &&
                a.status === "scheduled" &&
                Date.parse(a.at) < Date.now(),
            )
        : c.overdue === Number(key.slice(-1));
    return isPending(t);
  };
  const selected = groups.find((g) => g.id === group) ?? groups[0];
  const filtered = tickets
    .filter((t) => {
      const l = db.leads.find((l) => l.id === t.leadId);
      return (
        matches(t, selected.id) &&
        (!member || t.assigneeId === member) &&
        (!deadline ||
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Ho_Chi_Minh",
          }).format(new Date(t.expiresAt)) <= deadline) &&
        textMatches(q, t.id, l?.name ?? "", l?.phone ?? "")
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <Guard allowed={actor.role !== "viewer"}>
      <PageHeading
        title="Nhiệm vụ tư vấn"
        description="Các phiếu cần xử lý, được nhóm theo kết quả và tiến độ tư vấn."
        action={canAssign(actor) && <AssignmentDialog />}
      />
      <div className="tasks-workspace">
        <nav className="task-groups" aria-label="Nhóm nhiệm vụ">
          <h2>Danh sách phiếu</h2>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`${selected.id === g.id ? "active" : ""} ${g.child ? "is-child" : ""}`}
              onClick={async () => setParams({ group: g.id })}
            >
              <span>{g.name}</span>
              <span>{tickets.filter((t) => matches(t, g.id)).length}</span>
            </button>
          ))}
        </nav>
        <section className="data-section">
          <div className="section-header">
            <h2>{selected.name}</h2>
            <span>{filtered.length} phiếu</span>
          </div>
          <div className="filter-bar">
            <Field label="Hạn xử lý đến">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </Field>
            <SearchBox
              value={q}
              onChange={setQ}
              placeholder="Tìm phiếu, tên hoặc số điện thoại…"
            />
            {canAssign(actor) && (
              <select
                aria-label="Lọc nhân viên"
                value={member}
                onChange={(e) => setMember(e.target.value)}
              >
                <option value="">Tất cả nhân viên</option>
                {db.members
                  .filter((m) => m.role === "telesale")
                  .map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hồ sơ / Phiếu</th>
                  <th>Nhân viên</th>
                  <th>Kết quả gần nhất</th>
                  <th>Trạng thái / Hạn</th>
                  <th aria-label="Xử lý" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const l = db.leads.find((l) => l.id === t.leadId)!;
                  const latest = db.activities
                    .filter((a) => a.assignmentId === t.id)
                    .sort((a, b) => b.at.localeCompare(a.at))[0];
                  const c = counts(db, t.id);
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link
                          className="record-link"
                          to={`/assignments/${t.id}/show`}
                        >
                          {l.name}
                        </Link>
                        <small>
                          {l.phone} · {t.id}
                        </small>
                      </td>
                      <td>
                        {db.members.find((m) => m.id === t.assigneeId)?.name}
                      </td>
                      <td>
                        {latest
                          ? outcomeLabels[latest.outcome]
                          : "Chưa liên hệ"}
                        <small>
                          {c.noAnswer > 0
                            ? `Không nghe: ${c.noAnswer} lần`
                            : latest
                              ? decisionLabels[latest.decision]
                              : "Sẵn sàng tiếp nhận"}
                        </small>
                        {(c.noAnswer === 3 || c.overdue === 3) && (
                          <small className="warning-text">
                            Cần rà soát lần thứ 3
                          </small>
                        )}
                      </td>
                      <td>
                        <Badge status={t.status} ticket />
                        <small>{formatDate(t.expiresAt)}</small>
                      </td>
                      <td>
                        <Link
                          className="icon-link"
                          to={`/assignments/${t.id}/show`}
                          aria-label={`Mở phiếu ${t.id}`}
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <Empty
              title="Không có phiếu trong nhóm này"
              description="Các phiếu phù hợp sẽ xuất hiện tại đây khi có phân công hoặc kết quả tư vấn mới."
            />
          )}
          <div className="table-footer">
            <span>Đang hiển thị {filtered.length} phiếu</span>
            <span>Phiếu và hồ sơ Lead có trạng thái riêng.</span>
          </div>
        </section>
      </div>
    </Guard>
  );
}

export function AssignmentShow() {
  const { id } = useParams();
  const { db, actor, run, cloud } = useWorkspace();
  const t = db.assignments.find((t) => t.id === id);
  const [tab, setTab] = useState("activity");
  const [form, setForm] = useState<ActivityInput>({
    channel: "call",
    at: localDateTime(),
    outcome: "called",
    decision: "none",
    reason: "none",
    note: "",
    appointmentAt: "",
    place: "",
  });
  const [target, setTarget] = useState<TicketStatus | "">("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    setForm((prev) => ({ ...prev, at: localDateTime() }));
  }, [t?.id, t?.round]);
  if (!t) return <Empty title="Không tìm thấy phiếu" />;
  const l = db.leads.find((l) => l.id === t.leadId)!;
  const permitted =
    canWork(actor, t) ||
    (actor.role === "leader" &&
      (t.teamId ?? "default") === (actor.teamId ?? "default"));
  const editable =
    canWork(actor, t) &&
    isPending(t) &&
    (!!t.acceptedAt || actor.role === "admin");
  const activities = db.activities
    .filter((a) => a.assignmentId === t.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const c = counts(db, t.id);
  const update = <K extends keyof ActivityInput>(
    key: K,
    value: ActivityInput[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <Guard
      allowed={
        actor.role !== "viewer" &&
        canReadLead(db, actor, t.leadId) &&
        (canAssign(actor) ||
          actor.role === "intake" ||
          t.assigneeId === actor.id)
      }
    >
      <PageHeading
        title={`Tư vấn · ${l.name}`}
        description={`${t.id} · Giao cho ${db.members.find((m) => m.id === t.assigneeId)?.name}`}
        back="/assignments"
        action={
          <>
            <Badge status={t.status} ticket />
            <Button asChild variant="outline">
              <Link to={`/leads/${l.id}/show`}>
                Xem hồ sơ Lead
                <ArrowUpRight />
              </Link>
            </Button>
          </>
        }
      />
      <div className="ticket-summary">
        <span>
          <Phone size={16} />
          <a href={`tel:${l.phone}`}>{l.phone}</a>
        </span>
        <span>
          {l.city} · {l.vehicle === "Van" ? "Xe Van" : "Xe máy"}
        </span>
        <span>
          <Clock3 size={16} />
          Hết hạn {formatDate(t.expiresAt, true)}
        </span>
      </div>
      {(c.noAnswer === 3 || c.overdue === 3) && (
        <p className="review-notice">
          Đã đạt ngưỡng 3 lần không nghe máy hoặc quá hẹn. Phiếu được giải
          quyết; có thể mở lại trong hạn để bắt đầu đợt chăm sóc mới.
        </p>
      )}
      {t.status === "Closed" && (
        <p className="review-notice">
          Phiếu đã đóng: {t.closeReason}. Lịch sử được giữ lại và không nhận
          thêm hoạt động tư vấn.
        </p>
      )}
      <div className="detail-grid">
        {t.assigneeId === actor.id &&
          !t.acceptedAt &&
          t.status !== "Closed" && (
            <Button
              onClick={async () => {
                await run({ type: "accept", id: t.id }, "Đã nhận việc.");
              }}
            >
              Nhận việc
            </Button>
          )}
        <div className="detail-main">
          <section className="data-section">
            <div className="list-tabs">
              <button
                className={tab === "activity" ? "active" : ""}
                onClick={async () => setTab("activity")}
              >
                Lịch sử tư vấn <span>{activities.length}</span>
              </button>
              <button
                className={tab === "appointment" ? "active" : ""}
                onClick={async () => setTab("appointment")}
              >
                Lịch hẹn{" "}
                <span>
                  {
                    db.appointments.filter((a) => a.assignmentId === t.id)
                      .length
                  }
                </span>
              </button>
            </div>
            {tab === "activity" ? (
              activities.length ? (
                <div className="timeline">
                  {activities.map((a) => (
                    <article key={a.id}>
                      <span className="timeline-dot">
                        {a.channel === "call" ? (
                          <Phone size={12} />
                        ) : (
                          <MessageSquare size={12} />
                        )}
                      </span>
                      <div className="timeline-title">
                        <strong>
                          {a.channel === "call"
                            ? "Gọi điện tư vấn"
                            : "Nhắn tin Zalo"}
                        </strong>
                        <time>{formatDate(a.at, true)}</time>
                      </div>
                      <small>
                        {db.members.find((m) => m.id === a.actorId)?.name}
                      </small>
                      <div className="activity-chips">
                        <span>{outcomeLabels[a.outcome]}</span>
                        {a.decision !== "none" && (
                          <span>{decisionLabels[a.decision]}</span>
                        )}
                        {a.reason !== "none" && (
                          <span>{reasonLabels[a.reason]}</span>
                        )}
                      </div>
                      <p>{a.note}</p>
                      {cloud && (
                        <Evidence
                          activity={a}
                          ticketId={t.id}
                          editable={permitted && t.status !== "Closed"}
                        />
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Bắt đầu lần tư vấn đầu tiên"
                  description="Ghi lại kết quả liên hệ để theo dõi và chăm sóc tài xế."
                />
              )
            ) : (
              <div className="side-content">
                {db.appointments.filter((a) => a.assignmentId === t.id)
                  .length ? (
                  db.appointments
                    .filter((a) => a.assignmentId === t.id)
                    .map((a) => (
                      <div className="appointment-row" key={a.id}>
                        <strong>{formatDate(a.at, true)}</strong>
                        <span>{a.place}</span>
                        <small>
                          {
                            {
                              scheduled: "Đã lên lịch",
                              attended: "Đã đến",
                              missed: "Không đến",
                              cancelled: "Đã hủy",
                            }[a.status]
                          }
                        </small>
                      </div>
                    ))
                ) : (
                  <Empty
                    title="Chưa có lịch hẹn"
                    description="Thêm lịch khi tài xế đồng ý đăng ký."
                  />
                )}
              </div>
            )}
          </section>
          {editable && (
            <section className="form-surface">
              <div className="section-label">
                <Plus size={18} />
                <h2>Ghi nhận tư vấn</h2>
              </div>
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await run(
                      { type: "activity", assignmentId: t.id, input: form },
                      "Đã ghi nhận tư vấn.",
                    )
                  )
                    setForm((prev) => ({
                      ...prev,
                      at: localDateTime(),
                      note: "",
                      appointmentAt: "",
                      place: "",
                    }));
                }}
              >
                <div className="form-grid">
                  <Field label="Kênh liên hệ">
                    <select
                      value={form.channel}
                      onChange={(e) =>
                        update(
                          "channel",
                          e.target.value as ActivityInput["channel"],
                        )
                      }
                    >
                      <option value="call">Gọi điện</option>
                      <option value="zalo">Nhắn tin Zalo</option>
                    </select>
                  </Field>
                  <Field label="Thời điểm liên hệ *">
                    <Input
                      type="datetime-local"
                      step="any"
                      required
                      value={form.at}
                      onChange={(e) => update("at", e.target.value)}
                    />
                  </Field>
                  <Field label="Kết quả liên hệ">
                    <select
                      value={form.outcome}
                      onChange={(e) => {
                        update(
                          "outcome",
                          e.target.value as ActivityInput["outcome"],
                        );
                        if (e.target.value !== "called") {
                          update("decision", "none");
                          update("reason", "none");
                          update("appointmentAt", "");
                        }
                      }}
                    >
                      {Object.entries(outcomeLabels)
                        .filter(([key]) => key !== "overdue")
                        .map(([key, label]) => (
                          <option value={key} key={key}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Quyết định tài xế">
                    <select
                      value={form.decision}
                      disabled={form.outcome !== "called"}
                      onChange={(e) => {
                        update(
                          "decision",
                          e.target.value as ActivityInput["decision"],
                        );
                        if (e.target.value !== "agreed")
                          update("appointmentAt", "");
                        if (e.target.value !== "declined")
                          update("reason", "none");
                      }}
                    >
                      {Object.entries(decisionLabels).map(([key, label]) => (
                        <option value={key} key={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {form.decision === "declined" && (
                    <Field label="Lý do không đồng ý *">
                      <select
                        required
                        value={form.reason}
                        onChange={(e) =>
                          update(
                            "reason",
                            e.target.value as ActivityInput["reason"],
                          )
                        }
                      >
                        {Object.entries(reasonLabels).map(([key, label]) => (
                          <option value={key} key={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <div className="full-span">
                    <Field label="Nội dung tư vấn *">
                      <Textarea
                        required
                        rows={3}
                        value={form.note}
                        onChange={(e) => update("note", e.target.value)}
                        placeholder="Nội dung đã trao đổi, kết quả và việc cần theo dõi…"
                      />
                    </Field>
                  </div>
                </div>
                {form.decision === "agreed" && (
                  <div className="appointment-form">
                    <h3>Hẹn đến đăng ký</h3>
                    <div className="form-grid">
                      <Field label="Ngày và giờ hẹn">
                        <Input
                          type="datetime-local"
                          step="any"
                          value={form.appointmentAt}
                          onChange={(e) =>
                            update("appointmentAt", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Địa điểm hẹn">
                        <Input
                          required={!!form.appointmentAt}
                          value={form.place}
                          onChange={(e) => update("place", e.target.value)}
                          placeholder="Điểm đăng ký / địa chỉ cụ thể"
                        />
                      </Field>
                    </div>
                  </div>
                )}
                <div className="form-actions">
                  <Button type="submit">Lưu kết quả tư vấn</Button>
                </div>
              </form>
            </section>
          )}
        </div>
        <aside className="detail-side">
          <section className="data-section">
            <div className="section-header">
              <h2>Thông tin phiếu</h2>
            </div>
            <dl className="side-content info-list">
              <div>
                <dt>Hồ sơ</dt>
                <dd>
                  <Link to={`/leads/${l.id}/show`}>{l.id}</Link>
                </dd>
              </div>
              <div>
                <dt>Trạng thái Lead</dt>
                <dd>
                  <Badge status={l.status} />
                </dd>
              </div>
              <div>
                <dt>Ngày phân công</dt>
                <dd>{formatDate(t.createdAt, true)}</dd>
              </div>
              <div>
                <dt>Không nghe máy</dt>
                <dd>{c.noAnswer} lần</dd>
              </div>
              <div>
                <dt>Quá hẹn đã ghi nhận</dt>
                <dd>{c.overdue} lần</dd>
              </div>
            </dl>
          </section>
          {permitted && t.status !== "Closed" && (
            <section className="data-section">
              <div className="section-header">
                <h2>Xử lý phiếu</h2>
              </div>
              <form
                className="side-content stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    target &&
                    (await run(
                      {
                        type: "ticketStatus",
                        id: t.id,
                        status: target,
                        reason,
                      },
                      "Đã cập nhật phiếu.",
                    ))
                  ) {
                    setReason("");
                    setTarget("");
                  }
                }}
              >
                <Field label="Trạng thái tiếp theo">
                  <select
                    required
                    value={target}
                    onChange={(e) => setTarget(e.target.value as TicketStatus)}
                  >
                    <option value="">Chọn thao tác</option>
                    {["Open", "Solved", ...(canAssign(actor) ? ["Closed"] : [])]
                      .filter(
                        (s) =>
                          s !== t.status &&
                          (s !== "Open" ||
                            (l.status === "New" && t.status === "Solved")),
                      )
                      .map((s) => (
                        <option key={s} value={s}>
                          {ticketLabels[s as TicketStatus]}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Lý do">
                  <Textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ghi rõ căn cứ xử lý phiếu…"
                  />
                </Field>
                <Button variant="outline" type="submit">
                  Cập nhật phiếu
                </Button>
              </form>
            </section>
          )}
          {canAssign(actor) && l.status === "New" && t.status !== "Closed" && (
            <AssignmentDialog leadId={l.id} transfer />
          )}
        </aside>
      </div>
    </Guard>
  );
}
