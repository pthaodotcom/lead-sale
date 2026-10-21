import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import pg from "pg";
import { databaseOptions } from "./lead-db.mjs";
if (existsSync(".env.local")) loadEnvFile(".env.local");
const port = Number(process.env.LEAD_CORE_PORT || 5180);
const sourceKey =
  process.env.LEAD_CORE_SOURCE_KEY || randomBytes(32).toString("hex");
const pool = new pg.Pool({ ...databaseOptions(), max: 4 });
const allowedOrigin = process.env.LEAD_WEB_ORIGIN || "http://127.0.0.1:5173";
const url = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SB_PUBLISHABLE_KEY;
if (!url || !publishableKey)
  throw new Error("Set Supabase public URL and key in .env.local.");
function sourceAuthorized(header) {
  const given = Buffer.from(String(header || ""));
  const expected = Buffer.from(sourceKey);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
async function body(req) {
  const parts = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768)
      throw Object.assign(new Error("Payload quá lớn."), { status: 413 });
    parts.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON không hợp lệ."), { status: 400 });
  }
}
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const reply = (status, data) => {
    res.writeHead(status);
    res.end(JSON.stringify(data));
  };
  try {
    if (req.url === "/api/core/health" && req.method === "GET") {
      await pool.query("select 1");
      return reply(200, { ok: true, source: "driver-simulator" });
    }
    if (req.method !== "POST")
      return reply(404, { error: "Không tìm thấy API." });
    if (req.url === "/api/integrations/driver-core/events") {
      if (!sourceAuthorized(req.headers["x-lead-source-key"]))
        return reply(401, { error: "Nguồn gửi chưa xác thực." });
      const event = await body(req);
      const data = (
        await pool.query("select private.lead_core_receive($1::jsonb) result", [
          JSON.stringify(event),
        ])
      ).rows[0].result;
      return reply(data.status === "id_collision" ? 409 : 200, data);
    }
    if (req.url !== "/api/simulator/command")
      return reply(404, { error: "Không tìm thấy API." });
    // No cookie auth, permissive CORS, or trust in client-supplied role/profile.
    if (req.headers.origin && req.headers.origin !== allowedOrigin)
      return reply(403, { error: "Origin không hợp lệ." });
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer "))
      return reply(401, { error: "Đăng nhập trước khi thao tác." });
    const command = await body(req);
    const upstream = await fetch(url + "/rest/v1/rpc/lead_simulator", {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_command: command }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await upstream.json();
    if (!upstream.ok)
      return reply(upstream.status, {
        error: data.message || "Không thể thực hiện thao tác.",
      });
    if (!data.event) return reply(200, data);
    // The simulator commits its source record first, then delivers via HTTP.
    // Failed delivery leaves an unsent outbox entry that can be resent unchanged.
    try {
      const received = await fetch(
        `http://127.0.0.1:${port}/api/integrations/driver-core/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Lead-Source-Key": sourceKey,
          },
          body: JSON.stringify(data.event),
          signal: AbortSignal.timeout(15000),
        },
      );
      return reply(received.status, await received.json());
    } catch {
      return reply(202, {
        status: "unsent",
        message:
          "Đã lưu bản tin nguồn, chưa giao được. Dùng Gửi lại trong lịch sử.",
      });
    }
  } catch (error) {
    // Never return connection strings, SQL or credential material.
    reply(error.status || 500, {
      error:
        error.code === "P0001"
          ? error.message
          : "Dịch vụ chưa xử lý được yêu cầu. Kiểm tra kết nối rồi thử lại.",
    });
  }
});
server.listen(port, "127.0.0.1", () =>
  process.stdout.write(`Core simulator API: http://127.0.0.1:${port}\n`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => void pool.end()));
