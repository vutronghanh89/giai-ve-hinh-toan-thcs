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
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Eye,
  ListChecks,
  CheckCircle2,
  Video,
  Loader2,
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
  loadExternalScript
} from './services/githubStorageService.js';
import { exportLessonToMp4 } from './services/videoExportService.js';
import savedSamples from './data/savedSamples.json';

const API_KEY_STORAGE = 'toan_hinh_gemini_api_key';
const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const VIRTUAL_STEP_SEC = 2.6;

const DEFAULT_FALLBACK_LESSON = {
  id: 'toan-9-dien-tich-hinh-quat-giay',
  grade: 'Toán 9',
  topic: 'Độ dài cung tròn & Diện tích hình quạt tròn',
  title: 'Tính diện tích hình quạt giấy (hình vành khuyên)',
  hasStaticAudio: false,
  problemText:
    'Một chiếc quạt giấy khi mở rộng tối đa có dạng một hình quạt tròn bán kính R = 24 cm và góc ở tâm bằng 150°. Phần giấy dán quạt có dạng một phần hình vành khuyên giới hạn bởi hai đường tròn đồng tâm có bán kính lần lượt là 24 cm và 10 cm. Tính diện tích phần giấy dán quạt (làm tròn kết quả đến hàng phần mười, lấy π ≈ 3,14).',
  given: [
    'Bán kính quạt lớn $R = 24\\text{ cm}$, bán kính phần nan trống $r = 10\\text{ cm}$',
    'Góc ở tâm $n = 150^\\circ$, $\\pi \\approx 3{,}14$'
  ],
  prove: ['Tính diện tích phần giấy dán quạt (làm tròn đến hàng phần mười)'],
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
      voiceExplanation:
        'Bước hai, dùng compa quay cung tròn lớn bán kính 24 xen ti mét và cung tròn nhỏ bán kính 10 xen ti mét, hoàn thiện hình chiếc quạt giấy.',
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
    angleArcs: [{ vertex: 'O', p1: 'B', p2: 'A', radius: 28, label: '150°', color: 'accent', drawStep: 0 }]
  },
  solutionSteps: [
    {
      lineText: 'Diện tích hình quạt tròn lớn (bán kính $R = 24\\text{ cm}$, góc ở tâm $n = 150^\\circ$):',
      voiceExplanation: 'Trước tiên, ta tính diện tích hình quạt tròn lớn có bán kính 24 xen ti mét và góc ở tâm 150 độ.',
      highlightSegments: ['O-A', 'O-B'],
      highlightPoints: ['O', 'A', 'B'],
      highlightPolygons: []
    },
    {
      lineText:
        '$S_{\\text{quạt lớn}} = \\dfrac{\\pi \\cdot R^2 \\cdot n}{360} \\approx \\dfrac{3{,}14 \\cdot 24^2 \\cdot 150}{360}$\n$= \\dfrac{271296}{360} = 753{,}6\\ (\\text{cm}^2)$',
      voiceExplanation:
        'S quạt lớn bằng pi nhân R bình phương nhân n phần 360, xấp xỉ 3 phẩy 14 nhân 24 bình phương nhân 150 phần 360, bằng 753 phẩy 6 xen ti mét vuông.',
      highlightSegments: ['C-A', 'D-B'],
      highlightPoints: ['A', 'B'],
      highlightPolygons: []
    },
    {
      lineText: 'Diện tích hình quạt tròn nhỏ (bán kính $r = 10\\text{ cm}$, góc ở tâm $n = 150^\\circ$):',
      voiceExplanation: 'Tiếp theo, ta tính diện tích phần hình quạt tròn nhỏ có bán kính 10 xen ti mét.',
      highlightSegments: ['O-C', 'O-D'],
      highlightPoints: ['O', 'C', 'D'],
      highlightPolygons: []
    },
    {
      lineText:
        '$S_{\\text{quạt nhỏ}} = \\dfrac{\\pi \\cdot r^2 \\cdot n}{360} \\approx \\dfrac{3{,}14 \\cdot 10^2 \\cdot 150}{360}$\n$= \\dfrac{47100}{360} \\approx 130{,}83\\ (\\text{cm}^2)$',
      voiceExplanation:
        'S quạt nhỏ bằng pi nhân r bình phương nhân n phần 360, xấp xỉ 130 phẩy 83 xen ti mét vuông.',
      highlightSegments: ['O-C', 'O-D'],
      highlightPoints: ['C', 'D'],
      highlightPolygons: []
    },
    {
      lineText: 'Diện tích phần giấy dán quạt (hình vành khuyên) là:',
      voiceExplanation: 'Cuối cùng, diện tích phần giấy dán quạt bằng hiệu diện tích hai hình quạt tròn.',
      highlightSegments: ['C-A', 'D-B'],
      highlightPoints: ['A', 'B', 'C', 'D'],
      highlightPolygons: []
    },
    {
      lineText:
        '$S = S_{\\text{quạt lớn}} - S_{\\text{quạt nhỏ}} \\approx 753{,}6 - 130{,}83 = 622{,}77 \\approx 622{,}8\\ (\\text{cm}^2)$',
      voiceExplanation:
        'Ta lấy 753 phẩy 6 trừ 130 phẩy 83 bằng 622 phẩy 77, làm tròn đến hàng phần mười được 622 phẩy 8 xen ti mét vuông.',
      highlightSegments: ['C-A', 'D-B'],
      highlightPoints: ['A', 'B', 'C', 'D'],
      highlightPolygons: []
    }
  ]
};

function formatTimeSec(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export default function App() {
  const [catalog, setCatalog] = useState([]);
  const [lesson, setLesson] = useState(DEFAULT_FALLBACK_LESSON);
  const [audioUrl, setAudioUrl] = useState('');

  const [mode, setMode] = useState('draw');
  const [drawStepIdx, setDrawStepIdx] = useState(0);
  const [solveStepIdx, setSolveStepIdx] = useState(-1);
  const [drawProgress, setDrawProgress] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showAllSolution, setShowAllSolution] = useState(false);

  // State đồng bộ thanh tua thời gian (chống nhảy về 0 khi bấm/kéo tua)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const isSeekingRef = useRef(false);
  const seekTimeoutRef = useRef(null);
  const virtualTimeRef = useRef(0);
  const objectUrlToRevokeRef = useRef('');

  // Xuất video .mp4
  const [exportState, setExportState] = useState(null); // { percent, label } | null

  // Modals & Drawers
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showStudioDrawer, setShowStudioDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNarrationBox, setShowNarrationBox] = useState(true);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [githubCfg, setGithubCfg] = useState(() => loadSavedGithubConfig());
  const [ghTestStatus, setGhTestStatus] = useState('');

  const audioRef = useRef(null);
  const zipInputRef = useRef(null);

  const drawingSteps = Array.isArray(lesson?.drawingSteps) ? lesson.drawingSteps : [];
  const solutionSteps = Array.isArray(lesson?.solutionSteps) ? lesson.solutionSteps : [];
  const totalDrawSteps = drawingSteps.length;
  const totalSolveSteps = solutionSteps.length;
  const totalTimelineSteps = Math.max(1, totalDrawSteps + totalSolveSteps);

  // Bảng mốc thời gian chuẩn hóa (dùng mốc thật nếu có âm thanh, hoặc mốc ảo đều nhau nếu chưa có âm thanh)
  const effectiveTimeline = useMemo(() => {
    if (Array.isArray(lesson?.audioTimeline) && lesson.audioTimeline.length > 0) {
      return lesson.audioTimeline;
    }
    return Array.from({ length: totalTimelineSteps }, (_, idx) => ({
      stepIndex: idx,
      startSec: Number((idx * VIRTUAL_STEP_SEC).toFixed(3)),
      endSec: Number(((idx + 1) * VIRTUAL_STEP_SEC).toFixed(3))
    }));
  }, [lesson, totalTimelineSteps]);

  const effectiveDuration = useMemo(() => {
    if (duration > 0) return duration;
    const last = effectiveTimeline[effectiveTimeline.length - 1];
    return last ? last.endSec : totalTimelineSteps * VIRTUAL_STEP_SEC;
  }, [duration, effectiveTimeline, totalTimelineSteps]);

  // Hàm đồng bộ trạng thái hình vẽ & lời giải theo mốc thời gian tSec
  const syncVisualStateToTime = useCallback(
    (tSec) => {
      if (effectiveTimeline.length === 0) return;
      const clamped = Math.max(0, tSec);
      const hit =
        effectiveTimeline.find((item) => clamped >= item.startSec && clamped < item.endSec) ||
        effectiveTimeline[effectiveTimeline.length - 1];
      if (!hit) return;

      const idx = hit.stepIndex;
      if (idx < totalDrawSteps) {
        setMode('draw');
        setDrawStepIdx(idx);
        setSolveStepIdx(-1);
        const span = Math.max(0.2, hit.endSec - hit.startSec);
        setDrawProgress(Math.min(1, Math.max(0.08, (clamped - hit.startSec) / (span * 0.75))));
      } else {
        const sIdx = idx - totalDrawSteps;
        setMode('solve');
        setDrawStepIdx(Math.max(0, totalDrawSteps - 1));
        setDrawProgress(1);
        setSolveStepIdx(Math.min(totalSolveSteps - 1, Math.max(0, sIdx)));
      }
    },
    [effectiveTimeline, totalDrawSteps, totalSolveSteps]
  );

  // Tải trước tệp MP3 thành Blob URL cục bộ để tua tức thì, không bao giờ bị trình duyệt reset về 0
  const prepareBufferedAudioUrl = useCallback(async (rawUrl, isAlreadyBlob = false) => {
    if (objectUrlToRevokeRef.current) {
      URL.revokeObjectURL(objectUrlToRevokeRef.current);
      objectUrlToRevokeRef.current = '';
    }
    if (!rawUrl) {
      setAudioUrl('');
      return;
    }
    if (isAlreadyBlob || rawUrl.startsWith('blob:')) {
      objectUrlToRevokeRef.current = rawUrl;
      setAudioUrl(rawUrl);
      return;
    }
    try {
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error('Audio fetch failed');
      const blob = await res.blob();
      const localBlobUrl = URL.createObjectURL(blob);
      objectUrlToRevokeRef.current = localBlobUrl;
      setAudioUrl(localBlobUrl);
    } catch {
      setAudioUrl(rawUrl);
    }
  }, []);

  const applyLoadedLesson = useCallback(
    async (newLesson, customBlobUrl = '') => {
      setIsPlaying(false);
      isSeekingRef.current = false;
      virtualTimeRef.current = 0;
      setCurrentTime(0);
      setDuration(0);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      setLesson(newLesson);
      const dSteps = Array.isArray(newLesson?.drawingSteps) ? newLesson.drawingSteps : [];
      const sSteps = Array.isArray(newLesson?.solutionSteps) ? newLesson.solutionSteps : [];
      setMode(dSteps.length > 0 ? 'draw' : 'solve');
      setDrawStepIdx(0);
      setSolveStepIdx(dSteps.length === 0 && sSteps.length > 0 ? 0 : -1);
      setDrawProgress(1);

      if (customBlobUrl) {
        await prepareBufferedAudioUrl(customBlobUrl, true);
      } else if (newLesson?.hasStaticAudio && newLesson?.audioBasePath && newLesson?.audioFile) {
        const remoteUrl = `${newLesson.audioBasePath}/${newLesson.audioFile}?t=${Date.now()}`;
        await prepareBufferedAudioUrl(remoteUrl, false);
      } else {
        await prepareBufferedAudioUrl('', false);
      }
    },
    [prepareBufferedAudioUrl]
  );

  // Nạp danh mục bài mẫu ban đầu
  useEffect(() => {
    let mounted = true;
    (async () => {
      const remoteList = await fetchLessonsCatalog();
      const merged = remoteList.length > 0 ? remoteList : Array.isArray(savedSamples) ? savedSamples : [];
      if (!mounted) return;
      setCatalog(merged);
      if (merged.length > 0) {
        try {
          const first = merged[0];
          const detail = first.path ? await fetchLessonDetail(first) : first;
          if (mounted) await applyLoadedLesson(detail);
        } catch {
          // giữ bài mặc định
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [applyLoadedLesson]);

  const handleSelectCatalogItem = async (item) => {
    setShowCatalogModal(false);
    try {
      if (item.path) {
        const detail = await fetchLessonDetail(item);
        await applyLoadedLesson(detail);
      } else {
        await applyLoadedLesson(item);
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

      await applyLoadedLesson(parsedLesson, blobUrl);
    } catch (err) {
      alert(err.message || 'Không đọc được gói bài giảng .zip.');
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
    audio.muted = isMuted;
  }, [playbackRate, isMuted, audioUrl]);

  // Lắng nghe sự kiện từ thẻ <audio>
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      // Bỏ qua cập nhật tự động khi người dùng đang kéo/bấm tua thanh trượt
      if (isSeekingRef.current) return;
      const t = audio.currentTime;
      setCurrentTime(t);
      syncVisualStateToTime(t);
    };

    const onSeeked = () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      isSeekingRef.current = false;
      const t = audio.currentTime;
      setCurrentTime(t);
      syncVisualStateToTime(t);
    };

    const onEnded = () => {
      isSeekingRef.current = false;
      setIsPlaying(false);
      setMode('solve');
      setDrawProgress(1);
      if (totalSolveSteps > 0) setSolveStepIdx(totalSolveSteps - 1);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl, syncVisualStateToTime, totalSolveSteps]);

  // Bộ đếm chạy tự động khi bài chưa có file âm thanh MP3 (hỗ trợ tua mượt không nhảy về 0)
  useEffect(() => {
    if (!isPlaying || audioUrl) return;

    const intervalMs = 50;
    const timer = setInterval(() => {
      if (isSeekingRef.current) return;
      const nextTime = virtualTimeRef.current + (intervalMs / 1000) * playbackRate;
      if (nextTime >= effectiveDuration) {
        virtualTimeRef.current = effectiveDuration;
        setCurrentTime(effectiveDuration);
        syncVisualStateToTime(effectiveDuration);
        setIsPlaying(false);
      } else {
        virtualTimeRef.current = nextTime;
        setCurrentTime(nextTime);
        syncVisualStateToTime(nextTime);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, audioUrl, playbackRate, effectiveDuration, syncVisualStateToTime]);

  // Xử lý kéo / bấm tua trên thanh timeline
  const handleScrubStart = () => {
    isSeekingRef.current = true;
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
  };

  const handleScrubChange = (e) => {
    const newTime = Math.max(0, Math.min(effectiveDuration, Number(e.target.value) || 0));
    isSeekingRef.current = true;
    setCurrentTime(newTime);
    virtualTimeRef.current = newTime;
    syncVisualStateToTime(newTime);
  };

  const handleScrubCommit = (e) => {
    const targetTime = Math.max(0, Math.min(effectiveDuration, Number(e?.target?.value ?? currentTime) || 0));
    setCurrentTime(targetTime);
    virtualTimeRef.current = targetTime;
    syncVisualStateToTime(targetTime);

    const audio = audioRef.current;
    if (audio && audioUrl) {
      try {
        // Đảm bảo đặt currentTime sau khi metadata sẵn sàng
        if (audio.readyState >= 1) {
          audio.currentTime = targetTime;
        } else {
          audio.addEventListener(
            'loadedmetadata',
            () => {
              audio.currentTime = targetTime;
            },
            { once: true }
          );
        }
      } catch {
        // ignore
      }
      seekTimeoutRef.current = setTimeout(() => {
        isSeekingRef.current = false;
      }, 250);
    } else {
      isSeekingRef.current = false;
    }
  };

  const seekToTimelineStep = (globalStepIdx) => {
    const entry = effectiveTimeline.find((item) => item.stepIndex === globalStepIdx);
    const targetSec = entry ? entry.startSec : globalStepIdx * VIRTUAL_STEP_SEC;

    isSeekingRef.current = true;
    setCurrentTime(targetSec);
    virtualTimeRef.current = targetSec;
    syncVisualStateToTime(targetSec);

    const audio = audioRef.current;
    if (audio && audioUrl) {
      try {
        audio.currentTime = targetSec;
      } catch {
        // ignore
      }
      seekTimeoutRef.current = setTimeout(() => {
        isSeekingRef.current = false;
      }, 250);
    } else {
      isSeekingRef.current = false;
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    // Nếu đã chạy hết bài thì phát lại từ đầu
    if (currentTime >= effectiveDuration - 0.15) {
      seekToTimelineStep(0);
    }

    setIsPlaying(true);
    if (audioRef.current && audioUrl) {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    isSeekingRef.current = false;
    virtualTimeRef.current = 0;
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setMode(totalDrawSteps > 0 ? 'draw' : 'solve');
    setDrawStepIdx(0);
    setSolveStepIdx(totalDrawSteps === 0 && totalSolveSteps > 0 ? 0 : -1);
    setDrawProgress(1);
  };

  const currentGlobalStep =
    mode === 'draw' ? drawStepIdx : totalDrawSteps + Math.max(0, solveStepIdx);

  const handlePrevStep = () => {
    const prev = Math.max(0, currentGlobalStep - 1);
    seekToTimelineStep(prev);
  };

  const handleNextStep = () => {
    const next = Math.min(totalTimelineSteps - 1, currentGlobalStep + 1);
    seekToTimelineStep(next);
  };

  const handleExportMp4 = async () => {
    if (exportState) return;
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();

    setExportState({ percent: 1, label: 'Đang khởi tạo trình xuất video MP4...' });
    try {
      await exportLessonToMp4({
        lesson,
        audioUrl,
        onProgress: (info) => setExportState(info)
      });
    } catch (err) {
      alert(err.message || 'Có lỗi xảy ra khi xuất video .mp4.');
    } finally {
      setTimeout(() => setExportState(null), 900);
    }
  };

  const activeStepConfig =
    mode === 'draw'
      ? drawingSteps[drawStepIdx] || null
      : solutionSteps[solveStepIdx] || null;

  const visibleSolutionSteps = useMemo(() => {
    if (showAllSolution) return solutionSteps;
    if (mode === 'draw') return [];
    return solutionSteps.slice(0, Math.max(0, solveStepIdx + 1));
  }, [solutionSteps, showAllSolution, mode, solveStepIdx]);

  const progressPercent =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1120] text-slate-100">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0f172a]/95 px-4 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-slate-950 shadow-md">
              △
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white sm:text-base">
                Giải & Vẽ Hình Toán Hình Học THCS
              </h1>
              <p className="text-[11px] text-slate-400">
                Dựng hình từng bước • Công thức KaTeX sắc nét • Lời giảng giọng nữ miền Bắc đồng bộ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCatalogModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-emerald-500/50 hover:bg-slate-800"
            >
              <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
              <span>Bài mẫu ({catalog.length})</span>
            </button>

            <button
              type="button"
              onClick={() => zipInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-sky-500/50 hover:bg-slate-800"
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
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Soạn bài / AI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              title="Cài đặt API Key & GitHub"
              className="rounded-xl border border-slate-700 bg-slate-800/90 p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* NỘI DUNG CHÍNH */}
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3.5 p-4">
        {/* Thanh tiêu đề bài học */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800/90 bg-[#0f172a]/90 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              {lesson.grade} • {lesson.topic}
            </span>
            <h2 className="text-sm font-bold text-white sm:text-base">{lesson.title}</h2>
          </div>
          <span className="text-xs text-slate-400">
            {mode === 'draw'
              ? `Giai đoạn 1: Vẽ hình (${drawStepIdx + 1}/${Math.max(1, totalDrawSteps)})`
              : `Giai đoạn 2: Lời giải (${Math.max(1, solveStepIdx + 1)}/${Math.max(1, totalSolveSteps)})`}
          </span>
        </div>

        {/* HÀNG 1: ĐỀ BÀI & GT - KL */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <section className="rounded-2xl border border-slate-800 bg-[#0f172a]/90 p-4 lg:col-span-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                Đề bài
              </span>
            </div>
            <MathText text={lesson.problemText} className="text-sm leading-relaxed text-slate-100" />
          </section>

          <section className="rounded-2xl border border-slate-800 bg-[#0f172a]/90 p-4 lg:col-span-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                GT - KL
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:divide-x sm:divide-slate-800">
              <div className="space-y-1">
                <div className="text-xs font-bold text-sky-400">GT</div>
                {(lesson.given || []).map((item, i) => (
                  <MathText key={i} text={`• ${item}`} className="text-xs leading-relaxed text-slate-200 sm:text-sm" />
                ))}
              </div>
              <div className="space-y-1 sm:pl-3">
                <div className="text-xs font-bold text-emerald-400">KL</div>
                {(lesson.prove || []).map((item, i) => (
                  <MathText key={i} text={`• ${item}`} className="text-xs leading-relaxed text-emerald-200 sm:text-sm" />
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* HÀNG 2: HÌNH VẼ & LỜI GIẢI CHI TIẾT */}
        <div className="grid flex-1 grid-cols-1 gap-3.5 lg:grid-cols-12">
          {/* CỘT TRÁI: HÌNH VẼ */}
          <section className="flex flex-col rounded-2xl border border-slate-800 bg-[#0f172a]/90 p-3.5 lg:col-span-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                Hình vẽ minh họa
              </span>
              {activeStepConfig?.caption && mode === 'draw' && (
                <span className="truncate pl-3 text-xs text-sky-200">{activeStepConfig.caption}</span>
              )}
            </div>
            <div className="min-h-[380px] flex-1">
              <GeometryCanvas
                geometry={lesson.geometry}
                mode={mode}
                activeDrawStep={drawStepIdx}
                activeSolveStep={solveStepIdx}
                activeStepConfig={activeStepConfig}
                drawProgress={drawProgress}
              />
            </div>
          </section>

          {/* CỘT PHẢI: LỜI GIẢI CHI TIẾT */}
          <section className="flex flex-col rounded-2xl border border-slate-800 bg-[#0f172a]/90 p-3.5 lg:col-span-6">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  Lời giải chi tiết
                </span>
                <span className="text-xs text-slate-400">
                  ({visibleSolutionSteps.length}/{totalSolveSteps} dòng)
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAllSolution((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-emerald-500/40 hover:text-white"
              >
                {showAllSolution ? <ListChecks className="h-3.5 w-3.5 text-emerald-400" /> : <Eye className="h-3.5 w-3.5 text-sky-400" />}
                <span>{showAllSolution ? 'Theo từng bước' : 'Hiện toàn bộ'}</span>
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '460px' }}>
              {visibleSolutionSteps.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-800 text-xs italic text-slate-500">
                  Đang dựng hình từng bước theo giả thiết...
                </div>
              ) : (
                visibleSolutionSteps.map((st, idx) => {
                  const isActive = mode === 'solve' && idx === solveStepIdx;
                  return (
                    <div
                      key={idx}
                      onClick={() => seekToTimelineStep(totalDrawSteps + idx)}
                      title="Bấm để nhảy tới bước giải này"
                      className={`cursor-pointer rounded-xl border px-3.5 py-2.5 transition ${
                        isActive
                          ? 'border-emerald-500/60 bg-emerald-950/35 shadow-sm'
                          : 'border-slate-800/90 bg-slate-900/60 hover:border-slate-700'
                      }`}
                    >
                      <MathText
                        text={st.lineText}
                        className="math-eq-line text-sm leading-relaxed text-slate-100"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* HỘP LỜI THUYẾT MINH */}
        <section className="rounded-2xl border border-slate-800 bg-[#0f172a]/95 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                Lời thuyết minh
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowNarrationBox((v) => !v)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              {showNarrationBox ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
          {showNarrationBox && (
            <p className="mt-1 text-xs leading-relaxed text-slate-200 sm:text-sm">
              {activeStepConfig?.voiceExplanation ||
                activeStepConfig?.caption ||
                'Bấm "Tự động giảng" để nghe cô giáo giảng từng bước dựng hình và chứng minh.'}
            </p>
          )}
        </section>

        {/* THANH TUA THỜI GIAN & ĐIỀU KHIỂN TRÌNH CHIẾU */}
        <footer className="rounded-2xl border border-slate-800 bg-[#0f172a] px-4 py-3 shadow-lg">
          {/* Thanh trượt thời gian mượt mà (không bao giờ nhảy về đầu khi bấm/kéo tua) */}
          <div className="mb-3 flex items-center gap-3">
            <span className="w-11 text-right font-mono text-xs text-slate-300">
              {formatTimeSec(currentTime)}
            </span>
            <div className="relative flex flex-1 items-center">
              <input
                type="range"
                min={0}
                max={effectiveDuration || 1}
                step={0.05}
                value={Math.min(currentTime, effectiveDuration || 1)}
                onPointerDown={handleScrubStart}
                onMouseDown={handleScrubStart}
                onTouchStart={handleScrubStart}
                onChange={handleScrubChange}
                onPointerUp={handleScrubCommit}
                onMouseUp={handleScrubCommit}
                onTouchEnd={handleScrubCommit}
                aria-label="Thanh tua tiến trình bài giảng"
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400"
                style={{
                  background: `linear-gradient(to right, #34d399 0%, #34d399 ${progressPercent}%, #1e293b ${progressPercent}%, #1e293b 100%)`
                }}
              />
            </div>
            <span className="w-11 font-mono text-xs text-slate-400">
              {formatTimeSec(effectiveDuration)}
            </span>
          </div>

          {/* Hàng nút bấm điều khiển */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Vẽ lại</span>
              </button>

              <div className="flex items-center rounded-xl border border-slate-700 bg-slate-800/80 px-1 py-0.5">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentGlobalStep <= 0}
                  className="rounded-lg p-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2.5 text-xs font-semibold text-slate-200">
                  Bước {currentGlobalStep + 1}/{totalTimelineSteps}
                </span>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={currentGlobalStep >= totalTimelineSteps - 1}
                  className="rounded-lg p-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTogglePlay}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-md shadow-emerald-950/50 transition hover:bg-emerald-400 sm:text-sm"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? 'Tạm dừng' : 'Tự động giảng'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPlaybackRate((r) => (r === 1 ? 1.25 : r === 1.25 ? 1.5 : r === 1.5 ? 0.75 : 1))
                }
                className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                Tốc độ: {playbackRate}x
              </button>

              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="rounded-xl border border-slate-700 bg-slate-800 p-1.5 text-slate-200 hover:bg-slate-700"
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={handleExportMp4}
                disabled={Boolean(exportState)}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-60"
              >
                {exportState ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Video className="h-3.5 w-3.5" />
                )}
                <span>Tải video (.mp4)</span>
              </button>
            </div>
          </div>
        </footer>
      </main>

      {/* MODAL TIẾN TRÌNH XUẤT VIDEO MP4 */}
      {exportState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0f172a] p-5 shadow-2xl">
            <div className="mb-3 flex items-center gap-2.5">
              <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
              <h3 className="text-sm font-bold text-white">Đang xuất video bài giảng (.mp4)</h3>
            </div>
            <p className="mb-3 text-xs text-slate-300">{exportState.label}</p>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-200"
                style={{ width: `${exportState.percent || 5}%` }}
              />
            </div>
            <div className="mt-2 text-right font-mono text-xs text-sky-300">
              {exportState.percent || 0}%
            </div>
          </div>
        </div>
      )}

      {/* MODAL DANH SÁCH BÀI MẪU */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Danh sách bài giảng mẫu</h3>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {catalog.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Chưa có bài mẫu trong thư mục public/lessons/. Thầy có thể dùng "Tải gói bài (.zip)" hoặc "Soạn bài / AI".
                </p>
              ) : (
                catalog.map((item, idx) => (
                  <button
                    key={item.id || idx}
                    type="button"
                    onClick={() => handleSelectCatalogItem(item)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left transition hover:border-emerald-500/50 hover:bg-slate-800"
                  >
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-400">
                        {item.grade} • {item.topic}
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-white">{item.title}</div>
                    </div>
                    {item.hasStaticAudio && (
                      <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
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

      {/* MODAL CÀI ĐẶT */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0f172a] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Cài đặt Gemini API Key & GitHub</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Gemini API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    localStorage.setItem(API_KEY_STORAGE, e.target.value.trim());
                  }}
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">GitHub Owner</label>
                  <input
                    type="text"
                    value={githubCfg.owner}
                    onChange={(e) => setGithubCfg({ ...githubCfg, owner: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Repository</label>
                  <input
                    type="text"
                    value={githubCfg.repo}
                    onChange={(e) => setGithubCfg({ ...githubCfg, repo: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">GitHub Token</label>
                  <input
                    type="password"
                    value={githubCfg.token}
                    onChange={(e) => setGithubCfg({ ...githubCfg, token: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Branch</label>
                  <input
                    type="text"
                    value={githubCfg.branch}
                    onChange={(e) => setGithubCfg({ ...githubCfg, branch: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              {ghTestStatus && (
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{ghTestStatus}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    saveGithubConfigToLocal(githubCfg);
                    try {
                      await testGithubConnection(githubCfg);
                      setGhTestStatus('Kết nối GitHub thành công!');
                    } catch (err) {
                      setGhTestStatus(err.message);
                    }
                  }}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500"
                >
                  Lưu & Kiểm tra
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* XƯỞNG SOẠN BÀI AI */}
      <DraftStudioDrawer
        isOpen={showStudioDrawer}
        onClose={() => setShowStudioDrawer(false)}
        apiKey={apiKey}
        currentLesson={lesson}
        onApplyLesson={(newL) => {
          applyLoadedLesson(newL);
          setShowStudioDrawer(false);
        }}
        onOpenSettings={() => {
          setShowStudioDrawer(false);
          setShowSettingsModal(true);
        }}
      />
    </div>
  );
}
