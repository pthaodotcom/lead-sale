import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserRoundPlus } from "lucide-react";
import { useWorkspace } from "./context";
import { Field } from "./shared";

export function AssignmentDialog({
  leadId,
  transfer = false,
}: {
  leadId?: string;
  transfer?: boolean;
}) {
  const { db, actor, run, busy } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState(leadId ?? "");
  const [member, setMember] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={transfer ? "outline" : "default"}>
          <UserRoundPlus />
          {transfer ? "Chuyển người phụ trách" : "Phân công tư vấn"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {transfer ? "Chuyển người phụ trách" : "Tạo phiếu phân công"}
          </DialogTitle>
          <DialogDescription>
            {transfer
              ? "Phiếu hiện tại sẽ đóng và tạo phiếu mới. Lịch sử tư vấn được giữ nguyên."
              : "Giao hồ sơ cho một nhân viên Telesale để bắt đầu tư vấn."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await run(
                { type: "assign", leadId: lead, assigneeId: member, transfer },
                "Đã lưu phân công tư vấn.",
              )
            )
              setOpen(false);
          }}
        >
          <Field label="Hồ sơ Lead">
            <select
              required
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              disabled={!!leadId}
            >
              <option value="">Chọn hồ sơ</option>
              {db.leads
                .filter(
                  (l) =>
                    l.status === "New" &&
                    !l.archived &&
                    (l.id === leadId ||
                      !db.assignments.some(
                        (t) => t.leadId === l.id && t.status !== "Closed",
                      )),
                )
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · {l.phone}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Nhân viên Telesale">
            <select
              required
              value={member}
              onChange={(e) => setMember(e.target.value)}
            >
              <option value="">Chọn nhân viên</option>
              {db.members
                .filter(
                  (m) =>
                    m.role === "telesale" &&
                    m.active &&
                    (actor.role === "admin" ||
                      (m.teamId ?? "default") === (actor.teamId ?? "default")),
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={async () => setOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {transfer ? "Xác nhận chuyển" : "Tạo phiếu"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
