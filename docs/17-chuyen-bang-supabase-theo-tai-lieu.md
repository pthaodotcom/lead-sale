# Chuyển bảng Supabase theo tài liệu

Ngày áp dụng: 26/10/2026. Tham chiếu: file `Bảng CSDL.docx` do người dùng cung cấp. Migration: `20261026010000_relational_tables.sql`; schema khai báo: `29_lead_sale_relational.sql`.

## Các bảng vật lý trong public

| Bảng trong tài liệu | Bảng trên Supabase |
| --- | --- |
| Groups | groups |
| Users | users |
| Vehicles | vehicles |
| Cities | cities |
| Leads | leads |
| Leads_profile_update | leads_profile_update |
| Leads_profile_update_note | leads_profile_update_note |
| Leads_profile_update_status | leads_profile_update_status |
| Leads_profile_update_detail | leads_profile_update_detail |
| Notifications | notifications |
| Lead_assignment_tickets | lead_assignment_tickets |
| Lead_assignment_ticket_calls | lead_assignment_ticket_calls |
| Lead_assignment_ticket_inbox | lead_assignment_ticket_inbox |
| Appointment_registration_history | appointment_registration_history |
| Lead_closed_ticket_reviews | lead_closed_ticket_reviews |

Các bảng có cột nghiệp vụ riêng, khóa bigint, khóa ngoại và enum PostgreSQL. Cuộc gọi và Zalo tách thành hai bảng. Users dùng nguyên mã sales hiện có; các đối tượng trước đây dùng mã text có thêm khóa bigint và `legacy_id` để giữ nguyên tham chiếu API. Các bảng Auth, bằng chứng, nguồn, phân quyền, vòng chăm sóc và tích hợp hiện có không bị xóa.

## Phạm vi tương thích hiện tại

Đây là bước mở rộng và chuyển vị trí lưu trữ để giữ ứng dụng hoạt động, chưa loại bỏ lớp xử lý JSON cũ. Mười tài nguyên cũ chuyển nguyên vẹn sang `private.compat_*`, giữ OID, khóa ngoại, RLS, quyền và dữ liệu. Hàm `lead_*` được cập nhật tham chiếu đến lớp này. Các RPC hiện tại vẫn nhận/trả mã text và payload cũ.

Ứng dụng ghi qua RPC; trigger duy trì các bảng quan hệ trong cùng giao dịch, kể cả thay đổi hồ sơ, tài khoản, phân công, hoạt động, lịch hẹn, rà soát và thông báo. **Đồng bộ theo chiều RPC/lớp tương thích sang bảng quan hệ. Không sửa trực tiếp các bảng quan hệ bằng SQL/Table Editor để cập nhật ứng dụng.** Client authenticated chỉ có SELECT theo RLS, không có quyền ghi trực tiếp. Dữ liệu đầy đủ ngoài mẫu, bằng chứng và lịch sử cũ vẫn nằm ở các tài nguyên nội bộ có kiểm soát quyền. Chưa chuyển toàn bộ RPC sang chỉ dùng bảng quan hệ và chưa xóa các bản lưu tương thích.

## Các điều chỉnh so với mẫu

- Không tạo cột password trong users. Mật khẩu được Supabase Auth quản lý; auth_user_id liên kết tài khoản.
- Không ép text dài hiện có xuống varchar 100/200/250 và không cắt dữ liệu. PostgreSQL text hỗ trợ tiếng Việt; không dùng kiểu nvarchar riêng.
- Giữ timestamptz và các mốc activated_at, onboarded_at, first_order_id để không mất lịch sử thành công khi đóng hồ sơ.
- Rà soát chưa hoàn tất có review_result, review_basis, reviewed_at để NULL. Không gán giả ngày hoàn tất hay kết quả.
- Chiều gọi, thời lượng, trạng thái phiếu tại thời điểm liên hệ và các giá trị lịch sử không có trong nguồn cũ để NULL. Thời lượng có sẵn được tách phút và giây; chưa bổ sung cơ chế suy ra trạng thái phiếu tại từng liên hệ cũ.
- Ghi nhận các sự kiện audit cũ vào bảng lịch sử tổng. Không dựng giá trị trước sửa mà nguồn không lưu. Thay đổi hồ sơ sau migration ghi riêng các thay đổi note/status/field thực tế.
- Bổ sung trường phục vụ vận hành như legacy_id, version, trạng thái phiếu và các mốc hẹn/rà soát. Không xóa trường nghiệp vụ đang dùng vì mẫu chưa liệt kê.

## Kiểm chứng và áp dụng

- Diễn tập migration trong giao dịch rồi rollback; sau đó mới áp dụng cùng migration.
- Giữ nguyên nội dung toàn bộ bản ghi ở các tài nguyên cũ, tài khoản, vai trò và danh mục. Đối chiếu ID từng hồ sơ/phiếu/hoạt động/lịch hẹn/rà soát/thông báo; đối chiếu các giá trị nghiệp vụ Lead và khóa ngoại.
- Khi áp dụng: 97 Lead, 82 phiếu, 109 hoạt động. Số liệu này là tại thời điểm migration, không phải cam kết số lượng hiện tại.
- Snapshot RPC theo Admin, Tiếp nhận, Trưởng nhóm và Telesale khớp trước/sau trong cùng giao dịch. Sau commit, đăng nhập và đọc RPC/bảng quan hệ qua Supabase API thành công ở cả bốn vai trò; truy cập bảng Lead ẩn danh bị từ chối.
- Bộ kiểm thử local xác minh backfill, quyền, giữ mốc thành công, cập nhật ghi chú/tài khoản, lịch sử trước/sau, tạo Lead, giao phiếu, đóng phiếu và báo cáo. Không coi kiểm tra RPC/API là kiểm thử toàn bộ trình duyệt production.

Chạy diễn tập: `node scripts/lead-deploy-relational.mjs`. Áp dụng: thêm `--apply`. Script khóa thay đổi nghiệp vụ khi đối chiếu, tạo backup và SQL rollback trong thư mục ignored `.vercel-deploy/relational-rollout/`, ghi hash migration và yêu cầu PostgREST tải lại schema. Nếu đã áp dụng cùng hash, không chạy lại.

Rollback cấu trúc chỉ dùng sau khi xem xét bản SQL đã sinh và sao lưu các bảng quan hệ mới. Bản rollback tự chặn nếu đã có lịch sử thay đổi quan hệ mới; không tự xóa lịch sử sau vận hành. Mọi lỗi trong quá trình áp dụng trước commit đều rollback toàn giao dịch. Không chạy lại bootstrap hoặc thay nội dung migration đã áp dụng.

## Lỗi đóng hồ sơ

Migration `20261026000000_close_success.sql` cho phép rà soát kết quả `closed` với Lead Activated/Onboarded; giữ các mốc đăng ký, chạy đơn đầu và mã đơn. Vẫn chặn đưa Lead đã thành công về `eligible`, phiếu còn hiệu lực, sai quyền hoặc phiên bản rà soát cũ. Bản chuyển bảng giữ nguyên hành vi này.
