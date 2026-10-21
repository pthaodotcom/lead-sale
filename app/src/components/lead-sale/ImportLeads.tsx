import { useEffect, useState } from "react";
import Papa from "papaparse";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./context";
import { canEditLead, normalizePhone, validateLead } from "./domain";
import { downloadCsv, Empty, Field, Guard, PageHeading } from "./shared";
import type { LeadInput } from "./types";
import { importBatch } from "./backend";
type Row = Record<string, string>;
export function ImportLeads() {
  const { db, actor, perform, cloud, refresh } = useWorkspace();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [fileName, setFileName] = useState("");
  const [batchId, setBatchId] = useState(crypto.randomUUID());
  const [batches, setBatches] = useState<
    {
      id: string;
      fileName: string;
      count: number;
      results: Record<string, { status: string; message: string }>;
    }[]
  >([]);
  useEffect(() => {
    if (cloud && canEditLead(actor))
      void importBatch({ type: "list" })
        .then(setBatches)
        .catch((e) => setError((e as Error).message));
  }, [cloud, actor.id, actor.role]);
  const input = (r: Row): LeadInput => ({
    name: r.name ?? "",
    phone: r.phone ?? "",
    city: r.city ?? "",
    vehicle: r.vehicle as LeadInput["vehicle"],
    sourceId: r.sourceId ?? "",
    tags: (r.tags ?? "").split(",").filter(Boolean),
    note: r.note ?? "",
    ...(r.receivedAt ? { receivedAt: r.receivedAt } : {}),
  });
  const inspect = (r: Row) => {
    const index = rows.indexOf(r);
    if (
      rows
        .slice(0, index)
        .some(
          (x) =>
            normalizePhone(x.phone ?? "") === normalizePhone(r.phone ?? ""),
        )
    )
      return { message: "Trùng SĐT với dòng trước trong file" };
    const existing = db.leads.find(
      (l) => normalizePhone(l.phone) === normalizePhone(r.phone ?? ""),
    );
    if (existing)
      return {
        message: `Trùng ${existing.name}: mở hồ sơ để bổ sung`,
        id: existing.id,
      };
    try {
      validateLead(input(r), db);
      return { message: "Hợp lệ" };
    } catch (e) {
      return { message: (e as Error).message };
    }
  };
  return (
    <Guard allowed={canEditLead(actor)}>
      <PageHeading
        title="Nhập danh sách Lead"
        description="Nhập CSV hoặc Excel XLSX; xem trước và kiểm tra từng dòng."
        back="/leads"
      />
      <section className="form-surface stack-form">
        <p>
          Mỗi file tối đa 500 dòng và 5 MB. Các cột: name, phone, city, vehicle
          (Motorbike/Van), sourceId, note, tags, receivedAt (tùy chọn, ví dụ
          2026-10-01T09:00:00+07:00). Đặt cột SĐT ở dạng văn bản để giữ số 0
          đầu.
        </p>
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv("mau-nhap-lead.csv", [
              ["name", "phone", "city", "vehicle", "sourceId", "note"],
              [
                "Tài xế mẫu",
                "0901234567",
                "Hà Nội",
                "Motorbike",
                db.sources.find((s) => s.active)?.id ?? "web",
                "",
              ],
            ])
          }
        >
          Tải mẫu CSV
        </Button>
        <Field label="Chọn CSV hoặc XLSX">
          <input
            type="file"
            accept=".csv,.xlsx"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setRows([]);
              setResults([]);
              setError("");
              setCompleted(false);
              setFileName(file.name);
              setBatchId(crypto.randomUUID());
              setBusy(true);
              try {
                if (file.size > 5 * 1024 * 1024)
                  throw new Error("File không quá 5 MB.");
                let parsed: Row[];
                if (file.name.toLowerCase().endsWith(".xlsx")) {
                  const ExcelJS = await import("exceljs");
                  const workbook = new ExcelJS.Workbook();
                  await workbook.xlsx.load(await file.arrayBuffer());
                  const sheet = workbook.worksheets[0];
                  if (!sheet) throw new Error("File không có trang tính.");
                  if (sheet.rowCount > 501)
                    throw new Error("Mỗi file tối đa 500 dòng.");
                  const headers: string[] = [];
                  sheet.getRow(1).eachCell((c, i) => {
                    headers[i] = c.text.trim();
                  });
                  parsed = [];
                  sheet.eachRow((r, index) => {
                    if (index === 1) return;
                    const row: Row = {};
                    r.eachCell((c, i) => {
                      if (headers[i]) row[headers[i]] = c.text.trim();
                    });
                    if (Object.values(row).some(Boolean)) parsed.push(row);
                  });
                } else if (file.name.toLowerCase().endsWith(".csv")) {
                  const result = Papa.parse<Row>(await file.text(), {
                    header: true,
                    skipEmptyLines: "greedy",
                    transformHeader: (h) => h.trim(),
                  });
                  if (result.errors.length)
                    throw new Error("CSV không hợp lệ.");
                  parsed = result.data;
                } else throw new Error("Chỉ nhận CSV và XLSX.");
                if (parsed.length > 500)
                  throw new Error("Mỗi file tối đa 500 dòng.");
                if (!parsed.length) throw new Error("File không có dữ liệu.");
                if (
                  !["name", "phone", "city", "vehicle", "sourceId"].every(
                    (k) => k in parsed[0],
                  )
                )
                  throw new Error(
                    "Thiếu cột bắt buộc. Dùng tên cột trong file mẫu.",
                  );
                setRows(parsed);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Field>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {!!rows.length && (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Tài xế / SĐT</th>
                    <th>Kiểm tra</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const check = inspect(r);
                    return (
                      <tr key={i}>
                        <td>{i + 2}</td>
                        <td>
                          {r.name}
                          <small>{r.phone}</small>
                        </td>
                        <td>
                          {check.id ? (
                            <Link to={`/leads/${check.id}/show`}>
                              {check.message}
                            </Link>
                          ) : (
                            check.message
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p>
              Dòng trùng được giữ nguyên để bạn mở hồ sơ và chọn thông tin cần
              bổ sung. Các dòng hợp lệ được lưu độc lập; dòng lỗi có kết quả
              riêng.
            </p>
            <Button
              disabled={busy || completed}
              onClick={async () => {
                setBusy(true);
                const messages: string[] = [];
                try {
                  if (cloud)
                    await importBatch({
                      type: "create",
                      id: batchId,
                      fileName,
                      rows: rows.map(input),
                    });
                  for (const [i, row] of rows.entries()) {
                    try {
                      if (cloud) {
                        const result = await importBatch({
                          type: "row",
                          id: batchId,
                          index: i,
                        });
                        messages.push(
                          `Dòng ${i + 2}: ${result.message} (${result.status}).`,
                        );
                      } else {
                        await perform({ type: "saveLead", input: input(row) });
                        messages.push(`Dòng ${i + 2}: Đã lưu ${row.name}.`);
                      }
                    } catch (e) {
                      messages.push(
                        `Dòng ${i + 2}: Lỗi — ${(e as Error).message}`,
                      );
                    }
                  }
                  setResults(messages);
                  setCompleted(true);
                  if (cloud) {
                    setBatches(await importBatch({ type: "list" }));
                    try {
                      await refresh();
                    } catch {
                      setError(
                        "Đã xử lý lô; chưa tải lại được hồ sơ. Lịch sử lô đã lưu trên máy chủ.",
                      );
                    }
                  }
                } catch (e) {
                  setError((e as Error).message);
                }
                setBusy(false);
              }}
            >
              {" "}
              {busy
                ? "Đang xử lý…"
                : completed
                  ? "Đã xử lý file"
                  : `Nhập ${rows.length} dòng`}
            </Button>
          </>
        )}
        {!!results.length && (
          <div role="status" className="import-results">
            {results.map((r, i) => (
              <p key={i}>{r}</p>
            ))}
          </div>
        )}
        {!rows.length && !busy && (
          <Empty
            title="Chọn file để xem trước"
            description="Dữ liệu chỉ được lưu khi bạn bấm Nhập."
          />
        )}
      </section>
      {cloud && (
        <section className="data-section">
          <div className="section-header">
            <h2>Lịch sử lô nhập</h2>
            <span>{batches.length} lô</span>
          </div>
          {batches.map((b) => (
            <div className="handover-card" key={b.id}>
              <div>
                <strong>{b.fileName}</strong>
                <p>
                  {b.count} dòng ·{" "}
                  {
                    Object.values(b.results).filter((r) => r.status === "saved")
                      .length
                  }{" "}
                  đã lưu ·{" "}
                  {
                    Object.values(b.results).filter(
                      (r) => r.status === "failed",
                    ).length
                  }{" "}
                  lỗi
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  try {
                    const data = await importBatch({ type: "get", id: b.id });
                    setBatchId(b.id as ReturnType<typeof crypto.randomUUID>);
                    setFileName(data.fileName);
                    setRows(
                      data.rows.map((r: LeadInput) => ({
                        ...r,
                        tags: r.tags.join(","),
                      })),
                    );
                    setResults(
                      Object.entries(
                        data.results as Record<
                          string,
                          { status: string; message: string }
                        >,
                      ).map(
                        ([i, r]) =>
                          `Dòng ${Number(i) + 2}: ${r.message} (${r.status}).`,
                      ),
                    );
                    setCompleted(false);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Xem / tiếp tục / thử dòng lỗi
              </Button>
            </div>
          ))}
        </section>
      )}
    </Guard>
  );
}
