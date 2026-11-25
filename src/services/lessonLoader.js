/* ============================================================================
   BỘ NẠP BÀI HỌC ĐỘNG TỪ THƯ MỤC TĨNH public/lessons/
   - Chỉ tải index.json nhẹ lúc khởi động
   - Khi chọn bài nào mới tải data.json & audio của riêng bài đó
   ============================================================================ */

export async function fetchLessonsCatalog() {
  try {
    const res = await fetch(`/lessons/index.json?t=${Date.now()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchLessonDetail(catalogItem) {
  if (!catalogItem?.path) {
    throw new Error('Đường dẫn tệp bài học không hợp lệ.');
  }
  const res = await fetch(`${catalogItem.path}?t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Không tải được dữ liệu bài học (${res.status}).`);
  }
  const lesson = await res.json();
  return {
    ...lesson,
    audioBasePath: catalogItem.audioBasePath || lesson.audioBasePath || ''
  };
}
