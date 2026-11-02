import { test, expect } from "@playwright/test";
for (const width of [1440, 390])
  test(`Admin dùng một menu và form vừa màn hình ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Người dùng", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Mục cài đặt" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Thêm người dùng", exact: true })
      .click();
    await expect(page.getByLabel("Vai trò *", { exact: true })).toHaveValue(
      "telesale",
    );
    await expect(
      page.getByLabel("Nhóm làm việc *", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Vai trò *", { exact: true }).selectOption("intake");
    await expect(
      page.getByLabel("Nhóm làm việc *", { exact: true }),
    ).toHaveCount(0);
    const dialog = page.getByRole("dialog");
    expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await page.keyboard.press("Escape");
    await page.goto("/#/admin/teams");
    await expect(page).toHaveURL(/admin\/users/);
    await expect(page.getByRole("button", { name: "Thêm nhóm" })).toHaveCount(
      0,
    );
  });
test("Admin tạo đầy đủ quyền, sửa, lọc và tạm ngưng tài khoản", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Thêm người dùng", exact: true })
    .click();
  await page.getByLabel("Họ và tên *", { exact: true }).fill("Nguyễn Mai Anh");
  await page
    .getByLabel("Email đăng nhập *", { exact: true })
    .fill("mai.anh@example.com");
  await page
    .getByLabel("Mật khẩu ban đầu *", { exact: true })
    .fill("LocalTestOnly123!");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "mai.anh@example.com" });
  await expect(row).toContainText("Telesale");
  await expect(row).toContainText("Hoạt động");
  await row
    .getByRole("button", { name: "Sửa tài khoản Nguyễn Mai Anh", exact: true })
    .click();
  await page
    .getByLabel("Họ và tên *", { exact: true })
    .fill("Nguyễn Mai Anh Mới");
  await page
    .getByLabel("Trạng thái tài khoản", { exact: true })
    .selectOption("disabled");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(row).toContainText("Nguyễn Mai Anh Mới");
  await expect(row).toContainText("Tạm ngưng");
  await page.getByRole("button", { name: /^Tạm ngưng/ }).click();
  await expect(page.locator(".admin-users-table tbody tr")).toHaveCount(1);
});
test("lỗi đổi quyền không lưu một phần tên và hiện ngay trên form", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Sửa tài khoản Nguyễn Hà Linh", exact: true })
    .click();
  await page
    .getByLabel("Họ và tên *", { exact: true })
    .fill("Tên Không Được Lưu");
  await page
    .getByLabel("Trạng thái tài khoản", { exact: true })
    .selectOption("disabled");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Chuyển",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("row").filter({ hasText: "Nguyễn Hà Linh" }),
  ).toHaveCount(1);
  await expect(
    page.getByText("Tên Không Được Lưu", { exact: true }),
  ).toHaveCount(0);
});
