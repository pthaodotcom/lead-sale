# Bản duyệt NOTE SỬA — 24/10/2026

- Mở `index.html` để đọc bản có bộ lọc vai trò, tìm kiếm, ảnh phóng to và 10 điểm cần duyệt. 33 ảnh NOTE SỬA đã nhúng trực tiếp, nên mở file này không cần mạng để xem ảnh.
- `DAC-TA-SUA-LEAD-SALE.md` là đặc tả đầy đủ: 43 hạng mục, các quy tắc, công thức báo cáo, đối chiếu code và tình huống nghiệm thu.
- `changes.json` và `decisions.json` là dữ liệu có cấu trúc của bản duyệt.
- `../sources/google-doc-2026-10-24.md` giữ chữ nguồn và liên kết đủ 41 ảnh của 9 tab; `../sources/images/2026-10-24/manifest.json` lưu ánh xạ ảnh nguồn và SHA-256, không lưu URL ảnh tạm có khóa truy cập.
- `build_review.py` dựng lại HTML từ dữ liệu và đặc tả, dùng Python và `markdown_it`. Không cần chạy script để mở HTML đã giao.

Phạm vi thực hiện: đọc Google Doc, xem ảnh, đọc code và tạo tài liệu duyệt. Không chỉnh web/DB hoặc ghi vào Google Doc gốc.

## Kiểm tra bản tài liệu

Đã kiểm tra bằng Chromium: 43 hạng mục; lọc Telesale còn 17; tìm kiếm và trạng thái rỗng; đủ 33 ảnh tải được; phóng to ảnh và đóng bằng Escape; chuyển từ mục sửa đến Q tương ứng; toàn văn hiển thị; màn 390px không tràn ngang toàn trang; không lỗi JavaScript. `qa.json` lưu kết quả. Hai ảnh `preview-desktop.png` và `preview-mobile.png` là ảnh bản đặc tả, không phải ảnh ứng dụng sau sửa.

Bản xem cục bộ trong phiên: `http://127.0.0.1:5194/review-note-sua-2026-10-24/`, đã kiểm tra HTTP 200. Khi server dừng có thể mở trực tiếp `index.html`, hoặc chạy từ thư mục gốc workspace:

```powershell
python -m http.server 5194 --bind 127.0.0.1 --directory docs
```

Các tiêu chí nghiệm thu ứng dụng trong đặc tả là việc phải kiểm tra sau triển khai, chưa được tuyên bố đã PASS.
