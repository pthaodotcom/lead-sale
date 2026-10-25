import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
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
import { offices } from "./catalog";
import { ticketCode } from "./workflow";
import { Field, localDateTime } from "./shared";
import type { ActivityInput, Attachment } from "./types";

export interface AppointmentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId?: string;
  leadId?: string;
  onSuccess?: () => void;
}

export function AppointmentCreateDialog({
  open,
  onOpenChange,
  ticketId: propTicketId,
  leadId: propLeadId,
  onSuccess,
}: AppointmentCreateDialogProps) {
  const { db, actor, run, busy } = useWorkspace();
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [at, setAt] = useState<string>(localDateTime());
  const [place, setPlace] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const myTickets = db.assignments.filter(
    (t) =>
      (actor.role === "admin" ||
        actor.role === "leader" ||
        t.assigneeId === actor.id) &&
      t.status !== "Closed",
  );

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
    setAt(localDateTime());
    setPlace("");
    setNote("");
  }, [open, propTicketId, propLeadId]);

  const activeTicket = db.assignments.find((t) => t.id === selectedTicketId);
  const activeLead = activeTicket
    ? db.leads.find((l) => l.id === activeTicket.leadId) ??
      activeTicket.leadSnapshot
    : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;

    if (!place) {
      alert("Vui lòng chọn văn phòng hẹn.");
      return;
    }

    if (!activeTicket.acceptedAt && activeTicket.assigneeId === actor.id) {
      await run({ type: "accept", id: activeTicket.id }, "Đã nhận việc.");
    }

    // Default placeholder attachment for quick appointment creation if needed
    const attachments: Attachment[] = [
      {
        path: `${actor.id}/${activeTicket.id}/${crypto.randomUUID()}.png`,
        name: "hen_lich.png",
        type: "image/png",
        size: 1024,
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      },
    ];

    const input: ActivityInput = {
      channel: "call",
      direction: "outbound",
      at: localDateTime(),
      outcome: "called",
      decision: "agreed",
      reason: "none",
      note: note.trim() || `Tạo lịch hẹn đến ${place} vào lúc ${at}`,
      appointmentAt: at,
      place,
      ticketStatus: "Open",
      attachments,
    };

    const ok = await run(
      {
        type: "activity",
        assignmentId: activeTicket.id,
        input,
      },
      "Đã tạo lịch hẹn thành công.",
    );

    if (ok) {
      onOpenChange(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="text-primary" size={20} />
            Tạo lịch hẹn tài xế
          </DialogTitle>
          <DialogDescription>
            Đặt lịch hẹn tài xế đến văn phòng hỗ trợ làm thủ tục đăng ký.
          </DialogDescription>
        </DialogHeader>

        <form className="stack-form" onSubmit={handleSubmit}>
          {!propTicketId && myTickets.length > 1 && (
            <Field label="Chọn tài xế / Phiếu *">
              <select
                required
                value={selectedTicketId}
                onChange={(e) => setSelectedTicketId(e.target.value)}
              >
                {myTickets.map((t) => {
                  const l =
                    db.leads.find((x) => x.id === t.leadId) ?? t.leadSnapshot;
                  return (
                    <option key={t.id} value={t.id}>
                      {l?.name ?? "Lead"} — {l?.phone ?? "—"} ({ticketCode(t)})
                    </option>
                  );
                })}
              </select>
            </Field>
          )}

          {activeLead && (
            <div
              style={{
                background: "var(--bg-subtle, #f8f9fa)",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
              }}
            >
              <strong>{activeLead.name}</strong> ({activeLead.phone}) ·{" "}
              {activeLead.city}
            </div>
          )}

          <Field label="Ngày giờ hẹn *">
            <Input
              type="datetime-local"
              required
              value={at}
              onChange={(e) => setAt(e.target.value)}
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

          <Field label="Ghi chú lịch hẹn">
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Tài xế mang theo CCCD và giấy đăng ký xe..."
            />
          </Field>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 12,
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
              disabled={busy || !activeTicket || !place || !at}
            >
              {busy ? "Đang lưu…" : "Xác nhận tạo lịch hẹn"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
