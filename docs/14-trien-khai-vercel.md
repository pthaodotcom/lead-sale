# AhaMove Lead trên Vercel

## Cập nhật production 26/10/2026

- Vercel deployment `dpl_5hVq9bGGFqXyPt5rvZcy1ZuJsg8f`, READY, production; tên miền chính https://ahamove-lead.vercel.app.
- Build từ workspace hiện tại bằng `lead-build-vercel.mjs`, kiểm tra TypeScript đạt, chỉ tải tài nguyên frontend đã biên dịch lên Vercel.
- Supabase: chạy `lead-migrate.mjs`, đối chiếu hash tất cả migration đến `20261026010000_relational_tables.sql`, yêu cầu tải lại PostgREST schema. Các migration đã có được giữ nguyên; không chạy lại bootstrap. Kiểm tra bảo toàn toàn bộ tài nguyên đạt: 97 Lead, 82 phiếu, 109 hoạt động tại thời điểm chạy.
- Sau deploy, kiểm tra Supabase RPC và SELECT các bảng quan hệ bằng bốn vai trò Admin/Tiếp nhận/Trưởng nhóm/Telesale đạt; ẩn danh không đọc được bảng Lead.
- Browser production: cả bốn vai trò đăng nhập và render ứng dụng thành công, không ghi nhận `pageerror`. Đây là smoke test đăng nhập/render; không thay thế toàn bộ kiểm thử nghiệp vụ trên trình duyệt.
- Bản chuyển cấu trúc CSDL và giới hạn lớp tương thích được mô tả tại [tài liệu 17](17-chuyen-bang-supabase-theo-tai-lieu.md).


## Cập nhật production 25/10/2026

- Deployment: `dpl_4PS2i6MzfxXKYKTcMkBWk1mXhXH6`, trạng thái READY, target production.
- Tên miền chính: https://ahamove-lead.vercel.app
- URL phiên bản: https://ahamove-lead-2ko657znl-phuongthao2005daodao-3053s-projects.vercel.app
- Nội dung: bản QA giao diện 25/10, gồm căn hàng bộ lọc, responsive bảng/hộp thoại, tinh gọn chú thích và sửa thời gian liên hệ mặc định.
- Loại dữ liệu tài khoản thử nghiệm khỏi JavaScript production bằng điều kiện build `import.meta.env.DEV`; kiểm tra trực tiếp gói đã biên dịch, không chỉ kiểm tra phần hiển thị.
- Chỉ triển khai frontend đã biên dịch; không chạy migration hay tạo hồ sơ kiểm thử trên production.
- Xác minh sau deploy: tên miền chính trả HTTP 200; SHA-256 của JavaScript public khớp bản build local. Đăng nhập thật Quản trị/Tiếp nhận/Trưởng nhóm thành công; trang báo cáo tải dữ liệu không báo lỗi, năm ô lọc cùng tọa độ trên và chiều cao 36 px; báo cáo và form tài xế không tràn ngang ở 390 px. Không có lỗi JavaScript trong các phiên đã kiểm tra.

Vercel CLI hiện lưu phiên tại thư mục bị gitignore `app/.vercel-deploy/cli-auth` vì ghi phiên ở thư mục mặc định gặp lỗi `cross-device link not permitted`. Khi chạy các lệnh Vercel bên dưới, thêm `--global-config "C:/Users/Admin/Documents/ChatGPT/lead sale/app/.vercel-deploy/cli-auth"`. Không đưa thư mục phiên vào gói triển khai; thư mục deploy vẫn là `.vercel-deploy/ahamove-lead`.

## Triển khai ban đầu

Đã triển khai production ngày 22/10/2026.

- Ứng dụng: https://ahamove-lead.vercel.app
- Form tài xế: https://ahamove-lead.vercel.app/#/dang-ky-tai-xe
- Team: `phuongthao2005daodao-3053s-projects`
- Project: `ahamove-lead` (`prj_piUjo4flGPpYDKFDFLRayf9zqwrK`)
- Deployment đầu tiên: `dpl_6DFGVZmgDScPhJL9tP9vDgiqXB4b`, trạng thái READY.

Frontend dùng Supabase hiện có; không sao chép hoặc thay database. Dựng từ workspace hiện tại bằng TypeScript và Vite, rồi đưa riêng các tài nguyên đã biên dịch lên Vercel Build Output API v3. File tài khoản dùng thử, cấu hình server và khóa quản trị không nằm trong gói triển khai. Danh sách tài khoản điền sẵn chỉ có ở development trên máy local.

## Cập nhật bản triển khai

Chạy từ thư mục `app` (Node 24+, đã cài dependencies và đăng nhập Vercel CLI):

```powershell
node scripts/lead-build-vercel.mjs
pnpm dlx vercel link --project ahamove-lead --scope phuongthao2005daodao-3053s-projects --yes --cwd .vercel-deploy/ahamove-lead
pnpm dlx vercel deploy --prebuilt --prod --archive=tgz --scope phuongthao2005daodao-3053s-projects --yes --cwd .vercel-deploy/ahamove-lead
```

Script đọc các biến VITE Supabase từ `.env.local`. Nó đặt link form và nhận cuộc gọi sang tên miền Vercel; có thể đổi origin bằng `LEAD_PUBLIC_URL` khi cần. Thư mục `.vercel-deploy` bị gitignore. Chưa kết nối triển khai tự động từ GitHub; lần sau chạy lại các lệnh trên để đưa nội dung workspace lên.

Đã kiểm tra HTTP 200, JavaScript/logo trả đúng MIME, đăng nhập thật bằng tài khoản Tiếp nhận và tải được workspace. Bản production không chứa email/mật khẩu dùng thử hoặc endpoint cấp danh sách local. Với tính năng khôi phục mật khẩu, cần giữ URL Vercel trong Supabase Auth Redirect URLs cho các email được gửi từ tên miền này.
