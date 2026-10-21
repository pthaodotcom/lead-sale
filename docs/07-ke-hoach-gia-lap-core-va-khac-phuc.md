# Kế hoạch giả lập hệ thống ngoài và khắc phục Lead Sale

Ngày: **21/10/2026**. Điểm xuất phát: commit `ef6e98e`, frontend cục bộ và Supabase cloud. **Đã triển khai luồng giả lập → HTTP nhận → Supabase và các sửa nghiệp vụ chính sau khi người dùng yêu cầu sửa ngay.** [Kết quả, bằng chứng và giới hạn hiện tại ở tài liệu 08](08-ket-qua-gia-lap-core-va-khac-phuc.md). Phần dưới giữ kế hoạch/phạm vi ban đầu để đối chiếu, không mặc định mọi mục vận hành hoặc ý tưởng trong 41 điểm đều đã hoàn tất.

## 1. Phạm vi người dùng vừa xác nhận

1. Gọi điện/chat được thực hiện bên ngoài; **nhân viên tự cập nhật kết quả tư vấn, lịch hẹn và đính kèm bằng chứng** trên Lead Sale.
2. **Bỏ hướng tích hợp Telegram**, cả bot lẫn tài khoản cá nhân. Việc chưa có Telegram hoặc đồng bộ cuộc gọi/chat không còn là chức năng thiếu trong phạm vi bản này.
3. Xây **hệ thống ngoài giả lập** để lựa chọn tài xế, tạo các tình huống đăng ký/chạy đơn và gửi dữ liệu kết quả về Lead Sale.
4. Lập kế hoạch khắc phục các vấn đề dữ liệu, workflow, quyền, báo cáo và vận hành đã rà soát. Không mặc định mọi ý tưởng trong danh sách 41 điểm đều phải phát triển.

Các xác nhận này bổ sung phạm vi triển khai, không sửa nội dung nguyên văn của Google Doc. Các chính sách ghi là đề xuất bên dưới chưa tự trở thành yêu cầu gốc của người đặt đề tài.

## 2. Kết quả cần đạt

- Chuyên viên tiếp tục dùng các form ghi nhận thủ công hiện có.
- Một thao tác nghiệp vụ ở hệ thống giả lập tạo sự kiện nguồn; Lead Sale nhận, đối chiếu và cập nhật đúng hồ sơ.
- Activated/Onboarded có mã tài xế nguồn, ngày xảy ra thực tế, nguồn xác nhận, ngày nhận và dấu vết xử lý. Dữ liệu phải hiện rõ là **giả lập**, không được mô tả là đã tích hợp app/core thực tế.
- Lệnh gửi lại, dữ liệu đến muộn, sai liên kết hoặc sai thứ tự không làm tăng số liệu trùng hoặc ghi nhầm hồ sơ.
- Các lỗi đã tái hiện được sửa kèm kiểm tra hồi quy; nghiệp vụ sửa sai giữ lịch sử.

Đây là mục tiêu nghiệm thu kỹ thuật/nghiệp vụ; chưa đặt mục tiêu tăng tỷ lệ chuyển đổi kinh doanh hoặc cam kết ngày hoàn tất.

## 3. Hệ thống ngoài giả lập sẽ có gì?

### 3.1. Cách mở và tổ chức màn hình

Đề xuất một trang **Hệ thống tài xế giả lập**, mở riêng từ công cụ dành cho Admin. Có thể dùng chung nền React của repo, nhưng tách module, dữ liệu nguồn và đường nhận sự kiện. Không xây cả ứng dụng giao hàng.

Màn hình gồm:

1. **Danh sách tài xế giả lập:** mã tài xế nguồn, tên, SĐT, tình trạng đăng ký, tình trạng đơn đầu và liên kết Lead được phép thử.
2. **Tạo tình huống:** chọn tài xế, thao tác nghiệp vụ, thời điểm thực tế; nhập mã đơn khi có sự kiện đơn hàng.
3. **Lịch sử gửi kết quả:** tài xế, sự kiện, thời điểm, kết quả nhận bên Lead Sale và thông điệp xử lý.

Nội dung chính dùng ngôn ngữ nghiệp vụ. Payload kỹ thuật và mã lỗi chỉ ở phần chi tiết kiểm thử, không bắt nhân viên nhập JSON.

### 3.2. Các lựa chọn trên giả lập

| Lựa chọn | Ý nghĩa bên giả lập | Tác động dự kiến trên Lead Sale |
| --- | --- | --- |
| Tạo tài khoản / Chờ duyệt đăng ký | Chưa đủ điều kiện hoàn tất đăng ký | Chưa chuyển Activated; có thể ghi nhận tình trạng nguồn |
| Hoàn tất đăng ký | Phía nguồn xác nhận đăng ký đã hoàn tất | Cập nhật Activated nếu đối chiếu hợp lệ |
| Đã nhận đơn / Đơn chưa hoàn thành | Chưa phải đơn hoàn thành đầu tiên | Chưa chuyển Onboarded |
| Hủy đơn | Đơn không hoàn thành | Chưa chuyển Onboarded |
| Hoàn thành đơn đầu tiên | Có mã đơn hoàn thành và thời điểm hợp lệ | Cập nhật Onboarded khi đã có mốc đăng ký hợp lệ |
| Gửi lại kết quả | Phát lại đúng sự kiện trước | Không tạo thêm milestone, không tăng số liệu lặp |
| Gửi lại sự kiện đang lỗi/chờ xử lý | Thử lại sau khi sửa liên kết hoặc đủ dữ liệu | Xử lý có kiểm soát, giữ lịch sử các lần thử |

Trong khu kiểm thử bổ sung có thể tạo tình huống không khớp SĐT, chưa có Lead, sự kiện đến sai thứ tự và dữ liệu gửi muộn. Không bổ sung chức năng gọi/chat vào giả lập.

**Mặc định đề xuất cho mô phỏng:** hoàn tất đăng ký là sự kiện nguồn xác nhận đủ điều kiện hoạt động; đơn đầu là đơn hoàn thành thành công, không tính nhận đơn/hủy đơn/đơn thử. Đây là định nghĩa mô phỏng để làm bài, không tuyên bố là quy tắc chính thức của một nền tảng giao hàng cụ thể.

### 3.3. Luồng dữ liệu

**Thao tác trên giả lập → dữ liệu tài xế/đơn ở nguồn giả lập → sự kiện kết quả → API tiếp nhận Lead Sale → đối chiếu hồ sơ → cập nhật milestone và tác động workflow → dashboard/báo cáo.**

Trang giả lập không gọi trực tiếp lệnh chọn trạng thái Lead để giả vờ có tích hợp. Cần giữ được sự kiện nguồn, kết quả tiếp nhận và lý do xử lý để chứng minh luồng nối dữ liệu.

Không tạo tài khoản đăng nhập Lead Sale cho tài xế. Tài khoản/tài xế mô phỏng thuộc dữ liệu của hệ thống ngoài; người thao tác giả lập là Admin/người kiểm thử.

## 4. Hợp đồng và dữ liệu tối thiểu

### 4.1. Dữ liệu nguồn và liên kết

- **Tài xế giả lập:** `externalDriverId` ổn định, tên, SĐT chuẩn hóa và tình trạng đăng ký.
- **Đơn giả lập:** mã đơn, tài xế nguồn, trạng thái, thời điểm hoàn thành/hủy khi có.
- **Liên kết:** `sourceSystem + externalDriverId → leadId`, trạng thái liên kết và người/thời điểm xác nhận.
- **Sự kiện nguồn:** `eventId`, `eventType`, `externalDriverId`, `occurredAt`, payload nghiệp vụ tối thiểu.
- **Tiếp nhận:** `receivedAt`, trạng thái xử lý, Lead đích khi đã khớp, lỗi/xung đột, các lần thử lại.
- **Milestone:** đăng ký/đơn đầu, ngày sự kiện, nguồn giả lập/thủ công, tham chiếu sự kiện, ngày ghi nhận và lịch sử đính chính.

Các trường là thiết kế đề xuất; tên bảng/cột chính thức được chốt cùng migration. Không thêm cơ chế provider tổng quát hoặc nhiều nhà cung cấp khi bản này chỉ cần một nguồn mô phỏng.

### 4.2. Quy tắc đối chiếu và xử lý

1. Ưu tiên liên kết theo mã tài xế nguồn đã xác nhận. SĐT chuẩn hóa hỗ trợ tìm hồ sơ; lần liên kết đầu cần xác nhận rõ, không tự ghi đè vì trùng tên.
2. Chưa tìm thấy Lead hoặc có xung đột danh tính: lưu sự kiện vào danh sách chờ đối chiếu, không tự tạo tài khoản/khách hàng ngoài phạm vi tiếp nhận hiện có.
3. Gửi lại cùng `eventId` và nội dung không tạo tác động lặp. Cùng ID nhưng khác nội dung bị từ chối và có dấu vết.
4. Giữ riêng thời điểm sự kiện và thời điểm nhận; không dùng giờ nhận thay ngày đăng ký/đơn đầu. Với sự kiện trước ngày tiếp nhận Lead, phải thể hiện đó là thông tin lịch sử thay vì tự sửa ngày tiếp nhận.
5. Đơn đầu đến trước sự kiện đăng ký: lưu chờ tiền đề; khi nhận được đăng ký đúng thứ tự thời gian thì xử lý tiếp. Nếu thời điểm đơn thực sự trước đăng ký, đánh dấu xung đột để đối soát.
6. Sự kiện cũ không tự lùi trạng thái mới. Lead Closed/lưu trữ hoặc xung đột với lần đính chính: giữ bản tin và yêu cầu xử lý rõ ràng; không tự mở lại hồ sơ.
7. Cập nhật đăng ký phải dùng chung quy tắc nghiệp vụ hiện có: xử lý phiếu/lịch liên quan nhất quán, không chỉ đổi nhãn trạng thái. Cập nhật và audit/mốc kết quả phải nguyên tử.
8. API nhận sự kiện có xác thực phía máy chủ; không cho Telesale/viewer giả danh nguồn gửi. Khóa tin cậy không nằm trong `VITE_*` hoặc payload người dùng được tự sửa.
9. Chỉ thử trên hồ sơ được đánh dấu/cho phép dùng giả lập. Mỗi kết quả có nhãn nguồn mô phỏng; không reset database hoặc dùng mã sự kiện chung cho mọi lần thử.

### 4.3. Chính sách cập nhật thủ công đề xuất

- Tư vấn, lịch hẹn, KNM/quá hẹn, ghi chú và tệp bằng chứng vẫn do nhân viên ghi nhận.
- Đăng ký/đơn đầu trong kịch bản demo lấy từ giả lập. UI Lead cho xem nguồn và ngày sự kiện.
- Nếu vẫn cần ghi nhận kết quả ngoài nguồn giả lập, lưu rõ là **xác nhận thủ công**, có người/ngày/căn cứ. Không hiển thị thành đã được core xác minh.
- Chỉ Admin/Tiếp nhận được đính chính kết quả theo quyền đã xác định; đính chính tạo lịch sử và xử lý tác động báo cáo, không xóa sự kiện gốc hoặc silently mở lại phiếu đã đóng.

## 5. Kế hoạch triển khai theo đợt

### Đợt 0 — Cập nhật phạm vi và tài liệu

**Trạng thái:** đã ghi nhận trong kế hoạch này.

- Ghi xác nhận gọi/chat thủ công và bỏ Telegram vào quyết định phạm vi.
- Thêm nguồn ngoài giả lập vào backlog; đánh dấu các điểm rà soát được thay thế bởi phạm vi mới.
- Giữ nguyên Google Doc nguồn, ghi rõ các quyết định bổ sung của người dùng.

**Đầu ra:** bản kế hoạch hiện tại và liên kết từ README/kế hoạch cũ. Không tick hoàn thành giả lập hay sửa lỗi khi mới có tài liệu.

### Đợt 1 — Một luồng giả lập → Lead Sale chạy xuyên suốt

**Ưu tiên:** cao nhất. **Phụ thuộc:** quyết định cấu trúc dữ liệu và khả năng áp dụng migration/deploy backend trên project đích.

1. Thêm migration tiến lên cho liên kết tài xế, sự kiện tiếp nhận, nguồn/ngày milestone và lịch sử xử lý. Giữ nguyên Lead/phiếu/hoạt động hiện có.
2. Xây API nhận sự kiện và bộ xử lý dùng chung bất biến trạng thái; kiểm tra nguồn, event ID, liên kết, thứ tự, ngày thực tế và tác động phiếu/lịch.
3. Làm trang giả lập với các lựa chọn tại mục 3; dữ liệu nguồn tách khỏi dữ liệu Lead.
4. Hiện lịch sử tiếp nhận/đối soát trong Lead Sale: đã nhận, chờ liên kết, chờ tiền đề, đã cập nhật, xung đột/lỗi; hiển thị người có quyền xử lý.
5. Hiện nguồn mô phỏng, mã tài xế và các mốc thực tế trên hồ sơ, bảo đảm báo cáo cập nhật từ DB.

**Hoàn thành khi:** chọn tài xế ở giả lập, hoàn tất đăng ký rồi hoàn thành đơn đầu; đúng Lead lần lượt thành Activated/Onboarded; nhận lại cùng sự kiện không tăng số liệu; reload vẫn giữ sự kiện và kết quả. Không cần thao tác chọn lại trạng thái trên hồ sơ Lead.

### Đợt 2 — Sửa sai nghiệp vụ và bàn giao

**Phụ thuộc:** nền milestone/đính chính ở đợt 1; các sửa lỗi độc lập có thể làm sớm hơn khi không xung đột schema.

- Tách **chỉnh sửa hồ sơ** khỏi **tái tiếp nhận**; chỉ sự kiện tiếp nhận thật mới thay ngày nhận gần nhất.
- Thêm đính chính trạng thái/milestone và hoạt động/lịch hẹn nhập nhầm, giữ lý do/lịch sử; tính lại bộ đếm trong đúng đợt.
- Tách kết quả gọi không bắt máy và chat chưa phản hồi. Mặc định đề xuất: chỉ cuộc gọi không bắt máy tăng KNM; không tự gộp tin không phản hồi vào ngưỡng 3.
- Review bàn giao có kết quả có cấu trúc, tham chiếu căn cứ và kiểm tra phiên bản; không cho lệnh cũ ghi đè kết quả đã hoàn tất.
- Thống nhất điều kiện tái giao khi còn bàn giao chờ. Đề xuất: chuyển người chủ động theo luồng transfer vẫn thực hiện được; Lead New quay lại sau đóng thông thường chỉ tái giao sau khi Tiếp nhận xác nhận đủ điều kiện.
- Đồng nhất kiểm tra hết hạn theo giờ máy chủ trên nhóm nhiệm vụ, bộ đếm, lịch hẹn và nút thao tác.

**Hoàn thành khi:** năm hành vi trong kiểm tra bổ sung được xử lý đúng lựa chọn đã chốt; người dùng sửa nhầm có thể phục hồi đúng kết quả mà vẫn truy vết được, không tự mở lại phiếu đã hết hạn.

### Đợt 3 — Dữ liệu nhập và báo cáo

- Hỗ trợ ngày tiếp nhận lịch sử và kiểm tra ngày sự kiện; kết quả đăng ký/đơn đầu nhập từ file nếu cần phải đi qua cùng kiểm tra milestone, không ghi tắt vào nhãn trạng thái.
- Lưu lô nhập/kết quả từng dòng, phát hiện trùng trong file, có retry có kiểm soát; giữ bộ cột mẫu rõ ràng trước khi làm bộ ánh xạ mọi định dạng.
- Hiện nguồn kết quả giả lập/thủ công và tình trạng đối soát trên báo cáo/chi tiết.
- Giữ nhãn báo cáo rõ: ngày tiếp nhận đầu, kết quả đến hiện tại, phụ trách gần nhất; thống nhất ảnh hưởng lưu trữ/tái phân công. Không gọi đó là báo cáo chốt kỳ hoặc quy công người tạo chuyển đổi nếu chưa có quy tắc tương ứng.
- Chuẩn hóa các danh mục cần thiết cho dữ liệu mẫu và vận hành hiện tại.
- CSV giữ nguyên; XLSX, báo cáo thời điểm quá khứ, phân bổ công đa nhân viên và chốt kỳ nằm ngoài bản tối thiểu nếu chưa có yêu cầu thêm.

**Hoàn thành khi:** dữ liệu mẫu có bảng kết quả dự kiến; ngày sự kiện đến muộn không bị đổi thành ngày nhận; tổng hợp khớp chi tiết và không đếm sự kiện gửi lại thành tài xế mới.

### Đợt 4 — Quyền, trải nghiệm vận hành và phục hồi lỗi

- Chốt lịch sử được bàn giao cho Telesale mới; giới hạn đúng Lead/phiếu và dữ liệu cần chăm sóc, không mở toàn bộ kho hồ sơ.
- Sửa điều kiện hiện upload của trưởng nhóm để khớp quyền backend.
- Khi ghi thành công nhưng tải lại lỗi, UI báo rõ đã lưu/chưa làm mới; retry dùng lại ID yêu cầu khi phù hợp.
- Nhắc trong ứng dụng có tài xế/lịch và link xử lý, danh sách thông báo phù hợp; không thêm Telegram/SMS/email.
- Kiểm tra tài khoản/khôi phục mật khẩu, SMTP khi dùng xác nhận email; kiểm tra tệp upload lỗi và cách dọn tệp mồ côi.
- Giảm tải lại toàn workspace khi nhập nhiều dòng; phân trang server/thu hẹp khóa ghi được thực hiện theo kết quả đo, không viết lại kiến trúc trước khi có căn cứ.

**Hoàn thành khi:** các vai trò thao tác đúng quyền; lỗi mạng không dẫn đến ghi lặp hoạt động; thông báo dẫn được tới công việc; tải/lưu không gây hiểu nhầm trạng thái xử lý.

### Đợt 5 — Nghiệm thu, vận hành và tài liệu cuối

- Chạy kiểm tra SQL/workflow và trình duyệt cho luồng nhân viên thủ công cùng luồng dữ liệu từ giả lập.
- Đối chiếu scheduler trên đúng project; kiểm tra nhắc, đóng phiếu, bàn giao và chống trùng khi chạy lại. Quyền ứng dụng hiện có chưa đủ để xác nhận log quản trị DB.
- Kiểm tra lỗi phiên, mất mạng, gửi lặp/sai thứ tự/sai liên kết, rollback và ngày giờ.
- Cập nhật README, đặc tả, ma trận quyền, cách tính KPI, API thực sự đã cung cấp và hướng dẫn mở giả lập; loại trạng thái khảo sát cũ gây hiểu nhầm khỏi phần mô tả hiện trạng.
- Frontend public hosting, thử restore và quy mô lớn là mốc vận hành tiếp theo theo môi trường người dùng chọn; không tự phát hành hoặc mua dịch vụ trong đợt lập kế hoạch.

**Hoàn thành khi:** có kịch bản demo lặp lại được, bằng chứng từng tiêu chí và danh sách hạn chế còn lại. Kết nối giả lập không được báo thành kết nối app giao hàng thật.

## 6. Tiêu chí nghiệm thu riêng cho nguồn giả lập

| Mã | Tình huống | Kết quả phải thấy |
| --- | --- | --- |
| SIM-01 | Tạo tài khoản/chờ duyệt | Lead chưa tự Activated |
| SIM-02 | Hoàn tất đăng ký hợp lệ | Một milestone đăng ký; Lead Activated; nguồn/ngày/mã tài xế thể hiện đúng |
| SIM-03 | Nhận đơn nhưng chưa hoàn thành/hủy | Chưa Onboarded |
| SIM-04 | Hoàn thành đơn đầu sau đăng ký | Lead Onboarded; chỉ một milestone đơn đầu |
| SIM-05 | Gửi lại cùng ID và nội dung | Không lặp kết quả, không tăng báo cáo/đợt chăm sóc |
| SIM-06 | Cùng ID, nội dung khác | Từ chối và ghi lý do |
| SIM-07 | Không có liên kết hoặc số xung đột | Chờ đối soát; không ghi nhầm Lead |
| SIM-08 | Đơn đầu được chuyển đến trước sự kiện đăng ký | Chờ tiền đề; xử lý sau khi có đăng ký hợp lệ, không giả tạo ngày đăng ký |
| SIM-09 | Sự kiện đến muộn | Giữ thời điểm thực tế, phân biệt giờ nhận/giờ xử lý |
| SIM-10 | Lead Closed/lưu trữ hoặc có kết quả đính chính xung đột | Không tự mở lại/ghi đè; có trạng thái chờ xử lý rõ |
| SIM-11 | Telesale/viewer giả danh nguồn hoặc sửa liên kết | Bị chặn phía API/DB |
| SIM-12 | Cập nhật đăng ký khi có phiếu/lịch còn hiệu lực | Phiếu/lịch và báo cáo nhất quán với workflow hiện có |
| SIM-13 | Tải lại web/giả lập | Nguồn, sự kiện, kết quả và lỗi còn tra được |
| SIM-14 | Tư vấn thủ công trước/sau sự kiện nguồn | Không mất hoạt động; quyền và trạng thái xử lý đúng; không yêu cầu Telegram |

## 7. Xử lý toàn bộ 41 điểm rà soát trước

ID đối chiếu theo bản rà soát trong cuộc trò chuyện, giữ mã để theo dõi. Mỗi điểm có quyết định xử lý thay vì mặc định đưa cả 41 vào một đợt lập trình.

| ID | Quyết định sau cập nhật phạm vi | Đợt |
| --- | --- | --- |
| 01 | Dùng nguồn giả lập có dấu vết; kết nối core thật để sau khi có quyền/dữ liệu | 1 |
| 02 | Thêm mã tài xế và liên kết hồ sơ, xử lý không khớp | 1 |
| 03 | Định nghĩa trạng thái/sự kiện mô phỏng; ghi rõ chưa phải quy tắc của đối tác thật | 1 |
| 04 | Thêm nguồn xác nhận và tham chiếu sự kiện; phân biệt thủ công/giả lập | 1, 3 |
| 05 | Giữ ngày sự kiện/nhận/ghi nhận riêng; hỗ trợ dữ liệu đến muộn | 1, 3 |
| 06 | Bổ sung đính chính kết quả, lịch sử và tác động liên quan | 2 |
| 07 | Giả lập phát đơn đầu, Lead nhận kết quả; không tự mở thêm luồng chăm sóc sau Activated | 1; mở rộng sau nếu cần |
| 08 | Giữ nhập tay/CSV/XLSX; connector Facebook/form/hotline/app thật hoãn | Ngoài bản tối thiểu |
| 09 | Tách sửa hồ sơ và tái tiếp nhận | 2 |
| 10 | Quy định hồ sơ nhận lại theo trạng thái và kết quả rà soát | 2 |
| 11 | Bổ sung ngày lịch sử; kết quả chuyển đổi vẫn kiểm tra theo milestone | 3 |
| 12 | Lô nhập, kết quả từng dòng, retry | 3 |
| 13 | Phát hiện trùng trong file và hướng dẫn cột mẫu; mapper mọi định dạng hoãn | 3 |
| 14 | Chặn/xếp hàng xung đột danh tính; gộp/tách phức tạp chưa làm tự động | 1, 3; mở rộng sau |
| 15 | Chuẩn hóa danh mục cần thiết; không xây phân hệ duyệt hồ sơ tài xế | 3 |
| 16 | **Đóng khoảng thiếu tích hợp: gọi/chat thủ công đã được chọn. Bỏ Telegram.** | Chốt phạm vi |
| 17 | Giữ dữ liệu liên lạc là nhân viên ghi nhận; không yêu cầu mã nhà cung cấp/tự đồng bộ | Chốt phạm vi; bằng chứng hiện có |
| 18 | Đính chính Activity/lịch, tính lại bộ đếm | 2 |
| 19 | Tách không bắt máy và chat chưa phản hồi | 2 |
| 20 | Chốt và hiện thông tin bàn giao lịch sử đúng quyền | 4 |
| 21 | Ghi chú riêng/Reason_disconnect/decision_time riêng chưa đưa vào bản tối thiểu | Hoãn, chờ yêu cầu cụ thể |
| 22 | Review có kết quả rõ và tham chiếu căn cứ/milestone | 2 |
| 23 | Chặn ghi đè review do phiên bản cũ; có luồng đính chính riêng | 2 |
| 24 | Thống nhất điều kiện tái giao khi bàn giao còn chờ | 2 |
| 25 | Dùng đồng hồ server và điều kiện hết hạn thống nhất | 2 |
| 26 | Giữ ngưỡng 3 đã xác nhận; ghi rõ các mặc định 14 ngày/round/chuyển phiếu để nghiệm thu | 0, 2 |
| 27 | Hoàn thiện nhắc trong app và link xử lý; không thêm kênh gửi ngoài | 4 |
| 28 | Đối chứng cron/job ở project đích | 5 |
| 29 | Ghi rõ loại báo cáo hiện tại; loại theo ngày chuyển đổi chỉ thêm khi được chọn | 3 |
| 30 | Hiện rõ phụ trách gần nhất/nguồn đầu; quy công đa người chưa triển khai | 3 |
| 31 | Ghi rõ ảnh hưởng lưu trữ và báo cáo động; chốt kỳ/as-of hoãn | 3 |
| 32 | CSV giữ nguyên; XLSX hoãn | Ngoài bản tối thiểu |
| 33 | Giảm tải import/refresh, đo quy mô rồi quyết định phân trang/khóa | 4, 5 |
| 34 | Kiểm tra phục hồi tài khoản và cấu hình email, bổ sung recovery phù hợp | 4, 5 |
| 35 | Kiểm soát finalize/retry tệp và dọn mồ côi theo quy mô | 4 |
| 36 | Tách ghi thành công khỏi lỗi refresh; giữ ID retry | 4 |
| 37 | Đồng bộ điều kiện upload UI/backend | 4 |
| 38 | Giữ local để demo; hosting dùng chung là mốc riêng khi có đích triển khai | Sau nghiệm thu local |
| 39 | Runbook, kiểm tra backup/restore theo môi trường; không giả định đã có bằng chứng | 5 / mốc vận hành |
| 40 | Bổ sung ma trận nghiệm thu cả nguồn giả lập và nhân viên thủ công | 5 |
| 41 | Đồng bộ hiện trạng/phạm vi/quyết định trên các tài liệu | 0, 5 |

## 8. Khu vực mã dự kiến và kiểm soát thay đổi

| Phần | Vùng dự kiến chịu trách nhiệm |
| --- | --- |
| UI giả lập và trạng thái nhận nguồn | Module mới tách riêng; tái sử dụng nền UI/router phù hợp, không nhét vào Activity thủ công |
| Dữ liệu nguồn/tiếp nhận/milestone/liên kết | Backend đang dùng tại `app/backend/supabase/` |
| API nhận sự kiện | Lớp máy chủ xác thực nguồn và gọi processor; hình thức triển khai cụ thể được chốt trước khi viết endpoint |
| Workflow, đính chính, bàn giao | `domain.ts`, các command SQL và UI Lead/Assignment/Operations |
| Import/report/quyền | Các module đang có và RPC tương ứng, giữ hợp đồng hiện tại nếu không cần đổi |
| Kiểm tra | SQL/RLS + fixture + E2E; phân biệt test cô lập, demo, cloud và giả lập nguồn |

Mọi thay đổi schema ở DB đang dùng đi qua **migration tiến lên**, có phương án bảo toàn dữ liệu. Không replay bootstrap, không áp dụng migration Atomic CRM gốc, không reset project. Người dùng đã cung cấp cấu hình DB riêng; migration 20261021010000 và 20261021020000 đã áp dụng với kiểm tra bảo toàn resource. DSN chỉ ở máy chủ/file local bị Git bỏ qua, không nhúng vào frontend.

## 9. Giới hạn và điểm dừng

- Không làm tích hợp Telegram, tổng đài, Zalo/Facebook thật hoặc tài khoản Lead Sale cho tài xế.
- Không xây thanh toán, điều phối giao hàng hay mô phỏng toàn bộ core vận tải.
- Không coi dữ liệu mô phỏng là dữ liệu đã đối soát với một app thực tế.
- Không gộp toàn bộ 41 điểm thành yêu cầu bắt buộc hoặc tự đặt deadline khi chưa có thông tin thời hạn/công suất.
- Kết thúc đợt 1 khi SIM-01…14 trong phạm vi đã chọn có bằng chứng tương ứng và dữ liệu về Lead đúng; các đợt sửa lỗi có tiêu chí riêng rồi dừng, tránh mở rộng tiếp khi không có yêu cầu.
