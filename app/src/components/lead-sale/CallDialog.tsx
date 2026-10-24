import { useState, useEffect } from "react";
import { Copy, Check, Phone, PhoneCall } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { ticketCode } from "./workflow";
import { vehicleLabel } from "./shared";

export interface CallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId?: string;
  leadId?: string;
  onStartLog?: (ticketId: string) => void;
}

export function CallDialog({
  open,
  onOpenChange,
  ticketId: propTicketId,
  leadId: propLeadId,
  onStartLog,
}: CallDialogProps) {
  const { db, actor } = useWorkspace();
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
  }, [open, propTicketId, propLeadId]);

  const activeTicket = db.assignments.find((t) => t.id === selectedTicketId);
  const activeLead = activeTicket
    ? db.leads.find((l) => l.id === activeTicket.leadId) ??
      activeTicket.leadSnapshot
    : undefined;

  const copyPhone = () => {
    if (!activeLead?.phone) return;
    navigator.clipboard.writeText(activeLead.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="text-primary" size={20} />
            Gọi khách hàng
          </DialogTitle>
          <DialogDescription>
            Bấm gọi trực tiếp qua điện thoại hoặc sao chép số để liên hệ qua app
            thoại ngoài hệ thống.
          </DialogDescription>
        </DialogHeader>

        <div className="stack-form" style={{ marginTop: 12 }}>
          {!propTicketId && myTickets.length > 1 && (
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Chọn khách hàng cần gọi:
              </label>
              <select
                value={selectedTicketId}
                onChange={(e) => setSelectedTicketId(e.target.value)}
              >
                {myTickets.map((t) => {
                  const l =
                    db.leads.find((x) => x.id === t.leadId) ?? t.leadSnapshot;
                  return (
                    <option key={t.id} value={t.id}>
                      {l?.name ?? "Lead"} — {l?.phone ?? "—"} (
                      {ticketCode(t)})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {activeLead ? (
            <div
              style={{
                background: "var(--bg-subtle, #f8f9fa)",
                borderRadius: 8,
                padding: 16,
                textAlign: "center",
              }}
            >
              <h3 style={{ fontSize: 18, margin: "0 0 4px", fontWeight: 700 }}>
                {activeLead.name}
              </h3>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  color: "var(--primary, #008060)",
                  margin: "8px 0",
                }}
              >
                {activeLead.phone}
              </div>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
                {activeLead.city} · {vehicleLabel(activeLead.vehicle ?? "Motorbike")} · Mã phiếu:{" "}
                {activeTicket ? ticketCode(activeTicket) : "—"}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  marginTop: 12,
                }}
              >
                <Button asChild size="lg" className="grow">
                  <a href={`tel:${activeLead.phone}`}>
                    <PhoneCall size={16} /> Bấm gọi ngay
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={copyPhone}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Đã chép" : "Sao chép số"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="muted text-center py-4">
              Không có phiếu phân công khả dụng để gọi.
            </p>
          )}

          <div
            style={{
              borderTop: "1px solid var(--border, #eee)",
              paddingTop: 14,
              marginTop: 10,
            }}
          >
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Sau khi kết thúc cuộc gọi, hãy ghi nhận kết quả và tải lên file
              ghi âm hoặc ảnh nhật ký cuộc gọi để hoàn tất quy trình.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!activeTicket}
              onClick={() => {
                if (activeTicket) {
                  onOpenChange(false);
                  onStartLog?.(activeTicket.id);
                }
              }}
            >
              <PhoneCall size={16} /> Ghi nhận kết quả cuộc gọi này
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
