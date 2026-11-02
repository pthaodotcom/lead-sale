# Hướng dẫn nhận source Lead Sale

Bản bàn giao ngày **02/11/2026**. Đọc tài liệu này khi tải ZIP hoặc clone repo sang máy mới.

## 1. Xem thử ngay

1. Cài Node.js 24 trở lên và npm.
2. Giải nén ZIP, mở terminal ở thư mục chứa `README.md`.
3. Chạy:

```sh
cd app
npm ci
npm run dev:demo
```

4. Mở http://127.0.0.1:5173.
5. Bấm **Tài khoản** ở góc trên để đổi vai trò.

Demo không cần đăng nhập và không gọi Supabase. Dữ liệu mẫu lưu riêng trong localStorage của trình duyệt; không phải dữ liệu production. Muốn đưa demo về ban đầu, xóa dữ liệu trang localhost trong trình duyệt.

Trên PowerShell, nếu hệ thống chặn lệnh `npm.ps1`, dùng `npm.cmd` thay cho `npm`.

## 2. Kết nối dữ liệu thật

Bản source không chứa `.env.local`, `.env.server.local` hoặc tài khoản dùng thử. Người quản lý project cấp tài khoản qua kênh riêng. Để dùng project Supabase của bạn:

```powershell
# Chạy tại app/
Copy-Item .env.example .env.local
```

Điền `VITE_SUPABASE_URL` và `VITE_SB_PUBLISHABLE_KEY` của project vào `.env.local`. Chỉ publishable key được dùng phía frontend. Sau đó:

```sh
npm run dev
```

Đăng nhập bằng tài khoản đã được quản trị viên kích hoạt. Tính năng đổi mật khẩu nằm ở **Tài khoản → Đổi mật khẩu**. Chế độ demo chỉ mở trang tài khoản, không đổi mật khẩu thật.

## 3. Dựng backend riêng

Backend hiện hành nằm tại **`app/backend/supabase/`**. Không chạy migration Atomic CRM trong `app/supabase/`.

Sao chép `.env.server.example` thành `.env.server.local`, điền PostgreSQL DSN và đường dẫn CA TLS của project. Không commit file cấu hình này.

**Database mới, chưa có bảng Lead Sale:**

```sh
npm run db:generate
npm run db:apply
npm run db:migrate
```

**Database đã dùng Lead Sale:** đối chiếu phiên bản trước, sao lưu và chỉ chạy forward migration còn thiếu qua `npm run db:migrate`. Không chạy lại bootstrap, reset database hoặc xóa bảng/dữ liệu cũ. Các migration đã áp dụng phải giữ nguyên nội dung.

Để cấp quản trị viên đầu tiên cho project riêng, điền thêm `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `LEAD_ADMIN_EMAIL`, `LEAD_ADMIN_PASSWORD` trong `.env.server.local` rồi chạy:

```sh
node --env-file=.env.server.local scripts/lead-admin.mjs
```

Mật khẩu tối thiểu 10 ký tự. Script từ chối đổi mật khẩu/quyền nếu tài khoản đã tồn tại. Secret key chỉ dùng ở server/terminal, không đặt trong biến `VITE_*`.

Mô hình dữ liệu có bảng quan hệ và `private.compat_*`; ghi nghiệp vụ qua RPC để giữ đồng bộ. Xem [tài liệu 17](17-chuyen-bang-supabase-theo-tai-lieu.md).

## 4. Kiểm tra và đóng gói frontend

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Bản build nằm ở `app/dist/`. Khi thay cấu hình Supabase cần build lại. Để kiểm tra luồng demo bằng Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

Kiểm thử cloud cần môi trường và tài khoản riêng; không chạy thay cho demo. Việc bàn giao source không tự triển khai frontend, chạy migration trên database thật hoặc thay đổi tài khoản production.

## 5. Nội dung bản bàn giao

- Giữ source hiện có cùng các cập nhật local về tài khoản, báo cáo, workflow và migration tương thích.
- Quản trị viên không còn mục **Tài khoản của tôi** ở menu; **Đổi mật khẩu** vẫn mở trang tài khoản.
- Tiếp nhận hồ sơ không còn mục **Lịch hẹn** ở menu; Trưởng nhóm và Telesale giữ mục này.
- Giữ giấy phép và source Atomic CRM để tham khảo. README gốc ở `app/README.atomic-crm.md`.
- Không kèm `.git`, `.env` đang dùng, mật khẩu, khóa server, backup/runtime, `node_modules`, log, báo cáo kiểm thử hoặc `dist` trong ZIP source.

Các tài liệu vận hành trước đây là bản ghi theo ngày; đối chiếu lại môi trường thật trước khi vận hành. Bản bàn giao không cam kết mọi workflow production đã được kiểm thử.

## 6. Kết quả kiểm tra bản bàn giao ngày 02/11/2026

- TypeScript và production build: đạt (có cảnh báo kích thước bundle).
- ESLint cho phạm vi ứng dụng đang dùng: đạt.
- Vitest: **125/125** kiểm thử đạt, gồm nghiệp vụ và SQL chạy local bằng PGlite.
- Playwright demo: **18/18** kiểm thử đạt, gồm tài khoản, tiếp nhận, nhập CSV/XLSX, workflow, báo cáo và bố cục responsive.
- Kiểm tra riêng menu ở **1440 px** và **390 px**: hai mục đã bỏ đúng vai trò; Đổi mật khẩu mở trang tài khoản; Trưởng nhóm/Telesale vẫn có Lịch hẹn.
- Đối chiếu các migration hiện có bằng `db:generate`: đạt; không kết nối hay thay đổi database thật.
- Quét file dự kiến đưa lên Git: không có `.env` đang dùng, thư mục runtime/build, private key hoặc token khớp các mẫu nhận diện đã kiểm tra. Đây không phải cam kết kiểm toán bảo mật toàn bộ lịch sử Git.

Máy kiểm tra đang dùng Node.js **22.21.0**; bộ Playwright cần cờ `--no-experimental-require-module` để tránh lỗi nạp dependency của Node 22. Yêu cầu cài đặt cho người nhận vẫn là **Node.js 24+** theo `app/package.json`. Kết quả trên là local/demo, không xác nhận mọi workflow hay bản triển khai production hiện tại.
