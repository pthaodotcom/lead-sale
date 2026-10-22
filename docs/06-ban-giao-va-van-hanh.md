# Lead Sale — bàn giao và vận hành

> **Bổ sung hiện trạng:** [tài liệu 08](08-ket-qua-gia-lap-core-va-khac-phuc.md) cập nhật nguồn tài xế giả lập, API Node cục bộ, schema 16…20, sửa sai/bàn giao/lô nhập/nhắc việc và kiểm chứng mới. Nội dung dưới mô tả nền Supabase đã có; các giới hạn được thay thế được ghi rõ ở phần cuối.

Cập nhật **21/10/2026**. Đây là hiện trạng đã triển khai, thay cho các nhận định “chỉ localStorage/chưa nối DB” trong ghi chú khảo sát ban đầu. Nguồn nghiệp vụ vẫn là bản chụp đủ 4 tab/8 ảnh và bộ đặc tả trong `docs/design/`.

## 1. Bản hiện tại

- Supabase Auth: đăng nhập/đăng xuất, đổi mật khẩu, 5 vai trò, tài khoản được quản trị cấp quyền/kích hoạt.
- Tiếp nhận: tạo/bổ sung, chuẩn hóa SĐT `0…/+84…`, chống trùng tại PostgreSQL, nhãn, nguồn, tra cứu/lọc, lưu trữ/khôi phục; giữ ngày và nguồn tiếp nhận đầu, lưu sự kiện bổ sung.
- CSV/XLSX: file mẫu, xem trước, kiểm tra và kết quả từng dòng; tối đa 500 dòng/5 MB. Dòng trùng dẫn tới hồ sơ để người có quyền bổ sung, không tự ghi đè.
- Hàng đợi và phân công: giao/nhận/chuyển người, một phiếu chưa Closed/Lead, phạm vi nhóm, hạn 14×24 giờ, giữ lịch sử và thu hồi quyền người cũ.
- Chăm sóc: hoạt động gọi/Zalo thủ công, quyết định/lý do, ghi chú và timeline. Lần không nghe máy thứ 3 hoặc lần không đến hẹn thứ 3 chuyển Solved. Mở lại trong hạn tạo đợt mới, giữ lịch sử cũ.
- Lịch hẹn: giờ/nơi, hẹn lại giữ lịch cũ, đến/không đến/hủy; một lịch không đến chỉ được tính một lần. Chỉ xác nhận đến/không đến khi đã tới giờ hẹn.
- Bằng chứng: ghi âm/ảnh chat/PDF trong bucket riêng, tối đa 20 MB; URL xem có hạn 60 giây, quyền dựa vào phiếu hiện tại.
- Job mỗi phút trên Supabase: tự đóng phiếu hết hạn, hủy lịch còn chờ, tạo bàn giao; nhắc trước 1 giờ/đúng giờ và thông báo rà soát sau 08:00 UTC+7. Chạy lại không tạo bản ghi trùng.
- Bàn giao Closed: lọc ngày/trạng thái rà soát; tiếp nhận xác nhận kết quả, cập nhật trạng thái Lead theo căn cứ riêng. Phiếu Closed không tự làm Lead Closed.
- Dashboard/báo cáo: truy vấn tổng hợp phía DB; lọc ngày tiếp nhận đầu, nguồn, trạng thái, người trên phiếu gần nhất. Loại lưu trữ, không đếm trùng Lead qua nhiều phiếu. Viewer/Telesale chỉ xuất tổng hợp; chi tiết có SĐT theo quyền.
- Quản trị: nguồn (thêm/sửa tên/tạm ngưng), nhóm, nhãn 4 trạng thái cố định, tài khoản/vai trò/nhóm/kích hoạt và audit.

Các module công ty, contact CRM tổng quát, deals, email, subscription và trang demo khác không xuất hiện trong ứng dụng Lead Sale. Source base được giữ lại; dependency hiện tại phục vụ ứng dụng Lead Sale.

## 2. Chạy trên máy hiện tại

Yêu cầu Node 24+ và npm. Chạy từ `app/`:

```powershell
npm ci
# Repo đã có .env.local cho project hiện tại.
# Khi dùng project khác, cấu hình lại theo .env.example.
npm run dev
```

Máy hiện tại đã cài dependency và cấu hình `.env.local`, không cần chép đè file đó. Nếu máy không có lệnh npm nhưng đã có Node và dependency, chạy `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173`, hoặc `./Start-LeadSale.ps1`. Mở `http://127.0.0.1:5173`.

Tài khoản mẫu đã cấp trong project: admin, tiếp nhận, trưởng nhóm, 2 Telesale và người xem báo cáo. Thông tin đăng nhập nằm trong **`app/.env.accounts.local`** (JSON; bị gitignore). Thông tin admin riêng ở `.env.admin.local`. Không có mật khẩu mặc định cố định trong mã nguồn. Khi chạy Vite development, mục **Tài khoản dùng thử** ở cuối form đăng nhập mặc định thu gọn; mở và chọn tài khoản để điền sẵn email/mật khẩu từ file local. Bản build production không chứa bộ tài khoản này. Danh sách được nạp qua endpoint chỉ có trong Vite development, với Cache-Control: no-store; sau khi sửa file local chỉ cần tải lại trang đăng nhập.

Chế độ xem thử: `npm run dev:demo`; dùng localStorage riêng và bộ chọn vai trò. Không đưa dữ liệu demo vào Supabase. Bản thường chỉ chạy với phiên Auth và dữ liệu từ máy chủ.

## 3. Dựng backend ở project Supabase mới

**Chỉ dùng `app/backend/supabase/`.** `app/supabase/` chứa backend Atomic CRM gốc được bảo toàn; không áp dụng migration cũ vào project Lead Sale.

1. Tạo project Supabase rỗng; cấu hình Auth theo email và tên miền sử dụng.
2. Khai báo `LEAD_DATABASE_URL` trong terminal bằng kết nối PostgreSQL của project.
3. Chạy `npm run db:generate`, rồi `npm run db:apply` từ `app/`.
4. Script áp dụng toàn bộ bootstrap trong transaction, có khóa, hash và lịch sử tại `private.lead_schema_versions`. Chạy lại cùng hash không thay đổi dữ liệu. Database đã có bảng nhưng thiếu lịch sử bị từ chối để tránh đè schema.
5. Thiết lập `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `LEAD_ADMIN_EMAIL`, `LEAD_ADMIN_PASSWORD` trong terminal; chạy `npm run db:admin` để tạo admin đầu tiên. Mật khẩu tối thiểu 10 ký tự. Script không đổi mật khẩu/quyền nếu email đã tồn tại.
6. Điền URL và publishable key vào `.env.local`; đăng nhập admin và tạo tài khoản/nhóm, cấp vai trò/kích hoạt ở Quản trị.

Nếu PostgreSQL yêu cầu CA riêng, cấu hình LEAD_DB_CA_FILE với chứng chỉ phù hợp. Các script DB hiện dùng xác minh TLS bắt buộc và đọc .env.server.local; không dùng LEAD_DB_SSL_VERIFY=false. Xem cấu hình hiện tại trong tài liệu 08.

Project hiện tại đã được cài và kiểm chứng. Các thay đổi sau bootstrap phải dùng migration tiến lên; không sửa rồi chạy lại bootstrap đã áp dụng. Không chạy `db reset` vào project đang dùng.

Tài khoản mới từ giao diện được tạo qua Supabase Auth, mặc định chưa có quyền và bị vô hiệu hóa. Admin gán vai trò và kích hoạt. Nếu project bật xác nhận email, nhân viên cần hoàn tất xác nhận email; cấu hình SMTP/giới hạn gửi theo môi trường thật. Tài khoản mẫu hiện tại đã xác nhận.

## 4. Cấu trúc và kiến trúc thật

| Đường dẫn | Vai trò |
|---|---|
| `app/src/App.tsx` | Điểm vào Lead Sale |
| `app/src/components/lead-sale/` | Giao diện, nghiệp vụ, kết nối backend |
| `backend.ts`, `context.tsx` | Auth, RPC, đọc/làm mới workspace, trạng thái tải/lỗi |
| `domain.ts`, `types.ts`, `dates.ts` | Workflow/types, chuẩn hóa ngày giờ và đồng bộ đồng hồ máy chủ |
| `store.ts`, `seed.ts` | Chỉ dùng cho chế độ demo |
| `app/backend/supabase/schemas/10_*…20_*` | Nguồn schema, command, read/report, RLS, jobs, cron và phần mở rộng giả lập/import |
| `app/backend/supabase/migrations/` | Bootstrap bất biến và các migration tiến lên |
| `app/tests/`, `app/e2e/lead-sale/`, `app/e2e/cloud/` | Kiểm thử SQL/RLS, KPI, demo và Auth/UI thật |

Luồng ghi: trình duyệt có phiên Supabase → `lead_command` → quyền từ `auth.uid()`/profile → khóa, expected version và request ID → thay đổi nghiệp vụ + audit trong một transaction. Bảng nghiệp vụ không cấp INSERT/UPDATE/DELETE trực tiếp cho client.

Luồng đọc: `lead_snapshot` dùng quyền người gọi và RLS cho từng resource; `lead_report` tự giới hạn theo vai trò/nhóm và chỉ trả tổng hợp. Viewer không nhận Lead/SĐT/hoạt động. Người cũ không đọc được hồ sơ/hoạt động/tệp sau chuyển hoặc Closed.

Schema thực tế dùng payload `data jsonb` kết hợp cột khóa sinh tự động, FK, unique và check ở PostgreSQL. Hạn phiếu/lịch có cột timestamptz riêng cho job/index. Đây là điều chỉnh so với từ điển cột đầy đủ trong thiết kế ban đầu, không phải lưu một JSON Database chung. `lead_care_rounds` và `lead_assignments.sequence` xác định đợt và thứ tự phân công khi trùng thời điểm.

Các bảng chính: `sales`, `lead_user_roles`, `lead_roles`, `lead_teams`, `lead_statuses`, `lead_sources`, `leads`, `lead_assignments`, `lead_care_rounds`, `lead_activities`, `lead_appointments`, `lead_receptions`, `lead_closure_reviews`, `lead_notifications`, `lead_attachments`, `lead_audit_logs`. Quan hệ: Lead → nhiều phiếu → nhiều đợt/hoạt động/lịch; mỗi hoạt động có nhiều tệp; mỗi phiếu Closed có một bàn giao. Auth user → sales → vai trò và nhóm. ERD khái niệm xem `design/02-du-lieu-va-api.md`; tên/cột vật lý chính xác theo SQL.

## 5. API đang dùng

Các endpoint Supabase `/rest/v1/rpc/...`, cần publishable key và Bearer access token:

| RPC | Payload | Kết quả |
|---|---|---|
| `lead_snapshot` | `{}` | actor, serverTime, các resource trong phạm vi, catalog và báo cáo tổng |
| `lead_command` | `p_command`, `p_request_id` UUID, `p_expected_version` khi sửa bản ghi | `{ok:true}`; lỗi trả thông điệp nghiệp vụ |
| `lead_report` | `p_filters:{from,to,source,status,member}` | tổng Lead, đăng ký, đơn đầu, quá hẹn, mới hôm nay và nhóm nguồn/trạng thái/nhân viên |
| `lead_people` | `{}` | roster tối thiểu; email chỉ cấp cho admin |
| `lead_run_jobs` | `{}` | Chỉ scheduler/service_role; không cho tài khoản ứng dụng gọi |
| `lead_simulator` | `p_command` | Dữ liệu tài xế/đơn/outbox nguồn và đối soát; quyền Admin/Tiếp nhận theo thao tác |
| `lead_import` | `p_command` | Tạo/xem/tiếp tục lô nhập và kết quả từng dòng |

`p_command.type`: `saveLead`, `leadStatus`, `archiveLead`, `assign`, `accept`, `ticketStatus`, `activity`, `appointment`, `reschedule`, `review`, `noticeRead`, `attachment`, `source`, `team`, `statusLabel`, `member`. Hình dạng payload cụ thể tại `types.ts`. API thực tế là RPC theo bảng trên; các endpoint REST minh họa trong đặc tả ban đầu không phải endpoint đã cung cấp.

Gửi lại cùng request ID/nội dung chỉ thực thi một lần; cùng ID khác nội dung bị từ chối. Sửa trên version cũ bị từ chối và yêu cầu tải lại. Ngày giờ từ `datetime-local` được đổi sang ISO UTC trước khi gửi; UI đồng bộ với `serverTime` để tránh lệch đồng hồ thiết bị.

Auth dùng API của Supabase; file dùng bucket `lead-evidence` riêng. Client không cần secret key. Không đưa PostgreSQL DSN, mật khẩu hoặc secret/service_role vào biến `VITE_*`, bundle, Git hoặc log.

## 6. Job, phát hành và vận hành

Cron `lead-sale-every-minute` chạy `select public.lead_run_jobs()` mỗi phút. Kiểm tra bằng tài khoản DB quản trị:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname='lead-sale-every-minute';
select status, return_message, start_time from cron.job_run_details
order by start_time desc limit 10;
```

Lỗi job: xử lý nguyên nhân, gọi lại `lead_run_jobs` bằng scheduler/quản trị. Hết hạn/due reminder có xử lý bù; đã hủy/hẹn lại không được nhắc cho lịch cũ. Thông báo hằng ngày tạo sau 08:00 theo ngày UTC+7 nếu còn bàn giao ngày trước chưa rà soát. Tắt trình duyệt không ảnh hưởng job. PostgreSQL không có `pg_cron` cần scheduler ngoài gọi hàm bằng quyền tin cậy.

Build và chạy bản sản phẩm:

```powershell
npm run build
npm start
```

Mặc định `http://127.0.0.1:4173`. Server chỉ phục vụ `dist/`; không công khai `.env` hoặc mã nguồn. Khi đặt sau reverse proxy HTTPS, cấu hình `HOST`/`PORT` phù hợp. Có thể đưa `dist/` lên static hosting HTTPS. URL và publishable key được chốt lúc build; đổi project cần build lại. Router dùng hash nên không cần SPA rewrite. Cập nhật Auth Site URL/redirect allowlist nếu dùng luồng xác nhận email trên tên miền mới.

Máy hiện tại dùng frontend cục bộ và Supabase cloud. **Chưa phát hành frontend lên tên miền công khai**, chưa có môi trường hosting do người dùng chọn. Nguồn/base/license vẫn được giữ; các thay đổi được quản lý trên Git, xem lịch sử bằng `git log`.

## 7. Kiểm chứng

- Unit/PostgreSQL: **63 ca** gồm 13 domain, 37 SQL/RLS/workflow/nguồn/import, 2 ngày giờ và 11 fixture KPI. SQL chạy bằng PostgreSQL WASM (PGlite), tải chính schema ứng dụng; Auth/Storage chỉ mô phỏng phần nền trong nhóm test đó.
- Trình duyệt demo: tạo → phân công → tư vấn/hẹn → reload; trùng SĐT; giới hạn Telesale; xuất báo cáo; mobile; nhập CSV và XLSX với dòng hợp lệ/trùng/lỗi.
- Trình duyệt Supabase thật: admin tạo hồ sơ/giao phiếu/ghi tư vấn; Telesale nhận việc/ghi tư vấn; tải lại giữ dữ liệu; viewer chỉ xuất tổng hợp và bị chặn danh sách Lead; quản trị và mobile. Tài khoản dùng từ file local bị gitignore.
- API/DB cloud: đã kiểm tra trực tiếp 5 vai trò, thu hồi quyền nhân viên cũ/tệp sau chuyển, threshold/mở lại và expected version. Hai request tạo cùng SĐT đồng thời chỉ tạo một Lead, request còn lại báo trùng.
- Cron cloud: đã xác nhận các lần chạy thành công trong `cron.job_run_details`.
- Các kiểm tra phát hành: typecheck, lint, build; ảnh dashboard/mobile đã được xuất từ browser test.

Chạy lại từ `app/`: `npm test`, `npm run test:e2e`, `npm run test:e2e:cloud`, `npm run typecheck`, `npm run lint`, `npm run build`. Test cloud tạo dữ liệu giả có tên “Kiểm thử giao diện…”, giữ lịch sử/audit. Có thể lưu trữ sau nghiệm thu; không dùng SĐT khách hàng thật.

## 8. Kịch bản demo và giới hạn hiện tại

1. Tiếp nhận tạo Lead, thử +84 trùng rồi mở hồ sơ bổ sung; kiểm tra nguồn/ngày đầu.
2. Trưởng nhóm mở Chờ phân công, giao Telesale; Telesale nhận việc.
3. Ghi kết quả cuộc gọi/Zalo, đính kèm bằng chứng, tạo/hẹn lại/cập nhật lịch.
4. Không nghe máy 3 lần → Solved; mở lại trong hạn → bộ đếm đợt mới. Chuyển người → phiếu cũ Closed, người cũ mất quyền.
5. Tiếp nhận mở Bàn giao Closed, rà soát; xác nhận Activated rồi Onboarded theo căn cứ.
6. Đối chiếu dashboard/báo cáo; đổi nguồn/ngày/nhân viên; viewer xuất tổng hợp không có SĐT.

Hiện tại cuộc gọi/Zalo ghi nhận thủ công; đăng ký/đơn đầu có nguồn giả lập qua API hoặc xác nhận thủ công có căn cứ, chưa kết nối nhà cung cấp thật. Nhập file đã có lịch sử lô/dòng, tiếp tục/retry và ngày lịch sử. Nhắc vẫn trong ứng dụng, chưa gửi SMS/email/Zalo. Snapshot tải toàn bộ dữ liệu **trong quyền**, chưa có phân trang server cho tải lớn. Upload có finalize/retry; tệp bỏ dở có thể cần Admin dọn, chưa có job tự dọn. Signed URL đã cấp có hiệu lực tối đa 60 giây sau đổi quyền. Recovery đã có UI, chưa nghiệm thu giao thư/redirect bằng email thật. Bằng chứng bổ sung và API nguồn xem tài liệu 08; chưa public hosting hoặc chứng nhận restore toàn bộ môi trường.

Tận dụng base: React/Admin/router, thành phần UI/form, typography và cấu trúc Supabase/Auth. Tự phát triển: toàn bộ domain Lead Sale, workflow/roles/teams, RPC/RLS/schema/job, import, bằng chứng, báo cáo và kiểm thử. Giữ `app/LICENSE.md` theo MIT và ghi công Atomic CRM.
