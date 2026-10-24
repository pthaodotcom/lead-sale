import { useState, type ReactNode } from "react";
import { NavLink, useParams } from "react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "./context";
import { roleLabels, leadLabels } from "./domain";
import { registerMember, supabase } from "./backend";
import {
  Avatar,
  Badge,
  Chip,
  Empty,
  Field,
  formatDate,
  Guard,
  memberName,
  RowMenu,
  SearchBox,
  textMatches,
} from "./shared";
import type { Database, Member, Role, Source } from "./types";

const teamsOf = (db: Database) =>
  db.teams?.length ? db.teams : [{ id: "default", name: "Nhóm tuyển tài xế" }];

/** Modal form used for every create/edit action on this page. */
function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Lưu",
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  onSubmit: () => Promise<boolean>;
  children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              if (await onSubmit()) onOpenChange(false);
            } finally {
              setSaving(false);
            }
          }}
        >
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="settings-head">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

/* ---------- Users ---------- */

function MemberDialog({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const { db, run } = useWorkspace();
  const [role, setRole] = useState<Role>(member.role);
  const [teamId, setTeamId] = useState(member.teamId ?? "default");
  const [active, setActive] = useState(member.active);
  const [name, setName] = useState(member.name);
  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Sửa người dùng · ${member.name}`}
      description={member.email}
      onSubmit={async () => {
        if (
          name.trim() !== member.name &&
          !(await run(
            {
              type: "memberProfile",
              id: member.id,
              name,
              email: member.email ?? "",
            },
            "Đã cập nhật tên hiển thị.",
          ))
        )
          return false;
        return run(
          {
            type: "member",
            id: member.id,
            role,
            active,
            ...(teamId !== (member.teamId ?? "default") ? { teamId } : {}),
          },
          "Đã cập nhật người dùng.",
        );
      }}
    >
      <Field label="Họ tên hiển thị">
        <input
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Vai trò">
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {Object.entries(roleLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Nhóm"
        hint="Trưởng nhóm và Telesale chỉ thao tác trong nhóm của mình."
      >
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {teamsOf(db).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Trạng thái tài khoản">
        <select
          value={active ? "1" : "0"}
          onChange={(e) => setActive(e.target.value === "1")}
        >
          <option value="1">Hoạt động</option>
          <option value="0">Tạm ngưng — chặn đăng nhập và mọi thao tác</option>
        </select>
      </Field>
    </FormDialog>
  );
}

function CreateMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { refresh } = useWorkspace();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Thêm người dùng"
      description="Tài khoản mới ở trạng thái tạm ngưng, chưa có vai trò. Sau khi tạo, chọn Sửa để gán vai trò, nhóm và kích hoạt."
      submitLabel="Tạo tài khoản"
      onSubmit={async () => {
        try {
          await registerMember(email, password, name);
          await refresh();
          toast.success(`Đã tạo tài khoản ${email}.`);
          setName("");
          setEmail("");
          setPassword("");
          return true;
        } catch (e) {
          toast.error((e as Error).message);
          return false;
        }
      }}
    >
      <Field label="Họ tên">
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Email đăng nhập">
        <Input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Mật khẩu ban đầu" hint="Tối thiểu 10 ký tự.">
        <Input
          required
          type="password"
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
    </FormDialog>
  );
}

function Users() {
  const { db, actor, cloud } = useWorkspace();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState("");
  const [editing, setEditing] = useState<Member>();
  const [creating, setCreating] = useState(false);
  const teamName = (id?: string) =>
    teamsOf(db).find((t) => t.id === (id ?? "default"))?.name ?? "—";
  const rows = db.members.filter(
    (m) =>
      (!role || m.role === role) &&
      (!state || String(m.active) === state) &&
      textMatches(q, m.name, m.email ?? ""),
  );
  return (
    <>
      <SectionHead
        title="Người dùng"
        description="Tài khoản nhân viên, vai trò và nhóm. Không xóa tài khoản — tạm ngưng để giữ lịch sử."
        action={
          <Button
            disabled={!cloud}
            title={cloud ? undefined : "Bản xem thử không tạo tài khoản thật"}
            onClick={() => setCreating(true)}
          >
            <Plus /> Thêm người dùng
          </Button>
        }
      />
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            className="grow"
            value={q}
            onChange={setQ}
            placeholder="Tìm theo tên hoặc email…"
          />
          <select
            aria-label="Lọc vai trò"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Mọi vai trò</option>
            {Object.entries(roleLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc trạng thái"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">Mọi trạng thái</option>
            <option value="true">Hoạt động</option>
            <option value="false">Tạm ngưng</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Vai trò</th>
                <th>Nhóm</th>
                <th>Trạng thái</th>
                <th className="narrow" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="person">
                      <Avatar name={m.name} size="sm" />
                      <span>
                        <strong>{m.name}</strong>
                        {m.id === actor.id && (
                          <span className="muted"> (bạn)</span>
                        )}
                        <small>{m.email ?? m.id}</small>
                      </span>
                    </span>
                  </td>
                  <td>{roleLabels[m.role]}</td>
                  <td>
                    {["leader", "telesale"].includes(m.role)
                      ? teamName(m.teamId)
                      : "Toàn hệ thống"}
                  </td>
                  <td>
                    <Chip tone={m.active ? "solved" : "closed"}>
                      {m.active ? "Hoạt động" : "Tạm ngưng"}
                    </Chip>
                  </td>
                  <td className="narrow">
                    {m.id !== actor.id && (
                      <RowMenu
                        label={m.name}
                        items={[
                          {
                            label: "Sửa thông tin, vai trò, nhóm, khóa…",
                            onSelect: () => setEditing(m),
                          },
                          ...(cloud && m.email
                            ? [
                                {
                                  label: "Gửi liên kết đặt lại mật khẩu",
                                  onSelect: () => void resetPassword(m.email!),
                                },
                              ]
                            : []),
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty title="Không có người dùng phù hợp" />}
        <div className="table-foot">
          <span>
            {rows.length} / {db.members.length} tài khoản
          </span>
        </div>
      </section>
      {editing && (
        <MemberDialog member={editing} onClose={() => setEditing(undefined)} />
      )}
      <CreateMemberDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

/* ---------- Teams ---------- */

function Teams() {
  const { db, run } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const teams = teamsOf(db);
  return (
    <>
      <SectionHead
        title="Nhóm Telesale"
        description="Trưởng nhóm chỉ phân công và xem phiếu trong nhóm của mình."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Thêm nhóm
          </Button>
        }
      />
      <section className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên nhóm</th>
                <th>Trưởng nhóm</th>
                <th className="end">Telesale</th>
                <th className="end">Phiếu đang mở</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const members = db.members.filter(
                  (m) => (m.teamId ?? "default") === t.id,
                );
                return (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                    </td>
                    <td>
                      {members
                        .filter((m) => m.role === "leader")
                        .map((m) => m.name)
                        .join(", ") || "—"}
                    </td>
                    <td className="end">
                      {members.filter((m) => m.role === "telesale").length}
                    </td>
                    <td className="end">
                      {
                        db.assignments.filter(
                          (a) =>
                            (a.teamId ?? "default") === t.id &&
                            a.status !== "Closed",
                        ).length
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!teams.length && <Empty title="Chưa có nhóm" />}
      </section>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Thêm nhóm"
        submitLabel="Tạo nhóm"
        onSubmit={async () => {
          const ok = await run({ type: "team", name }, "Đã tạo nhóm.");
          if (ok) setName("");
          return ok;
        }}
      >
        <Field label="Tên nhóm">
          <Input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Telesale Hà Nội"
          />
        </Field>
      </FormDialog>
    </>
  );
}

/* ---------- Sources ---------- */

function Sources() {
  const { db, run } = useWorkspace();
  const [dialog, setDialog] = useState<{ source?: Source } | null>(null);
  const [name, setName] = useState("");
  const openDialog = (source?: Source) => {
    setName(source?.name ?? "");
    setDialog({ source });
  };
  return (
    <>
      <SectionHead
        title="Nguồn Lead"
        description="Kênh tài xế để lại thông tin. Nguồn tạm ngưng không chọn được khi tiếp nhận mới; hồ sơ cũ giữ nguyên."
        action={
          <Button onClick={() => openDialog()}>
            <Plus /> Thêm nguồn
          </Button>
        }
      />
      <section className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên nguồn</th>
                <th>Mã</th>
                <th className="end">Hồ sơ</th>
                <th>Trạng thái</th>
                <th className="narrow" />
              </tr>
            </thead>
            <tbody>
              {db.sources.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td className="muted">{s.id}</td>
                  <td className="end">
                    {db.leads.filter((l) => l.sourceId === s.id).length}
                  </td>
                  <td>
                    <Chip tone={s.active ? "solved" : "closed"}>
                      {s.active ? "Đang dùng" : "Tạm ngưng"}
                    </Chip>
                  </td>
                  <td className="narrow">
                    <RowMenu
                      label={s.name}
                      items={[
                        { label: "Đổi tên…", onSelect: () => openDialog(s) },
                        {
                          label: s.active ? "Tạm ngưng" : "Dùng lại",
                          danger: s.active,
                          onSelect: () =>
                            void run(
                              {
                                type: "source",
                                id: s.id,
                                name: s.name,
                                active: !s.active,
                              },
                              s.active
                                ? `Đã tạm ngưng nguồn ${s.name}.`
                                : `Đã dùng lại nguồn ${s.name}.`,
                            ),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <FormDialog
        open={!!dialog}
        onOpenChange={(v) => !v && setDialog(null)}
        title={dialog?.source ? "Đổi tên nguồn" : "Thêm nguồn Lead"}
        submitLabel={dialog?.source ? "Lưu" : "Thêm nguồn"}
        onSubmit={() =>
          run(
            dialog?.source
              ? {
                  type: "source",
                  id: dialog.source.id,
                  name,
                  active: dialog.source.active,
                }
              : { type: "source", name },
            dialog?.source ? "Đã đổi tên nguồn." : "Đã thêm nguồn.",
          )
        }
      >
        <Field label="Tên nguồn">
          <Input
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: TikTok"
          />
        </Field>
      </FormDialog>
    </>
  );
}

/* ---------- Lead statuses ---------- */

const statusMeaning: Record<string, string> = {
  New: "Còn khả năng lên đăng ký",
  Activated: "Đã hoàn tất đăng ký",
  Onboarded: "Đã chạy được đơn đầu tiên",
  Closed: "Không còn nhu cầu hoặc sai số điện thoại",
};

function Statuses() {
  const { db, run } = useWorkspace();
  const [code, setCode] = useState<keyof typeof leadLabels>();
  const [label, setLabel] = useState("");
  return (
    <>
      <SectionHead
        title="Trạng thái Lead"
        description="Mã và luồng chuyển trạng thái cố định theo quy trình; chỉ đổi được tên hiển thị."
      />
      <section className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên hiển thị</th>
                <th>Ý nghĩa</th>
                <th className="end">Hồ sơ</th>
                <th className="narrow" />
              </tr>
            </thead>
            <tbody>
              {(Object.keys(leadLabels) as (keyof typeof leadLabels)[]).map(
                (k) => (
                  <tr key={k}>
                    <td className="muted">{k}</td>
                    <td>
                      <Badge status={k} />
                    </td>
                    <td className="muted">{statusMeaning[k]}</td>
                    <td className="end">
                      {db.leads.filter((l) => l.status === k).length}
                    </td>
                    <td className="narrow">
                      <RowMenu
                        label={k}
                        items={[
                          {
                            label: "Đổi tên hiển thị…",
                            onSelect: () => {
                              setCode(k);
                              setLabel(leadLabels[k]);
                            },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
      <FormDialog
        open={!!code}
        onOpenChange={(v) => !v && setCode(undefined)}
        title={`Đổi tên trạng thái ${code ?? ""}`}
        onSubmit={() =>
          run(
            { type: "statusLabel", code: code!, label },
            "Đã đổi tên trạng thái.",
          )
        }
      >
        <Field label="Tên hiển thị">
          <Input
            required
            maxLength={120}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
      </FormDialog>
    </>
  );
}

/* ---------- Audit ---------- */

const PAGE = 50;
function Audit() {
  const { db } = useWorkspace();
  const [q, setQ] = useState("");
  const [who, setWho] = useState("");
  const [page, setPage] = useState(1);
  const rows = db.audit
    .filter(
      (a) =>
        (!who || a.actorId === who) &&
        textMatches(q, a.action, a.target, a.detail),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages);
  return (
    <>
      <SectionHead
        title="Nhật ký thao tác"
        description="Mọi thay đổi dữ liệu nghiệp vụ, kèm người và thời điểm thực hiện. Không sửa, không xóa."
      />
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            className="grow"
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Tìm hành động, mã đối tượng, nội dung…"
          />
          <select
            aria-label="Lọc người thao tác"
            value={who}
            onChange={(e) => {
              setWho(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Mọi người thao tác</option>
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người thao tác</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((cur - 1) * PAGE, cur * PAGE).map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{formatDate(a.at, true)}</td>
                    <td>{memberName(db, a.actorId)}</td>
                    <td>{a.action}</td>
                    <td className="muted">{a.target}</td>
                    <td className="audit-detail">
                      <details>
                        <summary>Xem</summary>
                        <pre>{a.detail}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Không có bản ghi phù hợp" />
        )}
        <div className="table-foot">
          <span>{rows.length} bản ghi</span>
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={cur === 1}
              onClick={() => setPage(cur - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={cur >= pages}
              onClick={() => setPage(cur + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

async function resetPassword(email: string) {
  try {
    if (!supabase) throw new Error("Chưa kết nối Supabase.");
    const gate = await supabase.rpc("lead_admin_check");
    if (gate.error) throw gate.error;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
    toast.success("Đã gửi liên kết đặt lại mật khẩu tới email người dùng.");
  } catch (e) {
    toast.error((e as Error).message);
  }
}

const matrix = [
  ["Tài khoản & phân quyền", "Quản lý", "—", "—", "—"],
  [
    "Hồ sơ Lead",
    "—",
    "Tiếp nhận / cập nhật",
    "Xem trong nhóm",
    "Xem hồ sơ đang phụ trách",
  ],
  ["Phân công / chuyển / đóng phiếu", "—", "—", "Trong nhóm", "—"],
  [
    "Ghi nhận liên hệ & bằng chứng",
    "—",
    "—",
    "Xem trong nhóm",
    "Phiếu của mình",
  ],
  [
    "Lịch hẹn",
    "—",
    "Đối soát kết quả",
    "Xem nhóm",
    "Đặt / đổi / hủy lịch của mình",
  ],
  ["Bàn giao Closed", "—", "Rà soát, cập nhật hồ sơ", "Giám sát nhóm", "—"],
  [
    "Báo cáo",
    "—",
    "Nguồn tiếp nhận",
    "Hiệu suất / chuyển đổi",
    "Chỉ tổng quan cá nhân",
  ],
];

function Roles() {
  return (
    <>
      <SectionHead
        title="Vai trò & phân quyền"
        description="Quyền chuẩn theo vai trò, áp dụng tại máy chủ. Gán vai trò ở mục Người dùng."
      />
      <section className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Chức năng</th>
                <th>Quản trị viên</th>
                <th>Tiếp nhận</th>
                <th>Trưởng nhóm</th>
                <th>Telesale</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row[0]}>
                  {row.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted report-note">
          Vai trò Xem báo cáo cũ được giữ cho tài khoản đang có; chỉ xem báo
          cáo, không sửa nghiệp vụ. Không khóa được tài khoản quản trị của chính
          mình.
        </p>
      </section>
    </>
  );
}

// Catalog screens are no longer part of the Admin scope (NOTE SỬA AD-04);
// kept exported so the code is preserved for a future owner role.
export const catalogSections = { Sources, Statuses };

const sections = [
  { id: "users", label: "Người dùng", group: "Tài khoản", el: Users },
  { id: "roles", label: "Vai trò & phân quyền", group: "Tài khoản", el: Roles },
  { id: "teams", label: "Nhóm Telesale", group: "Tài khoản", el: Teams },
  { id: "audit", label: "Nhật ký thao tác", group: "Hệ thống", el: Audit },
];

export function Settings() {
  const { actor } = useWorkspace();
  const { tab = "users" } = useParams();
  const current = sections.find((s) => s.id === tab) ?? sections[0];
  const Section = current.el;
  return (
    <Guard allowed={actor.role === "admin"}>
      <div className="settings">
        <nav className="settings-nav" aria-label="Mục cài đặt">
          <h1>Quản trị</h1>
          {[...new Set(sections.map((s) => s.group))].map((g) => (
            <div key={g}>
              <p>{g}</p>
              {sections
                .filter((s) => s.group === g)
                .map((s) => (
                  <NavLink
                    key={s.id}
                    to={`/admin/${s.id}`}
                    className={s.id === current.id ? "active" : ""}
                  >
                    {s.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="settings-body">
          <Section key={current.id} />
        </div>
      </div>
    </Guard>
  );
}
