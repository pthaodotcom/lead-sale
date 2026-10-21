import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "./context";
import { roleLabels, leadLabels } from "./domain";
import { formatDate, Guard, PageHeading, Field } from "./shared";
import { registerMember } from "./backend";
import { toast } from "sonner";
import type { Member, Source } from "./types";

function SourceName({ source }: { source: Source }) {
  const { run, busy } = useWorkspace();
  const [name, setName] = useState(source.name);
  return (
    <form
      className="filter-bar"
      onSubmit={async (e) => {
        e.preventDefault();
        await run(
          { type: "source", id: source.id, name, active: source.active },
          "Đã cập nhật tên nguồn.",
        );
      }}
    >
      <Input
        aria-label={`Tên nguồn ${source.name}`}
        required
        minLength={2}
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || name.trim() === source.name}
      >
        Lưu tên
      </Button>
    </form>
  );
}

function MemberRow({ member }: { member: Member }) {
  const { db, actor, run } = useWorkspace();
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.active);
  const [teamId, setTeamId] = useState(member.teamId ?? "default");
  return (
    <tr>
      <td>
        <strong>{member.name}</strong>
        <small>{member.id}</small>
        <small>{member.email}</small>
      </td>
      <td>
        <select
          aria-label={`Nhóm của ${member.name}`}
          disabled={member.id === actor.id}
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
        >
          {(db.teams ?? [{ id: "default", name: "Nhóm tuyển tài xế" }]).map(
            (t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ),
          )}
        </select>
      </td>
      <td>
        <select
          aria-label={`Vai trò của ${member.name}`}
          value={role}
          disabled={member.id === actor.id}
          onChange={(e) => setRole(e.target.value as Member["role"])}
        >
          {Object.entries(roleLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </td>
      <td>
        <label className="inline-check">
          <input
            type="checkbox"
            disabled={member.id === actor.id}
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Đang hoạt động
        </label>
      </td>
      <td>
        <Button
          size="sm"
          variant="outline"
          disabled={
            member.id === actor.id ||
            (role === member.role &&
              active === member.active &&
              teamId === (member.teamId ?? "default"))
          }
          onClick={async () =>
            await run(
              {
                type: "member",
                id: member.id,
                role,
                active,
                ...(teamId !== (member.teamId ?? "default") ? { teamId } : {}),
              },
              "Đã cập nhật người dùng.",
            )
          }
        >
          Lưu thay đổi
        </Button>
      </td>
    </tr>
  );
}
export function Settings() {
  const { db, actor, run, cloud, refresh } = useWorkspace();
  const [tab, setTab] = useState("sources");
  const [source, setSource] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [team, setTeam] = useState("");
  return (
    <Guard allowed={actor.role === "admin"}>
      <PageHeading
        title="Quản trị hệ thống"
        description="Quản lý danh mục, tài khoản, phạm vi nhóm và nhật ký thao tác."
      />
      <section className="data-section">
        <div className="list-tabs">
          {[
            ["sources", "Nguồn Lead"],
            ["members", "Người dùng & vai trò"],
            ["audit", "Nhật ký hệ thống"],
            ["teams", "Nhóm"],
            ["statuses", "Trạng thái Lead"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={async () => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "sources" && (
          <>
            <form
              className="filter-bar"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await run(
                    { type: "source", name: source },
                    "Đã thêm nguồn Lead.",
                  )
                )
                  setSource("");
              }}
            >
              <Input
                aria-label="Tên nguồn Lead mới"
                placeholder="Nhập tên nguồn tiếp nhận mới"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
              <Button type="submit">Thêm nguồn</Button>
            </form>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nguồn tiếp nhận</th>
                    <th>Mã nguồn</th>
                    <th>Hồ sơ</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {db.sources.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <SourceName source={s} />
                      </td>
                      <td>{s.id}</td>
                      <td>
                        {db.leads.filter((l) => l.sourceId === s.id).length}
                      </td>
                      <td>{s.active ? "Đang sử dụng" : "Tạm ngưng"}</td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () =>
                            await run(
                              {
                                type: "source",
                                id: s.id,
                                name: s.name,
                                active: !s.active,
                              },
                              "Đã cập nhật nguồn.",
                            )
                          }
                        >
                          {s.active ? "Tạm ngưng" : "Sử dụng lại"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === "members" && (
          <>
            <p className="side-content muted">
              {cloud
                ? "Tài khoản mới chờ quản trị gán vai trò và kích hoạt. Nếu hệ thống yêu cầu xác nhận email, nhân viên cần xác nhận trước khi đăng nhập."
                : "Các tài khoản trong chế độ xem thử chỉ mô phỏng vai trò."}
            </p>
            {cloud && (
              <form
                className="side-content stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCreating(true);
                  try {
                    await registerMember(email, password, name);
                    await refresh();
                    setEmail("");
                    setName("");
                    setPassword("");
                    toast.success(
                      "Đã tạo tài khoản. Chọn vai trò và kích hoạt bên dưới.",
                    );
                  } catch (error) {
                    toast.error((error as Error).message);
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                <h2>Tạo tài khoản nhân viên</h2>
                <div className="form-grid">
                  <Field label="Họ tên nhân viên">
                    <Input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field label="Email nhân viên">
                    <Input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Field label="Mật khẩu ban đầu">
                    <Input
                      required
                      type="password"
                      minLength={10}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                </div>
                <Button disabled={creating}>Tạo tài khoản</Button>
              </form>
            )}
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Nhóm</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {db.members.map((m) => (
                    <MemberRow member={m} key={m.id} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === "teams" && (
          <div className="side-content stack-form">
            <form
              className="filter-bar"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run({ type: "team", name: team }, "Đã tạo nhóm."))
                  setTeam("");
              }}
            >
              <Input
                aria-label="Tên nhóm mới"
                required
                minLength={2}
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              />
              <Button>Tạo nhóm</Button>
            </form>
            {db.teams?.map((t) => (
              <p key={t.id}>{t.name}</p>
            ))}
          </div>
        )}
        {tab === "statuses" && (
          <div className="side-content stack-form">
            <p>
              Mã trạng thái và luồng chuyển được giữ cố định. Có thể chỉnh nhãn
              hiển thị.
            </p>
            {Object.entries(leadLabels).map(([code, label]) => (
              <StatusLabel
                key={code}
                code={code as keyof typeof leadLabels}
                label={label}
              />
            ))}
          </div>
        )}
        {tab === "audit" && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người thao tác</th>
                  <th>Hành động / Đối tượng</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {db.audit.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.at, true)}</td>
                    <td>{db.members.find((m) => m.id === a.actorId)?.name}</td>
                    <td>
                      <strong>{a.action}</strong>
                      <small>{a.target}</small>
                    </td>
                    <td className="audit-detail">
                      <details>
                        <summary>Xem nội dung</summary>
                        <pre>{a.detail}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Guard>
  );
}

function StatusLabel({
  code,
  label,
}: {
  code: keyof typeof leadLabels;
  label: string;
}) {
  const { run } = useWorkspace();
  const [value, setValue] = useState(label);
  return (
    <form
      className="filter-bar"
      onSubmit={async (e) => {
        e.preventDefault();
        await run(
          { type: "statusLabel", code, label: value },
          "Đã cập nhật nhãn trạng thái.",
        );
      }}
    >
      <span>{code}</span>
      <Input
        aria-label={`Nhãn ${code}`}
        required
        maxLength={120}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button variant="outline">Lưu</Button>
    </form>
  );
}
