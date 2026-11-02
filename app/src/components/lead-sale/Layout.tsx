import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  Bell,
  BookUser,
  CalendarDays,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Inbox,
  KeyRound,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Send,
  Settings2,
  X,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "./context";
import { roleLabels, canAssign, isLive } from "./domain";
import { Avatar, formatDate, Guard } from "./shared";
import { supabase } from "./backend";
import { serverNow } from "./dates";
import { inGroup, visibleTickets } from "./tasks";
import { routeAllowed } from "./access";
import type { Database, Member, Role } from "./types";

type Item = { to: string; label: string; icon: LucideIcon; count?: number };
type Group = { label?: string; items: Item[] };

function navigation(db: Database, actor: Member): Group[] {
  const is = (...roles: Role[]) => roles.includes(actor.role);
  if (actor.role === "admin") {
    return [
      {
        label: "Hệ thống",
        items: [
          { to: "/admin/users", label: "Quản lý người dùng", icon: Settings2 },
          { to: "/admin/roles", label: "Vai trò & phân quyền", icon: KeyRound },
          { to: "/admin/audit", label: "Lịch sử tài khoản", icon: History },
        ],
      },
    ];
  }
  const tickets = visibleTickets(db, actor);
  const myPending = tickets.filter(
    (t) =>
      inGroup(db, t, "pending") &&
      (actor.role !== "telesale" || t.assigneeId === actor.id),
  ).length;
  const waiting = db.leads.filter(
    (l) =>
      l.status === "New" &&
      !l.archived &&
      !db.assignments.some(
        (t) =>
          t.leadId === l.id &&
          isLive(t) &&
          Date.parse(t.expiresAt) > serverNow().getTime(),
      ),
  ).length;
  const reviews = db.reviews.filter((r) => !r.reviewedAt).length;
  const groups: Group[] = [
    { items: [{ to: "/", label: "Tổng quan", icon: LayoutDashboard }] },
    {
      label: "Công việc",
      items: [
        ...(is("telesale", "leader")
          ? [
              {
                to: "/tasks",
                label: "Nhiệm vụ",
                icon: ClipboardList,
                count: myPending,
              },
            ]
          : []),
        ...(canAssign(actor)
          ? [
              {
                to: "/dispatch",
                label: "Điều phối",
                icon: Send,
                count: waiting,
              },
            ]
          : []),
        ...(is("telesale", "leader")
          ? [{ to: "/appointments", label: "Lịch hẹn", icon: CalendarDays }]
          : []),
      ],
    },
    {
      label: "Hồ sơ",
      items: [
        { to: "/leads", label: "Hồ sơ Lead", icon: BookUser },
        ...(is("intake", "leader")
          ? [
              {
                to: "/handover",
                label: "Bàn giao Closed",
                icon: ArrowLeftRight,
                count: is("leader") ? undefined : reviews,
              },
            ]
          : []),
      ],
    },
    ...(is("leader", "intake")
      ? [
          {
            label: "Phân tích",
            items: [{ to: "/reports", label: "Báo cáo", icon: BarChart3 }],
          },
        ]
      : []),
  ];
  return groups.filter((g) => g.items.length);
}

function NoticeBell() {
  const { db, actor, run } = useWorkspace();
  const navigate = useNavigate();
  const mine = db.notices
    .filter((n) => n.recipientId === actor.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const unread = mine.filter((n) => !n.readAt);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="icon-btn"
          aria-label={`Thông báo, ${unread.length} chưa đọc`}
        >
          <Bell size={19} />
          {unread.length > 0 && (
            <span className="badge-dot">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="notice-pop">
        <header>
          <strong>Thông báo</strong>
          <Link to="/notifications">Xem tất cả</Link>
        </header>
        {mine.slice(0, 6).map((n) => (
          <DropdownMenuItem
            key={n.id}
            className="mini-item"
            onSelect={() => {
              if (!n.readAt) void run({ type: "noticeRead", id: n.id });
              navigate(n.href ?? "/notifications");
            }}
          >
            {!n.readAt ? (
              <span className="unread-dot" />
            ) : (
              <span style={{ width: 8 }} />
            )}
            <div>
              <strong>{n.title}</strong>
              <small>{formatDate(n.at, true)}</small>
            </div>
          </DropdownMenuItem>
        ))}
        {!mine.length && (
          <p className="muted" style={{ padding: "14px" }}>
            Chưa có thông báo nào.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { db, actor, cloud, setActor } = useWorkspace();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="user-btn" aria-label="Tài khoản">
          <Avatar name={actor.name} />
          <span className="who">
            <strong>{actor.name}</strong>
            <small>{roleLabels[actor.role]}</small>
          </span>
          <ChevronDown size={14} className="user-chevron" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          {actor.name}
          <div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
            {actor.email ?? roleLabels[actor.role]}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/account")}>
          <KeyRound /> Đổi mật khẩu
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/notifications")}>
          <Bell /> Thông báo
        </DropdownMenuItem>
        {!cloud && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="muted" style={{ fontSize: 12 }}>
              Xem thử với vai trò
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={actor.id}
              onValueChange={(id) => {
                setActor(id);
                navigate("/");
              }}
            >
              {db.members
                .filter((m) => m.active)
                .map((m) => (
                  <DropdownMenuRadioItem key={m.id} value={m.id}>
                    {m.name} · {roleLabels[m.role]}
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {cloud && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void supabase?.auth.signOut()}>
              <LogOut /> Đăng xuất
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { db, actor, run, cloud } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const groups = navigation(db, actor);
  const currentItem = groups
    .flatMap((group) => group.items)
    .filter((item) => item.to !== "/")
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => location.pathname.startsWith(item.to));
  const sectionTitle = location.pathname.startsWith("/account")
    ? "Tài khoản"
    : location.pathname.startsWith("/notifications")
      ? "Thông báo"
      : (currentItem?.label ?? "Tổng quan");
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const change = () => {
      setCompact(media.matches);
      if (!media.matches) setOpen(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!open || !compact) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sidebar = sidebarRef.current;
    sidebar?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab" || !sidebar) return;
      const controls = sidebar.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === sidebar)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === sidebar)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (menuRef.current?.offsetParent) menuRef.current.focus();
    };
  }, [open, compact]);
  const banner = db.notices
    .filter((n) => n.recipientId === actor.id && !n.readAt)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      {open && (
        <button
          className="scrim"
          aria-label="Đóng menu điều hướng"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="main-navigation"
        ref={sidebarRef}
        className={`side ${open ? "open" : ""}`}
        tabIndex={-1}
        inert={compact && !open}
        role={compact && open ? "dialog" : undefined}
        aria-hidden={compact && !open ? true : undefined}
        aria-modal={compact && open ? true : undefined}
        aria-label="Điều hướng"
      >
        <button
          className="icon-btn side-close"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <img
            className="brand-mark"
            src="/ahamove-mark.png"
            alt=""
            width={40}
            height={28}
          />
          <span>
            <strong>Lead Sale</strong>
            <small>AhaMove · Tuyển tài xế</small>
          </span>
        </Link>
        <nav aria-label="Điều hướng chính">
          {groups.map((g, i) => (
            <div className="nav-group" key={g.label ?? i}>
              {g.label && <p>{g.label}</p>}
              {g.items.map(({ to, label, icon: Icon, count }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {!!count && <span className="count">{count}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <div className="workspace-context">
            <BookUser size={20} aria-hidden />
            <span>
              <strong>{roleLabels[actor.role]}</strong>
              <small>
                {cloud ? "Không gian làm việc" : "Đang xem dữ liệu mẫu"}
              </small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            ref={menuRef}
            className="icon-btn menu-toggle"
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="main-navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="workspace-path" aria-label="Vị trí hiện tại">
            <span>
              {actor.role === "admin" ? "Quản trị" : "Không gian làm việc"}
            </span>
            <ChevronRight size={14} aria-hidden />
            <strong>{sectionTitle}</strong>
          </div>
          {actor.role !== "admin" && (
            <form
              className="global-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/leads?q=${encodeURIComponent(q.trim())}`);
                setQ("");
              }}
            >
              <Search size={16} />
              <input
                aria-label="Tìm hồ sơ Lead"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm tài xế theo tên, SĐT, mã hồ sơ…"
              />
            </form>
          )}
          <div className="topbar-end">
            {actor.role !== "admin" && <NoticeBell />}
            <UserMenu />
          </div>
        </header>
        <main id="main-content" className="content">
          {banner && (
            <div className="notice-strip" role="status">
              <Inbox size={16} />
              <Link to={banner.href ?? "/notifications"}>{banner.title}</Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void run({ type: "noticeRead", id: banner.id })}
              >
                Đã xem
              </Button>
            </div>
          )}
          <Guard allowed={routeAllowed(actor.role, location.pathname)}>
            {children}
          </Guard>
        </main>
      </div>
      <Toaster richColors position="top-right" closeButton />
    </div>
  );
}
