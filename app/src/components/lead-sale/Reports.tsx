import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { Empty, PageHeading, downloadCsv } from "./shared";
import {
  PeriodFilter,
  percent,
  periodFilters,
  useAnalytics,
} from "./ReviewShared";
import { cities } from "./catalog";
import type { ReportFilters } from "./types";

function ReportTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <Empty title="Không có dữ liệu trong kỳ" />}
    </section>
  );
}

export function Reports() {
  const { db, actor } = useWorkspace();
  const [filters, setFilters] = useState<ReportFilters>(periodFilters("month"));
  const [reportType, setReportType] = useState<"telesale" | "source">(
    actor.role === "intake" ? "source" : "telesale",
  );
  const { analytics: a, error, loading } = useAnalytics(filters);
  const isSource = reportType === "source";

  const member = (id: string) =>
    db.members.find((m) => m.id === id)?.name ??
    (id === "unassigned" ? "Chưa phân công" : id);

  const sources = (a?.sources ?? []).map((s) => ({
    ...s,
    name: db.sources.find((x) => x.id === s.id)?.name ?? s.id,
  }));

  return (
    <>
      <PageHeading
        title={isSource ? "Báo cáo nguồn tiếp nhận" : "Báo cáo Telesale"}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              <Button
                size="sm"
                variant={!isSource ? "default" : "outline"}
                onClick={() => setReportType("telesale")}
              >
                Báo cáo Telesale
              </Button>
              <Button
                size="sm"
                variant={isSource ? "default" : "outline"}
                onClick={() => setReportType("source")}
              >
                Báo cáo nguồn
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!a || !!error || loading}
              onClick={() => {
                if (!a) return;
                downloadCsv(
                  isSource
                    ? "bao-cao-nguon-tiep-nhan.csv"
                    : "bao-cao-telesale.csv",
                  isSource
                    ? [
                        [
                          "Nguồn",
                          "Tổng hồ sơ",
                          "Tỷ trọng",
                          "Mới",
                          "Đã đăng ký",
                          "Đã chạy đơn đầu",
                          "Đã đóng",
                          "SĐT sai",
                        ],
                        ...sources.map((s) => [
                          s.name,
                          s.total,
                          percent(s.total, a.totals.total),
                          s.New,
                          s.Activated,
                          s.Onboarded,
                          s.Closed,
                          s.wrongPhone,
                        ]),
                      ]
                    : [
                        [
                          "Chuyên viên",
                          "Tổng phiếu",
                          "Chưa liên hệ",
                          "Đang tư vấn",
                          "Đã giải quyết",
                          "Đã đóng",
                          "Liên hệ thành công",
                          "KNM",
                          "Sai SĐT",
                          "Đồng ý",
                          "Không đồng ý",
                          "Cúp ngang",
                        ],
                        ...a.performance.map((p) => [
                          member(p.id),
                          p.total,
                          p.New,
                          p.Open,
                          p.Solved,
                          p.Closed,
                          percent(p.called, p.total),
                          percent(p.no_answer, p.total),
                          percent(p.wrong_phone, p.total),
                          percent(p.agreed, p.total),
                          percent(p.declined, p.total),
                          percent(p.hungup, p.total),
                        ]),
                      ],
                );
              }}
            >
              Xuất CSV
            </Button>
          </div>
        }
      />
      <section className="panel panel-body">
        <PeriodFilter value={filters} onChange={setFilters} />
        <div className="toolbar">
          <select
            aria-label="Lọc nguồn báo cáo"
            value={filters.source ?? ""}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          >
            <option value="">Mọi nguồn</option>
            {db.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {!isSource && (
            <>
              <select
                aria-label="Lọc chuyên viên báo cáo"
                value={filters.member ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, member: e.target.value })
                }
              >
                <option value="">Mọi chuyên viên</option>
                {db.members
                  .filter(
                    (m) =>
                      m.role === "telesale" &&
                      (actor.role !== "leader" ||
                        (m.teamId ?? "default") ===
                          (actor.teamId ?? "default")),
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Lọc thành phố báo cáo"
                value={filters.city ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, city: e.target.value })
                }
              >
                <option value="">Mọi thành phố</option>
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </section>
      {error && (
        <p role="alert">{error} Điều chỉnh bộ lọc hoặc tải lại để thử.</p>
      )}
      {loading && <p role="status">Đang tải báo cáo…</p>}
      {a && !error && (
        <>
          {isSource ? (
            <>
              <ReportTable
                title="Tỷ trọng hồ sơ theo nguồn tiếp nhận"
                headers={["Nguồn tiếp nhận", "Số hồ sơ", "Tỷ trọng"]}
                rows={sources.map((s) => [
                  s.name,
                  s.total,
                  percent(s.total, a.totals.total),
                ])}
              />
              <ReportTable
                title="Trạng thái hồ sơ Lead theo nguồn"
                headers={[
                  "Nguồn",
                  "Tổng hồ sơ",
                  "Mới",
                  "Đã đăng ký",
                  "Đã chạy đơn đầu",
                  "Đã đóng",
                  "SĐT sai",
                ]}
                rows={sources.map((s) => [
                  s.name,
                  s.total,
                  s.New,
                  s.Activated,
                  s.Onboarded,
                  s.Closed,
                  s.wrongPhone,
                ])}
              />
            </>
          ) : (
            <>
              <ReportTable
                title="Hiệu suất làm việc của chuyên viên Telesale"
                headers={[
                  "Chuyên viên",
                  "Số phiếu được giao",
                  "Chưa liên hệ",
                  "Đang tư vấn",
                  "Đã giải quyết",
                  "Đã đóng",
                ]}
                rows={a.performance.map((p) => [
                  member(p.id),
                  p.total,
                  p.New,
                  p.Open,
                  p.Solved,
                  p.Closed,
                ])}
              />
              <ReportTable
                title="Kết quả liên hệ và tư vấn theo chuyên viên"
                headers={[
                  "Chuyên viên",
                  "Tổng phiếu",
                  "Liên hệ thành công",
                  "Không nghe máy",
                  "Sai SĐT",
                  "Đồng ý",
                  "Không đồng ý",
                  "Cúp ngang",
                ]}
                rows={a.performance.map((p) => [
                  member(p.id),
                  p.total,
                  percent(p.called, p.total),
                  percent(p.no_answer, p.total),
                  percent(p.wrong_phone, p.total),
                  percent(p.agreed, p.total),
                  percent(p.declined, p.total),
                  percent(p.hungup, p.total),
                ])}
              />
              <ReportTable
                title="Tỷ lệ chuyển đổi Lead"
                headers={[
                  "Chuyên viên được quy công",
                  "Lead tiếp nhận",
                  "Đồng ý đăng ký",
                  "Đã đăng ký",
                  "Tỷ lệ đăng ký",
                  "Đã chạy đơn đầu",
                  "Tỷ lệ chạy đơn đầu",
                ]}
                rows={a.conversion.map((c) => [
                  member(c.id ?? "unassigned"),
                  c.total,
                  c.agreed,
                  c.registered,
                  percent(c.registered, c.total),
                  c.onboarded,
                  percent(c.onboarded, c.total),
                ])}
              />
            </>
          )}
          <p className="muted" style={{ marginTop: 12, fontWeight: 500 }}>
            Tổng: {a.totals.total} hồ sơ · {a.totals.registered} đã đăng ký ·{" "}
            {a.totals.onboarded} đã chạy đơn đầu.
          </p>
        </>
      )}
    </>
  );
}
