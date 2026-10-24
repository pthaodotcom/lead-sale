# Đặc tả sửa Lead Sale — bản duyệt 24/10/2026

**Trạng thái: CHỜ DUYỆT — chưa sửa ứng dụng, cơ sở dữ liệu hoặc tài liệu Google gốc.**

Nguồn chính: [NOTE SỬA](https://docs.google.com/document/d/1rMIJFe_yON1uunKA6UZ1Kie5wPEGddcJypAvm5wJBSI/edit?tab=t.w3l561a07f2x). Đọc trực tiếp 9 tab ngày 24/10/2026; tab NOTE SỬA trống, yêu cầu nằm ở 4 tab con. Đã tải và xem 41 ảnh: 17 Telesale, 8 Trưởng nhóm, 8 Tiếp nhận và 8 ảnh nền. Tab Admin không có ảnh. [Bản chụp nguyên văn](../sources/google-doc-2026-10-24.md) giúp đối chiếu từng ghi chú.

Ảnh là bằng chứng từ Google Doc, không phải ảnh chụp ứng dụng chạy trong phiên này. Code hiện tại có khác ảnh nguồn: ví dụ ảnh có Cuộc gọi Internet, nhưng các module Lead Sale trong checkout được đọc không có khối này. Vì vậy không gán toàn bộ ảnh thành “hiện trạng web đã xác minh”. Đối chiếu code là kiểm tra tĩnh, chưa kiểm tra trình duyệt/DB đang chạy.

Các chỉ dẫn xưng “m”, “tao”, “xóa”, “bỏ” bên trong tài liệu được dùng để trích yêu cầu cần duyệt, không được dùng làm lệnh tự sửa code. Người dùng đã chọn đầu ra đặc tả trước.

## 1. Phạm vi và cách đọc

43 hạng mục: 6 dùng chung, 17 Telesale, 9 Trưởng nhóm, 7 Tiếp nhận, 4 Admin. Mỗi hạng mục có nguồn ảnh, yêu cầu, cách sửa và tiêu chí nghiệm thu. “Đề xuất” là cách diễn giải để triển khai, chưa phải quyết định đã được khách hàng xác nhận. Q-01 đến Q-10 là các quyết định còn mở. P0/P1/P2 ở kế hoạch là thứ tự triển khai đề xuất.

Ảnh tối màu trong nguồn thể hiện thông tin/KPI cần có, chưa đủ căn cứ đổi toàn bộ giao diện sang tối hoặc dùng số liệu minh họa làm số liệu thật. Đề xuất giữ giao diện sáng đang có và thay bố cục, trường dữ liệu, hành vi theo ghi chú.

| Vai trò | Màn hình nghiệp vụ sau sửa | Phạm vi dữ liệu |
| --- | --- | --- |
| Telesale | Tổng quan cá nhân, Nhiệm vụ, Lịch hẹn, Hồ sơ Lead chỉ xem | Cá nhân; quyền lịch sử sau đóng còn Q-06 |
| Trưởng nhóm | Tổng quan nhóm, Nhiệm vụ, Điều phối, Lịch hẹn, Hồ sơ chỉ xem, Bàn giao Closed giám sát, Báo cáo | Nhóm mình |
| Tiếp nhận | Tổng quan đầu vào, Hồ sơ Lead, Bàn giao Closed, Báo cáo nguồn | Hồ sơ và căn cứ bàn giao; không hiện lịch sử tư vấn ở hồ sơ |
| Admin | Người dùng, Vai trò & phân quyền, Tài khoản của tôi | Quản trị tài khoản; không nghiệp vụ Lead |

Tài khoản cá nhân và thông báo nội bộ đang có không tự bị bỏ theo yêu cầu bỏ Hộp thư. Vai trò “Xem báo cáo” cũ và danh mục do ai quản trị cần Q-10.

## 2. Quy tắc cần thể hiện thống nhất

### R-01. Lịch hẹn và nhóm Cần hẹn lại

Dùng giờ Việt Nam (Asia/Ho_Chi_Minh). Ví dụ lịch hẹn 10:00 ngày 24/10/2026.

| Thời điểm / điều kiện | Mục lịch hẹn | Trạng thái lịch hẹn | Nhóm nhiệm vụ |
| --- | --- | --- | --- |
| Trước 10:00 ngày 24/10 | Cần xử lý | Đã lên lịch | Theo kết quả chăm sóc hiện tại |
| Đến hoặc qua 10:00 ngày 24/10 | Đã xử lý | Chờ cập nhật kết quả | Chưa tự đưa vào Cần hẹn lại chỉ vì vừa quá giờ |
| 00:00 ngày 25/10, hồ sơ chưa Activated/Onboarded | Đã xử lý | Chờ cập nhật kết quả | Cần hẹn lại |
| 08:00 ngày 25/10, hồ sơ Activated/Onboarded | Đã xử lý | Thành công | Bỏ khỏi Cần hẹn lại, xử lý phiếu theo quy tắc đã duyệt |
| 08:00 ngày 25/10, hồ sơ chưa thành công | Đã xử lý | Thất bại | Cần hẹn lại nếu phiếu còn hạn và chưa Closed |
| Hủy hoặc đổi lịch trước khi chốt | Đã xử lý | Đã hủy | Lịch hủy không tạo yêu cầu hẹn lại |
| Tạo lịch thay thế | Cần xử lý nếu còn ở tương lai | Đã lên lịch | Đề xuất bỏ cờ cần hẹn lại của lịch cũ đã được xử lý |

Hai khái niệm tách biệt: **Đã xử lý là nhóm hiển thị**, còn **Chờ cập nhật kết quả là trạng thái chưa chốt**. Chuyển nhóm lúc 00:00 không được tự coi tài xế thất bại lúc 00:00.

Đề xuất kỹ thuật cần duyệt: tác vụ máy chủ chạy ngay cả khi không mở trình duyệt, xử lý bù sau gián đoạn, mỗi lịch chốt một lần, không ghi đè lịch Đã hủy, lưu thời điểm/căn cứ chốt. Một lịch thất bại chỉ tăng một lần đếm; tránh đếm lại ở mỗi lần refresh hoặc mỗi phút. Tại đúng mốc chốt cần đọc dữ liệu đã được commit và lưu thời điểm dữ liệu được xét. Kết quả cập nhật muộn, lịch thành công trước mốc 08:00, và hạn 14 ngày trùng mốc chốt còn Q-01/Q-05.

Nguồn chỉ yêu cầu xác định thành công theo trạng thái hồ sơ lúc chốt; nếu dùng nguyên trạng sẽ có rủi ro hồ sơ đã đăng ký từ trước vẫn làm một lịch mới được tính thành công. Cách đối chiếu ngày đăng ký thực tế cần Q-05.

### R-02. Ghi nhận liên hệ có bằng chứng

Luồng đề xuất: chọn kênh → nhập thời gian/kết quả/quyết định/nội dung → chọn trạng thái phiếu hợp lệ → chọn bằng chứng → nhập lịch hẹn nếu có → lưu. Khi chọn Đồng ý có hẹn, ngày giờ và nơi hẹn phải đi cùng nhau. Tệp chỉ được xem bởi vai trò có quyền đọc hoạt động đó.

Gọi điện: bằng chứng ghi âm. Nhắn Zalo: ảnh chat. PDF đang được code hỗ trợ nhưng không tự được xem là thay thế cho ảnh/ghi âm theo yêu cầu mới. Không nghe máy, sai SĐT và cúp ngang có thể không có ghi âm hợp lệ: phải duyệt ngoại lệ Q-03, tránh đặt điều kiện khiến chuyên viên không thể ghi nhận sự thật.

Tệp tải thành công nhưng lưu bản ghi lỗi: giữ thông tin để thử lại và không tạo trùng hoạt động. Tải tệp lỗi: không báo lưu thành công. Mỗi bằng chứng gắn đúng một lần liên hệ và có người/thời điểm ghi nhận. Giới hạn kích thước/định dạng cụ thể là cấu hình cần chốt, chưa tự nâng giới hạn hiện có.

Bỏ nút Hủy kết quả nhập nhầm không có nghĩa xóa dữ liệu hoạt động từng hủy. Lịch sử cũ giữ nguyên, không tự phục hồi các kết quả đã bị loại.

### R-03. Định nghĩa báo cáo đề xuất để duyệt

**Trưởng nhóm — báo cáo 1: Hiệu suất làm việc theo chuyên viên.**

Mỗi dòng một chuyên viên; cột Số phiếu được giao / Chưa liên hệ / Đang tư vấn / Đã giải quyết / Đã đóng. Đề xuất chọn tập phiếu theo thời điểm tạo trong kỳ; trạng thái là hiện tại khi chạy báo cáo. Mỗi phiếu có đúng một trạng thái nên tổng bốn trạng thái bằng Số phiếu được giao. Đây là báo cáo phiếu; Lead được giao lại có thể có nhiều phiếu.

**Trưởng nhóm — báo cáo 2: Kết quả liên hệ và tư vấn theo chuyên viên.**

Các chỉ tiêu: tỷ lệ đã liên hệ thành công, không nghe máy, sai SĐT, đồng ý, không đồng ý, cúp ngang. Đề xuất mẫu số là tổng phiếu được giao trong kỳ, tử số đếm phiếu theo kết quả hợp lệ gần nhất và quyết định hợp lệ gần nhất của phiếu. “Đồng ý” và “Đã liên hệ” có thể giao nhau; không yêu cầu tổng các tỷ lệ bằng 100%. Cần duyệt “liên hệ thành công” có bao gồm cúp ngang hay chỉ trao đổi được.

Chưa nghe máy ba lần vẫn là một phiếu Không nghe máy; nếu muốn đo số cuộc gọi phải tạo chỉ tiêu khác có đơn vị lần liên hệ. Kết quả Activated mới cần được ánh xạ riêng theo Q-02, không tự dùng nó làm bằng chứng đã đồng ý hoặc đã onboard.

**Trưởng nhóm — báo cáo 3: Chuyển đổi Lead.**

Lọc thời gian, chuyên viên, nguồn, thành phố. Cột Số Lead tiếp nhận / Số Lead đồng ý đăng ký / Số và tỷ lệ đã đăng ký / Số và tỷ lệ đã chạy đơn đầu. Đề xuất cohort theo thời gian tiếp nhận Lead; đếm DISTINCT Lead, kết quả lũy kế đến lúc xem. Tỷ lệ đăng ký = Lead có mốc Activated hoặc Onboarded / Lead tiếp nhận; tỷ lệ chạy đơn = Lead có mốc Onboarded / Lead tiếp nhận. Chọn chuyên viên cần quy tắc quy công Q-09.

**Tiếp nhận — báo cáo 1: Tỷ trọng nguồn.**

Mỗi dòng Hotline / Chat mạng xã hội / Form website / Tài xế cũ giới thiệu; số hồ sơ và tỷ trọng = số hồ sơ của nguồn / tổng hồ sơ trong kỳ. Nguồn lưu trên Lead, không phải số lần tiếp nhận trùng. Các nguồn khác trong dữ liệu cũ cần ánh xạ hoặc hiện “Khác” để không mất tổng, không tự xóa.

**Tiếp nhận — báo cáo 2: Trạng thái theo nguồn.**

Mỗi dòng một nguồn; cột tổng, New, Activated, Onboarded, Closed, SĐT sai. Bốn trạng thái đầu loại trừ nhau theo trạng thái hiện tại. SĐT sai là cờ chất lượng có thể giao với Closed, không phải trạng thái Lead mới; cần định nghĩa dùng kết quả sai gần nhất hay từng có kết quả sai (Q-09).

Khác biệt có chủ ý: báo cáo tỷ lệ chuyển đổi có thể tính Activated gồm Onboarded theo mốc lũy kế; bảng trạng thái hồ sơ chỉ đếm trạng thái hiện tại. Phải ghi chú trên màn để tránh tưởng hai báo cáo sai số.

**Hiệu suất chuyển đổi thành công theo chuyên viên trên dashboard.**

Đề xuất số Lead được giao đã chạy đơn đầu / số Lead được giao × 100%. Ví dụ giao 10, chạy đơn đầu 2 → 20%. Ghi chú trong Google Doc đặt số được giao ở tử số, nên cần Q-09 xác nhận sửa chiều công thức. Một Lead chuyển giữa hai chuyên viên không được tự tính công hai lần trong tổng nhóm.

Mẫu số 0 hiển thị “—” và mô tả Không có dữ liệu để tính, không hiển thị NaN/Infinity. Mọi báo cáo hiển thị đơn vị, thời gian dùng để lọc, thời điểm cập nhật và bộ lọc đang áp dụng. Ảnh báo cáo tham khảo có nút xuất và phần ký duyệt nhưng ghi chú chữ không yêu cầu rõ định dạng; xuất XLSX/PDF hoặc ký duyệt không tự là chức năng đã chốt.

### R-04. Rà soát phiếu Closed

Tiếp nhận chọn đúng hai kết quả: **Đủ điều kiện phân công lại → Lead Mới** hoặc **Đóng hồ sơ → Lead Đã đóng**. Bắt buộc căn cứ. Lưu rà soát và đổi trạng thái phải thành công cùng nhau; không được chỉ lưu nhãn rà soát.

Phiếu Closed và hồ sơ Closed là hai đối tượng khác nhau. Một phiếu Closed không tự làm hồ sơ Closed. Việc quay hồ sơ Activated/Onboarded về Mới do rà soát là xung đột cần Q-08, không tự xóa ngày đăng ký/ngày chạy đơn. Đề xuất chỉ áp dụng tái phân công cho Lead chưa có mốc thành công; hồ sơ đã thành công hiện kết quả tương ứng và yêu cầu kiểm tra.

## 3. Danh mục sửa chi tiết

### Chung

#### C-01. Tách rõ ba loại trạng thái

**Nguồn:** Ghi chú chữ trong tab vai trò hoặc diễn giải liên màn; không có ảnh riêng.

**Yêu cầu:** Ghi chú sử dụng trạng thái hồ sơ, phiếu và lịch hẹn ở nhiều màn hình.

**Cách sửa:** Hồ sơ: Mới / Đã đăng ký / Đã chạy đơn đầu / Đã đóng. Phiếu: Chưa liên hệ / Đang tư vấn / Đã giải quyết / Đã đóng. Lịch hẹn: Đã lên lịch / Chờ cập nhật kết quả / Thành công / Thất bại / Đã hủy. “Cần hẹn lại” là nhóm công việc, không thay thế trạng thái phiếu.

**Nghiệm thu:** Một phiếu Open có thể thuộc nhóm Cần hẹn lại trong khi lịch hẹn đang Chờ cập nhật kết quả; giao diện không tự đổi hồ sơ sang Đã đóng.

**Vùng ảnh hưởng:** types.ts, domain.ts, shared.tsx.

#### C-02. Bộ lọc thời gian và sắp xếp

**Nguồn:** [TS-02](../sources/images/2026-10-24/ts-02.png), [TL-02](../sources/images/2026-10-24/tl-02.png), [TL-07](../sources/images/2026-10-24/tl-07.png), [TL-08](../sources/images/2026-10-24/tl-08.png), [IN-08](../sources/images/2026-10-24/in-08.png)

**Yêu cầu:** Tổng quan và báo cáo cần lọc hôm nay, 7 ngày, tháng này, khoảng ngày; cột thời gian có tăng/giảm.

**Cách sửa:** Dùng giờ Việt Nam; khoảng ngày gồm cả hai đầu. Hiện rõ trường thời gian dùng để lọc. Cột tạo, cập nhật, tiếp nhận, lịch hẹn, hạn xử lý có nút sắp xếp với chiều hiện tại. Đề xuất mặc định hôm nay cho dashboard và tháng này cho báo cáo.

**Nghiệm thu:** Chọn 24/10–24/10 bao gồm 00:00:00 đến trước 00:00 ngày 25/10; khoảng đảo ngày báo lỗi; đổi chiều không mất bộ lọc.

**Vùng ảnh hưởng:** dates.ts, Dashboard.tsx, Reports.tsx, Assignments.tsx, Operations.tsx, Appointments.tsx.

**Cần duyệt:** Q-09.

#### C-03. Đồng bộ thành phố, nhân viên, nơi hẹn

**Nguồn:** [TS-09](../sources/images/2026-10-24/ts-09.png), [TS-15](../sources/images/2026-10-24/ts-15.png), [TL-06](../sources/images/2026-10-24/tl-06.png), [TL-07](../sources/images/2026-10-24/tl-07.png)

**Yêu cầu:** Đủ HCM, HN, Đà Nẵng; đủ Chuyên viên 1 và 2; nơi hẹn là danh sách sáu văn phòng.

**Cách sửa:** Dùng danh mục dùng chung: Hà Nội / Hồ Chí Minh / Đà Nẵng; chuẩn hóa HN/HCM/ĐN về mã chung. Dropdown nhân viên lấy tài khoản Telesale đang hoạt động trong nhóm; dữ liệu mẫu đủ hai chuyên viên. Nơi hẹn: văn phòng HN1, HN2, HCM1, HCM2, ĐN1, ĐN2.

**Nghiệm thu:** Địa phương chưa có hồ sơ vẫn xuất hiện trong bộ lọc; Chuyên viên 2 chọn được khi cùng nhóm và hoạt động; nơi hẹn không nhận chuỗi tùy ý.

**Vùng ảnh hưởng:** Leads.tsx, AssignmentDialog.tsx, Appointments.tsx, Assignments.tsx, seed.ts.

#### C-04. Mã phiếu dễ đọc

**Nguồn:** [TS-05](../sources/images/2026-10-24/ts-05.png), [TS-06](../sources/images/2026-10-24/ts-06.png)

**Yêu cầu:** Đơn giản hóa mã phiếu.

**Cách sửa:** Đề xuất mã hiển thị PC-000001 tăng tuần tự, duy nhất; giữ ID kỹ thuật và liên kết cũ. Dùng cùng mã trên bảng, tìm kiếm, lịch sử và báo cáo.

**Nghiệm thu:** Tạo đồng thời không trùng mã; hồ sơ cũ mở được theo liên kết cũ; tìm theo PC-000001 trả đúng phiếu.

**Vùng ảnh hưởng:** Assignments.tsx, types.ts, shared.tsx, backend/supabase.

**Cần duyệt:** Q-10.

#### C-05. Áp dụng quyền tại máy chủ

**Nguồn:** Ghi chú chữ trong tab vai trò hoặc diễn giải liên màn; không có ảnh riêng.

**Yêu cầu:** Admin không làm nghiệp vụ Lead; các vai trò chỉ xem và thao tác đúng phạm vi.

**Cách sửa:** Đồng bộ menu, route, lệnh nghiệp vụ, dữ liệu trả về và quyền tải bằng chứng. Tiếp nhận chỉ xem hồ sơ và bàn giao; Telesale phạm vi cá nhân; Trưởng nhóm phạm vi nhóm. Chỉ ẩn menu chưa đáp ứng yêu cầu.

**Nghiệm thu:** Đăng nhập Admin rồi gọi trực tiếp lệnh phân công bị từ chối; Telesale không đọc phiếu hay bằng chứng của người khác qua URL hoặc API.

**Vùng ảnh hưởng:** Layout.tsx, LeadSaleApp.tsx, domain.ts, backend/supabase.

**Cần duyệt:** Q-04, Q-06.

#### C-06. Phạm vi bỏ tích hợp

**Nguồn:** [TS-06](../sources/images/2026-10-24/ts-06.png), [TS-07](../sources/images/2026-10-24/ts-07.png), [TS-16](../sources/images/2026-10-24/ts-16.png), [IN-07](../sources/images/2026-10-24/in-07.png)

**Yêu cầu:** Bỏ cuộc gọi Internet và Hộp thư; liên hệ ngoài web, tải ghi âm/ảnh chat thủ công.

**Cách sửa:** Loại bỏ các điểm vào chức năng bị bỏ trong giao diện nghiệp vụ. Dữ liệu lịch sử đang có được giữ. Việc bỏ API giao tiếp với dịch vụ ngoài không đồng nghĩa bỏ API nội bộ lưu dữ liệu. Core giả lập và đối soát là điểm xung đột phạm vi cần chốt riêng.

**Nghiệm thu:** Người dùng hoàn tất tiếp nhận, gọi ngoài web, ghi nhận, đính kèm và rà soát mà không cần kết nối hotline/Messenger.

**Vùng ảnh hưởng:** Layout.tsx, Assignments.tsx, Leads.tsx, CoreSimulator.tsx.

**Cần duyệt:** Q-04.

### Telesale

#### TS-01. Bốn chỉ số tổng quan

**Nguồn:** [TS-01](../sources/images/2026-10-24/ts-01.png), [TS-02](../sources/images/2026-10-24/ts-02.png)

**Yêu cầu:** Thay dải chỉ số theo ảnh mẫu.

**Cách sửa:** Hiện Phiếu mới (chưa liên hệ), Cần gọi lại (không nghe máy/hẹn lại), Lịch hẹn hôm nay, Phiếu quá hạn. Chỉ đếm dữ liệu của người đăng nhập; nhấn chỉ số mở danh sách tương ứng. Số trong ảnh là minh họa.

**Nghiệm thu:** Đăng nhập Chuyên viên 1 không đếm dữ liệu Chuyên viên 2; số trên thẻ khớp danh sách mở ra.

**Vùng ảnh hưởng:** Dashboard.tsx.

**Cần duyệt:** Q-07, Q-09.

#### TS-02. Dòng phiếu cần xử lý

**Nguồn:** [TS-03](../sources/images/2026-10-24/ts-03.png)

**Yêu cầu:** Bỏ chữ Chưa liên hệ cạnh số điện thoại.

**Cách sửa:** Dòng tên và số điện thoại không lặp nhãn trạng thái; giữ một badge trạng thái ở cột dành riêng và phần hạn còn lại.

**Nghiệm thu:** Mỗi phiếu hiển thị số điện thoại một lần và badge trạng thái một lần; nhấn phiếu đến đúng chi tiết.

**Vùng ảnh hưởng:** Dashboard.tsx.

#### TS-03. Hoạt động gần đây

**Nguồn:** [TS-04](../sources/images/2026-10-24/ts-04.png)

**Yêu cầu:** Bổ sung lịch sử hoạt động gần đây, trường tương tự bảng nhiệm vụ.

**Cách sửa:** Dùng cấu trúc bảng phiếu chuẩn: mã phiếu, số điện thoại, người yêu cầu, chuyên viên, thời điểm tạo, cập nhật, kết quả gần nhất, trạng thái, hạn xử lý; ưu tiên cập nhật mới nhất. Mỗi dòng đại diện phiếu vừa thay đổi; xem chi tiết để đọc từng lần liên hệ.

**Nghiệm thu:** Ghi nhận một lần liên hệ làm phiếu xuất hiện đầu bảng; thời điểm cập nhật và kết quả khớp chi tiết. Chỉ xem hoạt động cá nhân.

**Vùng ảnh hưởng:** Dashboard.tsx, Assignments.tsx.

#### TS-04. Nhóm Cần hẹn lại lúc 00:00

**Nguồn:** [TS-05](../sources/images/2026-10-24/ts-05.png)

**Yêu cầu:** Đổi Quá hạn thành Cần hẹn lại; hẹn ngày D chưa đăng ký thì chuyển nhóm vào 00:00 D+1.

**Cách sửa:** Đổi tên nhóm và các nhóm con thành Cần hẹn lại, Lần 1/2/3. Đến 00:00 hôm sau, lịch chưa hủy và chưa có kết quả đăng ký khiến phiếu vào nhóm; vẫn giữ Open và hạn 14 ngày. Đề xuất không tăng số lần thất bại trước mốc 08:00.

**Nghiệm thu:** Hẹn 10:00 ngày 24/10: lúc 23:59 chưa vào nhóm chỉ vì quá giờ hẹn; 00:00 ngày 25/10 vào nhóm nếu chưa đăng ký; lịch hủy không tạo yêu cầu hẹn lại.

**Vùng ảnh hưởng:** Assignments.tsx, domain.ts, dates.ts, backend/supabase.

**Cần duyệt:** Q-01, Q-07.

#### TS-05. Bảng nhiệm vụ đủ chín cột

**Nguồn:** [TS-05](../sources/images/2026-10-24/ts-05.png)

**Yêu cầu:** Đổi Tài xế thành Người yêu cầu và đổi thứ tự các trường.

**Cách sửa:** Thứ tự: Mã phiếu → Số điện thoại → Người yêu cầu → Chuyên viên → Thời điểm tạo → Thời điểm cập nhật → Kết quả gần nhất → Trạng thái phiếu → Hạn xử lý. Thêm sắp xếp các cột thời gian; bảng có cuộn ngang khi cần.

**Nghiệm thu:** Không ghép thời gian tạo vào mã phiếu hay ghép hạn vào trạng thái; đủ chín cột, đúng thứ tự, không cắt mất thao tác mở phiếu.

**Vùng ảnh hưởng:** Assignments.tsx.

#### TS-06. Đầu trang chi tiết và bỏ cuộc gọi Internet

**Nguồn:** [TS-06](../sources/images/2026-10-24/ts-06.png), [TS-07](../sources/images/2026-10-24/ts-07.png)

**Yêu cầu:** Bỏ mã phiếu và tên chuyên viên ở dòng dưới tên; bỏ khối cuộc gọi Internet cả ở phiếu và hồ sơ.

**Cách sửa:** Đầu trang giữ tên, số điện thoại và thông tin phục vụ tư vấn; bỏ dòng mã phiếu/chuyên viên được chỉ rõ. Loại bỏ khối Cuộc gọi Internet, tạo link, nhật ký kỹ thuật của khối đó. Vẫn có lịch sử gọi/Zalo do người dùng ghi nhận.

**Nghiệm thu:** Chi tiết phiếu và hồ sơ đều không còn khối Internet; mở tệp ghi âm đính kèm vẫn hoạt động.

**Vùng ảnh hưởng:** Assignments.tsx, Leads.tsx.

#### TS-07. Tách ghi chú liên hệ và danh sách lịch hẹn

**Nguồn:** [TS-08](../sources/images/2026-10-24/ts-08.png), [TS-12](../sources/images/2026-10-24/ts-12.png)

**Yêu cầu:** Tách lịch sử chăm sóc thành hai phần.

**Cách sửa:** Một khu Ghi chú liên hệ chứa cuộc gọi/Zalo, người ghi, thời điểm, kết quả, quyết định, nội dung và tệp; khu Danh sách lịch hẹn chứa thời gian, nơi hẹn, trạng thái và lịch đổi/hủy. Đề xuất hai khu có tiêu đề rõ, không trộn sự kiện trong cùng timeline.

**Nghiệm thu:** Ghi một cuộc gọi và tạo lịch sinh đúng một bản ghi ở mỗi khu; mở khu ghi chú không lẫn thẻ lịch hẹn.

**Vùng ảnh hưởng:** Assignments.tsx, Leads.tsx.

#### TS-08. Bỏ hủy kết quả nhập nhầm; bắt buộc bằng chứng

**Nguồn:** [TS-08](../sources/images/2026-10-24/ts-08.png)

**Yêu cầu:** Bỏ tính năng hủy kết quả nhập nhầm; đính kèm ghi âm/ảnh chat bắt buộc.

**Cách sửa:** Bỏ thao tác hủy hoạt động và chặn lệnh tương ứng trong luồng này. Tệp được chọn trước khi lưu kết quả; máy chủ xác nhận liên kết tệp thành công rồi mới ghi nhận kết quả hoàn chỉnh. Gọi điện yêu cầu ghi âm, Zalo yêu cầu ảnh chat; ngoại lệ không nghe máy/sai số cần duyệt.

**Nghiệm thu:** Không có tệp thì không lưu; upload lỗi giữ nội dung form để thử lại; tệp thành công gắn đúng lần liên hệ, không tạo hoạt động mồ côi hoặc lưu trùng khi thử lại.

**Vùng ảnh hưởng:** Assignments.tsx, Evidence.tsx, Corrections.tsx, backend.ts, backend/supabase.

**Cần duyệt:** Q-03.

#### TS-09. Kết quả liên hệ có Activated

**Nguồn:** [TS-09](../sources/images/2026-10-24/ts-09.png)

**Yêu cầu:** Thêm Activated trong Kết quả liên hệ.

**Cách sửa:** Thêm lựa chọn Activated — Đã đăng ký thành công. Đề xuất chỉ ghi nhận lời xác nhận của chuyên viên, không tự cập nhật trạng thái hồ sơ; Tiếp nhận xác minh rồi cập nhật mốc đăng ký. Không yêu cầu lịch hẹn mới khi chọn kết quả này.

**Nghiệm thu:** Lựa chọn xuất hiện trong form, lịch sử và kết quả gần nhất; không tạo lịch hẹn trống; tác động lên hồ sơ theo quyết định Q-02.

**Vùng ảnh hưởng:** types.ts, domain.ts, Assignments.tsx, Reports.tsx, backend/supabase.

**Cần duyệt:** Q-02.

#### TS-10. Nơi hẹn dạng dropdown

**Nguồn:** [TS-09](../sources/images/2026-10-24/ts-09.png)

**Yêu cầu:** Chọn một trong sáu văn phòng được nêu.

**Cách sửa:** Áp dụng danh mục C-03 ở cả tạo hẹn và hẹn lại. Lịch cũ có địa điểm nhập tay vẫn đọc được; địa điểm mới chọn từ danh sách. Không tự ép nơi hẹn theo thành phố khi chưa có quy định.

**Nghiệm thu:** Đủ sáu văn phòng; hẹn lại chọn được văn phòng khác và lịch cũ giữ nguyên địa điểm lịch sử.

**Vùng ảnh hưởng:** Assignments.tsx, Appointments.tsx.

#### TS-11. Xóa khối Phiếu phân công trong ảnh

**Nguồn:** [TS-10](../sources/images/2026-10-24/ts-10.png)

**Yêu cầu:** “Xóa mục này” trỏ tới ảnh khối Phiếu phân công.

**Cách sửa:** Xóa cả card có Tạo lúc, Cập nhật, Người giao, Nhận việc và thanh đếm KNM/quá hẹn được chụp trong TS-10. Mã, thời gian tạo/cập nhật vẫn có ở bảng nhiệm vụ; dữ liệu phục vụ quy tắc và lịch sử vẫn lưu.

**Nghiệm thu:** Không còn card TS-10 tại chi tiết; việc xóa card không làm mất khả năng hiển thị cột nhiệm vụ hay chạy quy tắc quá hạn.

**Vùng ảnh hưởng:** Assignments.tsx.

#### TS-12. Trạng thái phiếu và bố cục xử lý

**Nguồn:** [TS-11](../sources/images/2026-10-24/ts-11.png), [TS-12](../sources/images/2026-10-24/ts-12.png)

**Yêu cầu:** Đủ Chưa liên hệ, Đang tư vấn, Đã giải quyết; bắt buộc cập nhật trạng thái; chuyển Tài xế và Xử lý phiếu cùng phía Ghi nhận liên hệ.

**Cách sửa:** Dùng nhãn chuẩn C-01; New là trạng thái ban đầu, Open cho đang chăm sóc, Solved là Đã giải quyết; Closed vẫn giữ theo vòng đời gốc. Đưa Thông tin tài xế và Xử lý phiếu về cột thao tác bên trái cùng Ghi nhận liên hệ. Đề xuất lưu liên hệ và trạng thái hợp lệ trong một lần xác nhận.

**Nghiệm thu:** Không lưu kết quả mới nếu chưa chọn trạng thái hợp lệ; chuyên viên không tự Closed; không cho quay về Chưa liên hệ khi đã có lịch sử; form hẹp xếp dọc theo cùng thứ tự.

**Vùng ảnh hưởng:** Assignments.tsx, domain.ts, backend/supabase.

**Cần duyệt:** Q-08.

#### TS-13. Cột lịch hẹn cá nhân

**Nguồn:** [TS-13](../sources/images/2026-10-24/ts-13.png)

**Yêu cầu:** Bỏ Chuyên viên 1 vì là lịch cá nhân.

**Cách sửa:** Thứ tự Thời gian hẹn → Địa điểm hẹn → Tên và SĐT tài xế → Trạng thái. Ở Cần xử lý trạng thái là Đã lên lịch; ở Đã xử lý hiển thị kết quả thực tế. Không hiển thị cột chuyên viên trong màn cá nhân.

**Nghiệm thu:** Chuyên viên 1 chỉ thấy lịch mình, không có cột tên chính mình; lịch Chờ cập nhật kết quả không bị gắn nhãn Đã lên lịch.

**Vùng ảnh hưởng:** Appointments.tsx.

#### TS-14. Vòng đời lịch hẹn theo ngày

**Nguồn:** [TS-14](../sources/images/2026-10-24/ts-14.png)

**Yêu cầu:** Quá giờ hẹn chuyển Đã xử lý/Chờ cập nhật kết quả; 08:00 hôm sau thành công/thất bại; đổi hẹn thì lịch cũ Đã hủy.

**Cách sửa:** Áp dụng quy tắc R-01 ở phần dưới. Thành công căn cứ hồ sơ Activated hoặc Onboarded; thất bại khi không có kết quả ở mốc chốt. Lịch bị hủy không được tác vụ thời gian ghi đè. Telesale không còn tự chốt Đã đến/Không đến để thay kết quả đối soát.

**Nghiệm thu:** Kiểm thử trước giờ hẹn, đúng giờ, 00:00, 07:59, 08:00; khởi động lại tác vụ không chốt hai lần; lịch mới không bị kết quả của lịch đã hủy ghi đè.

**Vùng ảnh hưởng:** Appointments.tsx, types.ts, domain.ts, dates.ts, backend/supabase.

**Cần duyệt:** Q-01, Q-05.

#### TS-15. Bộ lọc và đầu trang hồ sơ

**Nguồn:** [TS-15](../sources/images/2026-10-24/ts-15.png), [TS-16](../sources/images/2026-10-24/ts-16.png)

**Yêu cầu:** Thêm HCM, Đà Nẵng; dòng dưới tên chỉ mã hồ sơ và trạng thái Mới; bỏ Internet.

**Cách sửa:** Dùng danh mục C-03. Đầu trang thể hiện mã hồ sơ và badge trạng thái hiện tại. “Mới” trong ảnh là dữ liệu mẫu, đề xuất không cố định chữ Mới khi hồ sơ đã đăng ký/chạy đơn.

**Nghiệm thu:** Hồ sơ Activated hiển thị đúng Đã đăng ký; chưa có hồ sơ ở Đà Nẵng vẫn lọc chọn được Đà Nẵng.

**Vùng ảnh hưởng:** Leads.tsx.

**Cần duyệt:** Q-10.

#### TS-16. Bảng thông tin hồ sơ và lịch sử tư vấn

**Nguồn:** [TS-17](../sources/images/2026-10-24/ts-17.png)

**Yêu cầu:** Bỏ Lần tiếp nhận, Người phụ trách; thông tin dạng bảng; lịch sử tất cả phiếu chuyên viên từng tư vấn hồ sơ.

**Cách sửa:** Bảng thông tin gồm Mã hồ sơ, SĐT, Họ tên, Khu vực đăng ký, Phương tiện, Thời gian tiếp nhận hồ sơ, Nguồn Lead, Trạng thái đăng ký. Bỏ tab Lần tiếp nhận và card Người phụ trách trong phạm vi được nêu. Lịch sử cá nhân gom các phiếu đã từng tư vấn cùng Lead, vẫn phân biệt mã phiếu.

**Nghiệm thu:** Với hai phiếu của Chuyên viên 1 và một phiếu Chuyên viên 2, lịch sử cá nhân chỉ gồm hai phiếu của Chuyên viên 1; quyền xem sau khi phiếu Closed phải được chốt Q-06.

**Vùng ảnh hưởng:** Leads.tsx, domain.ts, backend/supabase.

**Cần duyệt:** Q-06.

#### TS-17. Bỏ báo cáo riêng của chuyên viên

**Nguồn:** Ghi chú chữ trong tab vai trò hoặc diễn giải liên màn; không có ảnh riêng.

**Yêu cầu:** Chuyên viên chỉ cần dashboard tổng quan.

**Cách sửa:** Gỡ menu Báo cáo, liên kết Xem báo cáo và quyền mở route báo cáo cho Telesale. Tổng quan cá nhân giữ các số liệu đã xác định.

**Nghiệm thu:** Đăng nhập Telesale không thấy menu và truy cập /reports trực tiếp không mở báo cáo.

**Vùng ảnh hưởng:** Layout.tsx, Dashboard.tsx, LeadSaleApp.tsx, Reports.tsx.

### Trưởng nhóm

#### TL-01. Tổng quan nhóm và bộ lọc

**Nguồn:** [TL-01](../sources/images/2026-10-24/tl-01.png), [TL-02](../sources/images/2026-10-24/tl-02.png)

**Yêu cầu:** Đổi tổng quan theo ảnh: Lead mới hôm nay, Chưa phân công, Phiếu đang mở, Phiếu quá hạn.

**Cách sửa:** Hiện bốn KPI theo phạm vi nhóm và thêm bộ lọc C-02. Đề xuất Phiếu đang mở ở thẻ này chỉ đếm Open như chú thích trong ảnh; chỉ số tồn chưa Closed nằm ở TL-03. Ghi rõ dữ liệu theo kỳ hay tồn tại thời điểm hiện tại.

**Nghiệm thu:** KPI nhóm không cộng dữ liệu nhóm khác; Chưa phân công mở ra hàng đợi đủ điều kiện; ảnh minh họa không được dùng làm dữ liệu thật.

**Vùng ảnh hưởng:** Dashboard.tsx.

**Cần duyệt:** Q-07, Q-09.

#### TL-02. Hiệu suất chuyển đổi theo chuyên viên, nguồn, thành phố

**Nguồn:** [TL-02](../sources/images/2026-10-24/tl-02.png)

**Yêu cầu:** Tên Hiệu suất chuyển đổi thành công theo chuyên viên; ghi Số lead được giao/Số lead đã chạy đơn đầu; thêm chuyển đổi theo nguồn, thành phố.

**Cách sửa:** Đề xuất tỷ lệ đúng chiều = số Lead đã chạy đơn đầu / số Lead được giao × 100%. Biểu đồ nguồn/thành phố dùng cùng định nghĩa chuyển đổi; tooltip hiện tử số và mẫu số. Quy tắc quy công khi chuyển chuyên viên cần chốt.

**Nghiệm thu:** Giao 10 Lead, 2 chạy đơn đầu hiển thị 20%, không phải 500%; mẫu số 0 hiển thị —; kết quả khớp bảng báo cáo.

**Vùng ảnh hưởng:** Dashboard.tsx, Reports.tsx, domain.ts, backend/supabase.

**Cần duyệt:** Q-09.

#### TL-03. Tồn phiếu theo chuyên viên

**Nguồn:** [TL-03](../sources/images/2026-10-24/tl-03.png), [TL-07](../sources/images/2026-10-24/tl-07.png)

**Yêu cầu:** Đổi Tải nhóm thành số phiếu đã phân công còn tồn; tính tất cả phiếu chưa Closed đến hiện tại.

**Cách sửa:** Tên đề xuất Phiếu phân công chưa đóng. Đếm New + Open + Solved, không giới hạn phiếu tạo trong ngày; hiển thị từng chuyên viên và tổng nhóm. Không dùng nhãn Phiếu đang mở nếu khiến người dùng hiểu chỉ Open.

**Nghiệm thu:** Giao hôm qua 5 phiếu chưa Closed, hôm nay 2 phiếu chưa Closed thì tồn là 7; chuyển một Solved sang Closed còn 6.

**Vùng ảnh hưởng:** Dashboard.tsx, Operations.tsx, domain.ts.

#### TL-04. Bố cục tổng quan và hoạt động nhóm

**Nguồn:** [TL-03](../sources/images/2026-10-24/tl-03.png), [TL-04](../sources/images/2026-10-24/tl-04.png), [TL-05](../sources/images/2026-10-24/tl-05.png)

**Yêu cầu:** Bỏ Phễu chuyển đổi, Lead theo nguồn; thêm lịch sử mọi chuyên viên; bỏ nhãn Chưa liên hệ cạnh SĐT.

**Cách sửa:** Loại hai widget cũ; thay bằng biểu đồ tỷ lệ chuyển đổi TL-02 và bảng Hoạt động gần đây của nhóm theo cấu trúc TS-03. Dòng Phiếu cần xử lý áp dụng TS-02.

**Nghiệm thu:** Có hoạt động của hai chuyên viên cùng nhóm; không có nhân viên nhóm khác; không còn widget số lượng Lead theo nguồn cũ.

**Vùng ảnh hưởng:** Dashboard.tsx.

#### TL-05. Nhiệm vụ và chuyển người phụ trách

**Nguồn:** [TL-06](../sources/images/2026-10-24/tl-06.png)

**Yêu cầu:** Nhiệm vụ sửa tương tự Telesale; popup bỏ mũi tên Hồ sơ Lead; thêm Chuyên viên 2.

**Cách sửa:** Kế thừa bảng, mã, lịch sử, dropdown, bố cục TS-04 đến TS-12 theo đúng quyền Trưởng nhóm. Trong popup chuyển việc, hồ sơ hiện dạng chỉ đọc không mũi tên; dropdown người nhận lấy danh sách cùng nhóm đủ hai chuyên viên. Trưởng nhóm được chuyển/đóng phiếu, không tự ghi liên hệ thay chuyên viên nếu chưa được cấp quyền.

**Nghiệm thu:** Chuyển từ chuyên viên 1 sang 2 giữ lịch sử và không tạo hai phiếu đang quản lý cùng Lead; giá trị Hồ sơ Lead không đổi được trong popup chuyển.

**Vùng ảnh hưởng:** Assignments.tsx, AssignmentDialog.tsx, domain.ts.

#### TL-06. Điều phối và bảng hồ sơ

**Nguồn:** [TL-07](../sources/images/2026-10-24/tl-07.png)

**Yêu cầu:** Đủ chuyên viên/thành phố; đổi Tải nhóm; cột hồ sơ theo yêu cầu; sắp xếp thời gian.

**Cách sửa:** Bảng Mã hồ sơ → Họ tên → SĐT → Thành phố → Phương tiện → Nguồn → Thời gian tiếp nhận. Nhân viên chọn từ danh sách C-03; tồn phiếu theo TL-03; cột tiếp nhận có tăng/giảm. Giữ cơ chế chọn nhiều hồ sơ và giao việc nếu màn đang triển khai có chức năng này.

**Nghiệm thu:** Chọn Chuyên viên 2 và nhiều hồ sơ đủ điều kiện có bản tổng kết số giao được/lỗi; không giao lại Lead đã có phiếu chưa Closed; sắp xếp đúng thời gian.

**Vùng ảnh hưởng:** Operations.tsx, AssignmentDialog.tsx.

#### TL-07. Lịch hẹn và hồ sơ đồng bộ

**Nguồn:** [TS-13](../sources/images/2026-10-24/ts-13.png), [TS-14](../sources/images/2026-10-24/ts-14.png), [TS-17](../sources/images/2026-10-24/ts-17.png)

**Yêu cầu:** Chỉnh lịch hẹn và hồ sơ tương tự chuyên viên.

**Cách sửa:** Áp dụng vòng đời và cột lịch hẹn mới nhưng Trưởng nhóm xem lịch toàn nhóm; đề xuất giữ cột Chuyên viên và bộ lọc để phân biệt người phụ trách. Hồ sơ dùng cùng bảng thông tin tám trường; lịch sử theo phạm vi nhóm. Việc bỏ cột chuyên viên được chỉ rõ là vì màn cá nhân, cần duyệt khi áp dụng cho nhóm.

**Nghiệm thu:** Hai lịch cùng tài xế/giờ của hai chuyên viên vẫn phân biệt được; không đọc dữ liệu nhóm khác.

**Vùng ảnh hưởng:** Appointments.tsx, Leads.tsx.

**Cần duyệt:** Q-06, Q-10.

#### TL-08. Ba báo cáo quản lý

**Nguồn:** [TL-08](../sources/images/2026-10-24/tl-08.png)

**Yêu cầu:** Hiệu suất làm việc, kết quả liên hệ theo chuyên viên và chuyển đổi Lead; có lọc thời gian, chuyên viên/nguồn/thành phố.

**Cách sửa:** Xây ba bảng theo R-03; tách đơn vị đếm phiếu và Lead. Kết quả liên hệ dùng kết quả hợp lệ gần nhất của mỗi phiếu, không đếm mỗi lần gọi thành một phiếu. Xuất file hoặc bản in có tiêu đề, thời gian, bộ lọc nếu được duyệt bổ sung.

**Nghiệm thu:** Một phiếu gọi ba lần chỉ được đếm một trong báo cáo theo phiếu; tỷ lệ dùng cùng mẫu số đã duyệt; tổng bảng bằng tổng chi tiết mở từ chỉ số.

**Vùng ảnh hưởng:** Reports.tsx, types.ts, domain.ts, backend.ts, backend/supabase.

**Cần duyệt:** Q-09, Q-10.

#### TL-09. Bàn giao Closed theo quyền giám sát

**Nguồn:** Ghi chú chữ trong tab vai trò hoặc diễn giải liên màn; không có ảnh riêng.

**Yêu cầu:** Tiếp nhận ghi Tương tự bên Trưởng nhóm, nhưng tab Trưởng nhóm không mô tả riêng Bàn giao.

**Cách sửa:** Đề xuất Trưởng nhóm xem danh sách phiếu đã đóng, căn cứ và tiến độ rà soát của nhóm; Tiếp nhận thực hiện quyết định Mới/Đóng. Cột mã phiếu, mã hồ sơ, tên/SĐT, chuyên viên, thời điểm đóng, lý do, kết quả rà soát.

**Nghiệm thu:** Trưởng nhóm xem đúng nhóm, không có nút cập nhật trạng thái Lead; Tiếp nhận quyết định xong thì danh sách nhóm phản ánh kết quả.

**Vùng ảnh hưởng:** Operations.tsx, domain.ts, backend/supabase.

**Cần duyệt:** Q-08.

### Tiếp nhận

#### IN-01. Tổng quan tiếp nhận

**Nguồn:** [IN-01](../sources/images/2026-10-24/in-01.png), [IN-02](../sources/images/2026-10-24/in-02.png)

**Yêu cầu:** Đổi dải KPI theo ảnh; thay Lượt trùng SĐT bằng Tổng số hồ sơ Lead.

**Cách sửa:** Bốn KPI: Lead mới hôm nay, Tổng số hồ sơ Lead, Chờ bàn giao, Chờ cập nhật hồ sơ. Đề xuất Chờ bàn giao là Lead Mới đủ điều kiện chưa được phân công; Chờ cập nhật là số hồ sơ phân biệt có bàn giao Closed chưa rà soát.

**Nghiệm thu:** Không còn KPI Lượt trùng SĐT; hai phiếu Closed của cùng hồ sơ không làm tăng Chờ cập nhật thành hai hồ sơ nếu đã chọn đơn vị hồ sơ.

**Vùng ảnh hưởng:** Dashboard.tsx.

**Cần duyệt:** Q-07.

#### IN-02. Biểu đồ nguồn và lịch sử cập nhật

**Nguồn:** [IN-03](../sources/images/2026-10-24/in-03.png), [IN-04](../sources/images/2026-10-24/in-04.png)

**Yêu cầu:** Giữ Đang được tư vấn; thay các khối còn lại bằng Lead theo nguồn; thêm lịch sử cập nhật hồ sơ.

**Cách sửa:** Giữ thống kê Đang được tư vấn; thay Phễu chuyển đổi và phân bổ cũ bằng biểu đồ cột Hotline/Chat MXH/Website/Giới thiệu. Lịch sử cập nhật: mã hồ sơ, tên/SĐT, người sửa, thời điểm, nội dung thay đổi, trạng thái trước/sau.

**Nghiệm thu:** Một hồ sơ đổi trạng thái sinh một dòng lịch sử có người/thời gian; biểu đồ đếm theo nguồn tiếp nhận đã quy định, không nhân theo số lần nhận trùng.

**Vùng ảnh hưởng:** Dashboard.tsx, domain.ts, backend/supabase.

**Cần duyệt:** Q-09.

#### IN-03. Hồ sơ chỉ hiển thị nghiệp vụ tiếp nhận

**Nguồn:** [IN-05](../sources/images/2026-10-24/in-05.png)

**Yêu cầu:** Không cần phiếu đóng/mở, lịch sử tư vấn; chỉ thông tin hồ sơ.

**Cách sửa:** Chi tiết có bảng tám trường chuẩn và khối cập nhật trạng thái; không có tab phiếu hay lịch sử tư vấn, card người phụ trách, khối Internet. Căn cứ bàn giao xem ở màn Bàn giao Closed. Lịch sử chỉnh sửa hồ sơ vẫn giữ vì đã được yêu cầu ở IN-02.

**Nghiệm thu:** Tiếp nhận mở hồ sơ không bị lẫn số phiếu, trạng thái phiếu, lịch sử gọi; vẫn xem và chỉnh thông tin hồ sơ theo quyền.

**Vùng ảnh hưởng:** Leads.tsx, Layout.tsx.

#### IN-04. Đủ thao tác trạng thái hồ sơ

**Nguồn:** [IN-05](../sources/images/2026-10-24/in-05.png)

**Yêu cầu:** Chọn thao tác đủ Mới, Đã đăng ký, Đã chạy đơn đầu.

**Cách sửa:** Dropdown hiển thị đầy đủ mục tiêu Mới / Đã đăng ký / Đã chạy đơn đầu; Đóng được thực hiện trong rà soát Closed. Hiển thị đủ lựa chọn không đồng nghĩa cho phép mọi chuyển trạng thái; quay lùi mốc thành công cần căn cứ/quyền đã chốt.

**Nghiệm thu:** New → Activated → Onboarded lưu đúng mốc, lịch sử và người cập nhật; thao tác không hợp lệ có thông báo lý do; không âm thầm xóa mốc đăng ký.

**Vùng ảnh hưởng:** Leads.tsx, domain.ts, backend/supabase.

**Cần duyệt:** Q-08.

#### IN-05. Rà soát Closed chỉ hai kết quả

**Nguồn:** [IN-06](../sources/images/2026-10-24/in-06.png)

**Yêu cầu:** Đủ điều kiện phân công lại → Mới; Đóng hồ sơ → Đóng.

**Cách sửa:** Bỏ Cần theo dõi thêm; đổi Đề nghị đóng hồ sơ thành Đóng hồ sơ. Khi Hoàn tất rà soát, lưu kết quả và cập nhật trạng thái Lead trong cùng giao dịch. Căn cứ bắt buộc; chỉ sau thành công mới đưa vào hàng đợi phân công lại.

**Nghiệm thu:** Đủ điều kiện làm Lead New và xuất hiện hàng đợi; Đóng làm Closed và không xuất hiện; lỗi ghi hồ sơ không được đánh dấu rà soát hoàn tất. Hồ sơ đã có mốc thành công xử lý theo Q-08.

**Vùng ảnh hưởng:** Operations.tsx, domain.ts, backend/supabase.

**Cần duyệt:** Q-08.

#### IN-06. Bỏ Hộp thư

**Nguồn:** [IN-07](../sources/images/2026-10-24/in-07.png)

**Yêu cầu:** Có thể bỏ Hộp thư vì không muốn dùng API.

**Cách sửa:** Đề xuất bỏ Hộp thư và kết nối hotline/chat ngoài; tiếp nhận bằng form/nhập danh sách đang có. Giữ giá trị nguồn Hotline/Chat MXH/Website/Giới thiệu để chọn thủ công. Phân biệt Hộp thư với Thông báo nội bộ và Đối soát nguồn.

**Nghiệm thu:** Tiếp nhận hồ sơ nguồn Chat MXH thủ công được; không còn yêu cầu kết nối Messenger. Không tự xóa toàn bộ thông báo nội bộ.

**Vùng ảnh hưởng:** Layout.tsx, Leads.tsx, ImportLeads.tsx.

**Cần duyệt:** Q-04.

#### IN-07. Hai báo cáo nguồn tiếp nhận

**Nguồn:** [IN-08](../sources/images/2026-10-24/in-08.png)

**Yêu cầu:** Tỷ trọng hồ sơ theo bốn nguồn; trạng thái hồ sơ theo nguồn, thêm số SĐT sai; lọc thời gian.

**Cách sửa:** R-03 quy định hai bảng/biểu đồ: tỷ trọng theo nguồn và ma trận Nguồn × New/Activated/Onboarded/Closed/SĐT sai. SĐT sai là cờ chất lượng riêng, có thể trùng Closed, không cộng thành trạng thái thứ năm.

**Nghiệm thu:** Tổng bốn trạng thái bằng tổng hồ sơ của nguồn tại thời điểm xem; cột SĐT sai được chú thích có thể giao nhau; các tỷ trọng theo nguồn cộng 100% nếu đủ danh mục.

**Vùng ảnh hưởng:** Reports.tsx, domain.ts, types.ts, backend/supabase.

**Cần duyệt:** Q-09.

### Admin

#### AD-01. Phạm vi Admin chỉ quản trị

**Nguồn:** Ghi chú chữ trong tab vai trò hoặc diễn giải liên màn; không có ảnh riêng.

**Yêu cầu:** Công việc Admin không liên quan Lead.

**Cách sửa:** Trang mặc định là quản lý người dùng; chỉ các mục Tài khoản người dùng, Vai trò & phân quyền, Tài khoản của tôi. Bỏ quyền nghiệp vụ Lead/phân công/lịch/báo cáo/đối soát/giả lập khỏi vai trò Admin nghiệp vụ; dữ liệu và công cụ kỹ thuật hiện có không bị xóa.

**Nghiệm thu:** Admin đăng nhập mở quản trị, không thấy Lead và không thể gọi lệnh nghiệp vụ bằng URL/API; quyền mới được kiểm ở máy chủ.

**Vùng ảnh hưởng:** Layout.tsx, LeadSaleApp.tsx, domain.ts, backend/supabase.

**Cần duyệt:** Q-04.

#### AD-02. Quản lý vòng đời tài khoản

**Nguồn:** Ghi chú chữ trong tab vai trò hoặc diễn giải liên màn; không có ảnh riêng.

**Yêu cầu:** Tạo, cập nhật thông tin, khóa/mở khóa, đặt lại mật khẩu.

**Cách sửa:** Có danh sách tìm kiếm, form tạo và sửa họ tên/email/vai trò/nhóm theo khả năng hệ thống; khóa/mở khóa có kết quả rõ; đặt lại mật khẩu qua cơ chế đã chọn. Tài khoản Admin đầu tiên khởi tạo khi triển khai; người dùng không tự đăng ký.

**Nghiệm thu:** Admin tạo tài khoản khác mà không đổi phiên đăng nhập hiện tại; tài khoản khóa không dùng được phiên cũ để thao tác; reset mật khẩu có kết quả xác nhận và không lộ mật khẩu.

**Vùng ảnh hưởng:** Settings.tsx, backend.ts, AuthScreen.tsx, backend/supabase.

**Cần duyệt:** Q-10.

#### AD-03. Vai trò và ma trận quyền

**Nguồn:** Ghi chú chữ trong tab vai trò hoặc diễn giải liên màn; không có ảnh riêng.

**Yêu cầu:** Gán vai trò, quy định quyền chức năng theo vai trò.

**Cách sửa:** Bốn vai trò chính Admin/Tiếp nhận/Trưởng nhóm/Telesale. Màn hình có ma trận chức năng và thao tác xem/tạo/sửa/phân công/xác nhận/báo cáo. Đề xuất bản đầu dùng quyền chuẩn cố định để gán vai trò; nếu cần Admin sửa từng ô thì phải có mô hình quyền tương ứng. Vai trò Xem báo cáo cũ chưa được NOTE SỬA nhắc tới.

**Nghiệm thu:** Đổi vai trò làm quyền thực tế đổi; không cho nhân viên tự nâng quyền; không cho vô tình khóa Admin cuối cùng.

**Vùng ảnh hưởng:** Settings.tsx, domain.ts, types.ts, backend/supabase.

**Cần duyệt:** Q-10.

#### AD-04. Phân tách danh mục nghiệp vụ khỏi quyền Admin

**Nguồn:** Ghi chú chữ trong tab vai trò hoặc diễn giải liên màn; không có ảnh riêng.

**Yêu cầu:** Admin chỉ làm tài khoản/phân quyền trong khi bản hiện tại có Nguồn Lead, Nhóm và nhãn trạng thái.

**Cách sửa:** Ẩn các chức năng danh mục nghiệp vụ khỏi menu Admin theo phạm vi mới; dùng bộ danh mục khởi tạo chung cho ba thành phố, sáu văn phòng và bốn nguồn. Nếu cần cho người dùng sửa danh mục thì phải chỉ định vai trò chịu trách nhiệm; chưa tự chuyển quyền cho Trưởng nhóm.

**Nghiệm thu:** Admin không còn chức năng sửa nguồn/trạng thái Lead; màn nghiệp vụ vẫn có đầy đủ dropdown dù không còn màn quản trị danh mục.

**Vùng ảnh hưởng:** Settings.tsx, seed.ts, backend/supabase.

**Cần duyệt:** Q-10.

## 4. Mười quyết định cần duyệt

Các hạng mục hình thức rõ ràng có thể triển khai độc lập sau khi duyệt bản đặc tả; những lựa chọn dưới đây chưa được tự coi là yêu cầu đã chốt.

### Q-01. Khoảng 00:00–08:00 và cách đếm hẹn lại

**Điểm chưa rõ:** Phiếu vào Cần hẹn lại lúc 00:00 nhưng lịch chỉ chốt thất bại 08:00; tài xế có thể được cập nhật thành công trong khoảng này.

**Phương án đề xuất để duyệt:** 00:00 chỉ đánh dấu cần kiểm tra/hẹn lại; 08:00 mới tăng một lần thất bại. Nếu có dữ liệu thành công thì bỏ cờ và không tính thất bại. Cần quyết định có cho tạo lịch mới trước 08:00 hay không.

**Ảnh hưởng:** Nhóm nhiệm vụ, số lần quá hẹn, tự Solved và KPI.

### Q-02. Activated trong kết quả liên hệ có đổi hồ sơ không?

**Điểm chưa rõ:** Telesale trước đây chỉ xem hồ sơ, nay được yêu cầu chọn Activated trong form.

**Phương án đề xuất để duyệt:** Cho chuyên viên ghi nhận kết quả Activated kèm bằng chứng; Tiếp nhận xác minh và đổi trạng thái hồ sơ. Nếu muốn đổi ngay phải duyệt mở rộng quyền và quy tắc mốc đăng ký.

**Ảnh hưởng:** Phân quyền, chốt lịch 08:00, báo cáo chuyển đổi.

### Q-03. Bằng chứng bắt buộc cho trường hợp nào?

**Điểm chưa rõ:** Không nghe máy/sai SĐT có thể không có file ghi âm; ghi chú yêu cầu đính kèm bắt buộc.

**Phương án đề xuất để duyệt:** Bắt buộc ghi âm khi trao đổi điện thoại, ảnh khi chat. Với KNM/sai SĐT cho phép ảnh nhật ký cuộc gọi kèm căn cứ. Không bắt buộc đồng thời cả ghi âm và ảnh. Xác nhận ngoại lệ và PDF có được chấp nhận hay không.

**Ảnh hưởng:** Luồng lưu kết quả và khả năng làm việc thực tế.

### Q-04. Admin mới và core giả lập hiện có

**Điểm chưa rõ:** NOTE SỬA giới hạn Admin vào tài khoản/phân quyền và bỏ Hộp thư; PRODUCT.md hiện giao Admin thao tác giả lập/đối soát.

**Phương án đề xuất để duyệt:** Bản nghiệp vụ ẩn và chặn Admin với Lead/giả lập/đối soát. Giữ công cụ kỹ thuật và dữ liệu để dùng ngoài luồng nghiệp vụ nếu vẫn cần demo. Việc gỡ toàn bộ core giả lập cần quyết định riêng, không suy ra từ câu không muốn dùng API.

**Ảnh hưởng:** Phạm vi sản phẩm, màn hình Admin, nguồn cập nhật kết quả đăng ký.

### Q-05. Kết quả đến muộn, kết quả có sẵn và hết hạn phiếu

**Điểm chưa rõ:** Dữ liệu đến sau 08:00; hồ sơ đã đăng ký trước ngày hẹn; phiếu hết hạn 14 ngày khi lịch đang chờ kết quả.

**Phương án đề xuất để duyệt:** Lưu trạng thái/căn cứ lúc chốt. Dữ liệu muộn có cơ chế rà soát và đính chính có lịch sử; không tự ghi đè lịch Đã hủy. Chỉ tính thành công phù hợp ngày đăng ký thực tế và lịch được đối chiếu. Phiếu hết hạn vẫn cho hệ thống đối soát lịch cũ nhưng chặn tư vấn mới.

**Ảnh hưởng:** Tránh đánh giá sai lịch hẹn hoặc tự mở lại phiếu đã Closed.

### Q-06. Lịch sử cá nhân khi phiếu đã đóng hoặc chuyển người

**Điểm chưa rõ:** Nguồn gốc nói Closed hết quyền quản lý; NOTE SỬA muốn xem lịch sử tất cả phiếu từng tư vấn hồ sơ.

**Phương án đề xuất để duyệt:** Nếu được duyệt: chuyên viên chỉ đọc lịch sử các phiếu của chính mình, không sửa và không xem lịch sử người nhận mới. Quyền đọc dữ liệu hồ sơ hiện tại sau chuyển giao cần chốt riêng; không mở toàn bộ Lead chỉ để xem lịch sử cũ.

**Ảnh hưởng:** Quyền dữ liệu tại máy chủ và quyền tải bằng chứng.

### Q-07. Định nghĩa các KPI dễ nhầm

**Điểm chưa rõ:** Phiếu quá hạn có thể là quá giờ hẹn, sau ngày hẹn hoặc hết hạn 14 ngày; Chờ bàn giao và Cần gọi lại chưa có công thức rõ.

**Phương án đề xuất để duyệt:** Cần gọi lại = hợp của phiếu KNM và Cần hẹn lại còn xử lý, đếm DISTINCT phiếu. Phiếu quá hạn ở dashboard đề xuất dùng phiếu cần hẹn lại sau 00:00, ghi rõ nhãn; phiếu hết hạn 14 ngày là số liệu khác. Chờ bàn giao = Lead Mới đủ điều kiện chưa phân công. Xin duyệt đơn vị đếm ở từng KPI.

**Ảnh hưởng:** Thẻ dashboard và khớp số khi mở danh sách.

### Q-08. Bắt buộc trạng thái và vòng đời cũ

**Điểm chưa rõ:** Chưa rõ chọn trạng thái mỗi lần liên hệ hay chỉ khi xử lý cuối; ngưỡng KNM trong tài liệu gốc vừa <3 vừa >3 bỏ sót đúng lần 3; rà soát có thể kéo Lead thành công về Mới.

**Phương án đề xuất để duyệt:** Chọn trạng thái hợp lệ khi lưu liên hệ, lưu cùng giao dịch; tự Solved ở lần thất bại thứ 3 như code hiện tại là phương án đề xuất để duyệt, không lấy dấu >3 trong nguồn làm cùng nghĩa. Giữ 14 ngày và Closed theo quy trình gốc trừ khi được đổi. Tiếp nhận không được xóa mốc thành công bằng rà soát thông thường.

**Ảnh hưởng:** Chuyển trạng thái, đếm lần, quyền đóng/mở và bàn giao.

### Q-09. Công thức báo cáo, lọc kỳ và quy công chuyển việc

**Điểm chưa rõ:** Công thức nguồn ghi ngược, chưa rõ chọn theo ngày tiếp nhận/ngày giao/ngày chuyển đổi, chưa rõ ai được tính chuyển đổi khi Lead chuyển người.

**Phương án đề xuất để duyệt:** Dùng R-03; phiếu theo ngày tạo phiếu, báo cáo nguồn/Lead theo ngày tiếp nhận, chuyển đổi tính lũy kế đến lúc xem. Quy công chuyển đổi đề xuất cho phiếu phụ trách tại thời điểm đạt mốc; tổng nhóm dùng DISTINCT Lead. Chốt quy tắc SĐT sai và “liên hệ thành công” trước khi viết truy vấn.

**Ảnh hưởng:** Không thể nghiệm thu đúng số liệu nếu chưa chốt.

### Q-10. Các lựa chọn triển khai còn lại

**Điểm chưa rõ:** Chưa chốt quyền chỉnh ma trận từng ô, vai trò viewer cũ, chủ quản danh mục, cách reset mật khẩu, định dạng xuất báo cáo, mã phiếu và phạm vi bỏ cột ở màn nhóm.

**Phương án đề xuất để duyệt:** Bản tối thiểu: quyền chuẩn cố định theo bốn vai trò; không thêm chức năng sửa ma trận tùy ý; danh mục khởi tạo; mã PC-000001; reset qua luồng Auth sẵn có; chưa thêm định dạng xuất mới. Ở lịch nhóm giữ cột chuyên viên. Đầu hồ sơ hiển thị trạng thái thực tế, không cố định Mới. Vai trò viewer giữ ngoài ma trận duyệt đến khi xác nhận bỏ/giữ.

**Ảnh hưởng:** Tránh mở rộng phạm vi hoặc làm sai thông tin.

## 5. Đối chiếu code hiện tại — chỉ đọc

Không chạy kiểm thử runtime trong nhiệm vụ đặc tả. Các kết luận dưới đây dựa trên tệp nguồn được đọc ngày 24/10/2026, không dùng kết quả kiểm thử từ các phiên cũ để chứng minh bản này.

| Vùng | Bằng chứng trong checkout | Hệ quả cần sửa |
| --- | --- | --- |
| Dashboard.tsx | Một dashboard chung; còn Hành trình chuyển đổi, Lead theo nguồn; chưa có bộ lọc kỳ và bảng hoạt động mới | Tách nội dung theo vai trò; bổ sung KPI và biểu đồ theo đặc tả |
| Layout.tsx | Báo cáo hiện cho mọi vai trò; Admin còn Lead, hàng đợi, nhiệm vụ, lịch, giả lập; Intake còn nhiệm vụ/lịch | Sửa menu và route theo ma trận mới, không chỉ đổi nhãn |
| Assignments.tsx | Nhóm Quá hẹn xét lịch scheduled đã qua giờ; bảng ghép Hồ sơ/Phiếu và Trạng thái/Hạn; form chưa có Activated, nơi hẹn nhập tay | Cần thay logic nhóm, tách cột và bổ sung trường/kết quả |
| AssignmentDialog.tsx | Chọn chuyên viên đã lấy từ danh sách thành viên đang hoạt động cùng nhóm; hồ sơ có sẵn vẫn render select bị disabled | Chuyên viên 2 có thể là vấn đề dữ liệu/tài khoản, chưa đủ căn cứ kết luận thiếu option do hardcode; popup chuyển đổi sang hiển thị chỉ đọc |
| Appointments.tsx và types.ts | Bốn trạng thái scheduled/attended/missed/cancelled; người dùng tự chọn Đã đến/Không đến; chưa có trạng thái chờ và tác vụ chốt mới trong model UI | Cần mở rộng vòng đời lịch; thay cả lệnh ghi và kiểu dữ liệu, không chỉ đổi chữ |
| Evidence.tsx / Assignments.tsx | Bằng chứng đính sau khi hoạt động đã lưu, hỗ trợ audio/image/PDF; ActivityCorrection còn được dùng | Thay trình tự lưu để đáp ứng bắt buộc bằng chứng; bỏ/chặn hủy kết quả theo phạm vi duyệt |
| Leads.tsx | Bộ lọc thành phố lấy từ dữ liệu hiện có; form tạo đã có Đà Nẵng; chi tiết có Phiếu/Người phụ trách | Dùng catalog chung và tách nội dung chi tiết theo vai trò |
| domain.ts | Nhãn Solved đã là Đã giải quyết; Admin có quyền Lead/phân công/tư vấn; Telesale đọc dựa vào phiếu mới nhất còn hạn | Một phần nhãn đã đúng; quyền và lịch sử cá nhân cần đổi có chủ đích |
| Operations.tsx | Rà soát có eligible/follow_up/closed; lệnh review lưu kết quả, cần thay thành cập nhật trạng thái đồng bộ theo yêu cầu mới | Thay dropdown và giao dịch nghiệp vụ, kiểm tra hồ sơ thành công |
| Reports.tsx / ReportFilters | Có lọc từ/đến/nguồn/trạng thái/nhân viên; chưa có city trong ReportFilters | Không phải viết lại toàn bộ cơ chế lọc; bổ sung thành phố, ba báo cáo nhóm và hai báo cáo tiếp nhận |
| Settings.tsx / backend.ts | Có tạo người dùng, đổi vai trò/nhóm, khóa; chưa thấy form cập nhật tên/email và Admin reset mật khẩu trong màn được đọc; còn danh mục nghiệp vụ | Hoàn thiện các thao tác tài khoản và thu gọn phạm vi quản trị |
| backend/supabase/schemas/15_lead_sale_schedule.sql | Có đăng ký job lead_run_jobs mỗi phút khi có pg_cron | Có thể mở rộng cơ chế sẵn có; sự tồn tại của SQL không chứng minh lịch 00:00/08:00 mới đã hoạt động |
| PRODUCT.md | Hiện còn giao Admin quản lý giả lập/đối soát, ghi core tích hợp mô phỏng đã có | Ghi nhận xung đột Q-04 trước khi sửa mô hình quyền; chưa thay PRODUCT.md |

Các ảnh nguồn có giao diện mới hơn hoặc khác checkout được đọc. Khối Cuộc gọi Internet/Hộp thư trong ảnh không xuất hiện trong các module chính được đối chiếu ở checkout này; khi bắt đầu code phải xác nhận đúng nhánh/bản web người dùng đang sử dụng trước khi tuyên bố đã gỡ. Không xóa mã không tìm thấy hoặc tự dựng tính năng đó để rồi gỡ.

Backend hoạt động của Lead Sale là **app/backend/supabase/**. Thư mục **app/supabase/** là phần Atomic CRM tham khảo. Mọi sửa cơ sở dữ liệu cần migration mới theo chiều tiến; không ghi đè migration đã áp dụng. Đây là lưu ý cho bước triển khai sau, không có migration nào được tạo/chạy trong bản đặc tả.

Ghi chú công cụ thiết kế: PRODUCT.md hiện có nhưng chưa theo cấu trúc mới của impeccable và chưa có DESIGN.md. Có thể cập nhật bằng `init` ở một nhiệm vụ riêng nếu muốn; không mở rộng phạm vi bản duyệt này.

## 6. Thứ tự triển khai sau duyệt

| Đợt | Phạm vi | Điều kiện hoàn tất |
| --- | --- | --- |
| P0 — Chốt nghiệp vụ | Q-01 đến Q-09, ma trận quyền, vòng đời lịch, bằng chứng, định nghĩa báo cáo | Không còn quy tắc mâu thuẫn làm thay đổi trạng thái/quyền/số liệu |
| P1 — Bố cục và trường | Bảng nhiệm vụ/hồ sơ/điều phối, danh mục, nhãn, bỏ khối/nút không dùng, layout theo vai trò | Đối chiếu lại đủ 33 ảnh NOTE SỬA; trường, thứ tự, ẩn/hiện đúng vai trò |
| P1 — Workflow và quyền | Lưu kèm bằng chứng, lịch 00:00/08:00, Closed, Activated, quyền Admin và lịch sử cá nhân | Kiểm thử máy chủ và demo bằng tài khoản thật từng vai trò |
| P2 — Dashboard và báo cáo | KPI theo vai trò, hoạt động gần đây, ba báo cáo nhóm và hai báo cáo nguồn | Đối chiếu tập dữ liệu mẫu biết trước; tổng và tỷ lệ khớp từng hồ sơ/phiếu |
| P2 — Nghiệm thu toàn luồng | Tạo Lead → phân công → ghi nhận → hẹn → đối soát → đóng → rà soát → phân công lại | Chụp ảnh màn thật sau sửa, so với yêu cầu; phân biệt demo và cloud |

P0/P1/P2 là ưu tiên thực hiện, không phải tuyên bố đã làm xong.

## 7. Bộ tình huống nghiệm thu cần có khi code

1. Telesale 1 không xem hoặc tải bằng chứng Telesale 2; Trưởng nhóm chỉ xem nhóm mình; Admin bị chặn nghiệp vụ.
2. Bảng nhiệm vụ đủ chín cột; mã ngắn vẫn tìm được và mở được liên kết cũ.
3. Tạo/hẹn lại đủ sáu văn phòng; ba thành phố luôn có dù chưa có dữ liệu.
4. Không có tệp hoặc upload lỗi không lưu kết quả hoàn chỉnh; thử lại không sinh trùng.
5. Ghi liên hệ yêu cầu trạng thái; chuyển trạng thái trái quyền hoặc không hợp lệ bị chặn.
6. Hẹn 10:00 ngày D: quá giờ chờ, 00:00 D+1 vào nhóm, 07:59 chưa thất bại, 08:00 chốt theo dữ liệu đã xác nhận.
7. Lịch đã hủy và lịch đã đổi không bị job hồi sinh; hai job chạy lại không tăng hai lần.
8. Kết quả đến muộn và trường hợp Lead đã đăng ký trước lịch được xử lý theo Q-05.
9. Phiếu hết hạn 14 ngày đúng lúc chốt lịch không mở lại quyền tư vấn.
10. Rà soát đủ điều kiện/đóng cập nhật Lead cùng kết quả rà soát; lỗi một bước rollback toàn bộ.
11. Một Lead ba phiếu không thành ba Lead trong báo cáo; chuyển người không tính công hai lần ở tổng nhóm.
12. Khoảng ngày cùng ngày, qua tháng, tháng không có dữ liệu và mẫu số 0; sắp xếp đúng múi giờ.
13. Tài khoản khóa mất quyền thao tác; tạo tài khoản không làm đổi phiên Admin; reset mật khẩu không lộ mật khẩu.
14. Lịch sử cũ, bằng chứng cũ, hoạt động đã hủy và mốc thành công được giữ qua migration.
15. Xem ở desktop và màn nhỏ: bảng cuộn ngang, cột thao tác không biến mất, form có thứ tự hợp lý.

## 8. Chỉ mục ảnh nguồn

TS = Telesale; TL = Trưởng nhóm; IN = Tiếp nhận. Ảnh BASE là nền của bốn tab cũ; bản chụp nguyên văn chứa đủ 41 ảnh. Bản HTML kèm toàn bộ 33 ảnh NOTE SỬA và xem phóng to.


### TS

- [TS-01](../sources/images/2026-10-24/ts-01.png) — TS-01.
- [TS-02](../sources/images/2026-10-24/ts-02.png) — C-02, TS-01.
- [TS-03](../sources/images/2026-10-24/ts-03.png) — TS-02.
- [TS-04](../sources/images/2026-10-24/ts-04.png) — TS-03.
- [TS-05](../sources/images/2026-10-24/ts-05.png) — C-04, TS-04, TS-05.
- [TS-06](../sources/images/2026-10-24/ts-06.png) — C-04, C-06, TS-06.
- [TS-07](../sources/images/2026-10-24/ts-07.png) — C-06, TS-06.
- [TS-08](../sources/images/2026-10-24/ts-08.png) — TS-07, TS-08.
- [TS-09](../sources/images/2026-10-24/ts-09.png) — C-03, TS-09, TS-10.
- [TS-10](../sources/images/2026-10-24/ts-10.png) — TS-11.
- [TS-11](../sources/images/2026-10-24/ts-11.png) — TS-12.
- [TS-12](../sources/images/2026-10-24/ts-12.png) — TS-07, TS-12.
- [TS-13](../sources/images/2026-10-24/ts-13.png) — TS-13, TL-07.
- [TS-14](../sources/images/2026-10-24/ts-14.png) — TS-14, TL-07.
- [TS-15](../sources/images/2026-10-24/ts-15.png) — C-03, TS-15.
- [TS-16](../sources/images/2026-10-24/ts-16.png) — C-06, TS-15.
- [TS-17](../sources/images/2026-10-24/ts-17.png) — TS-16, TL-07.

### TL

- [TL-01](../sources/images/2026-10-24/tl-01.png) — TL-01.
- [TL-02](../sources/images/2026-10-24/tl-02.png) — C-02, TL-01, TL-02.
- [TL-03](../sources/images/2026-10-24/tl-03.png) — TL-03, TL-04.
- [TL-04](../sources/images/2026-10-24/tl-04.png) — TL-04.
- [TL-05](../sources/images/2026-10-24/tl-05.png) — TL-04.
- [TL-06](../sources/images/2026-10-24/tl-06.png) — C-03, TL-05.
- [TL-07](../sources/images/2026-10-24/tl-07.png) — C-02, C-03, TL-03, TL-06.
- [TL-08](../sources/images/2026-10-24/tl-08.png) — C-02, TL-08.

### IN

- [IN-01](../sources/images/2026-10-24/in-01.png) — IN-01.
- [IN-02](../sources/images/2026-10-24/in-02.png) — IN-01.
- [IN-03](../sources/images/2026-10-24/in-03.png) — IN-02.
- [IN-04](../sources/images/2026-10-24/in-04.png) — IN-02.
- [IN-05](../sources/images/2026-10-24/in-05.png) — IN-03, IN-04.
- [IN-06](../sources/images/2026-10-24/in-06.png) — IN-05.
- [IN-07](../sources/images/2026-10-24/in-07.png) — C-06, IN-06.
- [IN-08](../sources/images/2026-10-24/in-08.png) — C-02, IN-07.

