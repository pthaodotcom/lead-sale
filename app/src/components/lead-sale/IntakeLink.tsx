import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicIntakeUrl } from "./public-intake";

export function IntakeLink() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const url = publicIntakeUrl();
  return (
    <div className="intake-share">
      <div>
        <strong>Form tài xế tự đăng ký</strong>
      </div>
      <div className="intake-share-actions">
        <Button
          variant="outline"
          size="sm"
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
          {copied ? "Đã sao chép" : "Sao chép link form"}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            Mở form
          </a>
        </Button>
      </div>
      <input
        aria-label="Đường link form tài xế"
        value={url}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
