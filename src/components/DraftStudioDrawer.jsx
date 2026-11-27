import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Send,
  Headphones,
  Trash2,
  Upload,
  Github,
  Download,
  Volume2,
  MessageSquareText,
  PenTool,
  AlertCircle,
  RefreshCw,
  FolderPlus,
  FileAudio,
  FolderOpen,
  FileArchive,
  FileJson
} from 'lucide-react';
import {
  generateGeometryAndSolution,
  refineDraftProblemWithChat,
  generateStepAudioTTS
} from '../services/geminiService.js';
import {
  saveLessonDirectToGithub,
  downloadLessonZipBackup,
  buildUnifiedAudioPackage
} from '../services/githubStorageService.js';

const QUICK_EDIT_SUGGESTIONS = [
  'Kéo đỉnh phía trên cao thêm một chút cho cân đối',
  'Đổi nét đường phụ thành nét đứt màu xanh',
  'Rút gọn lời giải ngắn gọn, súc tích hơn',
  'Kiểm tra lại ký hiệu góc vuông và đoạn bằng nhau'
];

/**
 * Đọc giọng tiếng Việt trực tiếp bằng trình duyệt (dự phòng khi chưa có file MP3)
 */
function speakVietnameseBrowserFallback(text) {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'vi-VN';
    utter.rate = 0.98;
    const voices = window.speechSynthesis.getVoices();
    const viVoice =
      voices.find((v) => v.lang?.toLowerCase().includes('vi') && v.name?.includes('HoaiMy')) ||
      voices.find((v) => v.lang?.toLowerCase().includes('vi'));
    if (viVoice) utter.voice = viVoice;
    window.speechSynthesis.speak(utter);
  } catch {
    // Bỏ qua nếu trình duyệt chặn autoplay
  }
}

/**
 * Phân tích cú pháp JSON từ tệp data.json (hỗ trợ cả trường hợp có bọc ```json)
 */
function parseLessonJsonText(rawText) {
  const cleaned = String(rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Nội dung tệp JSON không hợp lệ (không tìm thấy đối tượng dữ liệu bài toán).');
  }

  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch (err) {
    throw new Error(`Lỗi cú pháp trong tệp data.json: ${err.message}`);
  }
}

/**
 * Chuẩn hóa dữ liệu bài toán nạp từ tệp/thư mục để tương thích 100% với Canvas và kho bài mẫu
 */
function normalizeImportedLesson(raw, fallbackProblemText = '') {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Dữ liệu bài toán trống hoặc không đúng định dạng.');
  }

  const rawGrade = String(raw.grade || 'Toán 7').trim();
  let grade = 'Toán 7';
  if (/6/.test(rawGrade)) grade = 'Toán 6';
  else if (/7/.test(rawGrade)) grade = 'Toán 7';
  else if (/8/.test(rawGrade)) grade = 'Toán 8';
  else if (/9/.test(rawGrade)) grade = 'Toán 9';

  const geo = raw.geometry && typeof raw.geometry === 'object' ? raw.geometry : {};

  const points = Array.isArray(geo.points)
    ? geo.points.map((p, idx) => ({
        id: String(p.id || p.label || `P${idx}`),
        label: String(p.label || p.id || `P${idx}`),
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        dx: Number.isFinite(Number(p.dx)) ? Number(p.dx) : 0,
        dy: Number.isFinite(Number(p.dy)) ? Number(p.dy) : -14,
        drawStep: Number.isFinite(Number(p.drawStep)) ? Number(p.drawStep) : 0
      }))
    : [];

  if (points.length === 0) {
    throw new Error('Tệp data.json chưa có danh sách điểm tọa độ (geometry.points).');
  }

  const segments = Array.isArray(geo.segments)
    ? geo.segments.map((s) => ({
        from: String(s.from || ''),
        to: String(s.to || ''),
        style: s.style === 'dashed' ? 'dashed' : 'solid',
        color: s.color || 'main',
        ticks: Number(s.ticks) || 0,
        drawStep: Number.isFinite(Number(s.drawStep)) ? Number(s.drawStep) : 0
      }))
    : [];

  const circles = Array.isArray(geo.circles)
    ? geo.circles.map((c) => ({
        center: String(c.center || ''),
        radius: Number(c.radius) || 60,
        style: c.style === 'dashed' ? 'dashed' : 'solid',
        color: c.color || 'main',
        drawStep: Number.isFinite(Number(c.drawStep)) ? Number(c.drawStep) : 0
      }))
    : [];

  const rightAngles = Array.isArray(geo.rightAngles)
    ? geo.rightAngles.map((r) => {
        const item = {
          vertex: String(r.vertex || ''),
          p1: String(r.p1 || ''),
          p2: String(r.p2 || ''),
          drawStep: Number.isFinite(Number(r.drawStep)) ? Number(r.drawStep) : 0
        };
        if (r.solveRevealStep !== undefined && r.solveRevealStep !== null) {
          item.solveRevealStep = Number(r.solveRevealStep);
        }
        return item;
      })
    : [];

  const angleArcs = Array.isArray(geo.angleArcs)
    ? geo.angleArcs.map((a) => {
        const item = {
          vertex: String(a.vertex || ''),
          p1: String(a.p1 || ''),
          p2: String(a.p2 || ''),
          radius: Number(a.radius) || 22,
          label: String(a.label || ''),
          color: a.color || 'accent',
          drawStep: Number.isFinite(Number(a.drawStep)) ? Number(a.drawStep) : 0
        };
        if (a.solveRevealStep !== undefined && a.solveRevealStep !== null) {
          item.solveRevealStep = Number(a.solveRevealStep);
        }
        return item;
      })
    : [];

  const drawingSteps = Array.isArray(raw.drawingSteps)
    ? raw.drawingSteps.map((st, idx) => ({
        caption: String(st.caption || `Bước ${idx + 1}`),
        voiceExplanation: String(st.voiceExplanation || st.caption || `Bước ${idx + 1}`),
        tool: ['ruler', 'compass', 'protractor', 'eke'].includes(st.tool) ? st.tool : 'ruler',
        highlightSegments: Array.isArray(st.highlightSegments) ? st.highlightSegments : [],
        highlightPoints: Array.isArray(st.highlightPoints) ? st.highlightPoints : []
      }))
    : [];

  const solutionSteps = Array.isArray(raw.solutionSteps)
    ? raw.solutionSteps.map((st) => ({
        lineText: String(st.lineText || ''),
        voiceExplanation: String(st.voiceExplanation || st.lineText || ''),
        highlightSegments: Array.isArray(st.highlightSegments) ? st.highlightSegments : [],
        highlightPoints: Array.isArray(st.highlightPoints) ? st.highlightPoints : [],
        highlightPolygons: Array.isArray(st.highlightPolygons) ? st.highlightPolygons : []
      }))
    : [];

  const audioTimeline = Array.isArray(raw.audioTimeline)
    ? raw.audioTimeline.map((c, idx) => ({
        stepIndex: Number.isFinite(Number(c.stepIndex)) ? Number(c.stepIndex) : idx,
        startSec: Number(c.startSec) || 0,
        endSec: Number(c.endSec) || 0
      }))
    : [];

  return {
    id: String(raw.id || `bai-toan-${Date.now()}`).trim(),
    hasStaticAudio: Boolean(raw.hasStaticAudio),
    audioFile: raw.audioFile ? String(raw.audioFile) : '',
    audioTimeline,
    grade,
    topic: String(raw.topic || '').trim(),
    title: String(raw.title || '').trim(),
    problemText: String(raw.problemText || fallbackProblemText || '').trim(),
    given: Array.isArray(raw.given) ? raw.given.map(String) : [],
    prove: Array.isArray(raw.prove) ? raw.prove.map(String) : [],
    drawingSteps,
    geometry: {
      points,
      segments,
      circles,
      rightAngles,
      angleArcs
    },
    solutionSteps
  };
}

/**
 * Giải nén tệp .zip trực tiếp trên trình duyệt (không cần thư viện ngoài)
 */
async function extractZipEntriesBrowser(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Tệp ZIP không hợp lệ hoặc bị hỏng cấu trúc.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries = [];

  for (let idx = 0; idx < totalEntries; idx++) {
    if (cdOffset + 46 > bytes.length || view.getUint32(cdOffset, true) !== 0x02014b50) {
      break;
    }

    const compressionMethod = view.getUint16(cdOffset + 10, true);
    const compressedSize = view.getUint32(cdOffset + 20, true);
    const fileNameLen = view.getUint16(cdOffset + 28, true);
    const extraFieldLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);

    const filePath = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + fileNameLen));
    cdOffset += 46 + fileNameLen + extraFieldLen + commentLen;

    if (filePath.endsWith('/') || filePath.includes('__MACOSX/')) {
      continue;
    }

    if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      continue;
    }
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

    let rawBytes;
    if (compressionMethod === 0) {
      rawBytes = compressedSlice;
    } else if (compressionMethod === 8) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('Trình duyệt hiện tại chưa hỗ trợ giải nén Deflate. Vui lòng giải nén thư mục trước rồi chọn thư mục.');
      }
      const ds = new DecompressionStream('deflate-raw');
      const decompressedBuf = await new Response(
        new Blob([compressedSlice]).stream().pipeThrough(ds)
      ).arrayBuffer();
      rawBytes = new Uint8Array(decompressedBuf);
    } else {
      continue;
    }

    entries.push({ path: filePath, bytes: rawBytes });
  }

  return entries;
}

/**
 * Giải mã mảng byte âm thanh (MP3/WAV/OGG) thành định dạng audioEntry của ứng dụng
 */
async function decodeAudioBytesToEntry(audioBytes, fileName, audioCtx) {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'mp3';
  const mime =
    ext === 'wav'
      ? 'audio/wav'
      : ext === 'ogg'
      ? 'audio/ogg'
      : ext === 'm4a'
      ? 'audio/mp4'
      : 'audio/mpeg';

  const blob = new Blob([audioBytes], { type: mime });
  const arrayBuf = await blob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(arrayBuf);
  const floatData = decoded.getChannelData(0);
  const pcm16 = new Int16Array(floatData.length);
  for (let s = 0; s < floatData.length; s++) {
    const clamped = Math.max(-1, Math.min(1, floatData[s]));
    pcm16[s] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return {
    url: URL.createObjectURL(blob),
    pcm16,
    sampleRate: decoded.sampleRate,
    durationSec: decoded.duration
  };
}

/**
 * Cắt các đoạn âm thanh từng bước từ 1 file full_audio đã giải mã kèm audioTimeline
 */
async function sliceUnifiedAudioToStepMap(audioBytes, fileName, audioTimeline, totalSteps, audioCtx) {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'mp3';
  const mime =
    ext === 'wav'
      ? 'audio/wav'
      : ext === 'ogg'
      ? 'audio/ogg'
      : ext === 'm4a'
      ? 'audio/mp4'
      : 'audio/mpeg';

  const fullBlob = new Blob([audioBytes], { type: mime });
  const unifiedUrl = URL.createObjectURL(fullBlob);
  const arrayBuf = await fullBlob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(arrayBuf);
  const floatData = decoded.getChannelData(0);
  const sr = decoded.sampleRate;

  const stepMap = new Map();
  for (const cue of audioTimeline) {
    const idx = cue.stepIndex;
    if (idx < 0 || idx >= totalSteps) continue;
    const startSample = Math.max(0, Math.floor(cue.startSec * sr));
    const endSample = Math.min(floatData.length, Math.ceil(cue.endSec * sr));
    if (endSample <= startSample) continue;
    const sliceLen = endSample - startSample;
    const pcm16 = new Int16Array(sliceLen);
    for (let s = 0; s < sliceLen; s++) {
      const clamped = Math.max(-1, Math.min(1, floatData[startSample + s]));
      pcm16[s] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    stepMap.set(idx, {
      url: '', // Sẽ phát trực tiếp qua unifiedUrl
      pcm16,
      sampleRate: sr,
      durationSec: Number((sliceLen / sr).toFixed(2))
    });
  }

  return { unifiedUrl, stepMap };
}

export default function DraftStudioDrawer({
  isOpen,
  onClose,
  geminiApiKey,
  onOpenSettings,
  githubConfig,
  draftProblem,
  setDraftProblem,
  draftAudioMap,
  setDraftAudioMap,
  onPreviewDraftOnMainCanvas,
  onLessonSavedToGithub,
  showToast
}) {
  const [inputMode, setInputMode] = useState('file');
  const [importedSourceName, setImportedSourceName] = useState('');
  const [isImportingFiles, setIsImportingFiles] = useState(false);

  const [problemInput, setProblemInput] = useState(draftProblem?.problemText || '');
  const [imageAttachment, setImageAttachment] = useState(null);

  const zipOrFilesInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mp3ImportInputRef = useRef(null);

  const [isGeneratingStage1, setIsGeneratingStage1] = useState(false);
  const [isRefiningChat, setIsRefiningChat] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioProgressText, setAudioProgressText] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);

  const [saveGrade, setSaveGrade] = useState(draftProblem?.grade || 'Toán 7');
  const [saveTopic, setSaveTopic] = useState(draftProblem?.topic || '');
  const [saveTitle, setSaveTitle] = useState(draftProblem?.title || '');
  const [isSavingGithub, setIsSavingGithub] = useState(false);
  const [githubProgressText, setGithubProgressText] = useState('');

  if (!isOpen) return null;

  const buildAllStepsForAudio = (prob) => {
    if (!prob) return [];
    const drawItems = (prob.drawingSteps || []).map((st, idx) => ({
      type: 'drawing',
      index: idx,
      label: `Vẽ bước ${idx + 1}`,
      voiceText: st.voiceExplanation || st.caption
    }));
    const solveItems = (prob.solutionSteps || []).map((st, idx) => ({
      type: 'solving',
      index: idx,
      label: `Giải dòng ${idx + 1}`,
      voiceText: st.voiceExplanation || st.lineText
    }));
    return [...drawItems, ...solveItems];
  };

  /**
   * Tự động ghép lại 1 tệp âm thanh thống nhất + mốc thời gian mỗi khi draftAudioMap thay đổi
   */
  const rebuildUnifiedDraftAudio = async (baseProb, nextMap) => {
    if (!baseProb) return baseProb;
    const totalSteps =
      (baseProb.drawingSteps?.length || 0) + (baseProb.solutionSteps?.length || 0);

    if (baseProb._unifiedAudioUrl) {
      URL.revokeObjectURL(baseProb._unifiedAudioUrl);
    }

    if (!nextMap || nextMap.size === 0 || totalSteps === 0) {
      const updated = {
        ...baseProb,
        hasStaticAudio: false,
        audioTimeline: [],
        _unifiedAudioUrl: null
      };
      setDraftProblem(updated);
      onPreviewDraftOnMainCanvas(updated);
      return updated;
    }

    const unified = await buildUnifiedAudioPackage(totalSteps, nextMap, 0.25);
    if (!unified) return baseProb;

    const unifiedUrl = URL.createObjectURL(unified.blob);
    const updated = {
      ...baseProb,
      hasStaticAudio: true,
      audioFile: unified.fileName,
      audioTimeline: unified.audioTimeline,
      _unifiedAudioUrl: unifiedUrl
    };
    setDraftProblem(updated);
    onPreviewDraftOnMainCanvas(updated);
    return updated;
  };

  /**
   * Nạp gói bài học từ tệp .zip, data.json (+ .mp3), hoặc nguyên thư mục
   */
  const handleImportGemPackage = async (fileList, sourceLabel = '') => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setErrorBanner('');
    setIsImportingFiles(true);

    try {
      let virtualEntries = [];

      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        const zipBuf = await files[0].arrayBuffer();
        virtualEntries = await extractZipEntriesBrowser(zipBuf);
      } else {
        for (const f of files) {
          const relPath = f.webkitRelativePath || f.name;
          const buf = await f.arrayBuffer();
          virtualEntries.push({ path: relPath, bytes: new Uint8Array(buf) });
        }
      }

      const jsonEntries = virtualEntries.filter((e) =>
        e.path.toLowerCase().endsWith('.json')
      );
      const primaryJsonEntry =
        jsonEntries.find(
          (e) =>
            e.path.toLowerCase().endsWith('/data.json') ||
            e.path.toLowerCase() === 'data.json'
        ) ||
        jsonEntries.find((e) => !e.path.toLowerCase().endsWith('index.json')) ||
        jsonEntries[0];

      if (!primaryJsonEntry) {
        throw new Error(
          'Không tìm thấy tệp data.json trong gói tệp/thư mục vừa chọn. Thầy vui lòng kiểm tra lại!'
        );
      }

      const jsonText = new TextDecoder('utf-8').decode(primaryJsonEntry.bytes);
      const parsedRaw = parseLessonJsonText(jsonText);
      const normalized = normalizeImportedLesson(parsedRaw, parsedRaw?.problemText || '');

      const audioEntriesRaw = virtualEntries.filter((e) =>
        /\.(mp3|wav|ogg|m4a)$/i.test(e.path)
      );

      // Giải phóng URL cũ
      if (draftProblem?._unifiedAudioUrl) {
        URL.revokeObjectURL(draftProblem._unifiedAudioUrl);
      }
      draftAudioMap.forEach((entry) => {
        if (entry?.url) URL.revokeObjectURL(entry.url);
      });

      const nextAudioMap = new Map();
      const allSteps = buildAllStepsForAudio(normalized);
      let finalDraftObj = normalized;

      if (audioEntriesRaw.length > 0 && allSteps.length > 0) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        try {
          // Trường hợp A: Gói đã có sẵn 1 tệp full_audio + audioTimeline
          const unifiedEntry = audioEntriesRaw.find((e) =>
            /full_audio\.(mp3|wav|ogg|m4a)$/i.test(e.path)
          );

          if (unifiedEntry && normalized.audioTimeline?.length > 0) {
            const baseName = unifiedEntry.path.split('/').pop() || 'full_audio.mp3';
            const { unifiedUrl, stepMap } = await sliceUnifiedAudioToStepMap(
              unifiedEntry.bytes,
              baseName,
              normalized.audioTimeline,
              allSteps.length,
              audioCtx
            );
            stepMap.forEach((v, k) => nextAudioMap.set(k, v));
            finalDraftObj = {
              ...normalized,
              hasStaticAudio: true,
              audioFile: baseName,
              _unifiedAudioUrl: unifiedUrl
            };
          } else {
            // Trường hợp B: Gói có nhiều file rời step_0.mp3, step_1.mp3... -> Tự ghép thành 1 file thống nhất!
            audioEntriesRaw.sort((a, b) => {
              const nameA = a.path.split('/').pop() || '';
              const nameB = b.path.split('/').pop() || '';
              return nameA.localeCompare(nameB, undefined, { numeric: true });
            });

            for (const item of audioEntriesRaw) {
              const baseName = item.path.split('/').pop() || '';
              const numMatch = baseName.match(/step[_-]?(\d+)/i) || baseName.match(/^(\d+)/);
              const targetIdx = numMatch ? parseInt(numMatch[1], 10) : nextAudioMap.size;

              if (targetIdx >= 0 && targetIdx < allSteps.length) {
                const decodedEntry = await decodeAudioBytesToEntry(item.bytes, baseName, audioCtx);
                nextAudioMap.set(targetIdx, decodedEntry);
              }
            }

            if (nextAudioMap.size > 0) {
              const unified = await buildUnifiedAudioPackage(allSteps.length, nextAudioMap, 0.2);
              if (unified) {
                finalDraftObj = {
                  ...normalized,
                  hasStaticAudio: true,
                  audioFile: unified.fileName,
                  audioTimeline: unified.audioTimeline,
                  _unifiedAudioUrl: URL.createObjectURL(unified.blob)
                };
              }
            }
          }
        } finally {
          audioCtx.close().catch(() => {});
        }
      }

      setDraftProblem(finalDraftObj);
      setDraftAudioMap(nextAudioMap);
      setProblemInput(finalDraftObj.problemText || '');
      setSaveGrade(finalDraftObj.grade || 'Toán 7');
      setSaveTopic(finalDraftObj.topic || '');
      setSaveTitle(finalDraftObj.title || '');

      const displaySource =
        sourceLabel ||
        (files[0]?.webkitRelativePath
          ? files[0].webkitRelativePath.split('/')[0]
          : files.length === 1
          ? files[0].name
          : `${files.length} tệp đã chọn`);
      setImportedSourceName(displaySource);

      setChatHistory([
        {
          role: 'ai',
          text: `Đã nạp thành công gói "${displaySource}" (${finalDraftObj.geometry.points.length} điểm, ${finalDraftObj.drawingSteps.length} bước vẽ, ${finalDraftObj.solutionSteps.length} bước giải${
            nextAudioMap.size > 0 ? `, đã ghép thành 1 luồng âm thanh đồng bộ ${nextAudioMap.size} mốc thời gian` : ''
          }). Thầy điền/kiểm tra Khối lớp, Dạng toán, Tên bài bên dưới rồi bấm "Lưu ngay vào bài mẫu"!`
        }
      ]);

      onPreviewDraftOnMainCanvas(finalDraftObj);
      showToast(
        `Đã nạp đề thành công!${
          nextAudioMap.size > 0 ? ` Đã đồng bộ sẵn ${nextAudioMap.size} mốc âm thanh.` : ''
        }`
      );
    } catch (err) {
      setErrorBanner(err.message || 'Lỗi khi đọc tệp/thư mục bài học.');
    } finally {
      setIsImportingFiles(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const match = result.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        setImageAttachment({
          name: file.name,
          mimeType: match[1],
          base64: match[2],
          previewUrl: result
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunStage1GeometryAndSolution = async () => {
    if (!problemInput.trim() && !imageAttachment) {
      setErrorBanner('Vui lòng nhập nội dung đề bài hoặc tải ảnh đề bài lên trước.');
      return;
    }
    if (!geminiApiKey?.trim()) {
      onOpenSettings();
      showToast('Vui lòng nhập Gemini API Key để sử dụng AI.');
      return;
    }

    setErrorBanner('');
    setIsGeneratingStage1(true);
    try {
      const generated = await generateGeometryAndSolution({
        problemText: problemInput,
        imageAttachment,
        apiKey: geminiApiKey.trim()
      });

      setDraftAudioMap(new Map());
      setDraftProblem(generated);
      setImportedSourceName('');
      setSaveGrade(generated.grade || 'Toán 7');
      setSaveTopic(generated.topic || 'Hình học THCS');
      setSaveTitle(generated.title || 'Bài toán hình học mới');
      setChatHistory([
        {
          role: 'ai',
          text: `Đã dựng xong ${generated.geometry.points.length} điểm, ${generated.drawingSteps.length} bước vẽ và ${generated.solutionSteps.length} bước giải. Thầy có thể kiểm tra Khối lớp, Dạng toán, Tên bài và bấm "Lưu vào bài mẫu"!`
        }
      ]);
      onPreviewDraftOnMainCanvas(generated);
      showToast('Đã tạo xong Hình vẽ, GT-KL và Lời giải!');
    } catch (err) {
      setErrorBanner(err.message || 'Lỗi không xác định khi gọi Gemini API.');
    } finally {
      setIsGeneratingStage1(false);
    }
  };

  const handleSendRefineChat = async (customText) => {
    const instruction = (customText ?? chatInput).trim();
    if (!instruction || !draftProblem || isRefiningChat) return;
    if (!geminiApiKey?.trim()) {
      onOpenSettings();
      return;
    }

    setChatInput('');
    setErrorBanner('');
    setChatHistory((prev) => [...prev, { role: 'user', text: instruction }]);
    setIsRefiningChat(true);

    try {
      const updated = await refineDraftProblemWithChat({
        currentDraft: draftProblem,
        userInstruction: instruction,
        apiKey: geminiApiKey.trim()
      });
      const preserved = {
        ...updated,
        hasStaticAudio: draftProblem.hasStaticAudio,
        audioFile: draftProblem.audioFile,
        audioTimeline: draftProblem.audioTimeline,
        _unifiedAudioUrl: draftProblem._unifiedAudioUrl
      };
      setDraftProblem(preserved);
      onPreviewDraftOnMainCanvas(preserved);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'ai',
          text: 'Đã cập nhật hình vẽ và lời giải theo yêu cầu của thầy!'
        }
      ]);
      showToast('Đã cập nhật bản nháp theo yêu cầu!');
    } catch (err) {
      setErrorBanner(err.message || 'Lỗi khi hiệu chỉnh bằng AI.');
      setChatHistory((prev) => [
        ...prev,
        { role: 'ai', text: `Chưa sửa được: ${err.message}` }
      ]);
    } finally {
      setIsRefiningChat(false);
    }
  };

  const handleRunStage2GenerateAudio = async (singleStepIndex = null) => {
    if (!draftProblem) return;
    if (!geminiApiKey?.trim()) {
      onOpenSettings();
      return;
    }

    const allSteps = buildAllStepsForAudio(draftProblem);
    if (allSteps.length === 0) return;

    setErrorBanner('');
    setIsGeneratingAudio(true);

    try {
      if (singleStepIndex !== null) {
        const stepObj = allSteps[singleStepIndex];
        setAudioProgressText(`Đang tạo lại giọng đọc bước ${singleStepIndex + 1}...`);
        const singleRes = await generateStepAudioTTS({
          text: stepObj.voiceText,
          apiKey: geminiApiKey.trim(),
          onCooldownTick: (sec) => {
            if (sec > 0) setAudioProgressText(`Đợi nhịp API, tự chạy lại sau ${sec}s...`);
          }
        });
        const nextMap = new Map(draftAudioMap);
        nextMap.set(singleStepIndex, singleRes);
        setDraftAudioMap(nextMap);
        await rebuildUnifiedDraftAudio(draftProblem, nextMap);
        showToast(`Đã tạo xong âm thanh bước ${singleStepIndex + 1} và ghép vào tệp chung!`);
      } else {
        const nextMap = new Map(draftAudioMap);
        let createdCount = 0;
        for (let idx = 0; idx < allSteps.length; idx++) {
          if (nextMap.has(idx)) continue;
          const stepObj = allSteps[idx];
          setAudioProgressText(`Đang tạo giọng đọc bước ${idx + 1}/${allSteps.length}...`);
          const singleRes = await generateStepAudioTTS({
            text: stepObj.voiceText,
            apiKey: geminiApiKey.trim(),
            onCooldownTick: (sec) => {
              if (sec > 0) {
                setAudioProgressText(`API tạm nghỉ tránh quá tải, tự chạy bước ${idx + 1}/${allSteps.length} sau ${sec}s...`);
              }
            }
          });
          nextMap.set(idx, singleRes);
          setDraftAudioMap(new Map(nextMap));
          createdCount++;
        }
        setAudioProgressText('Đang ghép thành 1 tệp âm thanh đồng bộ...');
        await rebuildUnifiedDraftAudio(draftProblem, nextMap);
        showToast(`Hoàn tất! Đã ghép đủ ${nextMap.size}/${allSteps.length} đoạn thuyết minh thành 1 tệp duy nhất${createdCount > 0 ? ` (tạo mới ${createdCount} bước)` : ''}.`);
      }
      setAudioProgressText('');
    } catch (err) {
      setErrorBanner(err.message || 'Lỗi khi tạo âm thanh.');
      setAudioProgressText('');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleImportOfflineAudioFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !draftProblem) return;
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const allSteps = buildAllStepsForAudio(draftProblem);
    const nextMap = new Map(draftAudioMap);
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const numMatch = file.name.match(/step[_-]?(\d+)/i) || file.name.match(/^(\d+)/);
        const targetIdx = numMatch ? parseInt(numMatch[1], 10) : i;
        if (targetIdx >= 0 && targetIdx < allSteps.length) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const entry = await decodeAudioBytesToEntry(bytes, file.name, audioCtx);
          nextMap.set(targetIdx, entry);
        }
      }
      setDraftAudioMap(nextMap);
      await rebuildUnifiedDraftAudio(draftProblem, nextMap);
      showToast(`Đã nạp ${files.length} tệp âm thanh và ghép thành 1 tệp đồng bộ!`);
    } catch (err) {
      setErrorBanner(`Lỗi đọc file âm thanh: ${err.message}`);
    } finally {
      audioCtx.close().catch(() => {});
      e.target.value = '';
    }
  };

  const handleDiscardDraft = () => {
    if (draftProblem?._unifiedAudioUrl) {
      URL.revokeObjectURL(draftProblem._unifiedAudioUrl);
    }
    draftAudioMap.forEach((entry) => {
      if (entry?.url) URL.revokeObjectURL(entry.url);
    });
    setDraftAudioMap(new Map());
    setDraftProblem(null);
    setImportedSourceName('');
    setProblemInput('');
    setImageAttachment(null);
    setChatHistory([]);
    setErrorBanner('');
    showToast('Đã hủy bản nháp. Không có dữ liệu nào được lưu.');
    onClose();
  };

  const handleConfirmSaveToGithub = async () => {
    if (!draftProblem) return;
    if (!saveTitle.trim()) {
      setErrorBanner('Vui lòng nhập Tên bài trước khi lưu.');
      return;
    }
    if (!githubConfig?.token || !githubConfig?.owner || !githubConfig?.repo) {
      onOpenSettings();
      showToast('Vui lòng cấu hình GitHub Token & Repository trước khi lưu bài mẫu.');
      return;
    }

    setIsSavingGithub(true);
    setErrorBanner('');
    try {
      const allSteps = buildAllStepsForAudio(draftProblem);
      const result = await saveLessonDirectToGithub({
        config: githubConfig,
        lessonData: draftProblem,
        metadata: {
          grade: saveGrade,
          topic: saveTopic.trim() || 'Hình học phẳng THCS',
          title: saveTitle.trim()
        },
        timelineItems: allSteps,
        audioEntriesMap: draftAudioMap,
        onProgress: (msg) => setGithubProgressText(msg)
      });

      setGithubProgressText('');
      showToast(`Đã lưu bài "${saveTitle}" (1 file âm thanh duy nhất) lên GitHub!`);
      onLessonSavedToGithub(result.lesson, result.catalogItem);
    } catch (err) {
      setErrorBanner(err.message || 'Lỗi khi lưu bài lên GitHub.');
      setGithubProgressText('');
    } finally {
      setIsSavingGithub(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!draftProblem) return;
    try {
      const allSteps = buildAllStepsForAudio(draftProblem);
      await downloadLessonZipBackup({
        lessonData: draftProblem,
        metadata: {
          grade: saveGrade,
          topic: saveTopic.trim() || draftProblem.topic,
          title: saveTitle.trim() || draftProblem.title
        },
        timelineItems: allSteps,
        audioEntriesMap: draftAudioMap
      });
      showToast('Đã tải gói bài học (.zip với 1 file full_audio.mp3) về máy!');
    } catch (err) {
      setErrorBanner(err.message);
    }
  };

  const previewSingleCue = (idx) => {
    const entry = draftAudioMap.get(idx);
    if (entry?.url) {
      new Audio(entry.url).play();
      return;
    }
    const cue = draftProblem?.audioTimeline?.find((c) => c.stepIndex === idx);
    if (draftProblem?._unifiedAudioUrl && cue) {
      const audio = new Audio(draftProblem._unifiedAudioUrl);
      audio.currentTime = cue.startSec;
      audio.play();
      const checkStop = () => {
        if (audio.currentTime >= cue.endSec || audio.paused) {
          audio.pause();
        } else {
          requestAnimationFrame(checkStop);
        }
      };
      requestAnimationFrame(checkStop);
    }
  };

  const allAudioSteps = buildAllStepsForAudio(draftProblem);
  const readyAudioCount = allAudioSteps.filter((_, idx) => draftAudioMap.has(idx)).length;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-slate-950/98 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <PenTool className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Nạp Đề Mới & Hiệu Chỉnh Bài Mẫu</h2>
            <p className="text-[11px] text-slate-400">
              Tự động ghép 1 file âm thanh duy nhất + mốc thời gian chuẩn xác
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          title="Thu gọn bảng soạn thảo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {errorBanner && (
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorBanner}</div>
          </div>
        )}

        {/* Chuyển đổi phương thức nạp đề */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setInputMode('file')}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
              inputMode === 'file'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Nạp bằng File / Thư mục</span>
          </button>
          <button
            onClick={() => setInputMode('ai')}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
              inputMode === 'ai'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tạo trực tiếp qua API</span>
          </button>
        </div>

        {/* PHƯƠNG THỨC 1: NẠP BẰNG FILE / THƯ MỤC */}
        {inputMode === 'file' && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Tải gói bài học lên (ZIP / JSON / Thư mục)
              </span>
              {importedSourceName && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium truncate max-w-[180px]">
                  ✓ {importedSourceName}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => zipOrFilesInputRef.current?.click()}
                disabled={isImportingFiles}
                className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-dashed border-emerald-500/50 hover:border-emerald-400 flex flex-col items-center justify-center gap-1.5 text-center transition group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-100">
                  Chọn tệp .ZIP hoặc data.json
                </div>
                <div className="text-[11px] text-slate-400">
                  Hỗ trợ cả full_audio.mp3 lẫn các tệp step_*.mp3
                </div>
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                disabled={isImportingFiles}
                className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-dashed border-sky-500/50 hover:border-sky-400 flex flex-col items-center justify-center gap-1.5 text-center transition group"
              >
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center group-hover:scale-105 transition">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-100">
                  Chọn cả Thư mục bài học
                </div>
                <div className="text-[11px] text-slate-400">
                  Tự động ghép thành 1 file âm thanh duy nhất
                </div>
              </button>
            </div>

            <input
              ref={zipOrFilesInputRef}
              type="file"
              accept=".zip,.json,.mp3,.wav,.ogg,.m4a,application/zip,application/json,audio/*"
              multiple
              onChange={(e) => {
                handleImportGemPackage(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />

            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={(e) => {
                handleImportGemPackage(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />

            {isImportingFiles && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-emerald-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang giải nén, ghép âm thanh và đồng bộ mốc thời gian...</span>
              </div>
            )}
          </div>
        )}

        {/* PHƯƠNG THỨC 2: TẠO TRỰC TIẾP QUA GEMINI API */}
        {inputMode === 'ai' && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Nạp đề → AI tự dựng Hình vẽ & Lời giải
              </span>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Tải ảnh đề</span>
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <textarea
              rows={3}
              value={problemInput}
              onChange={(e) => setProblemInput(e.target.value)}
              placeholder="Dán đề bài hình học THCS vào đây (VD: Cho tam giác ABC cân tại A, đường cao AH...)..."
              className="w-full rounded-xl bg-slate-950 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />

            {imageAttachment && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-sky-300 truncate">{imageAttachment.name}</span>
                <button
                  onClick={() => setImageAttachment(null)}
                  className="text-slate-400 hover:text-rose-400 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={handleRunStage1GeometryAndSolution}
              disabled={isGeneratingStage1}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-60 text-white shadow-lg shadow-sky-950/50"
            >
              {isGeneratingStage1 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang phân tích đề, dựng tọa độ & giải toán...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Tạo Hình vẽ & Lời giải</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* KHUNG ĐIỀN THÔNG TIN LỚP • DẠNG TOÁN • TÊN BÀI & LƯU NGAY */}
        {draftProblem && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-b from-amber-950/35 to-slate-900/95 border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <FileJson className="w-3.5 h-3.5" />
                <span>Thông tin lưu kho bài mẫu</span>
              </span>
              <button
                onClick={() => onPreviewDraftOnMainCanvas(draftProblem)}
                className="text-[11px] text-sky-400 hover:underline font-medium"
              >
                Xem hình trên bảng chính
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Khối lớp *</label>
                <select
                  value={saveGrade}
                  onChange={(e) => setSaveGrade(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                >
                  <option value="Toán 6">Toán 6</option>
                  <option value="Toán 7">Toán 7</option>
                  <option value="Toán 8">Toán 8</option>
                  <option value="Toán 9">Toán 9</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Dạng toán / Chuyên đề *</label>
                <input
                  type="text"
                  value={saveTopic}
                  onChange={(e) => setSaveTopic(e.target.value)}
                  placeholder="VD: Tam giác vuông, Tam giác cân..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 mb-1 font-semibold">Tên bài toán *</label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="VD: Tính cạnh huyền và đường cao trong tam giác vuông..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleConfirmSaveToGithub}
              disabled={isSavingGithub}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 text-slate-950 shadow-lg"
            >
              {isSavingGithub ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{githubProgressText || 'Đang đẩy bài mẫu lên GitHub...'}</span>
                </>
              ) : (
                <>
                  <Github className="w-4 h-4" />
                  <span>Lưu ngay vào bài mẫu (1 tệp full_audio.mp3)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* QUẢN LÝ ÂM THANH & MỐC THỜI GIAN */}
        {draftProblem && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5" />
                <span>Mốc thời gian âm thanh ({readyAudioCount}/{allAudioSteps.length} bước)</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => mp3ImportInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700"
                  title="Chọn thêm các file MP3 từ máy tính"
                >
                  <FileAudio className="w-3.5 h-3.5" />
                  <span>Nạp MP3</span>
                </button>
                <button
                  onClick={() => handleRunStage2GenerateAudio(null)}
                  disabled={isGeneratingAudio}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                  title="Tạo giọng đọc AI cho các bước còn thiếu"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Tạo giọng AI</span>
                </button>
              </div>
              <input
                ref={mp3ImportInputRef}
                type="file"
                accept="audio/*"
                multiple
                onChange={handleImportOfflineAudioFiles}
                className="hidden"
              />
            </div>

            {isGeneratingAudio && audioProgressText && (
              <div className="flex items-center gap-2 text-xs text-emerald-300 px-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{audioProgressText}</span>
              </div>
            )}

            <div className="max-h-44 overflow-y-auto divide-y divide-slate-800/80 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              {allAudioSteps.map((st, idx) => {
                const entry = draftAudioMap.get(idx);
                const cue = draftProblem.audioTimeline?.find((c) => c.stepIndex === idx);
                return (
                  <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-200 truncate flex items-center gap-2">
                        <span>{st.label}</span>
                        {cue && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                            {cue.startSec.toFixed(1)}s → {cue.endSec.toFixed(1)}s
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{st.voiceText}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {entry || cue ? (
                        <button
                          onClick={() => previewSingleCue(idx)}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-medium"
                        >
                          Nghe ({entry?.durationSec?.toFixed(1) || (cue ? (cue.endSec - cue.startSec).toFixed(1) : '0')}s)
                        </button>
                      ) : (
                        <button
                          onClick={() => speakVietnameseBrowserFallback(st.voiceText)}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                        >
                          Nghe thử
                        </button>
                      )}
                      <button
                        onClick={() => handleRunStage2GenerateAudio(idx)}
                        disabled={isGeneratingAudio}
                        title="Tạo lại âm thanh AI riêng bước này"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHAT VỚI AI ĐỂ HIỆU CHỈNH THÊM NẾU CẦN */}
        {draftProblem && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5 text-amber-400" />
                <span>Chỉnh sửa nhanh bằng AI (Tùy chọn)</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_EDIT_SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSendRefineChat(sug)}
                  disabled={isRefiningChat}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/70 transition"
                >
                  {sug}
                </button>
              ))}
            </div>

            {chatHistory.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-sky-950/60 border border-sky-800/50 text-sky-100 ml-6'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 mr-6'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
                {isRefiningChat && (
                  <div className="flex items-center gap-2 text-amber-300 text-[11px] px-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI đang chỉnh lại tọa độ và lời giải...</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendRefineChat()}
                placeholder="Nhắn AI sửa hình/lời giải nếu cần..."
                className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => handleSendRefineChat()}
                disabled={isRefiningChat || !chatInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 font-bold text-xs flex items-center gap-1 border border-slate-700"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Sửa</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-2">
        <button
          onClick={handleDiscardDraft}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-700"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Hủy (Không lưu)</span>
        </button>

        {draftProblem && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              title="Tải gói file rời gồm 1 tệp full_audio.mp3 về máy tính"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải ZIP</span>
            </button>
            <button
              onClick={handleConfirmSaveToGithub}
              disabled={isSavingGithub}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg"
            >
              <FolderPlus className="w-4 h-4" />
              <span>{isSavingGithub ? 'Đang lưu...' : 'Lưu vào bài mẫu'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
