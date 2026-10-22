# Hộp thư đa kênh và Facebook Messenger

Cập nhật 22/10/2026. Phân hệ **Hộp thư** (`/inbox`, vai trò Tiếp nhận/Admin) gom mọi liên hệ đến chưa thành hồ sơ: tin nhắn Messenger và cuộc gọi hotline. Form đăng ký tài xế tạo hồ sơ trực tiếp (xem tài liệu 11), không đi qua Hộp thư.

## Chức năng

- Danh sách hội thoại: Chưa xử lý / Tất cả (Đã gắn hồ sơ, Rác, Đã đóng), lọc kênh, tìm kiếm, số chưa đọc trên menu.
- Hội thoại: tin đến, tin page gửi (kể cả trả lời từ Meta Business Suite), ghi chú nội bộ, sự kiện hệ thống.
- Trả lời Messenger trong cửa sổ 24 giờ kể từ tin cuối của tài xế (quy định của Meta). Quá 24 giờ: chỉ ghi chú, gọi điện.
- Cột hồ sơ: nhập SĐT → kiểm tra trùng → **Gắn vào hồ sơ** (ghi thêm một lần tiếp nhận nếu hồ sơ Mới/Đóng) hoặc **Tạo lead** (điền sẵn tên, nguồn theo kênh) và tự gắn.
- **Ghi cuộc gọi đến**: số, tên, gọi nhỡ, nội dung → vào Hộp thư như một hội thoại hotline.

## Thành phần

| Thành phần | Đường dẫn |
|---|---|
| Bảng, quyền, lệnh | `app/backend/supabase/schemas/22_lead_sale_inbox.sql` = migration `20261022020000_inbox.sql` |
| Webhook + gửi tin | `app/backend/supabase/functions/facebook/index.ts` (Supabase Edge Function `facebook`) |
| Giao diện | `app/src/components/lead-sale/Inbox.tsx`, dữ liệu `inbox-store.ts` |

Bảo mật: chỉ Admin/Tiếp nhận đọc được hội thoại (RLS). Webhook chỉ nhận yêu cầu có chữ ký `X-Hub-Signature-256` hợp lệ theo App Secret và đúng `FB_PAGE_ID`. Gửi tin kiểm tra quyền người gửi bằng JWT của họ. Token/App Secret chỉ nằm trong Supabase Secrets và file `app/.env.facebook.local` (đã gitignore).

## Triển khai

1. **Áp migration** (cần đồng ý vì đổi DB thật): từ `app/`, `npm run db:migrate`. Chạy trong một transaction, sao lưu trước vào `.playwright-mcp/`, tự rollback nếu dữ liệu cũ thay đổi.
2. **Tạo Edge Function** trên Supabase Dashboard → Edge Functions → *Deploy a new function* → *Via Editor*: tên `facebook`, dán nội dung `functions/facebook/index.ts`, **tắt "Verify JWT"** (Meta không gửi JWT; webhook xác thực bằng chữ ký), Deploy.
3. **Secrets** (Edge Functions → Secrets): `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN` lấy từ `app/.env.facebook.local`. Tùy chọn `FB_GRAPH_VERSION` (mặc định `v23.0`).
4. **Meta App → Messenger → Cài đặt API Messenger → 1. Đặt cấu hình webhook**: URL gọi lại `https://<project-ref>.supabase.co/functions/v1/facebook`, Xác minh mã = `FB_VERIFY_TOKEN` → *Xác minh và lưu*.
5. **Đăng ký sự kiện cho page**: `messages`, `message_echoes`, `messaging_postbacks`, `messaging_referrals`, `message_reads`.
6. **Thử**: tài khoản có vai trò trong app (Quản trị viên/Người dùng thử) nhắn vào page → tin hiện trong Hộp thư trong ≤20 giây.

## Giới hạn

- App ở chế độ phát triển: chỉ người có vai trò trong app nhắn được. Mở cho mọi người cần App Review quyền `pages_messaging` (Advanced) và xác minh doanh nghiệp — làm dưới Business của AhaMove.
- Messenger không cung cấp SĐT; nhân viên hỏi trong chat rồi nhập.
- Hotline hiện ghi tay; khi có tổng đài (Stringee/CareSoft…) thì đẩy cuộc gọi vào cùng `lead_inbox_receive`.
