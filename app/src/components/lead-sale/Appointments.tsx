import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { canWork } from "./domain";
import { Empty, formatDate, Guard, PageHeading } from "./shared";

const labels = {
  scheduled: "Đã lên lịch",
  attended: "Đã đến",
  missed: "Không đến",
  cancelled: "Đã hủy",
};
export function Appointments() {
  const { db, actor, run } = useWorkspace();
  const [filter, setFilter] = useState("scheduled");
  const items = db.appointments
    .filter(
      (a) =>
        (!filter || a.status === filter) &&
        (actor.role !== "telesale" || a.actorId === actor.id),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  return (
    <Guard allowed={actor.role !== "viewer"}>
      <PageHeading
        title="Lịch hẹn đăng ký"
        description="Theo dõi tài xế đã hẹn, lịch quá hạn và kết quả đến đăng ký."
      />
      <section className="data-section">
        <div className="filter-bar">
          <select
            aria-label="Lọc trạng thái lịch hẹn"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Tất cả lịch hẹn</option>
            {Object.entries(labels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
          <span className="muted">{items.length} lịch hẹn</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tài xế</th>
                <th>Ngày giờ hẹn</th>
                <th>Địa điểm</th>
                <th>Người phụ trách</th>
                <th>Trạng thái</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const t = db.assignments.find((t) => t.id === a.assignmentId)!;
                const l = db.leads.find((l) => l.id === a.leadId)!;
                return (
                  <tr key={a.id}>
                    <td>
                      <Link
                        className="record-link"
                        to={`/assignments/${a.assignmentId}/show`}
                      >
                        {l.name}
                      </Link>
                      <small>{l.phone}</small>
                    </td>
                    <td>
                      {formatDate(a.at, true)}
                      {a.status === "scheduled" &&
                        Date.parse(a.at) < Date.now() && (
                          <small className="warning-text">Đã quá giờ hẹn</small>
                        )}
                    </td>
                    <td>{a.place}</td>
                    <td>{db.members.find((m) => m.id === a.actorId)?.name}</td>
                    <td>{labels[a.status]}</td>
                    <td>
                      {a.status === "scheduled" &&
                      canWork(actor, t) &&
                      t.status !== "Closed" ? (
                        <div className="row-actions">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              run(
                                {
                                  type: "appointment",
                                  id: a.id,
                                  status: "attended",
                                },
                                "Đã ghi nhận tài xế đến hẹn.",
                              )
                            }
                          >
                            Đã đến
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={Date.parse(a.at) > Date.now()}
                            onClick={() =>
                              run(
                                {
                                  type: "appointment",
                                  id: a.id,
                                  status: "missed",
                                },
                                "Đã ghi nhận không đến hẹn.",
                              )
                            }
                          >
                            Không đến
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              run(
                                {
                                  type: "appointment",
                                  id: a.id,
                                  status: "cancelled",
                                },
                                "Đã hủy lịch hẹn.",
                              )
                            }
                          >
                            Hủy hẹn
                          </Button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <Empty
            title="Không có lịch hẹn phù hợp"
            description="Lịch mới được tạo khi ghi nhận tài xế Đồng ý trong phiếu tư vấn."
          />
        )}
      </section>
    </Guard>
  );
}
