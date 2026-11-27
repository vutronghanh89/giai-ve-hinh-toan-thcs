# Hướng dẫn cập nhật gói mã nguồn KaTeX (v2.1.0)

## Những nâng cấp chính trong bản cập nhật này
1. **Hiển thị phân số dọc & công thức chuẩn sách giáo khoa (KaTeX):**
   - Tích hợp sẵn thư viện `katex` và bộ xử lý thông minh `src/components/MathText.jsx`.
   - Tự động chuyển các phân số viết dạng `(a . b) / c` hoặc `1/2` thành phân số có tử số ở trên, mẫu số ở dưới.
   - Tự động ngắt dòng rõ ràng tại các dấu `=` / `≈` đối với chuỗi biến đổi dài và khóa chống gãy dòng giữa chừng.
   - **Tương thích ngược 100%:** Toàn bộ 8 bài mẫu cũ trong thư mục `public/lessons/` tự động hiển thị phân số dọc mà không cần sửa lại từng tệp `data.json`.
2. **Nâng cấp AI soạn bài mới (`src/services/geminiService.js`):**
   - AI tự động xuất công thức chuẩn LaTeX `$\dfrac{a}{b}$` cho mọi bài mới tạo.

## Cách cập nhật lên GitHub / Cloudflare Pages
1. Giải nén tệp `giai-ve-hinh-toan-thcs-katex-v2.zip`.
2. Giữ nguyên thư mục `public/lessons/` hiện có trên repo GitHub (nơi chứa 8 bài mẫu và âm thanh).
3. Chép đè toàn bộ các tệp trong gói mới này (`package.json`, `index.html`, `src/...`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`) lên repo GitHub và Commit.
4. Cloudflare Pages sẽ tự động chạy `npm install && npm run build` và cập nhật trang web sau khoảng 1 phút.
