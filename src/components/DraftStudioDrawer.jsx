import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Send,
  Headphones,
  CheckCircle2,
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
  generateBatchLessonAudioTTS,
  generateStepAudioTTS,
  speakWithBrowserVietnameseVoice,
  extractAndParseJson,
  normalizeProblemData
} from '../services/geminiService.js';
import {
  saveLessonDirectToGithub,
  downloadLessonZipBackup
} from '../services/githubStorageService.js';

const QUICK_EDIT_SUGGESTIONS = [
  'Kéo đỉnh phía trên cao thêm một chút cho cân đối',
  'Đổi nét đường phụ thành nét đứt màu xanh',
  'Rút gọn lời giải ngắn gọn, súc tích hơn',
  'Kiểm tra lại ký hiệu góc vuông và đoạn bằng nhau'
];

/**
 * Giải nén tệp .zip trực tiếp trên trình duyệt (không cần thư viện ngoài)
 * Trả về mảng [{ path: string, bytes: Uint8Array }]
 */
async function extractZipEntriesBrowser(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  // Tìm End of Central Directory (0x06054b50)
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

    // Bỏ qua thư mục rỗng và file hệ thống macOS
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
  // Tab nạp đề: 'file' (Nạp từ file/thư mục Gem) hoặc 'ai' (Tạo trực tiếp bằng API)
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

  // Thông tin metadata (Khối lớp, Dạng toán, Tên bài) hiển thị trực tiếp để giáo viên điền nhanh
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
   * Xử lý nạp đề từ File (.zip, data.json + .mp3) hoặc cả Thư mục (webkitdirectory) tạo từ Gem
   */
  const handleImportGemPackage = async (fileList, sourceLabel = '') => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setErrorBanner('');
    setIsImportingFiles(true);

    try {
      // Thu thập danh sách [{ path, bytes }] từ ZIP hoặc từ danh sách file/thư mục
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

      // 1. Tìm tệp JSON cấu trúc bài toán (ưu tiên data.json, hoặc file .json bất kỳ không phải index.json)
      const jsonEntries = virtualEntries.filter((e) =>
        e.path.toLowerCase().endsWith('.json')
      );
      const primaryJsonEntry =
        jsonEntries.find((e) => e.path.toLowerCase().endsWith('/data.json') || e.path.toLowerCase() === 'data.json') ||
        jsonEntries.find((e) => !e.path.toLowerCase().endsWith('index.json')) ||
        jsonEntries[0];

      if (!primaryJsonEntry) {
        throw new Error(
          'Không tìm thấy tệp data.json trong gói tệp/thư mục vừa chọn. Thầy vui lòng kiểm tra lại cấu trúc file từ Gem!'
        );
      }

      const jsonText = new TextDecoder('utf-8').decode(primaryJsonEntry.bytes);
      const parsedRaw = extractAndParseJson(jsonText);
      const normalized = normalizeProblemData(parsedRaw, parsedRaw?.problemText || '');

      // Giữ lại ID gốc nếu Gem đã đặt chuẩn (không phải draft_...)
      if (parsedRaw?.id && typeof parsedRaw.id === 'string') {
        normalized.id = parsedRaw.id.trim();
      }

      // 2. Tìm tất cả các tệp âm thanh (.mp3, .wav, .ogg, .m4a) trong gói/thư mục
      const audioEntriesRaw = virtualEntries.filter((e) =>
        /\.(mp3|wav|ogg|m4a)$/i.test(e.path)
      );

      // Giải phóng audio URL cũ nếu có
      draftAudioMap.forEach((entry) => {
        if (entry?.url) URL.revokeObjectURL(entry.url);
      });

      const nextAudioMap = new Map();
      const allSteps = buildAllStepsForAudio(normalized);

      if (audioEntriesRaw.length > 0 && allSteps.length > 0) {
        // Sắp xếp theo số bước trong tên file (step_0.mp3, step_1.mp3... hoặc thứ tự tự nhiên)
        audioEntriesRaw.sort((a, b) => {
          const nameA = a.path.split('/').pop() || '';
          const nameB = b.path.split('/').pop() || '';
          return nameA.localeCompare(nameB, undefined, { numeric: true });
        });

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        try {
          for (const item of audioEntriesRaw) {
            const baseName = item.path.split('/').pop() || '';
            const numMatch = baseName.match(/step[_-]?(\d+)/i) || baseName.match(/^(\d+)/);
            const targetIdx = numMatch ? parseInt(numMatch[1], 10) : nextAudioMap.size;

            if (targetIdx >= 0 && targetIdx < allSteps.length) {
              const decodedEntry = await decodeAudioBytesToEntry(item.bytes, baseName, audioCtx);
              nextAudioMap.set(targetIdx, decodedEntry);
            }
          }
        } finally {
          audioCtx.close().catch(() => {});
        }
      }

      setDraftProblem(normalized);
      setDraftAudioMap(nextAudioMap);
      setProblemInput(normalized.problemText || '');
      setSaveGrade(normalized.grade || 'Toán 7');
      setSaveTopic(normalized.topic || '');
      setSaveTitle(normalized.title || '');

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
          text: `Đã nạp thành công gói "${displaySource}" (${normalized.geometry.points.length} điểm, ${normalized.drawingSteps.length} bước vẽ, ${normalized.solutionSteps.length} bước giải${
            nextAudioMap.size > 0 ? `, kèm ${nextAudioMap.size} tệp âm thanh` : ''
          }). Thầy chỉ cần kiểm tra Khối lớp, Dạng toán, Tên bài bên dưới rồi bấm "Lưu vào bài mẫu"!`
        }
      ]);

      onPreviewDraftOnMainCanvas(normalized);
      showToast(
        `Đã nạp đề thành công!${
          nextAudioMap.size > 0 ? ` Đã gắn sẵn ${nextAudioMap.size} file âm thanh.` : ''
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

  // ĐỢT 1 (Nếu dùng API trực tiếp): Tạo Hình vẽ, GT-KL & Lời giải
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

  // Chat trực tiếp với AI để chỉnh bản nháp
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
      setDraftProblem(updated);
      onPreviewDraftOnMainCanvas(updated);
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

  // Tạo âm thanh GỘP 1 LƯỢT API (nếu không dùng file MP3 có sẵn)
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
        showToast(`Đã tạo xong âm thanh bước ${singleStepIndex + 1}!`);
      } else {
        setAudioProgressText(`Đang tạo gộp giọng đọc cho cả ${allSteps.length} bước trong 1 lượt API...`);
        const batchSegments = await generateBatchLessonAudioTTS({
          steps: allSteps,
          apiKey: geminiApiKey.trim(),
          onCooldownTick: (sec) => {
            if (sec > 0) {
              setAudioProgressText(`API tạm nghỉ tránh quá tải, tự tiếp tục sau ${sec}s...`);
            }
          }
        });

        const nextMap = new Map();
        batchSegments.forEach((seg, idx) => {
          nextMap.set(idx, seg);
        });
        setDraftAudioMap(nextMap);
        showToast(`Hoàn tất! Đã tạo xong ${batchSegments.length} đoạn thuyết minh.`);
      }
      setAudioProgressText('');
    } catch (err) {
      setErrorBanner(err.message || 'Lỗi khi tạo âm thanh.');
      setAudioProgressText('');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Nạp thêm file MP3/WAV lẻ cho các bước
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
      showToast(`Đã nạp ${files.length} tệp âm thanh từ máy tính!`);
    } catch (err) {
      setErrorBanner(`Lỗi đọc file âm thanh: ${err.message}`);
    } finally {
      audioCtx.close().catch(() => {});
      e.target.value = '';
    }
  };

  const handleDiscardDraft = () => {
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
      showToast(`Đã lưu bài "${saveTitle}" thẳng lên GitHub! Web sẽ tự cập nhật sau ~30 giây.`);
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
      showToast('Đã tải gói bài học (.zip) về máy!');
    } catch (err) {
      setErrorBanner(err.message);
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
              Nạp từ file/thư mục Gem hoặc tạo trực tiếp bằng AI
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
            <span>Nạp bằng File / Thư mục (Gem)</span>
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

        {/* PHƯƠNG THỨC 1: NẠP BẰNG FILE / THƯ MỤC TỪ GEM */}
        {inputMode === 'file' && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Chọn gói bài học đã tạo từ Gem
              </span>
              {importedSourceName && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium truncate max-w-[180px]">
                  ✓ {importedSourceName}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Nút 1: Chọn file .zip hoặc data.json + .mp3 */}
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
                  Hỗ trợ chọn 1 file .zip hoặc chọn cùng lúc data.json + các file .mp3
                </div>
              </button>

              {/* Nút 2: Chọn cả thư mục */}
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
                  Tự quét data.json & thư mục con audio/step_*.mp3 bên trong
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
                <span>Đang giải nén và kiểm tra cấu trúc hình vẽ, lời giải, âm thanh...</span>
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

        {/* KHUNG ĐIỀN THÔNG TIN LỚP • DẠNG TOÁN • TÊN BÀI & LƯU NGAY (HIỂN THỊ KHI ĐÃ CÓ BẢN NHÁP) */}
        {draftProblem && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-b from-amber-950/35 to-slate-900/95 border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <FileJson className="w-3.5 h-3.5" />
                <span>Thông tin lưu kho bài mẫu (Chỉ cần điền 3 mục này)</span>
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
                  <span>Lưu ngay vào bài mẫu (GitHub)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* QUẢN LÝ ÂM THANH TỪNG BƯỚC (TỰ NHẬN MP3 TỪ GÓI GEM HOẶC NẠP BỔ SUNG) */}
        {draftProblem && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5" />
                <span>Âm thanh ({readyAudioCount}/{allAudioSteps.length} bước)</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => mp3ImportInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700"
                  title="Chọn thêm các file step_0.mp3, step_1.mp3... từ máy tính"
                >
                  <FileAudio className="w-3.5 h-3.5" />
                  <span>Nạp thêm MP3</span>
                </button>
                <button
                  onClick={() => handleRunStage2GenerateAudio(null)}
                  disabled={isGeneratingAudio}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
                  title="Tạo gộp giọng đọc AI cho toàn bài trong 1 lượt API"
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

            <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/80 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              {allAudioSteps.map((st, idx) => {
                const entry = draftAudioMap.get(idx);
                return (
                  <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-200 truncate">{st.label}</div>
                      <div className="text-[11px] text-slate-400 truncate">{st.voiceText}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {entry?.url ? (
                        <button
                          onClick={() => new Audio(entry.url).play()}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-medium"
                        >
                          Nghe ({entry.durationSec?.toFixed(1)}s)
                        </button>
                      ) : (
                        <button
                          onClick={() => speakWithBrowserVietnameseVoice(st.voiceText)}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                          title="Nghe thử bằng giọng đọc miễn phí của trình duyệt"
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
              title="Tải gói file rời về máy tính"
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
