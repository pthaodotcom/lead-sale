# Lead Sale — ghi nhận đề tài

Hệ thống quản lý Lead tài xế dựa trên Atomic CRM, bám yêu cầu Google Doc. Bản tại `app/` đã dùng Supabase Auth, PostgreSQL/RLS và Storage thật; có tiếp nhận/import, phân công, tư vấn, lịch hẹn, nhắc việc/tự đóng trên máy chủ, bàn giao, báo cáo và quản trị. Ngày cập nhật: **21/10/2026**.

Chạy tại `app/` với Node 24+: `npm ci --legacy-peer-deps`, chạy `npm run dev:core` và ở terminal thứ hai `npm run dev`. Web mặc định `http://127.0.0.1:5173`, API nguồn 5180. `.env.local` chứa URL/publishable key; `.env.server.local` riêng chứa cấu hình DB/CA cho máy chủ, không đưa vào Git. Chế độ xem thử độc lập: `npm run dev:demo`.

**Đã triển khai nguồn tài xế giả lập:** Admin mở **Tài xế giả lập** để tạo/liên kết tài xế và gửi tình huống đăng ký/đơn đầu qua API về Lead Sale. Admin/Tiếp nhận mở **Đối soát nguồn** để xem kết quả. Đã sửa tiếp nhận/sửa hồ sơ, đính chính kết quả/hoạt động/lịch, bàn giao, chat chưa phản hồi, lịch sử chuyển người, lô nhập và retry. [Cách thử, API, kiểm chứng và phần còn phụ thuộc môi trường](docs/08-ket-qua-gia-lap-core-va-khac-phuc.md).

Đọc [bàn giao, cấu hình, API và kết quả kiểm chứng](docs/06-ban-giao-va-van-hanh.md). Backend đang dùng nằm tại **`app/backend/supabase/`**; thư mục `app/supabase/` là backend gốc được giữ lại, không chạy migration của thư mục đó vào project Lead Sale.

## Tài liệu làm việc

- [Kết quả triển khai giả lập core và sửa nghiệp vụ](docs/08-ket-qua-gia-lap-core-va-khac-phuc.md).
- [Kế hoạch và quyết định xử lý 41 điểm rà soát](docs/07-ke-hoach-gia-lap-core-va-khac-phuc.md). Gọi/chat thủ công, bỏ Telegram; xem tài liệu 08 để biết phần đã triển khai và giới hạn còn lại.
- [Yêu cầu, quy tắc, điểm cần chốt và checklist nghiệm thu](docs/01-yeu-cau-de-tai.md).
- [Đối chiếu Atomic CRM, khoảng thiếu và hướng kỹ thuật](docs/02-doi-chieu-atomic-crm.md).
- [Ghi chú triển khai: đủ 4 tab, hiện trạng app, lựa chọn demo và thứ tự làm tiếp](docs/03-ghi-chu-trien-khai.md).
- [Kế hoạch thực hiện: thứ tự, checklist, phụ thuộc và mốc nghiệm thu](docs/04-ke-hoach-trien-khai.md).
- [Đặc tả bước 1: quyết định, ma trận quyền/workflow, ERD/API và KPI/nghiệm thu](docs/05-dac-ta-buoc-1.md).
- [Bản chụp đọc lại trực tiếp đủ 4 tab và 8 ảnh ngày 21/10/2026](docs/sources/google-doc-2026-10-21.md).
- [Bản chụp đủ 4 tab và 8 ảnh từ Google Doc ngày 20/10/2026](docs/sources/google-doc-2026-10-20.md).

Base tham khảo được ghi nhận trong tài liệu ngày 20/10: [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm), commit `b8e5e20c4dd4b9e440088621283849adf1e1839d`. Đường dẫn `.reference/atomic-crm/` là bản tham khảo ở môi trường trước, được gitignore và không đi cùng repo khi kéo về. Tiếp tục phát triển trên `app/` hiện có; điểm vào `app/src/App.tsx` mở module `app/src/components/lead-sale/`.

Các lần triển khai sau đối chiếu yêu cầu bằng mã R/FR; ghi quyết định cho các câu hỏi Q khi được xác nhận. Không đổi đề xuất hoặc câu hỏi chưa chốt thành yêu cầu chính thức.
