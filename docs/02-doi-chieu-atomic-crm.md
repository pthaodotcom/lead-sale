# Đối chiếu Atomic CRM và hướng tận dụng

> Lưu ý cập nhật **21/10/2026**: đây là bản đối chiếu upstream tại thời điểm 20/10, không phải trạng thái hiện tại của workspace. Repo đã có bản xem thử tại `app/src/components/lead-sale/`, lưu localStorage. Xem [ghi chú triển khai](03-ghi-chu-trien-khai.md) để biết phần đã có và khoảng thiếu; không cần clone lại upstream để bắt đầu. Các nhận định “chưa có” bên dưới nói về base upstream đã đọc.

Ngày kiểm tra: **20/10/2026**. Kho nguồn: [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm).

Mốc đã đọc: `b8e5e20c4dd4b9e440088621283849adf1e1839d` trên nhánh `main`. Bản clone tham khảo nằm ở `.reference/atomic-crm/`, được loại khỏi Git của workspace để tránh lồng repository. Chưa cài dependencies, chưa chạy hoặc kiểm thử ứng dụng. Các nhận định dưới đây dựa trên đọc code/schema, không phải bằng chứng runtime.

## 1. Kết luận lựa chọn base

**Atomic CRM phù hợp làm nền kỹ thuật cho đề tài.** Có thể tận dụng shell giao diện, đăng nhập, provider dữ liệu, biểu mẫu, danh sách, nhãn, file đính kèm, quản lý người dùng và nhập/xuất CSV. Phải bổ sung mô hình và workflow tuyển tài xế. Đổi tên Contacts thành Lead hoặc Deals thành phiếu phân công sẽ không đủ đáp ứng tài liệu.

Stack tại mốc đọc: React 19, TypeScript, Vite, ra-core/shadcn-admin-kit, Tailwind, React Query, React Hook Form; backend Supabase gồm PostgreSQL, Auth, REST API, Storage và Edge Functions. README yêu cầu Node 24 LTS, Make và Docker cho Supabase local; `.nvmrc` chỉ phiên bản `v24.21.0`.

## 2. Ma trận tận dụng và khoảng thiếu

Đường dẫn code dưới đây tính từ gốc bản clone Atomic CRM, không phải gốc workspace đề tài.

| Yêu cầu đề tài | Bằng chứng trong base | Nhận định/hành động đề xuất |
|---|---|---|
| Đăng nhập/đổi mật khẩu | `providers/supabase/authProvider.ts`; `supabase/functions/update_password/`; các trang `components/supabase/` | Tận dụng; xác minh lại các luồng khi chạy thật |
| Quản lý tài khoản | Bảng `sales` liên kết `auth.users`; Edge Function `users` | Tận dụng quy trình tài khoản; mở rộng vai trò nghiệp vụ |
| Phân quyền nhiều vai trò | `providers/commons/canAccess.ts` chỉ admin/user; `sales.administrator` boolean | Chưa đủ cho tiếp nhận/trưởng nhóm/Telesale/người xem báo cáo |
| Quyền Telesale chỉ đọc hồ sơ | `05_policies.sql` cho mọi authenticated user đọc/tạo/sửa/xóa contacts | Phải thay RLS và quyền giao diện; không chỉ ẩn nút sửa |
| Hồ sơ tài xế | `01_tables.sql`: contacts; `types.ts`: Contact; `contacts/` có list/create/edit/show | Tận dụng UI pattern; thêm trường nguồn, thành phố, phương tiện và trạng thái đúng miền nghiệp vụ |
| Nguồn/trạng thái Lead | contacts có status text; có configuration; chưa có LeadSource/LeadStatus riêng trong schema đã đọc | Bổ sung mô hình danh mục và quy tắc chuyển; không coi contact status hiện tại đã đáp ứng |
| Gắn nhãn | Bảng tags, contacts.tags, module `tags/` | Tận dụng, rà lại quyền quản lý nhãn |
| Chống trùng SĐT | contacts lưu phone_jsonb; import gọi create từng contact; không có unique SĐT trong `01_tables.sql` | Phải làm chuẩn hóa và kiểm tra/ràng buộc phía dữ liệu; merge contacts không thay thế chống trùng khi tạo |
| Nhập danh sách | `contacts/useContactImport.tsx`, `dataImport/`, xuất CSV | Tận dụng hạ tầng nhập CSV nhưng phải thay schema/validation/chống trùng theo Lead; .xlsx cần chốt riêng |
| Phiếu và lịch sử phân công | contacts.sales_id là người phụ trách; tasks có sales_id; chưa có Assignment riêng | Bổ sung Assignment và lịch sử; một khóa sales_id không giữ được nhiều lần phân công |
| Workflow New/Open/Solved/Closed, hạn 14 ngày | tasks chỉ có type/text/due_date/done_date; deals là nghiệp vụ cơ hội bán hàng | Cần workflow riêng, quyền chuyển và tác vụ tự đóng; không dùng task hoàn tất/chưa hoàn tất để thay phiếu |
| Activity tư vấn | contact_notes có người/ngày/text/attachments; activity_log là view tổng hợp sự kiện tạo | Tận dụng hiển thị timeline/file; thêm loại hoạt động, kết quả, phiếu, decision, reason |
| Appointment/nhắc việc | tasks có due_date | Có pattern hạn việc; schema hiện không có Appointment với nơi/giờ/kết quả hẹn riêng |
| Ghi âm/chat/Zalo | Có attachment ở notes; có Postmark inbound email | Attachment/email không chứng minh có tổng đài/Zalo; cần chốt mức tích hợp |
| Mục con Nhiệm vụ | Có module tasks và bộ lọc/danh sách theo hạn | Tận dụng pattern list/filter; bổ sung nhóm Đồng ý/KNM/quá hạn/cập nhật gần đây và số đếm đúng |
| Dashboard/báo cáo Lead | Dashboard dùng HotContacts, DealsChart, ActivityLog, TasksList | Cần KPI/phễu/báo cáo mới theo Lead tài xế; biểu đồ deals hiện tại không phải phễu Activated/Onboarded |
| AuditLog | `03_views.sql`: activity_log union company/contact/deal/note created | Chưa phải audit thay đổi trước/sau, phân công, quyền và chuyển trạng thái; phải bổ sung |
| Tiếng Việt | `src/lib/i18nProvider.ts` mặc định English; có tài nguyên ngôn ngữ khác trong repo | Cần Việt hóa nội dung phù hợp đề tài; chưa có căn cứ coi UI đã Việt hóa |

Các đường dẫn ngắn `providers/`, `contacts/`, `tasks/`, `root/` ở bảng thuộc `src/components/atomic-crm/`.

## 3. Ba loại trạng thái phải tách

| Đối tượng | Giá trị nguồn | Dùng để trả lời |
|---|---|---|
| Lead | New / Activated / Onboarded / Closed | Tài xế đang ở đâu trong vòng đời tuyển dụng? |
| Assignment | New / Open / Solved / Closed | Phiếu còn thuộc người xử lý và còn cần chăm sóc không? |
| Kết quả liên hệ/xử lý | New / Đã gọi / KNM 1–3 / Quá hạn 1–3 / Sai SĐT | Lần xử lý gần nhất và số lần chưa thành công là gì? |

Một phiếu hết hạn Closed vẫn có thể thuộc Lead New. Lead Activated có thể khiến phiếu Solved nhưng không vì vậy biến Lead thành Closed. Ánh xạ cụ thể còn cần Q-03. Các trạng thái KNM/quá hạn có thể là giá trị suy ra từ lịch sử hoặc trường nghiệp vụ riêng; chưa chốt cách lưu trước khi thống nhất quy tắc đếm.

## 4. Mô hình dữ liệu đề xuất để trao đổi

Đây là ánh xạ thiết kế dự thảo, chưa phải schema đã triển khai:

| Khái niệm yêu cầu | Hướng ánh xạ đề xuất |
|---|---|
| User | Giữ Supabase Auth và profile nhân viên; quyết định tiếp tục dùng sales hay đổi tên khi bắt đầu triển khai |
| Role | Thêm vai trò nghiệp vụ và ánh xạ user-role; ma trận quyền theo thao tác/phạm vi |
| Lead | Mở rộng contacts hoặc resource leads riêng sau khi rà tác động notes/tasks/search/import/export; chưa mặc định chọn một phương án |
| LeadSource/LeadStatus | Danh mục có mã ổn định; trạng thái phải tuân theo workflow |
| Assignment | Phiếu thuộc Lead, có người giao/nhận, thời gian tạo/cập nhật/hết hạn, trạng thái; giữ lịch sử khi chuyển việc |
| Activity | Nhiều hoạt động thuộc Lead và phiếu; lưu loại/kênh, người, thời điểm, kết quả, ghi chú, tệp nếu cần |
| Appointment | Liên kết Lead/phiếu/hoạt động; thời điểm, nơi hẹn, trạng thái/kết quả và nhắc việc |
| AuditLog | Ghi tác nhân, thời điểm, đối tượng/thao tác, thay đổi cần truy vết; ghi phía server/DB cho thao tác nghiệp vụ quan trọng |
| ImportBatch | Cân nhắc khi nhập danh sách: truy vết tệp/lô, số dòng hợp lệ/trùng/lỗi và kết quả |
| IntegrationEvent | Chỉ bổ sung nếu thực hiện tiếp nhận/tích hợp cần xử lý lại và truy vết |

Nên xử lý đổi trạng thái, chuyển phân công và ghi lịch sử một cách nguyên tử phía backend/DB, tránh cập nhật rời rạc từ frontend. Đây là đề xuất kỹ thuật nhằm đáp ứng tính nhất quán của workflow, chưa chỉ định phải dùng Edge Function hay SQL RPC cho mọi thao tác.

## 5. Ghi chú kỹ thuật phải duy trì trong quá trình code

1. **Nguồn gốc:** giữ commit upstream, LICENSE và danh sách phần tận dụng/phần tự phát triển. License trong repo là MIT; giữ thông báo bản quyền/giấy phép khi sử dụng mã nguồn.
2. **Cấu trúc:** `src/App.tsx`, `root/CRM.tsx`, layout/menu, từng module nghiệp vụ và provider. Ghi file thật khi đã triển khai, không dùng sơ đồ mong muốn làm bằng chứng code.
3. **CSDL:** schema nguồn trong `supabase/schemas/`; migrations, quan hệ, constraints, RLS, functions và dữ liệu mẫu. Theo AGENTS của base, ưu tiên sửa schema khai báo rồi tạo migration; không tùy tiện sửa migration cũ.
4. **Môi trường:** phiên bản Node/runtime, biến môi trường cần thiết, cách dựng Supabase local/remote, Auth callback, cách chạy và build. Không ghi giá trị secret vào tài liệu.
5. **API:** base gọi Supabase data provider, Auth, Storage, Edge Functions và RPC. Tài liệu API phải mô tả endpoint thật đang dùng; không tự tạo thêm REST server chỉ để có chương API.
6. **Vận hành:** mô tả cơ chế tự đóng sau 14 ngày và nhắc việc chạy được khi người dùng không mở trình duyệt; thống nhất múi giờ, lịch chạy, xử lý lặp và ghi nhận kết quả.
7. **Kiểm chứng:** mỗi phần có dữ liệu mẫu, quyền kiểm tra, kịch bản đúng/sai và bằng chứng chạy. Tách FakeRest demo khỏi Supabase thật; dữ liệu giao diện demo không chứng minh dữ liệu đã lưu DB.

Ví dụ endpoint hiện có từ code: `functions.invoke('users', {method:'POST'/'PATCH'})`, `functions.invoke('merge_contacts', {method:'POST'})`, RPC `global_search`. Đây là API của base, chưa phải danh mục API cuối cùng của đề tài.

## 6. Phạm vi giữ gọn theo đề tài

Ưu tiên Lead, phân công, tư vấn/lịch hẹn, dashboard/báo cáo và quản trị. Companies/Deals, newsletter, inbound email, MCP, SSO nhiều nhà cung cấp và các chức năng ngoài tài liệu không tự trở thành yêu cầu chỉ vì base có sẵn. Quyết định ẩn/giữ chúng khi bắt đầu triển khai để tránh sửa lan rộng trước khi biết phụ thuộc.

Đề xuất khởi đầu với tiếp nhận thủ công và nhập danh sách ở định dạng đã thống nhất, đồng thời ghi nhận tư vấn theo mức tích hợp được chọn. Không coi đề xuất này là người dùng đã đồng ý bỏ .xlsx hoặc tích hợp gọi/Zalo thật.

## 7. Bằng chứng code đã kiểm tra

Các file được đọc trực tiếp tại commit nêu trên:

- `README.md`, `AGENTS.md`, `package.json`, `.nvmrc`, `makefile`, `LICENSE.md`.
- `src/components/atomic-crm/types.ts`, `root/CRM.tsx`.
- `providers/supabase/authProvider.ts`, `providers/supabase/dataProvider.ts`, `providers/commons/canAccess.ts`.
- `contacts/useContactImport.tsx`; đối chiếu vị trí tạo hồ sơ và trường điện thoại trong `ContactCreate.tsx`/`ContactInputs.tsx`.
- `dashboard/Dashboard.tsx`, `tasks/TasksListFilter.tsx`.
- `supabase/schemas/01_tables.sql`, `05_policies.sql`, phần `activity_log` trong `03_views.sql`.
- Kiểm tra cây thư mục các modules, migrations và Edge Functions liên quan.

Các phần chưa thấy trong schema/luồng đã đọc được ghi là khoảng thiếu để thiết kế. Chưa tuyên bố đã audit toàn bộ 853 file hay xác nhận sản phẩm chạy trên máy này. Khi bắt đầu code sẽ kiểm tra môi trường thực tế và đọc thêm đúng module cần chỉnh.
