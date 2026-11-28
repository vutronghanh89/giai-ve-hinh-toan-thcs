# Hướng dẫn cập nhật mã nguồn Giải & Vẽ Hình Toán THCS (v3.0.0)

## Những nâng cấp chính trong bản cập nhật này
1. **Video xuất ra chuẩn `.mp4` và đồng nhất 100% với giao diện Web (`src/services/videoExportService.js`):**
   - Xuất trực tiếp tệp định dạng `.mp4` (chuẩn H.264 + AAC qua WebCodecs & `mp4-muxer`, tự động fallback trên trình duyệt cũ).
   - Bố cục video Full HD 1920x1080 hiển thị đầy đủ: **Tiêu đề + Đề bài + GT - KL + Hình vẽ minh họa + Lời giải chi tiết** (lược bỏ khung phụ đề và thanh tua bên dưới).
   - Ký hiệu toán học (dấu mũ góc $\widehat{DAE}$, phân số dọc $\dfrac{a}{b}$, căn thức, ký hiệu vuông góc, song song...) hiển thị sắc nét bằng KaTeX giống hệt trên trang web.
2. **Sửa triệt để lỗi bấm/kéo tua thanh thời gian bị nhảy về ban đầu (`src/App.jsx`):**
   - Tải trước âm thanh MP3 vào bộ nhớ đệm cục bộ (`Blob URL`) giúp trình duyệt tua tức thì đến mọi giây mà không bị lỗi HTTP Range hay reset `currentTime` về 0.
   - Khóa xung đột sự kiện `timeupdate` khi giáo viên đang bấm hoặc kéo thanh tua (`isSeekingRef`), đồng thời hỗ trợ bấm trực tiếp vào từng dòng lời giải để nhảy nhanh tới bước đó.

## Cách cập nhật lên GitHub / Cloudflare Pages
1. Giải nén tệp `giai-ve-hinh-toan-thcs-v3-mp4-fix.zip`.
2. Giữ nguyên thư mục `public/lessons/` hiện có trên repository GitHub của thầy (nơi chứa các bài mẫu và tệp âm thanh).
3. Chép đè toàn bộ các tệp trong gói này (`package.json`, `index.html`, `src/...`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`) lên repository GitHub và **Commit**.
4. Cloudflare Pages sẽ tự động chạy `npm install && npm run build` và cập nhật trang web sau khoảng 1 phút.
