import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "./context";
import { roleLabels } from "./domain";
import { formatDate, Guard, PageHeading } from "./shared";
import type { Member } from "./types";

function MemberRow({ member }: { member: Member }) {
  const { actor, run } = useWorkspace();
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.active);
  return (
    <tr>
      <td>
        <strong>{member.name}</strong>
        <small>{member.id}</small>
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
            (role === member.role && active === member.active)
          }
          onClick={() =>
            run(
              { type: "member", id: member.id, role, active },
              "Đã cập nhật người dùng demo.",
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
  const { db, actor, run } = useWorkspace();
  const [tab, setTab] = useState("sources");
  const [source, setSource] = useState("");
  return (
    <Guard allowed={actor.role === "admin"}>
      <PageHeading
        title="Quản trị hệ thống"
        description="Quản lý nguồn tiếp nhận, vai trò dùng thử và nhật ký thao tác."
      />
      <section className="data-section">
        <div className="list-tabs">
          {[
            ["sources", "Nguồn Lead"],
            ["members", "Người dùng & vai trò"],
            ["audit", "Nhật ký hệ thống"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "sources" && (
          <>
            <form
              className="filter-bar"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  run({ type: "source", name: source }, "Đã thêm nguồn Lead.")
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
                        <strong>{s.name}</strong>
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
                          onClick={() =>
                            run(
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
              Vai trò tại đây dùng để thử luồng trên trình duyệt. Đăng nhập và
              phân quyền máy chủ sẽ được nối cùng Supabase.
            </p>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
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
