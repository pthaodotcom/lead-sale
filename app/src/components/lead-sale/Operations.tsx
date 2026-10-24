import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./context";
import { canEditLead } from "./domain";
import {
  Badge,
  Chip,
  Empty,
  Field,
  formatDate,
  Guard,
  memberName,
  PageHeading,
} from "./shared";
import type { ClosureReview } from "./types";

const resultLabels: Record<string, string> = {
  eligible: "Đủ điều kiện phân công lại → hồ sơ Mới",
  closed: "Đóng hồ sơ → hồ sơ Đã đóng",
};
// Legacy result kept readable for reviews made before 24/10/2026.
const shownLabels: Record<string, string> = {
  ...resultLabels,
  follow_up: "Cần theo dõi thêm (dữ liệu cũ)",
};

function ReviewRow({ review }: { review: ClosureReview }) {
  const { db, actor, run, busy } = useWorkspace();
  const [note, setNote] = useState("");
  const [result, setResult] = useState("eligible");
  const [amending, setAmending] = useState(false);
  const [reason, setReason] = useState("");
  const lead = db.leads.find((l) => l.id === review.leadId);
  const ticket = db.assignments.find((t) => t.id === review.assignmentId);
  return (
    <article className="list-row">
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link className="record-link" to={`/leads/${review.leadId}/show`}>
            {lead?.name ?? review.leadId}
          </Link>
          {lead && <Badge status={lead.status} />}
        </div>
        <p>
          Phiếu {review.assignmentId}
          {ticket && <> · {memberName(db, ticket.assigneeId)}</>} · đóng{" "}
          {formatDate(review.at, true)}
        </p>
        <p>Lý do đóng: {review.reason}</p>
      </div>
      {review.reviewedAt && !amending ? (
        <div className="stack-form">
          <div>
            <Chip tone="solved">
              {shownLabels[review.result ?? ""] ?? "Đã rà soát"}
            </Chip>
            <p>
              {formatDate(review.reviewedAt, true)} ·{" "}
              {memberName(db, review.reviewedBy)}
              {review.note && <> — {review.note}</>}
            </p>
          </div>
          {canEditLead(actor) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAmending(true)}
            >
              Đính chính rà soát
            </Button>
          )}
        </div>
      ) : canEditLead(actor) ? (
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await run(
                amending
                  ? { type: "amendReview", id: review.id, note, result, reason }
                  : { type: "review", id: review.id, note, result },
                "Đã ghi nhận rà soát.",
              )
            ) {
              setNote("");
              setAmending(false);
              setReason("");
            }
          }}
        >
          <Field label="Kết quả rà soát">
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              {Object.entries(resultLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Căn cứ *">
            <Textarea
              required
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {amending && (
            <Field label="Lý do đính chính *">
              <Textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          )}
          <Button disabled={busy}>Hoàn tất rà soát</Button>
        </form>
      ) : (
        <p className="muted">Chờ bộ phận Tiếp nhận rà soát.</p>
      )}
    </article>
  );
}

export function Handover() {
  const { db, actor } = useWorkspace();
  const [state, setState] = useState("pending");
  const [date, setDate] = useState("");
  const day = (s: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      new Date(s),
    );
  const count = (s: string) =>
    scoped.filter((r) =>
      s === "all" ? true : s === "pending" ? !r.reviewedAt : !!r.reviewedAt,
    ).length;
  const scoped = db.reviews.filter(
    (r) =>
      actor.role !== "leader" ||
      (db.assignments.find((t) => t.id === r.assignmentId)?.teamId ??
        "default") === (actor.teamId ?? "default"),
  );
  const rows = scoped
    .filter(
      (r) =>
        (state === "all" ||
          (state === "pending" ? !r.reviewedAt : !!r.reviewedAt)) &&
        (!date || day(r.at) === date),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Guard allowed={["intake", "leader"].includes(actor.role)}>
      <PageHeading
        title="Bàn giao phiếu Closed"
        description="Phiếu đã đóng chuyển về Tiếp nhận để cập nhật hồ sơ. Phiếu Closed không tự làm hồ sơ Closed."
      />
      <section className="panel">
        <div className="tabs">
          {[
            ["pending", "Chờ rà soát"],
            ["reviewed", "Đã rà soát"],
            ["all", "Tất cả"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={state === k ? "active" : ""}
              onClick={() => setState(k)}
            >
              {label} <span className="count">{count(k)}</span>
            </button>
          ))}
        </div>
        <div className="toolbar">
          <label className="inline-check">
            Ngày đóng phiếu
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "auto" }}
            />
          </label>
          {date && (
            <Button variant="ghost" size="sm" onClick={() => setDate("")}>
              Bỏ lọc ngày
            </Button>
          )}
        </div>
        {rows.map((r) => (
          <ReviewRow key={r.id} review={r} />
        ))}
        {!rows.length && (
          <Empty
            icon={ArrowLeftRight}
            title={
              state === "pending"
                ? "Không còn phiếu chờ rà soát"
                : "Không có phiếu phù hợp"
            }
            description="Phiếu đóng do hết hạn, đóng sớm hoặc chuyển người sẽ xuất hiện ở đây."
          />
        )}
      </section>
    </Guard>
  );
}
