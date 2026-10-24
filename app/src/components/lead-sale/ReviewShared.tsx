import { useEffect, useState } from "react";
import type { ReportFilters } from "./types";
import { useWorkspace } from "./context";
import { loadReport } from "./backend";
import { calculateAnalytics } from "./analytics";
import { dayVN } from "./workflow";
import { serverNow } from "./dates";
export const percent = (n: number, d: number) =>
  d ? `${Number(((n / d) * 100).toFixed(2))}%` : "—";
export function periodFilters(preset: string): ReportFilters {
  const today = dayVN(serverNow());
  return preset === "today"
    ? { from: today, to: today }
    : preset === "week"
      ? {
          from: dayVN(
            new Date(Date.parse(today + "T00:00:00+07:00") - 6 * 86400000),
          ),
          to: today,
        }
      : preset === "month"
        ? { from: today.slice(0, 7) + "-01", to: today }
        : {};
}
export function PeriodFilter({
  value,
  onChange,
}: {
  value: ReportFilters;
  onChange: (f: ReportFilters) => void;
}) {
  const [preset, setPreset] = useState(
    value.from === dayVN(serverNow()) && value.to === value.from
      ? "today"
      : value.from?.endsWith("-01")
        ? "month"
        : value.from
          ? "custom"
          : "all",
  );
  return (
    <div className="period-filter">
      <label>
        Kỳ xem{" "}
        <select
          aria-label="Kỳ xem"
          value={preset}
          onChange={(e) => {
            setPreset(e.target.value);
            onChange({
              ...value,
              ...periodFilters(e.target.value),
              ...(e.target.value === "all" ? { from: "", to: "" } : {}),
            });
          }}
        >
          <option value="all">Tất cả thời gian</option>
          <option value="today">Hôm nay</option>
          <option value="week">7 ngày gần nhất</option>
          <option value="month">Tháng này</option>
          <option value="custom">Khoảng ngày</option>
        </select>
      </label>
      <label>
        Từ ngày{" "}
        <input
          aria-label="Từ ngày"
          type="date"
          value={value.from ?? ""}
          onChange={(e) => {
            setPreset("custom");
            onChange({ ...value, from: e.target.value });
          }}
        />
      </label>
      <label>
        Đến ngày{" "}
        <input
          aria-label="Đến ngày"
          type="date"
          value={value.to ?? ""}
          onChange={(e) => {
            setPreset("custom");
            onChange({ ...value, to: e.target.value });
          }}
        />
      </label>
    </div>
  );
}
export function useAnalytics(filters: ReportFilters) {
  const { db, actor, cloud } = useWorkspace();
  const [remote, setRemote] = useState(db.report?.analytics);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const serialized = JSON.stringify(filters);
  useEffect(() => {
    if (!cloud || actor.role === "admin") return;
    let active = true;
    setLoading(true);
    setError("");
    loadReport(JSON.parse(serialized))
      .then((r) => {
        if (active) {
          setRemote(r.analytics);
          if (!r.analytics)
            setError("Máy chủ chưa được cập nhật bản nghiệp vụ mới.");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cloud, actor.role, serialized, db]);
  const invalid = !!filters.from && !!filters.to && filters.from > filters.to;
  return {
    analytics: invalid
      ? undefined
      : cloud
        ? remote
        : calculateAnalytics(db, actor, filters),
    error: invalid ? "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu." : error,
    loading,
  };
}
