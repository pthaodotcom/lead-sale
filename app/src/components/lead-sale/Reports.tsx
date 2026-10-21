import { useState } from "react";
import { Link } from "react-router";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { leadLabels } from "./domain";
import {
  Badge,
  downloadCsv,
  Empty,
  Field,
  formatDate,
  PageHeading,
} from "./shared";

export function Reports() {
  const { db } = useWorkspace();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [member, setMember] = useState("");
  const owner = (id: string) =>
    db.assignments
      .filter((t) => t.leadId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.assigneeId;
  const day = (stamp: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(stamp),
    );
  const invalid = !!from && !!to && from > to;
  const leads = invalid
    ? []
    : db.leads.filter(
        (l) =>
          !l.archived &&
          (!from || day(l.receivedAt) >= from) &&
          (!to || day(l.receivedAt) <= to) &&
          (!source || l.sourceId === source) &&
          (!status || l.status === status) &&
          (!member || owner(l.id) === member),
      );
  const registered = leads.filter(
    (l) => l.status === "Activated" || l.status === "Onboarded",
  ).length;
  const onboarded = leads.filter((l) => l.status === "Onboarded").length;
  const overdueIds = new Set(
    db.appointments
      .filter((a) => a.status === "scheduled" && Date.parse(a.at) < Date.now())
      .map((a) => a.leadId),
  );
  const overdue = leads.filter((l) => overdueIds.has(l.id)).length;
  return (
    <>
      <PageHeading
        title="Báo cáo tuyển tài xế"
        description="Đối chiếu hiệu quả tiếp nhận và chuyển đổi theo từng nhóm Lead."
        action={
          <Button
            variant="outline"
            disabled={!leads.length}
            onClick={() =>
              downloadCsv("bao-cao-lead.csv", [
                [
                  "Mã hồ sơ",
                  "Tài xế",
                  "SĐT",
                  "Nguồn",
                  "Trạng thái",
                  "Phụ trách gần nhất",
                  "Ngày tiếp nhận",
                ],
                ...leads.map((l) => [
                  l.id,
                  l.name,
                  l.phone,
                  db.sources.find((s) => s.id === l.sourceId)?.name ?? "",
                  leadLabels[l.status],
                  db.members.find((m) => m.id === owner(l.id))?.name ??
                    "Chưa phân công",
                  formatDate(l.receivedAt),
                ]),
              ])
            }
          >
            <Download />
            Xuất CSV đang lọc
          </Button>
        }
      />
      <section className="data-section">
        <div className="report-filters">
          <Field label="Tiếp nhận từ ngày">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Nguồn">
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Tất cả nguồn</option>
              {db.sources.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trạng thái Lead">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(leadLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phụ trách gần nhất">
            <select value={member} onChange={(e) => setMember(e.target.value)}>
              <option value="">Tất cả nhân viên</option>
              {db.members
                .filter((m) => m.role === "telesale")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        {invalid && (
          <p className="form-error side-content" role="alert">
            Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.
          </p>
        )}
      </section>
      <div className="stats-strip report-stats">
        <div>
          <span>Lead trong bộ lọc</span>
          <strong>{leads.length}</strong>
          <small>Mỗi hồ sơ được tính một lần</small>
        </div>
        <div>
          <span>Đã đăng ký</span>
          <strong>{registered}</strong>
          <small>
            {leads.length ? Math.round((registered / leads.length) * 100) : 0}%
            tổng hồ sơ đang lọc
          </small>
        </div>
        <div>
          <span>Đã chạy đơn đầu</span>
          <strong>{onboarded}</strong>
          <small>
            {leads.length ? Math.round((onboarded / leads.length) * 100) : 0}%
            tổng hồ sơ đang lọc
          </small>
        </div>
        <div>
          <span>Lead quá hẹn</span>
          <strong>{overdue}</strong>
          <small>
            {leads.length ? Math.round((overdue / leads.length) * 100) : 0}%
            tổng hồ sơ đang lọc
          </small>
        </div>
      </div>
      <div className="dashboard-grid reports-grid">
        <section className="data-section">
          <div className="section-header">
            <h2>Chuyển đổi theo nguồn</h2>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nguồn</th>
                  <th>Tổng Lead</th>
                  <th>Đã đăng ký</th>
                  <th>Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {db.sources.map((s) => {
                  const ls = leads.filter((l) => l.sourceId === s.id);
                  const n = ls.filter((l) =>
                    ["Activated", "Onboarded"].includes(l.status),
                  ).length;
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{ls.length}</td>
                      <td>{n}</td>
                      <td>
                        {ls.length ? Math.round((n / ls.length) * 100) : 0}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="data-section">
          <div className="section-header">
            <h2>Phễu chuyển đổi</h2>
            <span>Lũy kế</span>
          </div>
          <div className="funnel">
            {[
              ["Đã tiếp nhận", leads.length],
              ["Đã đăng ký", registered],
              ["Đã chạy đơn", onboarded],
            ].map(([label, count]) => (
              <div className="funnel-row" key={label}>
                <div>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
                <div className="funnel-track">
                  <span
                    style={{
                      width: `${leads.length ? (Number(count) / leads.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="data-section">
        <div className="section-header">
          <h2>Dữ liệu chi tiết đối chiếu</h2>
          <span>{leads.length} hồ sơ</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tài xế</th>
                <th>Trạng thái</th>
                <th>Nguồn</th>
                <th>Phụ trách gần nhất</th>
                <th>Tiếp nhận</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link className="record-link" to={`/leads/${l.id}/show`}>
                      {l.name}
                    </Link>
                    <small>{l.id}</small>
                  </td>
                  <td>
                    <Badge status={l.status} />
                  </td>
                  <td>{db.sources.find((s) => s.id === l.sourceId)?.name}</td>
                  <td>
                    {db.members.find((m) => m.id === owner(l.id))?.name ??
                      "Chưa phân công"}
                  </td>
                  <td>{formatDate(l.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!leads.length && <Empty />}
      </section>
      <details className="metric-definitions">
        <summary>Cách tính số liệu bản xem thử</summary>
        <p>
          Lọc thời gian theo ngày tiếp nhận đầu tiên tại Việt Nam. Loại hồ sơ đã
          lưu trữ. Đã đăng ký = Activated + Onboarded; tỷ lệ đăng ký = số đã
          đăng ký / tổng Lead đang lọc. Quá hẹn = có lịch hẹn đã qua giờ, còn Đã
          lên lịch. Phụ trách gần nhất = người trên phiếu có ngày tạo mới nhất,
          bao gồm phiếu đã đóng. Mỗi hồ sơ được đếm một lần. Các định nghĩa này
          đang dùng để đối chiếu demo, cần xác nhận trước khi nghiệm thu.
        </p>
      </details>
    </>
  );
}
