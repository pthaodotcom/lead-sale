# Ghi chú triển khai Lead Sale trên base có sẵn

> **Hiện trạng mới 21/10/2026:** đã triển khai bản dùng Supabase thật theo yêu cầu “OK triển khai” của người dùng. Các nhận định “chưa nối DB/chờ bắt đầu” dưới đây là lịch sử khảo sát/thiết kế. Xem [bản bàn giao và giới hạn thực tế](06-ban-giao-va-van-hanh.md). Các đề xuất D-02…13 được dùng làm lựa chọn mặc định cho bản đầu trong phạm vi được giao triển khai; D-01/lần 3 có xác nhận riêng. Không đổi nội dung nguồn thành yêu cầu đã có sẵn. T-04 được điều chỉnh: hiện snapshot theo quyền, chưa phân trang server.

Ngày cập nhật: **21/10/2026** (UTC+7). Đã đọc trực tiếp đủ 4 tab và xem 8 ảnh của [Google Doc gốc](https://docs.google.com/document/d/1rMIJFe_yON1uunKA6UZ1Kie5wPEGddcJypAvm5wJBSI/edit). [Bản chụp lần đọc này](sources/google-doc-2026-10-21.md) giữ nội dung chữ, bảng và liên kết ảnh.

Tài liệu này nối yêu cầu với **code hiện có trong `app/` tại commit `1226271`**. Các nhận định về app dựa trên đọc code, chưa xác nhận bằng chạy ứng dụng, build hoặc kiểm thử trong lần làm việc này. Yêu cầu chi tiết giữ mã R/FR/Q trong [01-yeu-cau-de-tai.md](01-yeu-cau-de-tai.md). Các lựa chọn trong demo không tự trở thành quyết định nghiệp vụ đã duyệt.

## 1. Kết quả đọc từng tab

| Tab | Nội dung cần đưa vào sản phẩm | Lưu ý khi triển khai |
| --- | --- | --- |
| quy trình làm việc (`t.0`) | Tiếp nhận, chống trùng SĐT, hồ sơ; trưởng nhóm tạo phiếu; Telesale tư vấn; lịch sử gọi/nhắn tin, kết quả, lịch hẹn; nhóm nhiệm vụ; danh sách phiếu Closed gửi tiếp nhận | Telesale chỉ xem hồ sơ, cập nhật nghiệp vụ trên phiếu. Một Lead được tư vấn nhiều lần. Hồ sơ, phiếu và kết quả liên hệ là ba khái niệm riêng |
| BFD (`t.c8gv4ptck7xl`) | 5 phân hệ: hồ sơ Lead; phân công; chăm sóc/chuyển đổi; báo cáo; quản trị | Bao gồm danh mục nguồn/trạng thái, lịch sử phân công, lịch hẹn/nhắc việc, tài khoản/vai trò |
| yêu cầu của thầy t nhó (`t.krrgqymy76wk`) | Mô hình tối thiểu, FR-01…06, phạm vi cam kết, chức năng và tiêu chí nghiệm thu | Nhập danh sách, chuyển người phụ trách, nhắc việc, audit, lọc báo cáo là một phần phạm vi. Chọn nguồn tiếp nhận khả thi; tích hợp ứng dụng tùy điều kiện |
| NHỜ THẢO (`t.ui5s7g2dk4rc`) | Ghi lại kiến trúc, triển khai, điều hướng, màn hình, API, cấu trúc code, môi trường, CSDL, dữ liệu mẫu và cách chạy; có demo chạy được | Viết tài liệu kỹ thuật trong quá trình làm. Ghi API thực tế của Supabase khi có, dù không xây REST server riêng |

## 2. Luồng nghiệp vụ cần bảo toàn

1. Nhân viên tiếp nhận tìm theo SĐT. Trùng thì bổ sung vào hồ sơ hiện có; không trùng thì tạo hồ sơ. Giữ ngày tiếp nhận **đầu tiên**; lần tiếp nhận lại cần bản ghi riêng nếu đưa vào hàng đợi trong ngày.
2. Chuyển danh sách Lead cần tư vấn đến trưởng nhóm. Không đồng nhất hàng đợi “Lead New trong ngày” với việc đổi mọi hồ sơ cũ về trạng thái New; Q-04 còn mở.
3. Trưởng nhóm tạo phiếu với mã phiếu, Lead, người phụ trách, thời điểm tạo/cập nhật và trạng thái. Giữ lịch sử khi giao lại/chuyển người.
4. Nhân viên xử lý phiếu được giao, xem hồ sơ tài xế, ghi từng lần gọi hoặc nhắn Zalo; lưu người, thời gian, kết quả, decision, reason, ghi chú và lịch hẹn nếu có.
5. Phiếu New là chưa liên hệ; Open là còn chăm sóc; Solved là không cần người này chăm sóc tiếp nhưng có thể mở lại trong hạn; Closed kết thúc quyền quản lý của người đã được giao. Nguồn quy định đóng sau 14 ngày từ khi tạo hoặc do trưởng nhóm đóng, nhưng chi tiết mốc thời gian còn cần Q-02.
6. Phiếu Closed được tổng hợp hằng ngày cho tiếp nhận rà soát và cập nhật trạng thái hồ sơ. **Không tự đổi mọi Lead có phiếu Closed thành Lead Closed.**
7. Báo cáo tính theo hồ sơ và lịch sử nghiệp vụ, tránh đếm số phiếu thành số Lead. Phải đối chiếu được số tổng với dữ liệu chi tiết.

| Đối tượng | Trạng thái/giá trị nguồn |
| --- | --- |
| Hồ sơ Lead | New / Activated (đăng ký thành công) / Onboarded (đơn đầu tiên) / Closed (không nhu cầu hoặc sai SĐT) |
| Phiếu phân công | New / Open / Solved / Closed |
| Kết quả liên hệ | New / Đã gọi / Không nghe máy 1–3 / Quá hạn 1–3 / Sai SĐT |
| Decision | Đồng ý / Không đồng ý / Cúp ngang / 0 |
| Reason | Không có nhu cầu / Tạm thời bận / Không đủ điều kiện đăng ký / 0 |

Các trường hồ sơ được nêu: mã hồ sơ, SĐT, họ tên, thành phố đăng ký chạy, Lead date, Lead source, Vehicle type (Van/Motorbike), trạng thái. Nguồn chưa chốt trường bắt buộc. Call date, Decision date/place và ghi chú thuộc ghi nhận tư vấn/lịch hẹn; không ghi đè toàn bộ lịch sử bằng kết quả gần nhất.

## 3. Cách hiểu hình minh họa

- Ảnh 1: mục con của Nhiệm vụ phải bấm được để lọc phiếu; số đếm lấy từ dữ liệu thật. Có nhóm chưa giải quyết, đồng ý, không nghe máy và các lần, quá hạn và các lần, cập nhật gần đây.
- Ảnh 2: tham khảo bố cục workspace. Kanban, dự án, chat nội bộ, khối lượng công việc và nâng cấp gói không mặc nhiên là phạm vi phải làm.
- Ảnh 3: chi tiết phiếu có trường tư vấn, ghi chú, thời gian, ghi âm/chat và đính kèm. Nguồn chữ cũng yêu cầu lưu bản ghi gọi/chat; mức ghi nhận thủ công, tệp hay tích hợp trực tiếp còn cần Q-07. `type`, `Reason_disconnect`, `decision_time` và ghi chú riêng cần định nghĩa thêm, không đoán từ ảnh.
- Ảnh 4: danh sách phiếu theo hồ sơ, có mã phiếu, thời điểm tạo/cập nhật và chuyên viên.
- Ảnh 5: BFD xác nhận 5 phân hệ nghiệp vụ.
- Ảnh 6: FR-01…05 bắt buộc; FR-06 phễu ghi “Nên”. Ảnh 7 và bảng tối thiểu lại yêu cầu phễu; kế hoạch vẫn đưa phễu vào, giữ dấu vết mâu thuẫn ưu tiên.
- Ảnh 7: phạm vi cam kết có nhập danh sách, workflow/lịch sử/lý do/nhắc việc, tương tác, chuyển phân công và báo cáo. Nguồn dữ liệu chọn một mức khả thi, không yêu cầu nối thật mọi kênh.
- Ảnh 8: bằng chứng chính là bản chạy và kịch bản demo; ảnh chụp chỉ minh họa. Nếu tích hợp thật phải mô tả xác thực, lỗi, giới hạn và phương án dự phòng.

## 4. Base thực tế và phần cần làm tiếp

`app/src/App.tsx` đang mở `LeadSaleApp`. Module `app/src/components/lead-sale/` tận dụng Admin/router và UI của nền Atomic CRM. `LeadSaleApp.tsx` dùng FakeRest rỗng làm provider nền, còn dữ liệu nghiệp vụ do `store.ts` lưu trong localStorage (`lead-sale.demo.v1`). `context.tsx` dùng sessionStorage chọn người thao tác; `Layout.tsx` có bộ đổi vai trò dùng thử. Chưa có Auth/RLS cho dữ liệu Lead Sale trong luồng này.

| Nhóm yêu cầu | Bằng chứng code hiện có | Phần cần hoàn thiện |
| --- | --- | --- |
| Đăng nhập, quyền (R-01) | `context.tsx`, `Layout.tsx`, các hàm canEditLead/canAssign/canWork trong `domain.ts` | Supabase Auth, đổi mật khẩu, profile/vai trò và phạm vi dữ liệu; RLS/API chặn truy cập trái quyền; bỏ cơ chế chọn vai trò demo khỏi luồng thật |
| Hồ sơ/nhập Lead (R-02…06) | `Leads.tsx`, `domain.ts`: form, tìm/lọc, nhãn, chuẩn hóa SĐT, báo trùng, CSV, lưu trữ/khôi phục | Lưu DB, chống trùng nguyên tử, bổ sung hồ sơ trùng và tiếp nhận lại, hàng đợi trong ngày, validation được chốt, danh mục và định dạng nhập đã chọn |
| Phân công (R-07…10) | `Assignments.tsx`, `AssignmentDialog.tsx`, `domain.ts`: phiếu, chuyển người bằng đóng cũ/tạo mới, trạng thái và hạn | Chốt ma trận chuyển, quyền theo nhóm, thao tác nhận việc, lịch sử server; tự đóng khi không mở trình duyệt; bàn giao Closed cho tiếp nhận |
| Tư vấn (R-11/12/14) | `Assignments.tsx`, `types.ts`, `domain.ts`: activity call/zalo nhập tay, decision/reason/ghi chú, bộ đếm và nhóm nhiệm vụ | Phạm vi lưu bản ghi/đính kèm/chat, quyền ghi chú riêng, quy tắc đếm/reset, cập nhật đồng thời và lưu DB |
| Lịch hẹn/nhắc việc (R-13) | `Appointments.tsx`: danh sách, giờ/nơi hẹn, đã đến/không đến/hủy; cảnh báo quá giờ | Hẹn lại, xử lý không đến nhất quán với bộ đếm, kênh/thời điểm nhắc và tác vụ server |
| Dashboard/báo cáo (R-15/16) | `Dashboard.tsx`, `Reports.tsx`: KPI, phễu, bộ lọc, chi tiết, CSV | Chốt công thức/ngày lọc/quy công, quyền báo cáo và xuất SĐT; truy vấn DB theo đúng phạm vi |
| Quản trị/audit (R-06/17) | `Settings.tsx`: nguồn, thay vai trò/tạm ngưng user demo, bảng nhật ký | Tài khoản thật, danh mục trạng thái, audit server có thay đổi trước/sau và không cho sửa/xóa tùy ý |
| Mô hình (R-17) | `types.ts`: Member, Source, Lead, Assignment, Activity, Appointment, AuditLog | Schema nghiệp vụ, quan hệ/constraints/index/RLS; vai trò và LeadStatus đang là kiểu TS, chưa phải mô hình DB cho luồng Lead Sale |
| Tài liệu/demo (R-18…20) | Tài liệu `docs/`, test domain và e2e Lead Sale đã có trong repo | Cập nhật tài liệu theo code thật, dữ liệu mẫu DB, chạy kiểm thử, kịch bản demo theo vai trò và bằng chứng runtime |

Hạ tầng Supabase của Atomic CRM vẫn nằm trong `app/supabase/`; không vì có thư mục đó mà kết luận app Lead Sale đã nối DB. Tài liệu 02 là đối chiếu upstream tại mốc 20/10, không phải trạng thái hoàn thành của app hiện tại.

## 5. Lựa chọn demo cần ghi rõ, chưa phải yêu cầu đã chốt

| Mã Q | Code đang dùng | Điều cần quyết định trước nghiệm thu |
| --- | --- | --- |
| Q-01 | Lần KNM/quá hạn thứ 3 vẫn Open; trên 3 thì Solved (`domain.ts`) | Nguồn bỏ trống =3; xác định lần 3 hay 4, đếm tổng hay liên tiếp và khi nào reset |
| Q-02 | Hạn = tạo + 14×24 giờ; cả Solved cũng đóng khi hết hạn; kiểm tra lúc truy cập/thao tác và timer trình duyệt | Mốc thời gian chính thức, phạm vi tự đóng; chạy job độc lập trình duyệt |
| Q-03 | Admin/tiếp nhận đổi trạng thái hồ sơ thủ công; Activated/Closed giải quyết các phiếu New/Open | Ai xác nhận đăng ký/đơn đầu, bằng chứng và ánh xạ từ kết quả phiếu; hàng đợi Closed cần thêm |
| Q-04 | Lead Closed được chuyển về New bằng thao tác đổi trạng thái; cập nhật hồ sơ không tạo sự kiện tiếp nhận riêng | Tái tiếp nhận hồ sơ cũ, giữ ngày đầu và danh sách trong ngày, xử lý Activated/Onboarded |
| Q-05 | Một phiếu chưa Closed mỗi Lead; Solved vẫn chiếm phiếu hiệu lực; chuyển người đóng cũ/tạo mới và cấp lại 14 ngày | Cho phép đồng thời không; thời hạn sau chuyển việc; có chấp nhận đúng cách giữ lịch sử này không |
| Q-06 | 5 vai trò demo; Admin có quyền nghiệp vụ; danh sách hồ sơ/chi tiết chưa được giới hạn bằng DB | Phạm vi nhóm, quyền xem hồ sơ/lịch sử sau Closed, tuyển dụng có gộp Telesale không, quyền viewer |
| Q-07/08 | Call/Zalo nhập tay; nhập CSV, chưa đọc .xlsx; chưa lưu recording/chat/file trên activity | Mức tích hợp, tài khoản/API được cấp, định dạng nhập và cách lưu bằng chứng tư vấn |
| Q-09 | Lead mới theo receivedAt; quá hạn theo lịch scheduled đã qua giờ; chuyển đổi = Activated + Onboarded / tổng Lead chưa lưu trữ; lọc ngày tiếp nhận, quy công người trên phiếu tạo gần nhất | Công thức chính thức, mẫu số, thời gian lọc và cách quy công; hiện là công thức demo |
| Q-10 | Danh sách lịch/cảnh báo trong UI; không có tác vụ nhắc độc lập hoặc hàng đợi bàn giao hằng ngày | Kênh, lịch chạy, múi giờ, xử lý hẹn lại và kết quả bàn giao |
| Q-11 | Bắt buộc tên ≥2 ký tự, SĐT Việt Nam 10 số, thành phố, xe, nguồn; `0` ánh xạ none | Bộ trường và validation chính thức; ý nghĩa giá trị 0 và các trường ảnh chưa định nghĩa |
| Q-12 | Tiếp nhận/Admin lưu trữ khi không còn phiếu hiệu lực; giữ lịch sử | Quyền xóa/lưu trữ/khôi phục và điều kiện bảo toàn audit |
| Q-13 | Chưa có thông tin chốt trong nguồn | Tên đề tài, deadline, môi trường triển khai, dữ liệu mẫu và phạm vi bảo vệ |

Có thể tiếp tục chuẩn bị môi trường, kiến trúc và schema dự thảo theo các yêu cầu rõ. Khi làm phần phụ thuộc Q, ghi quyết định và căn cứ vào đây thay vì ngầm coi lựa chọn demo là câu trả lời của người đặt đề tài.

## 6. Thứ tự triển khai đề xuất trên app hiện có

Checklist thực hiện chi tiết, phụ thuộc và mốc sản phẩm nằm trong [kế hoạch triển khai](04-ke-hoach-trien-khai.md).

| Đợt | Công việc | Bằng chứng hoàn thành |
| --- | --- | --- |
| 1. Nền thật | Kiểm tra môi trường, cách chạy app và Supabase; thiết kế schema/quan hệ; Auth, profile, vai trò, RLS; giữ UI/pattern từ base | Đăng nhập/đổi mật khẩu được; dữ liệu tồn tại qua phiên; gọi API trực tiếp bằng sai vai trò bị từ chối |
| 2. Tiếp nhận | Hồ sơ, nguồn/nhãn, chống trùng phía DB, cập nhật trùng, nhập danh sách, sự kiện tiếp nhận và hàng đợi trưởng nhóm | Nhập tay/nhập file dùng cùng quy tắc; SĐT trùng không tạo hồ sơ mới; lần tiếp nhận đầu và lần bổ sung truy vết được |
| 3. Phân công | Phiếu/nhận việc/chuyển việc, lịch sử, workflow và quyền, hạn xử lý, tự đóng, hàng đợi Closed cho tiếp nhận | Thử chuyển người, mở lại Solved, ranh giới thời hạn và xử lý đồng thời; job chạy khi đóng trình duyệt |
| 4. Chăm sóc | Activity, bằng chứng gọi/chat theo mức đã chọn, lịch hẹn/hẹn lại, nhắc việc, nhóm nhiệm vụ và số đếm | Mỗi hoạt động giữ lịch sử/người/thời gian; nhóm và số đếm đúng; không nhân đôi nhắc việc/kết quả quá hẹn |
| 5. Báo cáo/bàn giao | KPI/phễu và bộ lọc đã chốt, quyền xuất dữ liệu, quản trị/audit, tài liệu kỹ thuật và demo | Đối chiếu bộ dữ liệu mẫu ra đúng số; demo xuyên suốt từ tiếp nhận đến đăng ký/đơn đầu theo các vai trò |

Theo `app/AGENTS.md`, schema khai báo trong `app/supabase/schemas/` là nguồn chính; tạo migration từ thay đổi schema, không sửa tùy tiện migration cũ. Tái sử dụng thành phần UI/Auth/data provider của base khi phù hợp; các command quan trọng cần giao dịch phía server để thay đổi nghiệp vụ và audit cùng thành công hoặc cùng thất bại. Chưa cần tạo backend REST riêng chỉ để viết chương API.

## 7. Ghi chú kỹ thuật phải bổ sung trong lúc code

- **Kiến trúc/triển khai:** frontend React/Vite, Supabase Auth/PostgreSQL/Storage/functions và nơi chạy tác vụ nền; chỉ vẽ cơ chế thực sự dùng.
- **Điều hướng/màn hình:** đăng nhập; dashboard; hồ sơ danh sách/tạo/sửa/chi tiết; lịch sử; hàng đợi phân công; nhóm nhiệm vụ/chi tiết phiếu; lịch hẹn; bàn giao Closed; báo cáo; quản trị.
- **CSDL:** ERD, trường/quan hệ/ràng buộc, unique SĐT, nguồn/status/role, lịch sử chuyển, policy quyền, index và dữ liệu mẫu. Cân nhắc sự kiện tiếp nhận/ImportBatch theo cách nhập thực tế.
- **API:** với mỗi Auth, REST resource, RPC hoặc Edge Function thật đang dùng, ghi method/path, input/output, mã lỗi và quyền; không liệt kê endpoint dự kiến như đã có.
- **Môi trường/cách chạy:** runtime và lệnh thực tế đã kiểm chứng, biến môi trường bằng tên không kèm secret, callback Auth, setup DB/storage/job, build và triển khai.
- **Tự động hóa:** mốc 14 ngày, nhắc lịch, bàn giao Closed, múi giờ UTC+7, lịch chạy, chạy lại không tạo trùng và nhật ký lỗi.
- **Nguồn gốc:** Atomic CRM upstream/commit, MIT/license, phần tận dụng và phần tự phát triển.
- **Kiểm chứng/demo:** tài khoản mẫu theo vai trò; dữ liệu có trùng SĐT, tái tiếp nhận, chuyển người, KNM/quá hạn 2/3/4, hết hạn, đăng ký và đơn đầu; kết quả dự kiến kèm bằng chứng chạy thật.

## 8. Checklist trước khi coi là bản đáp ứng đề tài

- [ ] Hoàn thiện FR-01…05; đưa phễu FR-06 vào bản demo theo phạm vi dự kiến.
- [ ] Chốt/ghi quyết định Q-01…13 ở phần liên quan; không còn quy tắc demo bị hiểu nhầm là yêu cầu nguồn.
- [ ] Quyền được kiểm tra tại DB/API, gồm cả truy cập trực tiếp hồ sơ/phiếu/lịch sử và xuất dữ liệu.
- [ ] Lead/Assignment/Activity có trạng thái riêng; đóng phiếu không làm mất hoặc tự đóng sai hồ sơ.
- [ ] Phân công, hoạt động, tiếp nhận lại và chuyển trạng thái có lịch sử phía server.
- [ ] Tự đóng/nhắc việc/bàn giao chạy độc lập trình duyệt, có kết quả kiểm tra.
- [ ] Báo cáo khớp dữ liệu chi tiết và bộ lọc, không đếm trùng Lead do có nhiều phiếu.
- [ ] Dữ liệu lưu Supabase thật; có hướng dẫn, bộ dữ liệu và kịch bản demo tái hiện được.
