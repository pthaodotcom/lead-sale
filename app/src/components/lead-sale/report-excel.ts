export interface ReportExcelConfig {
  reportTitle: string;
  periodText: string;
  filterText?: string;
  headers: string[];
  rows: (string | number)[][];
  totalRow?: (string | number)[];
  creatorName?: string;
  filename: string;
}

export async function exportReportToExcel(config: ReportExcelConfig) {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = config.creatorName || "AhaMove CRM";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Báo cáo", {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: config.headers.length > 7 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const colCount = Math.max(config.headers.length, 4);

  // Row 1: Company Name
  const row1 = sheet.addRow(["CÔNG TY CỔ PHẦN DỊCH VỤ TỨC THỜI AHAMOVE"]);
  row1.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFEA580C" } };

  // Row 2: Subtitle
  const row2 = sheet.addRow(["Hệ thống CRM Tuyển dụng & Quản lý Đối tác Tài xế"]);
  row2.font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FF64748B" } };

  // Row 3: Blank
  sheet.addRow([]);

  // Row 4: Title
  const titleRow = sheet.addRow([config.reportTitle]);
  titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  sheet.mergeCells(4, 1, 4, colCount);
  titleRow.height = 26;

  // Row 5: Period Subtitle
  const periodRow = sheet.addRow([`Thời gian: ${config.periodText}${config.filterText ? ` | ${config.filterText}` : ""}`]);
  periodRow.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
  periodRow.alignment = { horizontal: "center", vertical: "middle" };
  sheet.mergeCells(5, 1, 5, colCount);

  // Row 6: Blank
  sheet.addRow([]);

  // Row 7: Table Headers
  const headerRow = sheet.addRow(config.headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF1E293B" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEDD5" }, // Warm brand amber/orange fill
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FFEA580C" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Data Rows
  config.rows.forEach((r, idx) => {
    const row = sheet.addRow(r);
    row.height = 20;
    const isEven = idx % 2 === 1;
    row.eachCell((cell, colIndex) => {
      cell.font = { name: "Arial", size: 9.5, color: { argb: "FF334155" } };
      if (isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      // Alignment logic based on value or column index
      const val = cell.value;
      if (colIndex === 1) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (typeof val === "number") {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if (typeof val === "string" && val.endsWith("%")) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  // Total Row
  if (config.totalRow) {
    const totalRow = sheet.addRow(config.totalRow);
    totalRow.height = 24;
    totalRow.eachCell((cell, colIndex) => {
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF9A3412" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFEDD5" },
      };
      cell.border = {
        top: { style: "medium", color: { argb: "FFEA580C" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "double", color: { argb: "FFEA580C" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
      if (colIndex === 1) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (typeof cell.value === "number" || (typeof cell.value === "string" && cell.value.endsWith("%"))) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  }

  // Auto-fit column widths
  sheet.columns.forEach((column) => {
    let maxLen = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value?.toString() || "";
      if (v.length > maxLen && v.length < 50 && !v.includes("CÔNG TY") && !v.includes("BÁO CÁO")) {
        maxLen = v.length;
      }
    });
    column.width = Math.min(Math.max(maxLen + 4, 12), 40);
  });

  // Footer: Signatures
  sheet.addRow([]);
  const dateStr = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  const locationRow = sheet.addRow([]);
  sheet.getCell(locationRow.number, colCount).value = `TP. Hồ Chí Minh, ngày ${dateStr.split("/")[0]} tháng ${dateStr.split("/")[1]} năm ${dateStr.split("/")[2]}`;
  sheet.getCell(locationRow.number, colCount).font = { name: "Arial", size: 9.5, italic: true };
  sheet.getCell(locationRow.number, colCount).alignment = { horizontal: "right" };

  const signTitleRow = sheet.addRow([]);
  sheet.getCell(signTitleRow.number, 2).value = "NGƯỜI LẬP BÁO CÁO";
  sheet.getCell(signTitleRow.number, 2).font = { name: "Arial", size: 10, bold: true };
  sheet.getCell(signTitleRow.number, 2).alignment = { horizontal: "center" };

  sheet.getCell(signTitleRow.number, colCount).value = "NGƯỜI DUYỆT";
  sheet.getCell(signTitleRow.number, colCount).font = { name: "Arial", size: 10, bold: true };
  sheet.getCell(signTitleRow.number, colCount).alignment = { horizontal: "center" };

  const signSubRow = sheet.addRow([]);
  sheet.getCell(signSubRow.number, 2).value = "(Ký, ghi rõ họ tên)";
  sheet.getCell(signSubRow.number, 2).font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF64748B" } };
  sheet.getCell(signSubRow.number, 2).alignment = { horizontal: "center" };

  sheet.getCell(signSubRow.number, colCount).value = "(Ký, ghi rõ họ tên, chức vụ)";
  sheet.getCell(signSubRow.number, colCount).font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF64748B" } };
  sheet.getCell(signSubRow.number, colCount).alignment = { horizontal: "center" };

  // Spacing for signature
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([]);

  const signNameRow = sheet.addRow([]);
  sheet.getCell(signNameRow.number, 2).value = config.creatorName || "Người lập";
  sheet.getCell(signNameRow.number, 2).font = { name: "Arial", size: 10, bold: true };
  sheet.getCell(signNameRow.number, 2).alignment = { horizontal: "center" };

  sheet.getCell(signNameRow.number, colCount).value = "Trưởng bộ phận Vận hành";
  sheet.getCell(signNameRow.number, colCount).font = { name: "Arial", size: 10, bold: true };
  sheet.getCell(signNameRow.number, colCount).alignment = { horizontal: "center" };

  // Generate buffer and trigger browser download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = config.filename.endsWith(".xlsx") ? config.filename : `${config.filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
