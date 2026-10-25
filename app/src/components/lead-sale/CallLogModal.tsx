import { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  FileText,
  MessageCircle,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Trash2,
  UploadCloud,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "./context";
import { uploadEvidence } from "./backend";
import { offices } from "./catalog";
import { ticketCode } from "./workflow";
import { Field, localDateTime } from "./shared";
import { reasonLabels } from "./domain";
import type { ActivityInput, Attachment, TicketStatus } from "./types";

export interface CallLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId?: string;
  leadId?: string;
  onSuccess?: () => void;
}

export function CallLogModal({
  open,
  onOpenChange,
  ticketId: propTicketId,
  leadId: propLeadId,
  onSuccess,
}: CallLogModalProps) {
  const { db, actor, run, busy } = useWorkspace();

  // Find accessible active tickets for this specialist
  const myTickets = db.assignments.filter(
    (t) =>
      (actor.role === "admin" ||
        actor.role === "leader" ||
        t.assigneeId === actor.id) &&
      t.status !== "Closed",
  );

  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [channel, setChannel] = useState<"call" | "zalo">("call");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [at, setAt] = useState<string>(localDateTime());
  const [durationMinutes, setDurationMinutes] = useState<number>(1);
  const [durationSeconds, setDurationSeconds] = useState<number>(30);
  const [outcome, setOutcome] = useState<ActivityInput["outcome"]>("called");
  const [decision, setDecision] = useState<ActivityInput["decision"]>("none");
  const [reason, setReason] = useState<ActivityInput["reason"]>("none");
  const [note, setNote] = useState<string>("");
  const [appointmentAt, setAppointmentAt] = useState<string>("");
  const [place, setPlace] = useState<string>("");
  const [nextCallAt, setNextCallAt] = useState<string>("");
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>("Open");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>("");

  // Determine initial ticket
  useEffect(() => {
    if (!open) return;
    let initial = propTicketId;
    if (!initial && propLeadId) {
      const found = db.assignments.find(
        (t) =>
          t.leadId === propLeadId &&
          (actor.role === "admin" ||
            actor.role === "leader" ||
            t.assigneeId === actor.id) &&
          t.status !== "Closed",
      );
      if (found) initial = found.id;
    }
    if (!initial && myTickets.length > 0) {
      initial = myTickets[0].id;
    }
    setSelectedTicketId(initial ?? "");
    setChannel("call");
    setDirection("outbound");
    setAt(localDateTime());
    setDurationMinutes(1);
    setDurationSeconds(30);
    setOutcome("called");
    setDecision("none");
    setReason("none");
    setNote("");
    setAppointmentAt("");
    setPlace("");
    setNextCallAt("");
    setTicketStatus("Open");
    setAttachments([]);
    setUploadError("");
  }, [open, propTicketId, propLeadId]);

  const activeTicket = db.assignments.find((t) => t.id === selectedTicketId);
  const activeLead = activeTicket
    ? db.leads.find((l) => l.id === activeTicket.leadId) ??
      activeTicket.leadSnapshot
    : undefined;

  const mustAccept =
    activeTicket &&
    activeTicket.assigneeId === actor.id &&
    !activeTicket.acceptedAt;

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !files.length || !activeTicket) return;
    setUploading(true);
    setUploadError("");
    try {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`Tệp ${file.name} vượt quá dung lượng tối đa 20 MB.`);
        }
        const att = await uploadEvidence(file, actor.id, activeTicket.id);
        newAttachments.push(att);
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;

    if (!note.trim()) {
      alert("Vui lòng nhập nội dung tư vấn.");
      return;
    }

    if (!attachments.length) {
      setUploadError(
        channel === "zalo"
          ? "Bắt buộc tải lên ảnh chụp chat Zalo làm bằng chứng."
          : "Bắt buộc tải lên file ghi âm cuộc gọi hoặc ảnh nhật ký cuộc gọi.",
      );
      return;
    }

    const totalDuration =
      channel === "call" ? durationMinutes * 60 + durationSeconds : undefined;

    // Auto accept if not accepted yet
    if (mustAccept) {
      await run({ type: "accept", id: activeTicket.id }, "Đã nhận việc.");
    }

    const input: ActivityInput = {
      channel,
      direction: channel === "call" ? direction : undefined,
      durationSeconds: totalDuration,
      at,
      outcome,
      decision: outcome === "called" ? decision : "none",
      reason: decision === "declined" ? reason : "none",
      note: note.trim(),
      appointmentAt: decision === "agreed" && appointmentAt ? appointmentAt : undefined,
      place: decision === "agreed" && place ? place : undefined,
      nextCallAt: nextCallAt ? nextCallAt : undefined,
      ticketStatus,
      attachments,
    };

    const ok = await run(
      {
        type: "activity",
        assignmentId: activeTicket.id,
        input,
      },
      "Đã ghi nhận cuộc gọi và cập nhật trạng thái phiếu.",
    );

    if (ok) {
      onOpenChange(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="text-primary" size={20} />
            Ghi nhận cuộc gọi thủ công & Bằng chứng
          </DialogTitle>
          <DialogDescription>
            Ghi nhận kết quả liên hệ thực tế, thời lượng, lịch hẹn tiếp theo và
            tải lên bằng chứng (ghi âm/ảnh chụp).
          </DialogDescription>
        </DialogHeader>

        <form className="stack-form" onSubmit={handleSubmit}>
          {/* Target Ticket / Lead Selection */}
          <div className="sub-box">
            <Field label="Phiếu xử lý / Khách hàng *">
              {propTicketId || !myTickets.length ? (
                <div className="readonly-value">
                  <strong>{activeLead?.name ?? "—"}</strong>
                  <span className="muted">
                    ({activeLead?.phone ?? "—"}) · Mã phiếu:{" "}
                    {activeTicket ? ticketCode(activeTicket) : "—"}
                  </span>
                </div>
              ) : (
                <select
                  required
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                >
                  <option value="">Chọn phiếu cần ghi nhận cuộc gọi</option>
                  {myTickets.map((t) => {
                    const l =
                      db.leads.find((x) => x.id === t.leadId) ?? t.leadSnapshot;
                    return (
                      <option key={t.id} value={t.id}>
                        {ticketCode(t)} — {l?.name ?? "Lead"} ({l?.phone ?? "—"})
                        {t.status === "New" ? " [Phiếu mới]" : ""}
                      </option>
                    );
                  })}
                </select>
              )}
            </Field>

            {mustAccept && (
              <p
                className="callout"
                style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}
              >
                <UserCheck size={14} style={{ display: "inline" }} /> Phiếu này
                chưa nhận việc. Hệ thống sẽ tự động nhận việc khi bạn lưu cuộc
                gọi.
              </p>
            )}
          </div>

          {/* Channel & Direction */}
          <div className={channel === "call" ? "grid-2" : ""}>
            <Field label="Kênh liên hệ">
              <div className="seg" role="group">
                <button
                  type="button"
                  className={channel === "call" ? "active" : ""}
                  onClick={() => {
                    setChannel("call");
                    setOutcome("called");
                  }}
                >
                  <Phone size={14} /> Gọi điện
                </button>
                <button
                  type="button"
                  className={channel === "zalo" ? "active" : ""}
                  onClick={() => {
                    setChannel("zalo");
                    setOutcome("called");
                  }}
                >
                  <MessageCircle size={14} /> Zalo
                </button>
              </div>
            </Field>

            {channel === "call" && (
              <Field label="Chiều cuộc gọi">
                <div className="seg" role="group">
                  <button
                    type="button"
                    className={direction === "outbound" ? "active" : ""}
                    onClick={() => setDirection("outbound")}
                  >
                    <PhoneOutgoing size={14} /> Cuộc gọi đi
                  </button>
                  <button
                    type="button"
                    className={direction === "inbound" ? "active" : ""}
                    onClick={() => setDirection("inbound")}
                  >
                    <PhoneIncoming size={14} /> Cuộc gọi đến
                  </button>
                </div>
              </Field>
            )}
          </div>

          {/* Time & Duration */}
          <div className="grid-2">
            <Field label="Thời gian liên hệ *">
              <Input
                type="datetime-local"
                required
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </Field>

            {channel === "call" && (
              <Field label="Thời lượng cuộc gọi">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(Math.max(0, parseInt(e.target.value) || 0))
                    }
                    style={{ width: "80px" }}
                  />
                  <span>phút</span>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={durationSeconds}
                    onChange={(e) =>
                      setDurationSeconds(Math.max(0, parseInt(e.target.value) || 0))
                    }
                    style={{ width: "80px" }}
                  />
                  <span>giây</span>
                </div>
              </Field>
            )}
          </div>

          {/* Call Outcome */}
          <div className="grid-2">
            <Field label="Kết quả liên hệ *">
              <select
                required
                value={outcome}
                onChange={(e) => {
                  const val = e.target.value as ActivityInput["outcome"];
                  setOutcome(val);
                  if (val !== "called") {
                    setDecision("none");
                    setReason("none");
                    setAppointmentAt("");
                    setPlace("");
                  }
                }}
              >
                <option value="called">Đã liên hệ thành công</option>
                <option value="no_answer">Không nghe máy / Máy bận</option>
                <option value="wrong_phone">Sai số điện thoại</option>
                <option value="activated">Xác nhận đã đăng ký</option>
              </select>
            </Field>

            {outcome === "called" && (
              <Field label="Quyết định của tài xế *">
                <select
                  required
                  value={decision}
                  onChange={(e) => {
                    const d = e.target.value as ActivityInput["decision"];
                    setDecision(d);
                    if (d !== "agreed") {
                      setAppointmentAt("");
                      setPlace("");
                    }
                    if (d !== "declined") setReason("none");
                  }}
                >
                  <option value="none">Khách quan tâm / Cần chăm sóc tiếp</option>
                  <option value="agreed">Đồng ý hẹn đến văn phòng</option>
                  <option value="declined">Từ chối tham gia</option>
                  <option value="hungup">Gác máy ngang</option>
                </select>
              </Field>
            )}
          </div>

          {/* Reason if declined */}
          {decision === "declined" && (
            <Field label="Lý do từ chối *">
              <select
                required
                value={reason === "none" ? "" : reason}
                onChange={(e) =>
                  setReason(e.target.value as ActivityInput["reason"])
                }
              >
                <option value="" disabled>
                  Chọn lý do từ chối
                </option>
                {Object.entries(reasonLabels)
                  .filter(([k]) => k !== "none")
                  .map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
          )}

          {/* Appointment details if agreed */}
          {decision === "agreed" && (
            <div className="sub-box">
              <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CalendarDays size={16} /> Lịch hẹn đến văn phòng đăng ký
              </h3>
              <div className="grid-2">
                <Field label="Ngày giờ hẹn *">
                  <Input
                    type="datetime-local"
                    required
                    value={appointmentAt}
                    onChange={(e) => setAppointmentAt(e.target.value)}
                  />
                </Field>
                <Field label="Văn phòng hẹn *">
                  <select
                    required
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                  >
                    <option value="">Chọn văn phòng tiếp đón</option>
                    {offices.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* Next follow-up call if interested */}
          {decision === "none" && outcome === "called" && (
            <div className="sub-box">
              <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={16} /> Lịch hẹn gọi lại chăm sóc
              </h3>
              <Field label="Thời điểm gọi lại (không bắt buộc)">
                <Input
                  type="datetime-local"
                  value={nextCallAt}
                  onChange={(e) => setNextCallAt(e.target.value)}
                />
              </Field>
            </div>
          )}

          {/* Consultation Notes */}
          <Field label="Nội dung tư vấn chi tiết *">
            <Textarea
              required
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi rõ nội dung đã trao đổi, thông tin phương tiện, thời gian làm việc, vướng mắc của tài xế..."
            />
          </Field>

          {/* Ticket Status After Call */}
          <Field label="Trạng thái phiếu sau cuộc gọi *">
            <select
              required
              value={ticketStatus}
              onChange={(e) => setTicketStatus(e.target.value as TicketStatus)}
            >
              <option value="Open">Đang tư vấn (Open) — Cần chăm sóc tiếp</option>
              <option value="Solved">
                Đã giải quyết (Solved) — Đã xong mục tiêu tư vấn
              </option>
            </select>
          </Field>

          {/* Proof Uploads (Multiple files) */}
          <div className="sub-box">
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <UploadCloud size={16} /> Bằng chứng cuộc gọi (Proof) *
            </h3>
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>
              Tải lên file ghi âm (MP3, WAV, M4A) hoặc ảnh chụp nhật ký cuộc
              gọi/chat Zalo (tối đa 20 MB/tệp). Có thể chọn nhiều tệp cùng lúc.
            </p>

            <input
              type="file"
              multiple
              disabled={uploading || busy || !activeTicket}
              accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm,image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            {uploading && (
              <p role="status" className="muted" style={{ marginTop: 8 }}>
                Đang tải tệp lên lưu trữ Supabase Storage…
              </p>
            )}

            {uploadError && (
              <p role="alert" style={{ color: "red", marginTop: 8, fontSize: 13 }}>
                {uploadError}
              </p>
            )}

            {/* List of attachments */}
            {attachments.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {attachments.map((a, idx) => (
                  <div
                    key={a.path || idx}
                    className="attachment-row"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "var(--bg-subtle, #f8f9fa)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <FileText size={16} className="text-muted" />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {a.name}
                      </span>
                      <small className="muted">
                        ({(a.size / 1024).toFixed(0)} KB)
                      </small>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {a.dataUrl && a.type.startsWith("audio/") && (
                        <audio
                          controls
                          src={a.dataUrl}
                          style={{ height: 28, maxWidth: 200 }}
                        />
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setAttachments(attachments.filter((_, i) => i !== idx))
                        }
                      >
                        <Trash2 size={14} className="text-red-500" /> Bỏ tệp
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="muted" style={{ fontSize: 12, margin: "4px 0" }}>
            * Lưu ý: Ghi nhận cuộc gọi thủ công do nhân viên khai báo kèm bằng
            chứng; hệ thống chưa tích hợp tổng đài VoIP tự động.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 16,
            }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={busy || uploading || !activeTicket || !attachments.length}
            >
              {busy ? "Đang lưu…" : "Lưu lần liên hệ & Cập nhật phiếu"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
