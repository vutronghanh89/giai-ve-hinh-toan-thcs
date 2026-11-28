# Hướng dẫn cập nhật mã nguồn Web Giải & Vẽ Hình Toán Hình Học THCS (v3.0.0)

## Các nâng cấp chính trong phiên bản này
1. **Tự động tách dòng công thức dài & chống dính chữ tiếng Việt (`src/components/MathText.jsx`):**
   - Các dòng có lời dẫn kèm công thức dài tự động tách phần công thức xuống dòng riêng bên dưới.
   - Các chuỗi biến đổi có nhiều dấu `=` / `≈` tự động tách mỗi vế biến đổi thành 1 dòng riêng biệt, không bị ngắt gãy lửng lơ giữa chừng.
   - Tự động xử lý khoảng trắng tiếng Việt & đơn vị đo lường bên trong biểu thức LaTeX (`tại`, `và`, `cm`, `độ`...).
2. **Lời giải gọn gàng, bỏ đánh số đầu dòng & tự động cuộn đồng bộ (`src/App.jsx`):**
   - Loại bỏ số thứ tự tròn ở đầu các bước lời giải, thu gọn giãn dòng và khoảng cách thẻ.
   - Tự động cuộn mượt tới đúng dòng lời giải đang thuyết minh để học sinh luôn theo dõi được.
3. **Tự động căn tâm & thu phóng toàn bộ hình vẽ vừa khít khung (`src/components/GeometryCanvas.jsx`):**
   - Tính toán vùng bao thực tế của tất cả điểm, nhãn điểm, cung tròn/đường tròn, tia và đường thẳng để tự động căn giữa và thu phóng vừa khít khung hình, không bao giờ bị tràn hoặc cắt mất đỉnh/tâm.
4. **Bố cục chuẩn 4 khung + Thanh thuyết minh, Tiến trình & Xuất Video (`src/App.jsx`, `src/services/videoExporter.js`):**
   - Hàng trên: **Đề bài** | **GT - KL** (có thanh cuộn độc lập nếu nội dung dài).
   - Hàng dưới: **Hình vẽ** (luôn hiển thị cố định trọn vẹn) | **Lời giải**.
   - Thanh điều khiển cố định bên dưới gồm 3 tầng: **Lời thuyết minh** -> **Thanh tiến trình** -> **Tự động giảng, Tốc độ, Loa, ... Tải video**.

## Cách cập nhật lên GitHub / Cloudflare Pages
1. Giải nén tệp `giai-ve-hinh-toan-thcs-v3.zip`.
2. Giữ nguyên thư mục `public/lessons/` hiện có trên repository GitHub của thầy (nơi lưu các bài mẫu và tệp âm thanh).
3. Chép đè toàn bộ các tệp trong gói mới này (`package.json`, `index.html`, `src/...`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`) vào repository GitHub và Commit.
4. Cloudflare Pages sẽ tự động build và cập nhật trang web sau khoảng 1 phút.
