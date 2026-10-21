import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadEvidence, evidenceUrl } from "./backend";
import { useWorkspace } from "./context";
import type { Activity } from "./types";
export function Evidence({
  activity,
  ticketId,
  editable,
}: {
  activity: Activity;
  ticketId: string;
  editable: boolean;
}) {
  const { actor, perform } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<{ url: string; type: string }>();
  return (
    <div className="evidence-list">
      {activity.attachments?.map((a) => (
        <Button
          key={a.path}
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              setMedia({ url: await evidenceUrl(a.path), type: a.type });
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          {a.name}
        </Button>
      ))}
      {media &&
        (media.type.startsWith("audio/") ? (
          <audio controls src={media.url} />
        ) : (
          <a href={media.url} target="_blank" rel="noreferrer">
            Mở tệp bằng chứng
          </a>
        ))}
      {editable && (
        <label className="file-label">
          {busy ? "Đang tải tệp…" : "Đính kèm ghi âm / ảnh chat / PDF"}
          <input
            aria-label="Đính kèm bằng chứng"
            type="file"
            disabled={busy}
            accept="audio/*,image/jpeg,image/png,image/webp,application/pdf"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                const attachment = await uploadEvidence(
                  file,
                  actor.id,
                  ticketId,
                );
                await perform({
                  type: "attachment",
                  activityId: activity.id,
                  attachment,
                });
                toast.success("Đã lưu bằng chứng.");
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      )}
    </div>
  );
}
