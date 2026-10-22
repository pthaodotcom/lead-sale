import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { calculateReport, latestAssignment, leadLabels } from "./domain";
import { loadReport } from "./backend";
import {
  Badge,
  Bar,
  downloadCsv,
  Empty,
  Field,
  formatDate,
  Kpi,
  memberName,
  PageHeading,
  Panel,
  sourceName,
  vnDay,
} from "./shared";
import type { ReportData } from "./types";

const percent = (n: number, total: number) =>
  total ? Number(((n / total) * 100).toFixed(2)) : 0;

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
      .then((r) => alive && setReport(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [cloud, filters, db, invalid]);
  const s = invalid
    ? undefined
    : cloud
      ? report
      : calculateReport(db, actor, filters);
  const canDetail = ["admin", "intake", "leader"].includes(actor.role);
  const rows = canDetail
    ? db.leads.filter((l) => {
        const owner = latestAssignment(db, l.id);
        return (
          !l.archived &&
          (!from || vnDay(l.receivedAt) >= from) &&
          (!to || vnDay(l.receivedAt) <= to) &&
          (!source || l.sourceId === source) &&
          (!status || l.status === status) &&
          (!member || (owner?.assigneeId ?? "unassigned") === member) &&
          (actor.role !== "leader" ||
            (owner?.teamId ?? "default") === (actor.teamId ?? "default"))
        );
      })
    : [];
  const filtered = !!(from || to || source || status || member);
  const exportCsv = () => {
    if (!s) return;
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
              "Ngày đăng ký",
              "Ngày chạy đơn đầu",
            ],
            ...rows.map((l) => [
              l.id,
              l.name,
              l.phone,
              sourceName(db, l.sourceId),
              leadLabels[l.status],
              latestAssignment(db, l.id)
                ? memberName(db, latestAssignment(db, l.id)?.assigneeId)
                : "Chưa phân công",
              formatDate(l.receivedAt),
              formatDate(l.activatedAt, true),
              formatDate(l.onboardedAt, true),
            ]),
          ]
        : [
            ["Chỉ số", "Số lượng"],
            ["Tổng Lead", s.total],
            ["Đã đăng ký", s.registered],
            ["Đã chạy đơn đầu", s.onboarded],
            ["Lead quá hẹn", s.overdue],
          ],
    );
  };
  return (
    <>
      <PageHeading
        title="Báo cáo"
        description="Lọc theo ngày tiếp nhận đầu; kết quả chuyển đổi tính đến hiện tại."
        action={
          <Button
            variant="outline"
            disabled={loading || invalid || !!error || !s?.total}
            onClick={exportCsv}
          >
            <Download /> Xuất CSV
          </Button>
        }
      />
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ borderBottom: 0 }}>
          <Field label="Từ ngày">
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
              <option value="">Mọi nguồn</option>
              {db.sources.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trạng thái Lead">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Mọi trạng thái</option>
              {Object.entries(leadLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          {actor.role !== "telesale" && (
            <Field label="Nhân viên phụ trách">
              <select
                value={member}
                onChange={(e) => setMember(e.target.value)}
              >
                <option value="">Mọi nhân viên</option>
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
          )}
          {filtered && (
            <Button
              variant="ghost"
              style={{ alignSelf: "flex-end" }}
              onClick={() => {
                setFrom("");
                setTo("");
                setSource("");
                setStatus("");
                setMember("");
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </section>
      {invalid && (
        <p className="form-error" role="alert">
          Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          Không tải được báo cáo: {error}
        </p>
      )}
      {s && !error && (
        <div aria-busy={loading}>
          <div className="kpis">
            <Kpi
              label="Lead trong bộ lọc"
              value={s.total}
              hint="Mỗi hồ sơ tính một lần"
            />
            <Kpi
              label="Đã đăng ký"
              value={s.registered}
              hint={`${percent(s.registered, s.total)}% tổng Lead`}
            />
            <Kpi
              label="Đã chạy đơn đầu"
              value={s.onboarded}
              hint={`${percent(s.onboarded, s.total)}% tổng Lead`}
            />
            <Kpi
              label="Lead quá hẹn"
              value={s.overdue}
              hint={`${percent(s.overdue, s.total)}% tổng Lead`}
              tone="red"
            />
          </div>
          {s.total ? (
            <>
              <div className="grid-2">
                <Panel title="Theo nguồn" bodyless>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nguồn</th>
                          <th className="end">Lead</th>
                          <th className="end">Đăng ký</th>
                          <th className="end">Tỷ lệ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {db.sources.map((src) => {
                          const r = s.bySource.find((x) => x.id === src.id);
                          return (
                            <tr key={src.id}>
                              <td>{src.name}</td>
                              <td className="end">{r?.total ?? 0}</td>
                              <td className="end">{r?.registered ?? 0}</td>
                              <td className="end">
                                {percent(r?.registered ?? 0, r?.total ?? 0)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <Panel
                  title="Phễu chuyển đổi"
                  aside={<span>Lũy kế</span>}
                  bodyless
                >
                  <div className="funnel">
                    <Bar label="Đã tiếp nhận" value={s.total} total={s.total} />
                    <Bar
                      label="Đã đăng ký"
                      value={s.registered}
                      total={s.total}
                    />
                    <Bar
                      label="Đã chạy đơn đầu"
                      value={s.onboarded}
                      total={s.total}
                    />
                  </div>
                </Panel>
              </div>
              <div className="grid-2">
                <Panel title="Theo nhân viên phụ trách gần nhất" bodyless>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nhân viên</th>
                          <th className="end">Lead</th>
                          <th className="end">Đăng ký</th>
                          <th className="end">Tỷ lệ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.byMember
                          .filter((m) => m.total)
                          .map((m) => (
                            <tr key={m.id}>
                              <td>
                                {m.id === "unassigned"
                                  ? "Chưa phân công"
                                  : memberName(db, m.id)}
                              </td>
                              <td className="end">{m.total}</td>
                              <td className="end">{m.registered}</td>
                              <td className="end">
                                {percent(m.registered, m.total)}%
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <Panel title="Theo trạng thái hồ sơ" bodyless>
                  <div className="funnel">
                    {Object.entries(leadLabels).map(([k, v]) => (
                      <Bar
                        key={k}
                        label={v}
                        value={s.byStatus[k] ?? 0}
                        total={s.total}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
              {canDetail && (
                <Panel
                  title="Chi tiết đối chiếu"
                  aside={<span>{rows.length} hồ sơ</span>}
                  className="panel-spaced"
                  bodyless
                >
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tài xế</th>
                          <th>Trạng thái</th>
                          <th>Nguồn</th>
                          <th>Phụ trách gần nhất</th>
                          <th>Tiếp nhận</th>
                          <th>Đăng ký / Đơn đầu</th>
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
                            <td>{sourceName(db, l.sourceId)}</td>
                            <td>
                              {latestAssignment(db, l.id)
                                ? memberName(
                                    db,
                                    latestAssignment(db, l.id)?.assigneeId,
                                  )
                                : "Chưa phân công"}
                            </td>
                            <td>{formatDate(l.receivedAt)}</td>
                            <td>
                              {l.activatedAt ? formatDate(l.activatedAt) : "—"}
                              <small>
                                {l.onboardedAt
                                  ? `Đơn đầu ${formatDate(l.onboardedAt)}`
                                  : ""}
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
            </>
          ) : (
            <div className="panel">
              <Empty
                title="Không có dữ liệu trong bộ lọc"
                description="Mở rộng khoảng ngày hoặc bỏ bớt điều kiện lọc."
              />
            </div>
          )}
        </div>
      )}
      <details className="panel" style={{ marginTop: 16, padding: 16 }}>
        <summary>Cách tính số liệu</summary>
        <p className="muted" style={{ margin: 0, maxWidth: "75ch" }}>
          Lọc theo ngày tiếp nhận đầu (giờ Việt Nam), loại hồ sơ lưu trữ. Mỗi
          Lead tính một lần. Phễu lũy kế: đã chạy đơn đầu được tính trong số đã
          đăng ký. Quá hẹn là lịch chưa xác nhận đã qua giờ trên phiếu còn hạn.
          Quy công cho người trên phiếu được tạo gần nhất, kể cả phiếu đã đóng.
        </p>
      </details>
    </>
  );
}
