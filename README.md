# Lead Sale — ghi nhận đề tài

Hệ thống quản lý Lead tài xế dựa trên Atomic CRM, bám yêu cầu Google Doc. Bản tại `app/` đã dùng Supabase Auth, PostgreSQL/RLS và Storage thật; có tiếp nhận/import, phân công, tư vấn, lịch hẹn, nhắc việc/tự đóng trên máy chủ, bàn giao, báo cáo và quản trị. Ngày cập nhật: **21/10/2026**.

Chạy tại `app/` với Node 24+: `npm ci --legacy-peer-deps`, rồi `npm run dev`. Web mặc định `http://127.0.0.1:5173`. `.env.local` chứa URL/publishable key; `.env.server.local` riêng chứa cấu hình DB/CA cho máy chủ, không đưa vào Git. Chế độ xem thử độc lập: `npm run dev:demo`.

**22/10/2026 — làm lại theo đặc tả BA:** yêu cầu được định nghĩa lại tại [docs/09-dac-ta-nghiep-vu-ba.md](docs/09-dac-ta-nghiep-vu-ba.md) (quy trình, use case, FR/BR, ma trận menu theo vai trò, danh sách màn hình). Giao diện dựng lại toàn bộ: điều hướng nhóm theo công việc và vai trò, Nhiệm vụ có mục con kèm số đếm, phiếu tư vấn 3 cột, Điều phối giao hàng loạt, Tổng quan riêng cho từng vai trò. **Đã bỏ hệ thống tài xế giả lập** (màn Tài xế giả lập/Đối soát nguồn, server Node 5180, test e2e core); bảng/hàm giả lập trong DB Supabase vẫn còn, không được app dùng — xóa bằng migration riêng khi cần.

Đọc [bàn giao, cấu hình, API và kết quả kiểm chứng](docs/06-ban-giao-va-van-hanh.md). Backend đang dùng nằm tại **`app/backend/supabase/`**; thư mục `app/supabase/` là backend gốc được giữ lại, không chạy migration của thư mục đó vào project Lead Sale.

## Tài liệu làm việc

- [Form tài xế tự đăng ký — link công khai, cấu hình và vận hành](docs/11-form-tai-xe-tu-dang-ky.md).

- **[Đặc tả nghiệp vụ BA — bản hiện hành](docs/09-dac-ta-nghiep-vu-ba.md).**
- [Kết quả triển khai giả lập core và sửa nghiệp vụ](docs/08-ket-qua-gia-lap-core-va-khac-phuc.md) — lịch sử, phần giả lập đã bỏ.
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
