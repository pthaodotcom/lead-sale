import { useState } from "react";
import { Link } from "react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { Empty, formatDate, PageHeading } from "./shared";
export function Notices() {
  const { db, actor, run, busy } = useWorkspace();
  const [all, setAll] = useState(false);
  const mine = db.notices
    .filter((n) => n.recipientId === actor.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const rows = mine.filter((n) => all || !n.readAt);
  return (
    <>
      <PageHeading
        title="Thông báo"
      />
      <section className="panel" style={{ maxWidth: 820 }}>
        <div className="tabs">
          <button
            className={!all ? "active" : ""}
            onClick={() => setAll(false)}
          >
            Chưa đọc{" "}
            <span className="count">
              {mine.filter((n) => !n.readAt).length}
            </span>
          </button>
          <button className={all ? "active" : ""} onClick={() => setAll(true)}>
            Tất cả <span className="count">{mine.length}</span>
          </button>
        </div>
        {rows.length ? (
          <div className="mini-list">
            {rows.map((n) => (
              <div className="mini-item" key={n.id}>
                {!n.readAt ? (
                  <span className="unread-dot" />
                ) : (
                  <span style={{ width: 8 }} />
                )}
                <div>
                  <Link
                    className="record-link"
                    to={
                      n.href ??
                      (n.id.startsWith("digest-")
                        ? "/handover"
                        : "/appointments")
                    }
                  >
                    {n.title}
                  </Link>
                  <small>{formatDate(n.at, true)}</small>
                </div>
                {!n.readAt && (
                  <Button
                    disabled={busy}
                    variant="ghost"
                    size="sm"
                    onClick={() => void run({ type: "noticeRead", id: n.id })}
                  >
                    Đánh dấu đã đọc
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={Bell}
            title={all ? "Chưa có thông báo" : "Bạn đã đọc hết thông báo"}
            description="Thông báo nhắc lịch hẹn và bàn giao sẽ hiện ở đây."
          />
        )}
      </section>
    </>
  );
}
