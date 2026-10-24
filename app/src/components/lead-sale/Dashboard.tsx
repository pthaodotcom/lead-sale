import { useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import {
  Bar,
  Empty,
  formatDate,
  Kpi,
  memberName,
  PageHeading,
  Panel,
} from "./shared";
import { canEditLead, isPending } from "./domain";
import { dayVN, needsRebooking } from "./workflow";
import {
  PeriodFilter,
  percent,
  periodFilters,
  useAnalytics,
} from "./ReviewShared";
import { inPeriod } from "./analytics";
import { serverNow } from "./dates";
import { cities } from "./catalog";
import { latestActivity } from "./tasks";
import { TicketTable } from "./TicketTable";
import { Reports } from "./Reports";
import { Settings } from "./Settings";
import type { ReportFilters } from "./types";

// Rate bars: value is a percentage, label shows numerator/denominator.
function Rates({ rows }: { rows: { label: string; n: number; d: number }[] }) {
  return (
    <div className="bars-list">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <div>
            <span>{r.label}</span>
            <strong>
              {percent(r.n, r.d)}
              <small>
                {r.n}/{r.d}
              </small>
            </strong>
          </div>
          <div className="bar">
            <span style={{ width: `${r.d ? (r.n / r.d) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { db, actor } = useWorkspace();
  const [filters, setFilters] = useState<ReportFilters>(periodFilters("today"));
  const { analytics, error, loading } = useAnalytics(filters);
  if (actor.role === "admin") return <Settings />;
  if (actor.role === "viewer") return <Reports />;
  const now = serverNow();
  const today = dayVN(now);
  const telesale = actor.role === "telesale";
  const intake = actor.role === "intake";
  const sameTeam = (teamId?: string) =>
    (teamId ?? "default") === (actor.teamId ?? "default");
  const allTickets = db.assignments.filter((t) =>
    telesale ? t.assigneeId === actor.id : sameTeam(t.teamId),
  );
  const pending = allTickets.filter((t) => isPending(t));
  const rebook = allTickets.filter(
    (t) => isPending(t) && needsRebooking(db, t, now),
  );
  const callBack = new Set([
    ...rebook.map((t) => t.id),
    ...allTickets
      .filter(
        (t) =>
          isPending(t) && latestActivity(db, t.id)?.outcome === "no_answer",
      )
      .map((t) => t.id),
  ]).size;
  const todayAppointments = db.appointments.filter(
    (a) =>
      (!telesale || a.actorId === actor.id) &&
      dayVN(a.at) === today &&
      a.status === "scheduled",
  ).length;
  const totals = analytics?.totals;
  const newToday = db.leads.filter(
    (l) => !l.archived && dayVN(l.receivedAt) === today,
  ).length;
  const recent = allTickets
    .filter(
      (t) =>
        inPeriod(t.updatedAt, filters) &&
        db.activities.some((a) => a.assignmentId === t.id),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);
  const value = (n?: number) => (error ? "—" : (n ?? 0));
  return (
    <>
      <PageHeading
        title={
          intake
            ? "Tổng quan tiếp nhận"
            : telesale
              ? "Tổng quan công việc của bạn"
              : "Tổng quan nhóm Telesale"
        }
        description={
          intake
            ? "Hồ sơ đầu vào, chờ bàn giao và cập nhật sau Closed."
            : telesale
              ? "Chỉ gồm phiếu và lịch hẹn của bạn."
              : "Công việc và chuyển đổi của nhóm."
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
      <PeriodFilter value={filters} onChange={setFilters} />
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Đang cập nhật số liệu…</p>}
      <div className="kpis">
        {intake ? (
          <>
            <Kpi
              label="Lead mới hôm nay"
              value={newToday}
              hint="Theo ngày tiếp nhận"
              to="/leads"
            />
            <Kpi
              label="Tổng số hồ sơ Lead"
              value={value(totals?.total)}
              hint="Trong kỳ đã chọn"
              to="/leads"
            />
            <Kpi
              label="Chờ bàn giao"
              value={value(totals?.unassigned)}
              hint="Lead Mới chưa phân công"
              to="/leads"
            />
            <Kpi
              label="Chờ cập nhật hồ sơ"
              value={value(totals?.reviewPending)}
              hint="Hồ sơ có phiếu Closed chưa rà soát"
              to="/handover"
            />
          </>
        ) : telesale ? (
          <>
            <Kpi
              label="Phiếu mới"
              value={pending.filter((t) => t.status === "New").length}
              hint="Chưa liên hệ"
              to="/tasks?group=new"
            />
            <Kpi
              label="Cần gọi lại"
              value={callBack}
              hint="Không nghe máy / cần hẹn lại"
              to="/tasks?group=no_answer"
            />
            <Kpi
              label="Lịch hẹn hôm nay"
              value={todayAppointments}
              hint="Đã lên lịch trong hôm nay"
              to="/appointments"
            />
            <Kpi
              label="Phiếu cần hẹn lại"
              value={rebook.length}
              tone={rebook.length ? "red" : ""}
              hint="Qua 00:00 sau ngày hẹn, chưa đăng ký"
              to="/tasks?group=overdue"
            />
          </>
        ) : (
          <>
            <Kpi
              label="Lead mới hôm nay"
              value={newToday}
              hint="Theo ngày tiếp nhận"
              to="/leads"
            />
            <Kpi
              label="Chưa phân công"
              value={value(totals?.unassigned)}
              hint="Lead Mới đủ điều kiện"
              to="/dispatch"
            />
            <Kpi
              label="Phiếu đang mở"
              value={pending.filter((t) => t.status === "Open").length}
              hint="Đang tư vấn (Open), hiện tại"
              to="/tasks?group=pending"
            />
            <Kpi
              label="Phiếu cần hẹn lại"
              value={rebook.length}
              tone={rebook.length ? "red" : ""}
              hint="Qua 00:00 sau ngày hẹn, chưa đăng ký"
              to="/tasks?group=overdue"
            />
          </>
        )}
      </div>
      {intake ? (
        <div className="grid-2">
          <Panel title="Lead theo nguồn tiếp nhận">
            {(analytics?.sources ?? []).map((s) => (
              <Bar
                key={s.id}
                label={db.sources.find((x) => x.id === s.id)?.name ?? s.id}
                value={s.total}
                total={totals?.total ?? 0}
              />
            ))}
          </Panel>
          <Panel title="Đang được tư vấn">
            <strong style={{ fontSize: 28 }}>
              {value(totals?.consulting)}
            </strong>
            <p className="muted">
              Phiếu Đang tư vấn (Open) còn hạn, tại thời điểm hiện tại.
            </p>
          </Panel>
        </div>
      ) : !telesale ? (
        <div className="grid-2">
          <Panel title="Hiệu suất chuyển đổi thành công theo chuyên viên">
            <Rates
              rows={(analytics?.performance ?? []).map((p) => ({
                label: memberName(db, p.id),
                n: p.converted,
                d: p.assignedLeads,
              }))}
            />
            <p className="muted">
              Số Lead đã chạy đơn đầu / Số Lead được giao.
            </p>
          </Panel>
          <Panel title="Phiếu phân công chưa đóng">
            {db.members
              .filter((m) => m.role === "telesale" && sameTeam(m.teamId))
              .map((m) => {
                const n = allTickets.filter(
                  (t) => t.assigneeId === m.id && t.status !== "Closed",
                ).length;
                return (
                  <Bar
                    key={m.id}
                    label={m.name}
                    value={n}
                    total={
                      allTickets.filter((t) => t.status !== "Closed").length
                    }
                  />
                );
              })}
            <p className="muted">
              Tồn hiện tại (Chưa liên hệ + Đang tư vấn + Đã giải quyết), không
              giới hạn ngày giao.
            </p>
          </Panel>
          <Panel title="Tỷ lệ chuyển đổi thành công theo nguồn">
            <Rates
              rows={(analytics?.sources ?? []).map((s) => ({
                label: db.sources.find((x) => x.id === s.id)?.name ?? s.id,
                n: s.Onboarded,
                d: s.total,
              }))}
            />
          </Panel>
          <Panel title="Tỷ lệ chuyển đổi thành công theo thành phố">
            <Rates
              rows={cities.map((city) => {
                const ls = db.leads.filter(
                  (l) =>
                    !l.archived &&
                    l.city === city &&
                    inPeriod(l.receivedAt, filters),
                );
                return {
                  label: city,
                  n: ls.filter((l) => l.onboardedAt || l.status === "Onboarded")
                    .length,
                  d: ls.length,
                };
              })}
            />
          </Panel>
        </div>
      ) : null}
      {!intake && (
        <Panel
          title="Phiếu cần xử lý"
          aside={<Link to="/tasks">Tất cả nhiệm vụ →</Link>}
          bodyless
        >
          <TicketTable tickets={pending.slice(0, 5)} />
        </Panel>
      )}
      {intake ? (
        <Panel title="Lịch sử cập nhật hồ sơ" bodyless>
          {db.audit.filter((a) => inPeriod(a.at, filters)).length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã hồ sơ</th>
                    <th>Tên / SĐT</th>
                    <th>Người cập nhật</th>
                    <th>Thời điểm</th>
                    <th>Nội dung thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {db.audit
                    .filter((a) => inPeriod(a.at, filters))
                    .slice(0, 20)
                    .map((a) => {
                      const l = db.leads.find((l) => l.id === a.target);
                      return (
                        <tr key={a.id}>
                          <td>
                            {l ? (
                              <Link
                                className="record-link"
                                to={`/leads/${l.id}/show`}
                              >
                                {l.id}
                              </Link>
                            ) : (
                              a.target
                            )}
                          </td>
                          <td>
                            {l?.name ?? "—"}
                            <small>{l?.phone}</small>
                          </td>
                          <td>{memberName(db, a.actorId)}</td>
                          <td>{formatDate(a.at, true)}</td>
                          <td>
                            {a.action}
                            <small>{a.detail}</small>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Chưa có cập nhật hồ sơ trong kỳ" />
          )}
        </Panel>
      ) : (
        <Panel
          title={telesale ? "Hoạt động gần đây" : "Hoạt động gần đây của nhóm"}
          bodyless
        >
          <TicketTable tickets={recent} />
        </Panel>
      )}
    </>
  );
}
