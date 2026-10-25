import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Archive,
  ArrowLeft,
  BookUser,
  CalendarDays,
  Download,
  FileUp,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Plus,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./context";
import { AssignmentDialog } from "./AssignmentDialog";
import { IntakeLink } from "./IntakeLink";
import { Evidence } from "./Evidence";
import { cities, normalizeCity } from "./catalog";
import { ticketCode } from "./workflow";
import { LeadCorrections } from "./Corrections";
import { CallDialog } from "./CallDialog";
import { CallLogModal } from "./CallLogModal";
import { AppointmentCreateDialog } from "./AppointmentCreateDialog";
import {
  Avatar,
  Badge,
  Chip,
  downloadCsv,
  Empty,
  Field,
  formatDate,
  Guard,
  localDateTime,
  memberName,
  PageHeading,
  Panel,
  SearchBox,
  sourceName,
  TablePagination,
  textMatches,
  vehicleLabel,
} from "./shared";
import {
  canAssign,
  canEditLead,
  canReadLead,
  decisionLabels,
  leadLabels,
  outcomeLabels,
  normalizePhone,
} from "./domain";
import type { LeadInput, LeadStatus } from "./types";

const PAGE = 15;

export function LeadsList() {
  const { db, actor } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [source, setSource] = useState("");
  const [city, setCity] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setPage(1);
  }, [params]);
  const readable = db.leads.filter(
    (l) => canReadLead(db, actor, l.id) && l.archived === archived,
  );
  const items = readable
    .filter(
      (l) =>
        (!status || l.status === status) &&
        (!source || l.sourceId === source) &&
        (!city || normalizeCity(l.city) === city) &&
        (!vehicle || l.vehicle === vehicle) &&
        textMatches(q, l.name, l.phone, l.id, ...l.tags),
    )
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const current = Math.min(page, pages);
  const reset = () => setPage(1);
  return (
    <Guard allowed={actor.role !== "viewer"}>
      <PageHeading
        title="Hồ sơ Lead"
        action={
          canEditLead(actor) && (
            <>
              <Button asChild variant="outline">
                <Link to="/import">
                  <FileUp /> Nhập Excel/CSV
                </Link>
              </Button>
              <Button asChild>
                <Link to="/leads/create">
                  <Plus /> Tiếp nhận Lead
                </Link>
              </Button>
            </>
          )
        }
      />
      {canEditLead(actor) && <IntakeLink />}
      <section className="panel">
        <div className="tabs">
          {[["", "Tất cả"], ...Object.entries(leadLabels)].map(
            ([key, label]) => (
              <button
                key={key}
                className={status === key ? "active" : ""}
                onClick={() => {
                  setParams(key ? { status: key } : {});
                  reset();
                }}
              >
                {label}
                <span className="count">
                  {readable.filter((l) => !key || l.status === key).length}
                </span>
              </button>
            ),
          )}
        </div>
        <div className="toolbar">
          <SearchBox
            className="grow"
            value={q}
            onChange={(v) => {
              setQ(v);
              reset();
            }}
          />
          <select
            aria-label="Lọc theo nguồn"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              reset();
            }}
          >
            <option value="">Mọi nguồn</option>
            {db.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc theo thành phố"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              reset();
            }}
          >
            <option value="">Mọi thành phố</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Lọc theo phương tiện"
            value={vehicle}
            onChange={(e) => {
              setVehicle(e.target.value);
              reset();
            }}
          >
            <option value="">Mọi loại xe</option>
            <option value="Motorbike">Xe máy</option>
            <option value="Van">Xe Van</option>
          </select>
          {["admin", "intake", "leader"].includes(actor.role) && (
            <Button
              variant="outline"
              disabled={!items.length}
              onClick={() =>
                downloadCsv("ho-so-lead.csv", [
                  [
                    "Mã hồ sơ",
                    "Họ tên",
                    "SĐT",
                    "Thành phố",
                    "Loại xe",
                    "Nguồn",
                    "Trạng thái",
                    "Ngày tiếp nhận",
                    "Nhãn",
                  ],
                  ...items.map((l) => [
                    l.id,
                    l.name,
                    l.phone,
                    l.city,
                    vehicleLabel(l.vehicle),
                    sourceName(db, l.sourceId),
                    leadLabels[l.status],
                    formatDate(l.receivedAt),
                    l.tags.join(", "),
                  ]),
                ])
              }
            >
              <Download /> Xuất CSV
            </Button>
          )}
        </div>
        {items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tài xế</th>
                  <th>Thành phố / Xe</th>
                  <th>Nguồn</th>
                  <th>Phụ trách</th>
                  <th>Tiếp nhận</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.slice((current - 1) * PAGE, current * PAGE).map((l) => {
                  const live = db.assignments.find(
                    (t) => t.leadId === l.id && t.status !== "Closed",
                  );
                  return (
                    <tr
                      key={l.id}
                      className="clickable"
                      onClick={() => navigate(`/leads/${l.id}/show`)}
                    >
                      <td>
                        <Link
                          className="person"
                          to={`/leads/${l.id}/show`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Avatar name={l.name} size="sm" />
                          <span>
                            <span className="record-link">{l.name}</span>
                            <small>
                              {l.phone} · {l.id}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        {l.city}
                        <small>{vehicleLabel(l.vehicle)}</small>
                      </td>
                      <td>
                        {sourceName(db, l.sourceId)}
                        {!!l.tags.length && <small>{l.tags.join(", ")}</small>}
                      </td>
                      <td>
                        {live ? memberName(db, live.assigneeId) : "—"}
                        {live && <small>Phiếu {live.id}</small>}
                      </td>
                      <td>{formatDate(l.receivedAt)}</td>
                      <td>
                        <Badge status={l.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={BookUser}
            title={q ? `Không tìm thấy “${q}”` : "Không có hồ sơ phù hợp"}
            description={
              canEditLead(actor)
                ? "Thử bỏ bớt bộ lọc, hoặc tiếp nhận hồ sơ mới."
                : "Thử bỏ bớt bộ lọc."
            }
            action={
              canEditLead(actor) && (
                <Button asChild>
                  <Link to="/leads/create">
                    <Plus /> Tiếp nhận Lead
                  </Link>
                </Button>
              )
            }
          />
        )}
        <TablePagination
          current={current}
          total={items.length}
          pageSize={PAGE}
          onPageChange={setPage}
          unit="hồ sơ"
          extraLeft={
            <label className="inline-check">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => {
                  setArchived(e.target.checked);
                  reset();
                }}
              />
              Xem hồ sơ đã lưu trữ
            </label>
          }
        />
      </section>
    </Guard>
  );
}

export function LeadForm() {
  const { db, actor, run, busy } = useWorkspace();
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = db.leads.find((l) => l.id === id);
  const [form, setForm] = useState<LeadInput>(
    existing
      ? { ...existing }
      : {
          name: "",
          phone: "",
          city: "",
          vehicle: "Motorbike",
          sourceId: "",
          tags: [],
          note: "",
        },
  );
  const phone = normalizePhone(form.phone);
  const duplicate =
    phone.length >= 10
      ? db.leads.find((l) => l.id !== id && normalizePhone(l.phone) === phone)
      : undefined;
  const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  if (id && !existing)
    return (
      <div className="panel">
        <Empty title="Không tìm thấy hồ sơ" />
      </div>
    );
  return (
    <Guard allowed={canEditLead(actor)}>
      <PageHeading
        title={id ? `Sửa hồ sơ · ${existing?.name}` : "Tiếp nhận Lead mới"}
        back={id ? `/leads/${id}/show` : "/leads"}
        backLabel={id ? "Về hồ sơ" : "Hồ sơ Lead"}
      />
      <form
        className="panel"
        style={{ maxWidth: 860 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              { type: "saveLead", id, input: form },
              id ? "Đã cập nhật hồ sơ." : "Đã tạo hồ sơ Lead.",
            )
          ) {
            navigate(id ? `/leads/${id}/show` : "/leads");
          }
        }}
      >
        <div className="panel-body stack-form">
          <div className="form-grid">
            <Field label="Số điện thoại *" hint="0xxxxxxxxx hoặc +84xxxxxxxxx">
              <Input
                autoFocus={!id}
                required
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="0901234567"
              />
            </Field>
            <Field label="Họ và tên *">
              <Input
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </Field>
            {duplicate && (
              <div className="callout full-span" role="status">
                <TriangleAlert size={16} />
                <span>
                  Số này đã có hồ sơ <b>{duplicate.name}</b> ({duplicate.id},{" "}
                  {leadLabels[duplicate.status]}).{" "}
                  <Link to={`/leads/${duplicate.id}/show`}>
                    Mở hồ sơ để bổ sung
                  </Link>{" "}
                  thay vì tạo mới.
                </span>
              </div>
            )}
            {!duplicate && phone.length === 10 && !id && (
              <div className="callout ok full-span" role="status">
                Số mới — chưa có hồ sơ nào dùng số này.
              </div>
            )}
            <Field label="Thành phố đăng ký chạy xe *">
              <Input
                required
                list="cities"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Chọn hoặc nhập"
              />
            </Field>
            <datalist id="cities">
              {[...new Set([...cities, ...db.leads.map((l) => l.city)])].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </datalist>
            <Field label="Loại phương tiện *">
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
            <Field
              label="Nguồn Lead *"
            >
              <select
                required
                value={form.sourceId}
                onChange={(e) => set("sourceId", e.target.value)}
              >
                <option value="">Chọn nguồn</option>
                {db.sources
                  .filter(
                    (s) =>
                      s.active &&
                      (s.id !== "web" || s.id === existing?.sourceId),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Nhãn" hint="Cách nhau bằng dấu phẩy">
              <Input
                value={form.tags.join(",")}
                onChange={(e) => set("tags", e.target.value.split(","))}
                placeholder="Cần gọi lại, Giới thiệu"
              />
            </Field>
            <Field label="Ghi chú" className="full-span">
              <Textarea
                rows={3}
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="Thông tin cần lưu ý…"
              />
            </Field>
          </div>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={busy || !!duplicate}>
              {id ? "Lưu thay đổi" : "Tạo hồ sơ"}
            </Button>
          </div>
        </div>
      </form>
    </Guard>
  );
}

const transitionLabel: Record<LeadStatus, string> = {
  Activated: "Xác nhận đã đăng ký (Activated)",
  Onboarded: "Xác nhận đã chạy đơn đầu (Onboarded)",
  Closed: "Đóng hồ sơ (Closed)",
  New: "Mới (New)",
};

function LeadStatusForm({ leadId }: { leadId: string }) {
  const { db, run, busy } = useWorkspace();
  const l = db.leads.find((l) => l.id === leadId)!;
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [reason, setReason] = useState("");
  const [at, setAt] = useState(localDateTime);
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          status &&
          (await run(
            { type: "leadStatus", id: l.id, status, reason, occurredAt: at },
            "Đã cập nhật trạng thái hồ sơ.",
          ))
        ) {
          setReason("");
          setStatus("");
        }
      }}
    >
      <Field label="Thao tác">
        <select
          required
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus)}
        >
          <option value="">Chọn thao tác</option>
          {(["New", "Activated", "Onboarded"] as LeadStatus[])
            .filter((s) => s !== l.status)
            .map((s) => (
              <option key={s} value={s}>
                {transitionLabel[s]}
              </option>
            ))}
        </select>
      </Field>
      {status && (
        <>
          <Field label="Căn cứ *">
            <Textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: đã đối chiếu đăng ký thành công"
            />
          </Field>
          <Field label="Thời điểm xảy ra">
            <Input
              type="datetime-local"
              required
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
          </Field>
        </>
      )}
      <Button type="submit" disabled={busy || !status}>
        Lưu trạng thái
      </Button>
    </form>
  );
}

export function LeadShow() {
  const { id } = useParams();
  const { db, actor, run, busy } = useWorkspace();
  const l = db.leads.find((l) => l.id === id);

  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callLogOpen, setCallLogOpen] = useState(false);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [leadNote, setLeadNote] = useState(l?.note ?? "");

  useEffect(() => {
    if (l) setLeadNote(l.note ?? "");
  }, [l?.note]);

  if (!l)
    return (
      <div className="panel">
        <Empty
          title="Không tìm thấy hồ sơ"
          action={
            <Button asChild variant="outline">
              <Link to="/leads">Về danh sách</Link>
            </Button>
          }
        />
      </div>
    );
  if (!canReadLead(db, actor, l.id))
    return <Guard allowed={false}>{null}</Guard>;
  const editor = canEditLead(actor);
  // Telesale only sees the tickets they handled; leader sees the team's.
  const tickets = db.assignments
    .filter(
      (t) =>
        t.leadId === l.id &&
        (actor.role !== "telesale" || t.assigneeId === actor.id),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activities = db.activities
    .filter((a) => tickets.some((t) => t.id === a.assignmentId))
    .sort((a, b) => b.at.localeCompare(a.at));
  const live = db.assignments.find(
    (t) => t.leadId === l.id && t.status !== "Closed",
  );
  const myTicket = tickets.find(
    (t) =>
      (actor.role === "admin" ||
        actor.role === "leader" ||
        t.assigneeId === actor.id) &&
      t.status !== "Closed",
  );
  const info: [string, ReactNode][] = [
    ["Mã hồ sơ", l.id],
    ["SĐT", l.phone],
    ["Họ tên", l.name],
    ["Khu vực đăng ký", normalizeCity(l.city)],
    ["Phương tiện", vehicleLabel(l.vehicle)],
    ["Thời gian tiếp nhận hồ sơ", formatDate(l.receivedAt, true)],
    ["Nguồn Lead", sourceName(db, l.sourceId)],
    ["Trạng thái đăng ký", <Badge key="s" status={l.status} />],
    ...(l.note ? [["Ghi chú tiếp nhận", l.note] as [string, ReactNode]] : []),
  ];
  return (
    <>
      <Link className="back-link" to="/leads">
        <ArrowLeft size={14} />
        Hồ sơ Lead
      </Link>
      <div className="profile-head">
        <Avatar name={l.name} size="lg" />
        <div>
          <h1>{l.name}</h1>
          <div className="meta">
            <span>{l.id}</span>
            <Badge status={l.status} />
            {l.archived && <Chip plain>Đã lưu trữ</Chip>}
          </div>
        </div>
        <div className="page-actions">
          {editor && !l.archived && (
            <Button asChild variant="outline">
              <Link to={`/leads/${l.id}`}>
                <Pencil /> Sửa
              </Link>
            </Button>
          )}
          {canAssign(actor) && l.status === "New" && !l.archived && (
            <AssignmentDialog leadId={l.id} transfer={!!live} />
          )}
        </div>
      </div>

      {myTicket && !l.archived && (
        <div
          className="panel"
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            background: "var(--bg-subtle, #f9fafb)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>Thao tác Telesale:</span>
          {myTicket.assigneeId === actor.id && !myTicket.acceptedAt && (
            <Button
              size="sm"
              variant="default"
              disabled={busy}
              onClick={() =>
                void run(
                  { type: "accept", id: myTicket.id },
                  "Đã nhận việc thành công.",
                )
              }
            >
              <UserCheck size={14} /> Nhận việc
            </Button>
          )}
          <Button
            size="sm"
            variant="default"
            onClick={() => setCallDialogOpen(true)}
          >
            <Phone size={14} /> Gọi điện
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCallLogOpen(true)}
          >
            <PhoneCall size={14} /> Ghi nhận cuộc gọi & Bằng chứng
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setApptDialogOpen(true)}
          >
            <CalendarDays size={14} /> Tạo lịch hẹn
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to={`/tasks/${myTicket.id}`}>
              Mở phiếu ({ticketCode(myTicket)}) →
            </Link>
          </Button>
        </div>
      )}

      <div className="grid-2">
        <div className="col">
          <Panel title="Thông tin hồ sơ" bodyless>
            <table className="data-table profile-table">
              <tbody>
                {info.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          {!editor && (
            <Panel
              title="Lịch sử liên hệ & cuộc gọi"
              aside={<span>{activities.length} lần liên hệ</span>}
              bodyless
            >
              {activities.length ? (
                <div className="timeline">
                  {activities.map((a) => {
                    const t = tickets.find((t) => t.id === a.assignmentId);
                    const appt = db.appointments.find(
                      (ap) =>
                        ap.id === a.appointmentId || ap.activityId === a.id,
                    );
                    const callDirection =
                      a.direction === "inbound" ? "Cuộc gọi đến" : "Cuộc gọi đi";
                    return (
                      <article
                        key={a.id}
                        className={`tl-item ${a.voidedAt ? "voided" : ""}`}
                      >
                        <span
                          className={`tl-icon ${a.channel === "zalo" ? "zalo" : ""}`}
                        >
                          {a.channel === "call" ? (
                            a.direction === "inbound" ? (
                              <PhoneIncoming size={15} />
                            ) : (
                              <PhoneOutgoing size={15} />
                            )
                          ) : (
                            <MessageCircle size={15} />
                          )}
                        </span>
                        <div>
                          <div className="tl-top">
                            <strong>
                              {a.channel === "call" ? callDirection : "Zalo"} ·{" "}
                              {outcomeLabels[a.outcome]}
                              {a.decision !== "none" &&
                                ` · ${decisionLabels[a.decision]}`}
                            </strong>
                            <time>{formatDate(a.at, true)}</time>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                              alignItems: "center",
                              margin: "2px 0 6px",
                            }}
                          >
                            <small className="muted">
                              Thực hiện: {memberName(db, a.actorId)} ·{" "}
                              {t ? (
                                <Link
                                  className="record-link"
                                  to={`/tasks/${t.id}`}
                                >
                                  {ticketCode(t)}
                                </Link>
                              ) : (
                                a.assignmentId
                              )}
                            </small>
                            {a.durationSeconds ? (
                              <Chip plain>
                                Thời lượng:{" "}
                                {Math.floor(a.durationSeconds / 60)}p{" "}
                                {a.durationSeconds % 60}s
                              </Chip>
                            ) : null}
                          </div>

                          {a.note && <p className="tl-note">{a.note}</p>}

                          {appt && (
                            <div
                              style={{
                                margin: "6px 0",
                                padding: "4px 8px",
                                background: "var(--bg-subtle, #f0fdf4)",
                                borderRadius: 4,
                                fontSize: 12,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <CalendarDays size={13} />
                              <span>
                                Lịch hẹn: {formatDate(appt.at, true)} tại{" "}
                                {appt.place}
                              </span>
                            </div>
                          )}

                          {!a.voidedAt && (
                            <div style={{ marginTop: 6 }}>
                              <Evidence
                                activity={a}
                                ticketId={a.assignmentId}
                                editable={false}
                              />
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  title="Chưa có lần liên hệ"
                  description="Bấm 'Ghi nhận cuộc gọi & Bằng chứng' ở trên để bắt đầu liên hệ và ghi nhận kết quả."
                />
              )}
            </Panel>
          )}
        </div>
        <div className="col">
          {editor && !l.archived && (
            <Panel title="Ghi chú hồ sơ Lead">
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run(
                    { type: "leadNote", id: l.id, note: leadNote },
                    "Đã cập nhật ghi chú Lead.",
                  );
                }}
              >
                <Textarea
                  rows={3}
                  value={leadNote}
                  onChange={(e) => setLeadNote(e.target.value)}
                  placeholder="Ghi chú chi tiết về tài xế (nguyện vọng, thời gian chạy, giấy tờ còn thiếu...)"
                />
                <Button
                  size="sm"
                  type="submit"
                  disabled={busy || leadNote === (l.note ?? "")}
                >
                  Lưu ghi chú
                </Button>
              </form>
            </Panel>
          )}
          {editor && !l.archived && (
            <Panel title="Cập nhật trạng thái hồ sơ">
              <LeadStatusForm key={`${l.id}-${l.status}`} leadId={l.id} />
            </Panel>
          )}
          {editor && (
            <Panel title="Thao tác khác">
              {!l.archived && (
                <LeadCorrections key={`${l.id}-${l.version}`} lead={l} />
              )}
              <Button
                variant="outline"
                size="sm"
                style={{ marginTop: 14 }}
                disabled={busy}
                onClick={() =>
                  void run(
                    { type: "archiveLead", id: l.id },
                    l.archived ? "Đã khôi phục hồ sơ." : "Đã lưu trữ hồ sơ.",
                  )
                }
              >
                <Archive />
                {l.archived ? "Khôi phục hồ sơ" : "Lưu trữ hồ sơ"}
              </Button>
            </Panel>
          )}
          {editor && (
            <Panel title="Lịch sử cập nhật hồ sơ" bodyless>
              {db.audit.some((a) => a.target === l.id) ? (
                <div className="timeline">
                  {db.audit
                    .filter((a) => a.target === l.id)
                    .map((a) => (
                      <article key={a.id} className="tl-item">
                        <span className="tl-icon">
                          <Pencil size={14} />
                        </span>
                        <div>
                          <div className="tl-top">
                            <strong>{a.action}</strong>
                            <time>{formatDate(a.at, true)}</time>
                          </div>
                          <small className="muted">
                            {memberName(db, a.actorId)}
                          </small>
                          {a.detail && <p className="tl-note">{a.detail}</p>}
                        </div>
                      </article>
                    ))}
                </div>
              ) : (
                <Empty title="Chưa có cập nhật" description="" />
              )}
            </Panel>
          )}
          {!editor && tickets.length > 0 && (
            <Panel title="Phiếu đã tư vấn" bodyless>
              <div className="table-scroll">
                <table className="data-table lead-tickets-table">
                  <thead>
                    <tr>
                      <th>Mã phiếu</th>
                      <th>Chuyên viên</th>
                      <th>Thời điểm tạo</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link className="record-link nowrap" to={`/tasks/${t.id}`}>
                            {ticketCode(t)}
                          </Link>
                        </td>
                        <td className="nowrap">{memberName(db, t.assigneeId)}</td>
                        <td className="nowrap">{formatDate(t.createdAt)}</td>
                        <td>
                          <Badge status={t.status} ticket />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Telesale Action Modals */}
      {myTicket && (
        <>
          <CallDialog
            open={callDialogOpen}
            onOpenChange={setCallDialogOpen}
            ticketId={myTicket.id}
            leadId={l.id}
            onStartLog={() => setCallLogOpen(true)}
          />
          <CallLogModal
            open={callLogOpen}
            onOpenChange={setCallLogOpen}
            ticketId={myTicket.id}
            leadId={l.id}
          />
          <AppointmentCreateDialog
            open={apptDialogOpen}
            onOpenChange={setApptDialogOpen}
            ticketId={myTicket.id}
            leadId={l.id}
          />
        </>
      )}
    </>
  );
}
