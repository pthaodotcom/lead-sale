# Form tài xế tự đăng ký

Ngày 22/10/2026. Tài xế điền qua đường link, không cần tài khoản CRM. Đây là phần tiếp nhận ban đầu; không tải ảnh giấy tờ lên form.

Link công khai: https://ahamove-dang-ky-tai-xe.candyreed64.chatgpt.site

Form độc lập được xuất bản bằng Sites; chỉ chứa giao diện đăng ký, không có các trang CRM. Site ID: `appgprj_6ad973273b348191ad2680d3d53c2371`; checkout riêng: `.sites/driver-intake/` (được gitignore). Dựng lại bằng `node scripts/lead-build-intake.mjs` tại `app/`, rồi đồng bộ/xuất bản bằng Sites. Nguồn chỉnh sửa chính vẫn ở `app/src/components/lead-sale/PublicIntake.tsx`.

- Link: `https://<ten-mien-app>/#/dang-ky-tai-xe`. Dùng hash để hoạt động cả trên máy chủ tệp tĩnh hiện tại.
- Trong **Hồ sơ Lead**, Tiếp nhận/Admin có nút **Sao chép link form** và **Mở form**.
- Bắt buộc: họ tên, số điện thoại, thành phố, phương tiện, đồng ý sử dụng thông tin để tư vấn/tiếp nhận.
- Tùy chọn: quận/huyện, tình trạng xe, giờ tiện liên hệ, checklist giấy tờ đã có, ghi chú.
- Nguồn luôn là `web` (Form website), trạng thái mới `New`. Thành phố là khu vực mong muốn, chưa phải xác nhận khu vực đang tuyển.
- SĐT chuẩn hóa theo quy tắc CRM. Số mới tạo hồ sơ và vào hàng chờ phân công; số đã tồn tại chỉ ghi lần tiếp nhận mới, giữ nguyên mọi trường/trạng thái của hồ sơ cũ, kể cả hồ sơ đã lưu trữ.
- Nội dung đăng ký và thời điểm đồng ý được lưu trong lần tiếp nhận; nội dung xem tại tab **Lần tiếp nhận**. Tiếp nhận/Admin nhận thông báo trong ứng dụng. Form không gửi SMS/email.
- Trả cùng một kết quả cho số mới/số cũ; không có API tra cứu hồ sơ công khai. Không cấp quyền đọc bảng, gọi lệnh nội bộ hoặc ghi tùy ý cho `anon`.
- Mã yêu cầu giữ nguyên khi thử lại cùng thông tin; máy chủ không ghi hai lần. Chặn honeypot; giới hạn 3 lần/SĐT/giờ và tổng 300 lần/giờ trên máy chủ. Đây là chống gửi lặp cơ bản; không xác minh sở hữu SĐT bằng OTP, không tích hợp CAPTCHA.

## Cài đặt và vận hành

Schema nguồn: `app/backend/supabase/schemas/21_lead_sale_public_intake.sql`. Migration tiến: `20261022010000_public_intake.sql`. Database hiện có dùng `node scripts/lead-migrate.mjs` tại `app/`; không chạy lại bootstrap. Schema/migration không thay dữ liệu hồ sơ cũ. URL và publishable key Supabase dùng cấu hình hiện tại; không cần khóa bí mật trong trình duyệt.

`dev:demo` chỉ lưu trên trình duyệt và hiển thị rõ nhãn xem thử. `dev` dùng Supabase thật. Cấu hình `VITE_DRIVER_INTAKE_URL` trong `.env.local` để nút sao chép trong CRM trả link công khai; khi không có cấu hình, dùng link form trên cùng tên miền. Bản demo luôn dùng link cùng máy. Migration đã áp lên Supabase ngày 22/10/2026, giữ nguyên 16 hồ sơ, 14 phiếu, 19 hoạt động.

Tạm ngưng nhận bằng cách tắt nguồn **Form website** trong quản trị; máy chủ từ chối trước khi lưu. Lịch sử đồng ý dùng phiên bản `driver-intake-v1`. Không sửa nội dung đồng ý mà giữ nguyên mã phiên bản.

Kiểm chứng: kiểm thử SQL cho gửi ẩn danh, phân quyền, dữ liệu sai/thiếu đồng ý, chống lặp, giới hạn gửi, giữ nguyên hồ sơ cũ/lưu trữ và tạm ngưng nguồn; e2e cho form, nhập sai SĐT, gửi mới/gửi lại, nội dung trong CRM và màn hình di động.
