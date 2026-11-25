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
  FolderPlus
} from 'lucide-react';
import {
  generateGeometryAndSolution,
  refineDraftProblemWithChat,
  generateStepAudioTTS
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

export default function DraftStudioDrawer({
  isOpen,
  onClose,
  geminiApiKey,
  onOpenSettings,
  githubConfig,
  draftProblem,
  setDraftProblem,
  draftAudioMap, // Map<stepIndex, { url, pcm16, sampleRate, durationSec }>
  setDraftAudioMap,
  onPreviewDraftOnMainCanvas,
  onLessonSavedToGithub,
  showToast
}) {
  // Bước 1: Nhập đề
  const [problemInput, setProblemInput] = useState(draftProblem?.problemText || '');
  const [imageAttachment, setImageAttachment] = useState(null);
  const fileInputRef = useRef(null);

  // Trạng thái xử lý AI Đợt 1 & Đợt 2
  const [isGeneratingStage1, setIsGeneratingStage1] = useState(false);
  const [isRefiningChat, setIsRefiningChat] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioProgressText, setAudioProgressText] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  // Chat hiệu chỉnh với AI
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);

  // Modal xác nhận lưu vào bài mẫu trên GitHub
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveGrade, setSaveGrade] = useState('Toán 7');
  const [saveTopic, setSaveTopic] = useState('');
  const [saveTitle, setSaveTitle] = useState('');
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

  // ĐỢT 1: Tạo Hình vẽ, GT-KL & Lời giải
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

      // Xóa audio cũ nếu tạo đề mới hoàn toàn
      setDraftAudioMap(new Map());
      setDraftProblem(generated);
      setSaveGrade(generated.grade || 'Toán 7');
      setSaveTopic(generated.topic || 'Hình học THCS');
      setSaveTitle(generated.title || 'Bài toán hình học mới');
      setChatHistory([
        {
          role: 'ai',
          text: `Đã dựng xong ${generated.geometry.points.length} điểm, ${generated.drawingSteps.length} bước vẽ và ${generated.solutionSteps.length} bước giải. Thầy có thể xem hình trên bảng và nhắn yêu cầu chỉnh sửa ngay bên dưới!`
        }
      ]);
      onPreviewDraftOnMainCanvas(generated);
      showToast('Đợt 1 hoàn tất: Đã tạo Hình vẽ, GT-KL và Lời giải (đang lưu tạm trên RAM).');
    } catch (err) {
      setErrorBanner(err.message || 'Lỗi không xác định khi gọi Gemini API.');
    } finally {
      setIsGeneratingStage1(false);
    }
  };

  // GIAI ĐOẠN HIỆU CHỈNH: Chat trực tiếp với AI để chỉnh bản nháp
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
          text: 'Đã cập nhật hình vẽ và lời giải theo yêu cầu của thầy! Nếu đã chuẩn, thầy hãy bấm "2. Tạo Âm thanh".'
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

  // ĐỢT 2: Tạo âm thanh từng bước (chỉ chạy sau khi hình & lời giải đã ưng ý)
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
      const nextMap = new Map(draftAudioMap);
      const indicesToRun =
        singleStepIndex !== null ? [singleStepIndex] : allSteps.map((_, idx) => idx);

      for (let i = 0; i < indicesToRun.length; i++) {
        const idx = indicesToRun[i];
        const stepObj = allSteps[idx];
        setAudioProgressText(`Đang tạo giọng đọc bước ${idx + 1}/${allSteps.length} (${stepObj.label})...`);

        const audioResult = await generateStepAudioTTS({
          text: stepObj.voiceText,
          apiKey: geminiApiKey.trim(),
          onCooldownTick: (sec) => {
            if (sec > 0) {
              setAudioProgressText(`API tạm nghỉ tránh quá tải, tự tiếp tục sau ${sec}s...`);
            }
          }
        });

        nextMap.set(idx, audioResult);
        setDraftAudioMap(new Map(nextMap));
      }

      setAudioProgressText('');
      showToast('Đợt 2 hoàn tất: Đã tạo xong toàn bộ âm thanh thuyết minh!');
    } catch (err) {
      setErrorBanner(err.message || 'Lỗi khi tạo âm thanh.');
      setAudioProgressText('');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // HỦY BỎ: Xóa sạch khỏi RAM, không lưu gì cả
  const handleDiscardDraft = () => {
    draftAudioMap.forEach((entry) => {
      if (entry?.url) URL.revokeObjectURL(entry.url);
    });
    setDraftAudioMap(new Map());
    setDraftProblem(null);
    setProblemInput('');
    setImageAttachment(null);
    setChatHistory([]);
    setErrorBanner('');
    showToast('Đã hủy bản nháp. Không có dữ liệu nào được lưu.');
    onClose();
  };

  // LƯU THẲNG LÊN GITHUB
  const handleConfirmSaveToGithub = async () => {
    if (!draftProblem) return;
    if (!saveTitle.trim()) {
      setErrorBanner('Vui lòng nhập Tên bài trước khi lưu.');
      return;
    }
    if (!githubConfig?.token || !githubConfig?.owner || !githubConfig?.repo) {
      setSaveModalOpen(false);
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

      setSaveModalOpen(false);
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
            <h2 className="text-sm font-bold text-white">Soạn & Hiệu Chỉnh Đề Mới (Bản Nháp)</h2>
            <p className="text-[11px] text-slate-400">
              Chưa lưu vào kho mẫu cho tới khi thầy bấm "Lưu vào bài mẫu"
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          title="Thu gọn bảng soạn thảo (giữ nguyên bản nháp)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nội dung cuộn */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {errorBanner && (
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorBanner}</div>
          </div>
        )}

        {/* BƯỚC 1 & ĐỢT 1 */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
              Bước 1 & Đợt 1: Nạp đề → Tạo Hình vẽ & Lời giải
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Tải ảnh đề</span>
            </button>
            <input
              ref={fileInputRef}
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
                <span>1. Tạo Hình vẽ & Lời giải</span>
              </>
            )}
          </button>
        </div>

        {/* BƯỚC 2: CHAT VỚI AI ĐỂ HIỆU CHỈNH */}
        {draftProblem && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5" />
                <span>Chat với AI để hiệu chỉnh hình vẽ & lời giải</span>
              </span>
              <button
                onClick={() => onPreviewDraftOnMainCanvas(draftProblem)}
                className="text-[11px] text-sky-400 hover:underline"
              >
                Xem trên bảng chính
              </button>
            </div>

            {/* Gợi ý nhanh */}
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

            {/* Lịch sử chat hiệu chỉnh */}
            <div className="max-h-40 overflow-y-auto space-y-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
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

            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendRefineChat()}
                placeholder="Nhắn AI sửa hình/lời giải (VD: Kéo điểm M sang trái, thêm góc vuông...)"
                className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => handleSendRefineChat()}
                disabled={isRefiningChat || !chatInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Sửa</span>
              </button>
            </div>
          </div>
        )}

        {/* BƯỚC 3 (ĐỢT 2): TẠO ÂM THANH TỪNG BƯỚC */}
        {draftProblem && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5" />
                <span>Đợt 2: Tạo Âm thanh Thuyết minh ({readyAudioCount}/{allAudioSteps.length} bước)</span>
              </span>
            </div>

            <button
              onClick={() => handleRunStage2GenerateAudio(null)}
              disabled={isGeneratingAudio}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-60 text-slate-950 shadow-lg"
            >
              {isGeneratingAudio ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{audioProgressText || 'Đang tạo âm thanh giọng nữ miền Bắc...'}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>2. Tạo Âm thanh toàn bộ bài</span>
                </>
              )}
            </button>

            {/* Danh sách từng bước âm thanh (nghe thử hoặc tạo lại riêng 1 bước) */}
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-800/80 rounded-xl bg-slate-950 border border-slate-800 text-xs">
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
                        <span className="text-[11px] text-slate-500">Chưa có</span>
                      )}
                      <button
                        onClick={() => handleRunStage2GenerateAudio(idx)}
                        disabled={isGeneratingAudio}
                        title="Tạo lại âm thanh riêng bước này"
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
      </div>

      {/* Footer: Hủy không lưu HOẶC Lưu vào bài mẫu trên GitHub */}
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
              onClick={() => {
                setSaveGrade(draftProblem.grade || 'Toán 7');
                setSaveTopic(draftProblem.topic || '');
                setSaveTitle(draftProblem.title || '');
                setSaveModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Lưu vào bài mẫu</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal nhập thông tin phân loại (Lớp, Tên bài, Dạng bài) để đẩy lên GitHub */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Github className="w-4 h-4" />
                <span>Lưu bài mẫu thành file rời lên GitHub</span>
              </div>
              <button onClick={() => setSaveModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Khối lớp *</label>
                <select
                  value={saveGrade}
                  onChange={(e) => setSaveGrade(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
                >
                  <option value="Toán 6">Toán 6</option>
                  <option value="Toán 7">Toán 7</option>
                  <option value="Toán 8">Toán 8</option>
                  <option value="Toán 9">Toán 9</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Dạng toán / Chuyên đề *</label>
                <input
                  type="text"
                  value={saveTopic}
                  onChange={(e) => setSaveTopic(e.target.value)}
                  placeholder="VD: Tam giác cân, Hình bình hành, Đường tròn..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Tên bài toán *</label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="VD: Chứng minh hai tam giác bằng nhau và đường cao..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div>• Hệ thống sẽ tự động tạo thư mục riêng chứa: <code className="text-sky-300">data.json</code> (Đề bài, GT-KL, tọa độ hình vẽ, lời giải) và các tệp âm thanh <code className="text-emerald-300">audio/step_*.mp3</code>.</div>
                <div>• Đồng thời cập nhật mục lục <code className="text-amber-300">public/lessons/index.json</code> trong 1 commit duy nhất.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSaveModalOpen(false)}
                disabled={isSavingGithub}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300"
              >
                Quay lại
              </button>
              <button
                onClick={handleConfirmSaveToGithub}
                disabled={isSavingGithub}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950"
              >
                {isSavingGithub ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{githubProgressText || 'Đang đẩy lên GitHub...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận Lưu lên GitHub</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
