import { useState } from "react";
import { Truck } from "lucide-react";
import { supabase } from "./backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./shared";
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
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="auth-brand">
          <Truck /> Lead Sale
        </span>
        <h1>
          {!configured
            ? "Kết nối không gian làm việc"
            : signedIn
              ? "Kiểm tra không gian làm việc"
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
                const result = await supabase!.auth.signInWithPassword({
                  email,
                  password,
                });
                if (result.error) throw result.error;
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
            <Field label="Mật khẩu">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            </Button>
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
