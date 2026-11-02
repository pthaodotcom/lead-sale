# Làm mới dữ liệu production — 25/10/2026

Người dùng đã xác nhận thay toàn bộ dữ liệu nghiệp vụ, giữ tài khoản và danh mục. Thao tác đã commit trên DB mà `ahamove-lead.vercel.app` đang sử dụng; không đổi schema, không chạy lại migration và không đổi cấu hình triển khai frontend.

## Dữ liệu mới

| Nội dung | Số lượng |
| --- | ---: |
| Hồ sơ Lead | 96 |
| Phiếu phân công | 82 |
| Đợt chăm sóc | 82 |
| Lượt liên hệ | 106 |
| Lịch hẹn | 35 |
| Lần tiếp nhận | 96 |
| Phiếu bàn giao | 11 |

Trạng thái hồ sơ: 73 Mới, 12 Đã đăng ký, 9 Đã chạy đơn đầu, 2 Đã đóng. Có 8 hồ sơ mới trong ngày, 14 hồ sơ chưa phân công; các tình huống gồm đang tư vấn, cần gọi lại, lịch hẹn sắp tới, quá hẹn, từ chối, sai số điện thoại và hoàn tất đăng ký/chạy đơn.

Đây là dữ liệu minh họa tổng hợp, không phải thông tin tài xế hay lịch sử liên hệ thật. Tên, điện thoại, khu vực, phương tiện và ghi chú được tạo mới, không sử dụng danh sách khách hàng bên ngoài. Không tạo ghi âm, ảnh chat hoặc bằng chứng giả; các hoạt động lịch sử mẫu không có tệp bằng chứng. Không phát sinh cuộc gọi, tin nhắn hoặc đơn hàng bên ngoài.

## Phạm vi bảo toàn và sao lưu

- Sáu tài khoản và toàn bộ vai trò, phân quyền, nhóm, nguồn, trạng thái cùng lịch sử migration được đối chiếu bằng fingerprint và giữ nguyên.
- Không còn ID hồ sơ cũ trong bảng Lead sau reset.
- Dữ liệu nghiệp vụ cũ, gồm dữ liệu nhập file, inbox, gọi thoại và simulator cũ, đã được xuất trước khi xóa.
- Giữ 11 đối tượng tệp cũ trong Storage riêng tư để phục vụ khôi phục; tham chiếu nghiệp vụ của chúng đã được loại khỏi dữ liệu đang hiển thị.
- Backup và công cụ vận hành nằm trong thư mục bị gitignore `app/.vercel-deploy/data-refresh-20261025/`; không đưa vào bundle frontend, Git hoặc Vercel.

Backup chính: `before-reset-2026-10-25T09-19-51-921Z.json`.

SHA-256: `451f6eb402e3ef90ed6c6264bd30130eb587b4e70b6e86363fb2058c947164ec`.

`refresh.mjs` có chế độ `restore` nhận đường dẫn backup tường minh và kiểm tra checksum. Công cụ sao lưu trạng thái hiện tại trước khi khôi phục, đồng thời từ chối tự khôi phục nếu tài khoản/danh mục đã thay đổi. Chỉ chạy khôi phục khi người dùng yêu cầu. Sequence phiếu được giữ tăng dần để tránh trùng mã.

## Xác minh

- Thử nạp bộ mẫu và khôi phục lại toàn bộ bảng nghiệp vụ trong cùng giao dịch, so sánh dữ liệu với bản gốc rồi rollback trước khi áp dụng thật.
- Kiểm tra khóa ngoại, tính duy nhất, snapshot hồ sơ trong phiếu, thời gian tiếp nhận/phân công/liên hệ, hạn phiếu, thời gian hẹn và các mốc đăng ký/chạy đơn; không phát hiện vi phạm.
- Sau commit: kiểm tra trực tiếp DB xác nhận 96 hồ sơ, 82 phiếu, 106 lượt liên hệ, 35 lịch hẹn; fingerprint tài khoản và danh mục không đổi.
- Đăng nhập website production bằng các vai trò Tiếp nhận, Trưởng nhóm và Telesale; kiểm tra Tổng quan, Hồ sơ, Bàn giao, Nhiệm vụ, Báo cáo, Lịch hẹn và chi tiết phiếu. Dữ liệu hiển thị được, không có cảnh báo tải dữ liệu hoặc lỗi JavaScript trong các phiên đã kiểm tra.
- Các thông báo nhắc việc có thể được cron/sync bổ sung sau commit theo quy tắc hiện có.
