import { useState } from "react";
import { supabase } from "./backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./shared";
export function PasswordRecovery() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="auth-brand">Lead Sale</span>
        <h1>Đặt mật khẩu mới</h1>
        <p>Liên kết khôi phục đã xác thực tài khoản của bạn.</p>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (password !== confirmation) {
              setError("Hai mật khẩu chưa khớp.");
              return;
            }
            setBusy(true);
            try {
              const result = await supabase!.auth.updateUser({ password });
              if (result.error) throw result.error;
              sessionStorage.removeItem("lead-sale.recovering");
              window.history.replaceState(null, "", window.location.pathname);
              await supabase!.auth.signOut();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Mật khẩu mới">
            <Input
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Nhập lại mật khẩu mới">
            <Input
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Field>
          <p>
            Tối thiểu 10 ký tự. Sau khi lưu, đăng nhập lại bằng mật khẩu mới.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu mật khẩu mới"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void supabase!.auth.signOut()}
          >
            Hủy và đăng xuất
          </Button>
        </form>
      </section>
    </main>
  );
}
