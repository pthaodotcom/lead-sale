# Ghi nhận yêu cầu đề tài quản lý Lead tài xế

> **Hiện trạng mới 21/10/2026:** đã triển khai bản dùng Supabase thật theo yêu cầu “OK triển khai” của người dùng. Các nhận định “chưa nối DB/chờ bắt đầu” dưới đây là lịch sử khảo sát/thiết kế. Xem [bản bàn giao và giới hạn thực tế](06-ban-giao-va-van-hanh.md). Các đề xuất D-02…13 được dùng làm lựa chọn mặc định cho bản đầu trong phạm vi được giao triển khai; D-01/lần 3 có xác nhận riêng. Không đổi nội dung nguồn thành yêu cầu đã có sẵn. T-04 được điều chỉnh: hiện snapshot theo quyền, chưa phân trang server.

Ngày đọc đầu tiên: **20/10/2026**; đọc lại trực tiếp đủ 4 tab và 8 ảnh: **21/10/2026**. Trạng thái: **đã có bản xem thử Lead Sale trong `app/`, lưu dữ liệu trình duyệt; chưa nối Supabase Auth/RLS và dữ liệu nghiệp vụ thật, chưa chốt các quy tắc còn mâu thuẫn**. Trạng thái app được xác định bằng đọc code, chưa chạy kiểm chứng trong lần cập nhật này.

Nguồn chính: [Google Doc “Trang gửi Thảo nhen”](https://docs.google.com/document/d/1rMIJFe_yON1uunKA6UZ1Kie5wPEGddcJypAvm5wJBSI/edit). Đã đọc đủ 4 tab và xem đủ 8 ảnh. [Bản chụp ngày 20/10](sources/google-doc-2026-10-20.md) và [bản chụp đọc lại ngày 21/10](sources/google-doc-2026-10-21.md) dùng để đối chiếu khi nguồn thay đổi. [Ghi chú triển khai trên app hiện có](03-ghi-chu-trien-khai.md) phân biệt yêu cầu nguồn, lựa chọn demo và phần còn phải làm.

Các mục “Theo nguồn” là yêu cầu ghi nhận được. Các mục “Đề xuất” là hướng triển khai để trao đổi, chưa phải yêu cầu đã duyệt. Mã R và Q do mình đặt để theo dõi; FR-01…FR-06 giữ mã của ảnh nguồn.

Quyết định sau khi đọc nguồn được theo dõi trong [đặc tả bước 1](05-dac-ta-buoc-1.md). **Q-01/ngưỡng đã chốt ngày 21/10/2026:** người dùng chọn lần KNM hoặc quá hẹn thứ **3 → Solved**. Cách đếm/reset và các câu hỏi khác chưa vì vậy được chốt; giữ nguyên mô tả nguồn dưới đây để đối chiếu.

## 1. Mục tiêu và phạm vi

**Theo nguồn:** quản lý tài xế tiềm năng từ tiếp nhận thông tin → kiểm tra trùng → lập/cập nhật hồ sơ → phân công tư vấn → ghi nhận liên hệ, lịch hẹn → theo dõi đăng ký/chạy đơn đầu tiên → báo cáo.

Chưa thấy tên đề tài chính thức, deadline, số lượng người dùng hoặc ngưỡng hiệu năng cụ thể. Không suy diễn thành hệ thống vận hành chuyến xe, tính cước hay quản lý đơn hàng.

Ảnh BFD chia 5 phân hệ:

1. Quản lý hồ sơ Lead: cập nhật, nguồn/trạng thái, kiểm tra trùng, tra cứu/lọc.
2. Quản lý phân công tư vấn: tạo/cập nhật phiếu và lịch sử phân công.
3. Quản lý chăm sóc và chuyển đổi: hoạt động gọi/nhắn tin, trạng thái phiếu, lịch hẹn và nhắc việc.
4. Báo cáo/thống kê: tổng Lead, quá hạn, Lead mới, tỷ lệ chuyển đổi.
5. Quản trị: tài khoản và phân quyền theo vai trò.

## 2. Vai trò và quyền

| Vai trò trong nguồn | Quyền được mô tả | Điểm chưa rõ |
|---|---|---|
| Nhân viên tiếp nhận hồ sơ | Thu thập, kiểm tra trùng, tạo/bổ sung hồ sơ; nhận danh sách phiếu Closed để cập nhật trạng thái Lead | Ai được xóa hồ sơ và xác nhận Activated/Onboarded? |
| Trưởng nhóm Telesale | Nhận danh sách Lead New; tạo/cập nhật phân công; có thể đóng phiếu | Phạm vi nhóm; chuyển người phụ trách; xem/sửa hoạt động của nhân viên |
| Nhân viên Telesale | Xem hồ sơ; xử lý phiếu được phân công; ghi kết quả tư vấn, lịch hẹn | Xem toàn bộ hồ sơ hay chỉ Lead được giao; quyền xem lịch sử sau khi phiếu Closed |
| Quản trị viên | Quản lý tài khoản và phân quyền, theo yêu cầu của thầy/BFD | Có toàn quyền nghiệp vụ hay chỉ quản trị? |
| Người xem báo cáo | Có trong bảng phạm vi của thầy | Có xem dữ liệu chi tiết hoặc xuất danh sách chứa SĐT không? |

**R-01:** Đăng nhập, đổi mật khẩu và phân quyền; tài khoản không được xem/sửa chức năng ngoài quyền. Phải kiểm tra quyền cả phía dữ liệu/API và giao diện.

**Lưu ý:** nguồn có cả “nhân viên tuyển dụng” và “nhân viên Telesale”. Chưa mặc định hai tên này là cùng một vai trò, cũng chưa mặc định gộp tiếp nhận hồ sơ vào Telesale.

## 3. Tiếp nhận và quản lý hồ sơ Lead

**R-02 — Kênh tiếp nhận:** hotline, chat mạng xã hội, form website, tài xế cũ giới thiệu. Bảng của thầy cho chọn mức khả thi giữa Facebook Fanpage, form website, nhập Excel hoặc API mô phỏng; tích hợp ứng dụng phụ thuộc API/dữ liệu mẫu được cấp. Không có căn cứ yêu cầu tích hợp thật tất cả các kênh.

**R-03 — Chống trùng:** tìm theo số điện thoại trước khi tạo. Trùng thì bổ sung vào hồ sơ hiện có; không trùng thì lập hồ sơ mới. Cả hai nhánh đều được mô tả đưa vào danh sách Lead New trong ngày để chuyển trưởng nhóm. Cần làm rõ việc hồ sơ cũ đã Activated/Onboarded/Closed có thực sự quay lại danh sách này không.

**R-04 — Trường hồ sơ:** mã hồ sơ, số điện thoại, họ tên, thành phố đăng ký chạy xe, ngày tiếp nhận lần đầu (Lead date), nguồn Lead, Vehicle type (Van/Motorbike), trạng thái Lead. Chưa có bộ trường bắt buộc chính thức; không mặc định tất cả đều bắt buộc chỉ vì được liệt kê.

| Trạng thái hồ sơ | Ý nghĩa theo nguồn |
|---|---|
| New | Còn khả năng lên đăng ký |
| Activated | Hoàn tất đăng ký thành công |
| Onboarded | Đã chạy được đơn đầu tiên |
| Closed | Đóng hồ sơ vì không có nhu cầu đăng ký nữa hoặc sai SĐT |

**R-05:** CRUD, tìm kiếm, lọc, gắn nguồn, gắn nhãn; nhập danh sách theo bảng phạm vi của thầy. CRUD có bao gồm xóa nhưng chưa rõ xóa cứng, lưu trữ hay điều kiện hạn chế khi có lịch sử.

**R-06:** Quản lý danh mục nguồn và trạng thái Lead theo BFD. Danh mục thành phố, phương tiện, nơi hẹn và lý do cần thống nhất cách quản lý; chưa có danh sách đầy đủ từ nguồn.

## 4. Phân công tư vấn

**R-07:** Trưởng nhóm nhận Lead New và tạo phiếu phân công. Mỗi phiếu có mã phiếu, mã hồ sơ, thời điểm tạo, thời điểm cập nhật cuối, chuyên viên được giao, trạng thái.

**R-08:** Một Lead có thể được tư vấn nhiều lần bởi nhiều nhân viên; phải giữ lịch sử phân công. Theo yêu cầu của thầy còn có nhận việc, chuyển việc, lọc theo nhân viên và hạn xử lý; trưởng nhóm theo dõi được chưa xử lý/quá hạn. Chưa có quy tắc một Lead có được giao đồng thời cho nhiều người không.

| Trạng thái phiếu | Ý nghĩa/điều kiện theo nguồn |
|---|---|
| New | Chưa được chuyên viên liên hệ |
| Open | Đang tư vấn/cần chăm sóc tiếp; không nghe máy < 3 lần; có khả năng đăng ký trong 14 ngày kể từ lúc tạo phiếu; quá hạn < 3 lần |
| Solved | Không cần chuyên viên này chăm sóc tiếp: không có nhu cầu, không đủ điều kiện, đã Activated, không nghe máy > 3 lần hoặc quá hẹn đăng ký > 3 lần |
| Solved → Open | Có thể mở lại để chăm sóc trong 14 ngày kể từ ngày tạo phiếu |
| Closed | Tự cập nhật sau 14 ngày kể từ khi tạo hoặc do trưởng nhóm đóng; Lead không còn thuộc quyền quản lý của nhân viên đã được giao |

**R-09:** Danh sách phiếu Closed hằng ngày được gửi tới bộ phận tiếp nhận để cập nhật trạng thái hồ sơ. Chưa xác định “gửi” là hàng đợi trong ứng dụng, email hay xuất file.

**R-10:** Chỉ cho chuyển trạng thái theo workflow đã định; có lịch sử chuyển và lý do thất bại. Ma trận chuyển trạng thái đầy đủ chưa có trong nguồn, cần bổ sung trước khi code.

## 5. Tư vấn, hoạt động và lịch hẹn

**R-11:** Chuyên viên mở phiếu, thực hiện gọi điện/nhắn Zalo; có bản ghi cuộc gọi/phần chat và thời gian thực hiện. Lưu được loại hoạt động, thời gian, kết quả, ghi chú và người phụ trách.

**R-12 — Các trường ghi nhận:**

| Trường | Giá trị/ý nghĩa theo nguồn |
|---|---|
| Call date | Ngày gọi |
| Status liên hệ | New; Đã gọi; Không nghe máy 1/2/3; Quá hạn 1/2/3; Sai SĐT |
| Decision | Đồng ý; Không đồng ý; Cúp ngang; 0 |
| Reason | Không có nhu cầu; Tạm thời bận; Không đủ điều kiện đăng ký; 0 |
| Decision date | Ngày hẹn |
| Decision place | Nơi hẹn |
| Ghi chú | Nội dung bổ sung |

Ảnh chi tiết còn hiển thị `type`, `Reason_disconnect`, `decision_time`, file đính kèm, trình phát ghi âm và ghi chú “chỉ được thấy bởi chuyên viên”. Đây là chi tiết tham khảo trong ảnh; chưa có định nghĩa dữ liệu, danh mục hoặc quyền tương ứng để mặc định đưa nguyên vào sản phẩm.

**R-13:** Quản lý lịch hẹn và nhắc việc; nguồn chưa xác định thời điểm nhắc, kênh thông báo hoặc cách xử lý hẹn lại/không đến.

**R-14 — Mục Nhiệm vụ:** có các mục con bấm vào để lọc ra phiếu tương ứng. Ảnh minh họa gồm: chưa giải quyết; Đồng ý; Không nghe; Không nghe 1; Không nghe 2; Quá hạn; Quá hạn 1; Quá hạn 2; cập nhật gần đây. Các số đếm là dữ liệu ảnh minh họa, không phải dữ liệu phải hard-code. Nguồn chữ có KNM3/Quá hạn3 nhưng ảnh menu không hiển thị mục cấp 3.

Ảnh dashboard nhiệm vụ có Kanban, lịch, khối lượng công việc, tin nhắn, dự án và nâng cấp gói. Chỉ được giới thiệu là giao diện tham khảo; không tự mở rộng đề tài sang các module này.

## 6. Dashboard và báo cáo

**R-15 — Dashboard:** tổng Lead, Lead mới, Lead quá hạn, tỷ lệ chuyển đổi, biểu đồ phễu; số liệu cập nhật đúng khi dữ liệu thay đổi.

**R-16 — Báo cáo:** số Lead theo nguồn/trạng thái/nhân viên, tỷ lệ quá hạn, phễu chuyển đổi; lọc theo thời gian, nguồn, trạng thái, nhân viên. Báo cáo phải khớp dữ liệu chi tiết khi đối chiếu mẫu. Xuất CSV/XLSX được ghi “nếu phù hợp”, chưa phải yêu cầu bắt buộc cả hai định dạng.

Chưa có công thức thống nhất cho: Lead mới (ngày tạo hay ngày tiếp nhận lại), Lead quá hạn (trễ liên hệ, trễ hẹn hay hết 14 ngày), mẫu số tỷ lệ chuyển đổi/quá hạn, cách quy công khi một Lead có nhiều người phụ trách, thời gian báo cáo (Lead date/Assignment date/Activity date/ngày chuyển đổi). Không dùng số phiếu làm số Lead.

**Mâu thuẫn mức ưu tiên:** bảng FR ghi FR-06 báo cáo phễu là “Nên”; bảng phạm vi lại ghi Báo cáo gồm phễu là “Bắt buộc”, và bảng chức năng tối thiểu cũng có phễu. Đề xuất vẫn dự kiến làm phễu và ghi nhận mâu thuẫn để chốt, không tự bỏ.

## 7. Yêu cầu dữ liệu, tài liệu kỹ thuật và demo

**R-17 — Mô hình tối thiểu thầy nêu:** User, Role, Lead, LeadSource, LeadStatus, Activity, Assignment, Appointment, AuditLog. ImportBatch/IntegrationEvent có thể thêm khi có nhập/tích hợp. Đây là yêu cầu mô hình nghiệp vụ, không mặc định tất cả phải là tên bảng vật lý tiếng Anh y hệt.

**R-18 — Nội dung cần note cho người làm đề tài:** kiến trúc tổng thể, sơ đồ triển khai, điều hướng, màn hình đăng nhập/dashboard/danh sách và chi tiết Lead/lịch sử hoạt động/hàng đợi phân công/báo cáo/quản trị danh mục; cấu trúc code; cấu hình môi trường; CSDL; dữ liệu mẫu; cách chạy hệ thống.

**R-19 — API quan trọng:** ghi phương thức, đường dẫn, đầu vào, đầu ra, mã lỗi, quyền truy cập. Ghi chú “chắc bài không có API” trong tab NHỜ THẢO là nhận định của người gửi; với base Supabase vẫn có API nội bộ để frontend đọc/ghi dữ liệu. Tích hợp bên ngoài là một phạm vi khác.

**R-20 — Bằng chứng sản phẩm:** bản chạy được và kịch bản demo là chính; ảnh chụp chỉ minh họa. Nếu có tích hợp thật phải mô tả xác thực, xử lý lỗi, giới hạn dữ liệu, phương án khi dịch vụ ngoài không sẵn sàng.

## 8. Đối chiếu các mã FR trong ảnh

| Mã gốc | Nội dung | Ưu tiên gốc | Tiêu chí nghiệm thu gốc | Nhóm note |
|---|---|---|---|---|
| FR-01 | Tạo Lead thủ công | Bắt buộc | Lưu đủ thông tin bắt buộc, cảnh báo trùng SĐT | R-03/04/05 |
| FR-02 | Tiếp nhận Lead từ nguồn nhập liệu | Bắt buộc | Có nguồn, thời điểm tiếp nhận và trạng thái ban đầu | R-02/04 |
| FR-03 | Gán Lead cho nhân viên | Bắt buộc | Đúng người có quyền thực hiện, có lịch sử | R-07/08 |
| FR-04 | Cập nhật trạng thái theo workflow | Bắt buộc | Chỉ cho chuyển theo quy tắc đã định | R-10 |
| FR-05 | Ghi nhận hoạt động tư vấn | Bắt buộc | Có loại, thời gian, kết quả và ghi chú | R-11/12 |
| FR-06 | Xem báo cáo phễu | Nên | Lọc theo thời gian, nguồn, nhân viên | R-15/16 |

## 9. Các câu hỏi cần chốt trước phần code liên quan

| Mã | Câu hỏi | Ảnh hưởng |
|---|---|---|
| Q-01 | Đúng lần KNM/quá hạn thứ 3 là Open hay Solved? Nguồn dùng <3 và >3, bỏ trống =3 | Chặn hoàn thiện rule trạng thái |
| Q-02 | Mốc 14 ngày là đủ 14×24 giờ hay hết ngày thứ 14; Solved cũng tự Closed? | Chặn hoàn thiện tác vụ tự đóng |
| Q-03 | Closed trên phiếu ánh xạ ra trạng thái hồ sơ thế nào theo từng kết quả? Ai xác nhận Activated/Onboarded, lấy dữ liệu từ đâu? | Chặn tự động cập nhật hồ sơ/phễu |
| Q-04 | Lead trùng đã Activated/Onboarded/Closed có đưa lại danh sách New và được phân công lại không? | Chặn logic tái tiếp nhận |
| Q-05 | Một Lead có nhiều phiếu đang hiệu lực đồng thời không? Chuyển việc là sửa người trên phiếu hay đóng/tạo phiếu mới? | Chặn ràng buộc phân công và attribution |
| Q-06 | Gộp/tách tiếp nhận, tuyển dụng và Telesale ra sao; phạm vi nhóm và quyền xem lịch sử sau Closed? | Chặn hoàn thiện ma trận quyền |
| Q-07 | Ghi nhận gọi/Zalo thủ công, đính kèm file hay cần gọi/chat và đồng bộ thật? Có tài khoản/API nào được cấp? | Quyết định phạm vi tích hợp |
| Q-08 | Chọn nguồn nhập khả thi nào; “nhập Excel” có bắt buộc .xlsx hay chấp nhận CSV xuất từ Excel? | Quyết định bộ nhập danh sách |
| Q-09 | Công thức từng KPI, ngày lọc và cách quy công nhân viên là gì? | Chặn nghiệm thu báo cáo |
| Q-10 | Nhắc việc và danh sách Closed gửi bằng kênh nào, lúc nào; lịch hẹn có giờ và địa điểm chuẩn không? | Quyết định notification/job |
| Q-11 | Trường nào bắt buộc; “0” là chưa xác định hay giá trị nghiệp vụ; Reason_disconnect/decision_time có cần không? | Chặn validation hoàn chỉnh |
| Q-12 | Ai được xóa Lead, cách giữ audit và lịch sử khi xóa? | Quyết định CRUD/xóa dữ liệu |
| Q-13 | Tên đề tài chính thức, thời hạn, môi trường triển khai, dữ liệu mẫu và mức báo cáo cần bảo vệ? | Chốt kế hoạch và tài liệu bàn giao |

Các câu hỏi nghiệp vụ do người dùng/người đặt đề tài xác nhận. Cách hiện thực kỹ thuật sẽ do mình và bạn chọn theo môi trường thực tế. Có thể dựng nền và mô hình dự thảo trong khi chờ; không hard-code câu trả lời cho các quy tắc còn mở.

## 10. Đề xuất thứ tự làm và checklist nghiệm thu

Đây là đề xuất triển khai, chưa phải lịch/ước lượng đã cam kết:

1. Chốt Q-01…06 và phạm vi nhập/tích hợp; thống nhất từ điển 3 nhóm trạng thái, vai trò và trường dữ liệu.
2. Dựng Atomic CRM với Supabase thật; giữ mốc upstream; đăng nhập/đổi mật khẩu; quyền phía DB/API.
3. Hồ sơ Lead, danh mục/nhãn, chống trùng, tiếp nhận và nhập danh sách đã chọn.
4. Phiếu phân công, nhận/chuyển việc, lịch sử, hạn 14 ngày và tự đóng theo quy tắc đã chốt.
5. Activity, kết quả tư vấn, lịch hẹn/nhắc việc, danh sách con của Nhiệm vụ, bàn giao phiếu Closed.
6. Dashboard/báo cáo theo công thức thống nhất; AuditLog, bộ dữ liệu mẫu, hướng dẫn và demo hoàn chỉnh.

Checklist kiểm chứng khi triển khai:

- [ ] Tạo Lead hợp lệ; thiếu trường bắt buộc bị từ chối; SĐT trùng được xử lý nhất quán cả nhập tay và nhập danh sách.
- [ ] Đúng quyền tạo/sửa hồ sơ, giao việc, ghi hoạt động; thử trực tiếp API với tài khoản không đủ quyền cũng bị chặn.
- [ ] Phân công/chuyển việc giữ được lịch sử; một Lead không bị tính trùng trong báo cáo.
- [ ] Ghi mỗi lần gọi/nhắn tin có người, thời gian, kết quả; lịch sử cũ còn sau khi cập nhật mới.
- [ ] KNM/quá hạn ở lần 2/3/4 và thời điểm ngay trước/đúng/sau hạn 14 ngày theo quy tắc được chốt.
- [ ] Solved mở lại đúng hạn; Closed loại khỏi quyền xử lý của nhân viên cũ theo ma trận quyền.
- [ ] Có danh sách Closed hằng ngày; cập nhật hồ sơ theo kết quả, không tự coi mọi phiếu Closed là Lead Closed.
- [ ] Nhắc việc, danh sách con và số đếm khớp dữ liệu thực; nhấp mục con mở đúng nhóm phiếu.
- [ ] Dashboard/báo cáo đối chiếu được từng hồ sơ, bộ lọc và người phụ trách.
- [ ] Audit giữ được người/thời điểm/thay đổi cần truy vết; có demo chạy với DB thật và note kỹ thuật tương ứng.
