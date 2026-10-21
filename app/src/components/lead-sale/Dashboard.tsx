import { Link } from "react-router";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { Badge, Empty, formatDate, PageHeading } from "./shared";
import { canEditLead, isPending, leadLabels, calculateReport } from "./domain";
import { serverNow } from "./dates";

export function Dashboard() {
  const { db, actor } = useWorkspace();
  const leads = db.leads.filter((l) => !l.archived);
  const summary = db.report ?? calculateReport(db, actor);
  const converted = summary.registered;
  const tickets = db.assignments.filter(
    (t) =>
      isPending(t) && (actor.role !== "telesale" || t.assigneeId === actor.id),
  );
  const appointments = db.appointments
    .filter(
      (a) =>
        a.status === "scheduled" &&
        (actor.role !== "telesale" || a.actorId === actor.id),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  const stats = [
    {
      label: "Tổng hồ sơ Lead",
      value: summary.total,
      detail: "Hồ sơ đang quản lý",
    },
    {
      label: "Tiếp nhận hôm nay",
      value: summary.newToday,
      detail: "Theo ngày tiếp nhận đầu tiên",
    },
    {
      label: "Lead quá hẹn",
      value: summary.overdue,
      detail: "Lịch đăng ký chưa hoàn tất",
    },
    {
      label: "Tỷ lệ đăng ký",
      value: `${summary.total ? Number(((converted / summary.total) * 100).toFixed(2)) : 0}%`,
      detail: `${converted} tài xế đã đăng ký hoặc chạy đơn`,
    },
  ];
  return (
    <>
      <PageHeading
        title="Tổng quan tuyển tài xế"
        description={`Chào ${actor.name.split(" ").at(-1)}, đây là tình hình tiếp nhận và tư vấn hiện tại.`}
        action={
          canEditLead(actor) && (
            <Button asChild>
              <Link to="/leads/create">
                <Plus />
                Tiếp nhận Lead
              </Link>
            </Button>
          )
        }
      />
      <div className="stats-strip">
        {stats.map((s) => (
          <div key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <small>{s.detail}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="data-section">
          <div className="section-header">
            <h2>Hành trình chuyển đổi</h2>
            <Link to="/reports">
              Xem báo cáo
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="funnel">
            <div className="funnel-row">
              <div>
                <span>Đã tiếp nhận</span>
                <strong>{summary.total}</strong>
              </div>
              <div className="funnel-track">
                <span style={{ width: "100%" }} />
              </div>
            </div>
            <div className="funnel-row">
              <div>
                <span>Đã hoàn tất đăng ký</span>
                <strong>{converted}</strong>
              </div>
              <div className="funnel-track">
                <span
                  style={{
                    width: `${summary.total ? (converted / summary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="funnel-row">
              <div>
                <span>Đã chạy đơn đầu tiên</span>
                <strong>{summary.onboarded}</strong>
              </div>
              <div className="funnel-track">
                <span
                  style={{
                    width: `${summary.total ? (leads.filter((l) => l.status === "Onboarded").length / summary.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <p className="muted">
              Các bước lũy kế. Tài xế đã chạy đơn được tính trong số đã đăng ký.
            </p>
          </div>
        </section>
        <section className="data-section">
          <div className="section-header">
            <h2>Lead theo nguồn</h2>
            <span>{db.sources.length} nguồn</span>
          </div>
          <div className="source-breakdown">
            {db.sources.map((s, i) => {
              const count =
                summary.bySource.find((x) => x.id === s.id)?.total ?? 0;
              return (
                <div key={s.id}>
                  <span className={`source-dot source-${i % 4}`} />
                  <span>{s.name}</span>
                  <strong>{count}</strong>
                  <small>
                    {summary.total
                      ? Math.round((count / summary.total) * 100)
                      : 0}
                    %
                  </small>
                </div>
              );
            })}
          </div>
        </section>
        <section className="data-section dashboard-wide">
          <div className="section-header">
            <h2>Lead mới tiếp nhận</h2>
            <Link to="/leads">
              Tất cả hồ sơ
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tài xế</th>
                  <th>Nguồn</th>
                  <th>Thành phố</th>
                  <th>Ngày tiếp nhận</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {leads
                  .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
                  .slice(0, 5)
                  .map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link
                          className="record-link"
                          to={`/leads/${l.id}/show`}
                        >
                          {l.name}
                        </Link>
                        <small>{l.phone}</small>
                      </td>
                      <td>
                        {db.sources.find((s) => s.id === l.sourceId)?.name}
                      </td>
                      <td>{l.city}</td>
                      <td>{formatDate(l.receivedAt)}</td>
                      <td>
                        <Badge status={l.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!summary.total && <Empty />}
        </section>
        <section className="data-section">
          <div className="section-header">
            <h2>Lịch hẹn cần theo dõi</h2>
            {actor.role !== "viewer" && (
              <Link to="/appointments">
                Xem lịch
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
          {appointments.length ? (
            <div className="appointment-list">
              {appointments.slice(0, 4).map((a) => (
                <Link
                  to={
                    actor.role === "viewer"
                      ? `/leads/${a.leadId}/show`
                      : `/assignments/${a.assignmentId}/show`
                  }
                  key={a.id}
                >
                  <span className="calendar-icon">
                    <CalendarDays size={19} />
                  </span>
                  <div>
                    <strong>
                      {db.leads.find((l) => l.id === a.leadId)?.name}
                    </strong>
                    <small>{formatDate(a.at, true)}</small>
                    <span>{a.place}</span>
                  </div>
                  {Date.parse(a.at) < serverNow().getTime() && (
                    <span className="warning-text">Quá hẹn</span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Chưa có lịch hẹn"
              description="Các lịch đăng ký sẽ xuất hiện tại đây."
            />
          )}
        </section>
      </div>
      <section className="data-section work-summary">
        <div>
          <h2>
            {actor.role === "telesale" ? "Công việc của bạn" : "Tiến độ tư vấn"}
          </h2>
          <p>
            {tickets.filter((t) => t.status === "New").length} phiếu chưa liên
            hệ · {tickets.filter((t) => t.status === "Open").length} phiếu đang
            tư vấn
          </p>
        </div>
        {actor.role !== "viewer" && (
          <Button asChild variant="outline">
            <Link to="/assignments">
              Mở nhiệm vụ
              <ArrowRight />
            </Link>
          </Button>
        )}
        <span className="summary-status">
          {Object.entries(leadLabels).map(([key, label]) => (
            <span key={key}>
              {label}: <strong>{summary.byStatus[key] ?? 0}</strong>
            </span>
          ))}
        </span>
      </section>
    </>
  );
}
