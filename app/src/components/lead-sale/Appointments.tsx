import { useState } from "react";
import { Link } from "react-router";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "./context";
import { canWork, isPending } from "./domain";
import { appointmentLabels, resultDeadline } from "./workflow";
import { offices } from "./catalog";
import {
  Chip,
  Empty,
  Field,
  formatDate,
  Guard,
  localDateTime,
  memberName,
  PageHeading,
  RowMenu,
  TablePagination,
} from "./shared";
import type { Appointment } from "./types";

export { appointmentLabels };

function Reschedule({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { run, busy } = useWorkspace();
  const [at, setAt] = useState(localDateTime());
  const [place, setPlace] = useState(
    offices.includes(appointment.place) ? appointment.place : "",
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hẹn lại</DialogTitle>
          <DialogDescription>
            Lịch cũ chuyển Đã hủy (nếu chưa chốt); lịch mới liên kết với lịch
            cũ.
          </DialogDescription>
        </DialogHeader>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await run(
                { type: "reschedule", id: appointment.id, at, place },
                "Đã đặt lịch hẹn mới.",
              )
            )
              onOpenChange(false);
          }}
        >
          <Field label="Ngày giờ mới *">
            <input
              required
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
          </Field>
          <Field label="Nơi hẹn *">
            <select
              required
              aria-label="Nơi hẹn mới"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            >
              <option value="">Chọn văn phòng</option>
              {offices.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              Lưu lịch mới
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Reconcile({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { run, busy } = useWorkspace();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đối soát kết quả đến muộn</DialogTitle>
          <DialogDescription>
            Chỉ đổi lịch Thất bại thành Thành công khi hồ sơ có mốc đăng ký
            trong ngày hẹn, trước mốc chốt. Không tự mở lại phiếu.
          </DialogDescription>
        </DialogHeader>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await run(
                { type: "reconcileAppointment", id: appointment.id, reason },
                "Đã đối soát kết quả lịch hẹn.",
              )
            )
              onOpenChange(false);
          }}
        >
          <Field label="Căn cứ đối soát *">
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              Xác nhận đối soát
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AppointmentActions({
  appointment: a,
}: {
  appointment: Appointment;
}) {
  const { db, actor, run } = useWorkspace();
  const [rescheduling, setRescheduling] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const t = db.assignments.find((t) => t.id === a.assignmentId);
  if (!t) return null;
  if (actor.role === "intake" && a.status === "failed")
    return (
      <div className="row-actions end-actions">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setReconciling(true)}
        >
          Đối soát
        </Button>
        <Reconcile
          appointment={a}
          open={reconciling}
          onOpenChange={setReconciling}
        />
      </div>
    );
  const writable = canWork(actor, t) && isPending(t);
  const replaced = db.appointments.some((n) => n.previousId === a.id);
  const items = [
    ...(["scheduled", "waiting", "failed"].includes(a.status) && !replaced
      ? [{ label: "Hẹn lại…", onSelect: () => setRescheduling(true) }]
      : []),
    ...(["scheduled", "waiting"].includes(a.status)
      ? [
          {
            label: "Hủy hẹn",
            danger: true,
            onSelect: () =>
              void run(
                { type: "appointment", id: a.id, status: "cancelled" },
                "Đã hủy lịch hẹn.",
              ),
          },
        ]
      : []),
  ];
  if (!writable || !items.length) return null;
  return (
    <div className="row-actions end-actions">
      <RowMenu label={`lịch hẹn ${formatDate(a.at, true)}`} items={items} />
      <Reschedule
        appointment={a}
        open={rescheduling}
        onOpenChange={setRescheduling}
      />
    </div>
  );
}

export const appointmentTone = (s: Appointment["status"]) =>
  s === "succeeded" || s === "attended"
    ? "solved"
    : s === "failed" || s === "missed"
      ? "missed"
      : s === "waiting"
        ? "open"
        : s;

const PAGE = 10;

export function Appointments() {
  const { db, actor } = useWorkspace();
  const [view, setView] = useState<"open" | "done">("open");
  const [member, setMember] = useState("");
  const [direction, setDirection] = useState(1);
  const [page, setPage] = useState(1);
  const personal = actor.role === "telesale";
  const scoped = db.appointments.filter((a) =>
    personal
      ? a.actorId === actor.id
      : actor.role !== "leader" ||
        db.assignments.some(
          (t) =>
            t.id === a.assignmentId &&
            (t.teamId ?? "default") === (actor.teamId ?? "default"),
        ),
  );
  const open = scoped.filter((a) => a.status === "scheduled");
  const done = scoped.filter((a) => a.status !== "scheduled");
  const rows = (view === "open" ? open : done)
    .filter((a) => !member || a.actorId === member)
    .sort((a, b) => a.at.localeCompare(b.at) * direction);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages);
  const paginatedRows = rows.slice((current - 1) * PAGE, current * PAGE);
  return (
    <Guard allowed={["telesale", "leader", "intake"].includes(actor.role)}>
      <PageHeading
        title="Lịch hẹn đăng ký"
        
      />
      <section className="panel">
        <div className="tabs">
          {(
            [
              ["open", "Cần xử lý", open.length],
              ["done", "Đã xử lý", done.length],
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => {
                setView(id);
                setPage(1);
              }}
            >
              {label}
              <span className="count">{n}</span>
            </button>
          ))}
        </div>
        {!personal && (
          <div className="toolbar">
            <select
              aria-label="Lọc chuyên viên lịch hẹn"
              value={member}
              onChange={(e) => {
                setMember(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả chuyên viên</option>
              {db.members
                .filter(
                  (m) =>
                    m.role === "telesale" &&
                    (actor.role !== "leader" ||
                      (m.teamId ?? "default") === (actor.teamId ?? "default")),
                )
                .map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        {rows.length ? (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th aria-sort={direction === 1 ? "ascending" : "descending"}>
                      <button
                        className="sort-heading"
                        onClick={() => {
                          setDirection(-direction);
                          setPage(1);
                        }}
                      >
                        Thời gian hẹn {direction === 1 ? "↑" : "↓"}
                      </button>
                    </th>
                    <th>Địa điểm hẹn</th>
                    <th>Tên + SĐT tài xế</th>
                    {!personal && <th>Chuyên viên</th>}
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((a) => {
                    const t = db.assignments.find((t) => t.id === a.assignmentId);
                    const l =
                      db.leads.find((l) => l.id === a.leadId) ?? t?.leadSnapshot;
                    return (
                      <tr key={a.id}>
                        <td>
                          {formatDate(a.at, true)}
                          {a.status === "waiting" && (
                            <small>
                              Chốt{" "}
                              {formatDate(
                                new Date(resultDeadline(a.at)).toISOString(),
                                true,
                              )}
                            </small>
                          )}
                        </td>
                        <td>{a.place}</td>
                        <td>
                          <Link
                            className="record-link"
                            to={
                              actor.role === "intake"
                                ? `/leads/${a.leadId}/show`
                                : `/tasks/${a.assignmentId}`
                            }
                          >
                            {l?.name ?? a.leadId}
                          </Link>
                          <small>{l?.phone}</small>
                        </td>
                        {!personal && <td>{memberName(db, a.actorId)}</td>}
                        <td>
                          <Chip tone={appointmentTone(a.status)}>
                            {appointmentLabels[a.status]}
                          </Chip>
                          {a.resultReason && <small>{a.resultReason}</small>}
                        </td>
                        <td className="end">
                          <AppointmentActions appointment={a} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              current={current}
              total={rows.length}
              pageSize={PAGE}
              onPageChange={setPage}
              unit="lịch hẹn"
            />
          </>
        ) : (
          <Empty
            icon={CalendarDays}
            title={
              view === "open"
                ? "Không có lịch hẹn cần xử lý"
                : "Chưa có lịch đã xử lý"
            }
            description="Lịch hẹn được tạo khi ghi nhận tài xế Đồng ý trong phiếu tư vấn."
          />
        )}
      </section>
    </Guard>
  );
}
