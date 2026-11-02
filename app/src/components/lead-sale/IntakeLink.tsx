import { useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicIntakeUrl } from "./public-intake";

export function IntakeLink() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [showLink, setShowLink] = useState(false);
  const url = publicIntakeUrl();
  return (
    <div className="intake-share">
      <div className="intake-share-title">
        <Link2 size={20} aria-hidden />
        <span>
          <strong>Form tài xế tự đăng ký</strong>
          <small>Chia sẻ để tài xế gửi hồ sơ</small>
        </span>
      </div>
      <div className="intake-share-actions">
        <Button
          variant="outline"
          size="sm"
          aria-label={copied ? "Đã sao chép link form" : "Sao chép link form"}
          onClick={() => {
            if (!navigator.clipboard) {
              setError("Bạn có thể chọn và sao chép đường link bên dưới.");
              return;
            }
            void navigator.clipboard.writeText(url).then(
              () => {
                setCopied(true);
                setError("");
              },
              () => {
                setError(
                  "Chưa sao chép được. Bạn có thể chọn và sao chép đường link bên dưới.",
                );
              },
            );
          }}
        >
          {copied ? <Check /> : <Copy />}
          <span className="share-copy-label">
            {copied ? "Đã sao chép" : "Sao chép link form"}
          </span>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            Mở form
          </a>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showLink || !!error}
          aria-controls="intake-share-url"
          onClick={() => setShowLink(!showLink)}
        >
          Xem link <ChevronDown size={14} />
        </Button>
      </div>
      <input
        id="intake-share-url"
        hidden={!showLink && !error}
        aria-label="Đường link form tài xế"
        value={url}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
