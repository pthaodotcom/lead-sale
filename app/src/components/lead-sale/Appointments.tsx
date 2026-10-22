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
import { serverNow } from "./dates";
import { AppointmentCorrection } from "./Corrections";
import {
  Chip,
  Empty,
  Field,
  formatDate,
  formatTime,
  Guard,
  localDateTime,
  memberName,
  PageHeading,
  RowMenu,
  vnDay,
} from "./shared";
import type { Appointment } from "./types";

export const appointmentLabels = {
  scheduled: "Đã lên lịch",
  attended: "Đã đến",
  missed: "Không đến",
  cancelled: "Đã hủy",
};

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
  const [at, setAt] = useState(localDateTime(new Date(appointment.at)));
  const [place, setPlace] = useState(appointment.place);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hẹn lại</DialogTitle>
          <DialogDescription>
            Lịch cũ được hủy với lý do hẹn lại; lịch mới liên kết với lịch cũ.
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
          <Field label="Ngày giờ mới">
            <input
              required
              type="datetime-local"
              step="any"
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
          </Field>
          <Field label="Nơi hẹn">
            <input
              required
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            />
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

export function AppointmentActions({
  appointment: a,
}: {
  appointment: Appointment;
}) {
  const { db, actor, run, busy } = useWorkspace();
  const [rescheduling, setRescheduling] = useState(false);
  const t = db.assignments.find((t) => t.id === a.assignmentId);
  if (!t) return null;
  const due = Date.parse(a.at) <= serverNow().getTime();
  if (a.status === "scheduled" && canWork(actor, t) && isPending(t))
    return (
      <div className="row-actions end-actions">
        {due && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(
                  { type: "appointment", id: a.id, status: "attended" },
                  "Đã ghi nhận tài xế đến hẹn.",
                )
              }
            >
              Đã đến
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(
                  { type: "appointment", id: a.id, status: "missed" },
                  "Đã ghi nhận không đến hẹn.",
                )
              }
            >
              Không đến
            </Button>
          </>
        )}
        <RowMenu
          label={`lịch hẹn ${formatDate(a.at, true)}`}
          items={[
            { label: "Hẹn lại…", onSelect: () => setRescheduling(true) },
            {
              label: "Hủy hẹn",
              danger: true,
              onSelect: () =>
                void run(
                  { type: "appointment", id: a.id, status: "cancelled" },
                  "Đã hủy lịch hẹn.",
                ),
            },
          ]}
        />
        <Reschedule
          appointment={a}
          open={rescheduling}
          onOpenChange={setRescheduling}
        />
      </div>
    );
  if (
    ["attended", "missed"].includes(a.status) &&
    (actor.role === "admin" || canWork(actor, t))
  )
    return <AppointmentCorrection appointment={a} />;
  return null;
}

const views = [
  { id: "open", label: "Cần xử lý" },
  { id: "done", label: "Đã xử lý" },
] as const;

export function Appointments() {
  const { db, actor } = useWorkspace();
  const [view, setView] = useState<"open" | "done">("open");
  const now = serverNow();
  const today = vnDay(now);
  const mine = db.appointments.filter(
    (a) => actor.role !== "telesale" || a.actorId === actor.id,
  );
  const open = mine.filter((a) => a.status === "scheduled");
  const done = mine
    .filter((a) => a.status !== "scheduled")
    .sort((a, b) => b.at.localeCompare(a.at));
  const sections =
    view === "open"
      ? [
          {
            title: "Quá giờ — chờ xác nhận",
            items: open.filter((a) => Date.parse(a.at) < now.getTime()),
          },
          {
            title: "Hôm nay",
            items: open.filter(
              (a) => Date.parse(a.at) >= now.getTime() && vnDay(a.at) === today,
            ),
          },
          {
            title: "Sắp tới",
            items: open.filter((a) => vnDay(a.at) > today),
          },
        ].map((s) => ({
          ...s,
          items: s.items.sort((a, b) => a.at.localeCompare(b.at)),
        }))
      : [{ title: "Đã xử lý", items: done }];
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  return (
    <Guard allowed={actor.role !== "viewer"}>
      <PageHeading
        title="Lịch hẹn đăng ký"
        description="Tài xế đã đồng ý hẹn đến đăng ký. Xác nhận kết quả khi tới giờ hẹn."
      />
      <section className="panel">
        <div className="tabs">
          {views.map((v) => (
            <button
              key={v.id}
              className={view === v.id ? "active" : ""}
              onClick={() => setView(v.id)}
            >
              {v.label}
              <span className="count">
                {v.id === "open" ? open.length : done.length}
              </span>
            </button>
          ))}
        </div>
        {total ? (
          sections
            .filter((s) => s.items.length)
            .map((s) => (
              <div key={s.title}>
                <div className="day-group-title">
                  {s.title} <span className="count">{s.items.length}</span>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <tbody>
                      {s.items.map((a) => {
                        const l = db.leads.find((l) => l.id === a.leadId);
                        const late =
                          a.status === "scheduled" &&
                          Date.parse(a.at) < now.getTime();
                        return (
                          <tr key={a.id}>
                            <td style={{ width: 70 }}>
                              <div className={`when ${late ? "late" : ""}`}>
                                <b>{formatTime(a.at)}</b>
                                <span>{formatDate(a.at).slice(0, 5)}</span>
                              </div>
                            </td>
                            <td>
                              <Link
                                className="record-link"
                                to={`/tasks/${a.assignmentId}`}
                              >
                                {l?.name ?? a.leadId}
                              </Link>
                              <small>
                                {l?.phone} · {a.place}
                              </small>
                            </td>
                            <td>
                              {memberName(db, a.actorId)}
                              <small>Phiếu {a.assignmentId}</small>
                            </td>
                            <td>
                              <Chip tone={late ? "late" : a.status}>
                                {late ? "Quá giờ" : appointmentLabels[a.status]}
                              </Chip>
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
              </div>
            ))
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
