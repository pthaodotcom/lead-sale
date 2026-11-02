import { useId, useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router";
import { toast } from "sonner";
import { Plus, Pencil, RotateCcw, RotateCw, Save } from "lucide-react";
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
  formatAuditAction,
  formatDate,
  Guard,
  memberName,
  parseAuditDetail,
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
    if (values.length) return values;

    const parsed = parseAuditDetail(detail, undefined, db);
    if (parsed.diffs && parsed.diffs.length > 0) {
      return parsed.diffs.map((d) => [d.label, `${d.from} → ${d.to}`]);
    }
    if (parsed.fields && parsed.fields.length > 0) {
      return parsed.fields.map((f) => [f.label, f.value]);
    }
    if (parsed.text) {
      return [["Nội dung", parsed.text]];
    }
    return [["Nội dung", "Đã cập nhật thông tin"]];
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
                    <td>{formatAuditAction(a.action, a.detail)}</td>
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

interface MatrixRow {
  feature: string;
  admin: { text: string; defaultChecked: boolean };
  intake: { text: string; defaultChecked: boolean };
  leader: { text: string; defaultChecked: boolean };
  telesale: { text: string; defaultChecked: boolean };
}

const DEFAULT_MATRIX: MatrixRow[] = [
  {
    feature: "Tài khoản & phân quyền",
    admin: { text: "Quản lý", defaultChecked: true },
    intake: { text: "—", defaultChecked: false },
    leader: { text: "—", defaultChecked: false },
    telesale: { text: "—", defaultChecked: false },
  },
  {
    feature: "Hồ sơ Lead",
    admin: { text: "—", defaultChecked: false },
    intake: { text: "Tiếp nhận / cập nhật", defaultChecked: true },
    leader: { text: "Xem trong nhóm", defaultChecked: true },
    telesale: { text: "Xem hồ sơ đang phụ trách", defaultChecked: true },
  },
  {
    feature: "Phân công / chuyển / đóng phiếu",
    admin: { text: "—", defaultChecked: false },
    intake: { text: "—", defaultChecked: false },
    leader: { text: "Trong nhóm", defaultChecked: true },
    telesale: { text: "—", defaultChecked: false },
  },
  {
    feature: "Ghi nhận liên hệ & bằng chứng",
    admin: { text: "—", defaultChecked: false },
    intake: { text: "—", defaultChecked: false },
    leader: { text: "Xem trong nhóm", defaultChecked: true },
    telesale: { text: "Phiếu của mình", defaultChecked: true },
  },
  {
    feature: "Lịch hẹn",
    admin: { text: "—", defaultChecked: false },
    intake: { text: "Đối soát kết quả", defaultChecked: true },
    leader: { text: "Xem nhóm", defaultChecked: true },
    telesale: { text: "Đặt / đổi / hủy lịch của mình", defaultChecked: true },
  },
  {
    feature: "Bàn giao Closed",
    admin: { text: "—", defaultChecked: false },
    intake: { text: "Rà soát, cập nhật hồ sơ", defaultChecked: true },
    leader: { text: "Giám sát nhóm", defaultChecked: true },
    telesale: { text: "—", defaultChecked: false },
  },
  {
    feature: "Báo cáo",
    admin: { text: "—", defaultChecked: false },
    intake: { text: "Nguồn tiếp nhận", defaultChecked: true },
    leader: { text: "Hiệu suất / chuyển đổi", defaultChecked: true },
    telesale: { text: "Chỉ tổng quan cá nhân", defaultChecked: true },
  },
];

type MatrixRole = "admin" | "intake" | "leader" | "telesale";
type MatrixState = Record<string, boolean>;

function getDefaultMatrixState(): MatrixState {
  const state: MatrixState = {};
  DEFAULT_MATRIX.forEach((row, rIdx) => {
    state[`${rIdx}_admin`] = row.admin.defaultChecked;
    state[`${rIdx}_intake`] = row.intake.defaultChecked;
    state[`${rIdx}_leader`] = row.leader.defaultChecked;
    state[`${rIdx}_telesale`] = row.telesale.defaultChecked;
  });
  return state;
}

const MATRIX_STORAGE_KEY = "lead_sale_matrix_v3";

function getInitialMatrixState(): MatrixState {
  try {
    localStorage.removeItem("lead_sale_permissions_config_v1");
    const raw = localStorage.getItem(MATRIX_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Use the default matrix if browser storage is unavailable or invalid.
  }
  return getDefaultMatrixState();
}

function Roles() {
  const [matrixState, setMatrixState] = useState<MatrixState>(getInitialMatrixState);
  const [isDirty, setIsDirty] = useState(false);

  const toggle = (rIdx: number, roleKey: MatrixRole) => {
    const key = `${rIdx}_${roleKey}`;
    setMatrixState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(matrixState));
      setIsDirty(false);
      toast.success("Đã lưu phân quyền.");
    } catch {
      toast.error("Không thể lưu phân quyền.");
    }
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(MATRIX_STORAGE_KEY);
      localStorage.removeItem("lead_sale_permissions_config_v1");
    } catch {
      // Reset the visible matrix even when browser storage is unavailable.
    }
    setMatrixState(getDefaultMatrixState());
    setIsDirty(false);
    toast.info("Đã khôi phục phân quyền theo đúng đặc tả ban đầu.");
  };

  const roles: MatrixRole[] = ["admin", "intake", "leader", "telesale"];

  return (
    <>
      <SectionHead
        title="Vai trò & phân quyền"
        action={
          <div className="page-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isDirty && (
              <span
                style={{
                  fontSize: 12,
                  color: "#d97706",
                  fontWeight: 500,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "#fef3c7",
                }}
              >
                Chưa lưu thay đổi
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw size={14} /> Khôi phục mặc định
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!isDirty}>
              <Save size={14} /> Lưu
            </Button>
          </div>
        }
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
              {DEFAULT_MATRIX.map((row, rIdx) => (
                <tr key={row.feature}>
                  <td>
                    <strong>{row.feature}</strong>
                  </td>
                  {roles.map((roleKey) => {
                    const cell = row[roleKey];
                    const key = `${rIdx}_${roleKey}`;
                    const isChecked = !!matrixState[key];
                    return (
                      <td key={roleKey}>
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggle(rIdx, roleKey)}
                          />
                          <span
                            style={{
                              color: isChecked
                                ? "inherit"
                                : "var(--ink-4, #94a3b8)",
                              fontWeight:
                                isChecked && cell.text !== "—"
                                  ? 500
                                  : "normal",
                            }}
                          >
                            {cell.text}
                          </span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
