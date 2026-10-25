import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Hourglass, Inbox, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { canAssign, isLive } from "./domain";
import { serverNow } from "./dates";
import {
  Avatar,
  Empty,
  formatDate,
  Guard,
  memberName,
  PageHeading,
  Panel,
  relativeDeadline,
  SearchBox,
  sourceName,
  TablePagination,
  textMatches,
  vehicleLabel,
} from "./shared";
import { expiresSoon, visibleTickets } from "./tasks";
import { cities, normalizeCity } from "./catalog";

const PAGE = 15;

export function Dispatch() {
  const { db, actor, perform } = useWorkspace();
  const [picked, setPicked] = useState<string[]>([]);
  const [member, setMember] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [city, setCity] = useState("");
  const [direction, setDirection] = useState(1);
  const [result, setResult] = useState("");
  const [page, setPage] = useState(1);
  const now = serverNow().getTime();
  const queue = db.leads
    .filter(
      (l) =>
        l.status === "New" &&
        !l.archived &&
        !db.reviews.some((r) => r.leadId === l.id && !r.reviewedAt) &&
        !["follow_up", "closed"].includes(
          db.reviews
            .filter((r) => r.leadId === l.id)
            .sort((a, b) =>
              (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""),
            )[0]?.result ?? "",
        ) &&
        !db.assignments.some(
          (t) =>
            t.leadId === l.id && isLive(t) && Date.parse(t.expiresAt) > now,
        ),
    )
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) * direction);
  const rows = queue.filter(
    (l) =>
      (!city || normalizeCity(l.city) === city) &&
      textMatches(q, l.id, l.name, l.phone, l.city),
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages);
  const paginatedRows = rows.slice((current - 1) * PAGE, current * PAGE);
  const team = db.members.filter(
    (m) =>
      m.role === "telesale" &&
      m.active &&
      (actor.role === "admin" ||
        (m.teamId ?? "default") === (actor.teamId ?? "default")),
  );
  const tickets = visibleTickets(db, actor);
  const load = (id: string) =>
    db.assignments.filter((t) => t.assigneeId === id && t.status !== "Closed")
      .length;
  const maxLoad = Math.max(1, ...team.map((m) => load(m.id)));
  const expiring = tickets
    .filter(expiresSoon)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const allPickedPage =
    paginatedRows.length > 0 &&
    paginatedRows.every((l) => picked.includes(l.id));
  const assign = async () => {
    setBusy(true);
    let ok = 0;
    for (const leadId of picked) {
      try {
        await perform({ type: "assign", leadId, assigneeId: member });
        ok++;
      } catch (e) {
        toast.error(
          `${db.leads.find((l) => l.id === leadId)?.name}: ${(e as Error).message}`,
        );
      }
    }
    if (ok) toast.success(`Đã tạo ${ok} phiếu cho ${memberName(db, member)}.`);
    setResult(
      `Đã giao ${ok}/${picked.length} hồ sơ cho ${memberName(db, member)}` +
        (ok < picked.length
          ? `; ${picked.length - ok} hồ sơ lỗi, xem thông báo.`
          : "."),
    );
    setPicked([]);
    setBusy(false);
  };
  return (
    <Guard allowed={canAssign(actor)}>
      <PageHeading
        title="Điều phối"
        
      />
      <div className="dispatch-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Chờ phân công</h2>
            <span>{queue.length} hồ sơ</span>
          </div>
          <div className="toolbar">
            <SearchBox
              className="grow"
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="Tìm mã, tên, SĐT…"
            />
            <select
              aria-label="Lọc thành phố điều phối"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Mọi thành phố</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Chuyên viên nhận"
              value={member}
              onChange={(e) => setMember(e.target.value)}
            >
              <option value="">Chọn chuyên viên…</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {load(m.id)} phiếu
                </option>
              ))}
            </select>
            <Button
              disabled={!picked.length || !member || busy}
              onClick={() => void assign()}
            >
              <Send />
              {busy
                ? "Đang giao…"
                : picked.length
                  ? `Giao ${picked.length} hồ sơ`
                  : "Giao việc"}
            </Button>
          </div>
          {result && (
            <p className="callout ok" role="status" style={{ margin: 12 }}>
              {result}
            </p>
          )}
          {rows.length ? (
            <>
              <div className="table-scroll">
                <table className="data-table dispatch-table">
                  <thead>
                    <tr>
                      <th className="narrow">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả trên trang này"
                          checked={allPickedPage}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPicked((prev) =>
                                Array.from(
                                  new Set([
                                    ...prev,
                                    ...paginatedRows.map((l) => l.id),
                                  ]),
                                ),
                              );
                            } else {
                              setPicked((prev) =>
                                prev.filter(
                                  (id) =>
                                    !paginatedRows.some((l) => l.id === id),
                                ),
                              );
                            }
                          }}
                        />
                      </th>
                      <th>Mã hồ sơ</th>
                      <th>Họ tên</th>
                      <th>SĐT</th>
                      <th>Thành phố</th>
                      <th>Phương tiện</th>
                      <th>Nguồn</th>
                      <th
                        aria-sort={direction === 1 ? "ascending" : "descending"}
                      >
                        <button
                          className="sort-heading"
                          onClick={() => {
                            setDirection(-direction);
                            setPage(1);
                          }}
                        >
                          Thời gian tiếp nhận {direction === 1 ? "↑" : "↓"}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((l) => {
                      const on = picked.includes(l.id);
                      return (
                        <tr
                          key={l.id}
                          className={`clickable ${on ? "selected" : ""}`}
                          onClick={() =>
                            setPicked((p) =>
                              on ? p.filter((x) => x !== l.id) : [...p, l.id],
                            )
                          }
                        >
                          <td className="narrow">
                            <input
                              type="checkbox"
                              aria-label={`Chọn ${l.name}`}
                              checked={on}
                              readOnly
                            />
                          </td>
                          <td>
                            <Link
                              className="record-link nowrap font-mono text-xs"
                              to={`/leads/${l.id}/show`}
                              onClick={(e) => e.stopPropagation()}
                              title={l.id}
                            >
                              {`LEAD-${l.id.replace(/^lead-?/i, "").slice(0, 8).toUpperCase()}`}
                            </Link>
                          </td>
                          <td>{l.name}</td>
                          <td>{l.phone}</td>
                          <td>{normalizeCity(l.city)}</td>
                          <td>{vehicleLabel(l.vehicle)}</td>
                          <td>{sourceName(db, l.sourceId)}</td>
                          <td>{formatDate(l.receivedAt, true)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                current={current}
                total={rows.length}
                pageSize={PAGE}
                onPageChange={setPage}
                unit="hồ sơ"
                extraLeft={
                  picked.length > 0 ? (
                    <span style={{ fontSize: "12px", color: "var(--brand, #ea580c)" }}>
                      Đã chọn <strong>{picked.length}</strong> hồ sơ
                    </span>
                  ) : undefined
                }
              />
            </>
          ) : (
            <Empty
              icon={Inbox}
              title="Đã giao hết hàng chờ"
              description="Lead mới tiếp nhận sẽ xuất hiện ở đây."
            />
          )}
        </section>
        <div className="col">
          <Panel
            title="Số phiếu đã phân công còn tồn"
            aside={<span>Tồn hiện tại</span>}
            bodyless
          >
            <div className="workload">
              {team.map((m) => (
                <div className="workload-row" key={m.id}>
                  <Avatar name={m.name} size="sm" />
                  <div>
                    <strong>{m.name}</strong>
                    <div className="bar thin">
                      <span
                        style={{ width: `${(load(m.id) / maxLoad) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="num">{load(m.id)}</span>
                </div>
              ))}
              {!team.length && (
                <p className="muted">Nhóm chưa có chuyên viên hoạt động.</p>
              )}
            </div>
          </Panel>
          <Panel
            title="Sắp hết hạn"
            aside={<span>{expiring.length} phiếu</span>}
            bodyless
          >
            {expiring.length ? (
              <div className="mini-list">
                {expiring.slice(0, 6).map((t) => (
                  <Link className="mini-item" to={`/tasks/${t.id}`} key={t.id}>
                    <Hourglass size={16} className="warning-text" />
                    <div>
                      <strong>
                        {db.leads.find((l) => l.id === t.leadId)?.name}
                      </strong>
                      <small>
                        {memberName(db, t.assigneeId)} ·{" "}
                        {relativeDeadline(t.expiresAt)}
                      </small>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ padding: 16, margin: 0 }}>
                Không có phiếu sắp hết hạn.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </Guard>
  );
}
