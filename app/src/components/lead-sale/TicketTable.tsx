import { useState } from "react";
import { Link } from "react-router";
import type { Assignment } from "./types";
import { useWorkspace } from "./context";
import { Badge, Empty, formatDate } from "./shared";
import { outcomeLabels } from "./domain";
import { ticketCode } from "./workflow";
export function TicketTable({ tickets }: { tickets: Assignment[] }) {
  const { db } = useWorkspace();
  const [sort, setSort] = useState({ key: "updatedAt", direction: -1 });
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
  return (
    <>
      <div className="table-scroll">
        <table className="data-table ticket-table">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Số điện thoại</th>
              <th>Người yêu cầu</th>
              <th>Chuyên viên</th>
              {heading("createdAt", "Thời điểm tạo")}
              {heading("updatedAt", "Thời điểm cập nhật")}
              <th>Kết quả gần nhất</th>
              <th>Trạng thái phiếu</th>
              {heading("expiresAt", "Hạn xử lý")}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const l =
                db.leads.find((l) => l.id === t.leadId) ?? t.leadSnapshot;
              const latest = [...db.activities]
                .filter((a) => a.assignmentId === t.id && !a.voidedAt)
                .sort((a, b) => b.at.localeCompare(a.at))[0];
              return (
                <tr key={t.id}>
                  <td>
                    <Link className="record-link nowrap" to={`/tasks/${t.id}`}>
                      {ticketCode(t)}
                    </Link>
                  </td>
                  <td>{l?.phone ?? "—"}</td>
                  <td>{l?.name ?? "Hồ sơ đã chuyển quyền"}</td>
                  <td>
                    {db.members.find((m) => m.id === t.assigneeId)?.name ?? "—"}
                  </td>
                  <td>{formatDate(t.createdAt, true)}</td>
                  <td>{formatDate(t.updatedAt, true)}</td>
                  <td>
                    {latest ? outcomeLabels[latest.outcome] : "Chưa liên hệ"}
                  </td>
                  <td>
                    <Badge status={t.status} ticket />
                  </td>
                  <td>{formatDate(t.expiresAt, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && <Empty title="Không có phiếu phù hợp" />}
    </>
  );
}
