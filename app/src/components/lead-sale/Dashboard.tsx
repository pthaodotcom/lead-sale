import { useState } from "react";
import { Link } from "react-router";
import { CalendarDays, Inbox, Phone, PhoneCall, Plus } from "lucide-react";
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
import { canEditLead, isPending, outcomeLabels } from "./domain";
import { dayVN, needsRebooking, ticketCode } from "./workflow";
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
import { Settings } from "./Settings";
import { CallDialog } from "./CallDialog";
import { CallLogModal } from "./CallLogModal";
import { AppointmentCreateDialog } from "./AppointmentCreateDialog";
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


function RecentActivityTable({
  activities,
}: {
  activities: {
    id: string;
    ticketId: string;
    subject: string;
    requesterName: string;
    requesterPhone: string;
    specialistName: string;
    channel: "call" | "zalo";
    updatedAt: string;
  }[];
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Chủ đề</th>
            <th>Người yêu cầu</th>
            <th>Chuyên viên</th>
            <th>Kênh</th>
            <th>Thời điểm cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => (
            <tr key={a.id}>
              <td>
                <Link className="record-link nowrap" to={`/tasks/${a.ticketId}`}>
                  {a.subject}
                </Link>
              </td>
              <td>
                {a.requesterName}
                <small>{a.requesterPhone}</small>
              </td>
              <td>{a.specialistName}</td>
              <td>{a.channel === "call" ? "Gọi điện" : "Zalo"}</td>
              <td>{formatDate(a.updatedAt, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!activities.length && <Empty title="Chưa có hoạt động gần đây trong kỳ" />}
    </div>
  );
}

export function Dashboard() {
  const { db, actor } = useWorkspace();
  const [filters, setFilters] = useState<ReportFilters>(periodFilters("today"));
  const { analytics, error, loading } = useAnalytics(filters);

  // Telesale interactive controls
  const [telesaleFilter, setTelesaleFilter] = useState<
    "all" | "new" | "callback" | "today" | "rebook"
  >("all");
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callLogOpen, setCallLogOpen] = useState(false);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | undefined>();

  if (actor.role === "admin") return <Settings />;
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

  const displayedPending = pending.filter((t) => {
    if (telesaleFilter === "new") return t.status === "New";
    if (telesaleFilter === "callback")
      return (
        latestActivity(db, t.id)?.outcome === "no_answer" ||
        needsRebooking(db, t, now)
      );
    if (telesaleFilter === "today")
      return db.appointments.some(
        (a) =>
          a.assignmentId === t.id &&
          dayVN(a.at) === today &&
          a.status === "scheduled",
      );
    if (telesaleFilter === "rebook") return needsRebooking(db, t, now);
    return true;
  });
  const totals = analytics?.totals;
  const newToday = db.leads.filter(
    (l) => !l.archived && dayVN(l.receivedAt) === today,
  ).length;
  const recentActivities = db.activities
    .filter((a) => {
      const t = db.assignments.find((t) => t.id === a.assignmentId);
      if (!t) return false;
      if (telesale && t.assigneeId !== actor.id) return false;
      if (!telesale && !sameTeam(t.teamId)) return false;
      return inPeriod(a.at, filters);
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10)
    .map((a) => {
      const t = db.assignments.find((t) => t.id === a.assignmentId)!;
      const l = db.leads.find((l) => l.id === a.leadId) ?? t.leadSnapshot;
      return {
        id: a.id,
        ticketId: t.id,
        subject: `${ticketCode(t)} · ${outcomeLabels[a.outcome]}`,
        requesterName: l?.name ?? "—",
        requesterPhone: l?.phone ?? "—",
        specialistName: memberName(db, a.actorId),
        channel: a.channel,
        updatedAt: a.at,
      };
    });

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

      {telesale && (
        <div
          className="panel quick-actions-bar"
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
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginRight: 4,
            }}
          >
            Thao tác nhanh:
          </span>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => {
              setActiveTicketId(undefined);
              setCallDialogOpen(true);
            }}
          >
            <Phone size={14} /> Gọi khách hàng
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setActiveTicketId(undefined);
              setCallLogOpen(true);
            }}
          >
            <PhoneCall size={14} /> Ghi nhận cuộc gọi & Bằng chứng
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTicketId(undefined);
              setApptDialogOpen(true);
            }}
          >
            <CalendarDays size={14} /> Tạo lịch hẹn
          </Button>
          <Button
            type="button"
            variant={telesaleFilter === "new" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setTelesaleFilter(telesaleFilter === "new" ? "all" : "new")
            }
          >
            <Inbox size={14} /> Xem phiếu mới ({pending.filter((t) => t.status === "New").length})
          </Button>
          {telesaleFilter !== "all" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTelesaleFilter("all")}
              style={{ fontSize: 12 }}
            >
              Đặt lại bộ lọc (Hiện tất cả {pending.length} phiếu)
            </Button>
          )}
        </div>
      )}

      <div className={`kpis ${!intake ? "kpis-2col" : ""}`}>
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
        ) : (
          <>
            <Kpi
              label="Phiếu mới"
              value={pending.filter((t) => t.status === "New").length}
              hint={telesale ? "Chưa liên hệ · Bấm để lọc" : "Toàn nhóm chưa liên hệ · Bấm để lọc"}
              active={telesaleFilter === "new"}
              onClick={() =>
                setTelesaleFilter(telesaleFilter === "new" ? "all" : "new")
              }
            />
            <Kpi
              label="Cần gọi lại"
              value={callBack}
              hint="Không nghe máy / cần hẹn lại · Bấm để lọc"
              active={telesaleFilter === "callback"}
              onClick={() =>
                setTelesaleFilter(
                  telesaleFilter === "callback" ? "all" : "callback",
                )
              }
            />
            <Kpi
              label="Lịch hẹn hôm nay"
              value={todayAppointments}
              hint="Đã lên lịch trong hôm nay · Bấm để lọc"
              active={telesaleFilter === "today"}
              onClick={() =>
                setTelesaleFilter(telesaleFilter === "today" ? "all" : "today")
              }
            />
            <Kpi
              label="Cần hẹn lại"
              value={rebook.length}
              tone={rebook.length ? "red" : ""}
              hint="Qua 00:00 sau ngày hẹn, chưa đăng ký · Bấm để lọc"
              active={telesaleFilter === "rebook"}
              onClick={() =>
                setTelesaleFilter(telesaleFilter === "rebook" ? "all" : "rebook")
              }
            />
          </>
        )}
      </div>
      {intake ? (
        <div className="grid-2">
          <Panel title="Lead theo nguồn tiếp nhận">
            {(analytics?.sources ?? [])
              .filter((s) => ["web", "facebook", "hotline", "referral"].includes(s.id))
              .map((s) => (
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
            
          </Panel>
          <Panel title="Số phiếu đã phân công còn tồn">
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
            
          </Panel>
          <Panel title="Tỷ lệ chuyển đổi thành công theo nguồn">
            <Rates
              rows={(analytics?.sources ?? [])
                .filter((s) => ["web", "facebook", "hotline", "referral"].includes(s.id))
                .map((s) => ({
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
          title={`Phiếu cần xử lý (${displayedPending.length}${telesaleFilter !== "all" ? ` / ${pending.length} tổng` : ""})`}
          aside={<Link to="/tasks">Tất cả nhiệm vụ →</Link>}
          bodyless
        >
          <div
            className="tabs"
            style={{
              padding: "8px 16px 0",
              borderBottom: "1px solid var(--border, #eee)",
            }}
          >
            <button
              type="button"
              className={telesaleFilter === "all" ? "active" : ""}
              onClick={() => setTelesaleFilter("all")}
            >
              Tất cả ({pending.length})
            </button>
            <button
              type="button"
              className={telesaleFilter === "new" ? "active" : ""}
              onClick={() => setTelesaleFilter("new")}
            >
              Phiếu mới ({pending.filter((t) => t.status === "New").length})
            </button>
            <button
              type="button"
              className={telesaleFilter === "callback" ? "active" : ""}
              onClick={() => setTelesaleFilter("callback")}
            >
              Cần gọi lại ({callBack})
            </button>
            <button
              type="button"
              className={telesaleFilter === "today" ? "active" : ""}
              onClick={() => setTelesaleFilter("today")}
            >
              Lịch hẹn hôm nay ({todayAppointments})
            </button>
            <button
              type="button"
              className={telesaleFilter === "rebook" ? "active" : ""}
              onClick={() => setTelesaleFilter("rebook")}
            >
              Cần hẹn lại ({rebook.length})
            </button>
          </div>
          <TicketTable
            tickets={displayedPending}
            showActions={true}
            onOpenCall={(t) => {
              setActiveTicketId(t.id);
              setCallDialogOpen(true);
            }}
            onOpenCallLog={(t) => {
              setActiveTicketId(t.id);
              setCallLogOpen(true);
            }}
          />
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
          <RecentActivityTable activities={recentActivities} />
        </Panel>
      )}

      {/* Modals for Quick Actions */}
      {callDialogOpen && (
        <CallDialog
          open={callDialogOpen}
          onOpenChange={setCallDialogOpen}
          ticketId={activeTicketId}
          onStartLog={(id) => {
            setActiveTicketId(id);
            setCallLogOpen(true);
          }}
        />
      )}
      {callLogOpen && (
        <CallLogModal
          open={callLogOpen}
          onOpenChange={setCallLogOpen}
          ticketId={activeTicketId}
          onSuccess={() => setActiveTicketId(undefined)}
        />
      )}
      {apptDialogOpen && (
        <AppointmentCreateDialog
          open={apptDialogOpen}
          onOpenChange={setApptDialogOpen}
          ticketId={activeTicketId}
          onSuccess={() => setActiveTicketId(undefined)}
        />
      )}
    </>
  );
}
