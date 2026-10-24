import { useState } from "react";
import { Link } from "react-router";
import {
  ExternalLink,
  Phone,
  PhoneCall,
  UserCheck,
} from "lucide-react";
import type { Assignment } from "./types";
import { useWorkspace } from "./context";
import { Badge, Chip, Empty, formatDate } from "./shared";
import { isPending, outcomeLabels } from "./domain";
import { dayVN, needsRebooking, ticketCode } from "./workflow";
import { serverNow } from "./dates";
import { Button } from "@/components/ui/button";
import { CallDialog } from "./CallDialog";
import { CallLogModal } from "./CallLogModal";

export function TicketTable({
  tickets,
  showActions = true,
  onOpenCall: customOpenCall,
  onOpenCallLog: customOpenCallLog,
}: {
  tickets: Assignment[];
  showActions?: boolean;
  onOpenCall?: (ticket: Assignment) => void;
  onOpenCallLog?: (ticket: Assignment) => void;
}) {
  const { db, actor, run, busy } = useWorkspace();
  const [sort, setSort] = useState({ key: "updatedAt", direction: -1 });

  // Self-contained modal states if no external handler provided
  const [modalCallTicket, setModalCallTicket] = useState<Assignment | null>(null);
  const [modalLogTicket, setModalLogTicket] = useState<Assignment | null>(null);

  const now = serverNow();
  const today = dayVN(now);

  const heading = (key: string, label: string) => (
    <th
      aria-sort={
        sort.key === key
          ? sort.direction === 1
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        className="sort-heading"
        onClick={() =>
          setSort({ key, direction: sort.key === key ? -sort.direction : 1 })
        }
      >
        {label} {sort.key === key ? (sort.direction === 1 ? "↑" : "↓") : "↕"}
      </button>
    </th>
  );

  const rows = [...tickets].sort(
    (a, b) =>
      String(a[sort.key as keyof Assignment] ?? "").localeCompare(
        String(b[sort.key as keyof Assignment] ?? ""),
      ) * sort.direction,
  );

  const handleCall = (t: Assignment) => {
    if (customOpenCall) {
      customOpenCall(t);
    } else {
      setModalCallTicket(t);
    }
  };

  const handleLog = (t: Assignment) => {
    if (customOpenCallLog) {
      customOpenCallLog(t);
    } else {
      setModalLogTicket(t);
    }
  };

  return (
    <>
      <div className="table-scroll">
        <table className="data-table ticket-table">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Số điện thoại</th>
              <th>Người yêu cầu</th>
              <th>Trạng thái Lead</th>
              <th>Trạng thái phiếu</th>
              <th>Tình trạng nhiệm vụ</th>
              {heading("updatedAt", "Cập nhật")}
              <th>Kết quả gần nhất</th>
              {heading("expiresAt", "Hạn xử lý")}
              {showActions && <th className="text-center">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const l =
                db.leads.find((l) => l.id === t.leadId) ?? t.leadSnapshot;
              const latest = [...db.activities]
                .filter((a) => a.assignmentId === t.id && !a.voidedAt)
                .sort((a, b) => b.at.localeCompare(a.at))[0];

              const isRebook = isPending(t) && needsRebooking(db, t, now);
              const isCallback =
                isPending(t) && latest?.outcome === "no_answer";
              const hasTodayAppt = db.appointments.some(
                (a) =>
                  a.assignmentId === t.id &&
                  dayVN(a.at) === today &&
                  a.status === "scheduled",
              );

              const canAct =
                (actor.role === "admin" ||
                  actor.role === "leader" ||
                  t.assigneeId === actor.id) &&
                t.status !== "Closed";

              const needsAccept =
                t.assigneeId === actor.id && !t.acceptedAt && t.status !== "Closed";

              return (
                <tr key={t.id}>
                  <td>
                    <Link className="record-link nowrap" to={`/tasks/${t.id}`}>
                      {ticketCode(t)}
                    </Link>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{l?.phone ?? "—"}</span>
                      {l?.phone && (
                        <a
                          href={`tel:${l.phone}`}
                          title="Bấm để gọi"
                          className="muted"
                          style={{ display: "inline-flex", padding: 2 }}
                        >
                          <Phone size={12} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong>{l?.name ?? "Hồ sơ đã chuyển quyền"}</strong>
                      {l?.city && <small className="block muted">{l.city}</small>}
                    </div>
                  </td>
                  <td>{l?.status ? <Badge status={l.status} /> : "—"}</td>
                  <td>
                    <Badge status={t.status} ticket />
                  </td>
                  <td>
                    {isRebook ? (
                      <Chip tone="red">Cần hẹn lại</Chip>
                    ) : isCallback ? (
                      <Chip tone="open">Cần gọi lại</Chip>
                    ) : hasTodayAppt ? (
                      <Chip tone="new">Lịch hẹn hôm nay</Chip>
                    ) : t.status === "New" ? (
                      <Chip plain>Phiếu mới</Chip>
                    ) : t.status === "Solved" ? (
                      <Chip tone="solved">Đã giải quyết</Chip>
                    ) : t.status === "Closed" ? (
                      <Chip tone="closed">Đã đóng</Chip>
                    ) : (
                      <Chip tone="open">Đang tư vấn</Chip>
                    )}
                  </td>
                  <td>{formatDate(t.updatedAt, true)}</td>
                  <td>
                    {latest ? outcomeLabels[latest.outcome] : "Chưa liên hệ"}
                  </td>
                  <td>{formatDate(t.expiresAt, true)}</td>

                  {showActions && (
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          alignItems: "center",
                          justifyContent: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {needsAccept && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                { type: "accept", id: t.id },
                                "Đã nhận việc thành công.",
                              )
                            }
                            title="Nhận việc để bắt đầu xử lý phiếu này"
                            style={{ height: 26, padding: "0 8px", fontSize: 12 }}
                          >
                            <UserCheck size={13} /> Nhận việc
                          </Button>
                        )}

                        {canAct && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCall(t)}
                              title="Bấm gọi khách hàng"
                              style={{ height: 26, padding: "0 6px" }}
                            >
                              <Phone size={13} />
                            </Button>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleLog(t)}
                              title="Ghi nhận cuộc gọi & bằng chứng"
                              style={{ height: 26, padding: "0 8px", fontSize: 12 }}
                            >
                              <PhoneCall size={13} /> Ghi nhận
                            </Button>
                          </>
                        )}

                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          style={{ height: 26, padding: "0 6px" }}
                          title="Xem chi tiết phiếu và hồ sơ"
                        >
                          <Link to={`/tasks/${t.id}`}>
                            <ExternalLink size={13} />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && <Empty title="Không có phiếu phù hợp" />}

      {/* Internal Modals */}
      {modalCallTicket && (
        <CallDialog
          open={!!modalCallTicket}
          onOpenChange={(v) => !v && setModalCallTicket(null)}
          ticketId={modalCallTicket.id}
          onStartLog={(tid) => {
            setModalCallTicket(null);
            const found = db.assignments.find((x) => x.id === tid);
            if (found) setModalLogTicket(found);
          }}
        />
      )}

      {modalLogTicket && (
        <CallLogModal
          open={!!modalLogTicket}
          onOpenChange={(v) => !v && setModalLogTicket(null)}
          ticketId={modalLogTicket.id}
        />
      )}
    </>
  );
}
