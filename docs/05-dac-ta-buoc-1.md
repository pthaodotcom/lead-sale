# Bước 1 — Đặc tả nghiệp vụ và thiết kế triển khai

> **Hiện trạng mới 21/10/2026:** đã triển khai bản dùng Supabase thật theo yêu cầu “OK triển khai” của người dùng. Các nhận định “chưa nối DB/chờ bắt đầu” dưới đây là lịch sử khảo sát/thiết kế. Xem [bản bàn giao và giới hạn thực tế](06-ban-giao-va-van-hanh.md). Các đề xuất D-02…13 được dùng làm lựa chọn mặc định cho bản đầu trong phạm vi được giao triển khai; D-01/lần 3 có xác nhận riêng. Không đổi nội dung nguồn thành yêu cầu đã có sẵn. T-04 được điều chỉnh: hiện snapshot theo quyền, chưa phân trang server.

Ngày lập: **21/10/2026**. Căn cứ: [yêu cầu R/FR/Q](01-yeu-cau-de-tai.md), [bản chụp 4 tab](sources/google-doc-2026-10-21.md), [hiện trạng base](03-ghi-chu-trien-khai.md), [kế hoạch](04-ke-hoach-trien-khai.md).

**Trạng thái:** đã soạn bộ thiết kế để review; chỉ D-01 được người dùng xác nhận trong cuộc trò chuyện ngày 21/10. Những quyết định nghiệp vụ khác dưới đây là đề xuất, chưa được coi là đã duyệt. Chưa sửa code app, schema hay triển khai API trong bước này.

## 1. Vấn đề và mục tiêu

Base hiện có đã minh họa luồng Lead Sale nhưng dữ liệu và người thao tác còn ở trình duyệt. Các quy tắc thiếu hoặc mâu thuẫn trong nguồn khiến quyền, workflow và số liệu có thể bị hiện thực khác nhau giữa các màn hình. Bước này tạo một hợp đồng thống nhất để chuyển từng luồng sang Supabase.

Mục tiêu nghiệm thu đề xuất:

1. Mỗi hành động nghiệp vụ có vai trò, phạm vi dữ liệu, điều kiện và kết quả xác định; mọi ca sai quyền trong bộ nghiệm thu phải bị chặn tại API/DB.
2. Một SĐT chuẩn hóa chỉ có một hồ sơ, kể cả tạo đồng thời; mỗi lần tiếp nhận và phân công vẫn có lịch sử riêng.
3. Phân biệt trạng thái hồ sơ, phiếu và kết quả liên hệ; xử lý được các ranh giới KNM/quá hẹn lần 2–3–4 và mốc hết hạn.
4. Dashboard/báo cáo có công thức, dữ liệu mẫu và kết quả dự kiến đối chiếu được đến hồ sơ, không đếm số phiếu thành số Lead.
5. Mỗi quy tắc có nguồn hoặc mã quyết định cùng trạng thái; lựa chọn tạm của demo không tự thành yêu cầu chính thức.

Đây là tiêu chí sản phẩm/kiểm chứng, chưa có số liệu sử dụng thực tế để đặt mục tiêu tăng chuyển đổi kinh doanh hay ngưỡng hiệu năng. Deadline và quy mô tải còn ở Q-13.

## 2. Bộ tài liệu của bước 1

| Tài liệu | Nội dung | Hạng mục kế hoạch |
| --- | --- | --- |
| [Quyền và workflow](design/01-quyen-va-workflow.md) | Ma trận quyền, nhận việc, bảng chuyển trạng thái, tiếp nhận lại, lịch hẹn, nhóm nhiệm vụ | P1.1–P1.3 |
| [Dữ liệu và API dự thảo](design/02-du-lieu-va-api.md) | Quyết định tận dụng base, ERD, bảng/trường/ràng buộc, hợp đồng đọc/ghi, lỗi và quyền | P1.4/P1.6 |
| [KPI và nghiệm thu](design/03-kpi-va-nghiem-thu.md) | Định nghĩa chỉ số/bộ lọc/quy công, bộ dữ liệu và ca kiểm chứng | P1.5 |
| [Dữ liệu mẫu báo cáo](design/fixtures/report-cases.json) | Fixture xác định thời điểm và dữ liệu, kết quả dự kiến để tái sử dụng khi làm DB | P1.5 |

## 3. Người dùng và nhu cầu

| Người dùng | Câu chuyện sử dụng chính |
| --- | --- |
| Tiếp nhận | Tôi muốn tìm SĐT, bổ sung hồ sơ trùng hoặc tạo hồ sơ mới, để không mất thông tin và không tạo trùng tài xế |
| Trưởng nhóm | Tôi muốn nhận hàng đợi, giao/nhận/chuyển việc có lịch sử và xem tiến độ nhóm, để không bỏ sót Lead |
| Telesale | Tôi muốn xem hồ sơ được giao, ghi từng lần gọi/nhắn tin và lịch hẹn, để biết việc tiếp theo và chứng minh kết quả tư vấn |
| Tiếp nhận | Tôi muốn rà soát phiếu Closed cùng bằng chứng đăng ký/đơn đầu, để cập nhật đúng hồ sơ |
| Viewer | Tôi muốn xem số liệu theo nguồn/thời gian/nhân viên trong phạm vi được cấp, để theo dõi kết quả |
| Admin | Tôi muốn quản lý tài khoản, quyền, danh mục và xem audit, để quản lý hệ thống và truy vết thay đổi |

Trường hợp cần xử lý xuyên suốt: SĐT trùng, hai người cùng thao tác, chuyển người khi còn lịch hẹn, hồ sơ đã Activated/Onboarded được tiếp nhận lại, phiếu hết hạn nhưng job chưa chạy, tài khoản bị tạm ngưng và báo cáo không có dữ liệu.

## 4. Phạm vi bản đầu đề xuất

| Ưu tiên | Nội dung | Tiêu chí/điểm phụ thuộc |
| --- | --- | --- |
| P0 theo nguồn | Auth/quyền; Lead/nguồn/nhãn/chống trùng/nhập danh sách; giao/nhận/chuyển phiếu; workflow/lịch sử; hoạt động; lịch hẹn/nhắc; quản trị/audit | FR-01…05 và R-01…14/17; chi tiết nghiệm thu trong các tài liệu con |
| P0 dự kiến | Dashboard, phễu và báo cáo theo thời gian/nguồn/trạng thái/nhân viên | R-15/16; vẫn giữ dấu vết FR-06 ghi “Nên” trong khi bảng phạm vi yêu cầu phễu |
| P0 đề xuất D-07/08 | Nhập CSV **và XLSX**; ghi gọi/Zalo thủ công, upload recording/ảnh chat/tệp làm bằng chứng; nhắc và bàn giao Closed trong app | Chờ xác nhận; không coi chỉ ghi chữ là đã đủ yêu cầu bản ghi cuộc gọi/chat |
| P1 đề xuất | Xuất XLSX ngoài CSV; ghi chú cá nhân với quyền riêng; danh mục địa điểm nâng cao | Chưa cam kết; ghi chú riêng và một số trường chỉ xuất hiện trên ảnh, chưa có định nghĩa nghiệp vụ |
| P2 đề xuất | Kết nối tổng đài/Zalo/Facebook thật, API ứng dụng bên ngoài, nhiều vai trò đồng thời cho một user | Phụ thuộc yêu cầu và API/tài khoản được cấp; cần thêm hợp đồng tích hợp trước khi triển khai |

Phạm vi loại khỏi bản đầu theo đề xuất: vận hành chuyến xe/tính cước/đơn hàng; các module dự án, chat nội bộ và nâng cấp gói trong ảnh minh họa; mở rộng Companies/Deals/newsletter/inbound email của Atomic CRM. Đây là ranh giới thiết kế, không phải quyết định bỏ các chức năng bắt buộc trong nguồn.

## 5. Sổ quyết định nghiệp vụ

**N** = được nêu trong nguồn; **XN** = người dùng đã xác nhận; **ĐX** = đề xuất đang chờ xác nhận. Quy tắc N còn thiếu chi tiết vẫn cần quyết định; mã D dùng để theo dõi lựa chọn cụ thể.

| Mã | Liên quan | Phương án | Trạng thái/căn cứ |
| --- | --- | --- | --- |
| D-01 | Q-01 | KNM **hoặc** quá hẹn đạt **3 lần** thì Solved; lần 1/2 còn Open | **XN 21/10/2026**: người dùng chọn “Lần 3 chuyển Solved (đề xuất)”. Xác nhận này chỉ chốt ngưỡng, chưa chốt cách đếm/reset |
| D-02 | Q-02 | Hạn đúng 14×24 giờ từ thời điểm tạo phiếu, ghi UTC/hiển thị UTC+7; tại `now >= expires_at` hết quyền xử lý. New/Open/Solved đều đóng; job mỗi phút | **ĐX**; N có mốc 14 ngày và quyền trưởng nhóm đóng nhưng chưa rõ ranh giới/Solved |
| D-03 | Q-03 | Tiếp nhận/Admin xác nhận đăng ký/đơn đầu bằng thời điểm và căn cứ. Phiếu Closed chỉ tạo hồ sơ bàn giao; không tự đóng Lead. Lead Activated/Closed làm các phiếu New/Open thành Solved | **ĐX**; tách hai loại Closed là nguyên tắc từ nguồn; người xác nhận/ánh xạ là phần còn mở |
| D-04 | Q-04 | Mọi lần tiếp nhận tạo sự kiện; giữ hồ sơ/ngày/nguồn đầu. New vào hàng đợi nếu chưa có phiếu hiệu lực; Closed chỉ mở lại khi tiếp nhận xác nhận nhu cầu/SĐT; Activated/Onboarded giữ nguyên và không tự phân công lại | **ĐX** |
| D-05 | Q-05 | Mỗi Lead tối đa một phiếu chưa Closed, kể cả Solved. Chuyển người = đóng cũ/tạo mới, có liên kết, phiếu mới có 14×24 giờ từ lúc tạo | **ĐX**, đã gửi câu hỏi lựa chọn; không coi im lặng là đồng ý |
| D-06 | Q-06 | 5 vai trò tách riêng; 1 vai trò/user; Admin nghiệp vụ toàn cục; tiếp nhận toàn cục; trưởng nhóm theo nhóm và hàng đợi chưa phân công; Telesale theo phiếu hiện còn quyền; viewer chỉ tổng hợp không SĐT | **ĐX**; không tự gộp “tuyển dụng” vào Telesale |
| D-07 | Q-07 | Nhân viên tự cập nhật kết quả gọi/chat và đính kèm bằng chứng; không tích hợp Telegram hoặc tự đồng bộ liên lạc trong bản này | **XN 21/10/2026:** người dùng chọn làm thủ công và bỏ Telegram; xem kế hoạch 07 và kết quả triển khai 08 |
| D-08 | Q-08 | Tiếp nhận thủ công + CSV và XLSX dùng chung kiểm tra/preview; xuất CSV trước. Chưa kết nối nguồn ngoài trực tiếp | **ĐX**, đã gửi câu hỏi phạm vi |
| D-09 | Q-09 | Báo cáo theo nhóm hồ sơ có ngày tiếp nhận đầu trong khoảng lọc; nguồn đầu; phụ trách/nhóm trên phiếu gần nhất; chỉ số chuyển đổi tích lũy theo mốc thời gian hợp lệ; loại lưu trữ | **ĐX**, chi tiết và số mẫu ở tài liệu KPI |
| D-10 | Q-10 | Lịch hẹn có giờ/nơi; nhắc trong app trước 1 giờ và khi đến giờ; job mỗi phút. Closed có hàng đợi ngay, tổng hợp thông báo lúc 08:00 UTC+7 cho ngày trước | **ĐX**; chưa cam kết email/SMS/Zalo thông báo |
| D-11 | Q-11 | Tên, SĐT, thành phố, xe, nguồn bắt buộc; mã/ngày/trạng thái đầu do server; `0` ánh xạ chưa xác định. Reason khi từ chối, ghi chú hoạt động và nơi/giờ hẹn được validate theo điều kiện | **ĐX**, chi tiết từ điển ở tài liệu dữ liệu |
| D-12 | Q-01/10 | Đếm tổng trong từng đợt chăm sóc của phiếu, hai bộ đếm riêng; không reset vì cuộc gọi thành công. Mở lại Solved tạo đợt mới, reset bộ đếm đợt và giữ tổng lịch sử. Một lịch không đến chỉ tăng quá hẹn một lần | **ĐX**; ngưỡng 3 đã XN nhưng cách đếm/reset vẫn cần xác nhận |
| D-13 | Q-12 | Thay xóa nghiệp vụ bằng lưu trữ/khôi phục bởi tiếp nhận/Admin, chỉ khi mọi phiếu đã Closed; giữ SĐT unique, dữ liệu và audit | **ĐX**; chưa có thao tác xóa cứng |
| D-14 | Q-13 | Chưa có tên đề tài/deadline/đích triển khai/quy mô chính thức; chọn môi trường ở bước 0/2 | **Còn mở**; không tự ước lượng hạn bàn giao hoặc tạo project bên ngoài |
| D-15 | Bổ sung nguồn xác nhận kết quả | Xây hệ thống ngoài giả lập cho chọn tài xế/tình huống, gửi kết quả đăng ký và đơn đầu về Lead Sale; giữ rõ nguồn mô phỏng và lịch sử tiếp nhận | **XN phạm vi 21/10/2026:** người dùng yêu cầu giả lập nguồn ngoài; chi tiết xử lý/UI trong [kế hoạch 07](07-ke-hoach-gia-lap-core-va-khac-phuc.md) là thiết kế đề xuất, chưa triển khai |

Khi người dùng trả lời thêm, cập nhật trạng thái/căn cứ ở đây trước khi chuyển checklist “chốt” sang hoàn thành. Không dùng ngày đọc tài liệu làm ngày xác nhận nghiệp vụ.

Trao đổi phạm vi ngày 21/10: người dùng hỏi “theo yêu cầu là phạm vi nào”. Đã giải thích nguồn yêu cầu nhập danh sách, bản ghi gọi/chat, lịch hẹn/nhắc và bàn giao Closed, nhưng chưa chốt định dạng nhập, mức tích hợp trực tiếp và kênh thông báo. Câu hỏi làm rõ này **không phải xác nhận D-07/08/10**.

## 6. Quyết định kỹ thuật cho bản thiết kế

Các lựa chọn dưới đây thuộc phạm vi thiết kế mà người dùng đã giao; có thể điều chỉnh khi chạy bước 0, không được ghi là đã triển khai:

- **T-01:** giữ Supabase Auth và `public.sales` làm profile nhân viên, thêm bảng vai trò/phạm vi nhóm cho Lead Sale. Một nguồn quyền cho nghiệp vụ, không tin actor/role từ frontend.
- **T-02:** tạo resource nghiệp vụ riêng `leads`, `lead_assignments`, `lead_activities`…; tái sử dụng UI/provider/Auth từ base. Không đổi `contacts`, `deals`, `tasks` thành mô hình mới bằng cách đổi tên.
- **T-03:** command quan trọng qua hàm backend với giao dịch, khóa/ràng buộc, expected version và khóa chống gửi lại; RLS bảo vệ đọc, cấm ghi trực tiếp bỏ qua command. Job vẫn kiểm tra cùng quy tắc nghiệp vụ.
- **T-04:** đọc danh sách có phân trang/lọc/sort; không tải nguyên Database vào React context. Bộ chọn actor/localStorage demo không dùng cho luồng dữ liệu thật; dữ liệu demo không tự nhập vào DB.
- **T-05:** audit và lịch sử từ server cùng transaction, timestamp UTC, phép lọc theo ngày chuyển ranh giới UTC+7; hợp đồng lỗi thống nhất cho UI.

Lý do và ảnh hưởng tương thích với base được ghi trong [thiết kế dữ liệu/API](design/02-du-lieu-va-api.md).

## 7. Tiến độ đầu ra P1 và điểm chuyển sang bước tiếp theo

| Hạng mục | Đầu ra đã soạn | Trạng thái chốt |
| --- | --- | --- |
| P1.1 | Ma trận quyền và định nghĩa phạm vi, kể cả lịch sử/file/báo cáo | Chờ D-06 |
| P1.2 | Bảng chuyển trạng thái Lead/phiếu/lịch hẹn và tác động liên quan | Ngưỡng D-01 đã XN; các quy tắc còn lại ĐX |
| P1.3 | Quy tắc tiếp nhận lại, đồng thời/chuyển phiếu, hạn, đếm/reset và bàn giao | Chờ D-02…05/12 |
| P1.4 | Từ điển dữ liệu, trường bắt buộc, nhập/tích hợp/lưu trữ/nhắc | Chờ D-07/08/10/11/13 |
| P1.5 | Công thức KPI, fixture và bộ kết quả dự kiến | Chờ xác nhận D-09; số mẫu được kiểm tra tính nhất quán |
| P1.6 | ERD, bảng/ràng buộc, resource/API dự thảo và chọn cách tận dụng base | Thiết kế kỹ thuật đã soạn; chưa có migration/API chạy thật |

Có thể làm bước 0 và chuẩn bị kết nối Auth/client khi chờ lựa chọn. Chốt quyền trước khi hoàn thiện RLS, chốt tiếp nhận trước module hồ sơ, chốt vòng đời trước workflow/job, chốt KPI trước nghiệm thu báo cáo. Timeline thực hiện theo [kế hoạch](04-ke-hoach-trien-khai.md); chưa có deadline để cam kết ngày.
