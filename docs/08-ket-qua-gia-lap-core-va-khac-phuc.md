# Kết quả triển khai giả lập core và sửa nghiệp vụ

Cập nhật 21/10/2026. Đây là hiện trạng thực thi của [kế hoạch 07](07-ke-hoach-gia-lap-core-va-khac-phuc.md), bổ sung bản bàn giao 06. Quy trình nguồn vẫn giữ nguyên; các lựa chọn mô phỏng là phạm vi người dùng đã bổ sung.

## 1. Cách mở và thử

- Web đang dùng: `http://127.0.0.1:5173/` → đăng nhập Admin → **Tài xế giả lập**.
- Trang nguồn: `/#/core-simulator`; đối soát dành cho Admin/Tiếp nhận: `/#/integrations`.
- Chọn/tạo tài xế nguồn. Chọn Lead cùng SĐT và **Xác nhận liên kết để thử**. Đây là bước cho phép hồ sơ nhận dữ liệu mô phỏng; không tự liên kết theo tên.
- Chọn Chờ duyệt → Lead giữ New; Hoàn tất đăng ký → Activated; Hoàn thành đơn đầu với mã đơn và thời điểm sau đăng ký → Onboarded.
- Bấm **Gửi lại cùng bản tin**: tăng nhật ký tiếp nhận, giữ một mốc kết quả. Xem chi tiết sự kiện, giờ thực tế, giờ nhận, giờ xử lý và lý do.
- Nếu chưa có liên kết, bản tin chờ đối soát. Liên kết xong thì gửi/xử lý lại. Đơn đầu đến trước đăng ký được xử lý lại sau khi nhận đăng ký hợp lệ.

Tài xế không đăng nhập Lead Sale. Nhân viên vẫn gọi/chat bên ngoài rồi ghi nhận thủ công; không có Telegram hoặc tự đồng bộ liên lạc. Đây là **nguồn giả lập**, chưa phải kết nối ứng dụng giao hàng thật.

## 2. Những phần đã sửa

| Phần | Hành vi hiện tại |
| --- | --- |
| Nguồn kết quả | Dữ liệu tài xế, đơn, outbox nguồn tách khỏi inbox/bộ xử lý Lead. Có API HTTP nhận với khóa nguồn phía máy chủ |
| Liên kết | Mã tài xế nguồn ổn định, SĐT chuẩn hóa, xác nhận Admin; không ghi đè liên kết đã có sang hồ sơ khác |
| Chống trùng | Cùng eventId/nội dung không thêm milestone; cùng ID khác nội dung bị từ chối và có nhật ký |
| Thứ tự và ngày | Giữ ngày xảy ra/nhận/xử lý riêng; chờ đăng ký khi thiếu; đơn thực sự trước đăng ký là xung đột; không lùi mốc đã có |
| Hồ sơ đóng/lưu trữ/đính chính | Bản tin được giữ để đối soát, không tự mở hồ sơ hoặc ghi đè đính chính |
| Tác động workflow | Kết quả nguồn giải quyết phiếu New/Open và hủy lịch đang chờ cùng transaction; giữ hoạt động cũ |
| Tiếp nhận | Chỉnh hồ sơ không thêm reception. **Ghi nhận một lần tiếp nhận mới** là thao tác riêng, giữ nguồn/ngày đầu |
| Kết quả thủ công | Có ngày thực tế, người/căn cứ; tách nguồn thủ công với nguồn giả lập. Có luồng đính chính riêng |
| Sửa sai | Hủy tính Activity, đính chính kết quả lịch/milestone có lý do và audit. Không xóa hoạt động; không tự mở lại Solved/Closed hoặc lịch đã hủy |
| KNM và chat | Chỉ cuộc gọi no_answer tăng KNM. Zalo dùng **Chat chưa phản hồi**, không tăng KNM. Ngưỡng lần 3 vẫn Solved |
| Bàn giao | Kết quả có cấu trúc, expected version, chống ghi đè. Đính chính rà soát lưu phiên bản trước và lý do |
| Phân công lại | Chặn khi bàn giao còn chờ hoặc kết quả follow_up/closed. Tiếp nhận đính chính đủ điều kiện rồi phân công lại; transfer vẫn đóng cũ/tạo mới |
| Lịch sử bàn giao | Telesale đang phụ trách được đọc lịch sử Lead cần chăm sóc, kể cả phiếu trước. Không được sửa phiếu của người trước; người cũ mất quyền |
| Đồng hồ | Nhóm phiếu, lịch, hàng đợi, dashboard và số việc chờ dùng giờ máy chủ để kiểm tra hạn |
| Lô nhập | Lưu lô/dòng/kết quả trên DB; tối đa 500 dòng/5 MB; trùng trong file được đánh dấu; tiếp tục/thử dòng lỗi sau reload; giữ ID từng dòng |
| Ngày lịch sử | Cột receivedAt tùy chọn khi nhập file, kiểm tra không ở tương lai; milestone lịch sử giữ đúng ngày, không thay ngày nhận |
| Báo cáo | Giữ cohort theo ngày tiếp nhận đầu, chủ gần nhất, loại lưu trữ; bổ sung nguồn xác nhận giả lập/thủ công/chưa rõ căn cứ cũ và các mốc thực tế trong chi tiết/CSV |
| Lưu và làm mới | Phân biệt đã commit với lỗi refresh. Thử lại lệnh mất phản hồi giữ request ID trong phiên; không mặc định tạo hoạt động mới |
| Bằng chứng | Điều kiện upload khớp quyền backend; giữ tệp đã upload để thử finalize lại khi gắn metadata lỗi |
| Nhắc việc | Thông báo có tài xế/lịch, đường dẫn xử lý; có trang xem thông báo, đánh dấu đã đọc |
| Tài khoản | Có màn hình yêu cầu liên kết và đặt mật khẩu mới bằng luồng recovery Supabase. Việc giao thư chưa nghiệm thu trên email thật |

Các mốc chuyển đổi không được nhập tắt bằng cột status trong file. Danh mục nguồn/nhóm/nhãn trạng thái tiếp tục dùng quản trị hiện có; thành phố là trường nhập, phương tiện giữ Van/Motorbike theo phạm vi nguồn.

## 3. Kiến trúc, API và quyền

Frontend dùng lại nền React/Admin/router hiện có. `CoreSimulator.tsx` là trang nguồn; `Corrections.tsx` hiển thị căn cứ và sửa sai; `Notices.tsx` là hộp thông báo. Backend Lead đang dùng vẫn tại `app/backend/supabase/`, không phải backend Atomic gốc.

Luồng thực thi:

`UI nguồn → POST /api/simulator/command → Supabase lead_simulator (quyền người gọi) → tài xế/đơn + outbox → HTTP nhận có khóa nguồn → private.lead_core_receive → inbox/milestone/workflow/audit → snapshot/report`.

Node API chỉ bind loopback `127.0.0.1:5180`; Vite proxy `/api/`. Trình duyệt chỉ mang access token của nhân viên. Khóa nguồn/DSN không vào `VITE_*` hoặc bundle. RPC không cấp cho Telesale/viewer quyền tạo nguồn/liên kết; hàm nhận private không có quyền execute cho client. Nguồn lỗi vẫn có outbox để gửi lại.

| API | Xác thực / payload | Kết quả |
| --- | --- | --- |
| `GET /api/core/health` | Không có dữ liệu nghiệp vụ | Tình trạng API/DB, nhãn driver-simulator |
| `POST /api/simulator/command` | `Authorization: Bearer <access token>`; JSON nghiệp vụ | Admin thao tác nguồn; Admin/Tiếp nhận snapshot/retry. Vai trò lấy từ DB |
| `POST /api/integrations/driver-core/events` | `X-Lead-Source-Key: <server secret>`; JSON sự kiện | processed, ignored, waiting_link, waiting_registration, conflict, rejected; ID collision trả 409 |
| Supabase RPC `lead_simulator` | `p_command` | Dữ liệu nguồn/outbox hoặc dữ liệu đối soát, không trực tiếp đổi nhãn Lead |
| Supabase RPC `lead_import` | `p_command:{type:create/list/get/row,...}` | Lô, dòng và kết quả đã lưu; quyền theo người nhập/Admin |
| Supabase RPC `lead_command` | Hợp đồng cũ + command mới trong types.ts | Thêm receiveLead, correctMilestone, voidActivity, correctAppointment, amendReview; review có expected version |

Thao tác nguồn: createDriver `{name,phone,requestId?}`, link `{driverId,leadId}`, emit `{driverId,eventType,occurredAt,orderId?,requestId}`, resend/retry `{eventId}`, snapshot. UI giữ requestId khi thử lại thao tác chưa nhận phản hồi.

Ví dụ sự kiện nhận (số và mã là dữ liệu minh họa):

```json
{
  "sourceSystem": "driver-simulator",
  "eventId": "test-event-unique-id",
  "externalDriverId": "DRV-example",
  "phone": "0901234567",
  "eventType": "first_order_completed",
  "occurredAt": "2026-10-21T10:00:00+07:00",
  "orderId": "ORDER-example"
}
```

Các bảng private mới: lead_sim_drivers, lead_sim_orders, lead_core_links, lead_sim_outbox, lead_core_events, lead_core_attempts. Lô nhập mở rộng lead_import_batches. Milestone và căn cứ được giữ trong payload Lead; sửa sai có audit và giữ sự kiện gốc. Kết quả cũ không có căn cứ được xếp **chưa rõ căn cứ**, không tự coi đã được core xác minh.

## 4. Chạy và nâng cấp DB

Node 24+, từ thư mục `app/`:

```powershell
npm ci --legacy-peer-deps
npm run dev:core
```

Giữ terminal API, mở terminal thứ hai chạy `npm run dev`. Web mặc định 5173, API 5180. Chế độ `dev:demo` vẫn độc lập; giả lập nguồn cần Supabase/API, không giả vờ chạy trong localStorage.

File riêng `.env.server.local` được Git bỏ qua, chứa LEAD_DATABASE_URL và đường dẫn LEAD_DB_CA_FILE nếu project dùng CA riêng. Có thể cấu hình LEAD_CORE_SOURCE_KEY; nếu không, dịch vụ tự tạo khóa ngẫu nhiên cho lần chạy và giữ trong bộ nhớ. LEAD_WEB_ORIGIN mặc định `http://127.0.0.1:5173`. `.env.local` chỉ chứa URL/publishable key công khai.

Kết nối DB dùng TLS với xác minh chứng chỉ; CA Supabase theo [hướng dẫn SSL](https://supabase.com/docs/guides/platform/ssl-enforcement). Không cần tắt kiểm tra TLS để chạy cấu hình hiện tại.

DB trống: `npm run db:apply`, sau đó `npm run db:migrate`. DB hiện tại: **chỉ db:migrate**. Không replay bootstrap/reset project. Các version đã áp dụng:

- 20261021000000: bootstrap cũ, giữ nguyên file.
- 20261021010000: workflow, nguồn giả lập, import và nhắc việc.
- 20261021020000: phân loại nguồn xác nhận trên báo cáo.

Runner kiểm tra hash (chấp nhận khác biệt CRLF/LF), chạy trong transaction, lưu bản chụp resource cục bộ bị Git bỏ qua và đối chiếu từng resource trước/sau. Lần nâng cấp đầu giữ nguyên **10 Lead, 12 phiếu, 16 hoạt động** và toàn bộ dữ liệu resource cũ. Lần nâng cấp báo cáo cũng giữ nguyên resource tại thời điểm chạy. Đây là bằng chứng bảo toàn khi migration, **không phải chứng nhận phục hồi toàn bộ Supabase/Auth/Storage**.

Schema nguồn gồm 10…20; 15 là cấu hình cron riêng. `db:generate` kiểm tra/sinh các file version cố định, không ghi đè file đã khác nội dung. Mọi thay đổi SQL tiếp theo phải có version tiến lên mới.

## 5. Kiểm chứng và giới hạn bằng chứng

- **63 unit/SQL/domain/KPI/ngày giờ**: dùng PGlite với schema 10…20, bỏ phần cài cron. Có các nhánh SIM-01…14: chờ duyệt/nhận/hủy, đăng ký, đơn đầu, gửi trùng/collision, liên kết, sai thứ tự/ngày, đến muộn, hồ sơ đóng/lưu trữ/đính chính, quyền và tác động phiếu/lịch. Auth/Storage nền trong nhóm SQL là scaffolding.
- **7 E2E demo**: giữ các luồng nhân viên, nhập CSV/XLSX, quyền, báo cáo và mobile.
- **2 E2E cloud cũ**: Admin/Telesale/viewer, workflow, reload, quản trị và mobile trên Supabase hiện tại.
- **3 E2E nguồn/retry cloud**: thao tác UI nguồn → HTTP → Supabase thật, resend không tăng version/mốc, reload, đối soát, mobile và chặn Telesale. Ca mất phản hồi sau commit kiểm tra giữ request ID/không nhân đôi hoạt động. Tổng cộng 12 kịch bản trình duyệt đã qua.
- Ảnh desktop/mobile, trạng thái mở chi tiết/lỗi mạng và recovery nằm trong artifact QA cục bộ. Review giao diện độc lập đã trả ship cho phần mở rộng giả lập, giữ nguyên hệ giao diện hiện có.

Các nhánh lỗi SQL không đồng nghĩa đã chạy mọi nhánh qua HTTP/đối tác thật. Recovery form đã kiểm tra hiển thị và đăng xuất; **chưa gửi/nhận thư và đổi mật khẩu bằng email thật**, vì bộ tài khoản hiện tại dùng miền .local. Cần SMTP, Site URL/redirect allowlist đúng địa chỉ triển khai và hộp thư thật để nghiệm thu phần đó. Không gửi email kiểm thử tới người khác trong đợt này.

## 6. Vận hành và phần chưa triển khai

- Cron cloud lead-sale-every-minute đang ACTIVE, mỗi phút gọi lead_run_jobs; ba lần đọc gần nhất 22:35/22:36/22:37 ngày 21/10/2026 (UTC+7) đều succeeded. Xem cron.job và cron.job_run_details theo runbook 06. Kiểm tra cả kết quả thực thi, không suy từ timer giao diện.
- Tệp upload xong nhưng chưa gắn metadata: dùng **Thử lưu liên kết tệp**. Nếu đóng trang giữa chừng, Admin đối chiếu storage.objects với lead_attachments và xóa bằng Storage API/Dashboard khi chắc chắn không có metadata/yêu cầu đang xử lý. Không xóa trực tiếp hàng storage.objects để giả vờ đã xóa object.
- Snapshot vẫn tải dữ liệu trong quyền; chưa phân trang server/thu hẹp global write lock cho tải lớn. Lô nhập giảm từ refresh mỗi dòng thành một lần cuối lô.
- Chưa có job tự dọn tệp mồ côi, kiểm thử phục hồi toàn bộ môi trường, gửi nhắc ngoài ứng dụng, XLSX export, chốt kỳ/as-of, quy công đa nhân viên, mapper file mọi định dạng hoặc gộp/tách danh tính phức tạp.
- Chưa public hosting. `npm start` hiện phục vụ frontend build; để dùng API nguồn sau hosting cần reverse proxy `/api/` tới dịch vụ và cấu hình origin. Không coi static hosting riêng là đã phát hành đầy đủ API giả lập.
- Không reset hay ghi đè dữ liệu cũ để demo. Bản ghi E2E mới có tên/nhãn dữ liệu giả; lưu trữ sau kiểm thử, giữ audit. Khóa và mật khẩu không ghi trong tài liệu/Git.

Kiểm tra cuối: typecheck/lint/build qua; bundle được rà soát không chứa DSN/mật khẩu tài khoản kiểm thử. Đối chiếu lại toàn bộ các resource gốc với bản chụp trước migration đều còn nguyên. Đã chuẩn bị riêng **Tài xế mẫu giả lập** ở trạng thái New, liên kết nguồn để người dùng tự thử; đây là dữ liệu giả có nhãn demo-simulator.

Các mục ngoài bản tối thiểu ở kế hoạch 07 tiếp tục giữ nguyên. Các điểm phụ thuộc môi trường được nêu rõ ở đây; không đánh dấu cả 41 điểm là hoàn tất hoặc coi mô phỏng là tích hợp core thật.
