import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "./shared";
import { useWorkspace } from "./context";
import { ticketCode } from "./workflow";
import type { Assignment } from "./types";
import { RotateCcw } from "lucide-react";

export function ReopenTicketDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: Assignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { run, busy } = useWorkspace();
  const [reason, setReason] = useState("");

  if (!ticket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    const ok = await run(
      {
        type: "ticketStatus",
        id: ticket.id,
        status: "Open",
        reason: reason.trim(),
      },
      `Đã mở lại phiếu ${ticketCode(ticket)} thành công. Bạn có thể tiếp tục liên hệ tư vấn.`,
    );

    if (ok) {
      setReason("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw size={18} className="text-primary" />
            Mở lại phiếu phân công
          </DialogTitle>
          <DialogDescription>
            Phiếu <strong>{ticketCode(ticket)}</strong> sẽ chuyển từ trạng thái{" "}
            <strong>Đã giải quyết (Solved)</strong> sang{" "}
            <strong>Đang tư vấn (Open)</strong> để tiếp tục chăm sóc tài xế
            trong hạn 14 ngày. Lịch sử các lần liên hệ trước đó được giữ nguyên.
          </DialogDescription>
        </DialogHeader>

        <form className="stack-form" onSubmit={handleSubmit}>
          <Field label="Lý do mở lại phiếu *">
            <Textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Tài xế gọi lại bày tỏ quan tâm, tiếp tục liên hệ đợt mới..."
            />
          </Field>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={busy || !reason.trim()}
            >
              <RotateCcw size={14} className="mr-1" />
              Xác nhận mở lại
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
