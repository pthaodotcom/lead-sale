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
  textMatches,
  vehicleLabel,
} from "./shared";
import { expiresSoon, inGroup, visibleTickets } from "./tasks";

export function Dispatch() {
  const { db, actor, perform } = useWorkspace();
  const [picked, setPicked] = useState<string[]>([]);
  const [member, setMember] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
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
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const rows = queue.filter((l) => textMatches(q, l.name, l.phone, l.city));
  const team = db.members.filter(
    (m) =>
      m.role === "telesale" &&
      m.active &&
      (actor.role === "admin" ||
        (m.teamId ?? "default") === (actor.teamId ?? "default")),
  );
  const tickets = visibleTickets(db, actor);
  const load = (id: string) =>
    tickets.filter((t) => t.assigneeId === id && inGroup(db, t, "pending"))
      .length;
  const maxLoad = Math.max(1, ...team.map((m) => load(m.id)));
  const expiring = tickets
    .filter(expiresSoon)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const allPicked = rows.length > 0 && rows.every((l) => picked.includes(l.id));
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
    setPicked([]);
    setBusy(false);
  };
  return (
    <Guard allowed={canAssign(actor)}>
      <PageHeading
        title="Điều phối"
        description="Giao Lead mới cho chuyên viên. Chọn nhiều hồ sơ để giao một lần."
      />
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Chờ phân công</h2>
            <span>{queue.length} hồ sơ</span>
          </div>
          <div className="toolbar">
            <SearchBox
              className="grow"
              value={q}
              onChange={setQ}
              placeholder="Tìm tên, SĐT, thành phố…"
            />
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
          {rows.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="narrow">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả"
                        checked={allPicked}
                        onChange={(e) =>
                          setPicked(
                            e.target.checked ? rows.map((l) => l.id) : [],
                          )
                        }
                      />
                    </th>
                    <th>Tài xế</th>
                    <th>Thành phố / Xe</th>
                    <th>Nguồn</th>
                    <th>Tiếp nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => {
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
                            className="record-link"
                            to={`/leads/${l.id}/show`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {l.name}
                          </Link>
                          <small>{l.phone}</small>
                        </td>
                        <td>
                          {l.city}
                          <small>{vehicleLabel(l.vehicle)}</small>
                        </td>
                        <td>{sourceName(db, l.sourceId)}</td>
                        <td>
                          {formatDate(l.receivedAt)}
                          <small>
                            {Math.floor(
                              (now - Date.parse(l.receivedAt)) / 86400000,
                            )}{" "}
                            ngày chờ
                          </small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
            title="Tải của nhóm"
            aside={<span>Phiếu chưa giải quyết</span>}
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
