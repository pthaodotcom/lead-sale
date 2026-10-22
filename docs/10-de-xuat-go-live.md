# Đề xuất BA: từ "đúng yêu cầu" đến phần mềm Lead dùng được để go-live

Ngày 22/10/2026. Bổ sung cho [đặc tả BA](09-dac-ta-nghiep-vu-ba.md). Yêu cầu của khách mô tả **quy trình**; tài liệu này mô tả những gì một đội tuyển tài xế thực sự cần mỗi ngày mà khách chưa nói ra, đối chiếu với các phần mềm lead/CSKH đang dùng phổ biến (HubSpot, Salesforce, Getfly, Bitrix24, CareSoft, Freshdesk).

## 1. Một ngày làm việc thật (để thấy chỗ thiếu)

| Người | Việc thật trong ngày | App hiện tại thiếu |
|---|---|---|
| Telesale | Mở máy: *hôm nay gọi ai, ai hẹn gọi lại lúc mấy giờ, ai sắp mất (hết 14 ngày)*. Gọi liên tục 60–100 cuộc, mỗi cuộc ghi kết quả trong ≤30 giây, gửi Zalo mẫu, hẹn gọi lại "chiều nay 3h". | Không có **hẹn gọi lại**; không có **kịch bản/tin nhắn mẫu**; không bấm-gọi / mở Zalo; không thấy tài xế có đủ giấy tờ chưa. |
| Trưởng nhóm | Sáng chia lead mới đều cho team, trưa xem ai chậm gọi lead mới, chiều xem ai ít cuộc gọi. | Chia tay từng người; không **tự chia đều**; không thấy **lead mới quá X giờ chưa gọi (SLA)**; không có **hiệu suất theo người** (số cuộc gọi, tỷ lệ liên hệ được). |
| Tiếp nhận | Nhập lead từ nhiều kênh, cần biết tài xế có xe chưa, đang chạy app nào, ai giới thiệu, chiến dịch nào. | Hồ sơ chỉ 6 trường; không có **giấy tờ**, **app đang chạy**, **người giới thiệu**, **chiến dịch**. |
| Quản lý | Lead đang kẹt ở bước nào của hành trình tuyển? Kênh nào ra tài xế chạy đơn thật? | Chỉ có trạng thái hồ sơ 4 giá trị; không có **giai đoạn tuyển (pipeline)** và **bảng Kanban**. |

## 2. Đề xuất tính năng

Ưu tiên: **R1** = làm ngay cho go-live; **R2** = cần tích hợp/hạ tầng ngoài, lên kế hoạch.

| Mã | Tính năng | Vì sao cần | Bản |
|---|---|---|---|
| X-01 | **Hồ sơ tài xế đầy đủ**: ngày sinh, giới tính, quận/huyện, loại xe chi tiết, đã có xe chưa, đang chạy app nào (Grab, Be, Xanh SM, ShopeeFood, Lalamove…), người giới thiệu, chiến dịch, khung giờ tiện gọi, checklist giấy tờ (CCCD, bằng lái, cà vẹt). | Tư vấn đúng người, lọc được tài xế "nóng" (đã có xe + đủ giấy tờ), tính hiệu quả chiến dịch/giới thiệu. | R1 |
| X-02 | **Giai đoạn tuyển (pipeline)** tính tự động từ dữ liệu: Mới → Đang liên hệ → Quan tâm → Hẹn đăng ký → Đã đăng ký → Chạy đơn đầu / Không thành công. **Bảng Kanban** bên cạnh dạng danh sách. | Mọi phần mềm lead đều có pipeline; quản lý thấy lead kẹt ở đâu. Tính từ dữ liệu nên không ai phải cập nhật tay. | R1 |
| X-03 | **Hẹn gọi lại** trên phiếu (ngày giờ + nút nhanh: 2 giờ nữa, chiều nay, sáng mai); mục Nhiệm vụ "Cần gọi lại hôm nay", "Quá hạn gọi lại". | Tài xế "đang bận, gọi lại sau" là kết quả phổ biến nhất; không có việc tiếp theo thì lead rơi rớt. | R1 |
| X-04 | **SLA phản hồi lead mới**: lead phải được gọi lần đầu trong 2 giờ kể từ khi giao; cảnh báo trên Nhiệm vụ/Điều phối/Tổng quan; thời gian phản hồi trung bình trong báo cáo. | Lead tuyển tài xế nguội rất nhanh; đây là chỉ số quản lý telesale quan trọng nhất. | R1 |
| X-05 | **Kịch bản tư vấn & tin nhắn mẫu** (giới thiệu AhaMove, thu nhập, giấy tờ, địa điểm đăng ký, nhắc lịch hẹn) — sao chép 1 chạm, điền sẵn tên tài xế; nút **Gọi** và **Mở Zalo**. | Chuẩn hóa chất lượng tư vấn, rút thời gian mỗi cuộc gọi (ảnh "Sử dụng mẫu trả lời" trong doc). | R1 |
| X-06 | **Danh sách Lead mạnh hơn**: chế độ xem nhanh (Của tôi, Mới hôm nay, Chưa gọi > 24h, Cần gọi lại, Đủ giấy tờ), cột Giai đoạn / Liên hệ cuối / Hẹn gọi lại, **chọn nhiều để giao việc**. | Cách làm việc chuẩn trong CRM: lọc → chọn → xử lý hàng loạt. | R1 |
| X-07 | **Hiệu suất Telesale**: số cuộc gọi, tỷ lệ liên hệ được, tỷ lệ đồng ý, số đăng ký, thời gian phản hồi đầu TB, vi phạm SLA — theo khoảng ngày. | Trưởng nhóm quản lý bằng số, không bằng cảm giác. | R1 |
| X-08 | **Tự chia việc đều** (round-robin theo tải thấp nhất trong nhóm). | Chia 50 lead buổi sáng mất vài giây thay vì 10 phút. | R1 |
| X-09 | **Dòng thời gian 360°** trên hồ sơ: tiếp nhận, giao việc, nhận việc, cuộc gọi, lịch hẹn, đóng phiếu, đổi trạng thái. | Bất kỳ ai mở hồ sơ đều hiểu chuyện gì đã xảy ra. | R1 |
| X-10 | **Tìm nhanh Ctrl+K** theo tên/SĐT/mã. | Telesale nhận cuộc gọi đến cần mở hồ sơ ngay. | R1 |
| X-11 | Form/Webhook tiếp nhận từ website & Facebook Lead Ads tự tạo lead. | Bỏ nhập tay; cần endpoint công khai + chống spam. | R2 |
| X-12 | Tổng đài (Stringee/CareSoft): bấm gọi trên web, tự ghi cuộc gọi + ghi âm. | Bằng chứng tự động; cần hợp đồng tổng đài. | R2 |
| X-13 | Zalo OA/ZNS & SMS nhắc lịch hẹn tự động. | Giảm tỷ lệ không đến; cần OA + mẫu được duyệt. | R2 |
| X-14 | Chiến dịch tuyển & chỉ tiêu (theo khu vực/đợt, mục tiêu số tài xế). | Gắn ngân sách marketing với kết quả. | R2 |
| X-15 | Chấm điểm lead (đủ giấy tờ + có xe + khu vực đang thiếu tài xế). | Ưu tiên gọi lead dễ chuyển đổi. | R2 |
| X-16 | Gộp hồ sơ trùng, phân quyền theo khu vực, xuất XLSX, app di động. | Vận hành quy mô lớn. | R2 |

## 3. Quy tắc mới (bổ sung BR)

| Mã | Quy tắc |
|---|---|
| BR-60 | Giai đoạn tuyển là **giá trị tính**, không lưu: Onboarded → *Chạy đơn đầu*; Activated → *Đã đăng ký*; Closed → *Không thành công*; có lịch hẹn đang chờ → *Hẹn đăng ký*; lần liên hệ gần nhất Đồng ý → *Quan tâm*; đã có liên hệ → *Đang liên hệ*; còn lại → *Mới*. |
| BR-61 | Hẹn gọi lại thuộc **phiếu** (mỗi phiếu tối đa một lịch gọi lại), phải ở tương lai và trước hạn phiếu. Ghi một lần liên hệ mới sẽ thay hoặc xóa lịch gọi lại. Phiếu Solved/Closed thì lịch gọi lại hết hiệu lực. |
| BR-62 | SLA phản hồi đầu = 2 giờ tính từ lúc tạo phiếu đến lần liên hệ đầu tiên (gọi hoặc Zalo, kể cả không nghe máy). Quá 2 giờ chưa có liên hệ → *Vi phạm SLA*. |
| BR-63 | Tự chia việc chỉ giao cho Telesale **đang hoạt động trong nhóm**, ưu tiên người đang giữ ít phiếu chưa giải quyết nhất; hòa thì xoay vòng. |
| BR-64 | Số CCCD chỉ hiển thị đầy đủ cho Tiếp nhận/Admin; vai trò khác thấy 4 số cuối. |

## 4. Tác động kỹ thuật

- X-01 và X-03 cần lưu thêm dữ liệu: migration tiến `20261022000000_lead_crm.sql` (lớp bọc mới quanh `lead_command`; lưu `profile` trên hồ sơ và `nextCallAt` trên phiếu; lệnh mới `followUp`). Không đổi bảng, không đụng dữ liệu cũ. **Chỉ áp lên Supabase khi được duyệt.**
- X-02, X-04, X-06…X-10 tính ở giao diện từ dữ liệu sẵn có, không cần đổi DB.
