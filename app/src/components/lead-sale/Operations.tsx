import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./context";
import { AssignmentDialog } from "./AssignmentDialog";
import { canAssign, canEditLead, isLive } from "./domain";
import { Badge, Empty, Field, formatDate, Guard, PageHeading } from "./shared";
import type { ClosureReview } from "./types";
export function IntakeQueue() {
  const { db, actor } = useWorkspace();
  const rows = db.leads.filter(
    (l) =>
      l.status === "New" &&
      !l.archived &&
      !db.assignments.some(
        (t) =>
          t.leadId === l.id &&
          isLive(t) &&
          Date.parse(t.expiresAt) > Date.now(),
      ),
  );
  return (
    <Guard allowed={canAssign(actor)}>
      <PageHeading
        title="Lead chờ phân công"
        description="Hồ sơ Mới đủ điều kiện và chưa có phiếu trong hạn."
      />
      <section className="data-section">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tài xế</th>
                <th>Tiếp nhận đầu</th>
                <th>Lần tiếp nhận gần nhất</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/leads/${l.id}/show`}>{l.name}</Link>
                    <small>{l.phone}</small>
                  </td>
                  <td>{formatDate(l.receivedAt, true)}</td>
                  <td>
                    {formatDate(
                      db.receptions
                        .filter((r) => r.leadId === l.id)
                        .sort((a, b) => b.at.localeCompare(a.at))[0]?.at ??
                        l.receivedAt,
                      true,
                    )}
                  </td>
                  <td>
                    <AssignmentDialog leadId={l.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty title="Đã phân công hết hàng đợi" />}
      </section>
    </Guard>
  );
}
function ReviewRow({ review }: { review: ClosureReview }) {
  const { db, actor, run, busy } = useWorkspace();
  const [note, setNote] = useState("");
  const lead = db.leads.find((l) => l.id === review.leadId);
  return (
    <article className="handover-card">
      <div>
        <Link to={`/leads/${review.leadId}/show`}>
          {lead?.name ?? review.leadId}
        </Link>{" "}
        {lead && <Badge status={lead.status} />}
        <p>
          {review.assignmentId} · {formatDate(review.at, true)}
        </p>
        <p>{review.reason}</p>
      </div>
      {review.reviewedAt ? (
        <p>
          Đã rà soát {formatDate(review.reviewedAt, true)} ·{" "}
          {review.note ?? review.result}
        </p>
      ) : (
        canEditLead(actor) && (
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(
                  { type: "review", id: review.id, note },
                  "Đã ghi nhận rà soát.",
                )
              )
                setNote("");
            }}
          >
            <p>
              Mở hồ sơ để xác nhận trạng thái và căn cứ trước khi hoàn tất bàn
              giao.
            </p>
            <Field label="Kết quả rà soát">
              <Textarea
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <Button disabled={busy}>Hoàn tất rà soát</Button>
          </form>
        )
      )}
    </article>
  );
}
export function Handover() {
  const { db, actor } = useWorkspace();
  const [state, setState] = useState("pending");
  const [date, setDate] = useState("");
  const rows = db.reviews.filter(
    (r) =>
      (state === "all" ||
        (state === "pending" ? !r.reviewedAt : !!r.reviewedAt)) &&
      (!date ||
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date(r.at)) === date),
  );
  return (
    <Guard allowed={["admin", "intake", "leader"].includes(actor.role)}>
      <PageHeading
        title="Bàn giao phiếu Closed"
        description="Rà soát kết quả đóng phiếu; hồ sơ Lead được cập nhật theo căn cứ riêng."
      />
      <section className="data-section">
        <div className="filter-bar">
          <Field label="Ngày đóng phiếu">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <select
            aria-label="Lọc bàn giao"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="pending">Chưa rà soát</option>
            <option value="reviewed">Đã rà soát</option>
            <option value="all">Tất cả</option>
          </select>
          <span>{rows.length} phiếu</span>
        </div>
        {rows.map((r) => (
          <ReviewRow key={r.id} review={r} />
        ))}
        {!rows.length && <Empty title="Không có phiếu cần rà soát" />}
      </section>
    </Guard>
  );
}
