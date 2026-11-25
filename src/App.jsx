import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Compass,
  Play,
  Pause,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  BookOpen,
  PlusCircle,
  Eye,
  Grid,
  X,
  Loader2,
  Key,
  CheckCircle2,
  Github,
  Sparkles,
  FileText
} from 'lucide-react';
import GeometryCanvas from './components/GeometryCanvas.jsx';
import DraftStudioDrawer from './components/DraftStudioDrawer.jsx';
import { fetchLessonsCatalog, fetchLessonDetail } from './services/lessonLoader.js';
import {
  loadSavedGithubConfig,
  saveGithubConfigToLocal,
  testGithubConnection
} from './services/githubStorageService.js';
import { generateStepAudioTTS } from './services/geminiService.js';

const API_KEY_STORAGE = 'toan_hinh_gemini_api_key';
const GRADES = ['Toán 6', 'Toán 7', 'Toán 8', 'Toán 9'];

export default function App() {
  // Cấu hình API Key & GitHub
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [githubConfig, setGithubConfig] = useState(() => loadSavedGithubConfig());
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState(geminiApiKey);
  const [githubDraft, setGithubDraft] = useState(githubConfig);
  const [isTestingGithub, setIsTestingGithub] = useState(false);

  // Danh mục bài mẫu tải từ public/lessons/index.json
  const [catalog, setCatalog] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('Toán 7');
  const [selectedTopic, setSelectedTopic] = useState('Tất cả');
  const [activeProblem, setActiveProblem] = useState(null);
  const [isLoadingLesson, setIsLoadingLesson] = useState(true);

  // Chế độ biên soạn bản nháp (RAM)
  const [draftStudioOpen, setDraftStudioOpen] = useState(false);
  const [draftProblem, setDraftProblem] = useState(null);
  const [draftAudioMap, setDraftAudioMap] = useState(() => new Map());

  // Trạng thái trình chiếu đồng bộ 3 vùng
  const [mode, setMode] = useState('drawing'); // 'drawing' | 'solving'
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showFullFigure, setShowFullFigure] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [toastMsg, setToastMsg] = useState('');

  const audioObjRef = useRef(null);
  const animFrameRef = useRef(null);
  const activeStepBoxRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? '' : prev));
    }, 4500);
  };

  // Nạp mục lục bài học từ public/lessons/index.json lúc mở trang
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoadingLesson(true);
      const list = await fetchLessonsCatalog();
      if (!mounted) return;
      setCatalog(list);
      if (list.length > 0) {
        const defaultItem = list.find((it) => it.grade === 'Toán 7') || list[0];
        setSelectedGrade(defaultItem.grade || 'Toán 7');
        try {
          const detail = await fetchLessonDetail(defaultItem);
          if (mounted) setActiveProblem(detail);
        } catch (err) {
          showToast(err.message);
        }
      }
      if (mounted) setIsLoadingLesson(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const gradeCatalog = useMemo(
    () => catalog.filter((item) => item.grade === selectedGrade),
    [catalog, selectedGrade]
  );

  const availableTopics = useMemo(() => {
    const set = new Set(gradeCatalog.map((item) => item.topic).filter(Boolean));
    return ['Tất cả', ...Array.from(set)];
  }, [gradeCatalog]);

  const filteredCatalog = useMemo(() => {
    if (selectedTopic === 'Tất cả') return gradeCatalog;
    return gradeCatalog.filter((item) => item.topic === selectedTopic);
  }, [gradeCatalog, selectedTopic]);

  const stopPlayback = () => {
    setIsPlaying(false);
    if (audioObjRef.current) {
      audioObjRef.current.pause();
      audioObjRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const handleSelectCatalogLesson = async (item) => {
    stopPlayback();
    setIsLoadingLesson(true);
    try {
      const detail = await fetchLessonDetail(item);
      setActiveProblem(detail);
      setMode('drawing');
      setCurrentStepIndex(0);
      setStepProgress(1);
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsLoadingLesson(false);
    }
  };

  const totalDrawingSteps = activeProblem?.drawingSteps?.length || 0;
  const totalSolutionSteps = activeProblem?.solutionSteps?.length || 0;

  const globalStepIndex =
    mode === 'drawing' ? currentStepIndex : totalDrawingSteps + currentStepIndex;

  const currentNarrationText = useMemo(() => {
    if (!activeProblem) return '';
    if (mode === 'drawing') {
      const st = activeProblem.drawingSteps?.[currentStepIndex];
      return st?.voiceExplanation || st?.caption || '';
    }
    const st = activeProblem.solutionSteps?.[currentStepIndex];
    return st?.voiceExplanation || st?.lineText || '';
  }, [activeProblem, mode, currentStepIndex]);

  // Cuộn mượt tới dòng lời giải đang giảng
  useEffect(() => {
    if (activeStepBoxRef.current) {
      activeStepBoxRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [mode, currentStepIndex]);

  // Chạy hiệu ứng vẽ + âm thanh từng bước khi nhấn Phát
  useEffect(() => {
    if (!isPlaying || !activeProblem) return;

    let cancelled = false;
    const stepDurationMs = mode === 'drawing' ? 2600 : 3200;
    const startTs = performance.now();

    const tickAnimation = (now) => {
      if (cancelled) return;
      const elapsed = now - startTs;
      const p = Math.min(1, elapsed / stepDurationMs);
      setStepProgress(p);
      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(tickAnimation);
      }
    };
    setStepProgress(0);
    animFrameRef.current = requestAnimationFrame(tickAnimation);

    const advanceToNextStep = () => {
      if (cancelled) return;
      if (mode === 'drawing') {
        if (currentStepIndex + 1 < totalDrawingSteps) {
          setCurrentStepIndex((i) => i + 1);
        } else if (totalSolutionSteps > 0) {
          setMode('solving');
          setCurrentStepIndex(0);
        } else {
          setIsPlaying(false);
        }
      } else {
        if (currentStepIndex + 1 < totalSolutionSteps) {
          setCurrentStepIndex((i) => i + 1);
        } else {
          setIsPlaying(false);
        }
      }
    };

    (async () => {
      // Ưu tiên 1: Âm thanh vừa tạo trong Draft Studio (nếu đang xem bản nháp)
      const isViewingDraft = draftProblem && activeProblem.id === draftProblem.id;
      const draftAudio = isViewingDraft ? draftAudioMap.get(globalStepIndex) : null;

      let audioUrlToPlay = draftAudio?.url || null;

      // Ưu tiên 2: File MP3 tĩnh lưu sẵn trên GitHub/Cloudflare Pages
      if (!audioUrlToPlay && activeProblem.hasStaticAudio && activeProblem.audioBasePath) {
        const manifestItem = activeProblem.audioManifest?.find((m) => m.stepIndex === globalStepIndex);
        const fileName = manifestItem?.file || `step_${globalStepIndex}.mp3`;
        audioUrlToPlay = `${activeProblem.audioBasePath}/${fileName}`;
      }

      // Ưu tiên 3: Gọi Gemini TTS trực tiếp nếu có API Key và chưa bật tắt tiếng
      if (!audioUrlToPlay && !isMuted && geminiApiKey.trim() && currentNarrationText) {
        try {
          const generated = await generateStepAudioTTS({
            text: currentNarrationText,
            apiKey: geminiApiKey.trim()
          });
          if (!cancelled) audioUrlToPlay = generated.url;
        } catch {
          // Nếu chưa có audio thì chạy theo thời gian mặc định
        }
      }

      if (cancelled) return;

      if (audioUrlToPlay && !isMuted) {
        const audio = new Audio(audioUrlToPlay);
        audioObjRef.current = audio;
        audio.onended = () => {
          setStepProgress(1);
          setTimeout(advanceToNextStep, 350);
        };
        audio.onerror = () => {
          setTimeout(advanceToNextStep, stepDurationMs);
        };
        audio.play().catch(() => {
          setTimeout(advanceToNextStep, stepDurationMs);
        });
      } else {
        setTimeout(advanceToNextStep, stepDurationMs);
      }
    })();

    return () => {
      cancelled = true;
      if (audioObjRef.current) {
        audioObjRef.current.pause();
        audioObjRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, mode, currentStepIndex, activeProblem]);

  const handleSaveSettings = () => {
    const cleanKey = apiKeyDraft.trim();
    setGeminiApiKey(cleanKey);
    localStorage.setItem(API_KEY_STORAGE, cleanKey);

    setGithubConfig(githubDraft);
    saveGithubConfigToLocal(githubDraft);

    setSettingsModalOpen(false);
    showToast('Đã lưu cấu hình Gemini API Key & GitHub!');
  };

  const handleTestGithub = async () => {
    setIsTestingGithub(true);
    try {
      await testGithubConnection(githubDraft);
      showToast('Kết nối GitHub thành công! Sẵn sàng lưu bài mẫu trực tiếp.');
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsTestingGithub(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col">
      {/* Thanh điều hướng trên cùng */}
      <header className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-950">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Giải & Vẽ Hình Toán Hình Học THCS
            </h1>
            <p className="text-[11px] text-slate-400">
              Trực quan từng bước • Kho bài mẫu rời • Lưu tự động lên GitHub
            </p>
          </div>
        </div>

        {/* Tab chọn khối lớp */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => {
                setSelectedGrade(g);
                setSelectedTopic('Tất cả');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedGrade === g
                  ? 'bg-sky-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Các nút chức năng chính */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDraftStudioOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{draftProblem ? 'Tiếp tục sửa bản nháp' : 'Nạp đề mới (AI)'}</span>
          </button>

          <button
            onClick={() => {
              setApiKeyDraft(geminiApiKey);
              setGithubDraft(githubConfig);
              setSettingsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
            title="Cài đặt Gemini API Key & GitHub"
          >
            <Key className="w-3.5 h-3.5 text-sky-400" />
            <Github className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Cài đặt API</span>
          </button>
        </div>
      </header>

      {/* Thanh chọn Dạng bài & Danh sách bài mẫu của khối lớp */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 font-semibold flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5 text-sky-400" />
          <span>Dạng bài:</span>
        </span>
        <select
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-xs text-slate-200"
        >
          {availableTopics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-0.5">
          {filteredCatalog.map((item) => {
            const isSelected = activeProblem?.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectCatalogLesson(item)}
                className={`px-3 py-1 rounded-lg whitespace-nowrap text-xs font-medium border transition ${
                  isSelected
                    ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.title}
              </button>
            );
          })}
          {draftProblem && (
            <button
              onClick={() => {
                setActiveProblem(draftProblem);
                setDraftStudioOpen(true);
              }}
              className={`px-3 py-1 rounded-lg whitespace-nowrap text-xs font-bold border ${
                activeProblem?.id === draftProblem.id
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}
            >
              [Bản nháp] {draftProblem.title}
            </button>
          )}
        </div>
      </div>

      {/* Khu vực trình chiếu chính: Trái (Canvas Hình vẽ) - Phải (Đề bài, GT-KL & Lời giải) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Cột trái: Bảng vẽ hình */}
        <div className="lg:col-span-7 flex flex-col gap-2 min-h-[380px]">
          <div className="flex-1 relative">
            {isLoadingLesson ? (
              <div className="w-full h-full rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Đang tải dữ liệu bài học...</span>
              </div>
            ) : activeProblem ? (
              <GeometryCanvas
                problem={activeProblem}
                mode={mode}
                currentStepIndex={currentStepIndex}
                stepProgress={stepProgress}
                showGrid={showGrid}
                showTools={showTools}
                showFullFigure={showFullFigure}
                zoom={zoom}
                onZoomChange={setZoom}
              />
            ) : (
              <div className="w-full h-full rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <Sparkles className="w-8 h-8 text-amber-400" />
                <p className="text-sm text-slate-300">Chưa có bài mẫu trong mục này. Bấm "Nạp đề mới (AI)" để tạo bài đầu tiên!</p>
              </div>
            )}
          </div>

          {/* Thanh điều khiển trình chiếu hình vẽ */}
          {activeProblem && (
            <div className="px-3 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    stopPlayback();
                    setMode('drawing');
                    setCurrentStepIndex(0);
                    setStepProgress(1);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Về đầu bài"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    stopPlayback();
                    if (currentStepIndex > 0) {
                      setCurrentStepIndex((i) => i - 1);
                      setStepProgress(1);
                    } else if (mode === 'solving' && totalDrawingSteps > 0) {
                      setMode('drawing');
                      setCurrentStepIndex(totalDrawingSteps - 1);
                      setStepProgress(1);
                    }
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Bước trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-sky-500 hover:bg-sky-400 text-slate-950"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Tạm dừng' : 'Phát bài giảng'}</span>
                </button>

                <button
                  onClick={() => {
                    stopPlayback();
                    if (mode === 'drawing') {
                      if (currentStepIndex + 1 < totalDrawingSteps) {
                        setCurrentStepIndex((i) => i + 1);
                        setStepProgress(1);
                      } else if (totalSolutionSteps > 0) {
                        setMode('solving');
                        setCurrentStepIndex(0);
                        setStepProgress(1);
                      }
                    } else if (currentStepIndex + 1 < totalSolutionSteps) {
                      setCurrentStepIndex((i) => i + 1);
                      setStepProgress(1);
                    }
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Bước tiếp theo"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowFullFigure((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                    showFullFigure
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 inline mr-1" />
                  Hình hoàn chỉnh
                </button>
                <button
                  onClick={() => setShowTools((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                    showTools
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Dụng cụ vẽ
                </button>
                <button
                  onClick={() => setShowGrid((v) => !v)}
                  className={`p-1.5 rounded-lg border ${
                    showGrid
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                  title="Bật/tắt lưới tọa độ"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsMuted((m) => !m)}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300"
                  title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cột phải: Đề bài, GT-KL & Lời giải chi tiết */}
        <div className="lg:col-span-5 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
          {activeProblem && (
            <>
              {/* Khung Đề bài */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Đề bài ({activeProblem.grade})</span>
                  </span>
                  {activeProblem.topic && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {activeProblem.topic}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-100 whitespace-pre-line leading-relaxed">
                  {activeProblem.problemText}
                </p>

                {/* Bảng GT - KL */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80">
                    <div className="font-bold text-amber-400 mb-1">GT</div>
                    <ul className="space-y-0.5 text-slate-200">
                      {(activeProblem.given || []).map((g, i) => (
                        <li key={i}>• {g}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80">
                    <div className="font-bold text-emerald-400 mb-1">KL</div>
                    <ul className="space-y-0.5 text-slate-200">
                      {(activeProblem.prove || []).map((p, i) => (
                        <li key={i}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Chuyển tab Vẽ hình / Lời giải */}
              <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => {
                    stopPlayback();
                    setMode('drawing');
                    setCurrentStepIndex(0);
                    setStepProgress(1);
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                    mode === 'drawing' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Các bước vẽ hình ({totalDrawingSteps})
                </button>
                <button
                  onClick={() => {
                    stopPlayback();
                    setMode('solving');
                    setCurrentStepIndex(0);
                    setStepProgress(1);
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                    mode === 'solving' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Lời giải chi tiết ({totalSolutionSteps})
                </button>
              </div>

              {/* Danh sách từng bước */}
              <div className="flex-1 overflow-y-auto space-y-1.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
                {mode === 'drawing'
                  ? (activeProblem.drawingSteps || []).map((st, idx) => {
                      const active = idx === currentStepIndex;
                      return (
                        <div
                          key={idx}
                          ref={active ? activeStepBoxRef : null}
                          onClick={() => {
                            stopPlayback();
                            setCurrentStepIndex(idx);
                            setStepProgress(1);
                          }}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            active
                              ? 'bg-sky-950/60 border-sky-500/60 text-sky-100'
                              : 'bg-slate-950/70 border-slate-800/70 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="font-bold text-sky-400 mr-1.5">Bước {idx + 1}:</span>
                          {st.caption}
                        </div>
                      );
                    })
                  : (activeProblem.solutionSteps || []).map((st, idx) => {
                      const active = idx === currentStepIndex;
                      return (
                        <div
                          key={idx}
                          ref={active ? activeStepBoxRef : null}
                          onClick={() => {
                            stopPlayback();
                            setCurrentStepIndex(idx);
                            setStepProgress(1);
                          }}
                          className={`p-2.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition whitespace-pre-line ${
                            active
                              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-100 font-medium'
                              : 'bg-slate-950/70 border-slate-800/70 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {st.lineText}
                        </div>
                      );
                    })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Dải phụ đề chạy phía dưới màn hình */}
      {activeProblem && (
        <footer className="px-4 py-2 bg-slate-950 border-t border-slate-800/90 flex items-center gap-3 text-xs">
          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold shrink-0">
            {mode === 'drawing' ? `Vẽ ${currentStepIndex + 1}/${totalDrawingSteps}` : `Giải ${currentStepIndex + 1}/${totalSolutionSteps}`}
          </span>
          <div className="flex-1 truncate text-slate-200 font-medium">
            {currentNarrationText}
          </div>
        </footer>
      )}

      {/* Drawer Biên soạn & Hiệu chỉnh bài mới */}
      <DraftStudioDrawer
        isOpen={draftStudioOpen}
        onClose={() => setDraftStudioOpen(false)}
        geminiApiKey={geminiApiKey}
        onOpenSettings={() => setSettingsModalOpen(true)}
        githubConfig={githubConfig}
        draftProblem={draftProblem}
        setDraftProblem={setDraftProblem}
        draftAudioMap={draftAudioMap}
        setDraftAudioMap={setDraftAudioMap}
        onPreviewDraftOnMainCanvas={(prob) => {
          stopPlayback();
          setActiveProblem(prob);
          setMode('drawing');
          setCurrentStepIndex(0);
          setStepProgress(1);
        }}
        onLessonSavedToGithub={(savedLesson, catalogItem) => {
          setCatalog((prev) => [catalogItem, ...prev.filter((it) => it.id !== catalogItem.id)]);
          setSelectedGrade(catalogItem.grade);
          setActiveProblem(savedLesson);
          setDraftProblem(null);
          setDraftAudioMap(new Map());
          setDraftStudioOpen(false);
        }}
        showToast={showToast}
      />

      {/* Modal Cài đặt Gemini API Key & GitHub Token */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-sky-400" />
                <span>Cài đặt Gemini API & Lưu trữ GitHub</span>
              </h3>
              <button onClick={() => setSettingsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">1. Gemini API Key</label>
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Github className="w-4 h-4 text-amber-400" />
                    <span>2. Cấu hình lưu thẳng lên GitHub</span>
                  </label>
                  <button
                    onClick={handleTestGithub}
                    disabled={isTestingGithub}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-medium"
                  >
                    {isTestingGithub ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                  </button>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">GitHub Personal Access Token (quyền Contents: Read & Write)</label>
                  <input
                    type="password"
                    value={githubDraft.token}
                    onChange={(e) => setGithubDraft({ ...githubDraft, token: e.target.value })}
                    placeholder="github_pat_... hoặc ghp_..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Tên tài khoản (Owner)</label>
                    <input
                      type="text"
                      value={githubDraft.owner}
                      onChange={(e) => setGithubDraft({ ...githubDraft, owner: e.target.value })}
                      placeholder="vd: vutronghanh"
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Tên Repository</label>
                    <input
                      type="text"
                      value={githubDraft.repo}
                      onChange={(e) => setGithubDraft({ ...githubDraft, repo: e.target.value })}
                      placeholder="giai-ve-hinh-toan-thcs"
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Nhánh (Branch)</label>
                    <input
                      type="text"
                      value={githubDraft.branch}
                      onChange={(e) => setGithubDraft({ ...githubDraft, branch: e.target.value })}
                      placeholder="main"
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs bg-slate-800 text-slate-300"
              >
                Đóng
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thông báo Toast */}
      {toastMsg && (
        <div className="fixed bottom-12 right-4 z-50 flex items-center gap-2 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 px-3.5 py-2.5 rounded-xl shadow-xl text-xs font-medium max-w-md">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
