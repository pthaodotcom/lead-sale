# Lead Sale

Lead Sale phục vụ Tiếp nhận, Trưởng nhóm, Telesale, Admin và người xem báo cáo trong quy trình tuyển tài xế. Nhân viên tiếp nhận hồ sơ, phân công, tự liên hệ ngoài web và cập nhật kết quả, lịch hẹn, bằng chứng. Tài xế không đăng nhập CRM.

## Phạm vi được xác nhận

- Gọi/chat và cập nhật tư vấn thủ công; bỏ Telegram, không đồng bộ lịch sử liên lạc.
- Hệ thống tài xế giả lập có dữ liệu nguồn riêng và gửi sự kiện qua API nhận của Lead Sale.
- Hoàn tất đăng ký → Activated; hoàn thành đơn đầu sau đăng ký → Onboarded. Đây là quy tắc mô phỏng, chưa phải hợp đồng API của đối tác thật.
- Chỉ Admin tạo/liên kết và phát dữ liệu thử; Admin/Tiếp nhận xem đối soát. Chỉ Lead được liên kết rõ ràng mới nhận kết quả mô phỏng.
- Giữ hồ sơ, lịch sử, quyền, thời điểm thật; chống gửi trùng, xử lý chờ liên kết/chờ đăng ký và xung đột. Không tự mở hồ sơ đóng hoặc ghi đè đính chính.

## Giao diện

Mở rộng giao diện đang có: Inter, nền sáng, màu xanh, bảng và form nghiệp vụ. Nhãn nguồn giả lập luôn hiện rõ. Tách trang thao tác tài xế và trang đối soát. Người dùng chọn tình huống thay vì nhập JSON. Lỗi phải có đường thử lại và dữ liệu đã lưu phải được phân biệt với lỗi tải lại.

## Chưa chốt / ngoài phạm vi

Đối tác core thật, hợp đồng tích hợp thực tế, hosting công khai, gửi SMS/email/Zalo, xuất XLSX, chốt kỳ và quy công đa nhân viên chưa nằm trong bản tối thiểu được chốt. Dữ liệu thử không chứng minh đã tích hợp ứng dụng giao hàng thật.
