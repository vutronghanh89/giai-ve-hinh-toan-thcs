/* ============================================================================
   DỊCH VỤ GEMINI AI:
   - Đợt 1: Phân tích đề toán -> Xuất JSON Hình vẽ 2D + GT-KL + Lời giải
   - Chat Hiệu chỉnh: Chỉnh sửa trực tiếp bản nháp theo yêu cầu giáo viên
   - Đợt 2: Tạo âm thanh thuyết minh giọng nữ miền Bắc (Sulafat) từng bước
   ============================================================================ */

export const TEACHER_SYSTEM_PROMPT = `Bạn là giáo viên Toán THCS giàu kinh nghiệm và chuyên gia dựng hình học phẳng 2D trên hệ tọa độ Canvas.
Nhiệm vụ của bạn là chuyển đổi đề bài hình học thành một đối tượng JSON chuẩn xác để trình chiếu từng bước cho học sinh THCS.

QUY TẮC HỆ TỌA ĐỘ CANVAS 2D:
- Gốc tọa độ (0, 0) nằm ở chính giữa khung vẽ.
- Trục Ox hướng sang phải (x từ -190 đến 190), trục Oy hướng XUỐNG DƯỚI (y từ -145 đến 145; điểm ở phía trên có y âm, điểm ở đáy có y dương).
- Các điểm cần đặt cân đối, thoáng mắt, không chồng chéo nhãn (dx, dy là độ lệch pixel của tên điểm so với chấm tròn tọa độ, khoảng 12 đến 20px).
- Mỗi điểm (point), đoạn thẳng (segment), đường tròn (circle) phải có thuộc tính "drawStep" (số nguyên bắt đầu từ 0) khớp với chỉ số của bước vẽ trong mảng "drawingSteps".
- Ký hiệu góc vuông ("rightAngles") hoặc cung góc ("angleArcs") nếu là yếu tố cần chứng minh mới xuất hiện thì đặt thêm "solveRevealStep" bằng chỉ số bước tương ứng trong "solutionSteps" (hoặc bỏ trống nếu có sẵn từ giả thiết).

QUY TẮC LỜI GIẢI & LỜI THOẠI THUYẾT MINH:
- "given" và "prove": Viết ngắn gọn dưới dạng ký hiệu toán học chuẩn (ví dụ: "△ABC cân tại A (AB = AC)", "AM ⊥ BC").
- "solutionSteps": Chia thành từng dòng lập luận ngắn gọn, mạch lạc, không đánh số thứ tự rườm rà ở đầu câu.
- "voiceExplanation": Viết bằng văn nói tự nhiên của cô giáo dạy Toán miền Bắc để đọc thành tiếng. Đọc rời tên các điểm bằng chữ cái (ví dụ: viết "tam giác A B C", "đoạn thẳng M B", "vuông góc với B C"), KHÔNG dùng ký hiệu đặc biệt như △, ⊥, ∠, ⇒, = trong trường "voiceExplanation".

ĐỊNH DẠNG JSON BẮT BUỘC (TRẢ VỀ ĐÚNG CẤU TRÚC NÀY, KHÔNG THÊM VĂN BẢN NGOÀI JSON):
{
  "grade": "Toán 6 | Toán 7 | Toán 8 | Toán 9",
  "topic": "Tên chuyên đề ngắn gọn (VD: Tam giác cân, Tứ giác, Đường tròn...)",
  "title": "Tên bài toán ngắn gọn, súc tích",
  "problemText": "Nội dung đầy đủ đề bài",
  "given": ["Giả thiết 1", "Giả thiết 2"],
  "prove": ["a) Kết luận 1", "b) Kết luận 2"],
  "drawingSteps": [
    {
      "caption": "Mô tả ngắn gọn bước vẽ hiển thị trên màn hình",
      "voiceExplanation": "Lời giảng tự nhiên của cô giáo cho bước vẽ này",
      "tool": "ruler | compass | protractor | eke",
      "highlightSegments": ["A-B"],
      "highlightPoints": ["A", "B"]
    }
  ],
  "geometry": {
    "points": [
      { "id": "A", "label": "A", "x": 0, "y": -110, "dx": 0, "dy": -16, "drawStep": 0 }
    ],
    "segments": [
      { "from": "A", "to": "B", "style": "solid | dashed", "color": "main | accent | emerald | red", "ticks": 0, "drawStep": 0 }
    ],
    "circles": [
      { "center": "O", "radius": 80, "style": "solid | dashed", "color": "main | accent", "drawStep": 0 }
    ],
    "rightAngles": [
      { "vertex": "H", "p1": "A", "p2": "C", "drawStep": 1 }
    ],
    "angleArcs": [
      { "vertex": "A", "p1": "B", "p2": "C", "radius": 24, "label": "", "color": "accent | red | emerald", "drawStep": 1 }
    ]
  },
  "solutionSteps": [
    {
      "lineText": "Dòng lập luận toán học hiển thị bên phải",
      "voiceExplanation": "Lời giảng tự nhiên của cô giáo giải thích dòng lập luận này",
      "highlightSegments": ["A-B"],
      "highlightPoints": ["A", "B"],
      "highlightPolygons": [
        { "points": ["A", "B", "C"], "color": "blue | amber | emerald" }
      ]
    }
  ]
}`;

/**
 * Làm sạch và phân tích chuỗi JSON trả về từ Gemini (xử lý triệt để lỗi bọc markdown hoặc ký tự thừa)
 */
export function extractAndParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('AI trả về nội dung trống.');
  }

  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    const repaired = cleaned.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(repaired);
    } catch {
      throw new Error(`Không đọc được cấu trúc JSON từ AI (${firstErr.message}). Hãy bấm thử lại!`);
    }
  }
}

/**
 * Chuẩn hóa dữ liệu bài toán để đảm bảo Canvas 2D và trình chiếu luôn an toàn 100%
 */
export function normalizeProblemData(raw, fallbackProblemText = '') {
  const safePoints = Array.isArray(raw?.geometry?.points)
    ? raw.geometry.points.map((p, idx) => ({
        id: String(p.id || p.label || `P${idx}`),
        label: String(p.label || p.id || `P${idx}`),
        x: Number.isFinite(Number(p.x)) ? Number(p.x) : 0,
        y: Number.isFinite(Number(p.y)) ? Number(p.y) : 0,
        dx: Number.isFinite(Number(p.dx)) ? Number(p.dx) : 0,
        dy: Number.isFinite(Number(p.dy)) ? Number(p.dy) : -14,
        drawStep: Number.isInteger(Number(p.drawStep)) ? Number(p.drawStep) : 0
      }))
    : [];

  const validPointIds = new Set(safePoints.map((p) => p.id));

  const safeSegments = Array.isArray(raw?.geometry?.segments)
    ? raw.geometry.segments
        .filter((s) => validPointIds.has(String(s.from)) && validPointIds.has(String(s.to)))
        .map((s) => ({
          from: String(s.from),
          to: String(s.to),
          style: s.style === 'dashed' ? 'dashed' : 'solid',
          color: ['main', 'accent', 'emerald', 'red'].includes(s.color) ? s.color : 'main',
          ticks: Number.isInteger(Number(s.ticks)) ? Number(s.ticks) : 0,
          drawStep: Number.isInteger(Number(s.drawStep)) ? Number(s.drawStep) : 0,
          ...(Number.isInteger(Number(s.ticksFromStep)) ? { ticksFromStep: Number(s.ticksFromStep) } : {})
        }))
    : [];

  const safeCircles = Array.isArray(raw?.geometry?.circles)
    ? raw.geometry.circles
        .filter((c) => validPointIds.has(String(c.center)))
        .map((c) => ({
          center: String(c.center),
          radius: Math.max(10, Number(c.radius) || 60),
          style: c.style === 'dashed' ? 'dashed' : 'solid',
          color: ['main', 'accent', 'emerald', 'red'].includes(c.color) ? c.color : 'main',
          drawStep: Number.isInteger(Number(c.drawStep)) ? Number(c.drawStep) : 0
        }))
    : [];

  const safeRightAngles = Array.isArray(raw?.geometry?.rightAngles)
    ? raw.geometry.rightAngles
        .filter(
          (r) =>
            validPointIds.has(String(r.vertex)) &&
            validPointIds.has(String(r.p1)) &&
            validPointIds.has(String(r.p2))
        )
        .map((r) => ({
          vertex: String(r.vertex),
          p1: String(r.p1),
          p2: String(r.p2),
          drawStep: Number.isInteger(Number(r.drawStep)) ? Number(r.drawStep) : 0,
          ...(Number.isInteger(Number(r.solveRevealStep))
            ? { solveRevealStep: Number(r.solveRevealStep) }
            : {})
        }))
    : [];

  const safeAngleArcs = Array.isArray(raw?.geometry?.angleArcs)
    ? raw.geometry.angleArcs
        .filter(
          (a) =>
            validPointIds.has(String(a.vertex)) &&
            validPointIds.has(String(a.p1)) &&
            validPointIds.has(String(a.p2))
        )
        .map((a) => ({
          vertex: String(a.vertex),
          p1: String(a.p1),
          p2: String(a.p2),
          radius: Math.max(12, Number(a.radius) || 24),
          label: a.label ? String(a.label) : '',
          color: ['accent', 'red', 'emerald', 'main'].includes(a.color) ? a.color : 'accent',
          drawStep: Number.isInteger(Number(a.drawStep)) ? Number(a.drawStep) : 0,
          ...(Number.isInteger(Number(a.solveRevealStep))
            ? { solveRevealStep: Number(a.solveRevealStep) }
            : {})
        }))
    : [];

  const safeDrawingSteps =
    Array.isArray(raw?.drawingSteps) && raw.drawingSteps.length > 0
      ? raw.drawingSteps.map((st, idx) => ({
          caption: String(st.caption || `Bước ${idx + 1}: Dựng hình theo yêu cầu đề bài.`),
          voiceExplanation: String(st.voiceExplanation || st.caption || `Bước ${idx + 1}.`),
          tool: ['ruler', 'compass', 'protractor', 'eke'].includes(st.tool) ? st.tool : 'ruler',
          highlightSegments: Array.isArray(st.highlightSegments) ? st.highlightSegments.map(String) : [],
          highlightPoints: Array.isArray(st.highlightPoints) ? st.highlightPoints.map(String) : []
        }))
      : [
          {
            caption: 'Dựng hình vẽ theo dữ kiện của đề bài.',
            voiceExplanation: 'Ta tiến hành vẽ hình theo giả thiết của bài toán.',
            tool: 'ruler',
            highlightSegments: [],
            highlightPoints: safePoints.map((p) => p.id)
          }
        ];

  const safeSolutionSteps =
    Array.isArray(raw?.solutionSteps) && raw.solutionSteps.length > 0
      ? raw.solutionSteps.map((st, idx) => ({
          lineText: String(st.lineText || `Bước ${idx + 1}`),
          voiceExplanation: String(st.voiceExplanation || st.lineText || ''),
          highlightSegments: Array.isArray(st.highlightSegments) ? st.highlightSegments.map(String) : [],
          highlightPoints: Array.isArray(st.highlightPoints) ? st.highlightPoints.map(String) : [],
          highlightPolygons: Array.isArray(st.highlightPolygons)
            ? st.highlightPolygons
                .filter((poly) => Array.isArray(poly?.points) && poly.points.length >= 3)
                .map((poly) => ({
                  points: poly.points.map(String),
                  color: ['blue', 'amber', 'emerald'].includes(poly.color) ? poly.color : 'blue'
                }))
            : []
        }))
      : [
          {
            lineText: 'Chứng minh theo các dữ kiện giả thiết đã cho.',
            voiceExplanation: 'Ta áp dụng các tính chất hình học đã học để chứng minh yêu cầu đề bài.',
            highlightSegments: [],
            highlightPoints: [],
            highlightPolygons: []
          }
        ];

  return {
    id: raw?.id || `draft_${Date.now()}`,
    hasStaticAudio: false,
    grade: ['Toán 6', 'Toán 7', 'Toán 8', 'Toán 9'].includes(raw?.grade) ? raw.grade : 'Toán 7',
    topic: String(raw?.topic || 'Hình học phẳng THCS'),
    title: String(raw?.title || 'Bài toán hình học mới'),
    problemText: String(raw?.problemText || fallbackProblemText || '').trim(),
    given: Array.isArray(raw?.given) && raw.given.length > 0 ? raw.given.map(String) : ['Theo đề bài'],
    prove: Array.isArray(raw?.prove) && raw.prove.length > 0 ? raw.prove.map(String) : ['Chứng minh yêu cầu bài toán'],
    drawingSteps: safeDrawingSteps,
    geometry: {
      points: safePoints,
      segments: safeSegments,
      circles: safeCircles,
      rightAngles: safeRightAngles,
      angleArcs: safeAngleArcs
    },
    solutionSteps: safeSolutionSteps
  };
}

/**
 * Tự động tìm các model Gemini Flash khả dụng cho API Key hiện tại nếu model mặc định trả về 404
 */
async function discoverAvailableFlashModels(apiKey) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    return models
      .filter(
        (m) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          m.name?.includes('flash') &&
          !m.name?.includes('tts') &&
          !m.name?.includes('image')
      )
      .map((m) => m.name.replace(/^models\//, ''))
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

/**
 * Hàm lõi gọi Gemini (ưu tiên gemini-3.8-flash và tự động chuyển đổi nếu gặp HTTP 404)
 */
async function callGeminiJsonCore(parts, apiKey) {
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.0-flash', 'gemini-2.5-flash'];
  const triedModels = new Set();
  let lastError = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const modelName = candidateModels[mIdx];
    if (triedModels.has(modelName)) continue;
    triedModels.add(modelName);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const configsToTry = [
      {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 8192
      },
      {
        temperature: 0.2,
        maxOutputTokens: 8192
      }
    ];

    for (let cfgIdx = 0; cfgIdx < configsToTry.length; cfgIdx++) {
      const payload = {
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: TEACHER_SYSTEM_PROMPT }] },
        generationConfig: configsToTry[cfgIdx]
      };

      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          let detail = '';
          try {
            const errBody = await res.json();
            detail = errBody?.error?.message || '';
          } catch {
            // ignore
          }

          // Nếu model trả về 404 (ngừng hỗ trợ hoặc chưa mở cho key), thử model tiếp theo & quét danh sách model khả dụng
          if (res.status === 404) {
            const discovered = await discoverAvailableFlashModels(apiKey);
            for (const dm of discovered) {
              if (!triedModels.has(dm) && !candidateModels.includes(dm)) {
                candidateModels.push(dm);
              }
            }
            lastError = new Error(`Model ${modelName} không khả dụng (404): ${detail}`);
            break; // Chuyển sang model tiếp theo trong danh sách
          }

          if (res.status === 400 && cfgIdx === 0 && detail.toLowerCase().includes('responsemimetype')) {
            continue;
          }
          if (res.status === 400 || res.status === 403) {
            throw new Error(`API Key không hợp lệ hoặc bị từ chối (${res.status}): ${detail || 'Kiểm tra lại Gemini API Key'}`);
          }
          if (res.status === 429) {
            throw new Error('API đang chạm giới hạn lượt gọi (429). Vui lòng đợi khoảng 15 giây rồi bấm thử lại.');
          }
          throw new Error(`Lỗi máy chủ Gemini (HTTP ${res.status}): ${detail}`);
        }

        const data = await res.json();
        const candidate = data?.candidates?.[0];
        if (!candidate) {
          throw new Error('Gemini không trả về kết quả (có thể nội dung bị chặn hoặc rỗng).');
        }
        if (candidate.finishReason === 'MAX_TOKENS') {
          throw new Error('Lời giải quá dài vượt giới hạn phản hồi. Hãy thử yêu cầu AI viết súc tích hơn.');
        }

        const rawText = candidate?.content?.parts?.map((p) => p.text || '').join('') || '';
        return extractAndParseJson(rawText);
      } catch (err) {
        lastError = err;
        // Nếu là lỗi xác thực hoặc quá tải 429 thì dừng ngay để báo cho người dùng
        if (err.message?.includes('403') || err.message?.includes('429') || err.message?.includes('API Key không hợp lệ')) {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error('Không thể kết nối tới Gemini API.');
}

/**
 * ĐỢT 1: Tạo Hình vẽ tọa độ 2D, GT-KL và Lời giải từ đề bài (văn bản hoặc ảnh)
 */
export async function generateGeometryAndSolution({ problemText, imageAttachment, apiKey }) {
  const parts = [];
  if (imageAttachment?.base64 && imageAttachment?.mimeType) {
    parts.push({
      inlineData: {
        mimeType: imageAttachment.mimeType,
        data: imageAttachment.base64
      }
    });
  }

  const trimmed = (problemText || '').trim();
  const promptText = trimmed
    ? `Hãy phân tích đề bài hình học THCS sau (kết hợp hình ảnh đính kèm nếu có), tạo tọa độ hình vẽ 2D chuẩn xác từng bước, tóm tắt GT-KL và viết lời giải chi tiết từng dòng:

"${trimmed}"`
    : 'Hãy đọc đề bài và hình vẽ trong ảnh đính kèm, trích xuất đầy đủ đề bài, tạo tọa độ hình vẽ 2D chuẩn xác từng bước, tóm tắt GT-KL và viết lời giải chi tiết từng dòng.';

  parts.push({ text: promptText });

  const parsed = await callGeminiJsonCore(parts, apiKey);
  return normalizeProblemData(parsed, trimmed);
}

/**
 * GIAI ĐOẠN HIỆU CHỈNH: Chat với AI để chỉnh sửa trực tiếp bản nháp hiện tại
 */
export async function refineDraftProblemWithChat({ currentDraft, userInstruction, apiKey }) {
  const prompt = `Đây là dữ liệu JSON hiện tại của bài toán hình học đang biên soạn:
${JSON.stringify(currentDraft, null, 2)}

YÊU CẦU HIỆU CHỈNH CỦA GIÁO VIÊN:
"${userInstruction}"

Hãy giữ nguyên toàn bộ cấu trúc JSON và các phần đã tốt, CHỈ chỉnh sửa chính xác những điểm, tọa độ, nét vẽ, ký hiệu, GT-KL hoặc câu chữ lời giải/lời thoại theo đúng yêu cầu của giáo viên ở trên. Trả về toàn bộ đối tượng JSON hoàn chỉnh sau khi sửa.`;

  const parsed = await callGeminiJsonCore([{ text: prompt }], apiKey);
  const normalized = normalizeProblemData(parsed, currentDraft.problemText);
  return {
    ...normalized,
    id: currentDraft.id,
    grade: parsed?.grade || currentDraft.grade,
    topic: parsed?.topic || currentDraft.topic,
    title: parsed?.title || currentDraft.title
  };
}

/**
 * Chuẩn hóa văn bản trước khi đưa vào TTS để đọc chuẩn tiếng Việt
 */
export function formatNaturalLectureSpeech(text) {
  if (!text) return '';
  return String(text)
    .replace(/△/g, 'tam giác ')
    .replace(/⊥/g, ' vuông góc với ')
    .replace(/∥/g, ' song song với ')
    .replace(/∠/g, 'góc ')
    .replace(/⇒/g, 'suy ra ')
    .replace(/⇔/g, 'khi và chỉ khi ')
    .replace(/°/g, ' độ ')
    .replace(/=/g, ' bằng ')
    .replace(/\+/g, ' cộng ')
    .replace(/-/g, ' trừ ')
    .replace(/·/g, ' nhân ')
    .replace(/1\/2/g, 'một phần hai')
    .replace(/\s+/g, ' ')
    .trim();
}

export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function pcmToWavBlob(pcm16, sampleRate = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm16.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm16.length; i++, offset += 2) {
    view.setInt16(offset, pcm16[i], true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * ĐỢT 2: Tạo âm thanh giọng nữ miền Bắc (Sulafat) cho một đoạn thuyết minh
 */
export async function generateStepAudioTTS({ text, apiKey, signal, onCooldownTick }) {
  const naturalSpeech = formatNaturalLectureSpeech(text);
  if (!naturalSpeech) {
    throw new Error('Nội dung thuyết minh trống.');
  }

  const prompt = `Hãy đóng vai cô giáo dạy Toán THCS giọng nữ chuẩn miền Bắc (Hà Nội), dịu dàng, rõ ràng, truyền cảm, đọc lời giảng bài toán hình học sau cho học sinh hiểu bài:

"${naturalSpeech}"`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Sulafat' }
        }
      }
    },
    model: 'gemini-2.5-flash-preview-tts'
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (signal?.aborted) throw new Error('ABORTED');

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });

    if (res.status === 400 || res.status === 403) {
      throw new Error('Gemini API Key không hợp lệ hoặc không có quyền dùng TTS.');
    }

    if (res.status === 429) {
      if (attempt < 3) {
        for (let sec = 15; sec >= 1; sec--) {
          if (signal?.aborted) throw new Error('ABORTED');
          onCooldownTick?.(sec);
          await new Promise((r) => setTimeout(r, 1000));
        }
        onCooldownTick?.(0);
        continue;
      }
      throw new Error('Vượt giới hạn tốc độ tạo âm thanh (429). Vui lòng đợi 15 giây rồi bấm tạo tiếp.');
    }

    if (!res.ok) {
      throw new Error(`Lỗi tạo âm thanh (HTTP ${res.status})`);
    }

    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.[0];
    const audioData = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType || '';

    if (audioData && mimeType.startsWith('audio/')) {
      const rateMatch = mimeType.match(/rate=(\d+)/i);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      const pcmBuffer = base64ToArrayBuffer(audioData);
      const pcm16 = new Int16Array(pcmBuffer);
      const wavBlob = pcmToWavBlob(pcm16, sampleRate);
      const wavUrl = URL.createObjectURL(wavBlob);
      const durationSec = pcm16.length / sampleRate;
      return { url: wavUrl, pcm16, sampleRate, durationSec };
    }

    throw new Error('API không trả về dữ liệu âm thanh hợp lệ.');
  }

  throw new Error('Không thể tạo âm thanh sau nhiều lần thử.');
}
