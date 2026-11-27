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
  FileText,
  Video
} from 'lucide-react';
import GeometryCanvas from './components/GeometryCanvas.jsx';
import DraftStudioDrawer from './components/DraftStudioDrawer.jsx';
import { fetchLessonsCatalog, fetchLessonDetail } from './services/lessonLoader.js';
import {
  loadSavedGithubConfig,
  saveGithubConfigToLocal,
  testGithubConnection
} from './services/githubStorageService.js';
import { exportLessonToMp4 } from './services/videoExporter.js';

const API_KEY_STORAGE = 'toan_hinh_gemini_api_key';
const GRADES = ['Toán 6', 'Toán 7', 'Toán 8', 'Toán 9'];
const PLAYBACK_RATES = [1, 1.25, 1.5, 0.85];

function formatSecondsMMSS(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

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
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showFullFigure, setShowFullFigure] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [toastMsg, setToastMsg] = useState('');

  // Trạng thái thanh tiến trình 1 file âm thanh duy nhất
  const [audioReady, setAudioReady] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Trạng thái xuất video MP4
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState({ percent: 0, currentSec: 0, totalSec: 0 });
  const exportAbortRef = useRef(null);

  // Phần tử Audio tải trước (preload="auto") duy nhất
  const masterAudioRef = useRef(null);
  const legacyStepAudioRef = useRef(null);
  const animFrameRef = useRef(null);
  const stepsContainerRef = useRef(null);
  const activeStepBoxRef = useRef(null);
  const lastSyncedGlobalStepRef = useRef(-1);

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

  const totalDrawingSteps = activeProblem?.drawingSteps?.length || 0;
  const totalSolutionSteps = activeProblem?.solutionSteps?.length || 0;

  // Xác định nguồn 1 file âm thanh duy nhất & bảng mốc thời gian của bài hiện tại
  const unifiedAudioConfig = useMemo(() => {
    if (!activeProblem) return null;

    // 1. Bản nháp trong RAM đã có sẵn Blob URL thống nhất
    if (
      activeProblem._unifiedAudioUrl &&
      Array.isArray(activeProblem.audioTimeline) &&
      activeProblem.audioTimeline.length > 0
    ) {
      return {
        src: activeProblem._unifiedAudioUrl,
        timeline: activeProblem.audioTimeline
      };
    }

    // 2. Bài mẫu tĩnh đã có 1 tệp full_audio.mp3 + audioTimeline
    if (
      activeProblem.hasStaticAudio &&
      activeProblem.audioBasePath &&
      Array.isArray(activeProblem.audioTimeline) &&
      activeProblem.audioTimeline.length > 0
    ) {
      const fileName = activeProblem.audioFile || 'full_audio.mp3';
      return {
        src: `${activeProblem.audioBasePath}/${fileName}`,
        timeline: activeProblem.audioTimeline
      };
    }

    return null;
  }, [activeProblem]);

  // TẢI TRƯỚC (PRELOAD) NGAY KHI MỞ BÀI HỌC -> BẤM PHÁT LÀ ĐỌC TỨC THÌ 0ms ĐỘ TRỄ
  useEffect(() => {
    setIsPlaying(false);
    setAudioReady(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    lastSyncedGlobalStepRef.current = -1;

    if (legacyStepAudioRef.current) {
      legacyStepAudioRef.current.pause();
      legacyStepAudioRef.current = null;
    }

    const existing = masterAudioRef.current;
    if (existing) {
      existing.pause();
      existing.removeAttribute('src');
      existing.load();
    }

    if (!unifiedAudioConfig?.src) {
      masterAudioRef.current = null;
      return;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = unifiedAudioConfig.src;
    audio.muted = isMuted;
    audio.playbackRate = playbackRate;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setAudioDuration(audio.duration);
      } else {
        const lastCue = unifiedAudioConfig.timeline[unifiedAudioConfig.timeline.length - 1];
        if (lastCue?.endSec) setAudioDuration(lastCue.endSec);
      }
      setAudioReady(true);
    };

    const handleCanPlayThrough = () => {
      setAudioReady(true);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setStepProgress(1);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('ended', handleEnded);

    audio.load();
    masterAudioRef.current = audio;

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [unifiedAudioConfig]);

  // Đồng bộ nút Tắt tiếng & Tốc độ phát ngay lập tức với phần tử Audio
  useEffect(() => {
    if (masterAudioRef.current) {
      masterAudioRef.current.muted = isMuted;
    }
    if (legacyStepAudioRef.current) {
      legacyStepAudioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (masterAudioRef.current) {
      masterAudioRef.current.playbackRate = playbackRate;
    }
    if (legacyStepAudioRef.current) {
      legacyStepAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const stopPlayback = () => {
    setIsPlaying(false);
    if (masterAudioRef.current) {
      masterAudioRef.current.pause();
    }
    if (legacyStepAudioRef.current) {
      legacyStepAudioRef.current.pause();
      legacyStepAudioRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  // Nhảy chính xác tới mốc thời gian của một bước bất kỳ trong 1 file âm thanh duy nhất
  const jumpToGlobalStep = (targetGlobalIdx, keepPlaying = false) => {
    const safeGlobal = Math.max(
      0,
      Math.min(totalDrawingSteps + totalSolutionSteps - 1, targetGlobalIdx)
    );

    if (safeGlobal < totalDrawingSteps) {
      setMode('drawing');
      setCurrentStepIndex(safeGlobal);
    } else {
      setMode('solving');
      setCurrentStepIndex(safeGlobal - totalDrawingSteps);
    }
    lastSyncedGlobalStepRef.current = safeGlobal;
    setStepProgress(keepPlaying ? 0 : 1);

    if (unifiedAudioConfig?.timeline && masterAudioRef.current) {
      const cue =
        unifiedAudioConfig.timeline.find((c) => c.stepIndex === safeGlobal) ||
        unifiedAudioConfig.timeline[safeGlobal];
      if (cue) {
        masterAudioRef.current.currentTime = cue.startSec;
        setAudioCurrentTime(cue.startSec);
      }
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

  // Tự động cuộn mượt bên trong khung danh sách các bước (đưa bước đang giảng lên vùng 1/3 phía trên)
  useEffect(() => {
    const container = stepsContainerRef.current;
    const activeEl = activeStepBoxRef.current;
    if (!container || !activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    const relativeTop = activeRect.top - containerRect.top;
    const targetScrollTop = container.scrollTop + relativeTop - container.clientHeight * 0.28;

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    });
  }, [mode, currentStepIndex]);

  // =========================================================================
  // CHẾ ĐỘ 1 (ƯU TIÊN CAO NHẤT): ĐỒNG BỘ 60FPS THEO 1 FILE ÂM THANH DUY NHẤT
  // =========================================================================
  useEffect(() => {
    if (!isPlaying || !activeProblem || !unifiedAudioConfig || !masterAudioRef.current) {
      return;
    }

    const audio = masterAudioRef.current;
    const timeline = unifiedAudioConfig.timeline;
    let cancelled = false;

    const totalDur =
      audioDuration || timeline[timeline.length - 1]?.endSec || audio.duration || 0;
    if (totalDur > 0 && audio.currentTime >= totalDur - 0.15) {
      audio.currentTime = 0;
      lastSyncedGlobalStepRef.current = -1;
    }

    audio.muted = isMuted;
    audio.playbackRate = playbackRate;
    audio.play().catch((err) => {
      if (!cancelled) {
        setIsPlaying(false);
        showToast(`Trình duyệt chặn tự phát âm thanh: ${err.message}`);
      }
    });

    const syncLoop = () => {
      if (cancelled) return;
      const t = audio.currentTime;
      setAudioCurrentTime(t);

      let activeCue = timeline[0];
      for (let i = 0; i < timeline.length; i++) {
        const c = timeline[i];
        if (t >= c.startSec && t < c.endSec) {
          activeCue = c;
          break;
        }
        if (t >= c.endSec) {
          activeCue = c;
        }
      }

      if (activeCue) {
        const gIdx = activeCue.stepIndex;
        if (lastSyncedGlobalStepRef.current !== gIdx) {
          lastSyncedGlobalStepRef.current = gIdx;
          if (gIdx < totalDrawingSteps) {
            setMode('drawing');
            setCurrentStepIndex(gIdx);
          } else {
            setMode('solving');
            setCurrentStepIndex(gIdx - totalDrawingSteps);
          }
        }

        const cueSpan = Math.max(0.15, activeCue.endSec - activeCue.startSec);
        const elapsedInCue = Math.max(0, t - activeCue.startSec);
        const p = Math.min(1, elapsedInCue / (cueSpan * 0.88));
        setStepProgress(p);
      }

      if (!audio.paused && !audio.ended) {
        animFrameRef.current = requestAnimationFrame(syncLoop);
      }
    };

    animFrameRef.current = requestAnimationFrame(syncLoop);

    return () => {
      cancelled = true;
      audio.pause();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, activeProblem, unifiedAudioConfig, totalDrawingSteps]);

  // =========================================================================
  // CHẾ ĐỘ 2 (DỰ PHÒNG): CHO BÀI CŨ NHIỀU FILE RỜI HOẶC BÀI CHƯA CÓ ÂM THANH
  // =========================================================================
  useEffect(() => {
    if (!isPlaying || !activeProblem || unifiedAudioConfig) {
      return;
    }

    let cancelled = false;
    const stepDurationMs = (mode === 'drawing' ? 2600 : 3200) / playbackRate;
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

    let legacyAudioUrl = null;
    if (activeProblem.hasStaticAudio && activeProblem.audioBasePath) {
      const manifestItem = activeProblem.audioManifest?.find((m) => m.stepIndex === globalStepIndex);
      const fileName = manifestItem?.file || `step_${globalStepIndex}.mp3`;
      legacyAudioUrl = `${activeProblem.audioBasePath}/${fileName}`;
    }

    if (legacyAudioUrl) {
      const audio = new Audio(legacyAudioUrl);
      audio.muted = isMuted;
      audio.playbackRate = playbackRate;
      legacyStepAudioRef.current = audio;
      audio.onended = () => {
        setStepProgress(1);
        setTimeout(advanceToNextStep, 200);
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

    return () => {
      cancelled = true;
      if (legacyStepAudioRef.current) {
        legacyStepAudioRef.current.pause();
        legacyStepAudioRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, mode, currentStepIndex, activeProblem, unifiedAudioConfig]);

  // =========================================================================
  // XUẤT VIDEO MP4 CÓ ÂM THANH BÀI GIẢNG
  // =========================================================================
  const handleExportMp4 = async () => {
    if (!activeProblem || isExportingVideo) return;
    stopPlayback();

    const controller = new AbortController();
    exportAbortRef.current = controller;
    setIsExportingVideo(true);
    setExportProgress({ percent: 0, currentSec: 0, totalSec: 0 });

    try {
      const result = await exportLessonToMp4({
        problem: activeProblem,
        unifiedAudioConfig,
        showGrid,
        showTools,
        cancelSignal: controller.signal,
        onProgress: (info) => setExportProgress(info)
      });

      if (result.isMp4) {
        showToast('Đã tải xuống video MP4 bài giảng đầy đủ hình vẽ, lời giải & âm thanh!');
      } else {
        showToast('Đã tải xuống video bài giảng (định dạng WebM do trình duyệt hỗ trợ).');
      }
    } catch (err) {
      if (err.message === 'CANCELLED') {
        showToast('Đã hủy quá trình xuất video.');
      } else {
        showToast(`Lỗi xuất video: ${err.message}`);
      }
    } finally {
      setIsExportingVideo(false);
      exportAbortRef.current = null;
    }
  };

  const handleCancelExportMp4 = () => {
    if (exportAbortRef.current) {
      exportAbortRef.current.abort();
    }
  };

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

  const handleTimelineScrub = (e) => {
    if (!unifiedAudioConfig || !masterAudioRef.current || audioDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = ratio * audioDuration;
    masterAudioRef.current.currentTime = targetSec;
    setAudioCurrentTime(targetSec);

    const timeline = unifiedAudioConfig.timeline;
    const cue =
      timeline.find((c) => targetSec >= c.startSec && targetSec < c.endSec) ||
      timeline[timeline.length - 1];
    if (cue) {
      const gIdx = cue.stepIndex;
      lastSyncedGlobalStepRef.current = gIdx;
      if (gIdx < totalDrawingSteps) {
        setMode('drawing');
        setCurrentStepIndex(gIdx);
      } else {
        setMode('solving');
        setCurrentStepIndex(gIdx - totalDrawingSteps);
      }
      const span = Math.max(0.15, cue.endSec - cue.startSec);
      setStepProgress(Math.min(1, Math.max(0, (targetSec - cue.startSec) / (span * 0.88))));
    }
  };

  const cyclePlaybackRate = () => {
    const nextIdx = (PLAYBACK_RATES.indexOf(playbackRate) + 1) % PLAYBACK_RATES.length;
    setPlaybackRate(PLAYBACK_RATES[nextIdx]);
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#0b1120] text-slate-100 flex flex-col">
      {/* Thanh điều hướng trên cùng */}
      <header className="shrink-0 px-4 py-2 bg-slate-950/90 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-950">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
              Giải & Vẽ Hình Toán Hình Học THCS
            </h1>
            <p className="text-[11px] text-slate-400 leading-tight">
              Đồng bộ âm thanh tức thì • Kho bài mẫu rời • Lưu tự động lên GitHub
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
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{draftProblem ? 'Tiếp tục sửa bản nháp' : 'Nạp đề mới'}</span>
          </button>

          <button
            onClick={() => {
              setApiKeyDraft(geminiApiKey);
              setGithubDraft(githubConfig);
              setSettingsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700"
            title="Cài đặt Gemini API Key & GitHub"
          >
            <Key className="w-3.5 h-3.5 text-sky-400" />
            <Github className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Cài đặt API</span>
          </button>
        </div>
      </header>

      {/* Thanh chọn Dạng bài & Danh sách bài mẫu của khối lớp */}
      <div className="shrink-0 px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
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

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar">
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
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2.5 overflow-hidden">
        {/* Cột trái: Bảng vẽ hình + Thanh điều khiển phát & Tải video MP4 */}
        <div className="lg:col-span-7 flex flex-col gap-2 min-h-0 h-full">
          <div className="flex-1 min-h-[240px] lg:min-h-0 relative">
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
                <p className="text-sm text-slate-300">
                  Chưa có bài mẫu trong mục này. Bấm "Nạp đề mới" để tạo bài đầu tiên!
                </p>
              </div>
            )}
          </div>

          {/* Thanh điều khiển trình chiếu hình vẽ + Thanh tua tiến trình âm thanh */}
          {activeProblem && (
            <div className="shrink-0 px-3 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
              {/* Thanh tua mốc thời gian âm thanh */}
              {unifiedAudioConfig && audioDuration > 0 && (
                <div className="flex items-center gap-2.5 px-1">
                  <span className="text-[11px] font-mono text-slate-400 w-10 text-right shrink-0">
                    {formatSecondsMMSS(audioCurrentTime)}
                  </span>
                  <div
                    onClick={handleTimelineScrub}
                    className="relative flex-1 h-1.5 rounded-full bg-slate-800 cursor-pointer overflow-hidden group"
                    title="Bấm vào vị trí bất kỳ để tua nhanh bài giảng"
                  >
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-[width] duration-75"
                      style={{
                        width: `${Math.min(100, Math.max(0, (audioCurrentTime / audioDuration) * 100))}%`
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 w-10 shrink-0">
                    {formatSecondsMMSS(audioDuration)}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      stopPlayback();
                      jumpToGlobalStep(0, false);
                    }}
                    disabled={isExportingVideo}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200"
                    title="Về đầu bài"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const wasPlaying = isPlaying;
                      if (!unifiedAudioConfig) stopPlayback();
                      jumpToGlobalStep(globalStepIndex - 1, wasPlaying);
                    }}
                    disabled={isExportingVideo}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200"
                    title="Bước trước"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setIsPlaying((p) => !p)}
                    disabled={isExportingVideo}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Tạm dừng' : 'Phát bài giảng'}</span>
                  </button>

                  <button
                    onClick={() => {
                      const wasPlaying = isPlaying;
                      if (!unifiedAudioConfig) stopPlayback();
                      jumpToGlobalStep(globalStepIndex + 1, wasPlaying);
                    }}
                    disabled={isExportingVideo}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200"
                    title="Bước tiếp theo"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={cyclePlaybackRate}
                    disabled={isExportingVideo}
                    className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sky-300 font-mono text-[11px] font-bold"
                    title="Đổi tốc độ giảng bài"
                  >
                    {playbackRate}x
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setShowFullFigure((v) => !v)}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium ${
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
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium ${
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
                    {isMuted ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Volume2
                        className={`w-3.5 h-3.5 ${audioReady ? 'text-emerald-400' : 'text-sky-400'}`}
                      />
                    )}
                  </button>

                  {/* Nút tải video MP4 bài giảng */}
                  <button
                    onClick={handleExportMp4}
                    disabled={isExportingVideo}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 text-slate-950 shadow"
                    title="Xuất và tải video MP4 có đầy đủ hình vẽ, lời giải và âm thanh"
                  >
                    {isExportingVideo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang xuất {exportProgress.percent}%</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-3.5 h-3.5" />
                        <span>Tải video MP4</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cột phải: Đề bài, GT-KL & Danh sách các bước có thanh cuộn riêng */}
        <div className="lg:col-span-5 flex flex-col gap-2 min-h-0 h-full overflow-hidden">
          {activeProblem && (
            <>
              {/* Khung Đề bài */}
              <div className="shrink-0 max-h-[38%] overflow-y-auto custom-scrollbar p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
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
                  <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800/80">
                    <div className="font-bold text-amber-400 mb-0.5">GT</div>
                    <ul className="space-y-0.5 text-slate-200">
                      {(activeProblem.given || []).map((g, i) => (
                        <li key={i}>• {g}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800/80">
                    <div className="font-bold text-emerald-400 mb-0.5">KL</div>
                    <ul className="space-y-0.5 text-slate-200">
                      {(activeProblem.prove || []).map((p, i) => (
                        <li key={i}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Chuyển tab Vẽ hình / Lời giải */}
              <div className="shrink-0 flex gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => {
                    const wasPlaying = isPlaying;
                    if (!unifiedAudioConfig) stopPlayback();
                    jumpToGlobalStep(0, wasPlaying);
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                    mode === 'drawing'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Các bước vẽ hình ({totalDrawingSteps})
                </button>
                <button
                  onClick={() => {
                    const wasPlaying = isPlaying;
                    if (!unifiedAudioConfig) stopPlayback();
                    jumpToGlobalStep(totalDrawingSteps, wasPlaying);
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                    mode === 'solving'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Lời giải chi tiết ({totalSolutionSteps})
                </button>
              </div>

              {/* Danh sách từng bước có thanh cuộn lên/xuống riêng & tự cuộn mượt theo lời dẫn */}
              <div
                ref={stepsContainerRef}
                className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1.5 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800"
              >
                {mode === 'drawing'
                  ? (activeProblem.drawingSteps || []).map((st, idx) => {
                      const active = idx === currentStepIndex;
                      return (
                        <div
                          key={idx}
                          ref={active ? activeStepBoxRef : null}
                          onClick={() => {
                            const wasPlaying = isPlaying;
                            if (!unifiedAudioConfig) stopPlayback();
                            jumpToGlobalStep(idx, wasPlaying);
                          }}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            active
                              ? 'bg-sky-950/70 border-sky-500/70 text-sky-100 shadow-sm'
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
                            const wasPlaying = isPlaying;
                            if (!unifiedAudioConfig) stopPlayback();
                            jumpToGlobalStep(totalDrawingSteps + idx, wasPlaying);
                          }}
                          className={`p-2.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition whitespace-pre-line ${
                            active
                              ? 'bg-emerald-950/70 border-emerald-500/70 text-emerald-100 font-medium shadow-sm'
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
        <footer className="shrink-0 px-4 py-2 bg-slate-950 border-t border-slate-800/90 flex items-center gap-3 text-xs">
          <span
            className={`px-2 py-0.5 rounded font-bold shrink-0 ${
              mode === 'drawing'
                ? 'bg-sky-500/20 text-sky-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {mode === 'drawing'
              ? `Vẽ ${currentStepIndex + 1}/${totalDrawingSteps}`
              : `Giải ${currentStepIndex + 1}/${totalSolutionSteps}`}
          </span>
          <div className="flex-1 truncate text-slate-200 font-medium">{currentNarrationText}</div>
        </footer>
      )}

      {/* Hộp tiến trình khi đang xuất video MP4 */}
      {isExportingVideo && (
        <div className="fixed bottom-12 left-4 z-50 w-80 rounded-2xl bg-slate-900/95 border border-emerald-500/50 p-3.5 shadow-2xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-300 flex items-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tạo video MP4 bài giảng...</span>
            </span>
            <span className="font-mono font-bold text-white">{exportProgress.percent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-[width] duration-150"
              style={{ width: `${exportProgress.percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {exportProgress.totalSec > 0
                ? `${formatSecondsMMSS(exportProgress.currentSec)} / ${formatSecondsMMSS(
                    exportProgress.totalSec
                  )}`
                : 'Giữ nguyên tab trình duyệt để ghi hình...'}
            </span>
            <button
              onClick={handleCancelExportMp4}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold"
            >
              Hủy xuất
            </button>
          </div>
        </div>
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
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
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
                  <label className="block text-slate-400 mb-1">
                    GitHub Personal Access Token (quyền Contents: Read & Write)
                  </label>
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
