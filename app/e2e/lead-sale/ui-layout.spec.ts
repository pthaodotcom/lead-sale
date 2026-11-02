import { test, expect } from "@playwright/test";

for (const width of [1565, 1024, 390]) {
  test(`bộ lọc báo cáo thẳng hàng và không tràn ở ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
    await page.getByRole("menuitemradio", { name: /Trần Minh Trang/ }).click();
    await page.goto("/#/reports");
    const report = page.getByLabel("Loại báo cáo", { exact: true });
    for (const type of [
      "telesale_performance",
      "telesale_contact_result",
      "telesale_lead_conversion",
      "intake_source_share",
      "intake_source_status",
    ]) {
      await report.selectOption(type);
      const boxes = await page
        .locator(".report-filter-row input, .report-filter-row select")
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right, height: r.height };
          }),
        );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
        expect(box.height).toBe(36);
      }
      // Reports with five controls fit on a single row on a wide desktop.
      if (width === 1565 && type !== "telesale_lead_conversion") {
        expect(
          Math.max(...boxes.map((b) => b.y)) -
            Math.min(...boxes.map((b) => b.y)),
        ).toBeLessThan(1);
      }
      // Controls on each wrapped row must have the same top and bottom edges.
      for (const a of boxes)
        for (const b of boxes) {
          if (Math.abs(a.y - b.y) < 10) expect(a.y).toBeCloseTo(b.y, 0);
        }
    }
  });
}

test("hồ sơ dài và hộp thoại phân công nằm trong màn hình điện thoại", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto("/");
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /Lê Ngọc Anh/ }).click();
  await page.goto("/#/leads/LEAD-0001/show");
  await expect(
    page.getByRole("heading", { name: "Thông tin hồ sơ" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /Trần Minh Trang/ }).click();
  await page.goto("/#/tasks");
  await page
    .getByRole("button", { name: "Phân công tư vấn", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(668);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /Nguyễn Hà Linh/ }).click();
  await page.goto("/#/");
  for (const name of [
    "Ghi nhận cuộc gọi & Bằng chứng",
    "Tạo lịch hẹn",
    "Gọi khách hàng",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(668);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  }
});
