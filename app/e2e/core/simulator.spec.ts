import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
loadEnvFile(".env.local");
const accounts: { email: string; password: string; role: string }[] =
  JSON.parse(readFileSync(".env.accounts.local", "utf8"));
const admin = accounts.find((a) => a.role === "admin")!;
const api = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SB_PUBLISHABLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        for (let n = 0; ; n++) {
          try {
            return await fetch(input, init);
          } catch (error) {
            if (n >= 2) throw error;
          }
        }
      },
    },
  },
);
async function login(page: Page, role: string) {
  const a = accounts.find((a) => a.role === role)!;
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(a.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator("main h1")).toHaveText("Tổng quan tuyển tài xế", {
    timeout: 30000,
  });
}
async function command(c: object, version?: number) {
  const { error } = await api.rpc("lead_command", {
    p_command: c,
    p_request_id: crypto.randomUUID(),
    p_expected_version: version ?? null,
  });
  if (error) throw new Error(error.message);
}
async function snapshot() {
  const { data, error } = await api.rpc("lead_snapshot");
  if (error) throw error;
  return data;
}
test("UI nguồn → HTTP nhận → Supabase, chống trùng, đối soát và responsive", async ({
  page,
  request,
}) => {
  expect(
    (
      await request.post("/api/integrations/driver-core/events", {
        data: { eventId: "unauthorized" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/simulator/command", {
        data: { type: "snapshot" },
      })
    ).status(),
  ).toBe(401);
  const { error } = await api.auth.signInWithPassword({
    email: admin.email,
    password: admin.password,
  });
  if (error) throw error;
  const phone = "09" + String(Date.now() % 100000000).padStart(8, "0"),
    name = "Giả lập nghiệm thu " + Date.now();
  await command({
    type: "saveLead",
    input: {
      name,
      phone,
      city: "Hà Nội",
      vehicle: "Motorbike",
      sourceId: "web",
      tags: ["test", "simulator"],
      note: "Dữ liệu giả để kiểm tra tích hợp nguồn mô phỏng.",
    },
  });
  const lead = (await snapshot()).leads.find(
    (l: { phone: string }) => l.phone === phone,
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await login(page, "admin");
    await page.goto("/#/core-simulator");
    await expect(
      page.getByRole("heading", { name: "Hệ thống tài xế giả lập" }),
    ).toBeVisible();
    await page.getByText("Tạo tài xế giả lập mới", { exact: true }).click();
    await page.getByLabel("Tên tài xế", { exact: true }).fill(name);
    await page.getByLabel("Số điện thoại", { exact: true }).fill(phone);
    await page
      .getByRole("button", { name: "Tạo dữ liệu tài xế", exact: true })
      .click();
    await expect(
      page.getByLabel("Chọn tài xế", { exact: true }),
    ).not.toHaveValue("");
    await page.getByLabel("Lead cùng SĐT được phép thử").selectOption(lead.id);
    await page
      .getByRole("button", { name: "Xác nhận liên kết để thử" })
      .click();
    await expect(
      page.getByText("Đã liên kết:", { exact: false }),
    ).toBeVisible();
    await page
      .getByLabel("Thao tác ở nguồn")
      .selectOption("registration_pending");
    await page
      .getByRole("button", { name: "Lưu ở nguồn và gửi kết quả" })
      .click();
    await expect(page.locator("tbody tr").first()).toContainText(
      "Đã ghi nhận · không đổi Lead",
      { timeout: 30000 },
    );
    expect(
      (await snapshot()).leads.find((l: { id: string }) => l.id === lead.id)
        .status,
    ).toBe("New");
    await page
      .getByLabel("Thao tác ở nguồn")
      .selectOption("registration_completed");
    await page
      .getByRole("button", { name: "Lưu ở nguồn và gửi kết quả" })
      .click();
    await expect(page.locator("tbody tr").first()).toContainText(
      "Đã cập nhật Activated",
      { timeout: 30000 },
    );
    const activated = (await snapshot()).leads.find(
      (l: { id: string }) => l.id === lead.id,
    );
    await page
      .getByRole("button", { name: "Gửi lại cùng bản tin" })
      .first()
      .click();
    await expect(page.locator("tbody tr").first()).toContainText("2 lần nhận");
    expect(
      (await snapshot()).leads.find((l: { id: string }) => l.id === lead.id)
        .version,
    ).toBe(activated.version);
    await page
      .getByLabel("Thao tác ở nguồn")
      .selectOption("first_order_completed");
    await page
      .getByLabel("Mã đơn", { exact: true })
      .fill("ORDER-UI-" + Date.now());
    await page
      .getByRole("button", { name: "Lưu ở nguồn và gửi kết quả" })
      .click();
    await expect(page.locator("tbody tr").first()).toContainText(
      "Đã cập nhật Onboarded",
      { timeout: 30000 },
    );
    await page.reload();
    await expect(page.locator("tbody tr").first()).toContainText("Onboarded", {
      timeout: 30000,
    });
    mkdirSync(".impeccable/review", { recursive: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: ".playwright-mcp/core-e2e-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".playwright-mcp/core-e2e-mobile.png",
      fullPage: true,
    });
    await page.goto(`/#/leads/${lead.id}/show`);
    await expect(
      page.getByRole("heading", { name: "Mốc kết quả và căn cứ" }),
    ).toBeVisible();
    await expect(
      page.getByText("Hệ thống giả lập", { exact: false }).first(),
    ).toBeVisible();
    await page.goto("/#/integrations");
    await expect(page.locator("tbody").first()).toContainText(name, {
      timeout: 30000,
    });
    await page.route("**/api/simulator/command", (route) => route.abort());
    await page.getByRole("button", { name: "Làm mới", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Không kết nối" }),
    ).toBeVisible();
    await page.unroute("**/api/simulator/command");
    expect(errors).toEqual([]);
  } finally {
    const l = (await snapshot()).leads.find(
      (l: { id: string }) => l.id === lead.id,
    );
    if (l && !l.archived)
      await command({ type: "archiveLead", id: l.id }, l.version);
  }
});
test("Telesale không được thao tác giả lập hoặc đối soát", async ({ page }) => {
  await login(page, "telesale");
  for (const route of ["core-simulator", "integrations"]) {
    await page.goto("/#/" + route);
    await expect(
      page.getByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
    ).toBeVisible();
  }
});
test("ghi đã commit nhưng mất phản hồi: thử lại giữ request ID và không nhân đôi hoạt động", async ({
  page,
}) => {
  const auth = await api.auth.signInWithPassword({
    email: admin.email,
    password: admin.password,
  });
  if (auth.error) throw auth.error;
  const phone = "08" + String(Date.now() % 100000000).padStart(8, "0");
  await command({
    type: "saveLead",
    input: {
      name: "Kiểm thử gửi lại " + Date.now(),
      phone,
      city: "Hà Nội",
      vehicle: "Motorbike",
      sourceId: "web",
      tags: ["test"],
      note: "Kiểm tra mất phản hồi sau commit.",
    },
  });
  const initial = await snapshot(),
    lead = initial.leads.find((l: { phone: string }) => l.phone === phone);
  await command({
    type: "assign",
    leadId: lead.id,
    assigneeId: initial.members.find(
      (m: { role: string; active: boolean }) =>
        m.role === "telesale" && m.active,
    ).id,
  });
  const ticket = (await snapshot()).assignments.find(
    (t: { leadId: string }) => t.leadId === lead.id,
  );
  try {
    await login(page, "admin");
    await page.goto(`/#/assignments/${ticket.id}/show`);
    await page
      .getByLabel("Nội dung tư vấn")
      .fill("Hoạt động chỉ được ghi một lần khi gửi lại sau mất phản hồi.");
    const ids: string[] = [];
    let first = true;
    await page.route("**/rest/v1/rpc/lead_command", async (route) => {
      ids.push(route.request().postDataJSON().p_request_id);
      if (first) {
        first = false;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort();
      } else await route.continue();
    });
    await page.getByRole("button", { name: "Lưu kết quả tư vấn" }).click();
    await expect(
      page.locator('[data-sonner-toast][data-type="error"]').first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Lưu kết quả tư vấn" }).click();
    await expect(page.locator(".timeline")).toContainText(
      "Hoạt động chỉ được ghi một lần",
      { timeout: 30000 },
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(
      (await snapshot()).activities.filter(
        (a: { assignmentId: string }) => a.assignmentId === ticket.id,
      ),
    ).toHaveLength(1);
  } finally {
    const t = (await snapshot()).assignments.find(
      (t: { id: string }) => t.id === ticket.id,
    );
    if (t.status !== "Closed")
      await command(
        {
          type: "ticketStatus",
          id: t.id,
          status: "Closed",
          reason: "Kết thúc kiểm thử mạng",
        },
        t.version,
      );
    const s = await snapshot(),
      review = s.reviews.find(
        (r: { assignmentId: string }) => r.assignmentId === ticket.id,
      );
    if (review && !review.reviewedAt)
      await command(
        {
          type: "review",
          id: review.id,
          note: "Dữ liệu kiểm thử",
          result: "eligible",
        },
        review.version ?? 1,
      );
    const l = s.leads.find((l: { id: string }) => l.id === lead.id);
    if (!l.archived)
      await command({ type: "archiveLead", id: l.id }, l.version);
  }
});
