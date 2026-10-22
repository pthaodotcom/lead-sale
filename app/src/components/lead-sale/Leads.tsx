import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Archive,
  ArrowLeft,
  BookUser,
  Download,
  FileUp,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./context";
import { AssignmentDialog } from "./AssignmentDialog";
import { IntakeLink } from "./IntakeLink";
import { VoicePanel } from "./VoicePanel";
import { LeadCorrections } from "./Corrections";
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
  relativeDeadline,
  SearchBox,
  sourceName,
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
        (!city || l.city === city) &&
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
        description={
          actor.role === "telesale"
            ? "Hồ sơ tài xế bạn đang được giao tư vấn (chỉ xem)."
            : "Mỗi tài xế một hồ sơ theo số điện thoại."
        }
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
            {[...new Set(db.leads.map((l) => l.city))].sort().map((c) => (
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
        <div className="table-foot">
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
          <span>
            {items.length
              ? `${(current - 1) * PAGE + 1}–${Math.min(current * PAGE, items.length)} trên ${items.length} hồ sơ`
              : "0 hồ sơ"}
          </span>
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
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
        description="Nhập số điện thoại trước — hệ thống kiểm tra trùng ngay."
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
              {[
                ...new Set([
                  "Hồ Chí Minh",
                  "Hà Nội",
                  "Đà Nẵng",
                  ...db.leads.map((l) => l.city),
                ]),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
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
            <Field label="Nguồn Lead *">
              <select
                required
                value={form.sourceId}
                onChange={(e) => set("sourceId", e.target.value)}
              >
                <option value="">Chọn nguồn</option>
                {db.sources
                  .filter((s) => s.active || s.id === existing?.sourceId)
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

const transitionsOf: Record<LeadStatus, LeadStatus[]> = {
  New: ["Activated", "Closed"],
  Activated: ["Onboarded"],
  Onboarded: [],
  Closed: ["New"],
};
const transitionLabel: Record<LeadStatus, string> = {
  Activated: "Xác nhận đã đăng ký (Activated)",
  Onboarded: "Xác nhận đã chạy đơn đầu (Onboarded)",
  Closed: "Đóng hồ sơ (Closed)",
  New: "Mở lại hồ sơ (New)",
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
          {transitionsOf[l.status].map((s) => (
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
              step="any"
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
  const [tab, setTab] = useState("tickets");
  const l = db.leads.find((l) => l.id === id);
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
  const tickets = db.assignments
    .filter((t) => t.leadId === l.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activities = db.activities
    .filter((a) => a.leadId === l.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const receptions = db.receptions
    .filter((r) => r.leadId === l.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const live = tickets.find((t) => t.status !== "Closed");
  const editor = canEditLead(actor);
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
            <a href={`tel:${l.phone}`}>
              <Phone size={13} style={{ display: "inline" }} /> {l.phone}
            </a>
            <span>{l.id}</span>
            <span>
              {l.city} · {vehicleLabel(l.vehicle)}
            </span>
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
      <VoicePanel leadId={l.id} canCall={editor && !l.archived} />
      <div className="grid-2">
        <section className="panel">
          <div className="milestones">
            <div className="milestone done">
              <span>Tiếp nhận đầu</span>
              <strong>{formatDate(l.receivedAt, true)}</strong>
            </div>
            <div className={`milestone ${l.activatedAt ? "done" : ""}`}>
              <span>Hoàn tất đăng ký</span>
              <strong>
                {l.activatedAt ? formatDate(l.activatedAt, true) : "Chưa"}
              </strong>
            </div>
            <div className={`milestone ${l.onboardedAt ? "done" : ""}`}>
              <span>Chạy đơn đầu</span>
              <strong>
                {l.onboardedAt ? formatDate(l.onboardedAt, true) : "Chưa"}
              </strong>
            </div>
          </div>
          <div className="tabs">
            {[
              ["tickets", "Phiếu phân công", tickets.length],
              ["activity", "Lịch sử tư vấn", activities.length],
              ["receptions", "Lần tiếp nhận", receptions.length || 1],
              ["info", "Thông tin", undefined],
            ].map(([k, label, n]) => (
              <button
                key={k as string}
                className={tab === k ? "active" : ""}
                onClick={() => setTab(k as string)}
              >
                {label}
                {n !== undefined && <span className="count">{n}</span>}
              </button>
            ))}
          </div>
          {tab === "tickets" &&
            (tickets.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Phiếu</th>
                      <th>Chuyên viên</th>
                      <th>Tạo / Hạn</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link className="record-link" to={`/tasks/${t.id}`}>
                            {t.id}
                          </Link>
                          {t.closeReason && <small>{t.closeReason}</small>}
                        </td>
                        <td>{memberName(db, t.assigneeId)}</td>
                        <td>
                          {formatDate(t.createdAt, true)}
                          <small>Hạn {formatDate(t.expiresAt, true)}</small>
                        </td>
                        <td>
                          <Badge status={t.status} ticket />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Chưa được phân công"
                description="Trưởng nhóm giao hồ sơ này trong mục Điều phối."
              />
            ))}
          {tab === "activity" &&
            (activities.length ? (
              <div className="timeline">
                {activities.map((a) => (
                  <article
                    key={a.id}
                    className={`tl-item ${a.voidedAt ? "voided" : ""}`}
                  >
                    <span
                      className={`tl-icon ${a.channel === "zalo" ? "zalo" : ""}`}
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
                          {outcomeLabels[a.outcome]}
                          {a.decision !== "none" &&
                            ` · ${decisionLabels[a.decision]}`}
                        </strong>
                        <time>{formatDate(a.at, true)}</time>
                      </div>
                      <small className="muted">
                        {memberName(db, a.actorId)} · phiếu {a.assignmentId}
                      </small>
                      {a.note && <p className="tl-note">{a.note}</p>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Chưa có lần liên hệ"
                description="Các lần gọi/nhắn Zalo được ghi theo từng phiếu."
              />
            ))}
          {tab === "receptions" && (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Nguồn</th>
                    <th>Người tiếp nhận</th>
                    <th>Nội dung tiếp nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {(receptions.length
                    ? receptions
                    : [
                        {
                          id: "first",
                          at: l.receivedAt,
                          sourceId: l.sourceId,
                          actorId: "",
                          note: "",
                        },
                      ]
                  ).map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.at, true)}</td>
                      <td>{sourceName(db, r.sourceId)}</td>
                      <td>
                        {r.actorId === "public-form"
                          ? "Tài xế tự đăng ký"
                          : r.actorId
                            ? memberName(db, r.actorId)
                            : "—"}
                      </td>
                      <td style={{ minWidth: 240, whiteSpace: "normal" }}>
                        {r.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "info" && (
            <div className="panel-body">
              <dl className="info-grid">
                <div>
                  <dt>Nguồn tiếp nhận đầu</dt>
                  <dd>{sourceName(db, l.sourceId)}</dd>
                </div>
                <div>
                  <dt>Nhãn</dt>
                  <dd>
                    {l.tags.length ? (
                      <span className="row-actions">
                        {l.tags.map((t) => (
                          <span className="tag" key={t}>
                            {t}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "Chưa có"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Cập nhật cuối</dt>
                  <dd>{formatDate(l.updatedAt, true)}</dd>
                </div>
                <div>
                  <dt>Ghi chú hồ sơ</dt>
                  <dd>{l.note || "—"}</dd>
                </div>
                <div>
                  <dt>Quận / huyện</dt>
                  <dd>{l.profile?.district || "Chưa cung cấp"}</dd>
                </div>
                <div>
                  <dt>Tình trạng xe</dt>
                  <dd>
                    {l.profile?.hasVehicle === "yes"
                      ? "Đã có xe"
                      : l.profile?.hasVehicle === "no"
                        ? "Chưa có xe"
                        : "Chưa cung cấp"}
                  </dd>
                </div>
                <div>
                  <dt>Khung giờ tiện nghe máy</dt>
                  <dd>
                    {
                      {
                        morning: "Buổi sáng (8–12h)",
                        afternoon: "Buổi chiều (13–17h)",
                        evening: "Buổi tối (17–20h)",
                        any: "Bất kỳ lúc nào",
                        "": "Chưa cung cấp",
                      }[l.profile?.callTime ?? ""]
                    }
                  </dd>
                </div>
                <div>
                  <dt>Giấy tờ đã có</dt>
                  <dd>
                    {(
                      [
                        ["cccd", "CCCD"],
                        ["license", "Giấy phép lái xe"],
                        ["registration", "Đăng ký xe"],
                      ] as const
                    )
                      .filter(([key]) => l.profile?.documents?.[key])
                      .map(([, label]) => label)
                      .join(", ") || "Chưa cung cấp"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>
        <div className="col">
          <Panel title="Người phụ trách">
            {live ? (
              <>
                <div className="person" style={{ marginBottom: 10 }}>
                  <Avatar name={memberName(db, live.assigneeId)} />
                  <div>
                    <strong>{memberName(db, live.assigneeId)}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Phiếu {live.id} · {relativeDeadline(live.expiresAt)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge status={live.status} ticket />
                  <Button asChild variant="link" size="sm">
                    <Link to={`/tasks/${live.id}`}>Mở phiếu</Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {l.status === "New" && !l.archived
                  ? "Chưa có phiếu đang hiệu lực — hồ sơ nằm trong hàng chờ phân công."
                  : "Không có phiếu đang hiệu lực."}
              </p>
            )}
          </Panel>
          {editor && !l.archived && transitionsOf[l.status].length > 0 && (
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
        </div>
      </div>
    </>
  );
}
