# KPI, dữ liệu mẫu và tiêu chí nghiệm thu

Thuộc [đặc tả bước 1](../05-dac-ta-buoc-1.md). Công thức là **đề xuất D-09**, chưa được người dùng duyệt. Ca KNM/quá hẹn lần 3 dùng ngưỡng **đã xác nhận D-01**; cách đếm/reset D-12 vẫn là đề xuất. Bản thiết kế ban đầu được giữ để truy vết; fixture, SQL và luồng trình duyệt đã được chạy, xem kết quả hiện tại tại ../08-ket-qua-gia-lap-core-va-khac-phuc.md.

## 1. Mô hình báo cáo đề xuất

Đây là báo cáo **snapshot hiện tại của nhóm hồ sơ tiếp nhận trong khoảng ngày**, không phải báo cáo mọi cuộc gọi/chuyển đổi xảy ra trong khoảng đó. Thời điểm chụp T do server lấy một lần cho toàn bộ truy vấn; fixture cố định T để kiểm chứng. API người dùng chưa cung cấp tùy chọn “quay lại lịch sử tại T”; tính đúng dữ liệu quá khứ đòi hỏi thêm thiết kế lịch sử cho mọi chiều dữ liệu.

1. Tập nền gồm Lead đã được tiếp nhận đến T, không lưu trữ tại T và trong phạm vi báo cáo của người gọi.
2. Khoảng ngày lọc theo **first_received_at**; ngày UI theo UTC+7. `from_date` bắt đầu 00:00 ngày đó; `to_date` lấy đến trước 00:00 ngày tiếp theo. Không lọc theo updated_at/Assignment/Activity date thay thế mà không đổi tên báo cáo.
3. Nguồn báo cáo là **nguồn tiếp nhận đầu** trên Lead, không đổi vì cùng tài xế được nhận lại từ kênh khác. Có thể thống kê reception event theo nguồn lần nhận riêng, nhưng không trộn với số Lead theo nguồn đầu.
4. Người/nhóm quy công là trên **phiếu có created_at gần nhất tại T**, kể cả phiếu Solved/Closed; thứ tự phụ id ổn định. Không dùng nhóm hiện tại của nhân viên để thay team snapshot trên phiếu.
5. Lead chưa từng có phiếu vào nhóm “Chưa phân công”; Lead chỉ có phiếu Closed vẫn thuộc người gần nhất trong báo cáo, không thành chưa phân công. Hàng đợi vận hành và quy công báo cáo là hai chiều khác nhau.
6. Kết hợp bộ lọc ngày/nguồn/trạng thái/nhân viên/nhóm bằng AND; áp dụng trước khi tính mọi KPI/breakdown/phễu. Không cộng số phiếu vào số Lead.
7. Mỗi hồ sơ thuộc một nguồn đầu, một trạng thái hiện tại và một nhóm quy công tại T, nên tổng nhóm có thể đối chiếu với tổng nền. Giữ nhóm “Chưa phân công” khi cần để không mất tổng.

Theo cách này, chuyển người có thể làm báo cáo kỳ tiếp nhận trước chuyển sang người mới; lưu trữ có thể làm số kỳ cũ giảm; chuyển đổi sau khoảng lọc vẫn được tính nếu xảy ra trước T. UI phải ghi “Theo ngày tiếp nhận đầu; kết quả cập nhật đến T”. Báo cáo theo ngày chuyển đổi hoặc quy công tại thời điểm chuyển đổi là loại khác, chưa mặc định đưa vào bản đầu.

## 2. Định nghĩa chỉ số

Gọi **S** là tập hồ sơ sau phạm vi quyền và toàn bộ bộ lọc, **N = count(distinct Lead.id)** trong S.

| Chỉ số | Công thức/định nghĩa | Cách hiển thị |
| --- | --- | --- |
| Tổng Lead | N | Không phải count assignment hoặc reception |
| Lead mới hôm nay | Hồ sơ trong S có first_received_at thuộc ngày hiện tại UTC+7 | Tiếp nhận lại hồ sơ cũ không tăng chỉ số này |
| Lượt tiếp nhận trong ngày | Count reception event hợp lệ trong ngày theo phạm vi riêng | Chỉ số bổ trợ nếu hiển thị; phải ghi “lượt”, không ghi “Lead mới” |
| Lead được tiếp nhận trong ngày | Count distinct lead_id của các reception event trong ngày | Tách với lượt tiếp nhận và Lead mới lần đầu |
| Đã đăng ký R | S có activated_at hợp lệ, ≤ T | Bao gồm tài xế đã Onboarded; không cần status hiện tại đúng Activated |
| Đã chạy đơn đầu O | S có onboarded_at hợp lệ, ≤ T, và activated_at hợp lệ | O ≤ R ≤ N; thiếu milestone là lỗi dữ liệu cần phát hiện, không bù bằng số phiếu |
| Tỷ lệ đăng ký | R/N × 100 | Tên rõ “Tỷ lệ đăng ký”; nếu dùng “chuyển đổi” thì phải chỉ rõ đích |
| Tỷ lệ chạy đơn đầu | O/N × 100 | Không tự dùng O/R mà vẫn ghi cùng nhãn |
| Lead quá hẹn U | Distinct Lead trong S có lịch scheduled với scheduled_at < T, phiếu New/Open chưa Closed và T < expires_at | Lịch cancelled/attended/missed và lịch của phiếu cũ không tính cảnh báo đang chờ |
| Tỷ lệ quá hẹn | U/N × 100 | Đây là D-09 đề xuất để làm rõ “Lead quá hạn” trong nguồn |
| Phiếu hết hạn | Phiếu chưa Closed nhưng T ≥ expires_at, hoặc thống kê closure reason expired nếu xem lịch sử | Chỉ số vận hành riêng, không cộng vào U |
| Phễu tích lũy | Đã tiếp nhận N → đã đăng ký R → đã chạy đơn O | Chiều rộng mỗi bậc chia N; không vẽ New/Activated/Onboarded như ba nhóm rời |
| Lead theo trạng thái | Count Lead trong S có status_code tương ứng | Các nhóm New/Activated/Onboarded/Closed cộng bằng N |
| Theo nguồn/nhân viên/nhóm | Tính N/R/O/U trên từng phân nhóm của S | Có danh sách đối chiếu chỉ khi vai trò có quyền chi tiết |

N=0 trả số đếm 0, tỷ lệ 0 kèm trạng thái “Không có dữ liệu”; không chia 0 hoặc hiển thị NaN. Tính bằng phân số chính xác, làm tròn **2 chữ số thập phân** khi hiển thị/xuất; không lấy trung bình các tỷ lệ con làm tỷ lệ tổng.

Lịch đã xác nhận missed tăng bộ đếm thất bại của round, nhưng không còn là lịch scheduled đang chờ, vì vậy U có thể giảm sau khi xử lý “Không đến”. Nếu cần tỷ lệ lịch không đến, đặt chỉ số riêng theo Appointment; không âm thầm đổi mẫu số hoặc tên U. Hết hạn phiếu làm mất quyền và loại lịch đó khỏi U dù job đóng/cancel chưa chạy; job phải dọn trạng thái sau đó.

## 3. Quyền báo cáo và chi tiết

| Vai trò | Tập báo cáo cho phép | Chi tiết/xuất |
| --- | --- | --- |
| Admin/tiếp nhận | Toàn cục | Chi tiết và CSV có SĐT theo cùng bộ lọc |
| Trưởng nhóm | Phiếu gần nhất thuộc nhóm mình | Chi tiết nhóm; hàng đợi chung xem ở màn hình vận hành, không tự cộng vào số nhân viên nhóm |
| Telesale | Người trên phiếu gần nhất là chính mình, kể cả phiếu đã Closed | Chỉ tổng hợp lịch sử. Chi tiết chỉ khi còn quyền operational; không trả UUID/SĐT qua báo cáo lịch sử |
| Viewer | Tổng hợp toàn cục theo đề xuất D-06 | Không có ID hồ sơ/SĐT/notes; chỉ xuất tổng hợp |

Không nhận `actor_id/role/scope` từ payload làm căn cứ mở rộng quyền. Filter ngoài phạm vi không được lộ dữ liệu. Thông báo, file export, job digest và audit cũng phải theo quyền hiện tại.

## 4. Bộ dữ liệu kiểm chứng P1.5

Fixture: [report-cases.json](fixtures/report-cases.json). Thời điểm chụp: **12:00 ngày 21/10/2026 UTC+7**. Đây là projection đủ cho công thức báo cáo; **không phải seed DB hoàn chỉnh**, chưa chứa SĐT, user Auth, acceptance, activity và tất cả audit/transaction bắt buộc.

| Lead | Ngày đầu | Nguồn đầu | Trạng thái | Phụ trách gần nhất | Tình huống |
| --- | --- | --- | --- | --- | --- |
| L01 | 21/10 | web | New | sale-1 / Nhóm A | Scheduled 11:00, chưa xử lý, quá hẹn tại T |
| L02 | 21/10 | facebook | Activated | sale-2 / Nhóm A | Đăng ký 11:00; lịch attended; phiếu Solved |
| L03 | 20/10 | referral | Onboarded | sale-1 / Nhóm A | Đăng ký 20/10, đơn đầu 21/10, phiếu đã Closed |
| L04 | 19/10 | hotline | Closed | sale-2 / Nhóm A | Có hai lần phân công; không có milestone đăng ký |
| L05 | 21/10 | web | New | sale-3 / Nhóm B | Chuyển từ sale-1 sang sale-3; lịch cũ cancelled; lịch mới ngày 22/10; nhận lại từ facebook không đổi nguồn đầu |
| L06 | 18/10 | web | New | sale-1 / Nhóm A | Đã lưu trữ, bị loại khỏi mọi tập báo cáo mặc định |
| L07 | 20/10 | hotline | New | Chưa từng phân công | Được tiếp nhận lại 21/10; không phải Lead mới 21/10 |
| L08 | 21/10 | web | New | sale-3 / Nhóm B | Chuyển nhóm; lịch cũ cancelled; lịch mới 11:30 scheduled quá giờ; có nhiều reception event |

Kết quả dự kiến theo thứ tự **N / R / O / U / Lead mới hôm nay**:

| Bộ lọc | Lead | N / R / O / U / mới | Tỷ lệ đăng ký / chạy đơn / quá hẹn |
| --- | --- | --- | --- |
| Toàn cục | L01 L02 L03 L04 L05 L07 L08 | 7 / 2 / 1 / 2 / 4 | 28,57% / 14,29% / 28,57% |
| Ngày tiếp nhận 21/10 | L01 L02 L05 L08 | 4 / 1 / 0 / 2 / 4 | 25% / 0% / 50% |
| Nguồn web | L01 L05 L08 | 3 / 0 / 0 / 2 / 3 | 0% / 0% / 66,67% |
| sale-1 | L01 L03 | 2 / 1 / 1 / 1 / 1 | 50% / 50% / 50% |
| sale-2 | L02 L04 | 2 / 1 / 0 / 0 / 1 | 50% / 0% / 0% |
| sale-3 | L05 L08 | 2 / 0 / 0 / 1 / 2 | 0% / 0% / 50% |
| Nhóm A | L01 L02 L03 L04 | 4 / 2 / 1 / 1 / 2 | 50% / 25% / 25% |
| Nhóm B | L05 L08 | 2 / 0 / 0 / 1 / 2 | 0% / 0% / 50% |
| Chưa phân công | L07 | 1 / 0 / 0 / 0 / 0 | 0% / 0% / 0% |
| Ngày tiếp nhận 22/10 | Không có | 0 / 0 / 0 / 0 / 0 | 0%, hiển thị Không có dữ liệu |
| Từ 22/10 đến 21/10 | Khoảng ngày sai | VALIDATION_FAILED | Không hiển thị tập rỗng như một báo cáo hợp lệ |

Đối chiếu thêm: 8 reception event ngày 21/10, thuộc 5 Lead khác nhau, nhưng chỉ **4 Lead mới lần đầu**. Có 10 assignment trong fixture, trong đó 1 thuộc Lead lưu trữ; tổng báo cáo vẫn là 7 Lead. L05/L08 chỉ quy cho sale-3, L04 chỉ quy cho sale-2. Ngày 21/10 có một milestone đăng ký mới (L02) và một đơn đầu (L03), trong khi snapshot toàn cục có **2** hồ sơ đã đăng ký; không tráo hai loại chỉ số này.

Theo trạng thái toàn cục: New=4, Activated=1, Onboarded=1, Closed=1. Theo nguồn đầu: web=3, facebook=1, referral=1, hotline=2. Phễu toàn cục: 7 → 2 → 1.

**Kiểm chứng tài liệu ngày 21/10/2026:** đã đọc fixture bằng Node, tính lại độc lập 11 case (gồm khoảng ngày sai), đối chiếu reception checks, quan hệ Lead/assignment/lịch, giới hạn phiếu/lịch hiện hành và thời hạn 14×24 giờ; tất cả khớp kết quả dự kiến. Đây là kiểm tra tính nhất quán của dữ liệu/công thức thiết kế, chưa phải unit/e2e/RLS của ứng dụng. Liên kết tài liệu nội bộ cũng đã được kiểm tra.

## 5. Ca nghiệm thu nghiệp vụ và quyền

Các ca là **kịch bản phải hiện thực và chạy ở các bước sau**, chưa phải test app đã pass. Quy tắc D chưa duyệt cần cập nhật ca cùng quyết định. Không dựng test chỉ để cố định hành vi demo trái quyết định mới.

| Mã | Given / When | Then kỳ vọng | Yêu cầu/quyết định |
| --- | --- | --- | --- |
| AC-01 | Tiếp nhận tạo Lead hợp lệ | Một hồ sơ New, reception event, nguồn/ngày và hàng đợi, audit cùng thành công | FR-01/02, D-11 |
| AC-02 | Nhập tay/import hai dạng 090… và +8490… cùng SĐT, kể cả hồ sơ lưu trữ | Cảnh báo cùng hồ sơ; không tạo mới; bổ sung có lựa chọn/audit | R-03, D-04/08 |
| AC-03 | Hai request tạo cùng SĐT đồng thời | Một hồ sơ; request còn lại nhận duplicate; không để hai queue pending | R-03, T-03 |
| AC-04 | Lead cũ được nhận lại trong ngày | Giữ first_received_at/source đầu; thêm event; chỉ một pending nếu đủ điều kiện | Q-04, D-04 |
| AC-05 | Activated/Onboarded nhận lại hoặc khôi phục hồ sơ lưu trữ | Không tự New/không tự giao mới; quy trình xác nhận riêng | D-04/13 |
| AC-06 | Telesale/viewer gửi request sửa hồ sơ hoặc giả actor/role | API/DB từ chối; không có thay đổi; không chỉ ẩn nút | R-01, D-06 |
| AC-07 | Trưởng nhóm A đọc/giao Lead nhóm B, hoặc hai leader nhận cùng queue | Sai phạm vi bị chặn; cùng queue chỉ một giao thành công | FR-03, D-05/06 |
| AC-08 | Telesale nhận việc rồi chưa gọi | accepted_at được ghi, phiếu vẫn New; gửi lại không có lần nhận trùng | R-08 |
| AC-09 | Chuyển người khi còn lịch scheduled | Đóng cũ/tạo mới nguyên tử, lịch theo lựa chọn hủy/tạo thay thế; người cũ mất quyền; không mất timeline | R-08, D-05/06/10 |
| AC-10 | Đợt có 1 rồi 2 rồi 3 KNM hợp lệ | Open ở lần 1/2; Solved đúng lần 3, lý do đúng | **D-01 đã XN**, D-12 |
| AC-11 | 2 KNM và 1 lịch missed; hoặc cùng missed request gửi hai lần | Không cộng hai bộ đếm thành3; một lịch tăng missed đúng1 | D-12 |
| AC-12 | Ghi hoạt động mới trên Solved hoặc lần thứ4 khi chưa mở lại | Bị từ chối; không ghi thêm activity/tăng bộ đếm | R-10, D-01/12 |
| AC-13 | Solved mở lại khi còn hạn | Open, round mới 0/0, tổng lịch sử giữ nguyên; lần KNM tiếp theo tính1 của round mới | R-10, D-12 |
| AC-14 | Thời điểm ngay trước/đúng/sau expires_at, job chưa chạy | Trước hạn còn quyền; đúng/sau hạn từ chối ghi/mở lại; job Closed một lần | R-10, D-02 |
| AC-15 | Job đóng phiếu chạy hai lần | Một closure review; hủy lịch/nhắc đúng; Lead không tự Closed | R-09, D-03/10 |
| AC-16 | Ghi agreed hoặc attended | Không tự Activated; tiếp nhận/Admin có bằng chứng mới xác nhận | D-03 |
| AC-17 | Xác nhận Activated rồi Onboarded hợp lệ | Milestone + status event + audit; phiếu/lịch liên quan đúng bảng; chặn New→Onboarded | D-03 |
| AC-18 | Đặt hẹn ngoài hạn, quá khứ, thiếu nơi hoặc hẹn lại | Input sai bị từ chối; hẹn lại tạo bản mới, hủy nhắc cũ | R-13, D-10 |
| AC-19 | Lịch quá giờ chưa xác nhận missed, job chạy nhiều lần | Chỉ cảnh báo quá hẹn; không tự tăng đếm missed lặp | D-10/12 |
| AC-20 | Nhắc trước1h/đến giờ; tạo lịch còn dưới1h; job chạy bù | Không gửi trùng, không gửi mốc1h cũ, hủy/chuyển không nhắc sai người | D-10 |
| AC-21 | Bàn giao phiếu cũ khi Lead đã Activated hoặc phiếu transferred | Không lùi Lead; transferred không đề nghị đóng hồ sơ; giữ căn cứ xử lý | R-09, D-03 |
| AC-22 | Telesale cũ/nhóm cũ truy cập URL/API/file sau Closed/hết hạn/chuyển | Chi tiết bị chặn theo quyền; không truy cập vòng qua audit/export/notification | R-01, D-06 |
| AC-23 | Viewer/telesale lịch sử xem report | Có tổng hợp đúng scope; không có SĐT/UUID/timeline từ payload tổng hợp | D-06/09 |
| AC-24 | Import batch có valid/duplicate/error rồi commit lại | Kết quả từng dòng, mỗi dòng nguyên tử; không nhân đôi hồ sơ/reception; xung đột yêu cầu chọn bổ sung | FR-02, D-08 |
| AC-25 | Upload/finalize file sai Lead hoặc hết quyền tải | Bị chặn; recording/chat không public; không gán object người khác thành evidence | R-11, D-07 |
| AC-26 | Fixture báo cáo theo mọi case, filter/sort/pagination/export | Đúng các số dự kiến; tổng nguồn/trạng thái/owner khớp, không đếm trùng | FR-06, D-09 |
| AC-27 | Giảm quyền/tạm ngưng khi còn session cũ | DB/API áp dụng quyền mới; không dựa vào cache role cũ của trình duyệt | R-01, D-06 |
| AC-28 | Lỗi giữa command đổi trạng thái và ghi audit | Rollback cả nghiệp vụ và audit, không lưu nửa chừng; retry có request_id không tạo trùng | R-10/17, T-03 |

## 6. Chỉ số theo dõi sau khi có bản chạy

Chỉ số nghiệm thu sớm: tỷ lệ ca đúng/sai quyền pass, tỷ lệ command quan trọng có audit, số hồ sơ trùng chuẩn hóa, số lệch giữa báo cáo và chi tiết, số job chạy lại tạo kết quả trùng. Mục tiêu đề xuất khi bàn giao: toàn bộ ca trong phạm vi được duyệt đạt; không có vi phạm quyền, trùng Lead hoặc lệch đối chiếu trong bộ mẫu.

Chỉ số vận hành về sau: lượt tiếp nhận, Lead chờ phân công/chưa nhận/chưa liên hệ, backlog Closed chưa rà soát, đăng ký/đơn đầu và tỷ lệ quá hẹn theo định nghĩa đã duyệt. Chưa có baseline để đặt mục tiêu tăng chuyển đổi hoặc giảm thời gian xử lý; cần người đặt đề tài xác định nếu muốn đánh giá tác động kinh doanh.
