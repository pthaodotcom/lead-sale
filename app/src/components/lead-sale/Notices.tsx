import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { Empty, formatDate, PageHeading } from "./shared";
export function Notices() {
  const { db, actor, run, busy } = useWorkspace();
  const [all, setAll] = useState(false);
  const rows = db.notices.filter(
    (n) => n.recipientId === actor.id && (all || !n.readAt),
  );
  return (
    <>
      <PageHeading
        title="Thông báo"
        description="Nhắc lịch hẹn và bàn giao trong hệ thống."
      />
      <section className="data-section">
        <div className="filter-bar">
          <label>
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />{" "}
            Hiện cả thông báo đã đọc
          </label>
        </div>
        {rows.map((n) => (
          <article className="handover-card" key={n.id}>
            <div>
              <Link
                to={
                  n.href ??
                  (n.id.startsWith("digest-") ? "/handover" : "/appointments")
                }
              >
                {n.title}
              </Link>
              <p>{formatDate(n.at, true)}</p>
            </div>
            {!n.readAt && (
              <Button
                disabled={busy}
                variant="outline"
                size="sm"
                onClick={() => void run({ type: "noticeRead", id: n.id })}
              >
                Đã đọc
              </Button>
            )}
          </article>
        ))}
        {!rows.length && <Empty title="Không có thông báo phù hợp" />}
      </section>
    </>
  );
}
