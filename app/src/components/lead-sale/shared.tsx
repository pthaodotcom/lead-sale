import { Link } from "react-router";
import { ArrowLeft, Inbox, Search } from "lucide-react";
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

export const formatDate = (value?: string, time = false) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "—";
export function localDateTime(value = new Date()) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}
export function Badge({
  status,
  ticket = false,
}: {
  status: string;
  ticket?: boolean;
}) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {((ticket ? ticketLabels : leadLabels) as Record<string, string>)[
        status
      ] ?? status}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  back?: string;
}) {
  return (
    <header className="page-heading">
      <div>
        {back && (
          <Link className="back-link" to={back}>
            <ArrowLeft size={15} />
            Quay lại danh sách
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="page-actions">{action}</div>
    </header>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  return (
    <div className="field">
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
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
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
    <Empty
      title="Bạn chưa có quyền truy cập"
      description="Chọn chức năng phù hợp với vai trò của bạn."
      action={
        <Button asChild variant="outline">
          <Link to="/">Về tổng quan</Link>
        </Button>
      }
    />
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Tìm tên, số điện thoại, mã hồ sơ…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        aria-label="Tìm kiếm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const content =
    "\uFEFF" +
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
export const textMatches = (q: string, ...values: string[]) =>
  values
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLowerCase()
    .includes(
      q
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replaceAll("đ", "d")
        .toLowerCase()
        .trim(),
    );
