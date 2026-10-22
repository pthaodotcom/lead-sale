import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./context";
import { leadLabels } from "./domain";
import { Field, formatDate, localDateTime } from "./shared";
import type { Activity, Appointment, Lead, LeadStatus } from "./types";

// Milestone correction and re-reception, shown on the lead page for intake/admin.
export function LeadCorrections({ lead }: { lead: Lead }) {
  const { db, run, busy } = useWorkspace();
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
  return (
    <div className="stack-form">
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
                "Đã ghi nhận lần tiếp nhận mới; giữ ngày và nguồn đầu.",
              )
            )
              setReceptionNote("");
          }}
        >
          <Field label="Nguồn lần này">
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
          <Field label="Nội dung tiếp nhận *">
            <Textarea
              required
              rows={2}
              value={receptionNote}
              onChange={(e) => setReceptionNote(e.target.value)}
            />
          </Field>
          <Button size="sm" disabled={busy}>
            Lưu lần tiếp nhận
          </Button>
        </form>
      </details>
      <details>
        <summary>Đính chính mốc nhập nhầm</summary>
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
                "Đã lưu đính chính, lịch sử được giữ.",
              )
            )
              setReason("");
          }}
        >
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Dùng khi đã xác nhận nhầm. Không tự mở lại phiếu đã giải quyết/đóng.
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
            <Field label="Ngày chạy đơn đầu đúng">
              <Input
                type="datetime-local"
                step="any"
                required
                value={onboardedAt}
                onChange={(e) => setOnboardedAt(e.target.value)}
              />
            </Field>
          )}
          <Field label="Lý do và căn cứ *">
            <Textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Button size="sm" variant="outline" disabled={busy}>
            Lưu đính chính
          </Button>
        </form>
      </details>
      {lead.coreCorrectionAt && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Đã đính chính {formatDate(lead.coreCorrectionAt, true)}:{" "}
          {lead.correctionReason}
        </p>
      )}
    </div>
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
