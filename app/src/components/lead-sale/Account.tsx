import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "./backend";
import { useWorkspace } from "./context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, Field, PageHeading, Panel } from "./shared";
import { roleLabels } from "./domain";
export function Account() {
  const { actor, cloud } = useWorkspace();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeading
        title="Tài khoản"
        description={
          <span className="person">
            <Avatar name={actor.name} size="sm" />
            {actor.name} · {roleLabels[actor.role]}
            {actor.email ? ` · ${actor.email}` : ""}
          </span>
        }
      />
      <div style={{ maxWidth: 520 }}>
        <Panel title="Đổi mật khẩu">
          {!cloud ? (
            <p className="muted" style={{ margin: 0 }}>
              Chế độ xem thử không có mật khẩu. Dùng bản kết nối Supabase để
              đăng nhập thật.
            </p>
          ) : (
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  if (password.length < 10 || password !== repeat)
                    throw new Error(
                      "Mật khẩu mới tối thiểu 10 ký tự và hai lần nhập phải khớp.",
                    );
                  const { data } = await supabase!.auth.getUser();
                  if (!data.user?.email)
                    throw new Error("Phiên đăng nhập không hợp lệ.");
                  const verified = await supabase!.auth.signInWithPassword({
                    email: data.user.email,
                    password: current,
                  });
                  if (verified.error)
                    throw new Error("Mật khẩu hiện tại không đúng.");
                  const result = await supabase!.auth.updateUser({ password });
                  if (result.error) throw result.error;
                  setPassword("");
                  setRepeat("");
                  setCurrent("");
                  toast.success("Đã đổi mật khẩu.");
                } catch (error) {
                  toast.error((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Mật khẩu hiện tại">
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </Field>
              <Field label="Mật khẩu mới">
                <Input
                  type="password"
                  minLength={10}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Nhập lại mật khẩu mới">
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                />
              </Field>
              <Button disabled={busy}>Đổi mật khẩu</Button>
            </form>
          )}
        </Panel>
      </div>
    </>
  );
}
