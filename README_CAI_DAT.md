# Hướng dẫn cập nhật mã nguồn Web Giải & Vẽ Hình Toán Hình Học THCS (v4.0.0)

## Các nâng cấp trong phiên bản v4.0.0 (giữ nguyên 100% giao diện hiện tại)
1. **Tua (seek/scrub) video & bài giảng mượt mà trên cả Web và tệp `.mp4` tải về (`src/App.jsx`, `src/services/timelineHelper.js`):**
   - Nạp sẵn tệp âm thanh vào bộ nhớ đệm cục bộ (`Blob URL`) và khóa chống nhảy mốc thời gian khi bấm hoặc kéo trượt thanh tiến trình, giúp tua đến bất kỳ đoạn nào đều chạy tiếp chính xác từ đoạn đó, không bao giờ tự chạy lại về đầu.
   - Hỗ trợ đồng bộ từng bước dựng hình và lời giải ngay cả với các bài chưa có sẵn `audioTimeline`.
2. **Xuất video `.mp4` siêu tốc & đầy đủ 4 khung chuẩn như giao diện web (`src/services/videoExporter.js`, `src/services/canvasMathRenderer.js`):**
   - Sử dụng bộ mã hóa phần cứng **WebCodecs (`VideoEncoder` H.264 + `AudioEncoder` AAC 48kHz)** kết hợp **FastStart MP4 (`moov` ở đầu tệp + chèn keyframe mỗi 1 giây)** giúp xuất video nhanh gấp 5–15 lần, không bị treo ở mức 98%, và tua mượt trên mọi trình phát video.
   - Khung hình video hiển thị trọn vẹn bố cục như web: **Đề bài**, **GT - KL**, **Hình vẽ động**, **Lời giải chi tiết hiện từng bước đồng bộ theo lời thoại**, và **Thanh Lời thuyết minh**.

## Cách cập nhật lên GitHub / Cloudflare Pages
1. Giải nén tệp `giai-ve-hinh-toan-thcs-v4.zip`.
2. Giữ nguyên thư mục `public/lessons/` hiện có trên repository GitHub của thầy (nơi lưu các bài mẫu và tệp âm thanh).
3. Chép đè toàn bộ các tệp trong gói mới này vào repository GitHub và Commit.
4. Cloudflare Pages sẽ tự động build và cập nhật trang web sau khoảng 1 phút.
