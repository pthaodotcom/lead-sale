# Đặc tả nghiệp vụ (BA) — Hệ thống quản lý Lead tài xế

Phiên bản **2.0 — 22/10/2026**. Tài liệu này định nghĩa lại toàn bộ yêu cầu theo chuẩn phân tích nghiệp vụ (BA) và là **căn cứ duy nhất** cho bản giao diện mới. Nó thay thế phần yêu cầu/phạm vi trong các tài liệu 01, 05, 07, 08; các tài liệu đó giữ lại làm lịch sử khảo sát.

Nguồn gốc: Google Doc “Trang gửi Thảo nhen” (4 tab, 8 ảnh — [bản chụp](sources/google-doc-2026-10-21.md)); các quyết định D-01…D-13 trong [đặc tả bước 1](05-dac-ta-buoc-1.md); quyết định ngày 22/10/2026 của người dùng: **bỏ hệ thống tài xế giả lập**, làm lại toàn bộ UI/UX theo ảnh tham khảo “Workspace — Nhiệm vụ”, màn phiếu tư vấn bố trí 3 cột như ảnh “phiếu ghi”.

Quy ước mã: **BP** quy trình nghiệp vụ · **UC** use case · **FR** yêu cầu chức năng (FR-01…06 giữ mã của thầy) · **BR** quy tắc nghiệp vụ · **NFR** phi chức năng · **SCR** màn hình. Mức ưu tiên theo MoSCoW: **M** bắt buộc, **S** nên có, **C** có thể.

---

## 1. Bối cảnh và mục tiêu

**Vấn đề.** Tài xế tiềm năng để lại thông tin qua nhiều kênh (hotline, chat mạng xã hội, form website, tài xế cũ giới thiệu). Hiện thông tin rời rạc, dễ trùng số, không biết ai đang chăm sóc ai, phiếu bị bỏ quên và không đo được tỷ lệ đăng ký theo nguồn/nhân viên.

**Mục tiêu nghiệp vụ.**

| Mã | Mục tiêu | Đo bằng |
|---|---|---|
| G1 | Mỗi tài xế chỉ có **một hồ sơ** (theo SĐT), không mất thông tin khi tiếp nhận lại | 0 hồ sơ trùng SĐT chuẩn hóa |
| G2 | Mọi Lead mới đều được **giao người tư vấn**, không Lead nào bị bỏ quên | Số Lead “chờ phân công” và phiếu quá hạn hiển thị cho trưởng nhóm |
| G3 | Telesale biết **hôm nay phải gọi ai** và ghi lại đầy đủ từng lần liên hệ | Danh sách nhiệm vụ theo nhóm kết quả; mỗi lần gọi có người/giờ/kết quả |
| G4 | Ban quản lý thấy **phễu chuyển đổi** Tiếp nhận → Đăng ký → Chạy đơn đầu theo nguồn/nhân viên | Dashboard + báo cáo khớp dữ liệu chi tiết |

**Phạm vi trong.** 5 phân hệ theo BFD: (1) Quản lý hồ sơ Lead, (2) Phân công tư vấn, (3) Chăm sóc và chuyển đổi, (4) Báo cáo – thống kê, (5) Quản trị hệ thống.

**Phạm vi ngoài.** Hệ thống tài xế giả lập/đối soát nguồn (đã bỏ 22/10/2026); tổng đài/Zalo/Facebook API thật; gửi SMS/email/Zalo; vận hành chuyến, đơn hàng, tính cước; Kanban dự án, chat nội bộ, “nâng cấp gói” trong ảnh minh họa; xuất XLSX (chỉ CSV).

---

## 2. Tác nhân (Actor)

| Tác nhân | Mô tả | Mục tiêu chính |
|---|---|---|
| **Tiếp nhận hồ sơ** (Intake) | Nhận thông tin tài xế từ các kênh | Tạo/bổ sung hồ sơ đúng, không trùng; xác nhận kết quả đăng ký/chạy đơn |
| **Trưởng nhóm Telesale** (Leader) | Điều phối một nhóm Telesale | Giao hết Lead mới, cân tải nhóm, xử lý phiếu tắc |
| **Chuyên viên Telesale** | Gọi điện/nhắn Zalo tư vấn | Xử lý phiếu được giao, đặt lịch hẹn đăng ký |
| **Quản trị viên** (Admin) | Quản lý hệ thống | Tài khoản, vai trò, nhóm, danh mục, nhật ký |
| **Người xem báo cáo** (Viewer) | Quản lý cấp trên | Xem số liệu tổng hợp, không xem SĐT |
| Hệ thống (Job) | Tác vụ tự động mỗi phút | Tự đóng phiếu quá 14 ngày, nhắc lịch hẹn, tạo bàn giao |

Tài xế **không** đăng nhập hệ thống. Mỗi tài khoản có **một** vai trò; Trưởng nhóm và Telesale thuộc **một** nhóm.

---

## 3. Quy trình nghiệp vụ (TO-BE)

### BP-1 Tiếp nhận hồ sơ

| # | Tác nhân | Bước | Kết quả |
|---|---|---|---|
| 1 | Tiếp nhận | Nhận thông tin qua kênh (hotline/MXH/web/giới thiệu) hoặc file CSV/XLSX | — |
| 2 | Tiếp nhận | Nhập SĐT → hệ thống **kiểm tra trùng ngay khi gõ** | Báo “đã có hồ sơ X” hoặc “số mới” |
| 3a | Tiếp nhận | *Trùng:* mở hồ sơ cũ, bổ sung trường còn thiếu, ghi “lần tiếp nhận mới” (nguồn lần này) | Giữ ngày/nguồn tiếp nhận đầu (BR-03) |
| 3b | Tiếp nhận | *Không trùng:* tạo hồ sơ mới (BR-01, BR-02) | Lead trạng thái **New** |
| 4 | Hệ thống | Đưa Lead New chưa có phiếu hiệu lực vào **hàng chờ phân công** | Trưởng nhóm thấy ngay |

### BP-2 Phân công tư vấn

| # | Tác nhân | Bước | Kết quả |
|---|---|---|---|
| 1 | Trưởng nhóm | Mở **Điều phối** → danh sách Lead chờ phân công + tải hiện tại của từng thành viên | — |
| 2 | Trưởng nhóm | Chọn một hoặc nhiều Lead → chọn Telesale → **Tạo phiếu** | Phiếu **New**, hạn = tạo + 14×24h (BR-10) |
| 3 | Telesale | Thấy phiếu trong “Chưa nhận”, bấm **Nhận việc** | Ghi thời điểm nhận |
| 4 | Trưởng nhóm | Khi cần: **Chuyển người** (đóng phiếu cũ, tạo phiếu mới) hoặc **Đóng sớm** | Lịch sử giữ nguyên (BR-12) |

### BP-3 Tư vấn và theo dõi

| # | Tác nhân | Bước | Kết quả |
|---|---|---|---|
| 1 | Telesale | Mở **Nhiệm vụ** → chọn nhóm (Chưa liên hệ, Đồng ý, Không nghe 1/2, Quá hẹn 1/2, …) | Danh sách phiếu của nhóm |
| 2 | Telesale | Mở phiếu → gọi điện/nhắn Zalo **ngoài hệ thống** | — |
| 3 | Telesale | Điền panel trái của phiếu: ngày gọi, kết quả liên hệ, quyết định, lý do, ngày/nơi hẹn, ghi chú; đính kèm ghi âm/ảnh chat | Một **hoạt động** mới trên dòng thời gian |
| 4 | Hệ thống | Tính lại trạng thái phiếu theo BR-20…BR-24 | New→Open / Solved |
| 5 | Telesale | Khi tài xế đến hẹn: xác nhận **Đã đến / Không đến / Hẹn lại / Hủy** | Không đến tăng đếm quá hẹn (BR-31) |
| 6 | Hệ thống | Nhắc lịch trước 1 giờ và đúng giờ | Thông báo trong app |

### BP-4 Đóng phiếu và bàn giao

| # | Tác nhân | Bước | Kết quả |
|---|---|---|---|
| 1 | Hệ thống / Trưởng nhóm | Phiếu tự **Closed** khi hết 14 ngày, hoặc trưởng nhóm đóng sớm/chuyển người | Telesale cũ mất quyền xem |
| 2 | Hệ thống | Tạo một bản **bàn giao Closed**; 08:00 hằng ngày gửi tóm tắt cho Tiếp nhận | — |
| 3 | Tiếp nhận | Mở **Bàn giao** → xem kết quả tư vấn → cập nhật trạng thái hồ sơ nếu có căn cứ (Activated/Onboarded/Closed) hoặc đánh dấu “đủ điều kiện giao lại” | Lead quay lại hàng chờ nếu còn New |

---

## 4. Use case theo vai trò

| Mã | Use case | Tiếp nhận | Trưởng nhóm | Telesale | Admin | Viewer |
|---|---|:-:|:-:|:-:|:-:|:-:|
| UC-01 | Đăng nhập, đăng xuất, quên/đổi mật khẩu | ✓ | ✓ | ✓ | ✓ | ✓ |
| UC-02 | Tạo hồ sơ Lead (kiểm tra trùng) | ✓ | | | ✓ | |
| UC-03 | Nhập danh sách CSV/XLSX | ✓ | | | ✓ | |
| UC-04 | Tra cứu, lọc, xuất danh sách Lead | ✓ | nhóm | được giao | ✓ | |
| UC-05 | Sửa, gắn nhãn, ghi lần tiếp nhận lại, lưu trữ/khôi phục hồ sơ | ✓ | | | ✓ | |
| UC-06 | Xác nhận trạng thái hồ sơ (Activated/Onboarded/Closed/mở lại) | ✓ | | | ✓ | |
| UC-07 | Phân công Lead (đơn lẻ/hàng loạt) | | ✓ | | ✓ | |
| UC-08 | Chuyển người phụ trách, đóng phiếu sớm | | ✓ | | ✓ | |
| UC-09 | Nhận việc | | | ✓ | | |
| UC-10 | Ghi nhận hoạt động tư vấn + bằng chứng | | | ✓ | ✓* | |
| UC-11 | Quản lý lịch hẹn (đặt, hẹn lại, đến/không đến, hủy) | | | ✓ | ✓* | |
| UC-12 | Giải quyết / mở lại phiếu | | ✓ | ✓ | ✓ | |
| UC-13 | Rà soát bàn giao phiếu Closed | ✓ | xem | | ✓ | |
| UC-14 | Xem dashboard theo vai trò | ✓ | ✓ | ✓ | ✓ | ✓ |
| UC-15 | Xem/xuất báo cáo | ✓ | nhóm | cá nhân | ✓ | tổng hợp |
| UC-16 | Quản lý tài khoản, vai trò, nhóm | | | | ✓ | |
| UC-17 | Quản lý danh mục nguồn, nhãn trạng thái | | | | ✓ | |
| UC-18 | Xem nhật ký thao tác | | | | ✓ | |
| UC-19 | Nhận và đọc thông báo | ✓ | ✓ | ✓ | ✓ | |

\* Admin can thiệp phải ghi đúng người thao tác là Admin.

---

## 5. Yêu cầu chức năng

### 5.1 Quản lý hồ sơ Lead

| Mã | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|:-:|---|
| **FR-01** | Tạo hồ sơ Lead thủ công | M | Lưu được hồ sơ khi đủ trường bắt buộc (BR-01); nhập SĐT đã có → cảnh báo ngay và có nút mở hồ sơ cũ; không thể lưu trùng |
| **FR-02** | Tiếp nhận Lead từ nguồn nhập liệu | M | Hồ sơ có nguồn, thời điểm tiếp nhận và trạng thái ban đầu New; nhập CSV/XLSX ≤500 dòng/5 MB có xem trước, kết quả từng dòng, dòng trùng không bị ghi đè |
| FR-07 | Tra cứu và lọc | M | Tìm theo tên/SĐT/mã (không dấu); lọc trạng thái, nguồn, thành phố, phương tiện, nhãn; đếm theo tab trạng thái |
| FR-08 | Xem hồ sơ 360° | M | Một trang có: thông tin tài xế, mốc đăng ký/chạy đơn, người phụ trách hiện tại, lịch sử phiếu, dòng thời gian tư vấn, lịch sử tiếp nhận |
| FR-09 | Ghi lần tiếp nhận lại | M | Thêm sự kiện tiếp nhận với nguồn lần này; ngày/nguồn đầu không đổi |
| FR-10 | Lưu trữ/khôi phục thay vì xóa | M | Chỉ lưu trữ khi không còn phiếu chưa Closed; không có xóa cứng |
| FR-11 | Xuất danh sách đang lọc ra CSV | S | File UTF-8 mở được bằng Excel, chống công thức độc |

### 5.2 Phân công tư vấn

| Mã | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|:-:|---|
| **FR-03** | Gán Lead cho nhân viên | M | Chỉ Trưởng nhóm (trong nhóm)/Admin thực hiện được; có lịch sử người giao, thời điểm |
| FR-12 | Hàng chờ phân công + phân công hàng loạt | M | Màn Điều phối liệt kê Lead chờ, cho chọn nhiều và giao một lần; hiển thị số phiếu đang mở của từng Telesale |
| FR-13 | Nhận việc | M | Telesale bấm Nhận việc; phiếu chưa nhận nằm ở nhóm “Chưa nhận” |
| FR-14 | Chuyển người / đóng sớm | M | Phiếu cũ Closed (lý do chuyển), phiếu mới hạn 14 ngày mới; lịch sử giữ nguyên |
| FR-15 | Theo dõi phiếu của nhóm | M | Trưởng nhóm lọc theo nhân viên, hạn xử lý; thấy phiếu sắp hết hạn/quá hẹn |

### 5.3 Chăm sóc và chuyển đổi

| Mã | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|:-:|---|
| **FR-04** | Cập nhật trạng thái theo workflow | M | Chỉ cho chuyển theo BR-20…BR-26 và BR-40…BR-43; lựa chọn không hợp lệ không hiện trên UI và bị server từ chối |
| **FR-05** | Ghi nhận hoạt động tư vấn | M | Mỗi lần có kênh (gọi/Zalo), thời điểm, kết quả, quyết định, lý do, ghi chú, người thực hiện; lịch sử cũ không bị sửa (chỉ hủy kết quả có lý do) |
| FR-16 | Danh sách Nhiệm vụ theo nhóm con | M | Panel trái có các mục (BR-50) với số đếm; bấm mục → danh sách phiếu của mục đó (đúng ảnh minh họa doc-1) |
| FR-17 | Màn xử lý phiếu 3 cột | M | Trái: trường phiếu để ghi nhận; giữa: dòng thời gian gọi/chat + tệp; phải: hồ sơ tài xế, thông tin phiếu, thao tác phiếu |
| FR-18 | Bằng chứng | S | Đính kèm ghi âm/ảnh chat/PDF ≤20 MB vào hoạt động; nghe/xem trong phiếu |
| FR-19 | Lịch hẹn và nhắc việc | M | Đặt lịch khi Đồng ý; xem dạng danh sách theo ngày (Hôm nay/Sắp tới/Quá giờ); nhắc trước 1 giờ và đúng giờ |
| FR-20 | Rà soát bàn giao Closed | M | Tiếp nhận thấy phiếu Closed chưa rà soát, ghi kết quả; phiếu Closed không tự làm Lead Closed |

### 5.4 Báo cáo – thống kê

| Mã | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|:-:|---|
| FR-21 | Dashboard theo vai trò | M | Tổng Lead, Lead mới hôm nay, Lead quá hẹn, tỷ lệ đăng ký, phễu; nội dung khác nhau theo vai trò (mục 8.3); số thay đổi đúng khi dữ liệu đổi |
| **FR-06** | Báo cáo phễu chuyển đổi | M* | Lọc theo thời gian, nguồn, trạng thái, nhân viên; phễu lũy kế N→R→O |
| FR-22 | Báo cáo theo nguồn/trạng thái/nhân viên, tỷ lệ quá hẹn | M | Tổng các nhóm khớp tổng Lead; có bảng chi tiết đối chiếu cho vai trò có quyền |
| FR-23 | Xuất báo cáo CSV | S | Viewer/Telesale chỉ xuất số tổng hợp |

\* Ảnh FR ghi “Nên”, bảng phạm vi của thầy ghi “Bắt buộc” → làm như Bắt buộc.

### 5.5 Quản trị

| Mã | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|:-:|---|
| FR-24 | Đăng nhập, đổi mật khẩu, quên mật khẩu | M | Mật khẩu ≥10 ký tự; tài khoản tạm ngưng không đăng nhập được |
| FR-25 | Quản lý tài khoản, vai trò, nhóm | M | Không tự đổi vai trò của mình; không bỏ Admin hoạt động cuối cùng |
| FR-26 | Danh mục nguồn, nhãn trạng thái | M | Thêm/sửa tên/tạm ngưng nguồn; mã trạng thái cố định, chỉ đổi nhãn |
| FR-27 | Nhật ký thao tác | M | Mọi thay đổi ghi người, thời điểm, đối tượng, nội dung; lọc/tìm được |
| FR-28 | Phân quyền theo vai trò | M | Tài khoản không xem/sửa được chức năng ngoài quyền, kể cả gọi API trực tiếp |

---

## 6. Quy tắc nghiệp vụ

### 6.1 Hồ sơ Lead

| Mã | Quy tắc |
|---|---|
| BR-01 | Bắt buộc: họ tên (≥2 ký tự), SĐT, thành phố đăng ký chạy xe, loại xe (Xe máy/Van), nguồn. Mã hồ sơ, ngày tiếp nhận, trạng thái đầu do hệ thống sinh |
| BR-02 | SĐT chuẩn hóa: bỏ khoảng trắng/dấu, `+84` → `0`, phải đủ 10 số bắt đầu bằng 0. Mỗi SĐT chuẩn hóa chỉ có một hồ sơ, kể cả hồ sơ đã lưu trữ |
| BR-03 | Tiếp nhận lại: giữ ngày tiếp nhận đầu và nguồn đầu; mỗi lần nhận lại là một sự kiện riêng |
| BR-04 | Trạng thái hồ sơ: **New** (còn khả năng đăng ký), **Activated** (đã hoàn tất đăng ký), **Onboarded** (đã chạy đơn đầu), **Closed** (không còn nhu cầu / sai SĐT) |
| BR-05 | Chỉ Tiếp nhận/Admin đổi trạng thái hồ sơ, mỗi lần cần căn cứ và thời điểm thực tế |
| BR-06 | Telesale chỉ xem hồ sơ (không sửa), và chỉ hồ sơ của phiếu mình đang được giao còn hạn |

### 6.2 Phiếu phân công

| Mã | Quy tắc |
|---|---|
| BR-10 | Hạn phiếu = thời điểm tạo + 14×24 giờ; mở lại Solved không gia hạn |
| BR-11 | Một Lead tối đa **một** phiếu chưa Closed (gồm New/Open/Solved). Chỉ tạo phiếu cho Lead New, chưa lưu trữ |
| BR-12 | Chuyển người = đóng phiếu cũ (lý do “chuyển người”) + tạo phiếu mới; không sửa người trên phiếu cũ |
| BR-13 | Phiếu Closed không mở lại được; nếu Lead còn New thì tạo phiếu mới |
| BR-14 | Hết hạn → Telesale mất quyền xử lý ngay tại thời điểm hết hạn, kể cả khi job chưa chạy |

### 6.3 Trạng thái phiếu và kết quả liên hệ

| Mã | Quy tắc |
|---|---|
| BR-20 | **New**: chưa có lần liên hệ nào. Lần ghi nhận đầu chuyển sang Open hoặc Solved |
| BR-21 | **Open**: đang chăm sóc — KNM < 3, quá hẹn < 3, tài xế đồng ý/tạm bận/cúp ngang |
| BR-22 | **Solved**: không nghe máy lần thứ **3**, không đến hẹn lần thứ **3** (D-01 đã xác nhận), không có nhu cầu, không đủ điều kiện, sai SĐT, hoặc Lead đã Activated |
| BR-23 | Hai bộ đếm KNM và quá hẹn **độc lập**; cuộc gọi thành công không reset. Mở lại Solved → đợt chăm sóc mới, bộ đếm đợt về 0, lịch sử giữ nguyên |
| BR-24 | Solved → Open chỉ khi Lead còn New và phiếu còn hạn, có lý do |
| BR-25 | **Closed**: tự động khi hết hạn, hoặc Trưởng nhóm/Admin đóng sớm có lý do |
| BR-26 | Hủy kết quả nhập nhầm: giữ bản ghi, đánh dấu hủy + lý do, tính lại bộ đếm; không tự mở lại phiếu |

Bảng kết quả liên hệ (trường “Status” trong nguồn):

| Kết quả | Quyết định cho phép | Lý do | Tác động |
|---|---|---|---|
| Đã liên hệ | Đồng ý / Không đồng ý / Cúp ngang / Chưa quyết định | Bắt buộc khi Không đồng ý: Không có nhu cầu / Tạm thời bận / Không đủ điều kiện | Đồng ý → có thể đặt lịch; Không nhu cầu/Không đủ ĐK → Solved; còn lại → Open |
| Không nghe máy (chỉ cuộc gọi) | — | — | KNM +1; lần 3 → Solved |
| Chat chưa phản hồi (chỉ Zalo) | — | — | Open, không tăng KNM |
| Sai số điện thoại | — | — | Solved; Tiếp nhận xác minh trước khi đóng hồ sơ |

“0” trong nguồn = “Chưa có / chưa xác định”.

### 6.4 Lịch hẹn

| Mã | Quy tắc |
|---|---|
| BR-30 | Đặt lịch khi quyết định Đồng ý; giờ hẹn ở tương lai, trước hạn phiếu; nơi hẹn bắt buộc |
| BR-31 | Chỉ xác nhận Đã đến/Không đến khi đã tới giờ hẹn. Mỗi lịch Không đến tăng quá hẹn đúng 1 lần |
| BR-32 | Hẹn lại = hủy lịch cũ (lý do hẹn lại) + tạo lịch mới liên kết |
| BR-33 | Lịch quá giờ chưa xác nhận chỉ là **cảnh báo**, không tự tính Không đến |
| BR-34 | Phiếu Solved/Closed/chuyển người → hủy các lịch còn chờ và nhắc chưa gửi |

### 6.5 Chuyển trạng thái hồ sơ

| Mã | Từ → Đến | Điều kiện |
|---|---|---|
| BR-40 | New → Activated | Có căn cứ đăng ký thành công + thời điểm ≤ hiện tại; phiếu New/Open của Lead → Solved |
| BR-41 | Activated → Onboarded | Có căn cứ đơn đầu, thời điểm ≥ ngày đăng ký |
| BR-42 | New → Closed | Lý do không nhu cầu / sai SĐT; hủy lịch chờ, phiếu New/Open → Solved |
| BR-43 | Closed → New | Có nhu cầu mới hoặc đã xác minh SĐT; Lead quay lại hàng chờ |
| — | Cạnh khác | Bị từ chối (vd. New → Onboarded, Activated → Closed). Sai mốc dùng “Đính chính” có audit |

### 6.6 Nhóm Nhiệm vụ (BR-50)

Mỗi mục đếm **phiếu** trong phạm vi quyền; các mục có thể giao nhau.

| Mục | Điều kiện |
|---|---|
| Chưa giải quyết | New/Open còn hạn |
| Chưa nhận việc | New, chưa nhận, còn hạn |
| Chưa liên hệ | New còn hạn |
| Đồng ý | New/Open còn hạn, lần liên hệ gần nhất = Đồng ý |
| Không nghe máy → lần 1 / lần 2 | New/Open còn hạn, KNM > 0 / đúng 1 / đúng 2 |
| Quá hẹn → lần 1 / lần 2 | New/Open còn hạn, có lịch quá giờ hoặc quá hẹn > 0 / đúng 1 / đúng 2 |
| Cập nhật gần đây | Cập nhật trong 72 giờ |
| Đã giải quyết | Solved (gồm KNM 3 / quá hẹn 3) |
| Đã đóng | Closed — Telesale cũ không thấy |

---

## 7. Dữ liệu

Mô hình tối thiểu theo yêu cầu của thầy và bảng vật lý tương ứng (chi tiết cột: [thiết kế dữ liệu](design/02-du-lieu-va-api.md)).

| Thực thể | Bảng | Trường chính |
|---|---|---|
| User | `sales` | họ tên, email, đang hoạt động |
| Role | `lead_roles`, `lead_user_roles` | vai trò, nhóm |
| Team | `lead_teams` | tên nhóm |
| Lead | `leads` | mã, họ tên, SĐT, thành phố, loại xe, nguồn đầu, trạng thái, ngày tiếp nhận đầu, nhãn, ghi chú, mốc đăng ký/chạy đơn, lưu trữ |
| LeadSource | `lead_sources` | tên, đang dùng |
| LeadStatus | `lead_statuses` | mã cố định, nhãn |
| Reception | `lead_receptions` | Lead, nguồn lần này, thời điểm, người nhận |
| Assignment | `lead_assignments` | mã phiếu, Lead, người được giao, người giao, tạo/cập nhật/hạn, trạng thái, lý do đóng, nhận việc, phiếu trước |
| CareRound | `lead_care_rounds` | đợt chăm sóc, bộ đếm |
| Activity | `lead_activities` | kênh, thời điểm, kết quả, quyết định, lý do, ghi chú, người, hủy |
| Attachment | `lead_attachments` | tệp bằng chứng |
| Appointment | `lead_appointments` | giờ, nơi, trạng thái, lịch trước |
| ClosureReview | `lead_closure_reviews` | phiếu đóng, kết quả rà soát |
| Notification | `lead_notifications` | người nhận, tiêu đề, đã đọc |
| ImportBatch | lô nhập | tên file, dòng, kết quả |
| AuditLog | `lead_audit_logs` | người, thời điểm, hành động, đối tượng, chi tiết |

Bảng/hàm của hệ thống giả lập cũ vẫn còn trong DB Supabase nhưng **không còn được app sử dụng**; xóa bằng migration riêng khi cần.

---

## 8. Kiến trúc thông tin và điều hướng (UI/UX)

### 8.1 Nguyên tắc

1. **Mỗi vai trò mở app là thấy ngay việc của mình**: trang chủ khác nhau theo vai trò; Telesale vào thẳng Nhiệm vụ.
2. **Điều hướng theo công việc, không theo bảng dữ liệu**: menu chia nhóm *Công việc / Hồ sơ / Phân tích / Quản trị*, chỉ hiện mục có quyền.
3. **Tài khoản và thông báo ở thanh trên** (avatar, chuông), không chiếm chỗ trong menu.
4. **Trạng thái luôn có màu nhất quán**: Lead (New xanh dương, Activated xanh lá, Onboarded tím, Closed xám); Phiếu (New xanh dương, Open cam, Solved xanh lá, Closed xám).
5. **Hành động chính một chỗ**: nút chính góc phải tiêu đề trang; thao tác trên một bản ghi nằm trên trang bản ghi.
6. **Không bao giờ để người dùng mắc kẹt**: trạng thái trống có hướng dẫn và nút đi tiếp; lỗi có nút thử lại.

### 8.2 Sơ đồ menu theo vai trò

| Nhóm | Mục | Đường dẫn | Tiếp nhận | Trưởng nhóm | Telesale | Admin | Viewer |
|---|---|---|:-:|:-:|:-:|:-:|:-:|
| — | Tổng quan | `/` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Công việc | Nhiệm vụ | `/tasks` | | ✓ | ✓ | ✓ | |
| Công việc | Điều phối | `/dispatch` | | ✓ | | ✓ | |
| Công việc | Lịch hẹn | `/appointments` | ✓ | ✓ | ✓ | ✓ | |
| Hồ sơ | Hồ sơ Lead | `/leads` | ✓ | ✓ | ✓ | ✓ | |
| Hồ sơ | Bàn giao Closed | `/handover` | ✓ | ✓ | | ✓ | |
| Phân tích | Báo cáo | `/reports` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quản trị | Người dùng | `/admin/users` | | | | ✓ | |
| Quản trị | Danh mục | `/admin/catalog` | | | | ✓ | |
| Quản trị | Nhật ký | `/admin/audit` | | | | ✓ | |
| Thanh trên | Thông báo (chuông) | `/notifications` | ✓ | ✓ | ✓ | ✓ | |
| Thanh trên | Tài khoản (avatar) | `/account` | ✓ | ✓ | ✓ | ✓ | ✓ |

### 8.3 Danh sách màn hình

Nhập CSV/XLSX mở bằng nút **Nhập Excel/CSV** trong **Hồ sơ Lead** (Tiếp nhận/Admin), không có mục riêng trên menu. Màn `/import` giữ quy trình chọn file → kiểm tra → kết quả; sau khi nhập có nút **Về Hồ sơ Lead**.

| Mã | Màn hình | Nội dung chính |
|---|---|---|
| SCR-01 | Đăng nhập / quên mật khẩu | Form gọn, thông báo lỗi rõ |
| SCR-02 | Tổng quan | Thẻ KPI (Tổng Lead, Mới hôm nay, Quá hẹn, Tỷ lệ đăng ký), phễu, theo nguồn; khối riêng theo vai trò: *Telesale* — việc hôm nay + lịch hẹn; *Trưởng nhóm* — chờ phân công + tải nhóm; *Tiếp nhận* — tiếp nhận gần đây + bàn giao chờ rà soát |
| SCR-03 | Nhiệm vụ | Thẻ tóm tắt (Tổng / Đang xử lý / Đã giải quyết / Sắp hết hạn); panel trái các mục BR-50 có số đếm; bên phải danh sách phiếu với tìm kiếm, lọc nhân viên/hạn |
| SCR-04 | Xử lý phiếu | 3 cột: **trái** form ghi nhận (kênh, ngày gọi, kết quả, quyết định, lý do, ngày/nơi hẹn, ghi chú) + nút lưu; **giữa** dòng thời gian (cuộc gọi, Zalo, lịch hẹn, tệp); **phải** hồ sơ tài xế, thông tin phiếu (hạn, bộ đếm), thao tác phiếu (nhận việc, giải quyết/mở lại/đóng, chuyển người) |
| SCR-05 | Điều phối | Danh sách Lead chờ phân công (chọn nhiều) + panel tải nhóm (số phiếu đang mở/nhân viên) + phiếu sắp hết hạn |
| SCR-06 | Hồ sơ Lead — danh sách | Tab trạng thái có số đếm, tìm kiếm, bộ lọc, bảng, phân trang, xuất CSV |
| SCR-07 | Hồ sơ Lead — chi tiết | Đầu trang: tên, SĐT, chip trạng thái, nút hành động; tab *Tổng quan / Phiếu phân công / Lịch sử tư vấn / Lịch sử tiếp nhận*; cột phải: người phụ trách, mốc kết quả, thao tác trạng thái |
| SCR-08 | Tạo/sửa hồ sơ | Kiểm tra trùng SĐT tức thì; form 2 cột |
| SCR-09 | Nhập danh sách | 3 bước: Chọn file → Xem trước & kiểm tra → Kết quả; lịch sử lô |
| SCR-10 | Lịch hẹn | Nhóm theo Quá giờ / Hôm nay / Sắp tới / Đã xử lý; thao tác ngay trên dòng |
| SCR-11 | Bàn giao Closed | Danh sách chờ rà soát / đã rà soát, form rà soát |
| SCR-12 | Báo cáo | Bộ lọc trên cùng, KPI, phễu, theo nguồn, theo nhân viên, chi tiết đối chiếu, xuất CSV |
| SCR-13 | Quản trị | Người dùng (tạo, vai trò, nhóm, kích hoạt), Danh mục (nguồn, nhóm, nhãn trạng thái), Nhật ký |
| SCR-14 | Thông báo, Tài khoản | Danh sách thông báo; đổi mật khẩu |

---

## 9. Yêu cầu phi chức năng

| Mã | Yêu cầu |
|---|---|
| NFR-01 | Phân quyền kiểm tra tại DB/API (RLS + hàm command), không chỉ ẩn nút trên UI |
| NFR-02 | Mọi ghi dữ liệu nghiệp vụ trong một transaction, có audit và chống gửi trùng (request ID, version) |
| NFR-03 | Thời gian lưu trữ UTC, hiển thị UTC+7 định dạng dd/mm/yyyy hh:mm |
| NFR-04 | Giao diện tiếng Việt, dùng được trên màn 1280px trở lên và thu gọn được trên điện thoại (≥360px) |
| NFR-05 | Tương phản và bàn phím: đạt WCAG AA cho chữ, có focus rõ, có link “Đến nội dung chính” |
| NFR-06 | Danh sách ≤ 1 giây với dữ liệu mẫu; thao tác hiển thị trạng thái đang xử lý |

---

## 10. Câu hỏi còn mở

| Mã | Câu hỏi | Mặc định đang dùng |
|---|---|---|
| Q-02 | Hạn 14 ngày tính 14×24 giờ hay hết ngày thứ 14? | 14×24 giờ |
| Q-05 | Một Lead có thể có nhiều phiếu song song? | Không (BR-11) |
| Q-09 | Quy công báo cáo khi một Lead qua nhiều người? | Người trên phiếu gần nhất |
| Q-13 | Tên đề tài, thời hạn, môi trường demo chính thức? | Chưa có |
