import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./context";
import { canEditLead, leadLabels } from "./domain";
import { Field, formatDate, localDateTime } from "./shared";
import type { Activity, Appointment, Lead, LeadStatus } from "./types";

export function LeadMilestones({ lead }: { lead: Lead }) {
  const { actor, db, run, busy } = useWorkspace();
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [reason, setReason] = useState("");
  const [activatedAt, setActivatedAt] = useState(
    lead.activatedAt ? localDateTime(new Date(lead.activatedAt)) : "",
  );
  const [onboardedAt, setOnboardedAt] = useState(
    lead.onboardedAt ? localDateTime(new Date(lead.onboardedAt)) : "",
  );
  const [sourceId, setSourceId] = useState(lead.sourceId);
  const [receptionNote, setReceptionNote] = useState("");
  const label = (source?: string) =>
    source === "simulator"
      ? "Hệ thống giả lập"
      : source === "manual_correction"
        ? "Đính chính thủ công"
        : source === "manual"
          ? "Xác nhận thủ công"
          : "Chưa rõ căn cứ (dữ liệu cũ)";
  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Mốc kết quả và căn cứ</h2>
      </div>
      <div className="side-content stack-form">
        <dl className="info-grid">
          <div>
            <dt>Hoàn tất đăng ký</dt>
            <dd>
              {formatDate(lead.activatedAt, true)}
              {lead.activatedAt && (
                <small>
                  {label(lead.activatedSource ?? lead.milestoneSource)} · Nhận{" "}
                  {formatDate(
                    lead.activatedReceivedAt ?? lead.milestoneRecordedAt,
                    true,
                  )}
                  {lead.activatedEventId && (
                    <span className="core-event-id">
                      {" "}
                      · Sự kiện {lead.activatedEventId}
                    </span>
                  )}
                </small>
              )}
            </dd>
          </div>
          <div>
            <dt>Đơn hoàn thành đầu</dt>
            <dd>
              {formatDate(lead.onboardedAt, true)}
              {lead.onboardedAt && (
                <small>
                  {label(lead.onboardedSource ?? lead.milestoneSource)} ·{" "}
                  {lead.firstOrderId ?? "Chưa có mã đơn nguồn"}
                  {lead.onboardedReceivedAt && (
                    <span>
                      {" "}
                      · Nhận {formatDate(lead.onboardedReceivedAt, true)}
                    </span>
                  )}
                  {lead.onboardedEventId && (
                    <span className="core-event-id">
                      {" "}
                      · Sự kiện {lead.onboardedEventId}
                    </span>
                  )}
                </small>
              )}
            </dd>
          </div>
          {lead.externalDriverId && (
            <div>
              <dt>Mã tài xế giả lập</dt>
              <dd className="core-event-id">{lead.externalDriverId}</dd>
            </div>
          )}
          {lead.coreCorrectionAt && (
            <div>
              <dt>Đã đính chính</dt>
              <dd>
                {formatDate(lead.coreCorrectionAt, true)} ·{" "}
                {lead.correctionReason}
              </dd>
            </div>
          )}
        </dl>
        <p>
          Ngày kết quả có thể trước ngày tiếp nhận. Xác nhận thủ công không có
          nghĩa đã được core xác minh.
        </p>
        {canEditLead(actor) && !lead.archived && (
          <>
            <details>
              <summary>Đính chính kết quả nhập nhầm</summary>
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await run(
                      {
                        type: "correctMilestone",
                        id: lead.id,
                        status,
                        reason,
                        ...(["Activated", "Onboarded"].includes(status)
                          ? { activatedAt }
                          : {}),
                        ...(status === "Onboarded" ? { onboardedAt } : {}),
                      },
                      "Đã lưu đính chính và giữ lịch sử.",
                    )
                  )
                    setReason("");
                }}
              >
                <p>
                  Không tự mở lại phiếu đã giải quyết/đóng hoặc lịch đã hủy. Sự
                  kiện nguồn tiếp theo sẽ chờ đối soát.
                </p>
                <Field label="Trạng thái đúng">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  >
                    {Object.entries(leadLabels).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {["Activated", "Onboarded"].includes(status) && (
                  <Field label="Ngày đăng ký đúng">
                    <Input
                      type="datetime-local"
                      step="any"
                      required
                      value={activatedAt}
                      onChange={(e) => setActivatedAt(e.target.value)}
                    />
                  </Field>
                )}
                {status === "Onboarded" && (
                  <Field label="Ngày hoàn thành đơn đầu đúng">
                    <Input
                      type="datetime-local"
                      step="any"
                      required
                      value={onboardedAt}
                      onChange={(e) => setOnboardedAt(e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Lý do và căn cứ đính chính">
                  <Textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <Button disabled={busy}>Lưu đính chính</Button>
              </form>
            </details>
            <details>
              <summary>Ghi nhận một lần tiếp nhận mới</summary>
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await run(
                      {
                        type: "receiveLead",
                        id: lead.id,
                        sourceId,
                        reason: receptionNote,
                      },
                      "Đã ghi nhận tái tiếp nhận, giữ ngày và nguồn đầu.",
                    )
                  )
                    setReceptionNote("");
                }}
              >
                <Field label="Nguồn lần tiếp nhận này">
                  <select
                    required
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                  >
                    {db.sources
                      .filter((s) => s.active)
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Nội dung tiếp nhận">
                  <Textarea
                    required
                    value={receptionNote}
                    onChange={(e) => setReceptionNote(e.target.value)}
                  />
                </Field>
                <Button disabled={busy}>Lưu lần tiếp nhận</Button>
              </form>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
export function ActivityCorrection({ activity }: { activity: Activity }) {
  const { run, busy } = useWorkspace();
  const [reason, setReason] = useState("");
  if (activity.voidedAt)
    return (
      <p className="warning-text">
        Đã hủy tính kết quả: {activity.voidReason} ·{" "}
        {formatDate(activity.voidedAt, true)}
      </p>
    );
  if (activity.appointmentId) return null;
  return (
    <details>
      <summary>Hủy kết quả nhập nhầm</summary>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await run(
            { type: "voidActivity", id: activity.id, reason },
            "Đã hủy tính kết quả; giữ hoạt động trong lịch sử.",
          );
        }}
      >
        <Field label="Lý do hủy kết quả">
          <Textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p>Bộ đếm được tính lại; phiếu Solved/Closed không tự mở lại.</p>
        <Button variant="outline" size="sm" disabled={busy}>
          Xác nhận hủy kết quả
        </Button>
      </form>
    </details>
  );
}
export function AppointmentCorrection({
  appointment,
}: {
  appointment: Appointment;
}) {
  const { run, busy } = useWorkspace();
  const [status, setStatus] = useState<Appointment["status"]>(
    appointment.status === "missed" ? "attended" : "missed",
  );
  const [reason, setReason] = useState("");
  return (
    <details>
      <summary>Đính chính kết quả hẹn</summary>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              {
                type: "correctAppointment",
                id: appointment.id,
                status,
                reason,
              },
              "Đã đính chính lịch hẹn.",
            )
          )
            setReason("");
        }}
      >
        <Field label="Kết quả đúng">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Appointment["status"])}
          >
            <option value="attended">Đã đến</option>
            <option value="missed">Không đến</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </Field>
        <Field label="Căn cứ đính chính">
          <Textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Button disabled={busy} size="sm">
          Lưu kết quả đúng
        </Button>
      </form>
    </details>
  );
}
