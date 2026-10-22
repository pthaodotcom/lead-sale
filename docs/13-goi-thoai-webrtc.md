# Gọi thoại Internet giữa laptop và điện thoại

Ngày 22/10/2026. Cuộc gọi âm thanh thật qua WebRTC, không gọi vào số SIM và không ghi âm.

## Cách thử

1. Laptop đăng nhập CRM thật, mở một hồ sơ tài xế (Tiếp nhận/Admin) hoặc một phiếu còn hạn đã nhận việc (người phụ trách/Admin).
2. Trong **Cuộc gọi Internet**, bấm **Tạo link nhận cuộc gọi**.
3. Điện thoại quét mã QR hoặc mở link được sao chép. Link HTTPS thuộc Site công khai hiện có, không yêu cầu tài khoản tài xế.
4. Trên điện thoại cho phép micro và bấm **Sẵn sàng nhận cuộc gọi**. Giữ trang mở, không khóa màn hình.
5. Laptop bấm **Gọi ngay**, cho phép micro. Điện thoại bấm **Nghe máy** hoặc **Từ chối**.
6. Sau khi cả hai kết nối âm thanh thành công, giao diện hiển thị thời lượng. Hai bên có nút tắt micro/kết thúc. Nếu chưa nghe tiếng, dùng thanh phát âm thanh hoặc nút bật loa trên điện thoại.

Lần đầu thử hai máy cùng Wi-Fi, dùng tai nghe hoặc đặt xa nhau để tránh tiếng vọng. STUN công khai được cấu hình sẵn. **Chưa cấu hình TURN**: mạng 4G, VPN hoặc NAT/firewall nghiêm ngặt có thể không kết nối. Muốn vận hành ổn định qua các mạng đó cần bổ sung TURN. Tắt/khóa trang điện thoại không có cuộc gọi hệ điều hành hoặc push để đánh thức; đây là bản gọi khi trang nhận đang mở.

## Nhật ký và trạng thái

- Đang đổ chuông; thời gian chờ tối đa 45 giây.
- Đang kết nối: đã bấm nghe nhưng âm thanh chưa kết nối; quá 40 giây chuyển lỗi.
- Đang trò chuyện: cả hai peer đã báo kết nối thành công.
- Kết thúc sau khi đã kết nối → đã nghe máy/kết thúc, lưu số giây trên máy chủ; thời gian đổ chuông không cộng vào thời lượng.
- Từ chối, người gọi hủy, không nghe máy, lỗi kết nối lưu riêng. Không tự biến thành kết quả tư vấn hoặc tăng bộ đếm không nghe máy.
- Mất heartbeat trên 25 giây sẽ kết thúc lỗi khi máy còn lại kiểm tra lại; thời lượng khi mất mạng là thời gian máy chủ quan sát, có thể gồm khoảng đợi phát hiện ngắt.
- Nhật ký nằm ngay trong khối gọi trên hồ sơ/phiếu. Khi gọi từ phiếu có liên kết assignment. Kết quả Đồng ý/Không có nhu cầu và ghi chú vẫn ghi ở phần Ghi nhận liên hệ. Không tự tăng KPI hoạt động chăm sóc.

## Kỹ thuật và quyền

Schema `23_lead_sale_voice.sql`, migration tiến `20261022030000_voice.sql` (đã áp ngày 22/10/2026, dữ liệu hồ sơ/phiếu/hoạt động cũ được giữ nguyên). `lead_voice_staff` yêu cầu tài khoản CRM và kiểm tra lại quyền khi bấm gọi. Telesale chỉ gọi trên phiếu của mình, đã nhận, New/Open, còn hạn; Tiếp nhận/Admin có thể gọi trực tiếp từ hồ sơ chưa lưu trữ.

`lead_voice_guest` chỉ có quyền với một invite được xác thực bằng token ngẫu nhiên 256 bit trong fragment của link. Token được lưu băm trên DB, hết hạn sau 2 giờ; một thiết bị nhận hoạt động tại một thời điểm. Không trả thông tin hồ sơ, SĐT hoặc lịch sử CRM cho người nhận. Không gửi link này cho người ngoài cuộc gọi.

SDP chỉ lưu trong bảng private; RLS bảo vệ nhật ký, không cho ghi trực tiếp. Trình duyệt trao đổi offer/answer qua Supabase RPC, poll khoảng 1,5 giây. Âm thanh truyền qua peer, không tải lên Storage. Ghi âm, gọi SIM/PSTN, tổng đài, Telegram/WhatsApp, push nền chưa được triển khai.

Nguồn giao diện: `VoicePanel.tsx`, `VoiceReceiver.tsx`, `voice.ts`, `useVoice.ts`, `voice.css`. Trang nhận có trong bản CRM và bản Site độc lập qua `#/nhan-cuoc-goi?id=...&key=...`. Dựng và cập nhật Site bằng quy trình tài liệu 11. QR tạo trong trình duyệt bằng `qrcode.react`, không gửi token đến dịch vụ QR ngoài.

## Đã kiểm tra

82 bài kiểm thử tự động đạt, gồm vòng đời cuộc gọi, phân quyền, token sai, thiết bị nhận trùng, phiếu đóng và các kết quả kết thúc. TypeScript, lint phần gọi và bản dựng CRM/trang nhận đạt.

Kiểm thử hai trình duyệt với âm thanh tổng hợp trong môi trường dữ liệu riêng: WebRTC kết nối hai chiều, có gói RTP gửi/nhận, tắt/bật micro, đồng hồ và lưu cuộc gọi kết thúc 57 giây; cuộc gọi không nghe tự kết thúc sau 45 giây với thời lượng 0. Đã xác nhận tài khoản thật tạo được QR và trang HTTPS xác thực được link. Chưa kiểm tra trực tiếp trên điện thoại vật lý hoặc qua mạng 4G.
