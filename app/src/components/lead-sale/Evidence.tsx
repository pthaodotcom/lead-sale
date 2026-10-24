import { useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadEvidence, evidenceUrl } from "./backend";
import { useWorkspace } from "./context";
import type { Activity, Attachment, Outcome } from "./types";
export function Evidence({
  activity,
}: {
  activity: Activity;
  ticketId: string;
  editable: boolean;
}) {
  const [media, setMedia] = useState<{ url: string; type: string }>();
  const [error, setError] = useState("");
  return (
    <div className="evidence-list">
      {activity.attachments?.map((a) => (
        <Button
          key={a.path}
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              setError("");
              setMedia({
                url: a.dataUrl ?? (await evidenceUrl(a.path)),
                type: a.type,
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {a.name}
        </Button>
      ))}
      {error && <p role="alert">{error}</p>}
      {media &&
        (media.type.startsWith("audio/") ? (
          <audio controls src={media.url} />
        ) : media.type.startsWith("image/") ? (
          <a href={media.url} target="_blank" rel="noreferrer">
            <img
              className="evidence-image"
              src={media.url}
              alt="Bằng chứng liên hệ"
            />
          </a>
        ) : (
          <a href={media.url} target="_blank" rel="noreferrer">
            Mở tệp bằng chứng
          </a>
        ))}
    </div>
  );
}
export function EvidenceUpload({
  ticketId,
  channel,
  outcome,
  value,
  onChange,
  onBusy,
}: {
  ticketId: string;
  channel: "call" | "zalo";
  outcome: Outcome;
  value: Attachment[];
  onChange: (v: Attachment[]) => void;
  onBusy: (b: boolean) => void;
}) {
  const { actor } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const image =
    channel === "zalo" || ["no_answer", "wrong_phone"].includes(outcome);
  return (
    <div className="evidence-upload">
      <label>
        {image ? "Ảnh chat / nhật ký cuộc gọi *" : "Ghi âm cuộc gọi *"}
        <input
          aria-label="Bằng chứng liên hệ"
          disabled={busy}
          type="file"
          accept={
            image
              ? "image/jpeg,image/png,image/webp"
              : "audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm"
          }
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            onBusy(true);
            setError("");
            try {
              const attachment = await uploadEvidence(file, actor.id, ticketId);
              onChange([...value, attachment]);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              onBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {busy && <p role="status">Đang tải bằng chứng…</p>}
      {error && (
        <p role="alert">
          {error} Chọn lại tệp để thử, nội dung form vẫn được giữ.
        </p>
      )}
      {value.map((a) => (
        <div className="attachment-row" key={a.path}>
          <span>{a.name}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(value.filter((x) => x.path !== a.path))}
          >
            Bỏ tệp
          </Button>
        </div>
      ))}
      <small>
        Bằng chứng được lưu cùng lần liên hệ. Tối đa 20 MB/tệp trên máy chủ; bản
        demo tối đa 3 MB.
      </small>
    </div>
  );
}
