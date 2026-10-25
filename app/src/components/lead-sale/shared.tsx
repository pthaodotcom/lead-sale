import { Link } from "react-router";
import {
  ArrowLeft,
  Inbox,
  MoreHorizontal,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { leadLabels, ticketLabels } from "./domain";
import { serverNow } from "./dates";
import type { Database } from "./types";

export const formatDate = (value?: string, time = false) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "—";
export const formatTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const formatCompactDate = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
export const vnDay = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(value),
  );
export function relativeDeadline(value: string) {
  const hours = (Date.parse(value) - serverNow().getTime()) / 3600000;
  if (hours <= 0) return "Đã hết hạn";
  if (hours < 24) return `Còn ${Math.max(1, Math.round(hours))} giờ`;
  return `Còn ${Math.round(hours / 24)} ngày`;
}
export function localDateTime(value = serverNow(), precise = false) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, precise ? 23 : 16);
}
export const initials = (name = "") =>
  /^\+?\d/.test(name.trim())
    ? name.trim().slice(-2)
    : name
        .split(" ")
        .filter(Boolean)
        .slice(-2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
export const memberName = (db: Database, id?: string) =>
  db.members.find((m) => m.id === id)?.name ?? "—";
export const sourceName = (db: Database, id?: string) =>
  db.sources.find((s) => s.id === id)?.name ?? "—";
export const vehicleLabel = (v: string) => (v === "Van" ? "Xe Van" : "Xe máy");

export function Badge({
  status,
  ticket = false,
}: {
  status: string;
  ticket?: boolean;
}) {
  return (
    <span className={`chip s-${status.toLowerCase()}`}>
      {((ticket ? ticketLabels : leadLabels) as Record<string, string>)[
        status
      ] ?? status}
    </span>
  );
}
export function Chip({
  tone = "",
  children,
  plain = false,
}: {
  tone?: string;
  children: ReactNode;
  plain?: boolean;
}) {
  return (
    <span className={`chip ${tone ? `s-${tone}` : ""} ${plain ? "plain" : ""}`}>
      {children}
    </span>
  );
}
export function Avatar({
  name,
  size = "",
}: {
  name?: string;
  size?: "" | "sm" | "lg";
}) {
  return (
    <span className={`avatar ${size}`} aria-hidden>
      {initials(name)}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  action,
  back,
  backLabel = "Quay lại",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  back?: string;
  backLabel?: string;
}) {
  return (
    <header className="page-head">
      <div>
        {back && (
          <Link className="back-link" to={back}>
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </header>
  );
}
export function Panel({
  title,
  aside,
  children,
  className = "",
  bodyless = false,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyless?: boolean;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-head">
          <h2>{title}</h2>
          {aside}
        </div>
      )}
      {bodyless ? children : <div className="panel-body">{children}</div>}
    </section>
  );
}
export function Kpi({
  label,
  value,
  hint,
  tone = "",
  to,
  onClick,
  active = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "" | "red";
  to?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : undefined}>{value}</strong>
      {hint && <small>{hint}</small>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className={`kpi ${active ? "active ring-2 ring-primary" : ""}`}
        onClick={onClick}
        style={{ textAlign: "left", cursor: "pointer", width: "100%", background: active ? "var(--bg-subtle, #f0fdf4)" : undefined }}
      >
        {body}
      </button>
    );
  }
  return to ? (
    <Link className={`kpi ${active ? "active ring-2 ring-primary" : ""}`} to={to}>
      {body}
    </Link>
  ) : (
    <div className={`kpi ${active ? "active ring-2 ring-primary" : ""}`}>{body}</div>
  );
}
export function Bar({
  label,
  value,
  total,
  tone = "",
}: {
  label: string;
  value: number;
  total: number;
  tone?: string;
}) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div className="bar-row">
      <div>
        <span>{label}</span>
        <strong>
          {value}
          <small>{Number(pct.toFixed(1))}%</small>
        </strong>
      </div>
      <div className={`bar ${tone}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  return (
    <div className={`field ${className}`}>
      <label id={labelId} htmlFor={fieldId}>
        {label}
      </label>
      {Children.map(children, (child, index) =>
        index === 0 && isValidElement(child)
          ? cloneElement(
              child as ReactElement<{
                id?: string;
                "aria-labelledby"?: string;
              }>,
              { id: fieldId, "aria-labelledby": labelId },
            )
          : child,
      )}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  description = "Thử điều chỉnh bộ lọc hoặc tiếp nhận hồ sơ mới.",
  action,
  icon: Icon = Inbox,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Guard({
  allowed,
  children,
}: {
  allowed: boolean;
  children: ReactNode;
}) {
  return allowed ? (
    children
  ) : (
    <div className="panel">
      <Empty
        title="Bạn không có quyền xem trang này"
        description="Trang này thuộc vai trò khác. Quay về Tổng quan để xem việc của bạn."
        action={
          <Button asChild variant="outline">
            <Link to="/">Về Tổng quan</Link>
          </Button>
        }
      />
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Tìm tên, số điện thoại, mã hồ sơ…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`search-box ${className}`}>
      <Search size={16} />
      <input
        aria-label="Tìm kiếm"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const content =
    "﻿" +
    rows
      .map((row) =>
        row
          .map((v) => {
            const text = String(v);
            const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
            return `"${safe.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLowerCase();
export const textMatches = (q: string, ...values: string[]) =>
  fold(values.join(" ")).includes(fold(q).trim());

/** Row-level actions behind a single ⋯ button, as helpdesk tables do. */
export function RowMenu({
  items,
  label,
}: {
  label: string;
  items: { label: string; onSelect: () => void; danger?: boolean }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="row-menu" aria-label={`Thao tác: ${label}`}>
          <MoreHorizontal size={17} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((i) => (
          <DropdownMenuItem
            key={i.label}
            onSelect={i.onSelect}
            variant={i.danger ? "destructive" : "default"}
          >
            {i.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TablePagination({
  current,
  total,
  pageSize = 10,
  onPageChange,
  unit = "mục",
  extraLeft,
}: {
  current: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  unit?: string;
  extraLeft?: ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrent = Math.min(Math.max(1, current), pages);
  const start = total === 0 ? 0 : (safeCurrent - 1) * pageSize + 1;
  const end = Math.min(safeCurrent * pageSize, total);

  return (
    <div className="table-foot">
      {extraLeft ? <div>{extraLeft}</div> : <div />}
      <span>
        {total > 0
          ? `${start}–${end} trên ${total} ${unit}`
          : `0 ${unit}`}
      </span>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={safeCurrent <= 1}
          onClick={() => onPageChange(safeCurrent - 1)}
        >
          Trước
        </Button>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0 6px",
            fontSize: "12px",
            color: "var(--muted, #64748b)",
            fontWeight: 500,
          }}
        >
          Trang {safeCurrent} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={safeCurrent >= pages}
          onClick={() => onPageChange(safeCurrent + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  );
}

