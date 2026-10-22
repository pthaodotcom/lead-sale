# Lead Sale · AhaMove

Lead Sale phục vụ Tiếp nhận, Trưởng nhóm, Telesale, Admin và người xem báo cáo trong quy trình tuyển tài xế. Nhân viên tiếp nhận hồ sơ, phân công, tự liên hệ ngoài web và cập nhật kết quả, lịch hẹn, bằng chứng. Tài xế không đăng nhập CRM.

Đặc tả nghiệp vụ hiện hành: [docs/09-dac-ta-nghiep-vu-ba.md](docs/09-dac-ta-nghiep-vu-ba.md).

## Phạm vi được xác nhận

- Gọi/chat và cập nhật tư vấn thủ công; bỏ Telegram, không đồng bộ lịch sử liên lạc.
- Activated/Onboarded do bộ phận Tiếp nhận/Admin xác nhận thủ công kèm căn cứ.
- **Đã bỏ hệ thống tài xế giả lập** (22/10/2026). Bảng/hàm SQL cũ còn trong DB nhưng app không dùng.
- Giữ hồ sơ, lịch sử, quyền, thời điểm thật; chống gửi trùng. Không tự mở hồ sơ đóng hoặc ghi đè đính chính.

## Giao diện

Công cụ nội bộ của AhaMove. Nhận diện AhaMove: logo trong `app/public/ahamove-*.png`, cam `#F26624` cho thương hiệu/điểm nhấn, cam đậm `#C44C16` cho nút chữ trắng (đạt 4.5:1), navy `#075081` cho tên sản phẩm và trạng thái Mới. Bố cục theo ảnh “Workspace — Nhiệm vụ”: nền xám nhạt, panel trắng, chip trạng thái màu cố định, font Inter. Điều hướng nhóm theo công việc và chỉ hiện mục đúng vai trò. Nhiệm vụ có danh sách mục con có số đếm; màn phiếu tư vấn 3 cột (ghi nhận · dòng thời gian · hồ sơ/phiếu). Lỗi phải có đường thử lại; dữ liệu đã lưu phân biệt với lỗi tải lại.

## Chưa chốt / ngoài phạm vi

Tích hợp tổng đài/Zalo/Facebook thật, hosting công khai, gửi SMS/email/Zalo, xuất XLSX, chốt kỳ và quy công đa nhân viên chưa nằm trong bản tối thiểu.
