# Ma trận quyền và workflow Lead Sale

Thuộc [đặc tả bước 1](../05-dac-ta-buoc-1.md). **Chỉ ngưỡng D-01 (lần 3 → Solved) đã được người dùng xác nhận ngày 21/10/2026.** Các chi tiết thiết kế nghiệp vụ còn lại là đề xuất theo mã D trong sổ quyết định; chưa hiện thực trong app/DB.

## 1. Quy ước phạm vi quyền — D-06

- **Toàn cục:** toàn bộ dữ liệu trong một hệ thống Lead Sale; chưa thiết kế đa tổ chức.
- **Nhóm:** Lead có phiếu gần nhất thuộc nhóm của trưởng nhóm, kể cả phiếu đã Closed; `team_id` trên phiếu là ảnh chụp nhóm lúc phân công, không suy ra từ nhóm hiện tại của nhân viên.
- **Hàng đợi chung:** Lead New chưa lưu trữ, có yêu cầu tư vấn đang chờ và không có phiếu hiệu lực. Trưởng nhóm thấy hàng đợi chung để nhận về nhóm; hai nhóm nhận cùng lúc chỉ một nhóm thành công.
- **Được giao:** Telesale là assignee của phiếu chưa Closed **và** chưa hết hạn; gồm New/Open/Solved. Chỉ xem hồ sơ gắn phiếu đó. Khi Closed/hết hạn/chuyển người, mất quyền đọc chi tiết hồ sơ, phiếu, activity, lịch và file của lượt cũ. Lịch sử vẫn còn cho tiếp nhận/Admin và trưởng nhóm có phạm vi Lead.
- **Báo cáo cá nhân:** có thể xem tổng hợp theo người trên phiếu gần nhất của mình, gồm kết quả phiếu đã Closed; không vì thấy tổng hợp mà được đọc lại chi tiết Lead đã hết quyền.
- **Viewer:** báo cáo tổng hợp, không drill-down hồ sơ, UUID Lead, SĐT, ghi chú, recording/chat. Xuất chỉ có số tổng hợp. Đây là lựa chọn phạm vi cần xác nhận, không suy ra từ tên vai trò.

Trưởng nhóm chỉ chuyển trong nhóm; Admin chuyển được giữa nhóm. Chuyển khác nhóm làm nhóm cũ mất quyền hồ sơ theo quy tắc phiếu gần nhất; báo cáo snapshot cũng chuyển theo người/nhóm mới, giữ audit cho Admin/tiếp nhận. Quyền đọc không kế thừa chỉ vì người đó từng tạo một activity. Tạm ngưng tài khoản chặn toàn bộ quyền ngay tại DB/API.

Quyền đọc phiếu/activity/lịch/file của trưởng nhóm đi theo **phạm vi Lead hiện tại**, không chỉ kiểm tra team_id của một phiếu lịch sử. Vì vậy phiếu cũ thuộc Nhóm A không trở thành đường đọc lại L05 sau khi Lead đã chuyển sang Nhóm B. Admin/tiếp nhận vẫn truy vết được lịch sử toàn cục.

## 2. Ma trận vai trò × hành động

**TC** = toàn cục; **N** = nhóm; **G** = được giao; **HĐ** = hàng đợi chung; **TH** = chỉ tổng hợp; **—** = không cho phép. Các ô là thiết kế đề xuất D-06; API và DB cùng áp dụng.

| Hành động | Admin | Tiếp nhận | Trưởng nhóm | Telesale | Viewer |
| --- | --- | --- | --- | --- | --- |
| Đăng nhập/đổi mật khẩu bản thân | Có | Có | Có | Có | Có |
| Tạo/mời, đổi vai trò/nhóm, tạm ngưng tài khoản | TC | — | — | — | — |
| Xem danh sách/chi tiết Lead và SĐT | TC | TC | N + HĐ | G | — |
| Tìm SĐT để kiểm tra trùng trước tiếp nhận | TC | TC | — | — | — |
| Tạo/bổ sung/tiếp nhận lại/import Lead | TC | TC | — | — | — |
| Đổi trạng thái Lead, xác nhận Activated/Onboarded | TC | TC | — | — | — |
| Lưu trữ/khôi phục Lead | TC | TC | — | — | — |
| Xóa cứng Lead, activity, audit | — | — | — | — | — |
| Tạo/giao/chuyển phiếu | TC | — | N + nhận từ HĐ | — | — |
| Nhận việc | — | — | — | Chính mình trên G | — |
| Xem phiếu/timeline/lịch sử/tệp chung | TC | TC | N | G | — |
| Ghi hoạt động/đặt hẹn | TC có lý do can thiệp | — | — | G đã nhận, New/Open | — |
| Ghi kết quả/hẹn lại/hủy lịch | TC có lý do can thiệp | — | — | G, phiếu New/Open | — |
| Mở lại Solved/giải quyết phiếu thủ công | TC | — | N | G có lý do và đủ điều kiện | — |
| Đóng phiếu sớm | TC | — | N | — | — |
| Xem/đánh dấu rà soát bàn giao Closed | TC | TC | N chỉ xem | — | — |
| Xem dashboard/báo cáo tổng hợp | TC | TC | N | Cá nhân TH | TC TH |
| Xem chi tiết đối chiếu/xuất có SĐT | TC | TC | N | — | — |
| Xuất báo cáo tổng hợp | TC | TC | N | Cá nhân TH | TC TH |
| Quản lý nguồn/nhãn/danh mục | TC | Chọn khi nhập | Chọn khi lọc | Chọn khi lọc | Chọn khi lọc |
| Xem audit | TC | Lịch sử nghiệp vụ hồ sơ | Lịch sử nghiệp vụ N | Timeline G | — |

Admin không “nhận việc hộ” nhân viên; nếu cần tư vấn thay, activity phải ghi đúng actor Admin và lý do can thiệp. Trưởng nhóm quan sát/điều phối, không sửa nội dung activity của nhân viên. Sửa sai bằng bản ghi đính chính có tác giả/lý do; không mất bản gốc. Ghi chú cá nhân chỉ triển khai nếu chốt phạm vi P1, không mặc định Admin hay trưởng nhóm được xem loại ghi chú đó.

### Ràng buộc thay tài khoản/nhóm

- Mỗi user có một vai trò nghiệp vụ; trưởng nhóm/Telesale thuộc một nhóm hoạt động. Admin/tiếp nhận/viewer có phạm vi toàn cục theo bảng.
- Đổi nhóm/đổi vai trò/tạm ngưng Telesale có phiếu hiệu lực phải bàn giao/đóng phiếu trong cùng thao tác quản trị hoặc bị từ chối. Trường hợp khóa khẩn cấp vẫn cắt quyền ngay; phiếu chuyển vào hàng đợi Admin cần bàn giao, không tự ghi người xử lý khác.
- Không để thay đổi vai trò của chính mình hoặc bỏ Admin hoạt động cuối cùng bằng UI/API quản trị thông thường.
- Profile, vai trò và nhóm được kiểm tra phía server mỗi command; cache giao diện không tạo quyền.

## 3. Tiếp nhận và tái tiếp nhận — D-04/08/11/13

1. Chuẩn hóa SĐT, tra hồ sơ kể cả lưu trữ; unique SĐT không chỉ áp dụng hồ sơ đang dùng.
2. Hồ sơ mới: tạo Lead New và một reception event cùng transaction. Server sinh mã và timestamp; lưu nguồn tiếp nhận đầu.
3. Hồ sơ trùng: hiển thị hồ sơ hiện có và các trường bổ sung/xung đột. Mặc định chỉ bổ sung trường trống; thay giá trị đã có cần chọn rõ, kiểm tra phiên bản và audit. Không ghi đè âm thầm bằng file import.
4. Mỗi lần tiếp nhận hợp lệ lưu reception event riêng, nguồn/kênh lần này và thời điểm; không ghi đè ngày/nguồn đầu chỉ vì tiếp nhận lại.
5. Lead New chưa có phiếu hiệu lực: tạo/cập nhật **một yêu cầu hàng đợi mở**; nhiều reception event không sinh nhiều việc giao trùng. Nếu có phiếu hiệu lực, đánh dấu sự kiện đã thông báo người đang phụ trách, không tạo phiếu thứ hai.
6. Lead Closed: tiếp nhận có thể ghi thêm sự kiện nhưng chỉ tạo hàng đợi sau thao tác xác nhận mở lại Closed → New. Activated/Onboarded giữ trạng thái, không tự tạo hàng đợi tư vấn đăng ký.
7. Hồ sơ lưu trữ phải khôi phục trước khi xử lý tiếp; giữ lịch sử và SĐT. Lưu trữ chỉ khi không còn phiếu chưa Closed; khôi phục không tự mở Lead Closed hoặc tạo phiếu.

Hàng đợi có kết quả `pending / assigned / already_assigned / review_required / not_eligible`; cùng Lead chỉ một `pending`. Quy tắc không đủ điều kiện phải hiển thị lý do, không chỉ âm thầm bỏ dòng nhập.

## 4. Chuyển trạng thái hồ sơ — D-03/04

| Từ | Đến | Người thực hiện | Điều kiện | Tác động nguyên tử |
| --- | --- | --- | --- | --- |
| Chưa có | New | Tiếp nhận/Admin | Hồ sơ hợp lệ, SĐT không trùng | Tạo hồ sơ, reception event, hàng đợi và audit |
| New | Activated | Tiếp nhận/Admin | Thời điểm đăng ký hợp lệ ≤ hiện tại; có căn cứ xác nhận | Ghi mốc activation và status event; New/Open của Lead → Solved; hủy lịch đăng ký chưa xử lý với lý do đã đăng ký |
| Activated | Onboarded | Tiếp nhận/Admin | Có căn cứ đơn đầu, thời điểm ≥ activated_at và ≤ hiện tại | Ghi mốc onboarded và status event; không tạo phiếu tư vấn mới |
| New | Closed | Tiếp nhận/Admin | Lý do `no_need` hoặc `wrong_phone`, ghi căn cứ | Ghi status event; New/Open → Solved; hủy lịch tương lai/chưa xử lý với lý do đóng hồ sơ; hủy hàng đợi mở |
| Closed | New | Tiếp nhận/Admin | Có nhu cầu mới hoặc đã xác minh/correct SĐT; ghi lý do và reception event | Giữ lịch sử/ngày/nguồn đầu; tạo hàng đợi nếu không còn phiếu hiệu lực |

Các cạnh không liệt kê bị từ chối, gồm New → Onboarded và Activated/Onboarded → Closed. Lựa chọn này giữ nghĩa Closed là không còn nhu cầu đăng ký, còn milestone đã đăng ký/đơn đầu không bị mất. Đây là **đề xuất** cần chốt D-03; sai dữ liệu milestone phải qua cơ chế đính chính quản trị có audit, không dùng chuyển trạng thái thường để xóa lịch sử. Cơ chế đính chính cần mô tả trước khi đưa vào sản phẩm.

Solved không tự thành Closed khi Lead được xác nhận Activated; vẫn chờ hết hạn hoặc trưởng nhóm đóng theo bảng phiếu. Đến hẹn/đồng ý không tự suy ra đã Activated. Sai SĐT trong tư vấn chỉ giải quyết phiếu, tiếp nhận xác minh trước khi đóng hồ sơ.

## 5. Vòng đời phiếu — D-01/02/05/12

### Bất biến

- Một Lead tối đa một phiếu chưa Closed, bao gồm Solved. Chỉ tạo phiếu cho Lead New, chưa lưu trữ, từ hàng đợi hợp lệ.
- `expires_at = created_at + 14×24h`; mở lại Solved không thay hạn. Phân biệt `status != Closed` trong DB với quyền thực tế: `now < expires_at` luôn là điều kiện xử lý.
- Tại đúng hạn đã hết quyền, kể cả job chưa kịp cập nhật Closed. Giao lại sau hạn sẽ khóa Lead, đóng phiếu cũ hết hạn rồi tạo phiếu mới trong transaction, không dựa vào timer frontend.
- Nhận việc ghi `accepted_at/accepted_by`, phiếu vẫn New cho đến lần liên hệ đầu; không thêm trạng thái Accepted.

| Sự kiện | Từ → Đến | Ai | Điều kiện và tác động |
| --- | --- | --- | --- |
| Giao việc | Chưa có → New | Trưởng nhóm/Admin | Assignee Telesale hoạt động, đúng nhóm; không còn phiếu chưa Closed; tạo đợt chăm sóc 1 |
| Nhận việc | New → New | Assignee | Trong hạn, chưa nhận; ghi accepted_at; gửi lại cùng request không sinh lịch sử trùng |
| Ghi liên hệ lần đầu | New → Open hoặc Solved | Assignee đã nhận / Admin can thiệp | Kết quả theo bảng hoạt động; lưu Activity và đổi trạng thái cùng transaction |
| Chăm sóc tiếp | Open → Open hoặc Solved | Assignee / Admin can thiệp | Trong hạn, Lead New, hoạt động hợp lệ |
| Giải quyết thủ công | New/Open → Solved | Trưởng nhóm/Admin; assignee đã nhận | Có lý do thuộc danh mục và ghi chú; reason liên quan hoạt động phải tham chiếu activity; không khai báo Activated thay bộ phận tiếp nhận |
| Mở lại | Solved → Open | Assignee / trưởng nhóm/Admin | `now < expires_at`, Lead New, có lý do; tạo care round mới; các lịch cũ đã hủy không tự bật lại |
| Đóng sớm | New/Open/Solved → Closed | Trưởng nhóm/Admin | Có lý do; ghi closed_at/by, tạo bàn giao, hủy lịch scheduled và nhắc chưa gửi |
| Tự đóng | New/Open/Solved → Closed | Job server | `now >= expires_at`, closed_reason=expired; tạo bàn giao, hủy lịch/nhắc chưa xử lý; không đổi trạng thái Lead |
| Chuyển người | New/Open/Solved → Closed + phiếu mới New | Trưởng nhóm cùng nhóm / Admin | Khác assignee, lead New; đóng cũ reason=transferred; tạo mới và liên kết, hạn mới 14×24h; giữ toàn bộ lịch sử |
| Mở phiếu đã đóng | Closed → bất kỳ | Không có | Bị từ chối; nếu Lead đủ điều kiện, lập phiếu mới |

Phiếu đóng do chuyển người vẫn có bản ghi bàn giao với cờ `transferred`, nhưng được đánh dấu **không cần đổi trạng thái Lead**, tham chiếu phiếu mới; tránh bộ phận tiếp nhận hiểu nhầm đây là thất bại tư vấn. Mọi hoạt động cũ giữ assignee/actor cũ.

### Hoạt động và bộ đếm

Ngưỡng **3** đã xác nhận; cách đếm dưới đây là D-12 **đề xuất**:

| Kết quả | Tác động bộ đếm của care round | Kết quả phiếu |
| --- | --- | --- |
| Không nghe máy | Tăng no_answer 1/lần gọi hợp lệ | Lần 1/2 Open, từ lần 3 Solved |
| Lịch hẹn được xác nhận không đến | Tăng missed_appointment 1/lịch | Lần 1/2 Open, từ lần 3 Solved |
| Đã liên hệ + đồng ý | Không tăng hai bộ đếm | Open; tạo lịch khi nhập đủ ngày giờ/nơi |
| Không đồng ý + tạm bận | Không tăng | Open; có thể lập lịch gọi lại/nhắc theo phạm vi đã chọn |
| Không đồng ý + không nhu cầu/không đủ điều kiện | Không tăng | Solved với lý do tương ứng |
| Cúp ngang | Không tự coi là không nghe máy | Open |
| Sai SĐT | Không tăng hai bộ đếm | Solved; gửi kết quả cho tiếp nhận rà soát |
| Xác nhận Lead Activated | Không tăng | Giải quyết phiếu bằng sự kiện hồ sơ |

Hai bộ đếm riêng, không cộng 2 KNM + 1 quá hẹn thành 3 KNM. Đếm tổng các sự kiện hợp lệ trong care round; cuộc gọi thành công không reset. Mở lại Solved tạo care round mới với hai bộ đếm 0, nhưng tổng lịch sử toàn phiếu không mất. Không cho thêm hoạt động vào Solved trước khi mở lại.

Ghi hai kết quả đồng thời dùng expected_version/khóa; một kết quả được ghi, bên còn lại nhận xung đột và tải lại. Gửi lại cùng request không tăng đếm lần hai. Đính chính hoạt động giữ bản gốc và tạo correction; nếu làm thay đổi bộ đếm, backend tính lại trong round, ghi audit và xác định rõ trạng thái qua command đính chính, không âm thầm mở lại phiếu đã đóng.

## 6. Lịch hẹn, chuyển người và nhắc — D-10/12

| Hành động | Điều kiện | Kết quả |
| --- | --- | --- |
| Đặt hẹn | Phiếu New/Open, đã nhận; tài xế đồng ý; giờ tương lai và trước expires_at; nơi hẹn không rỗng | Một scheduled appointment hiện hành/phiếu; gắn activity/care round |
| Hẹn lại | Lịch scheduled, phiếu còn xử lý được; giờ mới hợp lệ | Lịch cũ cancelled(reason=rescheduled), tạo lịch mới `previous_appointment_id`; hủy reminder cũ |
| Đã đến | Lịch scheduled, giờ hiện tại ≥ giờ hẹn; phiếu còn hiệu lực | attended; không tự Activated; hủy reminder chưa gửi |
| Không đến | Lịch scheduled, hiện tại > giờ hẹn; người có quyền xác nhận | missed + một activity kết quả lịch, tăng quá hẹn đúng một lần; không tự tăng vì chỉ quá giờ |
| Hủy | Lịch scheduled, có lý do | cancelled; không tăng quá hẹn |
| Mở lại Solved | Lead New và trong hạn | Round mới; không phục hồi lịch/reminder đã hủy |

Khi phiếu Solved, các lịch scheduled chưa xử lý được hủy với lý do solved, không tính missed. Khi chuyển người, mặc định hủy lịch scheduled cũ và reminder. Trưởng nhóm/Admin phải chọn **không mang lịch** hoặc **tạo lịch thay thế** trên phiếu mới; lịch thay thế tham chiếu lịch cũ và giữ giờ/nơi nếu còn trong tương lai và trong hạn mới. Nếu lịch cũ đã quá giờ, yêu cầu xử lý/hủy với lý do, không sao chép một lịch quá hạn làm lịch tương lai.

Job nhắc đề xuất chạy mỗi phút; hai mốc trước 1 giờ và đúng giờ. Nếu tạo lịch còn dưới 1 giờ, không gửi bù mốc trước 1 giờ, chỉ gửi mốc đến giờ. Mỗi `(appointment_id, reminder_kind, recipient_id)` chỉ gửi một thông báo trong app. Khi đóng/chuyển/hủy/đăng ký, reminder chờ bị hủy và file/lịch cũ theo quyền hiện hành; không tiếp tục nhắc người cũ.

Lịch quá giờ nhưng chưa xác nhận không đến chỉ xuất hiện ở nhóm quá hẹn, không tự tạo nhiều missed activity theo mỗi lần job chạy. Đây là hai khái niệm khác nhau: **cảnh báo trễ hẹn đang chờ xử lý** và **số lần không đến đã được xác nhận**.

## 7. Nhóm Nhiệm vụ và số đếm

Mỗi nhóm đếm **phiếu**, không đếm activity. Áp dụng cùng phạm vi quyền và bộ lọc nhân viên/tìm kiếm cho cả số đếm lẫn danh sách; các nhóm có thể giao nhau, không cộng tổng số nhóm thành tổng phiếu.

| Nhóm | Điều kiện đề xuất |
| --- | --- |
| Chưa giải quyết | New/Open còn trong hạn |
| Chưa nhận | New và accepted_at rỗng, còn hạn |
| Chưa liên hệ | New còn hạn, có hoặc chưa nhận |
| Đồng ý | New/Open còn hạn, activity liên hệ hợp lệ gần nhất có decision=agreed |
| Không nghe máy | New/Open còn hạn, no_answer_count > 0 trong round hiện tại |
| KNM lần 1/2 | New/Open còn hạn và bộ đếm đúng 1/2 |
| KNM lần 3 | Solved trong hạn, bộ đếm ≥3 và solved_reason=no_answer_limit; nằm trong nhóm đã giải quyết, không gắn nhãn cần gọi tiếp |
| Quá hẹn | New/Open còn hạn, có scheduled appointment quá giờ hoặc bộ đếm missed trong round >0 |
| Quá hẹn lần 1/2 | New/Open còn hạn và bộ đếm missed đúng 1/2 |
| Quá hẹn lần 3 | Solved trong hạn, missed ≥3 và solved_reason=missed_limit |
| Cập nhật gần đây | Phiếu trong phạm vi đọc, updated_at nằm trong 72 giờ gần nhất |
| Đã giải quyết | Solved còn hạn |
| Đã đóng | Closed; chỉ vai trò có quyền lịch sử thấy chi tiết, Telesale cũ không thấy |

## 8. Bàn giao Closed — D-03/10

- Tạo một closure review duy nhất cho mỗi assignment ngay khi đóng; chứa close reason, kết quả tư vấn, Lead, phiếu mới nếu chuyển việc và `review_state`.
- Tiếp nhận/Admin chọn `no_change / marked_activated / marked_onboarded / marked_closed / reopened / needs_more_info`, lý do và căn cứ khi đổi hồ sơ. Mỗi lần xử lý giữ audit; không xóa bản ghi vì không đổi trạng thái.
- Giao dịch rà soát đối chiếu version Lead hiện tại. Phiếu đóng cũ không được ghi đè kết quả đăng ký mới; nếu Lead đã Activated/Onboarded, chọn giữ nguyên hoặc bổ sung căn cứ, không lùi trạng thái.
- 08:00 UTC+7 mỗi ngày, tạo thông báo tóm tắt các phiếu đóng ngày lịch trước và số cần xử lý. Job chạy bù theo ngày chưa hoàn thành, khóa chống trùng theo ngày/người nhận; closure review đã có vẫn nhìn thấy ngay trong app.
- Tiếp nhận thấy backlog chưa rà soát từ các ngày trước. Phiếu transferred là thông tin bàn giao, không đề nghị Lead Closed.
