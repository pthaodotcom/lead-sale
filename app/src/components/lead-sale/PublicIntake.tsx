import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bike,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LoaderCircle,
  Truck,
} from "lucide-react";
import { demoMode } from "./backend";
import { normalizePhone } from "./domain";
import { submitIntake, type IntakeInput } from "./public-intake";
import "./lead-sale.css";
import "./public-intake.css";

const initial: IntakeInput = {
  name: "",
  phone: "",
  city: "",
  vehicle: "Motorbike",
  district: "",
  hasVehicle: "",
  callTime: "any",
  documents: { cccd: false, license: false, registration: false },
  note: "",
  consent: false,
  website: "",
};

export function PublicIntake() {
  const [input, setInput] = useState<IntakeInput>(initial);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const status = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.title;
    document.title = "Đăng ký tài xế · AhaMove";
    return () => {
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    if (sent || error) status.current?.focus();
  }, [sent, error]);
  const set = <K extends keyof IntakeInput>(key: K, value: IntakeInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError("");
    if (input.name.trim().length < 2) {
      setError("Vui lòng nhập họ và tên từ 2 ký tự.");
      return;
    }
    if (!/^0\d{9}$/.test(normalizePhone(input.phone))) {
      setError("Số điện thoại cần có 10 chữ số, bắt đầu bằng 0 hoặc dùng +84.");
      return;
    }
    if (!input.city.trim()) {
      setError("Vui lòng nhập thành phố muốn đăng ký.");
      return;
    }
    if (!input.consent) {
      setError("Bạn cần đồng ý để đội ngũ tuyển tài xế liên hệ tư vấn.");
      return;
    }
    if (input.website) {
      setError("Không thể gửi đăng ký. Vui lòng tải lại trang và thử lại.");
      return;
    }
    const payload = JSON.stringify(input);
    if (request.current?.payload !== payload)
      request.current = { payload, id: crypto.randomUUID() };
    pending.current = true;
    setBusy(true);
    try {
      await submitIntake(input, request.current!.id);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="driver-intake">
      <header className="intake-header">
        <img src="/ahamove-logo.png" alt="AhaMove" width="140" />
        <span>Đăng ký đối tác tài xế</span>
      </header>
      <main className="intake-layout">
        <aside className="intake-intro">
          <span className="intake-eyebrow">ĐỒNG HÀNH CÙNG AHAMOVE</span>
          <h1>
            Khởi đầu hành trình
            <br />
            <span>tài xế của bạn.</span>
          </h1>
          <p>
            Để lại thông tin, đội ngũ tuyển tài xế sẽ liên hệ tư vấn và hướng
            dẫn bạn hoàn tất hồ sơ đăng ký.
          </p>
          <div className="intake-steps" aria-label="Các bước đăng ký">
            <div>
              <span>
                <FileCheck2 size={21} />
              </span>
              <section>
                <h2>Điền thông tin</h2>
                <p>Chỉ mất khoảng 2 phút để đăng ký.</p>
              </section>
            </div>
            <div>
              <span>
                <Clock3 size={21} />
              </span>
              <section>
                <h2>Nhận tư vấn</h2>
                <p>Chọn khung giờ thuận tiện để được liên hệ.</p>
              </section>
            </div>
            <div>
              <span>
                <CheckCircle2 size={21} />
              </span>
              <section>
                <h2>Hoàn tất hồ sơ</h2>
                <p>Được hướng dẫn giấy tờ và các bước tiếp theo.</p>
              </section>
            </div>
          </div>
          <div className="intake-note">
            <Bike size={26} />
            <p>
              Dành cho tài xế xe máy và xe Van.
              <br />
              Bạn chưa có xe? Vẫn có thể để lại thông tin để được tư vấn.
            </p>
          </div>
        </aside>
        {sent ? (
          <div
            className="intake-card intake-success"
            ref={status}
            tabIndex={-1}
            role="status"
          >
            <span className="intake-success-icon">
              <Check size={32} />
            </span>
            <h2>
              {demoMode ? "Đã lưu đăng ký xem thử" : "Đã tiếp nhận đăng ký!"}
            </h2>
            <p>
              Cảm ơn {input.name.trim()}.{" "}
              {demoMode
                ? "Thông tin đã được lưu trong bản xem thử trên trình duyệt này."
                : "Đội ngũ tuyển tài xế sẽ liên hệ theo thông tin bạn đã cung cấp để tư vấn các bước tiếp theo."}
            </p>
            <dl>
              <div>
                <dt>Số điện thoại</dt>
                <dd>{normalizePhone(input.phone)}</dd>
              </div>
              <div>
                <dt>Khu vực đăng ký</dt>
                <dd>{input.city}</dd>
              </div>
              <div>
                <dt>Phương tiện</dt>
                <dd>{input.vehicle === "Motorbike" ? "Xe máy" : "Xe Van"}</dd>
              </div>
            </dl>
            <p className="intake-small">
              Bạn có thể đóng trang này. Không cần gửi lại đăng ký.
            </p>
          </div>
        ) : (
          <form
            className="intake-card"
            onSubmit={(event) => void submit(event)}
          >
            <div className="intake-card-heading">
              <span>THÔNG TIN ĐĂNG KÝ</span>
              <h2>Trở thành đối tác tài xế</h2>
              <p>
                Các trường có dấu <b>*</b> là bắt buộc.
              </p>
            </div>
            <fieldset disabled={busy}>
              <label htmlFor="driver-name">
                Họ và tên <b>*</b>
              </label>
              <input
                id="driver-name"
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Nhập họ và tên của bạn"
                value={input.name}
                onChange={(e) => set("name", e.target.value)}
              />
              <label htmlFor="driver-phone">
                Số điện thoại <b>*</b>
              </label>
              <input
                id="driver-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                maxLength={24}
                placeholder="Ví dụ: 0901 234 567"
                aria-describedby="driver-phone-help"
                value={input.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
              <small id="driver-phone-help">
                Số điện thoại để đội ngũ tuyển tài xế liên hệ với bạn.
              </small>
              <div className="intake-fields">
                <div>
                  <label htmlFor="driver-city">
                    Thành phố đăng ký <b>*</b>
                  </label>
                  <input
                    id="driver-city"
                    name="city"
                    autoComplete="address-level1"
                    list="driver-cities"
                    required
                    maxLength={120}
                    placeholder="Nhập hoặc chọn thành phố"
                    value={input.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                  <datalist id="driver-cities">
                    <option value="TP. Hồ Chí Minh" />
                    <option value="Hà Nội" />
                    <option value="Đà Nẵng" />
                  </datalist>
                </div>
                <div>
                  <label htmlFor="driver-district">Quận / huyện</label>
                  <input
                    id="driver-district"
                    name="district"
                    autoComplete="address-level2"
                    maxLength={120}
                    placeholder="Nơi bạn muốn hoạt động"
                    value={input.district}
                    onChange={(e) => set("district", e.target.value)}
                  />
                </div>
              </div>
              <fieldset className="intake-vehicle">
                <legend>
                  Phương tiện đăng ký <b>*</b>
                </legend>
                {(
                  [
                    ["Motorbike", "Xe máy", Bike],
                    ["Van", "Xe Van", Truck],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <label
                    key={value}
                    className={input.vehicle === value ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="vehicle"
                      value={value}
                      checked={input.vehicle === value}
                      onChange={() => set("vehicle", value)}
                    />
                    <Icon size={23} />
                    <span>{label}</span>
                    {input.vehicle === value && <CheckCircle2 size={17} />}
                  </label>
                ))}
              </fieldset>
              <div className="intake-fields">
                <div>
                  <label htmlFor="driver-has-vehicle">Bạn đã có xe chưa?</label>
                  <select
                    id="driver-has-vehicle"
                    value={input.hasVehicle}
                    onChange={(e) =>
                      set(
                        "hasVehicle",
                        e.target.value as IntakeInput["hasVehicle"],
                      )
                    }
                  >
                    <option value="">Chọn tình trạng xe</option>
                    <option value="yes">Đã có xe</option>
                    <option value="no">Chưa có xe</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="driver-call-time">
                    Khung giờ tiện nghe máy
                  </label>
                  <select
                    id="driver-call-time"
                    value={input.callTime}
                    onChange={(e) =>
                      set("callTime", e.target.value as IntakeInput["callTime"])
                    }
                  >
                    <option value="any">Bất kỳ lúc nào</option>
                    <option value="morning">Buổi sáng (8–12h)</option>
                    <option value="afternoon">Buổi chiều (13–17h)</option>
                    <option value="evening">Buổi tối (17–20h)</option>
                  </select>
                </div>
              </div>
              <fieldset className="intake-documents">
                <legend>
                  Giấy tờ bạn đang có <span>(không bắt buộc)</span>
                </legend>
                <div>
                  {(
                    [
                      ["cccd", "CCCD"],
                      ["license", "Giấy phép lái xe"],
                      ["registration", "Đăng ký xe"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={input.documents[key]}
                        onChange={(e) =>
                          set("documents", {
                            ...input.documents,
                            [key]: e.target.checked,
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <small>
                  Bạn sẽ được hướng dẫn bổ sung giấy tờ khi được tư vấn.
                </small>
              </fieldset>
              <label htmlFor="driver-note">Bạn cần tư vấn thêm điều gì?</label>
              <textarea
                id="driver-note"
                rows={3}
                maxLength={2000}
                placeholder="Ví dụ: Tôi muốn tìm hiểu thủ tục đăng ký xe Van…"
                value={input.note}
                onChange={(e) => set("note", e.target.value)}
              />
              <div className="intake-trap" aria-hidden="true">
                <label htmlFor="driver-website">Website</label>
                <input
                  id="driver-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={input.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </div>
              <label className="intake-consent">
                <input
                  type="checkbox"
                  required
                  checked={input.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                />
                <span>
                  Tôi đồng ý để AhaMove sử dụng thông tin đã cung cấp nhằm liên
                  hệ tư vấn và tiếp nhận hồ sơ đăng ký tài xế. <b>*</b>
                </span>
              </label>
            </fieldset>
            {error && (
              <div
                className="intake-error"
                role="alert"
                ref={status}
                tabIndex={-1}
              >
                {error}
              </div>
            )}
            <button className="intake-submit" disabled={busy} type="submit">
              {busy ? (
                <>
                  <LoaderCircle size={18} className="intake-spinner" />
                  Đang gửi đăng ký…
                </>
              ) : (
                <>
                  Gửi đăng ký
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <p className="intake-small">
              Thông tin này được dùng để tiếp nhận và tư vấn đăng ký tài xế.
            </p>
          </form>
        )}
      </main>
      <footer className="intake-footer">
        AhaMove · Kết nối hành trình, đồng hành cùng tài xế.
      </footer>
    </div>
  );
}
