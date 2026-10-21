import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "./backend";
import { useWorkspace } from "./context";
import {
  Empty,
  Field,
  formatDate,
  Guard,
  localDateTime,
  PageHeading,
} from "./shared";

const eventLabels: Record<string, string> = {
  account_created: "Tạo tài khoản",
  registration_pending: "Chờ duyệt đăng ký",
  registration_completed: "Hoàn tất đăng ký",
  order_received: "Đã nhận đơn",
  order_cancelled: "Hủy đơn",
  first_order_completed: "Hoàn thành đơn đầu",
};
const stateLabels: Record<string, string> = {
  unsent: "Chưa giao",
  received: "Đã nhận",
  processed: "Đã cập nhật",
  ignored: "Đã ghi nhận · không đổi Lead",
  waiting_link: "Chờ liên kết",
  waiting_registration: "Chờ đăng ký",
  conflict: "Xung đột cần đối soát",
  rejected: "Dữ liệu không hợp lệ",
};
interface Driver {
  id: string;
  name: string;
  phone: string;
  state: string;
  registrationState: string;
  leadId?: string;
}
interface CoreEvent {
  id: string;
  driverId: string;
  payload: { eventType: string; occurredAt: string; orderId: string };
  status: string;
  message?: string;
  receivedAt?: string;
  processedAt?: string;
  leadId?: string;
  attempts: number;
}
interface CoreData {
  drivers: Driver[];
  events: CoreEvent[];
  inbox: {
    id: string;
    payload: CoreEvent["payload"] & { externalDriverId: string };
    status: string;
    message: string;
    received_at: string;
    processed_at?: string;
    lead_id?: string;
    attempts: number;
  }[];
  attempts: {
    id: number;
    event_id: string;
    at: string;
    status: string;
    message: string;
  }[];
}
async function api(command: Record<string, unknown>) {
  if (!supabase)
    throw new Error(
      "Giả lập cần kết nối máy chủ; bản xem thử trình duyệt không có API nguồn.",
    );
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Đăng nhập lại để tiếp tục.");
  let response: Response;
  try {
    response = await fetch("/api/simulator/command", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new Error(
      "Không kết nối được dịch vụ giả lập. Kiểm tra dịch vụ rồi thử lại.",
    );
  }
  const result = await response.json().catch(() => ({
    error: "Dịch vụ giả lập chưa chạy. Khởi động dev:core rồi làm mới.",
  }));
  if (!response.ok)
    throw new Error(result.error || result.message || "Thao tác thất bại.");
  return result;
}
export function CoreSimulator({ reconcile = false }: { reconcile?: boolean }) {
  const { actor, db, cloud, refresh } = useWorkspace();
  const [data, setData] = useState<CoreData>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [leadId, setLeadId] = useState("");
  const [eventType, setEventType] = useState("registration_completed");
  const [at, setAt] = useState(localDateTime);
  const [orderId, setOrderId] = useState("");
  const [filter, setFilter] = useState("");
  const [showAttempts, setShowAttempts] = useState(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  const allowed = reconcile
    ? ["admin", "intake"].includes(actor.role)
    : actor.role === "admin";
  const load = useCallback(async () => {
    const next = (await api({ type: "snapshot" })) as CoreData;
    for (const e of next.inbox)
      if (!next.events.some((x) => x.id === e.id))
        next.events.push({
          id: e.id,
          driverId: e.payload.externalDriverId,
          payload: e.payload,
          status: e.status,
          message: e.message,
          receivedAt: e.received_at,
          processedAt: e.processed_at,
          leadId: e.lead_id,
          attempts: e.attempts,
        });
    setData(next);
    setError("");
  }, []);
  useEffect(() => {
    if (allowed && cloud)
      void load().catch((e) => setError((e as Error).message));
  }, [allowed, cloud, load]);
  const perform = async (command: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const result = await api(command);
      toast.success(result.message || "Đã lưu thao tác.");
      try {
        await load();
        await refresh();
      } catch {
        setError("Thao tác đã lưu. Chưa làm mới được dữ liệu; bấm Làm mới.");
      }
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const driver = data?.drivers.find((d) => d.id === selected);
  const rows = (data?.events ?? []).filter(
    (e) =>
      (!selected || reconcile || e.driverId === selected) &&
      (!filter || e.status === filter),
  );
  return (
    <Guard allowed={allowed}>
      <PageHeading
        title={reconcile ? "Đối soát kết quả nguồn" : "Hệ thống tài xế giả lập"}
        description={
          reconcile
            ? "Theo dõi sự kiện nhận từ nguồn mô phỏng và xử lý các bản tin đang chờ."
            : "Tạo tình huống ở hệ thống ngoài và gửi kết quả về Lead Sale."
        }
        action={
          <Button
            variant="outline"
            disabled={busy || !cloud}
            onClick={() => void perform({ type: "snapshot" })}
          >
            Làm mới
          </Button>
        }
      />
      <p className="core-simulation-note">
        <strong>Nguồn giả lập</strong> · Không kết nối ứng dụng giao hàng thật.
        Gọi điện/chat vẫn do nhân viên thực hiện và ghi nhận thủ công.
      </p>
      {!cloud && (
        <Empty
          title="Cần kết nối Supabase và API giả lập"
          description="Chức năng này dùng dữ liệu nguồn và API máy chủ riêng."
        />
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {cloud && !data && !error && (
        <p role="status">Đang tải hệ thống giả lập…</p>
      )}
      {data && (
        <>
          {!reconcile && (
            <div className="core-grid">
              <section className="form-surface stack-form">
                <h2>Tài xế ở hệ thống ngoài</h2>
                <Field label="Chọn tài xế">
                  <select
                    value={selected}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setLeadId("");
                    }}
                  >
                    <option value="">Chọn tài xế giả lập</option>
                    {data.drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.phone}
                      </option>
                    ))}
                  </select>
                </Field>
                {driver && (
                  <div className="stack-form">
                    <p>
                      {driver.id}
                      <br />
                      Đăng ký ở nguồn:{" "}
                      {eventLabels[driver.registrationState] ??
                        driver.registrationState}
                      <br />
                      Thao tác nguồn gần nhất:{" "}
                      {eventLabels[driver.state] ?? driver.state}
                    </p>
                    {driver.leadId ? (
                      <p>
                        Đã liên kết:{" "}
                        <Link to={`/leads/${driver.leadId}/show`}>
                          {db.leads.find((l) => l.id === driver.leadId)?.name ??
                            driver.leadId}
                        </Link>
                      </p>
                    ) : (
                      <form
                        className="stack-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await perform({
                            type: "link",
                            driverId: driver.id,
                            leadId,
                          });
                        }}
                      >
                        <Field label="Lead cùng SĐT được phép thử">
                          <select
                            required
                            value={leadId}
                            onChange={(e) => setLeadId(e.target.value)}
                          >
                            <option value="">Chọn Lead</option>
                            {db.leads
                              .filter(
                                (l) => !l.archived && l.phone === driver.phone,
                              )
                              .map((l) => (
                                <option value={l.id} key={l.id}>
                                  {l.name} · {l.id}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <p>
                          Liên kết này xác nhận hồ sơ được phép nhận dữ liệu giả
                          lập. Chưa có Lead thì tiếp nhận hồ sơ ở CRM trước.
                        </p>
                        <Button disabled={busy}>
                          Xác nhận liên kết để thử
                        </Button>
                      </form>
                    )}
                  </div>
                )}
                <details>
                  <summary>Tạo tài xế giả lập mới</summary>
                  <form
                    className="stack-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const key = JSON.stringify({ name, phone });
                      if (request.current?.key !== key)
                        request.current = { key, id: crypto.randomUUID() };
                      const result = await perform({
                        type: "createDriver",
                        name,
                        phone,
                        requestId: request.current.id,
                      });
                      if (result) {
                        setSelected(result.driverId);
                        setName("");
                        setPhone("");
                      }
                    }}
                  >
                    <Field label="Lấy tên và SĐT từ Lead (tùy chọn)">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const l = db.leads.find(
                            (l) => l.id === e.target.value,
                          );
                          if (l) {
                            setName(l.name);
                            setPhone(l.phone);
                          }
                        }}
                      >
                        <option value="">Chọn hồ sơ để điền thông tin</option>
                        {db.leads
                          .filter((l) => !l.archived)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name} · {l.phone}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Tên tài xế">
                      <Input
                        required
                        minLength={2}
                        maxLength={120}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                    <Field label="Số điện thoại">
                      <Input
                        required
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Field>
                    <Button disabled={busy}>Tạo dữ liệu tài xế</Button>
                  </form>
                </details>
              </section>
              <section className="form-surface">
                <h2>Tạo tình huống nghiệp vụ</h2>
                <form
                  className="stack-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const command = {
                      type: "emit",
                      driverId: selected,
                      eventType,
                      occurredAt: new Date(at).toISOString(),
                      orderId,
                    };
                    const key = JSON.stringify(command);
                    if (request.current?.key !== key)
                      request.current = { key, id: crypto.randomUUID() };
                    const result = await perform({
                      ...command,
                      requestId: request.current.id,
                    });
                    if (result) request.current = null;
                  }}
                >
                  <Field label="Thao tác ở nguồn">
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                    >
                      {Object.entries(eventLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Thời điểm thực tế">
                    <Input
                      type="datetime-local"
                      step="any"
                      required
                      value={at}
                      onChange={(e) => setAt(e.target.value)}
                    />
                  </Field>
                  {eventType.includes("order") && (
                    <Field label="Mã đơn">
                      <Input
                        required
                        maxLength={120}
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                      />
                    </Field>
                  )}
                  <p>
                    Hoàn tất đăng ký mới chuyển Activated. Chỉ đơn hoàn thành
                    sau đăng ký mới chuyển Onboarded. Mốc trước ngày tiếp nhận
                    vẫn giữ ngày thực tế.
                  </p>
                  <Button disabled={busy || !driver}>
                    {busy ? "Đang xử lý…" : "Lưu ở nguồn và gửi kết quả"}
                  </Button>
                </form>
              </section>
            </div>
          )}
          <section className="data-section core-events">
            <div className="section-header">
              <h2>Lịch sử gửi và tiếp nhận</h2>
              <span>{rows.length} bản tin</span>
            </div>
            <div className="filter-bar">
              <Field label="Kết quả xử lý">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Tất cả kết quả</option>
                  {Object.entries(stateLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {rows.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tài xế / sự kiện</th>
                      <th>Ngày thực tế / ngày nhận</th>
                      <th>Kết quả bên Lead Sale</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {data.drivers.find((d) => d.id === e.driverId)
                            ?.name ?? e.driverId}
                          <small>{eventLabels[e.payload.eventType]}</small>
                          {e.payload.orderId && (
                            <small>Đơn {e.payload.orderId}</small>
                          )}
                        </td>
                        <td>
                          {formatDate(e.payload.occurredAt, true)}
                          <small>Nhận: {formatDate(e.receivedAt, true)}</small>
                        </td>
                        <td>
                          <strong>{stateLabels[e.status] ?? e.status}</strong>
                          <small>
                            {e.message ??
                              "Bản tin đã lưu tại nguồn, chưa có kết quả nhận."}
                          </small>
                          {e.leadId && (
                            <Link to={`/leads/${e.leadId}/show`}>Xem Lead</Link>
                          )}
                          <details>
                            <summary>Chi tiết tiếp nhận</summary>
                            <p className="core-event-id">{e.id}</p>
                            <p>
                              Xử lý: {formatDate(e.processedAt, true)} ·{" "}
                              {e.attempts} lần nhận
                            </p>
                          </details>
                        </td>
                        <td>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void perform({
                                type: reconcile ? "retry" : "resend",
                                eventId: e.id,
                              })
                            }
                          >
                            {reconcile ? "Xử lý lại" : "Gửi lại cùng bản tin"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Chưa có bản tin phù hợp"
                description="Chọn tài xế và gửi một tình huống để xem kết quả tiếp nhận."
              />
            )}
          </section>
          <section className="data-section">
            <div className="section-header">
              <h2>Nhật ký xử lý</h2>
              <Button
                variant="ghost"
                onClick={() => setShowAttempts(!showAttempts)}
              >
                {showAttempts ? "Thu gọn" : "Xem các lần xử lý"}
              </Button>
            </div>
            {showAttempts && (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Thời điểm</th>
                      <th>Sự kiện</th>
                      <th>Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attempts.map((a) => (
                      <tr key={a.id}>
                        <td>{formatDate(a.at, true)}</td>
                        <td className="core-event-id">{a.event_id}</td>
                        <td>{a.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </Guard>
  );
}
