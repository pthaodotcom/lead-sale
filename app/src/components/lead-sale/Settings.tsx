import { Fragment, useId, useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  RotateCcw,
  RotateCw,
  Save,
  ShieldCheck,
} from "lucide-react";
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
  TablePagination,
  textMatches,
} from "./shared";
import {
  accountState,
  accountRoleLabel,
  supportedRole,
  needsTeam,
  memberUpdate,
} from "./admin";
import { getDatabase } from "./store";
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
  submitDisabled = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  onSubmit: () => Promise<boolean>;
  children: ReactNode;
  submitDisabled?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const descriptionId = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-md" aria-describedby={description ? descriptionId : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError("");
            try {
              if (await onSubmit()) onOpenChange(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={saving} className="admin-form-fields">
            {children}
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={saving || submitDisabled}>
              {saving ? "Đang lưu…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="settings-head">
      <div>
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}

/* ---------- Users ---------- */

function AccessFields({
  role,
  teamId,
  active,
  onRole,
  onTeam,
  onActive,
}: {
  role: Role | "";
  teamId: string;
  active: boolean;
  onRole: (value: Role) => void;
  onTeam: (value: string) => void;
  onActive: (value: boolean) => void;
}) {
  const { db } = useWorkspace();
  return (
    <>
      <Field label="Vai trò *">
        <select
          required
          value={role}
          onChange={(e) => onRole(e.target.value as Role)}
        >
          <option value="" disabled>
            Chọn vai trò
          </option>
          {Object.entries(roleLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {needsTeam(role) && (
        <Field label="Nhóm làm việc *">
          <select
            required
            value={teamId}
            onChange={(e) => onTeam(e.target.value)}
          >
            <option value="" disabled>
              Chọn nhóm
            </option>
            {teamsOf(db).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Trạng thái tài khoản">
        <select
          value={active ? "active" : "disabled"}
          onChange={(e) => onActive(e.target.value === "active")}
        >
          <option value="active">Hoạt động</option>
          <option value="disabled">Tạm ngưng</option>
        </select>
      </Field>
    </>
  );
}

function MemberDialog({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const { perform } = useWorkspace();
  const [role, setRole] = useState<Role | "">(
    supportedRole(member.role) ? member.role : "",
  );
  const [teamId, setTeamId] = useState(member.teamId ?? "default");
  const [active, setActive] = useState(member.active);
  const [name, setName] = useState(member.name);
  const changed =
    name.trim() !== member.name ||
    role !== member.role ||
    active !== member.active ||
    (needsTeam(role) && teamId !== (member.teamId ?? "default"));
  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      title="Sửa tài khoản"
      description={member.name}
      submitLabel="Lưu thay đổi"
      submitDisabled={!changed || !role}
      onSubmit={async () => {
        if (!role || !supportedRole(role))
          throw new Error("Chọn vai trò cho tài khoản.");
        await perform(memberUpdate(member, { name, role, active, teamId }));
        toast.success("Đã cập nhật tài khoản.");
        return true;
      }}
    >
      <Field label="Họ và tên *">
        <Input
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </Field>
      <Field label="Email đăng nhập">
        <Input
          type="email"
          readOnly
          value={member.email ?? ""}
          className="admin-readonly"
        />
      </Field>
      <AccessFields
        role={role}
        teamId={teamId}
        active={active}
        onRole={setRole}
        onTeam={setTeamId}
        onActive={setActive}
      />
    </FormDialog>
  );
}

function CreateMemberDialog({ onClose }: { onClose: () => void }) {
  const { db, cloud, perform, refresh } = useWorkspace();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("telesale");
  const [teamId, setTeamId] = useState(teamsOf(db)[0].id);
  const [active, setActive] = useState(true);
  const [created, setCreated] = useState<Member>();
  return (
    <FormDialog
      open
      onOpenChange={(value) => !value && onClose()}
      title="Thêm người dùng"
      submitLabel={created ? "Hoàn tất phân quyền" : "Tạo tài khoản"}
      onSubmit={async () => {
        let member = created;
        if (!member) {
          if (
            db.members.some(
              (m) => m.email?.toLowerCase() === email.trim().toLowerCase(),
            )
          )
            throw new Error(
              "Email đã được sử dụng. Chọn Sửa ở tài khoản hiện có.",
            );
          if (cloud)
            member = await registerMember(email.trim(), password, name.trim());
          else {
            await perform({
              type: "memberCreate",
              name: name.trim(),
              email: email.trim(),
            });
            member = getDatabase().members.find(
              (m) => m.email?.toLowerCase() === email.trim().toLowerCase(),
            );
          }
          if (!member)
            throw new Error(
              "Chưa tải được tài khoản mới. Tải lại danh sách để tiếp tục.",
            );
          setCreated(member);
          setPassword("");
        }
        await perform(memberUpdate(member, { name, role, active, teamId }));
        toast.success("Đã tạo và phân quyền tài khoản.");
        return true;
      }}
    >
      {created && (
        <p role="status" className="admin-provision-status">
          Đã tạo tài khoản. Hoàn tất phân quyền để sử dụng.
        </p>
      )}
      <Field label="Họ và tên *">
        <Input
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </Field>
      <Field label="Email đăng nhập *">
        <Input
          required
          type="email"
          maxLength={254}
          readOnly={!!created}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
        />
      </Field>
      {!created && (
        <Field label="Mật khẩu ban đầu *" hint="Tối thiểu 10 ký tự.">
          <Input
            required
            type="password"
            minLength={10}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      )}
      <AccessFields
        role={role}
        teamId={teamId}
        active={active}
        onRole={setRole}
        onTeam={setTeamId}
        onActive={setActive}
      />
      {created && (
        <Button type="button" variant="ghost" onClick={() => void refresh()}>
          Làm mới danh sách
        </Button>
      )}
    </FormDialog>
  );
}

const USERS_PAGE = 10;

function Users() {
  const { db, actor, cloud, perform, refresh } = useWorkspace();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState("");
  const [team, setTeam] = useState("");
  const [editing, setEditing] = useState<Member>();
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<{
    member: Member;
    kind: "status" | "password";
  }>();
  const [reloading, setReloading] = useState(false);
  const [page, setPage] = useState(1);
  const teamName = (id?: string) =>
    teamsOf(db).find((t) => t.id === (id ?? "default"))?.name ?? "—";
  const rows = db.members
    .filter(
      (m) =>
        (!role || m.role === role) &&
        (!state || accountState(m) === state) &&
        (!team || (needsTeam(m.role) && (m.teamId ?? "default") === team)) &&
        textMatches(q, m.name, m.email ?? ""),
    )
    .sort((a, b) =>
      a.id === actor.id
        ? -1
        : b.id === actor.id
          ? 1
          : a.name.localeCompare(b.name, "vi"),
    );
  const pages = Math.max(1, Math.ceil(rows.length / USERS_PAGE));
  const current = Math.min(page, pages);
  const paginatedRows = rows.slice(
    (current - 1) * USERS_PAGE,
    current * USERS_PAGE,
  );
  const groups = [
    ["", "Tất cả"],
    ["active", "Hoạt động"],
    ["disabled", "Tạm ngưng"],
    ["pending", "Chờ phân quyền"],
  ];
  return (
    <>
      <SectionHead
        title="Người dùng"
        action={
          <div className="page-actions">
            <Button
              variant="outline"
              disabled={reloading}
              aria-label="Làm mới danh sách"
              onClick={async () => {
                setReloading(true);
                try {
                  await refresh();
                } catch {
                  toast.error("Chưa tải được danh sách. Thử lại.");
                } finally {
                  setReloading(false);
                }
              }}
            >
              <RotateCw size={16} /> Làm mới
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> Thêm người dùng
            </Button>
          </div>
        }
      />
      <section className="panel admin-users">
        <div
          className="tabs admin-account-tabs"
          role="group"
          aria-label="Trạng thái người dùng"
        >
          {groups.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={state === key ? "active" : ""}
              aria-pressed={state === key}
              onClick={() => {
                setState(key);
                setPage(1);
              }}
            >
              {label}
              <span className="count">
                {
                  db.members.filter((m) => !key || accountState(m) === key)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="toolbar">
          <SearchBox
            className="grow"
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Tìm tên hoặc email…"
          />
          <select
            aria-label="Lọc vai trò"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả vai trò</option>
            {Object.entries(roleLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc nhóm"
            value={team}
            onChange={(e) => {
              setTeam(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả nhóm</option>
            {teamsOf(db).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {(q || role || state || team) && (
            <Button
              variant="ghost"
              onClick={() => {
                setQ("");
                setRole("");
                setState("");
                setTeam("");
                setPage(1);
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
        <div className="table-scroll">
          <table className="data-table admin-users-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Vai trò</th>
                <th>Nhóm làm việc</th>
                <th>Trạng thái</th>
                <th className="end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="person">
                      <Avatar name={m.name} size="sm" />
                      <span>
                        <strong>{m.name}</strong>
                        {m.id === actor.id && (
                          <span className="admin-self">Bạn</span>
                        )}
                        <small>{m.email ?? "—"}</small>
                      </span>
                    </span>
                  </td>
                  <td>{accountRoleLabel(m)}</td>
                  <td>{needsTeam(m.role) ? teamName(m.teamId) : "—"}</td>
                  <td>
                    <Chip
                      tone={
                        accountState(m) === "active"
                          ? "solved"
                          : accountState(m) === "pending"
                            ? "open"
                            : "closed"
                      }
                    >
                      {accountState(m) === "pending"
                        ? "Chờ phân quyền"
                        : m.active
                          ? "Hoạt động"
                          : "Tạm ngưng"}
                    </Chip>
                  </td>
                  <td className="end">
                    {m.id === actor.id ? (
                      <span className="muted admin-own-account">
                        Tài khoản đang sử dụng
                      </span>
                    ) : (
                      <div className="admin-row-actions">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(m)}
                          aria-label={`Sửa tài khoản ${m.name}`}
                        >
                          <Pencil size={14} /> Sửa
                        </Button>
                        <RowMenu
                          label={m.name}
                          items={[
                            ...(supportedRole(m.role)
                              ? [
                                  {
                                    label: m.active
                                      ? "Tạm ngưng tài khoản"
                                      : "Kích hoạt tài khoản",
                                    onSelect: () =>
                                      setAction({ member: m, kind: "status" }),
                                  },
                                ]
                              : []),
                            ...(cloud && m.email
                              ? [
                                  {
                                    label: "Đặt lại mật khẩu…",
                                    onSelect: () =>
                                      setAction({
                                        member: m,
                                        kind: "password",
                                      }),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="Không tìm thấy người dùng"
            description="Thử tìm theo tên, email hoặc thay đổi bộ lọc."
          />
        )}
        <TablePagination
          current={current}
          total={rows.length}
          pageSize={USERS_PAGE}
          onPageChange={setPage}
          unit="tài khoản"
        />
      </section>
      {editing && (
        <MemberDialog
          key={editing.id}
          member={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {creating && <CreateMemberDialog onClose={() => setCreating(false)} />}
      {action && (
        <FormDialog
          open
          onOpenChange={(value) => !value && setAction(undefined)}
          title={
            action.kind === "password"
              ? "Đặt lại mật khẩu"
              : action.member.active
                ? "Tạm ngưng tài khoản"
                : "Kích hoạt tài khoản"
          }
          description={action.member.email ?? action.member.name}
          submitLabel="Xác nhận"
          onSubmit={async () => {
            if (action.kind === "password")
              await resetPassword(action.member.email!);
            else {
              const member = action.member;
              await perform(
                memberUpdate(member, {
                  name: member.name,
                  role: member.role,
                  active: !member.active,
                  teamId: member.teamId ?? "default",
                }),
              );
              toast.success(
                member.active
                  ? "Đã tạm ngưng tài khoản."
                  : "Đã kích hoạt tài khoản.",
              );
            }
            return true;
          }}
        >
          <p className="admin-confirm-text">
            {action.kind === "password"
              ? "Gửi liên kết đặt lại mật khẩu tới email này?"
              : action.member.active
                ? "Tài khoản sẽ ngừng truy cập hệ thống. Hồ sơ và lịch sử được giữ lại."
                : "Cho phép tài khoản truy cập lại theo vai trò đã gán?"}
          </p>
        </FormDialog>
      )}
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
      <SectionHead title="Trạng thái Lead" />
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

function accountAuditValues(detail: string, db: Database): [string, string][] {
  try {
    const item = JSON.parse(detail);
    const values: [string, string][] = [];
    if (item.name) values.push(["Họ và tên", item.name]);
    if (item.role)
      values.push(["Vai trò", roleLabels[item.role] ?? "Chưa phân quyền"]);
    if (typeof item.active === "boolean")
      values.push(["Trạng thái", item.active ? "Hoạt động" : "Tạm ngưng"]);
    if (item.teamId)
      values.push([
        "Nhóm",
        teamsOf(db).find((t) => t.id === item.teamId)?.name ?? item.teamId,
      ]);
    return values.length
      ? values
      : [["Nội dung", "Đã cập nhật thông tin tài khoản"]];
  } catch {
    return [["Nội dung", detail]];
  }
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
      <SectionHead title="Lịch sử tài khoản" />
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
                    <td>
                      {(
                        {
                          member: "Cập nhật tài khoản",
                          memberProfile: "Sửa thông tin tài khoản",
                        } as Record<string, string>
                      )[a.action] ?? a.action}
                    </td>
                    <td>
                      {db.members.find((m) => m.id === a.target)?.name ??
                        a.target}
                    </td>
                    <td className="audit-detail">
                      <details>
                        <summary>Xem</summary>
                        <div className="admin-audit-values">
                          {accountAuditValues(a.detail, db).map(
                            ([label, value]) => (
                              <p key={label}>
                                <span>{label}</span>
                                <strong>{value}</strong>
                              </p>
                            ),
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              q || who
                ? "Không tìm thấy thay đổi phù hợp"
                : "Chưa có thay đổi tài khoản"
            }
            description=""
          />
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
  if (!supabase) throw new Error("Chưa kết nối hệ thống.");
  const gate = await supabase.rpc("lead_admin_check");
  if (gate.error) throw new Error(gate.error.message);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
  toast.success("Đã gửi liên kết đặt lại mật khẩu.");
}

interface RoleMeta {
  id: "admin" | "intake" | "leader" | "telesale";
  name: string;
  tag: string;
  desc: string;
}

const ROLES_LIST: RoleMeta[] = [
  {
    id: "admin",
    name: "Quản trị viên",
    tag: "Admin",
    desc: "Quản lý tài khoản, vai trò và phân quyền hệ thống. Không tham gia nghiệp vụ Lead.",
  },
  {
    id: "intake",
    name: "Tiếp nhận hồ sơ",
    tag: "Intake",
    desc: "Tiếp nhận, kiểm tra trùng, cập nhật Lead, đối soát kết quả và rà soát phiếu Closed.",
  },
  {
    id: "leader",
    name: "Trưởng nhóm",
    tag: "Leader",
    desc: "Phân công điều phối, chuyển chuyên viên, giám sát nhóm và xem báo cáo hiệu suất.",
  },
  {
    id: "telesale",
    name: "Telesale",
    tag: "Telesale",
    desc: "Liên hệ tài xế, ghi nhận kết quả tư vấn, upload bằng chứng và đặt lịch hẹn đăng ký.",
  },
];

interface PermItem {
  id: string;
  name: string;
  desc: string;
  module: string;
  moduleName: string;
  defaults: Record<string, { granted: boolean; scope?: string }>;
}

const PERMISSIONS_LIST: PermItem[] = [
  // 1. Hồ sơ Lead
  {
    id: "lead_view",
    name: "Xem danh sách hồ sơ Lead",
    desc: "Tra cứu, tìm kiếm và xem thông tin chi tiết hồ sơ",
    module: "leads",
    moduleName: "1. Quản lý hồ sơ Lead",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Toàn hệ thống" },
      leader: { granted: true, scope: "Trong nhóm" },
      telesale: { granted: true, scope: "Được phân công" },
    },
  },
  {
    id: "lead_create",
    name: "Tiếp nhận Lead mới",
    desc: "Tạo hồ sơ thủ công từ Hotline, Fanpage, Giới thiệu",
    module: "leads",
    moduleName: "1. Quản lý hồ sơ Lead",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Tiếp nhận mới" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "lead_edit",
    name: "Cập nhật thông tin Lead",
    desc: "Sửa thông tin cá nhân, nơi ở, loại xe, nhãn hồ sơ",
    module: "leads",
    moduleName: "1. Quản lý hồ sơ Lead",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Toàn quyền cập nhật" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "lead_import",
    name: "Nhập danh sách Excel / CSV",
    desc: "Tải file dữ liệu hồ sơ hàng loạt vào hệ thống",
    module: "leads",
    moduleName: "1. Quản lý hồ sơ Lead",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Nhập file" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "lead_export",
    name: "Xuất dữ liệu hồ sơ Lead",
    desc: "Tải xuống danh sách Lead dưới dạng file CSV",
    module: "leads",
    moduleName: "1. Quản lý hồ sơ Lead",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Toàn hệ thống" },
      leader: { granted: true, scope: "Trong nhóm" },
      telesale: { granted: false, scope: "—" },
    },
  },

  // 2. Phân công & Điều phối
  {
    id: "dispatch_queue",
    name: "Xem hàng chờ điều phối Lead",
    desc: "Danh sách Lead Mới cần phân công chuyên viên",
    module: "dispatch",
    moduleName: "2. Phân công & Điều phối",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: true, scope: "Trong nhóm" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "dispatch_assign",
    name: "Tạo phiếu & phân công chuyên viên",
    desc: "Gán Lead cho nhân viên và phân công hàng loạt",
    module: "dispatch",
    moduleName: "2. Phân công & Điều phối",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: true, scope: "Trong nhóm" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "ticket_reassign",
    name: "Chuyển giao hoặc thu hồi phiếu",
    desc: "Đổi chuyên viên phụ trách hoặc đóng sớm phiếu",
    module: "dispatch",
    moduleName: "2. Phân công & Điều phối",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: true, scope: "Trong nhóm" },
      telesale: { granted: false, scope: "—" },
    },
  },

  // 3. Xử lý phiếu tư vấn & Telesale
  {
    id: "task_execute",
    name: "Nhận việc & gọi điện tư vấn",
    desc: "Xử lý phiếu được phân công và liên hệ tài xế",
    module: "tasks",
    moduleName: "3. Xử lý phiếu tư vấn & Telesale",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: true, scope: "Phiếu của mình" },
    },
  },
  {
    id: "call_log",
    name: "Ghi nhận kết quả cuộc gọi & liên hệ",
    desc: "Cập nhật trạng thái Đồng ý, Hẹn lại, KNM, Từ chối",
    module: "tasks",
    moduleName: "3. Xử lý phiếu tư vấn & Telesale",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: true, scope: "Xem & ghi nhận nhóm" },
      telesale: { granted: true, scope: "Phiếu của mình" },
    },
  },
  {
    id: "evidence_upload",
    name: "Tải lên bằng chứng & ghi âm cuộc gọi",
    desc: "Đính kèm ảnh cuộc gọi hoặc file âm thanh chứng minh",
    module: "tasks",
    moduleName: "3. Xử lý phiếu tư vấn & Telesale",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: true, scope: "Xem & bổ sung" },
      telesale: { granted: true, scope: "Phiếu của mình" },
    },
  },
  {
    id: "ticket_reopen",
    name: "Mở lại phiếu Solved đã đóng",
    desc: "Mở lại phiếu tư vấn trong vòng 14 ngày",
    module: "tasks",
    moduleName: "3. Xử lý phiếu tư vấn & Telesale",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: true, scope: "Trong nhóm" },
      telesale: { granted: true, scope: "Phiếu của mình" },
    },
  },

  // 4. Lịch hẹn đăng ký
  {
    id: "appointment_create",
    name: "Tạo lịch hẹn đăng ký mới",
    desc: "Đặt lịch khi tài xế đồng ý lên văn phòng",
    module: "appointments",
    moduleName: "4. Lịch hẹn đăng ký",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: true, scope: "Trong nhóm" },
      telesale: { granted: true, scope: "Phiếu của mình" },
    },
  },
  {
    id: "appointment_modify",
    name: "Đổi lịch hoặc hủy lịch hẹn",
    desc: "Chỉnh ngày giờ, địa điểm hẹn mới khi khách dời lịch",
    module: "appointments",
    moduleName: "4. Lịch hẹn đăng ký",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: true, scope: "Trong nhóm" },
      telesale: { granted: true, scope: "Lịch của mình" },
    },
  },
  {
    id: "appointment_reconcile",
    name: "Đối soát kết quả lịch hẹn",
    desc: "Rà soát lịch đến muộn, cập nhật thành công",
    module: "appointments",
    moduleName: "4. Lịch hẹn đăng ký",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Đối soát kết quả" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },

  // 5. Bàn giao phiếu Closed
  {
    id: "handover_view",
    name: "Theo dõi bàn giao phiếu Closed",
    desc: "Giám sát phiếu đóng do KNM ≥3, từ chối, hết hạn",
    module: "handover",
    moduleName: "5. Bàn giao phiếu Closed",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Toàn hệ thống" },
      leader: { granted: true, scope: "Giám sát nhóm" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "handover_review",
    name: "Rà soát & quyết định phân công lại / Đóng",
    desc: "Tiếp nhận thẩm định và phán quyết xử lý hồ sơ",
    module: "handover",
    moduleName: "5. Bàn giao phiếu Closed",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Rà soát, cập nhật" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },

  // 6. Báo cáo & Thống kê
  {
    id: "report_source",
    name: "Báo cáo tỷ trọng nguồn tiếp nhận",
    desc: "Xem tỷ trọng số hồ sơ theo từng nguồn tiếp nhận",
    module: "reports",
    moduleName: "6. Báo cáo & Thống kê",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Nguồn tiếp nhận" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "report_performance",
    name: "Báo cáo hiệu suất & chuyển đổi",
    desc: "Thống kê cuộc gọi, tỷ lệ hẹn, kích hoạt tài xế",
    module: "reports",
    moduleName: "6. Báo cáo & Thống kê",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: false, scope: "—" },
      leader: { granted: true, scope: "Hiệu suất nhóm" },
      telesale: { granted: true, scope: "Tổng quan cá nhân" },
    },
  },
  {
    id: "report_export",
    name: "In & Xuất file báo cáo (PDF, Excel)",
    desc: "Tải file biểu mẫu in hoặc Excel báo cáo",
    module: "reports",
    moduleName: "6. Báo cáo & Thống kê",
    defaults: {
      admin: { granted: false, scope: "—" },
      intake: { granted: true, scope: "Báo cáo tiếp nhận" },
      leader: { granted: true, scope: "Báo cáo nhóm" },
      telesale: { granted: false, scope: "—" },
    },
  },

  // 7. Quản trị hệ thống
  {
    id: "admin_users",
    name: "Quản lý tài khoản người dùng",
    desc: "Tạo tài khoản, phân vai trò, gán nhóm làm việc",
    module: "admin",
    moduleName: "7. Quản trị hệ thống",
    defaults: {
      admin: { granted: true, scope: "Toàn quyền quản lý" },
      intake: { granted: false, scope: "—" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "admin_roles",
    name: "Cấu hình vai trò & phân quyền",
    desc: "Tùy chỉnh ma trận phân quyền và chính sách RBAC",
    module: "admin",
    moduleName: "7. Quản trị hệ thống",
    defaults: {
      admin: { granted: true, scope: "Toàn quyền cấu hình" },
      intake: { granted: false, scope: "—" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "admin_security",
    name: "Bảo mật & Đặt lại mật khẩu",
    desc: "Khóa/mở tài khoản, gửi link đặt lại mật khẩu",
    module: "admin",
    moduleName: "7. Quản trị hệ thống",
    defaults: {
      admin: { granted: true, scope: "Toàn quyền" },
      intake: { granted: false, scope: "—" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },
  {
    id: "admin_audit",
    name: "Xem nhật ký kiểm toán hệ thống",
    desc: "Theo dõi mọi biến động tài khoản và nhật ký",
    module: "admin",
    moduleName: "7. Quản trị hệ thống",
    defaults: {
      admin: { granted: true, scope: "Toàn hệ thống" },
      intake: { granted: false, scope: "—" },
      leader: { granted: false, scope: "—" },
      telesale: { granted: false, scope: "—" },
    },
  },
];

const PERMISSIONS_STORAGE_KEY = "lead_sale_permissions_config_v1";

function getInitialPermissions(): Record<
  string,
  Record<string, { granted: boolean; scope?: string }>
> {
  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const res: Record<
    string,
    Record<string, { granted: boolean; scope?: string }>
  > = {};
  for (const item of PERMISSIONS_LIST) {
    res[item.id] = { ...item.defaults };
  }
  return res;
}

function Roles() {
  const { db } = useWorkspace();
  const [permissions, setPermissions] = useState(getInitialPermissions);
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState<"matrix" | "by_role">("matrix");
  const [selectedRole, setSelectedRole] = useState<string>("leader");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  const memberCount = (roleKey: string) =>
    db.members.filter((m) => m.role === roleKey).length;

  const togglePermission = (permId: string, roleKey: string) => {
    setPermissions((prev) => {
      const currentPerm = prev[permId] ?? {};
      const currentRoleState = currentPerm[roleKey] ?? { granted: false };
      const nextGranted = !currentRoleState.granted;
      const defaultDef = PERMISSIONS_LIST.find((p) => p.id === permId)?.defaults[
        roleKey
      ];
      return {
        ...prev,
        [permId]: {
          ...currentPerm,
          [roleKey]: {
            granted: nextGranted,
            scope: nextGranted
              ? defaultDef?.scope && defaultDef.scope !== "—"
                ? defaultDef.scope
                : "Được cấp quyền"
              : "—",
          },
        },
      };
    });
    setIsDirty(true);
  };

  const toggleModuleForRole = (
    moduleKey: string,
    roleKey: string,
    grant: boolean,
  ) => {
    setPermissions((prev) => {
      const next = { ...prev };
      for (const p of PERMISSIONS_LIST.filter(
        (item) => item.module === moduleKey,
      )) {
        const defaultDef = p.defaults[roleKey];
        next[p.id] = {
          ...(next[p.id] ?? {}),
          [roleKey]: {
            granted: grant,
            scope: grant
              ? defaultDef?.scope && defaultDef.scope !== "—"
                ? defaultDef.scope
                : "Được cấp quyền"
              : "—",
          },
        };
      }
      return next;
    });
    setIsDirty(true);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(
        PERMISSIONS_STORAGE_KEY,
        JSON.stringify(permissions),
      );
      setIsDirty(false);
      toast.success("Đã lưu cấu hình phân quyền vai trò thành công.");
    } catch {
      toast.error("Không thể lưu cấu hình. Thử lại sau.");
    }
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
      const res: Record<
        string,
        Record<string, { granted: boolean; scope?: string }>
      > = {};
      for (const item of PERMISSIONS_LIST) {
        res[item.id] = { ...item.defaults };
      }
      setPermissions(res);
      setIsDirty(false);
      toast.info("Đã khôi phục ma trận phân quyền về chuẩn mặc định ban đầu.");
    } catch {}
  };

  const modules = Array.from(new Set(PERMISSIONS_LIST.map((p) => p.module)));
  const filteredPermissions = PERMISSIONS_LIST.filter((p) => {
    const matchSearch =
      !search || textMatches(search, p.name, p.desc, p.moduleName);
    const matchModule = !moduleFilter || p.module === moduleFilter;
    return matchSearch && matchModule;
  });

  const groupedFiltered = modules
    .map((mod) => ({
      module: mod,
      moduleName:
        PERMISSIONS_LIST.find((p) => p.module === mod)?.moduleName ?? mod,
      items: filteredPermissions.filter((p) => p.module === mod),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <SectionHead
        title="Vai trò & phân quyền"
        action={
          <div
            className="page-actions"
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            {isDirty && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "#d97706",
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: "#fef3c7",
                }}
              >
                ● Có thay đổi chưa lưu
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              title="Khôi phục phân quyền về giá trị mặc định của hệ thống"
            >
              <RotateCcw size={14} /> Khôi phục mặc định
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty}
              title="Lưu các thay đổi phân quyền"
            >
              <Save size={14} /> Lưu thay đổi
            </Button>
          </div>
        }
      />

      <section className="panel" style={{ padding: 16 }}>
        {/* Notice alert */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            padding: "12px 14px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            color: "#166534",
          }}
        >
          <ShieldCheck
            size={18}
            style={{ flexShrink: 0, marginTop: 1, color: "#16a34a" }}
          />
          <div>
            <strong>Bảng điều khiển phân quyền Quản trị viên (RBAC):</strong>
            <div style={{ marginTop: 2, color: "#15803d" }}>
              Bạn đang ở chế độ toàn quyền quản trị. Bấm trực tiếp vào các ô
              quyền hạn để bật/tắt (hoặc chọn tab{" "}
              <strong>Cấu hình theo vai trò</strong> để tinh chỉnh). Sau khi
              chỉnh sửa xong, nhấn <strong>Lưu thay đổi</strong> để áp dụng.
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="tabs" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={viewMode === "matrix" ? "active" : ""}
            onClick={() => setViewMode("matrix")}
          >
            Ma trận phân quyền (Tổng quan)
          </button>
          <button
            type="button"
            className={viewMode === "by_role" ? "active" : ""}
            onClick={() => setViewMode("by_role")}
          >
            Cấu hình theo vai trò
          </button>
        </div>

        {viewMode === "matrix" ? (
          <>
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <SearchBox
                className="grow"
                value={search}
                onChange={setSearch}
                placeholder="Tìm kiếm quyền hạn, chức năng…"
              />
              <select
                aria-label="Lọc theo phân hệ"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
              >
                <option value="">
                  Tất cả phân hệ ({PERMISSIONS_LIST.length} quyền)
                </option>
                {modules.map((m) => (
                  <option key={m} value={m}>
                    {PERMISSIONS_LIST.find((p) => p.module === m)?.moduleName}
                  </option>
                ))}
              </select>
              {(search || moduleFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setModuleFilter("");
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </div>

            <div className="table-scroll">
              <table className="data-table role-matrix-table">
                <thead>
                  <tr>
                    <th>Chức năng & Phân hệ</th>
                    {ROLES_LIST.map((r) => (
                      <th key={r.id}>
                        <div>{r.name}</div>
                        <small
                          className="muted"
                          style={{ fontWeight: "normal", fontSize: 11 }}
                        >
                          {memberCount(r.id)} tài khoản
                        </small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedFiltered.map((group) => (
                    <Fragment key={group.module}>
                      <tr className="role-matrix-module-row">
                        <td colSpan={5}>
                          <strong>{group.moduleName}</strong>
                        </td>
                      </tr>
                      {group.items.map((perm) => (
                        <tr key={perm.id}>
                          <td>
                            <div>
                              <strong>{perm.name}</strong>
                              <small
                                className="block muted"
                                style={{ fontSize: 11, marginTop: 2 }}
                              >
                                {perm.desc}
                              </small>
                            </div>
                          </td>
                          {ROLES_LIST.map((role) => {
                            const state = permissions[perm.id]?.[role.id] ?? {
                              granted: false,
                            };
                            const isGranted = !!state.granted;
                            return (
                              <td
                                key={role.id}
                                className="permission-toggle-cell"
                              >
                                <button
                                  type="button"
                                  className={`permission-toggle-btn ${isGranted ? "granted" : "denied"}`}
                                  onClick={() =>
                                    togglePermission(perm.id, role.id)
                                  }
                                  title={`Bấm để ${isGranted ? "tắt" : "bật"} quyền ${perm.name} cho vai trò ${role.name}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isGranted}
                                    readOnly
                                    tabIndex={-1}
                                    style={{
                                      pointerEvents: "none",
                                      margin: 0,
                                    }}
                                  />
                                  <span>
                                    {isGranted
                                      ? state.scope ?? "Có quyền"
                                      : "—"}
                                  </span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {!groupedFiltered.length && (
              <Empty
                title="Không tìm thấy quyền hạn phù hợp"
                description="Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc."
              />
            )}
          </>
        ) : (
          <div>
            {/* Role selection summary cards */}
            <div className="role-card-grid">
              {ROLES_LIST.map((r) => {
                const count = memberCount(r.id);
                const isSelected = selectedRole === r.id;
                return (
                  <div
                    key={r.id}
                    className={`role-summary-card ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedRole(r.id)}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <strong style={{ fontSize: 14 }}>{r.name}</strong>
                      <span className="count" style={{ fontSize: 11 }}>
                        {count} người
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "var(--ink-3, #64748b)",
                        lineHeight: 1.4,
                      }}
                    >
                      {r.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Permissions list for selected role */}
            <div style={{ marginTop: 16 }}>
              {modules.map((mod) => {
                const modPerms = PERMISSIONS_LIST.filter(
                  (p) => p.module === mod,
                );
                return (
                  <div key={mod} className="perm-module-card">
                    <div className="perm-module-head">
                      <div>
                        <strong>{modPerms[0]?.moduleName}</strong>
                        <span
                          className="muted"
                          style={{ fontSize: 12, marginLeft: 8 }}
                        >
                          (
                          {
                            modPerms.filter(
                              (p) =>
                                permissions[p.id]?.[selectedRole]?.granted,
                            ).length
                          }
                          /{modPerms.length} quyền)
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          style={{
                            height: 24,
                            fontSize: 11,
                            padding: "0 6px",
                          }}
                          onClick={() =>
                            toggleModuleForRole(mod, selectedRole, true)
                          }
                        >
                          Cấp toàn bộ
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          style={{
                            height: 24,
                            fontSize: 11,
                            padding: "0 6px",
                          }}
                          onClick={() =>
                            toggleModuleForRole(mod, selectedRole, false)
                          }
                        >
                          Bỏ toàn bộ
                        </Button>
                      </div>
                    </div>
                    <div>
                      {modPerms.map((perm) => {
                        const st = permissions[perm.id]?.[selectedRole] ?? {
                          granted: false,
                        };
                        const isGranted = !!st.granted;
                        return (
                          <div key={perm.id} className="perm-item-row">
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>
                                {perm.name}
                              </div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {perm.desc}
                              </div>
                            </div>
                            <button
                              type="button"
                              className={`permission-toggle-btn ${isGranted ? "granted" : "denied"}`}
                              onClick={() =>
                                togglePermission(perm.id, selectedRole)
                              }
                            >
                              <input
                                type="checkbox"
                                checked={isGranted}
                                readOnly
                                tabIndex={-1}
                                style={{
                                  pointerEvents: "none",
                                  margin: 0,
                                }}
                              />
                              <span>
                                {isGranted
                                  ? st.scope ?? "Có quyền"
                                  : "Chưa cấp"}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

// Catalog screens are no longer part of the Admin scope (NOTE SỬA AD-04);
// kept exported so the code is preserved for a future owner role.
export const catalogSections = { Sources, Statuses, Teams };

const sections = [
  { id: "users", el: Users },
  { id: "roles", el: Roles },
  { id: "audit", el: Audit },
];

export function Settings() {
  const { actor } = useWorkspace();
  const { tab = "users" } = useParams();
  const current = sections.find((section) => section.id === tab);
  if (!current) return <Navigate replace to="/admin/users" />;
  const Section = current.el;
  return (
    <Guard allowed={actor.role === "admin"}>
      <div className="admin-workspace">
        <Section key={current.id} />
      </div>
    </Guard>
  );
}
