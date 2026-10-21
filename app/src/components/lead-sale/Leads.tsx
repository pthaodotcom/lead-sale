import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Archive,
  ArrowUpRight,
  Download,
  Pencil,
  Plus,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./context";
import { AssignmentDialog } from "./AssignmentDialog";
import {
  Badge,
  downloadCsv,
  Empty,
  Field,
  formatDate,
  Guard,
  PageHeading,
  SearchBox,
  textMatches,
} from "./shared";
import {
  canAssign,
  canEditLead,
  canReadLead,
  leadLabels,
  outcomeLabels,
  normalizePhone,
} from "./domain";
import type { LeadInput, LeadStatus } from "./types";

export function LeadsList() {
  const { db, actor } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [city, setCity] = useState("");
  const [archived, setArchived] = useState(false);
  const status = params.get("status") ?? "";
  const items = db.leads.filter(
    (l) =>
      canReadLead(db, actor, l.id) &&
      l.archived === archived &&
      (!status || l.status === status) &&
      (!source || l.sourceId === source) &&
      (!city || l.city === city) &&
      textMatches(q, l.name, l.phone, l.id, ...l.tags),
  );
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const safePage = Math.min(
    page,
    Math.max(1, Math.ceil(items.length / pageSize)),
  );
  return (
    <Guard allowed={actor.role !== "viewer"}>
      <PageHeading
        title="Hồ sơ Lead"
        description="Tiếp nhận, theo dõi và quản lý hồ sơ tài xế tiềm năng."
        action={
          <>
            {canEditLead(actor) && (
              <>
                <Button asChild variant="outline">
                  <Link to="/import">Nhập danh sách</Link>
                </Button>
                <Button asChild>
                  <Link to="/leads/create">
                    <Plus />
                    Tiếp nhận Lead
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />
      <section className="data-section">
        <div className="list-tabs">
          <button
            className={!status ? "active" : ""}
            onClick={async () => {
              setParams({});
              setPage(1);
            }}
          >
            Tất cả{" "}
            <span>
              {db.leads.filter((l) => l.archived === archived).length}
            </span>
          </button>
          {Object.entries(leadLabels).map(([key, label]) => (
            <button
              className={status === key ? "active" : ""}
              key={key}
              onClick={async () => {
                setParams({ status: key });
                setPage(1);
              }}
            >
              {label}
              <span>
                {
                  db.leads.filter(
                    (l) => l.status === key && l.archived === archived,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <SearchBox
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
          />
          <select
            aria-label="Lọc theo nguồn"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả nguồn</option>
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
              setPage(1);
            }}
          >
            <option value="">Tất cả thành phố</option>
            {[...new Set(db.leads.map((l) => l.city))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            aria-label="Xuất danh sách đang lọc"
            disabled={!["admin", "intake", "leader"].includes(actor.role)}
            onClick={async () =>
              downloadCsv("lead-sale.csv", [
                [
                  "Mã hồ sơ",
                  "Họ tên",
                  "SĐT",
                  "Thành phố",
                  "Nguồn",
                  "Trạng thái",
                  "Ngày tiếp nhận",
                ],
                ...items.map((l) => [
                  l.id,
                  l.name,
                  l.phone,
                  l.city,
                  db.sources.find((s) => s.id === l.sourceId)?.name ?? "",
                  leadLabels[l.status],
                  formatDate(l.receivedAt),
                ]),
              ])
            }
          >
            <Download />
          </Button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tài xế</th>
                <th>Thành phố / Xe</th>
                <th>Nguồn Lead</th>
                <th>Ngày tiếp nhận</th>
                <th>Trạng thái</th>
                <th aria-label="Xem chi tiết" />
              </tr>
            </thead>
            <tbody>
              {items
                .slice((safePage - 1) * pageSize, safePage * pageSize)
                .map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link className="person-cell" to={`/leads/${l.id}/show`}>
                        <span className="table-avatar">
                          {l.name
                            .split(" ")
                            .slice(-2)
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <span>
                          <strong>{l.name}</strong>
                          <small>
                            {l.phone} <span className="separator">·</span>{" "}
                            {l.id}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      {l.city}
                      <small>{l.vehicle === "Van" ? "Xe Van" : "Xe máy"}</small>
                    </td>
                    <td>{db.sources.find((s) => s.id === l.sourceId)?.name}</td>
                    <td>{formatDate(l.receivedAt)}</td>
                    <td>
                      <Badge status={l.status} />
                    </td>
                    <td>
                      <Link
                        className="icon-link"
                        aria-label={`Xem hồ sơ ${l.name}`}
                        to={`/leads/${l.id}/show`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!items.length && <Empty />}
        <div className="table-footer">
          <label className="inline-check">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => {
                setArchived(e.target.checked);
                setPage(1);
              }}
            />
            Hồ sơ lưu trữ
          </label>
          <span>
            {items.length
              ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, items.length)} / ${items.length} hồ sơ`
              : "0 hồ sơ"}
          </span>
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 1}
              onClick={async () => setPage(safePage - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage * pageSize >= items.length}
              onClick={async () => setPage(safePage + 1)}
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
  const { db, actor, run } = useWorkspace();
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
  const [error, setError] = useState("");
  const duplicate = db.leads.find(
    (l) =>
      l.id !== id && normalizePhone(l.phone) === normalizePhone(form.phone),
  );
  const field = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  if (id && !existing) return <Empty title="Không tìm thấy hồ sơ" />;
  return (
    <Guard allowed={canEditLead(actor)}>
      <PageHeading
        title={id ? "Chỉnh sửa hồ sơ" : "Tiếp nhận Lead mới"}
        description="Kiểm tra số điện thoại để bổ sung đúng hồ sơ đã có."
        back="/leads"
      />
      <form
        className="form-surface lead-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (
            await run(
              { type: "saveLead", id, input: form },
              id ? "Đã cập nhật hồ sơ." : "Đã tiếp nhận Lead mới.",
            )
          )
            navigate(id ? `/leads/${id}/show` : "/leads");
          else
            setError(
              "Chưa lưu được hồ sơ. Kiểm tra thông báo và thông tin đã nhập.",
            );
        }}
      >
        <div className="section-label">
          <UserRound size={18} />
          <h2>Thông tin tài xế</h2>
        </div>
        <div className="form-grid">
          <Field label="Họ và tên *">
            <Input
              autoFocus
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="Nhập họ tên tài xế"
            />
          </Field>
          <Field
            label="Số điện thoại *"
            hint="Chấp nhận 0xxxxxxxxx hoặc +84xxxxxxxxx."
          >
            <Input
              required
              type="tel"
              value={form.phone}
              onChange={(e) => field("phone", e.target.value)}
              placeholder="Ví dụ: 0901234567"
            />
          </Field>
          {duplicate && (
            <p role="status" className="full-span review-notice">
              Số điện thoại đã có trong hồ sơ.{" "}
              <Link to={`/leads/${duplicate.id}`}>
                Mở {duplicate.name} để bổ sung
              </Link>
            </p>
          )}
          <Field label="Thành phố đăng ký *">
            <Input
              required
              list="cities"
              value={form.city}
              onChange={(e) => field("city", e.target.value)}
              placeholder="Chọn hoặc nhập thành phố"
            />
            <datalist id="cities">
              <option>Hồ Chí Minh</option>
              <option>Hà Nội</option>
              <option>Đà Nẵng</option>
            </datalist>
          </Field>
          <Field label="Loại phương tiện *">
            <select
              value={form.vehicle}
              onChange={(e) =>
                field("vehicle", e.target.value as LeadInput["vehicle"])
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
              onChange={(e) => field("sourceId", e.target.value)}
            >
              <option value="">Chọn nguồn tiếp nhận</option>
              {db.sources
                .filter((s) => s.active || s.id === existing?.sourceId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Nhãn" hint="Ngăn cách các nhãn bằng dấu phẩy.">
            <Input
              value={form.tags.join(",")}
              onChange={(e) => field("tags", e.target.value.split(","))}
              placeholder="Ví dụ: Cần gọi lại, Giới thiệu"
            />
          </Field>
          <div className="full-span">
            <Field label="Ghi chú hồ sơ">
              <Textarea
                rows={4}
                value={form.note}
                onChange={(e) => field("note", e.target.value)}
                placeholder="Thông tin cần lưu ý khi tiếp nhận…"
              />
            </Field>
          </div>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={async () => navigate(-1)}
          >
            Hủy
          </Button>
          <Button type="submit">
            {id ? "Lưu thay đổi" : "Tạo hồ sơ Lead"}
          </Button>
        </div>
      </form>
    </Guard>
  );
}

export function LeadShow() {
  const { id } = useParams();
  const { db, actor, run } = useWorkspace();
  const l = db.leads.find((l) => l.id === id);
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [reason, setReason] = useState("");
  if (!l) return <Empty title="Không tìm thấy hồ sơ" />;
  if (!canReadLead(db, actor, l.id))
    return <Guard allowed={false}>{null}</Guard>;
  const tickets = db.assignments.filter((t) => t.leadId === l.id);
  const activities = db.activities.filter((a) => a.leadId === l.id);
  const live = tickets.find((t) => t.status !== "Closed");
  const transitions = {
    New: ["Activated", "Closed"],
    Activated: ["Onboarded"],
    Onboarded: [],
    Closed: ["New"],
  }[l.status];
  return (
    <>
      <PageHeading
        title={l.name}
        description={`${l.id} · Tiếp nhận ${formatDate(l.receivedAt, true)}`}
        back="/leads"
        action={
          <>
            {canEditLead(actor) && !l.archived && (
              <Button asChild variant="outline">
                <Link to={`/leads/${l.id}`}>
                  <Pencil />
                  Chỉnh sửa
                </Link>
              </Button>
            )}
            {canAssign(actor) && l.status === "New" && !l.archived && (
              <AssignmentDialog leadId={l.id} transfer={!!live} />
            )}
          </>
        }
      />
      <div className="detail-grid">
        <div className="detail-main">
          <section className="data-section">
            <div className="section-header">
              <h2>Hồ sơ tài xế</h2>
              <Badge status={l.status} />
            </div>
            <dl className="info-grid">
              <div>
                <dt>Số điện thoại</dt>
                <dd>
                  <a href={`tel:${l.phone}`}>{l.phone}</a>
                </dd>
              </div>
              <div>
                <dt>Thành phố</dt>
                <dd>{l.city}</dd>
              </div>
              <div>
                <dt>Phương tiện</dt>
                <dd>{l.vehicle === "Van" ? "Xe Van" : "Xe máy"}</dd>
              </div>
              <div>
                <dt>Nguồn Lead</dt>
                <dd>{db.sources.find((s) => s.id === l.sourceId)?.name}</dd>
              </div>
              <div>
                <dt>Nhãn</dt>
                <dd>{l.tags.join(", ") || "Chưa có"}</dd>
              </div>
              <div>
                <dt>Cập nhật cuối</dt>
                <dd>{formatDate(l.updatedAt, true)}</dd>
              </div>
            </dl>
            {l.note && <p className="detail-note">{l.note}</p>}
          </section>
          <section className="data-section">
            <div className="section-header">
              <h2>Lịch sử phân công</h2>
              <span>{tickets.length} phiếu</span>
            </div>
            {tickets.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Phiếu</th>
                      <th>Người phụ trách</th>
                      <th>Ngày giao / Hết hạn</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link to={`/assignments/${t.id}/show`}>{t.id}</Link>
                          {t.closeReason && <small>{t.closeReason}</small>}
                        </td>
                        <td>
                          {db.members.find((m) => m.id === t.assigneeId)?.name}
                        </td>
                        <td>
                          {formatDate(t.createdAt)}
                          <small>Đến {formatDate(t.expiresAt)}</small>
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
                description="Trưởng nhóm tạo phiếu để giao nhân viên tư vấn."
              />
            )}
          </section>
          <section className="data-section">
            <div className="section-header">
              <h2>Lịch sử tư vấn</h2>
              <span>{activities.length} hoạt động</span>
            </div>
            {activities.length ? (
              <div className="timeline">
                {activities
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .map((a) => (
                    <article key={a.id}>
                      <span className="timeline-dot" />
                      <div className="timeline-title">
                        <strong>
                          {a.channel === "call" ? "Gọi điện" : "Nhắn Zalo"} ·{" "}
                          {outcomeLabels[a.outcome]}
                        </strong>
                        <time>{formatDate(a.at, true)}</time>
                      </div>
                      <small>
                        {db.members.find((m) => m.id === a.actorId)?.name} ·{" "}
                        {a.assignmentId}
                      </small>
                      <p>{a.note}</p>
                    </article>
                  ))}
              </div>
            ) : (
              <Empty
                title="Chưa có hoạt động tư vấn"
                description="Các lần liên hệ sẽ được lưu theo từng phiếu phân công."
              />
            )}
          </section>
        </div>
        <aside className="detail-side">
          <section className="data-section">
            <div className="section-header">
              <h2>Người phụ trách</h2>
            </div>
            <div className="side-content">
              {live ? (
                <>
                  <strong>
                    {db.members.find((m) => m.id === live.assigneeId)?.name}
                  </strong>
                  <p>{live.id}</p>
                  <Badge status={live.status} ticket />
                  <p>Hiệu lực đến {formatDate(live.expiresAt, true)}</p>
                </>
              ) : (
                <p>Chưa có phiếu đang hiệu lực.</p>
              )}
            </div>
          </section>
          {canEditLead(actor) && !l.archived && transitions.length > 0 && (
            <section className="data-section">
              <div className="section-header">
                <h2>Cập nhật trạng thái Lead</h2>
              </div>
              <form
                className="side-content stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    status &&
                    (await run(
                      { type: "leadStatus", id: l.id, status, reason },
                      "Đã cập nhật trạng thái hồ sơ.",
                    ))
                  ) {
                    setReason("");
                    setStatus("");
                  }
                }}
              >
                <Field label="Trạng thái tiếp theo">
                  <select
                    required
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  >
                    <option value="">Chọn trạng thái</option>
                    {transitions.map((s) => (
                      <option key={s} value={s}>
                        {leadLabels[s as LeadStatus]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Căn cứ cập nhật">
                  <Textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ví dụ: Đã đối chiếu đăng ký thành công…"
                  />
                </Field>
                <Button type="submit">Lưu trạng thái hồ sơ</Button>
              </form>
            </section>
          )}
          {canEditLead(actor) && (
            <Button
              variant="outline"
              onClick={async () =>
                await run(
                  { type: "archiveLead", id: l.id },
                  l.archived ? "Đã khôi phục hồ sơ." : "Đã lưu trữ hồ sơ.",
                )
              }
            >
              <Archive />
              {l.archived ? "Khôi phục hồ sơ" : "Lưu trữ hồ sơ"}
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
