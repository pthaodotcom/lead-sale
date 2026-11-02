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
import {
  leadLabels,
  ticketLabels,
  outcomeLabels,
  decisionLabels,
  reasonLabels,
} from "./domain";
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
        className={`kpi ${active ? "active" : ""}`}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }
  return to ? (
    <Link className={`kpi ${active ? "active" : ""}`} to={to}>
      {body}
    </Link>
  ) : (
    <div className={`kpi ${active ? "active" : ""}`}>{body}</div>
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
  const id = useId();
  return (
    <div className={`search-box ${className}`}>
      <label className="filter-label" htmlFor={id}>
        Tìm kiếm
      </label>
      <div className="search-input">
        <Search size={16} aria-hidden />
        <input
          id={id}
          aria-label="Tìm kiếm"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
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
        {total > 0 ? `${start}–${end} trên ${total} ${unit}` : `0 ${unit}`}
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
            color: "var(--ink-3)",
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

/* ---------- Human-readable Audit Trail (Dạng chữ nghiệp vụ) ---------- */

export interface AuditDiff {
  label: string;
  from: string;
  to: string;
}

export interface AuditField {
  label: string;
  value: string;
}

export interface ParsedAudit {
  diffs?: AuditDiff[];
  fields?: AuditField[];
  text?: string;
  summary: string;
}

export function formatAuditAction(action: string, detail?: string): string {
  const map: Record<string, string> = {
    saveLead: "Cập nhật hồ sơ",
    leadNote: "Ghi chú hồ sơ",
    leadStatus: "Thay đổi trạng thái hồ sơ",
    archiveLead: "Lưu trữ / khôi phục hồ sơ",
    receiveLead: "Tiếp nhận lại hồ sơ",
    correctMilestone: "Đính chính mốc xử lý",
    assign: "Phân công tư vấn",
    accept: "Nhận phiếu tư vấn",
    followUp: "Hẹn gọi lại",
    ticketStatus: "Cập nhật trạng thái phiếu",
    activity: "Ghi nhận tư vấn",
    appointment: "Cập nhật lịch hẹn",
    reschedule: "Đổi lịch hẹn",
    review: "Rà soát bàn giao",
    amendReview: "Sửa kết quả rà soát",
    reconcileAppointment: "Đối soát lịch hẹn",
    correctAppointment: "Đính chính lịch hẹn",
    voidActivity: "Hủy lượt tư vấn",
    attachment: "Đính kèm bằng chứng",
    member: "Cập nhật tài khoản",
    memberCreate: "Tạo tài khoản",
    memberProfile: "Sửa thông tin tài khoản",
    memberUpsert: "Cập nhật tài khoản",
    teamCreate: "Tạo nhóm telesale",
    statusLabel: "Đổi nhãn trạng thái",
    sourceUpsert: "Cập nhật nguồn tiếp nhận",
  };

  if (action === "saveLead" && detail) {
    try {
      const p = JSON.parse(detail);
      if (!p.id && (!p.input || !p.input.id)) {
        return "Tiếp nhận Lead mới";
      }
    } catch {
      // not JSON
    }
  }

  return map[action] ?? action;
}

function extractLeadFields(data: any, db: Database): Record<string, string> {
  const res: Record<string, string> = {};
  if (!data || typeof data !== "object") return res;

  if (data.name) res["Họ và tên"] = String(data.name).trim();
  if (data.phone) res["Số điện thoại"] = String(data.phone).trim();
  if (data.city) res["Khu vực"] = String(data.city).trim();
  if (data.vehicle) {
    res["Phương tiện"] = data.vehicle === "Van" ? "Xe Van" : "Xe máy";
  }
  if (data.sourceId) {
    res["Nguồn tiếp nhận"] = sourceName(db, data.sourceId);
  }
  const status = data.status || "New";
  res["Trạng thái"] = (leadLabels as Record<string, string>)[status] ?? status;

  if (data.tags !== undefined) {
    const tagsArr = Array.isArray(data.tags)
      ? data.tags
      : data.tags
        ? [data.tags]
        : [];
    if (tagsArr.length > 0) res["Nhãn"] = tagsArr.filter(Boolean).join(", ");
  }
  if (
    data.note !== undefined &&
    data.note !== null &&
    String(data.note).trim() !== ""
  ) {
    res["Ghi chú"] = String(data.note).trim();
  }
  const wrongPhone = Boolean(data.wrongPhone);
  res["Báo sai SĐT"] = wrongPhone ? "Báo sai số" : "Số hợp lệ";

  const archived = Boolean(data.archived);
  res["Lưu trữ"] = archived ? "Đã lưu trữ" : "Đang hoạt động";

  if (data.receivedAt) {
    res["Ngày tiếp nhận"] = formatDate(data.receivedAt, true);
  }

  const p = data.profile;
  if (p && typeof p === "object") {
    if (p.birthYear) res["Năm sinh"] = String(p.birthYear);
    if (p.gender)
      res["Giới tính"] =
        p.gender === "male" ? "Nam" : p.gender === "female" ? "Nữ" : p.gender;
    if (p.district) res["Quận / Huyện"] = String(p.district);
    if (p.vehicleDetail) res["Chi tiết xe"] = String(p.vehicleDetail);
    if (p.hasVehicle)
      res["Đã có xe"] = p.hasVehicle === "yes" ? "Đã có" : "Chưa có";
    if (p.referrer) res["Người giới thiệu"] = String(p.referrer);
    if (p.campaign) res["Chiến dịch"] = String(p.campaign);
    if (p.idNumber) res["Số CCCD / CMND"] = String(p.idNumber);
    if (p.callTime) {
      const times: Record<string, string> = {
        morning: "Buổi sáng",
        afternoon: "Buổi chiều",
        evening: "Buổi tối",
        any: "Bất kỳ lúc nào",
      };
      res["Khung giờ liên hệ"] = times[p.callTime] ?? p.callTime;
    }
  }

  return res;
}

export function parseAuditDetail(
  detail: string | undefined,
  olderDetail: string | undefined,
  db: Database,
): ParsedAudit {
  if (!detail || !detail.trim()) {
    return { summary: "—" };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(detail);
  } catch {
    return {
      text: detail,
      summary: detail,
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      text: String(detail),
      summary: String(detail),
    };
  }

  // 1. Diff object { before, after }
  if (parsed.before && parsed.after) {
    const beforeFields = extractLeadFields(parsed.before, db);
    const afterFields = extractLeadFields(parsed.after, db);
    const allKeys = Array.from(
      new Set([...Object.keys(beforeFields), ...Object.keys(afterFields)]),
    );
    const diffs: AuditDiff[] = [];
    for (const k of allKeys) {
      if (k === "Ngày tiếp nhận" || k === "Thời gian tiếp nhận") continue;
      const from = beforeFields[k] || "(trống)";
      const to = afterFields[k] || "(trống)";
      if (from !== to) {
        diffs.push({ label: k, from, to });
      }
    }
    if (diffs.length > 0) {
      return {
        diffs,
        summary: diffs.map((d) => `${d.label}: ${d.from} → ${d.to}`).join("; "),
      };
    }
    return {
      text: "Đã lưu lại hồ sơ (không thay đổi dữ liệu)",
      summary: "Không thay đổi dữ liệu",
    };
  }

  // 2. saveLead command / Lead input
  if (parsed.type === "saveLead" || parsed.input) {
    const currentLeadData = parsed.input ?? parsed;
    const currentFields = extractLeadFields(currentLeadData, db);

    if (olderDetail) {
      try {
        const olderParsed = JSON.parse(olderDetail);
        const olderLeadData =
          olderParsed.input ?? olderParsed.after ?? olderParsed;
        const olderFields = extractLeadFields(olderLeadData, db);
        if (Object.keys(olderFields).length > 0) {
          const allKeys = Array.from(
            new Set([
              ...Object.keys(olderFields),
              ...Object.keys(currentFields),
            ]),
          );
          const diffs: AuditDiff[] = [];
          for (const k of allKeys) {
            if (k === "Ngày tiếp nhận" || k === "Thời gian tiếp nhận") continue;
            const from = olderFields[k] || "(trống)";
            const to = currentFields[k] || "(trống)";
            if (from !== to) {
              diffs.push({ label: k, from, to });
            }
          }
          if (diffs.length > 0) {
            return {
              diffs,
              summary: diffs
                .map((d) => `${d.label}: ${d.from} → ${d.to}`)
                .join("; "),
            };
          }
          return {
            text: "Đã lưu lại hồ sơ (không thay đổi thông tin)",
            summary: "Lưu lại hồ sơ (không đổi thông tin)",
          };
        }
      } catch {
        // olderDetail was not JSON, ignore
      }
    }

    const fields: AuditField[] = Object.entries(currentFields)
      .filter(([label, value]) => {
        if (label === "Trạng thái" && value === "Mới") return false;
        if (label === "Lưu trữ" && value === "Đang hoạt động") return false;
        if (label === "Báo sai SĐT" && value === "Số hợp lệ") return false;
        if (label === "Ngày tiếp nhận" || label === "Thời gian tiếp nhận")
          return false;
        return true;
      })
      .map(([label, value]) => ({ label, value }));
    return {
      fields,
      summary: fields.map((f) => `${f.label}: ${f.value}`).join(" · "),
    };
  }

  // 3. leadNote
  if (parsed.type === "leadNote" || parsed.note) {
    const note = parsed.note ?? "";
    return {
      fields: [{ label: "Ghi chú", value: note }],
      summary: `Ghi chú: ${note}`,
    };
  }

  // 4. leadStatus
  if (parsed.type === "leadStatus") {
    const fields: AuditField[] = [];
    if (parsed.status) {
      fields.push({
        label: "Trạng thái mới",
        value:
          (leadLabels as Record<string, string>)[parsed.status] ??
          parsed.status,
      });
    }
    if (parsed.reason) fields.push({ label: "Lý do", value: parsed.reason });
    if (parsed.occurredAt)
      fields.push({
        label: "Thời điểm ghi nhận",
        value: formatDate(parsed.occurredAt, true),
      });
    return {
      fields,
      summary: fields.map((f) => `${f.label}: ${f.value}`).join(" · "),
    };
  }

  // 5. receiveLead
  if (parsed.type === "receiveLead") {
    const fields: AuditField[] = [];
    if (parsed.sourceId)
      fields.push({
        label: "Nguồn tiếp nhận",
        value: sourceName(db, parsed.sourceId),
      });
    if (parsed.reason)
      fields.push({ label: "Lý do tái tiếp nhận", value: parsed.reason });
    return {
      fields,
      summary: fields.map((f) => `${f.label}: ${f.value}`).join(" · "),
    };
  }

  // 6. assign
  if (parsed.type === "assign") {
    const fields: AuditField[] = [
      {
        label: "Chuyên viên tiếp nhận",
        value: memberName(db, parsed.assigneeId),
      },
      {
        label: "Hình thức",
        value: parsed.transfer ? "Chuyển giao phiếu" : "Phân công mới",
      },
    ];
    return {
      fields,
      summary: fields.map((f) => `${f.label}: ${f.value}`).join(" · "),
    };
  }

  // 7. ticketStatus
  if (parsed.type === "ticketStatus") {
    const fields: AuditField[] = [
      {
        label: "Trạng thái phiếu",
        value:
          (ticketLabels as Record<string, string>)[parsed.status] ??
          parsed.status,
      },
    ];
    if (parsed.reason) fields.push({ label: "Lý do", value: parsed.reason });
    return {
      fields,
      summary: fields.map((f) => `${f.label}: ${f.value}`).join(" · "),
    };
  }

  // 8. activity
  if (parsed.type === "activity" || parsed.channel) {
    const act = parsed.input ?? parsed;
    const fields: AuditField[] = [];
    if (act.channel) {
      fields.push({
        label: "Kênh",
        value:
          act.channel === "call"
            ? "Gọi điện"
            : act.channel === "zalo"
              ? "Zalo"
              : act.channel === "meeting"
                ? "Gặp trực tiếp"
                : act.channel,
      });
    }
    if (act.outcome) {
      fields.push({
        label: "Kết quả",
        value:
          (outcomeLabels as Record<string, string>)[act.outcome] ?? act.outcome,
      });
    }
    if (act.decision && act.decision !== "none") {
      fields.push({
        label: "Quyết định",
        value:
          (decisionLabels as Record<string, string>)[act.decision] ??
          act.decision,
      });
    }
    if (act.reason && act.reason !== "none") {
      fields.push({
        label: "Lý do",
        value:
          (reasonLabels as Record<string, string>)[act.reason] ?? act.reason,
      });
    }
    if (act.note) fields.push({ label: "Ghi chú", value: act.note });
    return {
      fields,
      summary: fields.map((f) => `${f.label}: ${f.value}`).join(" · "),
    };
  }

  // 9. appointment / reschedule / correctAppointment
  if (
    parsed.type === "appointment" ||
    parsed.type === "reschedule" ||
    parsed.type === "correctAppointment"
  ) {
    const fields: AuditField[] = [];
    if (parsed.at)
      fields.push({
        label: "Thời gian hẹn",
        value: formatDate(parsed.at, true),
      });
    if (parsed.place) fields.push({ label: "Địa điểm", value: parsed.place });
    if (parsed.status)
      fields.push({ label: "Trạng thái", value: parsed.status });
    if (parsed.reason) fields.push({ label: "Lý do", value: parsed.reason });
    return {
      fields,
      summary: fields.map((f) => `${f.label}: ${f.value}`).join(" · "),
    };
  }

  // 10. correctMilestone / reconcileAppointment / voidActivity
  if (parsed.reason || parsed.status) {
    const fields: AuditField[] = [];
    if (parsed.status) {
      fields.push({
        label: "Trạng thái",
        value:
          (leadLabels as Record<string, string>)[parsed.status] ??
          parsed.status,
      });
    }
    if (parsed.reason) fields.push({ label: "Lý do", value: parsed.reason });
    if (fields.length > 0) {
      return {
        fields,
        summary: fields.map((f) => `${f.label}: ${f.value}`).join(" · "),
      };
    }
  }

  // General fallback for unknown objects
  const fields: AuditField[] = [];
  const skipKeys = new Set(["id", "requestId", "version", "type", "updatedAt"]);
  for (const [k, v] of Object.entries(parsed)) {
    if (skipKeys.has(k) || v === null || v === undefined) continue;
    fields.push({
      label: k,
      value: typeof v === "object" ? JSON.stringify(v) : String(v),
    });
  }

  if (fields.length > 0) {
    return {
      fields,
      summary: fields.map((f) => `${f.label}: ${f.value}`).join(" · "),
    };
  }

  return {
    text: "Thao tác hệ thống",
    summary: "Thao tác hệ thống",
  };
}

export function AuditDetailView({
  detail,
  olderDetail,
  db,
  compact = false,
}: {
  detail?: string;
  olderDetail?: string;
  db: Database;
  compact?: boolean;
}) {
  const parsed = parseAuditDetail(detail, olderDetail, db);

  if (compact) {
    return <span className="tl-audit-compact">{parsed.summary}</span>;
  }

  if (parsed.diffs && parsed.diffs.length > 0) {
    return (
      <div className="tl-audit-chips-wrap">
        {parsed.diffs.map((d) => (
          <div key={d.label} className="tl-audit-chip diff">
            <span className="tl-chip-k">{d.label}:</span>
            <span className="tl-chip-old">{d.from}</span>
            <span className="tl-chip-arrow">→</span>
            <strong className="tl-chip-new">{d.to}</strong>
          </div>
        ))}
      </div>
    );
  }

  if (parsed.fields && parsed.fields.length > 0) {
    return (
      <div className="tl-audit-chips-wrap">
        {parsed.fields.map((f) => (
          <div key={f.label} className="tl-audit-chip field">
            <span className="tl-chip-k">{f.label}:</span>
            <strong className="tl-chip-v">{f.value}</strong>
          </div>
        ))}
      </div>
    );
  }

  if (parsed.text) {
    return (
      <div className="tl-audit-text-box">
        <p className="tl-audit-text">{parsed.text}</p>
      </div>
    );
  }

  return null;
}
