# AhaMove Lead trên Vercel

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
