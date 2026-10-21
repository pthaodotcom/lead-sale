import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { calculateReport, latestAssignment, leadLabels } from "./domain";
import { loadReport } from "./backend";
import {
  Badge,
  downloadCsv,
  Empty,
  Field,
  formatDate,
  PageHeading,
} from "./shared";
import type { ReportData } from "./types";
const percent = (n: number, total: number) =>
  total ? Number(((n / total) * 100).toFixed(2)) : 0;
const resultSource = (source?: string) =>
  source === "simulator"
    ? "Giả lập"
    : ["manual", "manual_correction"].includes(source ?? "")
      ? "Xác nhận thủ công"
      : "Chưa rõ căn cứ (dữ liệu cũ)";
export function Reports() {
  const { db, actor, cloud } = useWorkspace();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [member, setMember] = useState("");
  const [report, setReport] = useState<ReportData | undefined>(db.report);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const filters = useMemo(
    () => ({ from, to, source, status, member }),
    [from, to, source, status, member],
  );
  const invalid = !!from && !!to && from > to;
  useEffect(() => {
    if (!cloud || invalid) return;
    let alive = true;
    setLoading(true);
    setError("");
    void loadReport(filters)
      .then((r) => {
        if (alive) setReport(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [cloud, filters, db, invalid]);
  const summary = invalid
    ? undefined
    : cloud
      ? report
      : calculateReport(db, actor, filters);
  const canDetail = ["admin", "intake", "leader"].includes(actor.role);
  const day = (s: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(s),
    );
  const rows = canDetail
    ? db.leads.filter((l) => {
        const owner = latestAssignment(db, l.id);
        return (
          !l.archived &&
          (!from || day(l.receivedAt) >= from) &&
          (!to || day(l.receivedAt) <= to) &&
          (!source || l.sourceId === source) &&
          (!status || l.status === status) &&
          (!member || (owner?.assigneeId ?? "unassigned") === member) &&
          (actor.role !== "leader" ||
            (owner?.teamId ?? "default") === (actor.teamId ?? "default"))
        );
      })
    : [];
  return (
    <>
      <PageHeading
        title="Báo cáo tuyển tài xế"
        description="Theo ngày tiếp nhận đầu; kết quả chuyển đổi cập nhật đến hiện tại."
        action={
          <Button
            variant="outline"
            disabled={loading || invalid || !!error || !summary?.total}
            onClick={() => {
              if (!summary) return;
              downloadCsv(
                "bao-cao-lead.csv",
                canDetail
                  ? [
                      [
                        "Mã hồ sơ",
                        "Tài xế",
                        "SĐT",
                        "Nguồn",
                        "Trạng thái",
                        "Phụ trách gần nhất",
                        "Ngày tiếp nhận",
                        "Ngày đăng ký thực tế",
                        "Nguồn xác nhận đăng ký",
                        "Ngày đơn đầu thực tế",
                        "Nguồn xác nhận đơn đầu",
                      ],
                      ...rows.map((l) => [
                        l.id,
                        l.name,
                        l.phone,
                        db.sources.find((s) => s.id === l.sourceId)?.name ?? "",
                        leadLabels[l.status],
                        db.members.find(
                          (m) =>
                            m.id === latestAssignment(db, l.id)?.assigneeId,
                        )?.name ?? "Chưa phân công",
                        formatDate(l.receivedAt),
                        formatDate(l.activatedAt, true),
                        l.activatedAt ? resultSource(l.activatedSource) : "",
                        formatDate(l.onboardedAt, true),
                        l.onboardedAt ? resultSource(l.onboardedSource) : "",
                      ]),
                    ]
                  : [
                      ["Chỉ số", "Số lượng"],
                      ["Tổng Lead", summary.total],
                      ["Đã đăng ký", summary.registered],
                      ["Đã chạy đơn đầu", summary.onboarded],
                      ["Lead quá hẹn", summary.overdue],
                    ],
              );
            }}
          >
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
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Nguồn">
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Tất cả nguồn</option>
              {db.sources.map((s) => (
                <option key={s.id} value={s.id}>
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
              <option value="unassigned">Chưa phân công</option>
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
      </section>
      {invalid && (
        <p className="form-error" role="alert">
          Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading && <p role="status">Đang cập nhật báo cáo…</p>}
      {summary && !error && (
        <>
          <div className="stats-strip report-stats" aria-busy={loading}>
            {[
              ["Lead trong bộ lọc", summary.total, "Mỗi hồ sơ tính một lần"],
              [
                "Đã đăng ký",
                summary.registered,
                `${percent(summary.registered, summary.total)}% tổng Lead`,
              ],
              [
                "Đã chạy đơn đầu",
                summary.onboarded,
                `${percent(summary.onboarded, summary.total)}% tổng Lead`,
              ],
              [
                "Lead quá hẹn",
                summary.overdue,
                `${percent(summary.overdue, summary.total)}% tổng Lead`,
              ],
            ].map(([label, count, hint]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
                <small>{hint}</small>
              </div>
            ))}
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
                      const item = summary.bySource.find((x) => x.id === s.id);
                      return (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{item?.total ?? 0}</td>
                          <td>{item?.registered ?? 0}</td>
                          <td>
                            {percent(item?.registered ?? 0, item?.total ?? 0)}%
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
                  ["Đã tiếp nhận", summary.total],
                  ["Đã đăng ký", summary.registered],
                  ["Đã chạy đơn", summary.onboarded],
                ].map(([label, count]) => (
                  <div className="funnel-row" key={label}>
                    <div>
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="funnel-track">
                      <span
                        style={{
                          width: `${percent(Number(count), summary.total)}%`,
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
              <h2>Theo nhân viên phụ trách gần nhất</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Tổng Lead</th>
                    <th>Đã đăng ký</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byMember.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {db.members.find((x) => x.id === m.id)?.name ??
                          "Chưa phân công"}
                      </td>
                      <td>{m.total}</td>
                      <td>{m.registered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {summary.byResultSource && (
            <section className="data-section">
              <div className="section-header">
                <h2>Theo nguồn xác nhận kết quả</h2>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nguồn xác nhận</th>
                      <th>Đã đăng ký</th>
                      <th>Đã chạy đơn đầu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byResultSource.map((s) => (
                      <tr key={s.id}>
                        <td>{resultSource(s.id)}</td>
                        <td>{s.registered}</td>
                        <td>{s.onboarded}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {canDetail && (
            <section className="data-section">
              <div className="section-header">
                <h2>Dữ liệu chi tiết đối chiếu</h2>
                <span>{rows.length} hồ sơ</span>
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
                      <th>Mốc kết quả / căn cứ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <Link
                            className="record-link"
                            to={`/leads/${l.id}/show`}
                          >
                            {l.name}
                          </Link>
                          <small>{l.id}</small>
                        </td>
                        <td>
                          <Badge status={l.status} />
                        </td>
                        <td>
                          {db.sources.find((s) => s.id === l.sourceId)?.name}
                        </td>
                        <td>
                          {db.members.find(
                            (m) =>
                              m.id === latestAssignment(db, l.id)?.assigneeId,
                          )?.name ?? "Chưa phân công"}
                        </td>
                        <td>{formatDate(l.receivedAt)}</td>
                        <td>
                          {l.activatedAt && (
                            <small>
                              Đăng ký: {formatDate(l.activatedAt, true)} ·{" "}
                              {resultSource(l.activatedSource)}
                            </small>
                          )}
                          {l.onboardedAt && (
                            <small>
                              Đơn đầu: {formatDate(l.onboardedAt, true)} ·{" "}
                              {resultSource(l.onboardedSource)}
                            </small>
                          )}
                          {!l.activatedAt &&
                            !l.onboardedAt &&
                            "Chưa có mốc xác nhận"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && <Empty />}
            </section>
          )}
          {!summary.total && <Empty />}
        </>
      )}
      <details className="metric-definitions">
        <summary>Cách tính số liệu</summary>
        <p>
          Lọc theo ngày tiếp nhận đầu tại Việt Nam, loại hồ sơ lưu trữ. Phễu lũy
          kế bao gồm Onboarded trong số đã đăng ký. Quá hẹn là lịch chưa xử lý
          đã qua giờ trên phiếu còn trong hạn. Mỗi Lead tính một lần; quy công
          cho phiếu được tạo gần nhất, gồm phiếu đã đóng. Quyền báo cáo không mở
          lại quyền xem hồ sơ cũ.
        </p>
      </details>
    </>
  );
}
