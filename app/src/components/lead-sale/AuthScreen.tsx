import { useEffect, useState } from "react";
import { supabase } from "./backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./shared";

type TestAccount = {
  email: string;
  password: string;
  role: string;
};

const testRoleNames: Record<string, string> = {
  admin: "Quản trị",
  intake: "Tiếp nhận",
  leader: "Trưởng nhóm",
  telesale: "Telesale",
  telesale2: "Telesale 2",
  viewer: "Xem báo cáo",
};

const defaultTestAccounts: TestAccount[] = [
  { role: "admin", email: "admin@lead-sale.local", password: "123456" },
  { role: "intake", email: "tiepnhan@lead-sale.local", password: "123456" },
  { role: "leader", email: "truongnhom@lead-sale.local", password: "123456" },
  { role: "telesale", email: "telesale1@lead-sale.local", password: "123456" },
  { role: "telesale2", email: "telesale2@lead-sale.local", password: "123456" },
  { role: "viewer", email: "baocao@lead-sale.local", password: "123456" },
];

export function AuthScreen({
  configured,
  signedIn,
  error,
  onRetry,
}: {
  configured: boolean;
  signedIn: boolean;
  error: string;
  onRetry: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(error);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>(defaultTestAccounts);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const controller = new AbortController();
    void fetch("/__lead/test-accounts", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const accounts = await response.json();
        if (!controller.signal.aborted && Array.isArray(accounts))
          setTestAccounts(accounts);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="auth-brand">
          <img src="/ahamove-logo.png" alt="AhaMove" width={120} height={68} />
          <span>Lead Sale</span>
        </span>
        <h1>
          {!configured
            ? "Kết nối không gian làm việc"
            : signedIn
              ? "Kiểm tra không gian làm việc"
              : forgot
                ? "Khôi phục mật khẩu"
                : "Đăng nhập"}
        </h1>
        <p>Quản lý tiếp nhận và tư vấn tuyển tài xế.</p>
        {!configured ? (
          <p>
            Thiết lập VITE_SUPABASE_URL và VITE_SB_PUBLISHABLE_KEY theo hướng
            dẫn chạy. Chế độ xem thử được mở riêng bằng npm run dev:demo.
          </p>
        ) : signedIn ? (
          <>
            <p role="alert">{error}</p>
            <Button
              onClick={async () => {
                try {
                  await onRetry();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Kiểm tra lại quyền
            </Button>
            <Button
              variant="outline"
              onClick={() => void supabase?.auth.signOut()}
            >
              Đăng xuất
            </Button>
          </>
        ) : (
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const result = forgot
                  ? await supabase!.auth.resetPasswordForEmail(email, {
                      redirectTo: window.location.origin + "/",
                    })
                  : await supabase!.auth.signInWithPassword({
                      email,
                      password,
                    });
                if (result.error) throw result.error;
                if (forgot) setSent(true);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {!forgot && (
              <Field label="Mật khẩu">
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            {sent && (
              <p role="status">
                Nếu email đã có tài khoản và nhận được thư, hãy mở liên kết khôi
                phục. Kiểm tra cả thư rác.
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy
                ? "Đang xử lý…"
                : forgot
                  ? "Gửi liên kết khôi phục"
                  : "Đăng nhập"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setForgot(!forgot);
                setMessage("");
                setSent(false);
              }}
            >
              {forgot ? "Quay lại đăng nhập" : "Quên mật khẩu"}
            </Button>
            {!forgot && testAccounts.length > 0 && (
              <details className="auth-test-accounts" open>
                <summary>Tài khoản dùng thử</summary>
                <p>Chọn tài khoản để điền sẵn email và mật khẩu.</p>
                <div className="auth-test-list">
                  {testAccounts.map((account) => (
                    <Button
                      key={account.email}
                      type="button"
                      variant="outline"
                      className="auth-test-account"
                      disabled={busy}
                      aria-pressed={email === account.email}
                      onClick={() => {
                        setEmail(account.email);
                        setPassword(account.password);
                        setMessage("");
                      }}
                    >
                      <strong>{testRoleNames[account.role] ?? account.role}</strong>
                      <span>{account.email}</span>
                    </Button>
                  ))}
                </div>
              </details>
            )}
          </form>
        )}
        {message && (
          <p role="alert" className="form-error">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
