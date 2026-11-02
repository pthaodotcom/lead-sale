import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { Guard, PageHeading } from "./shared";
import {
  PeriodFilter,
  percent,
  periodFilters,
  useAnalytics,
} from "./ReviewShared";
import { cities } from "./catalog";
import type { ReportFilters } from "./types";
import { exportReportToExcel } from "./report-excel";
import "./reports.css";

export type ReportTypeId =
  | "intake_source_share"
  | "intake_source_status"
  | "telesale_performance"
  | "telesale_contact_result"
  | "telesale_lead_conversion";

interface ReportMeta {
  id: ReportTypeId;
  title: string;
  category: "intake" | "telesale";
  landscape?: boolean;
}

const REPORT_DEFINITIONS: ReportMeta[] = [
  {
    id: "intake_source_share",
    title: "BÁO CÁO TỶ TRỌNG HỒ SƠ THEO NGUỒN TIẾP NHẬN",
    category: "intake",
    landscape: false,
  },
  {
    id: "intake_source_status",
    title: "BÁO CÁO TRẠNG THÁI HỒ SƠ LEAD THEO NGUỒN TIẾP NHẬN",
    category: "intake",
    landscape: true,
  },
  {
    id: "telesale_performance",
    title: "BÁO CÁO HIỆU SUẤT LÀM VIỆC CỦA CHUYÊN VIÊN TELESALE",
    category: "telesale",
    landscape: true,
  },
  {
    id: "telesale_contact_result",
    title: "BÁO CÁO KẾT QUẢ LIÊN HỆ VÀ TƯ VẤN TELESALE",
    category: "telesale",
    landscape: true,
  },
  {
    id: "telesale_lead_conversion",
    title: "BÁO CÁO TỶ LỆ CHUYỂN ĐỔI LEAD",
    category: "telesale",
    landscape: true,
  },
];

function formatVNDate(isoDateString?: string) {
  if (!isoDateString) return "";
  const parts = isoDateString.slice(0, 10).split("-");
  if (parts.length < 3) return isoDateString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function Reports() {
  const { db, actor } = useWorkspace();
  const [filters, setFilters] = useState<ReportFilters>(periodFilters("month"));
  const [zoomLevel, setZoomLevel] = useState(100);

  // Determine allowed reports based on user role
  const isIntake = actor.role === "intake";
  const [reportType, setReportType] = useState<ReportTypeId>(
    isIntake ? "intake_source_share" : "telesale_performance",
  );

  const { analytics: a, error, loading } = useAnalytics(filters);

  const currentReportMeta = useMemo(
    () =>
      REPORT_DEFINITIONS.find((r) => r.id === reportType) ??
      REPORT_DEFINITIONS[0],
    [reportType],
  );

  const member = (id: string) =>
    db.members.find((m) => m.id === id)?.name ??
    (id === "unassigned" ? "Chưa phân công" : id);

  const sourceName = (id: string) =>
    db.sources.find((s) => s.id === id)?.name ?? id;

  const sourcesData = useMemo(() => {
    return (a?.sources ?? [])
      .filter((s) => !filters.source || s.id === filters.source)
      .map((s) => ({ ...s, name: sourceName(s.id) }));
  }, [a?.sources, db.sources, filters.source]);

  // Date range formatted label
  const periodText = useMemo(() => {
    if (filters.from && filters.to) {
      if (filters.from === filters.to)
        return `Ngày ${formatVNDate(filters.from)}`;
      return `Từ ngày ${formatVNDate(filters.from)} đến ngày ${formatVNDate(filters.to)}`;
    }
    if (filters.from) return `Từ ngày ${formatVNDate(filters.from)}`;
    if (filters.to) return `Đến ngày ${formatVNDate(filters.to)}`;
    return "Toàn bộ thời gian";
  }, [filters.from, filters.to]);

  // Applied filter textual summary
  const appliedFiltersText = useMemo(() => {
    const parts: string[] = [];
    if (filters.member) parts.push(`Chuyên viên: ${member(filters.member)}`);
    if (filters.source) parts.push(`Nguồn: ${sourceName(filters.source)}`);
    if (filters.city) parts.push(`Thành phố: ${filters.city}`);
    return parts.join(" | ");
  }, [filters.member, filters.source, filters.city, db.members, db.sources]);

  // Total Leads count for Report 1
  const totalLeadsReport1 = useMemo(
    () => sourcesData.reduce((acc, s) => acc + s.total, 0),
    [sourcesData],
  );

  // Totals for Report 2
  const totalsReport2 = useMemo(() => {
    return sourcesData.reduce(
      (acc, s) => ({
        total: acc.total + s.total,
        New: acc.New + s.New,
        Activated: acc.Activated + s.Activated,
        Onboarded: acc.Onboarded + s.Onboarded,
        Closed: acc.Closed + s.Closed,
        wrongPhone: acc.wrongPhone + s.wrongPhone,
      }),
      {
        total: 0,
        New: 0,
        Activated: 0,
        Onboarded: 0,
        Closed: 0,
        wrongPhone: 0,
      },
    );
  }, [sourcesData]);

  // Totals for Report 3
  const totalsReport3 = useMemo(() => {
    const perf = a?.performance ?? [];
    return perf.reduce(
      (acc, p) => ({
        total: acc.total + p.total,
        New: acc.New + p.New,
        Open: acc.Open + p.Open,
        Solved: acc.Solved + p.Solved,
        Closed: acc.Closed + p.Closed,
      }),
      { total: 0, New: 0, Open: 0, Solved: 0, Closed: 0 },
    );
  }, [a?.performance]);

  // Totals for Report 4 (Raw sums across all specialists to compute true team percentage)
  const totalsReport4 = useMemo(() => {
    const perf = a?.performance ?? [];
    const sums = perf.reduce(
      (acc, p) => ({
        total: acc.total + p.total,
        called: acc.called + p.called,
        no_answer: acc.no_answer + p.no_answer,
        wrong_phone: acc.wrong_phone + p.wrong_phone,
        agreed: acc.agreed + p.agreed,
        declined: acc.declined + p.declined,
        hungup: acc.hungup + p.hungup,
      }),
      {
        total: 0,
        called: 0,
        no_answer: 0,
        wrong_phone: 0,
        agreed: 0,
        declined: 0,
        hungup: 0,
      },
    );
    return {
      ...sums,
      calledRate: percent(sums.called, sums.total),
      noAnswerRate: percent(sums.no_answer, sums.total),
      wrongPhoneRate: percent(sums.wrong_phone, sums.total),
      agreedRate: percent(sums.agreed, sums.total),
      declinedRate: percent(sums.declined, sums.total),
      hungupRate: percent(sums.hungup, sums.total),
    };
  }, [a?.performance]);

  // Conversion Details for Report 5
  const conversionDetails = useMemo(() => {
    return a?.conversionDetails ?? [];
  }, [a?.conversionDetails]);

  const totalsReport5 = useMemo(() => {
    const sums = conversionDetails.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        agreed: acc.agreed + r.agreed,
        registered: acc.registered + r.registered,
        onboarded: acc.onboarded + r.onboarded,
      }),
      { total: 0, agreed: 0, registered: 0, onboarded: 0 },
    );
    return {
      ...sums,
      conversionRate: percent(sums.onboarded, sums.total),
    };
  }, [conversionDetails]);

  // Excel Export Handler
  const handleExportExcel = () => {
    if (!a) return;
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let totalRow: (string | number)[] = [];
    const filenamePrefix = currentReportMeta.title
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    switch (reportType) {
      case "intake_source_share":
        headers = ["STT", "Nguồn tiếp nhận", "Số hồ sơ Lead", "Tỷ trọng (%)"];
        rows = sourcesData.map((s, idx) => [
          idx + 1,
          s.name,
          s.total,
          percent(s.total, totalLeadsReport1),
        ]);
        totalRow = [
          "TỔNG CỘNG",
          "",
          totalLeadsReport1,
          totalLeadsReport1 > 0 ? "100.0%" : "0%",
        ];
        break;

      case "intake_source_status":
        headers = [
          "STT",
          "Nguồn tiếp nhận",
          "Tổng số hồ sơ",
          "New",
          "Activated",
          "Onboarded",
          "Closed",
          "Số hồ sơ có SĐT sai",
        ];
        rows = sourcesData.map((s, idx) => [
          idx + 1,
          s.name,
          s.total,
          s.New,
          s.Activated,
          s.Onboarded,
          s.Closed,
          s.wrongPhone,
        ]);
        totalRow = [
          "TỔNG CỘNG",
          "",
          totalsReport2.total,
          totalsReport2.New,
          totalsReport2.Activated,
          totalsReport2.Onboarded,
          totalsReport2.Closed,
          totalsReport2.wrongPhone,
        ];
        break;

      case "telesale_performance":
        headers = [
          "STT",
          "Mã chuyên viên",
          "Họ tên chuyên viên",
          "Số phiếu được giao",
          "Số phiếu chưa liên hệ",
          "Số phiếu đang tư vấn",
          "Số phiếu đã giải quyết",
          "Số phiếu đã đóng",
        ];
        rows = (a.performance ?? []).map((p, idx) => [
          idx + 1,
          p.id,
          member(p.id),
          p.total,
          p.New,
          p.Open,
          p.Solved,
          p.Closed,
        ]);
        totalRow = [
          "TỔNG CỘNG",
          "",
          "",
          totalsReport3.total,
          totalsReport3.New,
          totalsReport3.Open,
          totalsReport3.Solved,
          totalsReport3.Closed,
        ];
        break;

      case "telesale_contact_result":
        headers = [
          "STT",
          "Mã chuyên viên",
          "Họ tên chuyên viên",
          "Tỷ lệ liên hệ thành công (%)",
          "Tỷ lệ không nghe máy (%)",
          "Tỷ lệ sai SĐT (%)",
          "Tỷ lệ đồng ý (%)",
          "Tỷ lệ không đồng ý (%)",
          "Tỷ lệ cúp ngang (%)",
        ];
        rows = (a.performance ?? []).map((p, idx) => [
          idx + 1,
          p.id,
          member(p.id),
          percent(p.called, p.total),
          percent(p.no_answer, p.total),
          percent(p.wrong_phone, p.total),
          percent(p.agreed, p.total),
          percent(p.declined, p.total),
          percent(p.hungup, p.total),
        ]);
        totalRow = [
          "TỔNG CỘNG (TOÀN ĐỘI)",
          "",
          "",
          totalsReport4.calledRate,
          totalsReport4.noAnswerRate,
          totalsReport4.wrongPhoneRate,
          totalsReport4.agreedRate,
          totalsReport4.declinedRate,
          totalsReport4.hungupRate,
        ];
        break;

      case "telesale_lead_conversion":
        headers = [
          "STT",
          "Chuyên viên",
          "Nguồn Lead",
          "Thành phố",
          "Số Lead tiếp nhận",
          "Số Lead đồng ý đăng ký",
          "Số Lead Activated",
          "Số Lead Onboarded",
          "Tỷ lệ chuyển đổi thành công (%)",
        ];
        rows = conversionDetails.map((r, idx) => [
          idx + 1,
          member(r.memberId),
          sourceName(r.sourceId),
          r.city,
          r.total,
          r.agreed,
          r.registered,
          r.onboarded,
          percent(r.onboarded, r.total),
        ]);
        totalRow = [
          "TỔNG CỘNG",
          "",
          "",
          "",
          totalsReport5.total,
          totalsReport5.agreed,
          totalsReport5.registered,
          totalsReport5.onboarded,
          totalsReport5.conversionRate,
        ];
        break;
    }

    void exportReportToExcel({
      reportTitle: currentReportMeta.title,
      periodText,
      filterText: appliedFiltersText,
      headers,
      rows,
      totalRow,
      creatorName: actor.name,
      filename: `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}`,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const todayVN = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
  const [dayStr, monthStr, yearStr] = todayVN.split("/");

  return (
    <Guard allowed={["leader", "intake", "admin"].includes(actor.role)}>
      <div className="report-page-container">
        <PageHeading title="Biểu mẫu báo cáo nghiệp vụ" />

        {/* 1. Filter & Actions Toolbar */}
        <section className="report-toolbar-card">
          <div className="report-filter-row">
            <div className="report-filter-group report-type-filter">
              <label htmlFor="report-type">Loại báo cáo</label>
              <select
                id="report-type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportTypeId)}
              >
                {actor.role !== "leader" && (
                  <optgroup label="Báo cáo Tiếp nhận hồ sơ">
                    <option value="intake_source_share">
                      1. Tỷ trọng số hồ sơ theo nguồn tiếp nhận
                    </option>
                    <option value="intake_source_status">
                      2. Trạng thái hồ sơ Lead theo nguồn tiếp nhận
                    </option>
                  </optgroup>
                )}

                {actor.role !== "intake" && (
                  <optgroup label="Báo cáo Trưởng nhóm Telesale">
                    <option value="telesale_performance">
                      1. Hiệu suất làm việc của chuyên viên Telesale
                    </option>
                    <option value="telesale_contact_result">
                      2. Kết quả liên hệ và tư vấn theo chuyên viên
                    </option>
                    <option value="telesale_lead_conversion">
                      3. Báo cáo tỷ lệ chuyển đổi Lead
                    </option>
                  </optgroup>
                )}

                {actor.role === "leader" && (
                  <optgroup label="Báo cáo tham chiếu nguồn">
                    <option value="intake_source_share">
                      4. Tỷ trọng số hồ sơ theo nguồn tiếp nhận
                    </option>
                    <option value="intake_source_status">
                      5. Trạng thái hồ sơ Lead theo nguồn tiếp nhận
                    </option>
                  </optgroup>
                )}
              </select>
            </div>

            <PeriodFilter value={filters} onChange={setFilters} />

            {/* Optional Specific Filters depending on Report Type */}
            {(reportType === "telesale_performance" ||
              reportType === "telesale_contact_result" ||
              reportType === "telesale_lead_conversion") && (
              <div className="report-filter-group">
                <label htmlFor="report-member">Chuyên viên</label>
                <select
                  id="report-member"
                  value={filters.member ?? ""}
                  onChange={(e) =>
                    setFilters({ ...filters, member: e.target.value })
                  }
                >
                  <option value="">Tất cả chuyên viên</option>
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
                        {m.name} ({m.id})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {(reportType === "telesale_lead_conversion" ||
              reportType === "intake_source_share" ||
              reportType === "intake_source_status") && (
              <div className="report-filter-group">
                <label htmlFor="report-source">Nguồn Lead</label>
                <select
                  id="report-source"
                  value={filters.source ?? ""}
                  onChange={(e) =>
                    setFilters({ ...filters, source: e.target.value })
                  }
                >
                  <option value="">Tất cả nguồn</option>
                  {db.sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {reportType === "telesale_lead_conversion" && (
              <div className="report-filter-group">
                <label htmlFor="report-city">Thành phố</label>
                <select
                  id="report-city"
                  value={filters.city ?? ""}
                  onChange={(e) =>
                    setFilters({ ...filters, city: e.target.value })
                  }
                >
                  <option value="">Tất cả thành phố</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="report-actions-row">
            <div className="report-tools-left">
              <Button
                variant="default"
                size="sm"
                disabled={loading}
                onClick={() => setFilters({ ...filters })}
              >
                <Search size={14} className="mr-1.5" />
                Xem báo cáo
              </Button>

              {appliedFiltersText && (
                <span className="text-xs text-muted-foreground ml-2">
                  Bộ lọc: {appliedFiltersText}
                </span>
              )}
            </div>

            <div className="report-tools-right">
              {/* Zoom Controls */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginRight: 8,
                }}
              >
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZoomLevel((z) => Math.max(z - 10, 70))}
                  title="Thu nhỏ"
                  style={{ height: 32, padding: "0 8px" }}
                >
                  <ZoomOut size={13} />
                </Button>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    minWidth: 42,
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => setZoomLevel(100)}
                  title="Đặt lại 100%"
                >
                  {zoomLevel}%
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZoomLevel((z) => Math.min(z + 10, 150))}
                  title="Phóng to"
                  style={{ height: 32, padding: "0 8px" }}
                >
                  <ZoomIn size={13} />
                </Button>
                {zoomLevel !== 100 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setZoomLevel(100)}
                    title="Khôi phục kích thước ban đầu"
                    style={{ height: 32, padding: "0 6px" }}
                  >
                    <RotateCcw size={12} />
                  </Button>
                )}
              </div>

              {/* Export Buttons */}
              <Button
                variant="outline"
                size="sm"
                disabled={!a || loading}
                onClick={handleExportExcel}
              >
                <FileSpreadsheet
                  size={14}
                  className="mr-1.5 text-emerald-600"
                />
                Xuất Excel
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={!a || loading}
                onClick={handlePrint}
              >
                <Printer size={14} className="mr-1.5" />
                In / Xuất PDF
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <p className="callout danger" role="alert">
            {error}
          </p>
        )}

        {/* 2. Printable Report Canvas */}
        <div className="report-canvas-viewport">
          <div
            className={`report-sheet ${currentReportMeta.landscape ? "landscape" : ""}`}
            style={{
              transform:
                zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            }}
          >
            {/* Header: Company Info */}
            <div className="report-company-header">
              <div className="report-company-name">
                CÔNG TY CỔ PHẦN DỊCH VỤ TỨC THỜI AHAMOVE
              </div>
              <div className="report-company-sub">
                Hệ thống CRM Tuyển dụng & Vận hành Đối tác Tài xế
              </div>
            </div>

            {/* Title Section */}
            <div className="report-title-section">
              <h1>{currentReportMeta.title}</h1>
              <p className="report-subtitle">Thời gian: {periodText}</p>
              {appliedFiltersText && (
                <p className="report-filter-applied">
                  Áp dụng: {appliedFiltersText}
                </p>
              )}
            </div>

            {/* Table Area */}
            {loading && (
              <p className="text-center py-8 muted">
                Đang tổng hợp số liệu báo cáo…
              </p>
            )}

            {!loading && (
              <>
                {reportType === "intake_source_share" && (
                  <table className="report-data-table">
                    <thead>
                      <tr>
                        <th className="center" style={{ width: 60 }}>
                          STT
                        </th>
                        <th>Nguồn tiếp nhận</th>
                        <th className="right" style={{ width: 180 }}>
                          Số hồ sơ Lead
                        </th>
                        <th className="right" style={{ width: 160 }}>
                          Tỷ trọng (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourcesData.map((s, idx) => (
                        <tr key={s.id}>
                          <td className="center">{idx + 1}</td>
                          <td>
                            <strong>{s.name}</strong>
                          </td>
                          <td className="right">{s.total.toLocaleString()}</td>
                          <td className="right">
                            {percent(s.total, totalLeadsReport1)}
                          </td>
                        </tr>
                      ))}
                      {!sourcesData.length && (
                        <tr>
                          <td colSpan={4} className="center text-muted py-6">
                            Không có hồ sơ trong khoảng thời gian đã chọn.
                          </td>
                        </tr>
                      )}
                      <tr className="total-row">
                        <td className="center">TỔNG CỘNG</td>
                        <td>—</td>
                        <td className="right">
                          {totalLeadsReport1.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalLeadsReport1 > 0 ? "100.0%" : "0%"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {reportType === "intake_source_status" && (
                  <table className="report-data-table">
                    <thead>
                      <tr>
                        <th className="center" style={{ width: 50 }}>
                          STT
                        </th>
                        <th>Nguồn tiếp nhận</th>
                        <th className="right" style={{ width: 120 }}>
                          Tổng số hồ sơ
                        </th>
                        <th className="right" style={{ width: 90 }}>
                          New
                        </th>
                        <th className="right" style={{ width: 100 }}>
                          Activated
                        </th>
                        <th className="right" style={{ width: 110 }}>
                          Onboarded
                        </th>
                        <th className="right" style={{ width: 90 }}>
                          Closed
                        </th>
                        <th className="right" style={{ width: 150 }}>
                          Số hồ sơ có SĐT sai
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourcesData.map((s, idx) => (
                        <tr key={s.id}>
                          <td className="center">{idx + 1}</td>
                          <td>
                            <strong>{s.name}</strong>
                          </td>
                          <td className="right">{s.total.toLocaleString()}</td>
                          <td className="right">{s.New.toLocaleString()}</td>
                          <td className="right">
                            {s.Activated.toLocaleString()}
                          </td>
                          <td className="right">
                            {s.Onboarded.toLocaleString()}
                          </td>
                          <td className="right">{s.Closed.toLocaleString()}</td>
                          <td className="right">
                            {s.wrongPhone.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {!sourcesData.length && (
                        <tr>
                          <td colSpan={8} className="center text-muted py-6">
                            Không có hồ sơ trong khoảng thời gian đã chọn.
                          </td>
                        </tr>
                      )}
                      <tr className="total-row">
                        <td className="center">TỔNG CỘNG</td>
                        <td>—</td>
                        <td className="right">
                          {totalsReport2.total.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport2.New.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport2.Activated.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport2.Onboarded.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport2.Closed.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport2.wrongPhone.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {reportType === "telesale_performance" && (
                  <table className="report-data-table">
                    <thead>
                      <tr>
                        <th className="center" style={{ width: 50 }}>
                          STT
                        </th>
                        <th style={{ width: 120 }}>Mã chuyên viên</th>
                        <th>Họ tên chuyên viên</th>
                        <th className="right" style={{ width: 140 }}>
                          Số phiếu được giao
                        </th>
                        <th className="right" style={{ width: 140 }}>
                          Số phiếu chưa liên hệ
                        </th>
                        <th className="right" style={{ width: 140 }}>
                          Số phiếu đang tư vấn
                        </th>
                        <th className="right" style={{ width: 150 }}>
                          Số phiếu đã giải quyết
                        </th>
                        <th className="right" style={{ width: 130 }}>
                          Số phiếu đã đóng
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(a?.performance ?? []).map((p, idx) => (
                        <tr key={p.id}>
                          <td className="center">{idx + 1}</td>
                          <td>
                            <code className="text-xs font-mono">{p.id}</code>
                          </td>
                          <td>
                            <strong>{member(p.id)}</strong>
                          </td>
                          <td className="right">{p.total.toLocaleString()}</td>
                          <td className="right">{p.New.toLocaleString()}</td>
                          <td className="right">{p.Open.toLocaleString()}</td>
                          <td className="right">{p.Solved.toLocaleString()}</td>
                          <td className="right">{p.Closed.toLocaleString()}</td>
                        </tr>
                      ))}
                      {!a?.performance?.length && (
                        <tr>
                          <td colSpan={8} className="center text-muted py-6">
                            Không có phiếu công việc trong khoảng thời gian đã
                            chọn.
                          </td>
                        </tr>
                      )}
                      <tr className="total-row">
                        <td className="center">TỔNG CỘNG</td>
                        <td>—</td>
                        <td>{a?.performance?.length ?? 0} chuyên viên</td>
                        <td className="right">
                          {totalsReport3.total.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport3.New.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport3.Open.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport3.Solved.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport3.Closed.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {reportType === "telesale_contact_result" && (
                  <table className="report-data-table">
                    <thead>
                      <tr>
                        <th className="center" style={{ width: 50 }}>
                          STT
                        </th>
                        <th style={{ width: 110 }}>Mã chuyên viên</th>
                        <th>Họ tên chuyên viên</th>
                        <th className="right" style={{ width: 130 }}>
                          Tỷ lệ liên hệ thành công (%)
                        </th>
                        <th className="right" style={{ width: 120 }}>
                          Tỷ lệ không nghe máy (%)
                        </th>
                        <th className="right" style={{ width: 110 }}>
                          Tỷ lệ sai SĐT (%)
                        </th>
                        <th className="right" style={{ width: 110 }}>
                          Tỷ lệ đồng ý (%)
                        </th>
                        <th className="right" style={{ width: 130 }}>
                          Tỷ lệ không đồng ý (%)
                        </th>
                        <th className="right" style={{ width: 110 }}>
                          Tỷ lệ cúp ngang (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(a?.performance ?? []).map((p, idx) => (
                        <tr key={p.id}>
                          <td className="center">{idx + 1}</td>
                          <td>
                            <code className="text-xs font-mono">{p.id}</code>
                          </td>
                          <td>
                            <strong>{member(p.id)}</strong>
                          </td>
                          <td className="right">
                            {percent(p.called, p.total)}
                          </td>
                          <td className="right">
                            {percent(p.no_answer, p.total)}
                          </td>
                          <td className="right">
                            {percent(p.wrong_phone, p.total)}
                          </td>
                          <td className="right">
                            {percent(p.agreed, p.total)}
                          </td>
                          <td className="right">
                            {percent(p.declined, p.total)}
                          </td>
                          <td className="right">
                            {percent(p.hungup, p.total)}
                          </td>
                        </tr>
                      ))}
                      {!a?.performance?.length && (
                        <tr>
                          <td colSpan={9} className="center text-muted py-6">
                            Không có kết quả tư vấn trong khoảng thời gian đã
                            chọn.
                          </td>
                        </tr>
                      )}
                      <tr className="total-row">
                        <td className="center">TỔNG CỘNG</td>
                        <td>—</td>
                        <td>
                          TOÀN ĐỘI ({a?.performance?.length ?? 0} chuyên viên)
                        </td>
                        <td className="right">{totalsReport4.calledRate}</td>
                        <td className="right">{totalsReport4.noAnswerRate}</td>
                        <td className="right">
                          {totalsReport4.wrongPhoneRate}
                        </td>
                        <td className="right">{totalsReport4.agreedRate}</td>
                        <td className="right">{totalsReport4.declinedRate}</td>
                        <td className="right">{totalsReport4.hungupRate}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {reportType === "telesale_lead_conversion" && (
                  <table className="report-data-table">
                    <thead>
                      <tr>
                        <th className="center" style={{ width: 50 }}>
                          STT
                        </th>
                        <th>Chuyên viên</th>
                        <th>Nguồn Lead</th>
                        <th style={{ width: 110 }}>Thành phố</th>
                        <th className="right" style={{ width: 120 }}>
                          Số Lead tiếp nhận
                        </th>
                        <th className="right" style={{ width: 130 }}>
                          Số Lead đồng ý đăng ký
                        </th>
                        <th className="right" style={{ width: 120 }}>
                          Số Lead Activated
                        </th>
                        <th className="right" style={{ width: 120 }}>
                          Số Lead Onboarded
                        </th>
                        <th className="right" style={{ width: 140 }}>
                          Tỷ lệ chuyển đổi thành công (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversionDetails.map((r, idx) => (
                        <tr key={`${r.memberId}-${r.sourceId}-${r.city}`}>
                          <td className="center">{idx + 1}</td>
                          <td>
                            <strong>{member(r.memberId)}</strong>
                          </td>
                          <td>{sourceName(r.sourceId)}</td>
                          <td>{r.city}</td>
                          <td className="right">{r.total.toLocaleString()}</td>
                          <td className="right">{r.agreed.toLocaleString()}</td>
                          <td className="right">
                            {r.registered.toLocaleString()}
                          </td>
                          <td className="right">
                            {r.onboarded.toLocaleString()}
                          </td>
                          <td className="right">
                            {percent(r.onboarded, r.total)}
                          </td>
                        </tr>
                      ))}
                      {!conversionDetails.length && (
                        <tr>
                          <td colSpan={9} className="center text-muted py-6">
                            Không có hồ sơ chuyển đổi trong khoảng thời gian đã
                            chọn.
                          </td>
                        </tr>
                      )}
                      <tr className="total-row">
                        <td className="center">TỔNG CỘNG</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td className="right">
                          {totalsReport5.total.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport5.agreed.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport5.registered.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport5.onboarded.toLocaleString()}
                        </td>
                        <td className="right">
                          {totalsReport5.conversionRate}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* Footer: Notes & Signatures */}
            <div className="report-footer-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  fontSize: 12,
                  fontStyle: "italic",
                  color: "#475569",
                }}
              >
                TP. Hồ Chí Minh, ngày {dayStr} tháng {monthStr} năm {yearStr}
              </div>

              <div className="report-signature-block">
                <div className="report-signature-box">
                  <strong>NGƯỜI LẬP BÁO CÁO</strong>
                  <span>(Ký, ghi rõ họ tên)</span>
                  <div className="report-signature-spacer" />
                  <div className="report-signature-name">{actor.name}</div>
                </div>

                <div className="report-signature-box">
                  <strong>NGƯỜI DUYỆT</strong>
                  <span>(Ký, ghi rõ họ tên, chức vụ quản lý)</span>
                  <div className="report-signature-spacer" />
                  <div className="report-signature-name">
                    Trưởng bộ phận Vận hành
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Guard>
  );
}
