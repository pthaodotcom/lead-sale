# Kế hoạch triển khai tiếp Lead Sale

> **Cập nhật triển khai 21/10/2026:** người dùng đã yêu cầu “OK triển khai” và tiếp tục hoàn thiện sản phẩm. M1/M2 đã có dữ liệu Supabase thật; các checkbox dưới đây phản ánh mã đã triển khai. Bằng chứng và điều chỉnh so với kế hoạch nằm tại [bàn giao/vận hành](06-ban-giao-va-van-hanh.md). Giao diện dùng frontend cục bộ + Supabase cloud; P8.4 (frontend public hosting) còn chờ đích triển khai. P2.1 đã có DB/Auth/Storage, chưa có tên miền public; P8.2 đã kiểm tra desktop/mobile/quyền URL, chưa kiểm tra đủ mọi biến thể offline/SMTP/hosting. Các đoạn mô tả hiện trạng ban đầu bên dưới được giữ làm lịch sử.

Ngày lập: **21/10/2026** (UTC+7). Trạng thái: **đang làm bước 1: đã có bộ thiết kế dự thảo, ngưỡng lần 3 → Solved đã được người dùng xác nhận; các quyết định nghiệp vụ khác còn chờ xác nhận**. Chưa chạy bước 0 hoặc triển khai bước 2 trở đi. Xem [đặc tả bước 1](05-dac-ta-buoc-1.md).

Căn cứ: [yêu cầu R/FR/Q](01-yeu-cau-de-tai.md), [ghi chú đọc đủ 4 tab và đối chiếu app](03-ghi-chu-trien-khai.md), [bản chụp nguồn 21/10](sources/google-doc-2026-10-21.md). Phát triển tiếp trong `app/` trên nền Atomic CRM và module Lead Sale hiện có.

## 1. Điểm xuất phát và nguyên tắc thực hiện

- App đã có màn hình và logic demo cho hồ sơ, phân công, tư vấn, lịch hẹn, dashboard/báo cáo, quản trị. Dữ liệu nghiệp vụ lưu localStorage; đổi người dùng qua bộ chọn demo.
- Chưa xác nhận app chạy, build và các test hiện có trên máy này. Kiểm tra sơ bộ ngày 21/10: có lệnh `node` và `git`; chưa tìm thấy `npm`, Docker, Make trên PATH; `app/node_modules` chưa có, `app/package-lock.json` có. Chưa kết luận các công cụ hoàn toàn chưa được cài.
- `.nvmrc` của repo ghi `v24.21.0`. Xác minh runtime thực tế và cách cài dependency trước khi chạy.
- Tận dụng UI, router, form, Auth/data provider của base khi phù hợp. Mỗi đợt nối trọn một luồng từ UI đến DB và kiểm tra quyền, thay vì nối DB xong mới xử lý quyền.
- Audit, tài liệu và dữ liệu mẫu được bổ sung cùng mỗi chức năng. Demo localStorage chỉ là tài liệu tham khảo hành vi; test demo không chứng minh Auth/RLS hoặc dữ liệu thật đã đúng.
- Không ước lượng ngày hoàn tất khi chưa chạy base, chọn môi trường và xác định phạm vi tích hợp. Sau bước 0–1 mới có đủ căn cứ chia lịch theo deadline ở Q-13.

## 2. Thứ tự và phụ thuộc

| Bước | Mục tiêu | Phụ thuộc | Mốc kiểm chứng |
| --- | --- | --- | --- |
| 0 | Chạy và kiểm tra base | Không | Demo chạy, có kết quả build/typecheck/test và danh sách lỗi nền |
| 1 | Chốt quy tắc và thiết kế | Làm cùng bước 0 | Có ma trận quyền, chuyển trạng thái, dữ liệu và quyết định phạm vi |
| 2 | Nền Supabase/Auth/quyền/audit | 0; phần thiết kế liên quan ở 1 | Đăng nhập thật, quyền DB/API đúng, có cách dựng lại môi trường |
| 3 | Tiếp nhận và hồ sơ Lead | 2; quyết định tiếp nhận/import | Tạo/bổ sung/import Lead thật, chống trùng, hàng đợi trưởng nhóm |
| 4 | Phân công và vòng đời phiếu | 3; quy tắc phiếu đã chốt | Giao/nhận/chuyển/mở lại/đóng giữ lịch sử và đúng quyền |
| 5 | Tư vấn, bằng chứng và lịch hẹn | 4; phạm vi ghi âm/chat | Activity, kết quả, hẹn/hẹn lại và nhóm nhiệm vụ dùng dữ liệu DB |
| 6 | Tác vụ nền và bàn giao Closed | 4–5; quy tắc thời gian/nhắc | Tự đóng/nhắc/bàn giao chạy khi không mở trình duyệt |
| 7 | Dashboard và báo cáo thật | 3–6; định nghĩa KPI từ 1 | Số liệu khớp chi tiết, lọc và xuất dữ liệu đúng quyền |
| 8 | Kiểm thử toàn luồng và bàn giao | 2–7 | Bản triển khai chạy được, dữ liệu mẫu, hướng dẫn và demo |

Thứ tự ưu tiên là **nền chạy được → quyền/dữ liệu thật → nghiệp vụ → tự động hóa → báo cáo → nghiệm thu**. Công thức báo cáo và yêu cầu tích hợp phải thiết kế từ bước 1, dù hiện thực màn hình báo cáo ở bước 7.

## 3. Công việc theo bước

### Bước 0 — Chạy và kiểm tra base

- [x] P0.1 Xác minh Node/npm và cách dùng trên Windows; tìm runtime đã có trước khi cài thêm. Kiểm tra Docker/Supabase CLI hoặc môi trường DB phát triển khả dụng.
- [x] P0.2 Cài dependency từ lockfile, tuân thủ `.npmrc`; kiểm tra script thực tế thay vì giả định mọi lệnh Make chạy được trên Windows.
- [x] P0.3 Chạy typecheck, build, unit test Lead Sale; mở demo và kiểm tra các luồng chính. Chạy e2e Lead Sale hiện có nếu môi trường đáp ứng; ghi rõ test nào chưa chạy và lý do.
- [x] P0.4 Ghi kết quả nền và phân loại lỗi phải sửa để tiếp tục. Kiểm tra các script Supabase có sẵn trước khi tái sử dụng; script remote hiện chứa thao tác tạo project và đẩy DB nên không phải lệnh chẩn đoán môi trường.

**Hoàn thành khi:** có cách chạy tái hiện được, kết quả kiểm tra rõ ràng và danh sách lỗi nền; không coi chỉ mở được giao diện là đã xong backend.

### Bước 1 — Chốt nghiệp vụ và thiết kế dữ liệu

- [x] P1.1 Đã lập ma trận vai trò × thao tác × phạm vi dữ liệu, gồm nhóm và quyền lịch sử sau Closed; ma trận nghiệp vụ chờ D-06.
- [x] P1.2 Đã lập bảng chuyển trạng thái riêng cho Lead/Assignment/lịch hẹn, điều kiện và tác động; ngưỡng lần3 đã xác nhận, các cạnh/điều kiện khác ở dạng đề xuất.
- [x] P1.3 Đã soạn phương án tiếp nhận lại, phiếu đồng thời/chuyển người, hạn, đếm/reset và bàn giao; chờ chốt D-02…05/12.
- [x] P1.4 Đã soạn bộ trường, lưu trữ, nhập CSV/XLSX, gọi/Zalo/file và kênh nhắc; chờ xác nhận D-07/08/10/11/13.
- [x] P1.5 Đã đề xuất công thức KPI/bộ lọc/quy công và chuẩn bị fixture/kết quả dự kiến; công thức nghiệp vụ còn chờ D-09.
- [x] P1.6 Đã viết ERD, từ điển/ràng buộc và hợp đồng API dự thảo; chọn resource Lead riêng, giữ Auth/profile/UI của base. Chưa có schema/API mới chạy thật.

Đầu ra: [đặc tả và sổ quyết định](05-dac-ta-buoc-1.md), [quyền/workflow](design/01-quyen-va-workflow.md), [dữ liệu/API](design/02-du-lieu-va-api.md), [KPI/nghiệm thu](design/03-kpi-va-nghiem-thu.md). Checkbox đánh dấu đầu ra đã soạn không đồng nghĩa toàn bộ quyết định nghiệp vụ đã được duyệt.

**Hoàn thành khi:** từng quy tắc có trạng thái đã xác nhận hoặc còn mở; phần chưa rõ không bị hard-code như yêu cầu đã duyệt. Có thể tiếp tục phần nền không phụ thuộc trong lúc chờ quyết định.

### Bước 2 — Supabase, đăng nhập, phân quyền và audit

- [ ] P2.1 Chọn môi trường phát triển và đích triển khai; cấu hình biến môi trường mẫu, Auth callback, CSDL và Storage theo phạm vi đã chọn.
- [x] P2.2 Thiết lập schema nền, khóa/quan hệ/index và chính sách quyền. Tuân thủ `app/AGENTS.md`: sửa schema khai báo rồi tạo migration; các bảng nghiệp vụ được bổ sung theo từng đợt.
- [x] P2.3 Tái sử dụng luồng Auth của base: đăng nhập/đăng xuất/đổi mật khẩu, profile, tài khoản và vai trò thật; thay cơ chế chọn actor demo trong luồng dùng DB thật.
- [x] P2.4 Tạo lớp truy cập dữ liệu để chuyển từng module từ store cục bộ sang Supabase, xử lý loading/lỗi/phiên hết hạn và làm mới dữ liệu sau thay đổi.
- [x] P2.5 Thiết lập audit phía server; command nghiệp vụ và nhật ký cùng nằm trong giao dịch. Quyền actor lấy từ phiên xác thực, không tin role/actorId do trình duyệt gửi lên.
- [x] P2.6 Chuẩn bị tài khoản mẫu và kiểm tra trực tiếp DB/API với từng vai trò, gồm đọc/sửa dữ liệu ngoài phạm vi và tự nâng quyền.

**Hoàn thành khi:** xác thực thật hoạt động, sai quyền bị DB/API từ chối và migration/seed có thể dựng lại môi trường phát triển.

### Bước 3 — Hồ sơ và tiếp nhận Lead (FR-01/02, R-02…06)

- [x] P3.1 Nối form, danh sách, chi tiết, nguồn/nhãn và trạng thái Lead với DB; giữ bố cục hiện có khi phù hợp.
- [x] P3.2 Chuẩn hóa SĐT và ràng buộc chống trùng phía DB, gồm hai người tạo đồng thời. Khi trùng, dẫn tới hồ sơ hiện có để bổ sung theo quyền.
- [x] P3.3 Lưu từng lần tiếp nhận/bổ sung mà không đổi ngày tiếp nhận đầu tiên; dựng hàng đợi Lead cần phân công trong ngày theo quy tắc đã chốt.
- [x] P3.4 Nối nhập danh sách theo định dạng đã chọn: mẫu, xem trước, validation, kết quả dòng hợp lệ/trùng/lỗi, lịch sử lô nếu có; không âm thầm ghi đè thông tin khi trùng.
- [x] P3.5 Hoàn thiện lưu trữ/xóa/khôi phục theo quyết định nghiệp vụ, bảo toàn lịch sử và quyền.

**Hoàn thành khi:** dữ liệu tồn tại sau đăng nhập lại hoặc trên trình duyệt khác; nhập tay và nhập file tuân cùng quy tắc chống trùng, có hàng đợi phân công dùng được.

### Bước 4 — Phiếu phân công và workflow (FR-03/04, R-07…10)

- [x] P4.1 Nối tạo phiếu, nhận việc, giao lại/chuyển việc, người giao/nhận, hạn xử lý và lịch sử server.
- [x] P4.2 Thực thi ma trận New/Open/Solved/Closed ở backend; xử lý chuyển trạng thái nguyên tử, từ chối thao tác sai quyền hoặc dựa trên trạng thái cũ.
- [x] P4.3 Áp dụng giới hạn phiếu đồng thời, phạm vi nhóm và thời hạn sau chuyển người theo quyết định P1.
- [x] P4.4 Hoàn thiện danh sách chưa nhận/chưa liên hệ/đang xử lý/quá hạn, lọc nhân viên và hạn; dữ liệu Closed có đủ thông tin để bàn giao ở bước 6.

**Hoàn thành khi:** kiểm chứng được giao/nhận/chuyển, lịch sử, mở lại Solved trong hạn, từ chối sau hạn/Closed và quyền nhân viên cũ sau chuyển việc.

### Bước 5 — Tư vấn, lịch hẹn và nhóm nhiệm vụ (FR-05, R-11…14)

- [x] P5.1 Lưu từng Activity: kênh, thời gian, người, kết quả, Decision/Reason, ghi chú, Lead và phiếu; timeline không mất lịch sử.
- [x] P5.2 Hiện thực lưu recording/chat/file hoặc tích hợp trực tiếp theo mức đã chốt; nếu dùng Storage thì kiểm tra quyền tải/xem tệp và ghi chú riêng.
- [x] P5.3 Lịch hẹn có ngày/giờ/nơi, hẹn lại, đến/không đến/hủy và lịch sử; quy tắc tăng lần quá hẹn thống nhất với Activity, tránh đếm đôi một lần không đến.
- [x] P5.4 Nối mục con Nhiệm vụ và số đếm với truy vấn DB theo đúng quyền; chốt tiêu chí “cập nhật gần đây”, kết quả gần nhất và bộ đếm KNM/quá hẹn.

**Hoàn thành khi:** một Telesale hoàn thành được luồng xem phiếu → ghi tư vấn → hẹn → cập nhật kết quả; danh sách con/số đếm khớp dữ liệu và phạm vi được giao.

### Bước 6 — Tự đóng, nhắc việc và bàn giao

- [x] P6.1 Tạo tác vụ server tự đóng đúng hạn; kiểm tra ranh giới trước/đúng/sau hạn 14 ngày và trường hợp Solved theo quy tắc được chốt.
- [x] P6.2 Tạo tác vụ nhắc việc theo kênh/mốc đã chọn, xử lý hẹn lại/hủy và lỗi gửi. Chạy lại không tạo trùng thông báo.
- [x] P6.3 Dựng danh sách Closed theo ngày cho bộ phận tiếp nhận, gồm lý do đóng và kết quả tư vấn; có trạng thái đã rà soát/bàn giao để xử lý lại không trùng.
- [x] P6.4 Nối xác nhận Activated/Onboarded/Closed trên hồ sơ theo quyền và căn cứ; không suy ra Lead Closed chỉ từ phiếu hết hạn.
- [x] P6.5 Ghi log thực thi, múi giờ UTC+7, lịch chạy và cách xử lý thất bại/chạy bù.

**Hoàn thành khi:** đóng trình duyệt vẫn chạy tác vụ; thử chạy lại giữ kết quả nhất quán và bộ phận tiếp nhận xử lý được danh sách bàn giao.

### Bước 7 — Dashboard và báo cáo (FR-06, R-15/16)

- [x] P7.1 Dùng chung định nghĩa/truy vấn cho dashboard và báo cáo; tính trên DB, theo phạm vi tài khoản.
- [x] P7.2 Tổng Lead, Lead mới, quá hạn, chuyển đổi, phễu, thống kê nguồn/trạng thái/nhân viên; lọc thời gian và các chiều đã chốt.
- [x] P7.3 Đối chiếu tổng với danh sách chi tiết; một Lead có nhiều phiếu không làm tăng số Lead hoặc bị quy công ngoài quy tắc.
- [x] P7.4 Xuất định dạng đã chọn theo bộ lọc và quyền, bao gồm quyền xem/xuất SĐT; xử lý tập rỗng và khoảng ngày sai.

**Hoàn thành khi:** bộ dữ liệu mẫu có kết quả dự kiến khớp từng KPI, phễu, bộ lọc và file xuất.

### Bước 8 — Hoàn thiện, triển khai và bàn giao (R-17…20)

- [x] P8.1 Chạy kiểm thử xuyên suốt với tài khoản thật theo vai trò; bổ sung test DB/RLS, workflow, chống trùng đồng thời và các ranh giới thời gian cần thiết. Chuyển e2e khỏi phụ thuộc actor/localStorage demo.
- [ ] P8.2 Kiểm tra giao diện desktop/mobile, dữ liệu rỗng, lỗi mạng, quyền truy cập trực tiếp URL và phiên đăng nhập hết hạn.
- [x] P8.3 Hoàn thiện quản trị tài khoản/danh mục, audit và dữ liệu mẫu; chạy build/typecheck/lint và các test liên quan.
- [ ] P8.4 Triển khai lên môi trường đã chọn, áp dụng migration, cấu hình Auth/Storage/job và kiểm tra lại luồng chính tại môi trường đó.
- [x] P8.5 Viết hướng dẫn chạy/cấu hình, ERD, kiến trúc/triển khai, cấu trúc code, API thật, bảng phần tận dụng/tự phát triển; giữ nguồn gốc và MIT license.
- [x] P8.6 Chuẩn bị kịch bản: tiếp nhận mới → trùng/bổ sung → giao/nhận/chuyển → tư vấn/hẹn → Solved/mở lại/hết hạn → tiếp nhận rà soát → Activated/Onboarded → báo cáo đối chiếu.

**Hoàn thành khi:** người khác có thể làm theo hướng dẫn để chạy/demo, quyền và dữ liệu thật đã kiểm chứng, có bản triển khai hoạt động và các hạn chế còn lại được ghi rõ.

## 4. Quyết định cần chốt đúng thời điểm

Danh sách chi tiết Q-01…13 nằm trong tài liệu 01; không cần chờ mọi câu trả lời mới chuẩn bị môi trường.

| Nhóm quyết định | Mã liên quan | Cần có trước |
| --- | --- | --- |
| Vai trò, nhóm, quyền lịch sử/chi tiết/xuất | Q-06 | Chốt RLS và nối module thật ở bước 2–3 |
| Trường bắt buộc, tiếp nhận lại, xóa/lưu trữ, định dạng nhập | Q-04/08/11/12 | Hoàn thiện bước 3 |
| Lần KNM/quá hẹn thứ 3, mốc 14 ngày, phiếu đồng thời/chuyển người, ánh xạ kết quả | Q-01/02/03/05 | Workflow bước 4–6 |
| Bằng chứng cuộc gọi/chat, mức tích hợp và API/tài khoản được cấp | Q-07 | Phạm vi thiết kế bước 1 và hiện thực bước 5 |
| Công thức KPI, ngày lọc, quy công | Q-09 | Thiết kế dữ liệu bước 1, kiểm chứng bước 7 |
| Kênh/thời điểm nhắc và bàn giao Closed | Q-10 | Hiện thực tác vụ bước 6 |
| Tên đề tài, deadline, môi trường, dữ liệu và phạm vi demo | Q-13 | Lập lịch sau bước 0–1, chọn đích triển khai |

## 5. Ba mốc sản phẩm để theo dõi

1. **M1 — Tiếp nhận thật:** hoàn tất bước 0–3. Đăng nhập đúng vai trò, tạo/bổ sung/import Lead vào DB, trưởng nhóm thấy hàng đợi. Có thể review ngay luồng đầu tiên.
2. **M2 — Vận hành tư vấn:** hoàn tất bước 4–6. Phân công, hoạt động, lịch hẹn, nhóm nhiệm vụ, tự đóng, nhắc và bàn giao chạy được cùng quyền/audit.
3. **M3 — Bản bảo vệ/bàn giao:** hoàn tất bước 7–8. Dashboard/báo cáo khớp, bản triển khai hoạt động, đủ tài liệu và kịch bản demo.

## 6. Việc còn lại sau bản chạy được

- Chọn nơi phát hành frontend/tên miền và cấu hình Auth URL/SMTP theo môi trường đó. Backend Supabase hiện tại đã chạy thật.
- Nghiệm thu nghiệp vụ bằng kịch bản trong tài liệu 06; chỉnh các lựa chọn mặc định nếu người dùng muốn thay đổi.
- Quy mô lớn: chuyển snapshot sang phân trang server và kiểm thử tải. Đây là giới hạn được ghi rõ, chưa có chỉ tiêu tải từ nguồn.

Không chạy migration Atomic CRM cũ vào project Lead Sale. Xem tài liệu 06 để dựng môi trường và kiểm tra cron.
