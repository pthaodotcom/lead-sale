import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import {
  ExternalLink,
  Phone,
  PhoneCall,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import type { Assignment } from "./types";
import { useWorkspace } from "./context";
import { Badge, Empty, formatCompactDate, TablePagination } from "./shared";
import { outcomeLabels } from "./domain";
import { ticketCode } from "./workflow";
import { Button } from "@/components/ui/button";
import { CallDialog } from "./CallDialog";
import { CallLogModal } from "./CallLogModal";
import { ReopenTicketDialog } from "./ReopenTicketDialog";

export function TicketTable({
  tickets,
  showActions = true,
  onOpenCall: customOpenCall,
  onOpenCallLog: customOpenCallLog,
  pageSize = 10,
}: {
  tickets: Assignment[];
  showActions?: boolean;
  onOpenCall?: (ticket: Assignment) => void;
  onOpenCallLog?: (ticket: Assignment) => void;
  pageSize?: number;
}) {
  const { db, actor, run, busy } = useWorkspace();
  const [sort, setSort] = useState({ key: "updatedAt", direction: -1 });
  const [page, setPage] = useState(1);
  const sortId = useId();

  useEffect(() => {
    setPage(1);
  }, [tickets]);

  // Self-contained modal states if no external handler provided
  const [modalCallTicket, setModalCallTicket] = useState<Assignment | null>(
    null,
  );
  const [modalLogTicket, setModalLogTicket] = useState<Assignment | null>(null);
  const [modalReopenTicket, setModalReopenTicket] = useState<Assignment | null>(
    null,
  );

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
        onClick={() => {
          setSort({ key, direction: sort.key === key ? -sort.direction : 1 });
          setPage(1);
        }}
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

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const paginatedRows = rows.slice(
    (current - 1) * pageSize,
    current * pageSize,
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
      <div className="ticket-sort-mobile">
        <label htmlFor={sortId}>Sắp xếp phiếu</label>
        <select
          id={sortId}
          value={`${sort.key}:${sort.direction}`}
          onChange={(event) => {
            const [key, direction] = event.target.value.split(":");
            setSort({ key, direction: Number(direction) });
            setPage(1);
          }}
        >
          <option value="updatedAt:-1">Cập nhật mới nhất</option>
          <option value="updatedAt:1">Cập nhật cũ nhất</option>
          <option value="expiresAt:1">Hạn xử lý gần nhất</option>
          <option value="expiresAt:-1">Hạn xử lý xa nhất</option>
        </select>
      </div>
      <p className="ticket-scroll-note">
        Cuộn ngang để xem đầy đủ phiếu và thao tác.
      </p>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Danh sách phiếu tư vấn"
      >
        <table
          className={`data-table ticket-table mobile-records ${showActions ? "has-actions" : ""}`}
        >
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Tài xế</th>
              <th>Trạng thái Lead</th>
              <th>Trạng thái phiếu</th>
              {heading("updatedAt", "Cập nhật")}
              <th>Kết quả</th>
              {heading("expiresAt", "Hạn xử lý")}
              {showActions && <th className="text-center">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((t) => {
              const l =
                db.leads.find((l) => l.id === t.leadId) ?? t.leadSnapshot;
              const latest = [...db.activities]
                .filter((a) => a.assignmentId === t.id && !a.voidedAt)
                .sort((a, b) => b.at.localeCompare(a.at))[0];

              const canAct =
                (actor.role === "admin" ||
                  actor.role === "leader" ||
                  t.assigneeId === actor.id) &&
                t.status !== "Closed";

              const needsAccept =
                t.assigneeId === actor.id &&
                !t.acceptedAt &&
                t.status !== "Closed";

              return (
                <tr key={t.id}>
                  <td data-label="Mã phiếu">
                    <Link className="record-link nowrap" to={`/tasks/${t.id}`}>
                      {ticketCode(t)}
                    </Link>
                  </td>
                  <td className="ticket-driver" data-label="Tài xế">
                    <strong>{l?.name ?? "Hồ sơ đã chuyển quyền"}</strong>
                    <div className="ticket-contact">
                      {l?.phone && (
                        <a
                          href={`tel:${l.phone}`}
                          title={`Gọi ${l.name}`}
                          className="muted"
                        >
                          <Phone size={12} />
                          {l.phone}
                        </a>
                      )}
                      {l?.city && <small>{l.city}</small>}
                    </div>
                  </td>
                  <td data-label="Trạng thái Lead">
                    {l?.status ? <Badge status={l.status} /> : "—"}
                  </td>
                  <td data-label="Trạng thái phiếu">
                    <Badge status={t.status} ticket />
                  </td>
                  <td data-label="Cập nhật">
                    {formatCompactDate(t.updatedAt)}
                  </td>
                  <td data-label="Kết quả">
                    {latest ? outcomeLabels[latest.outcome] : "Chưa liên hệ"}
                  </td>
                  <td data-label="Hạn xử lý">
                    {formatCompactDate(t.expiresAt)}
                  </td>

                  {showActions && (
                    <td className="ticket-actions" data-label="Thao tác">
                      <div className="ticket-actions-inner">
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
                            style={{
                              height: 26,
                              padding: "0 8px",
                              fontSize: 12,
                            }}
                          >
                            <UserCheck size={13} /> Nhận việc
                          </Button>
                        )}

                        {canAct && (
                          <>
                            {t.status === "Solved" ? (
                              l?.status === "New" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setModalReopenTicket(t)}
                                  title="Mở lại phiếu phân công để tiếp tục chăm sóc"
                                  style={{
                                    height: 26,
                                    padding: "0 8px",
                                    fontSize: 12,
                                  }}
                                >
                                  <RotateCcw size={13} /> Mở lại
                                </Button>
                              )
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCall(t)}
                                  title="Bấm gọi khách hàng"
                                  aria-label={`Gọi ${l?.name ?? "tài xế"}`}
                                  style={{ height: 26, padding: "0 6px" }}
                                >
                                  <Phone size={13} />
                                  <span className="ticket-call-label">Gọi</span>
                                </Button>

                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleLog(t)}
                                  title="Ghi nhận cuộc gọi & bằng chứng"
                                  style={{
                                    height: 26,
                                    padding: "0 8px",
                                    fontSize: 12,
                                  }}
                                >
                                  <PhoneCall size={13} /> Ghi nhận
                                </Button>
                              </>
                            )}
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
      {!rows.length ? (
        <Empty title="Không có phiếu phù hợp" />
      ) : (
        <TablePagination
          current={current}
          total={rows.length}
          pageSize={pageSize}
          onPageChange={setPage}
          unit="phiếu"
        />
      )}

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

      {modalReopenTicket && (
        <ReopenTicketDialog
          ticket={modalReopenTicket}
          open={!!modalReopenTicket}
          onOpenChange={(v) => !v && setModalReopenTicket(null)}
        />
      )}
    </>
  );
}
