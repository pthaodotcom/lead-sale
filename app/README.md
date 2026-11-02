# Lead Sale

Ứng dụng quản lý Lead tài xế bằng React, TypeScript, Vite và Supabase.

## Chạy demo

Yêu cầu Node.js 24 trở lên. Mở terminal tại thư mục `app/`:

```sh
npm ci
npm run dev:demo
```

Mở http://127.0.0.1:5173. Demo dùng dữ liệu mẫu trong trình duyệt, không cần tài khoản hay cấu hình Supabase. Bấm **Tài khoản** để đổi vai trò xem thử.

## Kết nối Supabase

Sao chép `.env.example` thành `.env.local`, điền URL và publishable key của project của bạn, rồi chạy `npm run dev`. File `.env.local` và thông tin đăng nhập không đi cùng source.

Backend hiện hành: **`backend/supabase/`**. Thư mục `supabase/` thuộc bản Atomic CRM tham khảo; không dùng migration của thư mục đó cho Lead Sale.

- [Hướng dẫn bàn giao cho người nhận](../docs/18-huong-dan-nhan-source.md)
- [Kiến trúc, API và vận hành](../docs/06-ban-giao-va-van-hanh.md)
- [Mô hình dữ liệu và lớp tương thích](../docs/17-chuyen-bang-supabase-theo-tai-lieu.md)

## Kiểm tra và build

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Kiểm tra trình duyệt demo: `npx playwright install chromium`, sau đó `npm run test:e2e`. Bộ kiểm tra cloud cần cấu hình riêng, không nằm trong quy trình demo.

## Nguồn gốc

Phát triển từ [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm). Giữ nguyên [giấy phép](LICENSE.md), source tham khảo và [README gốc](README.atomic-crm.md).
