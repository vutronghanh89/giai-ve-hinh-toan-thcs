import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  ImagePlus,
  Send,
  Volume2,
  Download,
  UploadCloud,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  generateGeometryAndSolution,
  refineDraftProblemWithChat,
  generateStepAudioTTS
} from '../services/geminiService.js';
import {
  loadSavedGithubConfig,
  saveLessonDirectToGithub,
  downloadLessonZipBackup
} from '../services/githubStorageService.js';
import MathText from './MathText.jsx';

export default function DraftStudioDrawer({
  isOpen,
  onClose,
  apiKey,
  currentLesson,
  onApplyLesson,
  onOpenSettings
}) {
  const [activeTab, setActiveTab] = useState('create');
  const [problemText, setProblemText] = useState('');
  const [imageAttachment, setImageAttachment] = useState(null);
  const [draft, setDraft] = useState(currentLesson || null);
  const [chatPrompt, setChatPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [audioEntriesMap, setAudioEntriesMap] = useState(() => new Map());
  const [generatingAudioIdx, setGeneratingAudioIdx] = useState(-1);
  const [cooldownSec, setCooldownSec] = useState(0);
  const abortRef = useRef(null);

  const timelineItems = useMemo(() => {
    if (!draft) return [];
    const items = [];
    (draft.drawingSteps || []).forEach((st, idx) => {
      items.push({
        index: items.length,
        kind: 'draw',
        label: `Vẽ bước ${idx + 1}`,
        displayText: st.caption,
        voiceText: st.voiceExplanation || st.caption
      });
    });
    (draft.solutionSteps || []).forEach((st, idx) => {
      items.push({
        index: items.length,
        kind: 'solve',
        label: `Giải bước ${idx + 1}`,
        displayText: st.lineText,
        voiceText: st.voiceExplanation || st.lineText
      });
    });
    return items;
  }, [draft]);

  if (!isOpen) return null;

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        setImageAttachment({
          name: file.name,
          mimeType: match[1],
          base64: match[2],
          previewUrl: dataUrl
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setErrorMsg('Chưa nhập Gemini API Key. Vui lòng mở Cài đặt để dán API Key trước.');
      return;
    }
    if (!problemText.trim() && !imageAttachment) {
      setErrorMsg('Thầy vui lòng nhập đề bài hoặc chọn ảnh chụp đề toán.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setStatusMsg('AI đang phân tích đề toán, dựng tọa độ 2D và viết lời giải chuẩn...');
    try {
      const generated = await generateGeometryAndSolution({
        problemText,
        imageAttachment,
        apiKey
      });
      setDraft(generated);
      setAudioEntriesMap(new Map());
      setActiveTab('edit');
      setStatusMsg('Đã tạo xong bản nháp bài giảng!');
    } catch (err) {
      setErrorMsg(err.message || 'Có lỗi xảy ra khi gọi AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefineChat = async () => {
    if (!draft || !chatPrompt.trim()) return;
    if (!apiKey) {
      setErrorMsg('Vui lòng cấu hình Gemini API Key trong Cài đặt.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setStatusMsg('Đang hiệu chỉnh hình vẽ và lời giải theo yêu cầu...');
    try {
      const updated = await refineDraftProblemWithChat({
        currentDraft: draft,
        userInstruction: chatPrompt.trim(),
        apiKey
      });
      setDraft(updated);
      setChatPrompt('');
      setStatusMsg('Đã cập nhật bản nháp!');
    } catch (err) {
      setErrorMsg(err.message || 'Không thể hiệu chỉnh lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSingleAudio = async (item) => {
    if (!apiKey) {
      setErrorMsg('Vui lòng nhập Gemini API Key trong Cài đặt để tạo giọng đọc.');
      return;
    }
    setGeneratingAudioIdx(item.index);
    setErrorMsg('');
    try {
      const res = await generateStepAudioTTS({
        text: item.voiceText,
        apiKey,
        onCooldownTick: setCooldownSec
      });
      setAudioEntriesMap((prev) => {
        const next = new Map(prev);
        next.set(item.index, res);
        return next;
      });
    } catch (err) {
      if (err.message !== 'ABORTED') {
        setErrorMsg(err.message || 'Lỗi tạo giọng đọc.');
      }
    } finally {
      setGeneratingAudioIdx(-1);
      setCooldownSec(0);
    }
  };

  const handleGenerateAllAudio = async () => {
    if (!apiKey) {
      setErrorMsg('Vui lòng nhập Gemini API Key trong Cài đặt.');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setErrorMsg('');

    for (const item of timelineItems) {
      if (controller.signal.aborted) break;
      if (audioEntriesMap.has(item.index)) continue;

      setGeneratingAudioIdx(item.index);
      try {
        const res = await generateStepAudioTTS({
          text: item.voiceText,
          apiKey,
          signal: controller.signal,
          onCooldownTick: setCooldownSec
        });
        setAudioEntriesMap((prev) => {
          const next = new Map(prev);
          next.set(item.index, res);
          return next;
        });
        await new Promise((r) => setTimeout(r, 1200));
      } catch (err) {
        if (err.message !== 'ABORTED') {
          setErrorMsg(err.message || 'Dừng tạo âm thanh do giới hạn API.');
        }
        break;
      }
    }
    setGeneratingAudioIdx(-1);
    setCooldownSec(0);
  };

  const handleDownloadZip = async () => {
    if (!draft) return;
    setLoading(true);
    setErrorMsg('');
    setStatusMsg('Đang đóng gói data.json và âm thanh thành file .zip...');
    try {
      await downloadLessonZipBackup({
        lessonData: draft,
        metadata: {
          grade: draft.grade,
          topic: draft.topic,
          title: draft.title
        },
        timelineItems,
        audioEntriesMap
      });
      setStatusMsg('Đã tải xuống gói bài giảng .zip!');
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi xuất file .zip.');
    } finally {
      setLoading(false);
    }
  };

  const handlePushGithub = async () => {
    if (!draft) return;
    const ghConfig = loadSavedGithubConfig();
    if (!ghConfig.token || !ghConfig.owner || !ghConfig.repo) {
      setErrorMsg('Chưa cấu hình GitHub Token / Repo. Bấm "Mở Cài đặt" để điền thông tin GitHub.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await saveLessonDirectToGithub({
        config: ghConfig,
        lessonData: draft,
        metadata: {
          grade: draft.grade,
          topic: draft.topic,
          title: draft.title
        },
        timelineItems,
        audioEntriesMap,
        onProgress: setStatusMsg
      });
      setStatusMsg('Đã lưu bài giảng thẳng lên GitHub thành công!');
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi lưu lên GitHub.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-700/80 bg-[#0f172a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Xưởng Soạn Bài Giảng AI</h2>
              <p className="text-xs text-slate-400">
                Tạo hình 2D, công thức toán chuẩn & giọng đọc nữ miền Bắc
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-900/60 px-4 pt-2 text-xs font-medium">
          {[
            { id: 'create', label: '1. Nhập đề & Tạo AI' },
            { id: 'edit', label: '2. Hiệu chỉnh & Giọng đọc' },
            { id: 'publish', label: '3. Trình chiếu / Lưu trữ' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-3.5 py-2.5 transition ${
                activeTab === tab.id
                  ? 'border-indigo-400 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(errorMsg || statusMsg) && (
          <div className="px-5 pt-3">
            {errorMsg && (
              <div className="flex items-start justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
                {!apiKey && onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="shrink-0 rounded-lg bg-rose-500/20 px-2.5 py-1 font-semibold text-rose-200 hover:bg-rose-500/30"
                  >
                    Cài đặt
                  </button>
                )}
              </div>
            )}
            {statusMsg && !errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-2 text-xs text-emerald-200">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                <span>{statusMsg}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {activeTab === 'create' && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Nội dung đề bài toán hình học (Toán 6 – 9)
                </label>
                <textarea
                  rows={5}
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                  placeholder="Ví dụ: Cho tam giác ABC vuông tại A có AB = 6 cm, AC = 8 cm, đường cao AH. Tính độ dài BC và AH..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Hoặc tải ảnh chụp đề bài / hình vẽ (tùy chọn)
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-3 text-xs text-slate-300 hover:border-indigo-400 hover:text-white">
                  <ImagePlus className="h-4 w-4 text-indigo-400" />
                  <span>
                    {imageAttachment ? `Đã chọn: ${imageAttachment.name}` : 'Chọn ảnh đề toán (.png, .jpg)'}
                  </span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                {imageAttachment?.previewUrl && (
                  <img
                    src={imageAttachment.previewUrl}
                    alt="Đề bài"
                    className="mt-2 max-h-40 rounded-lg border border-slate-700 object-contain"
                  />
                )}
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>Phân tích & Dựng bài giảng tự động</span>
              </button>
            </>
          )}

          {activeTab === 'edit' && (
            <>
              {!draft ? (
                <p className="text-xs text-slate-400">
                  Chưa có bản nháp. Hãy sang tab 1 để nhập đề bài hoặc mở sẵn một bài mẫu trên màn hình chính.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Khối lớp</label>
                      <select
                        value={draft.grade || 'Toán 7'}
                        onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white"
                      >
                        <option>Toán 6</option>
                        <option>Toán 7</option>
                        <option>Toán 8</option>
                        <option>Toán 9</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] text-slate-400">Tên bài toán</label>
                      <input
                        type="text"
                        value={draft.title || ''}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <label className="mb-1.5 block text-xs font-semibold text-indigo-300">
                      Yêu cầu AI chỉnh sửa hình vẽ / lời giải
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatPrompt}
                        onChange={(e) => setChatPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRefineChat()}
                        placeholder="VD: Đổi tên điểm M thành E, tách nhỏ bước tính phân số..."
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleRefineChat}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Sửa</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Xem trước công thức & Giọng đọc từng bước ({audioEntriesMap.size}/{timelineItems.length})
                    </span>
                    <button
                      type="button"
                      disabled={generatingAudioIdx !== -1}
                      onClick={handleGenerateAllAudio}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>
                        {generatingAudioIdx !== -1
                          ? cooldownSec > 0
                            ? `Đợi ${cooldownSec}s...`
                            : `Đang đọc bước ${generatingAudioIdx + 1}...`
                          : 'Tạo toàn bộ giọng đọc'}
                      </span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {timelineItems.map((item) => {
                      const audioEntry = audioEntriesMap.get(item.index);
                      const isBusy = generatingAudioIdx === item.index;
                      return (
                        <div
                          key={item.index}
                          className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                item.kind === 'draw'
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {item.label}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {audioEntry?.url && (
                                <button
                                  type="button"
                                  onClick={() => new Audio(audioEntry.url).play()}
                                  className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] text-emerald-300 hover:bg-slate-700"
                                >
                                  Nghe thử
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={generatingAudioIdx !== -1}
                                onClick={() => handleGenerateSingleAudio(item)}
                                className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                              >
                                {isBusy ? 'Đang tạo...' : audioEntry ? 'Tạo lại' : 'Tạo giọng'}
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 text-slate-100">
                            <MathText text={item.displayText} />
                          </div>
                          <div className="mt-1.5 text-[11px] italic text-slate-400">
                            Lời đọc: "{item.voiceText}"
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'publish' && (
            <div className="space-y-3">
              {!draft ? (
                <p className="text-xs text-slate-400">Chưa có bản nháp để xuất bản.</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyLesson(draft, audioEntriesMap, timelineItems);
                      onClose();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    <Play className="h-4 w-4" />
                    <span>Áp dụng & Trình chiếu ngay trên màn hình chính</span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleDownloadZip}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4 text-sky-400" />
                    <span>Tải gói bài học (.zip) gồm data.json & full_audio.mp3</span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePushGithub}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/40 px-4 py-3 text-sm font-semibold text-indigo-200 hover:bg-indigo-900/50 disabled:opacity-50"
                  >
                    <UploadCloud className="h-4 w-4 text-indigo-400" />
                    <span>Lưu trực tiếp lên GitHub (tự cập nhật web)</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
