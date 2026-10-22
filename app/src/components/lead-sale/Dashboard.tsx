import { Link } from "react-router";
import { ArrowRight, Inbox, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import {
  Avatar,
  Badge,
  Bar,
  Empty,
  formatDate,
  formatTime,
  Kpi,
  memberName,
  PageHeading,
  Panel,
  relativeDeadline,
  sourceName,
  vnDay,
} from "./shared";
import {
  calculateReport,
  canAssign,
  canEditLead,
  isLive,
  leadLabels,
  outcomeLabels,
} from "./domain";
import { serverNow } from "./dates";
import { expiresSoon, inGroup, latestActivity, visibleTickets } from "./tasks";

const pct = (n: number, d: number) =>
  d ? `${Number(((n / d) * 100).toFixed(1))}%` : "0%";

function Funnel() {
  const { db, actor } = useWorkspace();
  const s = db.report ?? calculateReport(db, actor);
  return (
    <Panel
      title="Phễu chuyển đổi"
      aside={
        <Link to="/reports">
          Báo cáo <ArrowRight size={14} />
        </Link>
      }
      bodyless
    >
      <div className="funnel">
        <Bar label="Đã tiếp nhận" value={s.total} total={s.total} />
        <Bar
          label="Hoàn tất đăng ký (Activated)"
          value={s.registered}
          total={s.total}
        />
        <Bar
          label="Đã chạy đơn đầu (Onboarded)"
          value={s.onboarded}
          total={s.total}
        />
      </div>
    </Panel>
  );
}

function BySource() {
  const { db, actor } = useWorkspace();
  const s = db.report ?? calculateReport(db, actor);
  return (
    <Panel title="Lead theo nguồn" bodyless>
      <div className="funnel">
        {db.sources.map((src) => {
          const row = s.bySource.find((x) => x.id === src.id);
          return (
            <Bar
              key={src.id}
              label={`${src.name} · ${row?.registered ?? 0} đăng ký`}
              value={row?.total ?? 0}
              total={s.total}
            />
          );
        })}
      </div>
    </Panel>
  );
}

function MyWork() {
  const { db, actor } = useWorkspace();
  const tickets = visibleTickets(db, actor)
    .filter(
      (t) =>
        inGroup(db, t, "pending") &&
        (actor.role !== "telesale" || t.assigneeId === actor.id),
    )
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  return (
    <Panel
      title="Phiếu cần xử lý"
      aside={
        <Link to="/tasks">
          Tất cả nhiệm vụ <ArrowRight size={14} />
        </Link>
      }
      bodyless
    >
      {tickets.length ? (
        <div className="mini-list">
          {tickets.slice(0, 7).map((t) => {
            const l = db.leads.find((l) => l.id === t.leadId);
            const last = latestActivity(db, t.id);
            return (
              <Link className="mini-item" to={`/tasks/${t.id}`} key={t.id}>
                <Avatar name={l?.name} size="sm" />
                <div>
                  <strong>{l?.name}</strong>
                  <small>
                    {last ? outcomeLabels[last.outcome] : "Chưa liên hệ"} ·{" "}
                    {l?.phone}
                  </small>
                </div>
                <span
                  className={expiresSoon(t) ? "warning-text" : "muted"}
                  style={{ fontSize: 12.5 }}
                >
                  {relativeDeadline(t.expiresAt)}
                </span>
                <Badge status={t.status} ticket />
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Không còn phiếu cần xử lý"
          description="Phiếu mới được giao sẽ xuất hiện ở đây."
        />
      )}
    </Panel>
  );
}

function UpcomingAppointments() {
  const { db, actor } = useWorkspace();
  const now = serverNow().getTime();
  const items = db.appointments
    .filter(
      (a) =>
        a.status === "scheduled" &&
        (actor.role !== "telesale" || a.actorId === actor.id),
    )
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 5);
  return (
    <Panel
      title="Lịch hẹn"
      aside={
        <Link to="/appointments">
          Xem lịch <ArrowRight size={14} />
        </Link>
      }
      bodyless
    >
      {items.length ? (
        <div className="mini-list">
          {items.map((a) => {
            const late = Date.parse(a.at) < now;
            return (
              <Link
                className="mini-item"
                to={`/tasks/${a.assignmentId}`}
                key={a.id}
              >
                <span className={`when ${late ? "late" : ""}`}>
                  <b>{formatTime(a.at)}</b>
                  <span>{formatDate(a.at).slice(0, 5)}</span>
                </span>
                <div>
                  <strong>
                    {db.leads.find((l) => l.id === a.leadId)?.name}
                  </strong>
                  <small>
                    {late ? "Quá giờ — cần xác nhận · " : ""}
                    {a.place}
                  </small>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Chưa có lịch hẹn"
          description="Lịch được tạo khi tài xế đồng ý hẹn đăng ký."
        />
      )}
    </Panel>
  );
}

function TeamLoad() {
  const { db, actor } = useWorkspace();
  const tickets = visibleTickets(db, actor);
  const team = db.members.filter(
    (m) =>
      m.role === "telesale" &&
      m.active &&
      (actor.role === "admin" || m.teamId === actor.teamId),
  );
  const load = (id: string) =>
    tickets.filter((t) => t.assigneeId === id && inGroup(db, t, "pending"))
      .length;
  const max = Math.max(1, ...team.map((m) => load(m.id)));
  return (
    <Panel
      title="Tải nhóm"
      aside={
        <Link to="/dispatch">
          Điều phối <ArrowRight size={14} />
        </Link>
      }
      bodyless
    >
      <div className="workload">
        {team.map((m) => (
          <div className="workload-row" key={m.id}>
            <Avatar name={m.name} size="sm" />
            <div>
              <strong>{m.name}</strong>
              <div className="bar thin">
                <span style={{ width: `${(load(m.id) / max) * 100}%` }} />
              </div>
            </div>
            <span className="num">{load(m.id)} phiếu</span>
          </div>
        ))}
        {!team.length && <p className="muted">Chưa có chuyên viên.</p>}
      </div>
    </Panel>
  );
}

function RecentLeads() {
  const { db } = useWorkspace();
  const leads = db.leads
    .filter((l) => !l.archived)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, 6);
  return (
    <Panel
      title="Tiếp nhận gần đây"
      aside={
        <Link to="/leads">
          Tất cả hồ sơ <ArrowRight size={14} />
        </Link>
      }
      bodyless
    >
      <div className="mini-list">
        {leads.map((l) => (
          <Link className="mini-item" to={`/leads/${l.id}/show`} key={l.id}>
            <Avatar name={l.name} size="sm" />
            <div>
              <strong>{l.name}</strong>
              <small>
                {sourceName(db, l.sourceId)} · {l.city} ·{" "}
                {formatDate(l.receivedAt)}
              </small>
            </div>
            <Badge status={l.status} />
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function PendingHandover() {
  const { db } = useWorkspace();
  const rows = db.reviews.filter((r) => !r.reviewedAt);
  return (
    <Panel
      title="Bàn giao chờ rà soát"
      aside={
        <Link to="/handover">
          Mở <ArrowRight size={14} />
        </Link>
      }
      bodyless
    >
      {rows.length ? (
        <div className="mini-list">
          {rows.slice(0, 5).map((r) => (
            <Link className="mini-item" to="/handover" key={r.id}>
              <Inbox size={16} className="muted" />
              <div>
                <strong>{db.leads.find((l) => l.id === r.leadId)?.name}</strong>
                <small>
                  {r.reason} · {formatDate(r.at)}
                </small>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ padding: 16, margin: 0 }}>
          Không có phiếu Closed chờ rà soát.
        </p>
      )}
    </Panel>
  );
}

export function Dashboard() {
  const { db, actor } = useWorkspace();
  const s = db.report ?? calculateReport(db, actor);
  const now = serverNow().getTime();
  const firstName = actor.name.split(" ").at(-1);
  const waiting = db.leads.filter(
    (l) =>
      l.status === "New" &&
      !l.archived &&
      !db.assignments.some(
        (t) => t.leadId === l.id && isLive(t) && Date.parse(t.expiresAt) > now,
      ),
  ).length;
  const tickets = visibleTickets(db, actor).filter(
    (t) => actor.role !== "telesale" || t.assigneeId === actor.id,
  );
  const pending = tickets.filter((t) => inGroup(db, t, "pending"));
  const today = vnDay(serverNow());
  const telesale = actor.role === "telesale";
  return (
    <>
      <PageHeading
        title={`Chào ${firstName}`}
        description={
          telesale
            ? `Hôm nay bạn có ${pending.length} phiếu cần xử lý.`
            : actor.role === "viewer"
              ? "Số liệu tuyển tài xế cập nhật đến hiện tại."
              : `Tình hình tiếp nhận và tư vấn đến ${formatDate(new Date().toISOString())}.`
        }
        action={
          <>
            {canEditLead(actor) && (
              <Button asChild>
                <Link to="/leads/create">
                  <Plus /> Tiếp nhận Lead
                </Link>
              </Button>
            )}
            {canAssign(actor) && (
              <Button
                asChild
                variant={canEditLead(actor) ? "outline" : "default"}
              >
                <Link to="/dispatch">
                  <Send /> Phân công ({waiting})
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="kpis">
        {telesale ? (
          <>
            <Kpi
              label="Phiếu chưa giải quyết"
              value={pending.length}
              hint={`${pending.filter((t) => t.status === "New").length} chưa liên hệ`}
              to="/tasks"
            />
            <Kpi
              label="Lịch hẹn hôm nay"
              value={
                db.appointments.filter(
                  (a) =>
                    a.status === "scheduled" &&
                    a.actorId === actor.id &&
                    vnDay(a.at) === today,
                ).length
              }
              hint="Tài xế đến đăng ký"
              to="/appointments"
            />
            <Kpi
              label="Lead được giao"
              value={s.total}
              hint={`${s.registered} đã đăng ký`}
            />
            <Kpi
              label="Tỷ lệ đăng ký"
              value={pct(s.registered, s.total)}
              hint="Trên Lead bạn phụ trách"
            />
          </>
        ) : (
          <>
            <Kpi
              label="Tổng Lead"
              value={s.total}
              hint={`${s.byStatus.New ?? 0} đang ở trạng thái Mới`}
              to={actor.role === "viewer" ? undefined : "/leads"}
            />
            <Kpi
              label="Lead mới hôm nay"
              value={s.newToday}
              hint="Theo ngày tiếp nhận đầu"
            />
            <Kpi
              label="Lead quá hẹn"
              value={s.overdue}
              hint={`${pct(s.overdue, s.total)} tổng Lead`}
              tone="red"
              to={actor.role === "viewer" ? undefined : "/appointments"}
            />
            <Kpi
              label="Tỷ lệ đăng ký"
              value={pct(s.registered, s.total)}
              hint={`${s.registered} đăng ký · ${s.onboarded} chạy đơn`}
            />
          </>
        )}
      </div>
      {telesale && (
        <div className="grid-2">
          <MyWork />
          <div className="col">
            <UpcomingAppointments />
            <Funnel />
          </div>
        </div>
      )}
      {actor.role === "leader" && (
        <div className="grid-2">
          <MyWork />
          <div className="col">
            <TeamLoad />
            <Funnel />
          </div>
        </div>
      )}
      {actor.role === "intake" && (
        <div className="grid-2">
          <RecentLeads />
          <div className="col">
            <PendingHandover />
            <Funnel />
          </div>
        </div>
      )}
      {actor.role === "admin" && (
        <>
          <div className="grid-2">
            <Funnel />
            <TeamLoad />
          </div>
          <div className="grid-2">
            <RecentLeads />
            <div className="col">
              <PendingHandover />
              <UpcomingAppointments />
            </div>
          </div>
        </>
      )}
      {actor.role === "viewer" && (
        <div className="grid-2">
          <Funnel />
          <div className="col">
            <BySource />
            <Panel title="Lead theo trạng thái" bodyless>
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
        </div>
      )}
      {(actor.role === "leader" || actor.role === "intake") && (
        <div className="grid-2">
          <BySource />
          {actor.role === "leader" ? (
            <UpcomingAppointments />
          ) : (
            <TeamLoadHint />
          )}
        </div>
      )}
    </>
  );
}

function TeamLoadHint() {
  const { db } = useWorkspace();
  const active = db.assignments.filter((t) => t.status !== "Closed");
  const byMember = [...new Set(active.map((t) => t.assigneeId))];
  return (
    <Panel title="Đang được tư vấn" bodyless>
      <div className="mini-list">
        {byMember.slice(0, 6).map((id) => (
          <div className="mini-item" key={id}>
            <Avatar name={memberName(db, id)} size="sm" />
            <div>
              <strong>{memberName(db, id)}</strong>
              <small>
                {active.filter((t) => t.assigneeId === id).length} phiếu đang mở
              </small>
            </div>
          </div>
        ))}
        {!byMember.length && (
          <p className="muted" style={{ padding: 16, margin: 0 }}>
            Chưa có phiếu đang mở.
          </p>
        )}
      </div>
    </Panel>
  );
}
