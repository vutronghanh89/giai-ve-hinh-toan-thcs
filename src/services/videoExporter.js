/* ============================================================================
   BỘ XUẤT VIDEO BÀI GIẢNG TRỰC TIẾP TRÊN TRÌNH DUYỆT (CANVAS + WEB AUDIO)
   - Kết xuất HD 1280x720 (30fps) gồm: Đề bài, Hình vẽ động, Lời giải & Phụ đề
   - Đồng bộ giọng đọc từ full_audio.mp3 / blob URL (nếu có)
   ============================================================================ */

import { renderGeometryScene } from '../components/GeometryCanvas.jsx';
import { slugifyVietnamese } from './githubStorageService.js';

function wrapCanvasText(ctx, text, maxWidth) {
  const clean = String(text || '')
    .replace(/\$/g, '')
    .replace(/\\dfrac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\widehat\{([^{}]+)\}/g, '∠$1')
    .replace(/\\triangle/g, '△')
    .replace(/\\perp/g, '⊥')
    .replace(/\\parallel/g, '∥')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\approx/g, '≈')
    .replace(/\\pi/g, 'π')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/\^\\circ/g, '°')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];
  const words = clean.split(' ');
  const lines = [];
  let line = '';

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function exportLectureVideo({
  lesson,
  audioUrl,
  onProgress,
  signal
}) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Trình duyệt của thầy chưa hỗ trợ ghi hình video (MediaRecorder). Hãy dùng Chrome hoặc Edge mới nhất.');
  }

  const W = 1280;
  const H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const drawingSteps = lesson?.drawingSteps || [];
  const solutionSteps = lesson?.solutionSteps || [];
  const totalDraw = drawingSteps.length;
  const totalSolve = solutionSteps.length;
  const totalSteps = Math.max(1, totalDraw + totalSolve);

  let audioCtx = null;
  let audioEl = null;
  let mixedStream = canvas.captureStream(30);

  if (audioUrl) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioEl = new Audio();
      audioEl.crossOrigin = 'anonymous';
      audioEl.src = audioUrl;
      await new Promise((resolve, reject) => {
        audioEl.onloadedmetadata = () => resolve();
        audioEl.onerror = () => reject(new Error('Không nạp được âm thanh để ghép video.'));
      });
      const source = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination);
      dest.stream.getAudioTracks().forEach((tr) => mixedStream.addTrack(tr));
    } catch {
      audioEl = null;
    }
  }

  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  const selectedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  const recorder = selectedMime
    ? new MediaRecorder(mixedStream, { mimeType: selectedMime, videoBitsPerSecond: 3200000 })
    : new MediaRecorder(mixedStream);

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const timeline = Array.isArray(lesson?.audioTimeline) ? lesson.audioTimeline : [];
  const fallbackStepDuration = 2.4;
  const totalDurationSec =
    audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0
      ? audioEl.duration
      : totalSteps * fallbackStepDuration;

  const drawFrameAtTime = (elapsedSec) => {
    let mode = 'draw';
    let drawIdx = 0;
    let solveIdx = -1;
    let drawProg = 1;

    if (audioEl && timeline.length > 0) {
      const hit =
        timeline.find((it) => elapsedSec >= it.startSec && elapsedSec < it.endSec) ||
        timeline[timeline.length - 1];
      const idx = hit ? hit.stepIndex : 0;
      if (idx < totalDraw) {
        mode = 'draw';
        drawIdx = idx;
        const span = Math.max(0.2, hit.endSec - hit.startSec);
        drawProg = Math.min(1, Math.max(0.08, (elapsedSec - hit.startSec) / (span * 0.75)));
      } else {
        mode = 'solve';
        drawIdx = Math.max(0, totalDraw - 1);
        solveIdx = Math.min(totalSolve - 1, Math.max(0, idx - totalDraw));
      }
    } else {
      const globalIdx = Math.min(totalSteps - 1, Math.floor(elapsedSec / fallbackStepDuration));
      const localSec = elapsedSec - globalIdx * fallbackStepDuration;
      if (globalIdx < totalDraw) {
        mode = 'draw';
        drawIdx = globalIdx;
        drawProg = Math.min(1, Math.max(0.08, localSec / (fallbackStepDuration * 0.75)));
      } else {
        mode = 'solve';
        drawIdx = Math.max(0, totalDraw - 1);
        solveIdx = Math.min(totalSolve - 1, Math.max(0, globalIdx - totalDraw));
      }
    }

    const activeCfg =
      mode === 'draw' ? drawingSteps[drawIdx] || null : solutionSteps[solveIdx] || null;

    // Nền tổng thể
    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, W, H);

    // Thanh tiêu đề trên cùng
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, 62);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 62);
    ctx.lineTo(W, 62);
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 15px Inter, system-ui, sans-serif';
    ctx.fillText(`${lesson?.grade || 'Toán THCS'} • ${lesson?.topic || ''}`, 28, 25);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 19px Inter, system-ui, sans-serif';
    ctx.fillText(lesson?.title || 'Bài giảng Hình học THCS', 28, 49);

    // Khung hình vẽ bên trái
    const leftX = 20;
    const topY = 74;
    const leftW = 610;
    const bodyH = 540;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(leftX, topY, leftW, bodyH, 14);
    ctx.clip();
    ctx.translate(leftX, topY);
    renderGeometryScene(ctx, leftW, bodyH, {
      geometry: lesson?.geometry,
      mode,
      activeDrawStep: drawIdx,
      activeSolveStep: solveIdx,
      activeStepConfig: activeCfg,
      drawProgress: drawProg,
      zoom: 1,
      showGrid: true,
      showLabels: true,
      padTop: 32,
      padBottom: 20,
      padX: 24
    });
    ctx.restore();

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(leftX, topY, leftW, bodyH, 14);
    ctx.stroke();

    // Khung lời giải bên phải
    const rightX = 646;
    const rightW = 614;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(rightX, topY, rightW, bodyH, 14);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.fillText('LỜI GIẢI CHI TIẾT', rightX + 20, topY + 28);

    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(rightX, topY + 40);
    ctx.lineTo(rightX + rightW, topY + 40);
    ctx.stroke();

    const visibleSteps =
      mode === 'solve' && solveIdx >= 0 ? solutionSteps.slice(0, solveIdx + 1) : [];

    let cursorY = topY + 64;
    ctx.font = '15px Inter, system-ui, sans-serif';
    const maxLineW = rightW - 44;

    // Nếu lời giải dài vượt khung, tự động dịch chuyển lên để luôn thấy dòng mới nhất
    const renderedBlocks = visibleSteps.map((st, idx) => ({
      idx,
      isCurrent: idx === solveIdx,
      lines: wrapCanvasText(ctx, st.lineText, maxLineW)
    }));

    const totalTextHeight = renderedBlocks.reduce(
      (sum, b) => sum + b.lines.length * 22 + 12,
      0
    );
    const availTextHeight = bodyH - 56;
    if (totalTextHeight > availTextHeight) {
      cursorY -= totalTextHeight - availTextHeight;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(rightX + 8, topY + 44, rightW - 16, bodyH - 50);
    ctx.clip();

    renderedBlocks.forEach((blk) => {
      const boxH = blk.lines.length * 22 + 10;
      if (blk.isCurrent) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
        ctx.beginPath();
        ctx.roundRect(rightX + 14, cursorY - 16, rightW - 28, boxH, 8);
        ctx.fill();
      }
      ctx.fillStyle = blk.isCurrent ? '#ecfdf5' : '#cbd5e1';
      ctx.font = blk.isCurrent
        ? '600 15px Inter, system-ui, sans-serif'
        : '15px Inter, system-ui, sans-serif';
      blk.lines.forEach((ln) => {
        ctx.fillText(ln, rightX + 22, cursorY);
        cursorY += 22;
      });
      cursorY += 10;
    });
    ctx.restore();

    // Thanh lời thuyết minh dưới cùng
    const subY = 626;
    const subH = 78;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(20, subY, W - 40, subH, 12);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.stroke();

    const speechText =
      activeCfg?.voiceExplanation || activeCfg?.caption || activeCfg?.lineText || '';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.fillText('LỜI THUYẾT MINH:', 36, subY + 24);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '15px Inter, system-ui, sans-serif';
    const subLines = wrapCanvasText(ctx, speechText, W - 210).slice(0, 2);
    subLines.forEach((sl, i) => {
      ctx.fillText(sl, 175, subY + 24 + i * 24);
    });
  };

  return new Promise((resolve, reject) => {
    let rafId = null;
    let startTimeMs = performance.now();
    let stopped = false;

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (audioEl) {
        audioEl.pause();
        audioEl.src = '';
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          stopped = true;
          if (recorder.state !== 'inactive') recorder.stop();
          cleanup();
          reject(new Error('ABORTED'));
        },
        { once: true }
      );
    }

    recorder.onstop = () => {
      cleanup();
      if (stopped) return;
      const blob = new Blob(chunks, { type: selectedMime || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugifyVietnamese(lesson?.title || 'bai-giang-hinh-hoc')}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      resolve();
    };

    recorder.start(200);
    if (audioEl) {
      audioEl.play().catch(() => {});
    }

    const tick = () => {
      if (stopped) return;
      const elapsedSec = audioEl
        ? audioEl.currentTime
        : (performance.now() - startTimeMs) / 1000;

      drawFrameAtTime(elapsedSec);
      const pct = Math.min(99, Math.round((elapsedSec / Math.max(0.5, totalDurationSec)) * 100));
      onProgress?.(pct);

      const isDone = audioEl
        ? audioEl.ended || elapsedSec >= totalDurationSec + 0.15
        : elapsedSec >= totalDurationSec;

      if (isDone) {
        onProgress?.(100);
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });
}
