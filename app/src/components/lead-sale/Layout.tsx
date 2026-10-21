import { useState, type ReactNode } from "react";
import { NavLink, Link, useLocation } from "react-router";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardList,
  ContactRound,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  Settings2,
  Truck,
  X,
} from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { roleLabels, canAssign } from "./domain";
import { formatDate } from "./shared";

export function Layout({ children }: { children: ReactNode }) {
  const { db, actor, setActor } = useWorkspace();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigation = [
    { to: "/", label: "Tổng quan", icon: LayoutDashboard },
    { to: "/leads", label: "Hồ sơ Lead", icon: ContactRound },
    ...(actor.role !== "viewer"
      ? [
          { to: "/assignments", label: "Nhiệm vụ tư vấn", icon: ClipboardList },
          { to: "/appointments", label: "Lịch hẹn", icon: CalendarDays },
        ]
      : []),
    { to: "/reports", label: "Báo cáo", icon: BarChart3 },
    ...(actor.role === "admin"
      ? [{ to: "/settings", label: "Quản trị", icon: Settings2 }]
      : []),
  ];
  const active =
    navigation.find(
      (n) => n.to !== "/" && location.pathname.startsWith(n.to),
    ) ?? navigation[0];
  const due = db.assignments.filter(
    (t) =>
      (canAssign(actor) || t.assigneeId === actor.id) && t.status === "New",
  ).length;
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`workspace-sidebar ${open ? "is-open" : ""}`}>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-symbol">
            <Truck size={22} />
          </span>
          <span>
            Lead Sale<small>Quản lý tuyển tài xế</small>
          </span>
        </Link>
        <Button
          className="mobile-close"
          variant="ghost"
          size="icon"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
        <nav aria-label="Điều hướng chính">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {to === "/assignments" && due > 0 && (
                <span className="nav-count">{due}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <span className="demo-dot" />
            Bản xem thử<small>Dữ liệu lưu trên trình duyệt này.</small>
          </div>
          <label className="actor-picker">
            <span className="avatar">
              {actor.name
                .split(" ")
                .slice(-2)
                .map((n) => n[0])
                .join("")}
            </span>
            <span className="actor-name">
              {actor.name}
              <small>{roleLabels[actor.role]}</small>
            </span>
            <ChevronsUpDown size={14} />
            <select
              aria-label="Chọn vai trò dùng thử"
              value={actor.id}
              onChange={(e) => {
                setActor(e.target.value);
                setOpen(false);
              }}
            >
              {db.members
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {roleLabels[m.role]}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </aside>
      <div className="workspace-body">
        <div className="topbar">
          <div>
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Mở điều hướng"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </Button>
            <PanelLeftClose size={17} className="desktop-panel-icon" />
            <span className="breadcrumb">
              Không gian làm việc <span>/</span> <strong>{active.label}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="workspace-date">
              {formatDate(new Date().toISOString())}
            </span>
            <span className="local-indicator">
              <Check size={13} />
              Lưu cục bộ
            </span>
          </div>
        </div>
        <main id="main-content" className="workspace-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Lead Sale · Phát triển từ Atomic CRM</span>
          <span>Tiếp nhận → Tư vấn → Chuyển đổi</span>
        </footer>
      </div>
      <Toaster richColors position="top-right" closeButton />
    </div>
  );
}
