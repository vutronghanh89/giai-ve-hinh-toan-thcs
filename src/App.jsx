import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import savedSamples from './data/savedSamples.json';

const API_KEY_STORAGE = 'toan_hinh_gemini_api_key';
const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

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
      lineText: '$S = S_{\\text{quạt lớn}} - S_{\\text{quạt nhỏ}} \\approx 753{,}6 - 130{,}83 = 622{,}77 \\approx 622{,}8\\ (\\text{cm}^2)$',
      voiceExplanation: 'Ta lấy 753 phẩy 6 trừ 130 phẩy 83 bằng 622 phẩy 77, làm tròn đến hàng phần mười được 622 phẩy 8 xen ti mét vuông.',
      highlightSegments: ['C-A', 'D-B'],
      highlightPoints: ['A', 'B', 'C', 'D'],
      highlightPolygons: []
    }
  ]
};

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
  const [showProblemInfo, setShowProblemInfo] = useState(true);

  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showStudioDrawer, setShowStudioDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [ghConfig, setGhConfig] = useState(() => loadSavedGithubConfig());
  const [ghTestStatus, setGhTestStatus] = useState('');

  const audioRef = useRef(null);
  const zipInputRef = useRef(null);

  const drawingSteps = lesson?.drawingSteps || [];
  const solutionSteps = lesson?.solutionSteps || [];
  const totalDrawSteps = drawingSteps.length;
  const totalSolveSteps = solutionSteps.length;
  const totalTimelineSteps = totalDrawSteps + totalSolveSteps;

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setLesson(newLesson);
    const dCount = (newLesson.drawingSteps || []).length;
    const sCount = (newLesson.solutionSteps || []).length;
    setMode(dCount > 0 ? 'draw' : 'solve');
    setDrawStepIdx(0);
    setSolveStepIdx(sCount > 0 ? 0 : -1);
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
  }, [playbackRate, isMuted, audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const timeline = Array.isArray(lesson?.audioTimeline) ? lesson.audioTimeline : [];
    const onTimeUpdate = () => {
      if (timeline.length === 0) return;
      const t = audio.currentTime;
      const hit = timeline.find((item) => t >= item.startSec && t < item.endSec) || timeline[timeline.length - 1];
      if (!hit) return;

      const idx = hit.stepIndex;
      if (idx < totalDrawSteps) {
        setMode('draw');
        setDrawStepIdx(idx);
        const span = Math.max(0.2, hit.endSec - hit.startSec);
        setDrawProgress(Math.min(1, Math.max(0.1, (t - hit.startSec) / (span * 0.75))));
      } else {
        const sIdx = idx - totalDrawSteps;
        setMode('solve');
        setDrawStepIdx(Math.max(0, totalDrawSteps - 1));
        setDrawProgress(1);
        setSolveStepIdx(Math.min(totalSolveSteps - 1, Math.max(0, sIdx)));
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setMode('solve');
      setDrawProgress(1);
      if (totalSolveSteps > 0) setSolveStepIdx(totalSolveSteps - 1);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl, lesson, totalDrawSteps, totalSolveSteps]);

  useEffect(() => {
    if (!isPlaying || audioUrl) return;

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
  }, [isPlaying, audioUrl, mode, drawStepIdx, solveStepIdx, totalDrawSteps, totalSolveSteps, playbackRate]);

  const seekToTimelineStep = (globalStepIdx) => {
    const timeline = Array.isArray(lesson?.audioTimeline) ? lesson.audioTimeline : [];
    const entry = timeline.find((item) => item.stepIndex === globalStepIdx);
    if (audioRef.current && audioUrl && entry) {
      audioRef.current.currentTime = entry.startSec;
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    setIsPlaying(true);
    if (audioRef.current && audioUrl) {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
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
    if (prev < totalDrawSteps) {
      setMode('draw');
      setDrawStepIdx(prev);
      setDrawProgress(1);
    } else {
      setMode('solve');
      setSolveStepIdx(prev - totalDrawSteps);
    }
    seekToTimelineStep(prev);
  };

  const handleNextStep = () => {
    const next = Math.min(totalTimelineSteps - 1, currentGlobalStep + 1);
    if (next < totalDrawSteps) {
      setMode('draw');
      setDrawStepIdx(next);
      setDrawProgress(1);
    } else {
      setMode('solve');
      setSolveStepIdx(next - totalDrawSteps);
    }
    seekToTimelineStep(next);
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

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1120] text-slate-100">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

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

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] shadow-xl lg:col-span-6">
          <div className="border-b border-slate-800 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                    {lesson.grade}
                  </span>
                  <span className="text-xs text-slate-400">{lesson.topic}</span>
                </div>
                <h2 className="mt-1 text-sm font-bold text-white sm:text-base">{lesson.title}</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowProblemInfo((v) => !v)}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <span>Đề bài & GT-KL</span>
                {showProblemInfo ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {showProblemInfo && (
              <div className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200">
                <MathText text={lesson.problemText} blockEquations={false} />
                <div className="grid grid-cols-1 gap-2 border-t border-slate-800/80 pt-2 sm:grid-cols-2">
                  <div>
                    <div className="font-bold text-sky-400">Giả thiết (GT):</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-300">
                      {(lesson.given || []).map((g, idx) => (
                        <li key={idx}>
                          <MathText text={g} blockEquations={false} />
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-bold text-emerald-400">Kết luận (KL):</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-300">
                      {(lesson.prove || []).map((p, idx) => (
                        <li key={idx}>
                          <MathText text={p} blockEquations={false} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative min-h-[340px] flex-1 sm:min-h-[420px]">
            <GeometryCanvas
              geometry={lesson.geometry}
              mode={mode}
              activeDrawStep={drawStepIdx}
              activeSolveStep={solveStepIdx}
              activeStepConfig={activeStepConfig}
              drawProgress={drawProgress}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/90 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Vẽ lại từ đầu</span>
              </button>

              <button
                type="button"
                onClick={handlePrevStep}
                disabled={currentGlobalStep <= 0}
                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-1.5 text-xs font-medium text-slate-300">
                Bước {currentGlobalStep + 1}/{Math.max(1, totalTimelineSteps)}
              </span>

              <button
                type="button"
                onClick={handleNextStep}
                disabled={currentGlobalStep >= totalTimelineSteps - 1}
                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isPlaying ? 'Tạm dừng' : 'Tự động giảng'}</span>
              </button>

              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
              </select>

              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                title={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 hover:bg-slate-700"
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] shadow-xl lg:col-span-6">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white sm:text-base">Lời giải chi tiết</h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {showAllSolution
                  ? `${totalSolveSteps} / ${totalSolveSteps}`
                  : `${mode === 'solve' ? Math.max(0, solveStepIdx + 1) : 0} / ${totalSolveSteps}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAllSolution((v) => !v);
                  setMode('solve');
                  setDrawProgress(1);
                  if (totalSolveSteps > 0 && solveStepIdx < 0) {
                    setSolveStepIdx(totalSolveSteps - 1);
                  }
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                <span>{showAllSolution ? 'Theo từng bước' : 'Hiện tất cả'}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
            {visibleSolutionSteps.length === 0 ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 p-6 text-center">
                <p className="text-sm font-medium text-slate-300">
                  Đang ở giai đoạn dựng hình từng bước
                </p>
                <p className="mt-1 max-w-md text-xs text-slate-400">
                  Bấm "Tự động giảng" để xem dựng hình và lời giải đồng bộ, hoặc bấm "Hiện tất cả" để xem toàn bộ lời giải ngay.
                </p>
              </div>
            ) : (
              visibleSolutionSteps.map((step, idx) => {
                const isActive = mode === 'solve' && solveStepIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setMode('solve');
                      setDrawProgress(1);
                      setSolveStepIdx(idx);
                      seekToTimelineStep(totalDrawSteps + idx);
                    }}
                    className={`cursor-pointer rounded-xl border p-3.5 transition ${
                      isActive
                        ? 'border-emerald-500/70 bg-emerald-950/30 shadow-md shadow-emerald-950/30'
                        : 'border-slate-800/90 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isActive
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1 text-sm text-slate-100">
                        <MathText text={step.lineText} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

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
