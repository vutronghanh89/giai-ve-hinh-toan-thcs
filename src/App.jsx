import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  FolderArchive,
  Sparkles,
  Settings,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Eye,
  ListChecks,
  CheckCircle2,
  Video,
  MessageSquareQuote,
  FileText,
  Scale,
  X
} from 'lucide-react';
import GeometryCanvas from './components/GeometryCanvas.jsx';
import DraftStudioDrawer from './components/DraftStudioDrawer.jsx';
import MathText from './components/MathText.jsx';
import { fetchLessonsCatalog, fetchLessonDetail } from './services/lessonLoader.js';
import {
  loadSavedGithubConfig,
  saveGithubConfigToLocal,
  testGithubConnection,
  loadExternalScript,
  buildUnifiedAudioPackage
} from './services/githubStorageService.js';
import { exportLectureVideo } from './services/videoExporter.js';
import { buildEffectiveTimeline, resolveVisualStateAtTime } from './services/timelineHelper.js';
import savedSamples from './data/savedSamples.json';

const API_KEY_STORAGE = 'toan_hinh_gemini_api_key';
const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

const DEFAULT_FALLBACK_LESSON = {
  id: 'toan-9-dien-tich-hinh-quat-giay',
  grade: 'Toán 9',
  topic: 'Độ dài cung tròn & Diện tích hình quạt tròn',
  title: 'Tính diện tích phần giấy dán của chiếc quạt giấy',
  hasStaticAudio: false,
  problemText:
    'Một chiếc quạt giấy khi xòe ra hoàn toàn có dạng một hình quạt tròn bán kính 24 cm và góc ở tâm bằng 150°. Phần giấy dán của quạt là một hình vành khuyên giới hạn bởi hai cung tròn đồng tâm có bán kính lần lượt là 24 cm và 10 cm ứng với góc ở tâm 150°. Tính diện tích phần giấy dán của chiếc quạt đó theo đơn vị cm² (lấy π ≈ 3,14, kết quả làm tròn đến hàng đơn vị).',
  given: [
    'Hình quạt tròn tâm O, bán kính $R = 24\\text{ cm}$, góc ở tâm $150^\\circ$',
    'Phần giấy dán là phần hình vành khuyên giới hạn bởi hai cung tròn đồng tâm O, bán kính $R = 24\\text{ cm}$ và $r = 10\\text{ cm}$, góc ở tâm $150^\\circ$',
    '$\\pi \\approx 3{,}14$'
  ],
  prove: ['Tính diện tích phần giấy dán của chiếc quạt đó theo đơn vị cm² (làm tròn đến hàng đơn vị)'],
  drawingSteps: [
    {
      caption: 'Vẽ tâm O và hai bán kính OA, OB tạo thành góc ở tâm 150°.',
      voiceExplanation: 'Bước một, ta lấy điểm O làm tâm và vẽ hai bán kính O A, O B tạo với nhau góc 150 độ.',
      tool: 'protractor',
      highlightSegments: ['O-A', 'O-B'],
      highlightPoints: ['O', 'A', 'B']
    },
    {
      caption: 'Quay cung tròn lớn tâm O bán kính R = 24 cm và cung tròn nhỏ bán kính r = 10 cm.',
      voiceExplanation: 'Bước hai, dùng compa quay cung tròn lớn bán kính 24 xen ti mét và cung tròn nhỏ bán kính 10 xen ti mét, hoàn thiện hình chiếc quạt giấy.',
      tool: 'compass',
      highlightSegments: ['C-A', 'D-B'],
      highlightPoints: ['C', 'D']
    }
  ],
  geometry: {
    points: [
      { id: 'O', label: 'O', x: 0, y: 95, dx: 0, dy: 18, drawStep: 0 },
      { id: 'A', label: 'A', x: -154, y: 54, dx: -16, dy: 10, drawStep: 0 },
      { id: 'B', label: 'B', x: 154, y: 54, dx: 16, dy: 10, drawStep: 0 },
      { id: 'C', label: 'C', x: -64, y: 78, dx: -12, dy: 16, drawStep: 1 },
      { id: 'D', label: 'D', x: 64, y: 78, dx: 12, dy: 16, drawStep: 1 }
    ],
    segments: [
      { from: 'O', to: 'A', style: 'dashed', color: 'main', ticks: 0, drawStep: 0 },
      { from: 'O', to: 'B', style: 'dashed', color: 'main', ticks: 0, drawStep: 0 },
      { from: 'C', to: 'A', style: 'solid', color: 'accent', ticks: 0, drawStep: 1 },
      { from: 'D', to: 'B', style: 'solid', color: 'accent', ticks: 0, drawStep: 1 }
    ],
    circles: [
      {
        center: 'O',
        radius: 160,
        startAngle: Math.PI + 0.26,
        endAngle: Math.PI * 2 - 0.26,
        style: 'solid',
        color: 'accent',
        drawStep: 1
      },
      {
        center: 'O',
        radius: 67,
        startAngle: Math.PI + 0.26,
        endAngle: Math.PI * 2 - 0.26,
        style: 'solid',
        color: 'emerald',
        drawStep: 1
      }
    ],
    rightAngles: [],
    angleArcs: [
      { vertex: 'O', p1: 'B', p2: 'A', radius: 28, label: '150°', color: 'accent', drawStep: 0 }
    ]
  },
  solutionSteps: [
    {
      lineText:
        'Phân tích: Diện tích phần giấy dán bằng hiệu diện tích hình quạt tròn lớn ($R = 24\\text{ cm}$, góc ở tâm $150^\\circ$) và hình quạt tròn nhỏ không dán giấy ($r = 10\\text{ cm}$, góc ở tâm $150^\\circ$).',
      voiceExplanation:
        'Diện tích phần giấy dán bằng hiệu diện tích hình quạt tròn lớn bán kính 24 xen ti mét và hình quạt tròn nhỏ không dán giấy bán kính 10 xen ti mét.',
      highlightSegments: ['O-A', 'O-B'],
      highlightPoints: ['O', 'A', 'B'],
      highlightPolygons: []
    },
    {
      lineText:
        'Diện tích hình quạt tròn lớn (bán kính $R = 24\\text{ cm}$, góc ở tâm $n = 150^\\circ$): $S_1 = \\dfrac{\\pi \\cdot R^2 \\cdot n}{360} = \\dfrac{\\pi \\cdot 24^2 \\cdot 150}{360} = 240\\pi\\ (\\text{cm}^2)$',
      voiceExplanation:
        'Diện tích hình quạt tròn lớn S 1 bằng pi nhân R bình phương nhân n phần 360, bằng pi nhân 24 bình phương nhân 150 phần 360, bằng 240 pi xen ti mét vuông.',
      highlightSegments: ['C-A', 'D-B'],
      highlightPoints: ['A', 'B'],
      highlightPolygons: []
    },
    {
      lineText:
        'Diện tích hình quạt tròn nhỏ không dán giấy (bán kính $r = 10\\text{ cm}$, góc ở tâm $n = 150^\\circ$): $S_2 = \\dfrac{\\pi \\cdot r^2 \\cdot n}{360} = \\dfrac{\\pi \\cdot 10^2 \\cdot 150}{360} = \\dfrac{125}{3}\\pi\\ (\\text{cm}^2)$',
      voiceExplanation:
        'Diện tích hình quạt tròn nhỏ không dán giấy S 2 bằng pi nhân r bình phương nhân n phần 360, bằng pi nhân 10 bình phương nhân 150 phần 360, bằng 125 phần 3 pi xen ti mét vuông.',
      highlightSegments: ['O-C', 'O-D'],
      highlightPoints: ['O', 'C', 'D'],
      highlightPolygons: []
    },
    {
      lineText:
        'Diện tích phần giấy dán của chiếc quạt là: $S = S_1 - S_2 = 240\\pi - \\dfrac{125}{3}\\pi = \\dfrac{595}{3}\\pi\\ (\\text{cm}^2)$',
      voiceExplanation:
        'Diện tích phần giấy dán của chiếc quạt là S bằng S 1 trừ S 2, bằng 240 pi trừ 125 phần 3 pi, bằng 595 phần 3 pi xen ti mét vuông.',
      highlightSegments: ['C-A', 'D-B'],
      highlightPoints: ['A', 'B', 'C', 'D'],
      highlightPolygons: []
    },
    {
      lineText:
        'Thay $\\pi \\approx 3{,}14$ ta được: $S \\approx \\dfrac{595 \\cdot 3{,}14}{3} \\approx 622{,}77 \\approx 623\\ (\\text{cm}^2)$. Vậy diện tích phần giấy dán khoảng 623 cm².',
      voiceExplanation:
        'Thay pi xấp xỉ 3 phẩy 14 ta được S xấp xỉ 595 nhân 3 phẩy 14 phần 3, xấp xỉ 622 phẩy 77, làm tròn đến hàng đơn vị bằng 623 xen ti mét vuông.',
      highlightSegments: ['C-A', 'D-B'],
      highlightPoints: ['A', 'B', 'C', 'D'],
      highlightPolygons: []
    }
  ]
};

function formatTimeMMSS(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [catalog, setCatalog] = useState([]);
  const [lesson, setLesson] = useState(DEFAULT_FALLBACK_LESSON);
  const [audioUrl, setAudioUrl] = useState('');
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState('');

  const [mode, setMode] = useState('draw');
  const [drawStepIdx, setDrawStepIdx] = useState(0);
  const [solveStepIdx, setSolveStepIdx] = useState(-1);
  const [drawProgress, setDrawProgress] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showAllSolution, setShowAllSolution] = useState(false);

  const [audioCurrentSec, setAudioCurrentSec] = useState(0);
  const [audioDurationSec, setAudioDurationSec] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [videoProgressPct, setVideoProgressPct] = useState(0);
  const videoAbortRef = useRef(null);

  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showStudioDrawer, setShowStudioDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [ghConfig, setGhConfig] = useState(() => loadSavedGithubConfig());
  const [ghTestStatus, setGhTestStatus] = useState('');

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);
  const isScrubbingRef = useRef(false);
  const seekLockUntilRef = useRef(0);
  const ownedBlobUrlRef = useRef('');
  const zipInputRef = useRef(null);
  const solutionScrollRef = useRef(null);
  const activeStepRef = useRef(null);

  const drawingSteps = lesson?.drawingSteps || [];
  const solutionSteps = lesson?.solutionSteps || [];
  const totalDrawSteps = drawingSteps.length;
  const totalSolveSteps = solutionSteps.length;
  const totalTimelineSteps = Math.max(1, totalDrawSteps + totalSolveSteps);

  // Nạp âm thanh tĩnh thành Blob URL trong RAM để tua (seek) tức thì, không bao giờ nhảy về 0:00
  useEffect(() => {
    let cancelled = false;

    if (ownedBlobUrlRef.current) {
      URL.revokeObjectURL(ownedBlobUrlRef.current);
      ownedBlobUrlRef.current = '';
    }

    if (!audioUrl) {
      setResolvedAudioUrl('');
      return;
    }

    if (audioUrl.startsWith('blob:') || audioUrl.startsWith('data:')) {
      setResolvedAudioUrl(audioUrl);
      return;
    }

    setResolvedAudioUrl(audioUrl);
    fetch(audioUrl)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        const localBlobUrl = URL.createObjectURL(blob);
        ownedBlobUrlRef.current = localBlobUrl;
        setResolvedAudioUrl(localBlobUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (ownedBlobUrlRef.current) {
        URL.revokeObjectURL(ownedBlobUrlRef.current);
        ownedBlobUrlRef.current = '';
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchLessonsCatalog().then(async (list) => {
      if (!mounted) return;
      const merged = list.length > 0 ? list : Array.isArray(savedSamples) ? savedSamples : [];
      setCatalog(merged);
      if (merged.length > 0 && merged[0].path) {
        try {
          const firstDetail = await fetchLessonDetail(merged[0]);
          if (mounted) {
            applyLoadedLesson(firstDetail);
          }
        } catch {
          // Giữ bài mặc định nếu chạy offline
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const applyLoadedLesson = (newLesson, customAudioBlobUrl = '') => {
    setIsPlaying(false);
    setAudioCurrentSec(0);
    setAudioDurationSec(0);
    seekLockUntilRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setLesson(newLesson);
    const dCount = (newLesson.drawingSteps || []).length;
    const sCount = (newLesson.solutionSteps || []).length;
    setMode(dCount > 0 ? 'draw' : 'solve');
    setDrawStepIdx(0);
    setSolveStepIdx(dCount === 0 && sCount > 0 ? 0 : -1);
    setDrawProgress(1);
    setShowAllSolution(false);

    if (customAudioBlobUrl) {
      setAudioUrl(customAudioBlobUrl);
    } else if (newLesson.hasStaticAudio && newLesson.audioBasePath && newLesson.audioFile) {
      setAudioUrl(`${newLesson.audioBasePath}/${newLesson.audioFile}?t=${Date.now()}`);
    } else {
      setAudioUrl('');
    }
  };

  const syncVisualStateToTime = useCallback(
    (targetSec, durationOverride) => {
      const dur =
        Number.isFinite(durationOverride) && durationOverride > 0
          ? durationOverride
          : audioDurationSec;
      const st = resolveVisualStateAtTime(lesson, targetSec, dur);
      setMode(st.mode);
      setDrawStepIdx(st.drawIdx);
      setSolveStepIdx(st.solveIdx);
      setDrawProgress(st.drawProg);
    },
    [lesson, audioDurationSec]
  );

  const handleSelectCatalogItem = async (item) => {
    setShowCatalogModal(false);
    try {
      if (item.path) {
        const detail = await fetchLessonDetail(item);
        applyLoadedLesson(detail);
      } else {
        applyLoadedLesson(item);
      }
    } catch (err) {
      alert(err.message || 'Không tải được bài học.');
    }
  };

  const handleImportZipFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      await loadExternalScript(JSZIP_CDN);
      const zip = await window.JSZip.loadAsync(file);

      let jsonEntry = null;
      let audioEntry = null;
      zip.forEach((relPath, entry) => {
        if (!entry.dir && relPath.endsWith('data.json')) jsonEntry = entry;
        if (!entry.dir && (relPath.endsWith('.mp3') || relPath.endsWith('.wav'))) audioEntry = entry;
      });

      if (!jsonEntry) {
        throw new Error('Không tìm thấy tệp data.json bên trong gói .zip.');
      }

      const jsonText = await jsonEntry.async('string');
      const parsedLesson = JSON.parse(jsonText);

      let blobUrl = '';
      if (audioEntry) {
        const audioBlob = await audioEntry.async('blob');
        blobUrl = URL.createObjectURL(audioBlob);
        parsedLesson.hasStaticAudio = true;
      }

      applyLoadedLesson(parsedLesson, blobUrl);
    } catch (err) {
      alert(err.message || 'Không đọc được gói bài giảng .zip.');
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
    audio.muted = isMuted;
    audio.volume = volume;
  }, [playbackRate, isMuted, volume, resolvedAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedAudioUrl) return;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setAudioDurationSec(audio.duration);
        // Nếu người dùng đã tua trước khi metadata tải xong, khôi phục đúng vị trí đã chọn
        if (audioCurrentSec > 0.05 && Math.abs(audio.currentTime - audioCurrentSec) > 0.25) {
          audio.currentTime = Math.min(audio.duration - 0.05, audioCurrentSec);
        }
      }
    };

    const onTimeUpdate = () => {
      if (isScrubbingRef.current || audio.seeking) return;
      if (performance.now() < seekLockUntilRef.current) return;

      const t = audio.currentTime;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : audioDurationSec;
      setAudioCurrentSec(t);
      if (dur > 0 && dur !== audioDurationSec) {
        setAudioDurationSec(dur);
      }
      syncVisualStateToTime(t, dur);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setMode(totalSolveSteps > 0 ? 'solve' : 'draw');
      setDrawProgress(1);
      if (totalSolveSteps > 0) setSolveStepIdx(totalSolveSteps - 1);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [resolvedAudioUrl, audioDurationSec, audioCurrentSec, totalSolveSteps, syncVisualStateToTime]);

  useEffect(() => {
    if (!isPlaying || resolvedAudioUrl) return;

    const intervalMs = 60;
    const stepDurationMs = 2600 / playbackRate;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += intervalMs;
      if (mode === 'draw') {
        const prog = Math.min(1, elapsed / (stepDurationMs * 0.7));
        setDrawProgress(prog);
        if (elapsed >= stepDurationMs) {
          elapsed = 0;
          if (drawStepIdx + 1 < totalDrawSteps) {
            setDrawStepIdx((i) => i + 1);
            setDrawProgress(0.05);
          } else if (totalSolveSteps > 0) {
            setMode('solve');
            setSolveStepIdx(0);
            setDrawProgress(1);
          } else {
            setIsPlaying(false);
          }
        }
      } else {
        if (elapsed >= stepDurationMs) {
          elapsed = 0;
          if (solveStepIdx + 1 < totalSolveSteps) {
            setSolveStepIdx((i) => i + 1);
          } else {
            setIsPlaying(false);
          }
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, resolvedAudioUrl, mode, drawStepIdx, solveStepIdx, totalDrawSteps, totalSolveSteps, playbackRate]);

  // Tự động cuộn khung Lời giải theo bước đang thuyết minh
  useEffect(() => {
    if (mode !== 'solve' || solveStepIdx < 0) return;
    const container = solutionScrollRef.current;
    const activeEl = activeStepRef.current;
    if (!container) return;

    if (showAllSolution && activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [mode, solveStepIdx, showAllSolution]);

  const seekToSecond = useCallback(
    (targetSec) => {
      const audio = audioRef.current;
      const dur =
        audio && Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : audioDurationSec;

      if (dur > 0) {
        const clampedSec = Math.max(0, Math.min(Math.max(0, dur - 0.05), targetSec));
        seekLockUntilRef.current = performance.now() + 350;
        setAudioCurrentSec(clampedSec);
        syncVisualStateToTime(clampedSec, dur);
        if (audio && resolvedAudioUrl && audio.readyState >= 1) {
          try {
            audio.currentTime = clampedSec;
          } catch {
            // Sẽ tự đồng bộ trong onLoadedMetadata
          }
        }
      }
    },
    [audioDurationSec, resolvedAudioUrl, syncVisualStateToTime]
  );

  const jumpToGlobalStep = (globalIdx) => {
    const clamped = Math.max(0, Math.min(totalTimelineSteps - 1, globalIdx));
    if (clamped < totalDrawSteps) {
      setMode('draw');
      setDrawStepIdx(clamped);
      setSolveStepIdx(-1);
      setDrawProgress(1);
    } else {
      setMode('solve');
      setDrawStepIdx(Math.max(0, totalDrawSteps - 1));
      setDrawProgress(1);
      setSolveStepIdx(clamped - totalDrawSteps);
    }

    const dur =
      audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0
        ? audioRef.current.duration
        : audioDurationSec;
    const effectiveTimeline = buildEffectiveTimeline(lesson, dur);
    const entry = effectiveTimeline.find((item) => item.stepIndex === clamped);
    if (resolvedAudioUrl && entry) {
      seekToSecond(entry.startSec);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    if (audioRef.current && resolvedAudioUrl) {
      const audio = audioRef.current;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : audioDurationSec;
      // Nếu đã chạy hết bài thì phát lại từ đầu, ngược lại phát tiếp ngay tại vị trí vừa tua
      if (dur > 0 && audioCurrentSec >= dur - 0.12) {
        seekToSecond(0);
      } else if (Math.abs(audio.currentTime - audioCurrentSec) > 0.2) {
        try {
          audio.currentTime = audioCurrentSec;
        } catch {}
      }
      setIsPlaying(true);
      audio.play().catch(() => {
        setIsPlaying(false);
      });
      return;
    }

    setIsPlaying(true);
  };

  const handleReset = () => {
    setIsPlaying(false);
    seekLockUntilRef.current = performance.now() + 300;
    setAudioCurrentSec(0);
    if (audioRef.current) {
      audioRef.current.pause();
      try {
        audioRef.current.currentTime = 0;
      } catch {}
    }
    setMode(totalDrawSteps > 0 ? 'draw' : 'solve');
    setDrawStepIdx(0);
    setSolveStepIdx(totalDrawSteps === 0 && totalSolveSteps > 0 ? 0 : -1);
    setDrawProgress(1);
  };

  const currentGlobalStep =
    mode === 'draw' ? drawStepIdx : totalDrawSteps + Math.max(0, solveStepIdx);

  const handlePrevStep = () => jumpToGlobalStep(currentGlobalStep - 1);
  const handleNextStep = () => jumpToGlobalStep(currentGlobalStep + 1);

  const scrubToClientX = useCallback(
    (clientX) => {
      const bar = progressBarRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));

      const dur =
        audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0
          ? audioRef.current.duration
          : audioDurationSec;

      if (resolvedAudioUrl && dur > 0) {
        seekToSecond(ratio * dur);
        return;
      }

      const targetStep = Math.min(totalTimelineSteps - 1, Math.floor(ratio * totalTimelineSteps));
      jumpToGlobalStep(targetStep);
    },
    [audioDurationSec, resolvedAudioUrl, seekToSecond, totalTimelineSteps]
  );

  const handleProgressPointerDown = (e) => {
    e.preventDefault();
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scrubToClientX(e.clientX);
  };

  const handleProgressPointerMove = (e) => {
    if (!isScrubbingRef.current) return;
    scrubToClientX(e.clientX);
  };

  const handleProgressPointerUp = (e) => {
    if (!isScrubbingRef.current) return;
    scrubToClientX(e.clientX);
    isScrubbingRef.current = false;
    setIsScrubbing(false);
  };

  const handleExportVideo = async () => {
    if (isExportingVideo) {
      videoAbortRef.current?.abort();
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
    }

    const controller = new AbortController();
    videoAbortRef.current = controller;
    setIsExportingVideo(true);
    setVideoProgressPct(0);

    try {
      await exportLectureVideo({
        lesson,
        audioUrl: resolvedAudioUrl || audioUrl,
        onProgress: setVideoProgressPct,
        signal: controller.signal
      });
    } catch (err) {
      if (err.message !== 'ABORTED') {
        alert(err.message || 'Không xuất được video bài giảng.');
      }
    } finally {
      setIsExportingVideo(false);
      setVideoProgressPct(0);
    }
  };

  const activeStepConfig =
    mode === 'draw'
      ? drawingSteps[drawStepIdx] || null
      : solutionSteps[solveStepIdx] || null;

  const activeSubtitleText = useMemo(() => {
    if (mode === 'draw') {
      const st = drawingSteps[drawStepIdx];
      return st?.voiceExplanation || st?.caption || 'Đang dựng hình theo yêu cầu đề bài...';
    }
    const st = solutionSteps[solveStepIdx];
    return st?.voiceExplanation || st?.lineText || 'Bấm "Tự động giảng" để bắt đầu bài giảng.';
  }, [mode, drawStepIdx, solveStepIdx, drawingSteps, solutionSteps]);

  const visibleSolutionSteps = useMemo(() => {
    if (showAllSolution) return solutionSteps;
    if (mode === 'draw') return [];
    return solutionSteps.slice(0, Math.max(0, solveStepIdx + 1));
  }, [solutionSteps, showAllSolution, mode, solveStepIdx]);

  const progressPercent = useMemo(() => {
    if (resolvedAudioUrl && audioDurationSec > 0) {
      return Math.min(100, Math.max(0, (audioCurrentSec / audioDurationSec) * 100));
    }
    const subProg = mode === 'draw' ? drawProgress : 1;
    return Math.min(100, Math.max(0, ((currentGlobalStep + subProg) / totalTimelineSteps) * 100));
  }, [resolvedAudioUrl, audioDurationSec, audioCurrentSec, mode, drawProgress, currentGlobalStep, totalTimelineSteps]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1120] text-slate-100 lg:h-screen lg:overflow-hidden">
      {resolvedAudioUrl && <audio ref={audioRef} src={resolvedAudioUrl} preload="auto" />}

      {/* Header gọn trên cùng */}
      <header className="shrink-0 border-b border-slate-800/90 bg-[#0f172a] px-3 py-2 sm:px-4">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-slate-950 shadow">
              △
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white sm:text-[15px]">
                  Giải & Vẽ Hình Toán Hình Học THCS
                </h1>
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                  {lesson.grade}
                </span>
                <span className="hidden text-xs text-slate-400 md:inline">• {lesson.topic}</span>
              </div>
              <p className="text-[11px] font-medium text-slate-300 line-clamp-1">{lesson.title}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowCatalogModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-xs font-medium text-slate-100 transition hover:border-emerald-500/50 hover:bg-slate-800"
            >
              <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
              <span>Bài mẫu ({catalog.length})</span>
            </button>

            <button
              type="button"
              onClick={() => zipInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-xs font-medium text-slate-100 transition hover:border-sky-500/50 hover:bg-slate-800"
            >
              <FolderArchive className="h-3.5 w-3.5 text-sky-400" />
              <span>Tải gói bài (.zip)</span>
            </button>
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip"
              onChange={handleImportZipFile}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => setShowStudioDrawer(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Soạn bài / AI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              title="Cài đặt API Key & GitHub"
              className="rounded-lg border border-slate-700 bg-slate-800/90 p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Khung chính 2 hàng x 2 cột:
          Hàng 1: [ Đề bài ] | [ GT - KL ]
          Hàng 2: [ Hình vẽ ] | [ Lời giải ] */}
      <main className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-2.5 p-2.5 sm:px-4 lg:min-h-0">
        {/* HÀNG 1: ĐỀ BÀI | GT - KL */}
        <div className="grid shrink-0 grid-cols-1 gap-2.5 lg:h-[148px] xl:h-[160px] lg:grid-cols-2">
          {/* Ô 1: Đề bài */}
          <section className="flex min-h-[100px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] shadow">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800/90 bg-slate-900/70 px-3 py-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sky-400">
                <FileText className="h-3.5 w-3.5" />
                <span>Đề bài</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400 line-clamp-1">
                {lesson.title}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 text-xs leading-relaxed text-slate-200 sm:text-[13px]">
              <MathText text={lesson.problemText} blockEquations={false} />
            </div>
          </section>

          {/* Ô 2: GT - KL */}
          <section className="flex min-h-[100px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] shadow">
            <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-800/90 bg-slate-900/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-400">
              <Scale className="h-3.5 w-3.5" />
              <span>GT - KL</span>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-2 overflow-y-auto px-3 py-2 text-xs sm:grid-cols-2">
              <div className="border-b border-slate-800/70 pb-1.5 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-2.5">
                <div className="font-bold text-sky-400">Giả thiết (GT):</div>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-slate-200">
                  {(lesson.given || []).map((g, idx) => (
                    <li key={idx}>
                      <MathText text={g} blockEquations={false} />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sm:pl-1">
                <div className="font-bold text-emerald-400">Kết luận (KL):</div>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-slate-200">
                  {(lesson.prove || []).map((p, idx) => (
                    <li key={idx}>
                      <MathText text={p} blockEquations={false} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* HÀNG 2: HÌNH VẼ | LỜI GIẢI */}
        <div className="grid min-h-[360px] flex-1 grid-cols-1 gap-2.5 lg:min-h-0 lg:grid-cols-2">
          {/* Ô 3: Hình vẽ (luôn hiển thị cố định trọn vẹn hình) */}
          <section className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] shadow lg:min-h-0">
            <GeometryCanvas
              geometry={lesson.geometry}
              mode={mode}
              activeDrawStep={drawStepIdx}
              activeSolveStep={solveStepIdx}
              activeStepConfig={activeStepConfig}
              drawProgress={drawProgress}
            />
          </section>

          {/* Ô 4: Lời giải (gọn giãn dòng, bỏ đánh số đầu dòng, công thức dài xuống dòng riêng, tự động cuộn) */}
          <section className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] shadow lg:min-h-0">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800/90 bg-slate-900/70 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-white">
                  Lời giải chi tiết
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">
                  {showAllSolution
                    ? `${totalSolveSteps} / ${totalSolveSteps}`
                    : `${mode === 'solve' ? Math.max(0, solveStepIdx + 1) : 0} / ${totalSolveSteps}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextShowAll = !showAllSolution;
                    setShowAllSolution(nextShowAll);
                    if (nextShowAll) {
                      setMode('solve');
                      setDrawProgress(1);
                      if (totalSolveSteps > 0 && solveStepIdx < 0) {
                        setSolveStepIdx(totalSolveSteps - 1);
                      }
                    }
                  }}
                  className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  <Eye className="h-3 w-3 text-emerald-400" />
                  <span>{showAllSolution ? 'Theo từng bước' : 'Hiện tất cả'}</span>
                </button>
              </div>
            </div>

            <div
              ref={solutionScrollRef}
              className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
            >
              {visibleSolutionSteps.length === 0 ? (
                <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 p-4 text-center">
                  <p className="text-xs font-medium text-slate-300">
                    Đang ở giai đoạn dựng hình từng bước
                  </p>
                  <p className="mt-1 max-w-md text-[11px] text-slate-400">
                    Bấm "Tự động giảng" để xem dựng hình và lời giải xuất hiện đồng bộ, hoặc bấm "Hiện tất cả" để xem ngay toàn bộ lời giải.
                  </p>
                </div>
              ) : (
                visibleSolutionSteps.map((step, idx) => {
                  const isActive = mode === 'solve' && solveStepIdx === idx;
                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeStepRef : null}
                      onClick={() => {
                        setMode('solve');
                        setDrawProgress(1);
                        setSolveStepIdx(idx);
                        jumpToGlobalStep(totalDrawSteps + idx);
                      }}
                      className={`cursor-pointer rounded-lg border px-2.5 py-1.5 transition ${
                        isActive
                          ? 'border-emerald-500/70 bg-emerald-950/35 text-white shadow-sm'
                          : 'border-transparent bg-slate-900/50 text-slate-200 hover:border-slate-700/80 hover:bg-slate-900'
                      }`}
                    >
                      <div className="min-w-0 text-xs sm:text-[13px]">
                        <MathText text={step.lineText} blockEquations={true} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Cụm điều khiển cố định phía dưới gồm 3 phần theo đúng bố cục yêu cầu:
          1. Lời thuyết minh
          2. Thanh tiến trình (hỗ trợ bấm & kéo tua mượt mà, không nhảy về đầu)
          3. Nút "Tự động giảng", Tốc độ, loa, ... Nút "Tải video" */}
      <footer className="shrink-0 border-t border-slate-800 bg-[#0f172a] px-3 py-2 sm:px-4">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-1.5">
          {/* 1. Lời thuyết minh */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-800/90 bg-slate-950/75 px-3 py-1.5">
            <MessageSquareQuote className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Lời thuyết minh:
            </span>
            <p className="min-w-0 flex-1 truncate text-xs text-slate-100" title={activeSubtitleText}>
              {activeSubtitleText}
            </p>
          </div>

          {/* 2. Thanh tiến trình (bấm hoặc kéo trượt để tua chính xác) */}
          <div className="flex items-center gap-3">
            <span className="shrink-0 font-mono text-[11px] text-slate-400">
              {resolvedAudioUrl && audioDurationSec > 0
                ? formatTimeMMSS(audioCurrentSec)
                : `Bước ${currentGlobalStep + 1}`}
            </span>

            <div
              ref={progressBarRef}
              onPointerDown={handleProgressPointerDown}
              onPointerMove={handleProgressPointerMove}
              onPointerUp={handleProgressPointerUp}
              onPointerCancel={handleProgressPointerUp}
              title="Bấm hoặc kéo để tua nhanh đến vị trí bài giảng"
              className="group relative flex h-4 flex-1 cursor-pointer touch-none items-center"
            >
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 ${
                    isScrubbing ? '' : 'transition-all duration-100'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
                {/* Các vạch chia mốc từng bước */}
                {Array.from({ length: Math.max(0, totalTimelineSteps - 1) }).map((_, i) => {
                  const leftPct = ((i + 1) / totalTimelineSteps) * 100;
                  return (
                    <span
                      key={i}
                      style={{ left: `${leftPct}%` }}
                      className="pointer-events-none absolute top-0 h-full w-[1.5px] bg-slate-950/80"
                    />
                  );
                })}
              </div>

              {/* Nút kéo tua tròn hiển thị khi rê chuột hoặc đang kéo */}
              <span
                style={{ left: `${progressPercent}%` }}
                className={`pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-emerald-400 shadow transition-opacity ${
                  isScrubbing ? 'scale-110 opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              />
            </div>

            <span className="shrink-0 font-mono text-[11px] text-slate-400">
              {resolvedAudioUrl && audioDurationSec > 0
                ? formatTimeMMSS(audioDurationSec)
                : `${totalTimelineSteps} bước`}
            </span>
          </div>

          {/* 3. Hàng nút điều khiển: Tự động giảng, Tốc độ, Loa, ... Nút Tải video */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            {/* Cụm điều hướng từng bước */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Vẽ lại</span>
              </button>

              <button
                type="button"
                onClick={handlePrevStep}
                disabled={currentGlobalStep <= 0}
                title="Bước trước"
                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-1 text-xs font-semibold text-slate-300">
                Bước {currentGlobalStep + 1}/{totalTimelineSteps}
              </span>

              <button
                type="button"
                onClick={handleNextStep}
                disabled={currentGlobalStep >= totalTimelineSteps - 1}
                title="Bước tiếp theo"
                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Cụm nút trung tâm: Tự động giảng, Tốc độ, Loa */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow transition hover:bg-emerald-500"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isPlaying ? 'Tạm dừng' : 'Tự động giảng'}</span>
              </button>

              <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200">
                <span className="text-[11px] text-slate-400">Tốc độ:</span>
                <select
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="bg-transparent font-semibold text-white focus:outline-none"
                >
                  <option value={0.75} className="bg-slate-900">0.75x</option>
                  <option value={1} className="bg-slate-900">1x</option>
                  <option value={1.25} className="bg-slate-900">1.25x</option>
                  <option value={1.5} className="bg-slate-900">1.5x</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1">
                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  title={isMuted ? 'Bật loa' : 'Tắt loa'}
                  className="text-slate-200 hover:text-white"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-rose-400" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (v > 0 && isMuted) setIsMuted(false);
                  }}
                  title="Âm lượng loa"
                  className="h-1.5 w-16 cursor-pointer accent-emerald-400"
                />
              </div>
            </div>

            {/* Cụm bên phải: Nút Tải video */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportVideo}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow transition ${
                  isExportingVideo
                    ? 'border border-amber-500/60 bg-amber-950/60 text-amber-200 hover:bg-amber-900/60'
                    : 'border border-sky-500/50 bg-sky-600/20 text-sky-200 hover:bg-sky-600/35 hover:text-white'
                }`}
              >
                <Video className="h-3.5 w-3.5 text-sky-400" />
                <span>
                  {isExportingVideo
                    ? `Đang xuất video (${videoProgressPct}%) • Bấm để hủy`
                    : 'Tải video'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal danh sách bài mẫu */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Kho Bài Giảng Mẫu THCS</h3>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto p-4">
              {catalog.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Chưa tải được danh sách từ /lessons/index.json. Thầy có thể bấm "Tải gói bài (.zip)" hoặc dùng bài mặc định hiện tại.
                </p>
              ) : (
                catalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectCatalogItem(item)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 text-left transition hover:border-emerald-500/50 hover:bg-slate-900"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                          {item.grade}
                        </span>
                        <span className="text-xs text-slate-400">{item.topic}</span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">{item.title}</div>
                    </div>
                    {item.hasStaticAudio && (
                      <span className="shrink-0 rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-300">
                        Có giọng đọc
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Cài đặt API Key & GitHub */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0f172a] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Cài đặt Gemini AI & Lưu trữ GitHub</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Gemini API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                />
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="mb-2 font-semibold text-indigo-300">
                  Cấu hình GitHub (lưu bài giảng trực tiếp lên web)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ghConfig.owner}
                    onChange={(e) => setGhConfig({ ...ghConfig, owner: e.target.value })}
                    placeholder="GitHub Owner (VD: vutronghanh)"
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                  <input
                    type="text"
                    value={ghConfig.repo}
                    onChange={(e) => setGhConfig({ ...ghConfig, repo: e.target.value })}
                    placeholder="Tên Repo (VD: giai-ve-hinh-toan-thcs)"
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input
                    type="password"
                    value={ghConfig.token}
                    onChange={(e) => setGhConfig({ ...ghConfig, token: e.target.value })}
                    placeholder="GitHub Personal Access Token"
                    className="col-span-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                  <input
                    type="text"
                    value={ghConfig.branch}
                    onChange={(e) => setGhConfig({ ...ghConfig, branch: e.target.value })}
                    placeholder="Branch (main)"
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </div>
                {ghTestStatus && (
                  <div className="mt-2 flex items-center gap-1.5 text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{ghTestStatus}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await testGithubConnection(ghConfig);
                      setGhTestStatus('Kết nối GitHub thành công!');
                    } catch (err) {
                      setGhTestStatus(err.message);
                    }
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 font-medium text-slate-200 hover:bg-slate-700"
                >
                  Kiểm tra GitHub
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(API_KEY_STORAGE, apiKey.trim());
                    saveGithubConfigToLocal(ghConfig);
                    setShowSettingsModal(false);
                  }}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500"
                >
                  Lưu cài đặt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Xưởng Soạn Bài AI */}
      <DraftStudioDrawer
        isOpen={showStudioDrawer}
        onClose={() => setShowStudioDrawer(false)}
        apiKey={apiKey}
        currentLesson={lesson}
        onOpenSettings={() => {
          setShowStudioDrawer(false);
          setShowSettingsModal(true);
        }}
        onApplyLesson={async (newDraft, audioEntriesMap, timelineItems) => {
          if (audioEntriesMap && audioEntriesMap.size > 0) {
            const unified = await buildUnifiedAudioPackage(timelineItems.length, audioEntriesMap, 0.25);
            if (unified) {
              const url = URL.createObjectURL(unified.blob);
              applyLoadedLesson(
                {
                  ...newDraft,
                  hasStaticAudio: true,
                  audioTimeline: unified.audioTimeline
                },
                url
              );
              return;
            }
          }
          applyLoadedLesson(newDraft);
        }}
      />
    </div>
  );
}
