/* ============================================================================
   BỘ XUẤT VIDEO BÀI GIẢNG TRỰC TIẾP TRÊN TRÌNH DUYỆT (CANVAS + WEB AUDIO)
   - Kết xuất HD 1280x720 (30fps) gồm: Đề bài, Hình vẽ động, Lời giải & Phụ đề
   - Hiển thị công thức KaTeX chuẩn xác và ngắt dòng đồng nhất 100% như trên Web
   - Đồng bộ giọng đọc từ full_audio.mp3 / blob URL (nếu có)
   ============================================================================ */

import { renderGeometryScene } from '../components/GeometryCanvas.jsx';
import { renderMathBlockHtml } from '../components/MathText.jsx';
import { slugifyVietnamese } from './githubStorageService.js';

let cachedInlinedKatexCssPromise = null;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Thu thập CSS của KaTeX đang nạp trên trang và chuyển các font .woff2 sang data:base64
 * để SVG <foreignObject> vẽ lên Canvas sắc nét, đúng font toán học và không bị lỗi CORS.
 */
async function getInlinedKatexCss() {
  if (cachedInlinedKatexCssPromise) return cachedInlinedKatexCssPromise;

  cachedInlinedKatexCssPromise = (async () => {
    const cssParts = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!rules) continue;

      for (const rule of Array.from(rules)) {
        const text = rule.cssText || '';
        if (
          text.includes('.katex') ||
          (text.includes('@font-face') && /KaTeX/i.test(text))
        ) {
          cssParts.push(text);
        }
      }
    }

    let rawCss = cssParts.join('\n');
    const urlMatches = [...new Set(rawCss.match(/url\((['"]?)([^)'"]+)\1\)/g) || [])];

    for (const matchStr of urlMatches) {
      const innerMatch = matchStr.match(/url\((['"]?)([^)'"]+)\1\)/);
      const rawUrl = innerMatch?.[2] || '';
      if (!rawUrl || rawUrl.startsWith('data:')) continue;

      try {
        const res = await fetch(rawUrl);
        if (!res.ok) throw new Error('Font fetch failed');
        const buf = await res.arrayBuffer();
        const mime = rawUrl.endsWith('.woff2')
          ? 'font/woff2'
          : rawUrl.endsWith('.woff')
          ? 'font/woff'
          : 'font/ttf';
        const dataUri = `url("data:${mime};base64,${arrayBufferToBase64(buf)}")`;
        rawCss = rawCss.split(matchStr).join(dataUri);
      } catch {
        // Loại bỏ URL ngoài nếu không tải được để tránh làm bẩn Canvas (tainted canvas)
        rawCss = rawCss.split(matchStr).join('url("")');
      }
    }

    return rawCss;
  })();

  return cachedInlinedKatexCssPromise;
}

/**
 * Kết xuất trước từng bước lời giải bằng KaTeX HTML -> Canvas 2x Retina
 * giúp video 30fps mượt mà và công thức giống hệt 100% giao diện web.
 */
async function preRenderSolutionBlocks(solutionSteps, maxWidth) {
  if (!Array.isArray(solutionSteps) || solutionSteps.length === 0) return null;

  try {
    const katexCss = await getInlinedKatexCss();
    const dpr = 2;

    const measureHost = document.createElement('div');
    measureHost.style.cssText = [
      'position:fixed',
      'left:-99999px',
      'top:0',
      `width:${maxWidth}px`,
      'font-family:Inter,system-ui,-apple-system,sans-serif',
      'font-size:15px',
      'line-height:1.45',
      'visibility:hidden',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(measureHost);

    const renderVariant = async (htmlContent, color, fontWeight) => {
      measureHost.innerHTML = `<div class="math-text-block" style="font-weight:${fontWeight};color:${color};">${htmlContent}</div>`;
      const rect = measureHost.getBoundingClientRect();
      const boxW = maxWidth;
      const boxH = Math.max(24, Math.ceil(rect.height) + 4);

      const xhtml = `
        <div xmlns="http://www.w3.org/1999/xhtml"
             class="math-text-block"
             style="width:${boxW}px;font-family:Inter,system-ui,-apple-system,sans-serif;font-size:15px;font-weight:${fontWeight};line-height:1.45;color:${color};margin:0;padding:0;">
          ${htmlContent}
        </div>
      `;

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${boxW * dpr}" height="${boxH * dpr}" viewBox="0 0 ${boxW} ${boxH}">
          <style>
            ${katexCss}
            .math-text-block .katex { font-size: 1.03em; line-height: 1.42; color: inherit; }
            .math-line { margin-bottom: 3px; word-break: normal; overflow-wrap: break-word; }
            .math-line:last-child { margin-bottom: 0; }
            .math-eq-line .katex .mfrac { margin: 0.08em 0.08em; }
            .math-atomic { display: inline-block; white-space: nowrap; vertical-align: middle; }
          </style>
          <foreignObject x="0" y="0" width="${boxW}" height="${boxH}">
            ${xhtml}
          </foreignObject>
        </svg>
      `;

      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('SVG_RENDER_ERROR'));
        img.src = svgDataUrl;
      });

      const offscreen = document.createElement('canvas');
      offscreen.width = boxW * dpr;
      offscreen.height = boxH * dpr;
      const octx = offscreen.getContext('2d');
      octx.drawImage(img, 0, 0, boxW * dpr, boxH * dpr);

      // Kiểm tra bảo mật Canvas (đảm bảo không bị tainted khi ghi hình captureStream)
      offscreen.toDataURL('image/png');

      return { canvas: offscreen, width: boxW, height: boxH };
    };

    const results = [];
    for (const st of solutionSteps) {
      const html = renderMathBlockHtml(st?.lineText || '');
      if (!html) {
        results.push(null);
        continue;
      }
      const normal = await renderVariant(html, '#cbd5e1', '400');
      const active = await renderVariant(html, '#ecfdf5', '600');
      results.push({ normal, active });
    }

    measureHost.remove();
    return results;
  } catch {
    return null;
  }
}

function wrapSubtitleText(ctx, text, maxWidth) {
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
    throw new Error(
      'Trình duyệt của thầy chưa hỗ trợ ghi hình video (MediaRecorder). Hãy dùng Chrome hoặc Edge mới nhất.'
    );
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

  // Kết xuất trước toàn bộ khối công thức KaTeX cho khung lời giải bên phải
  const rightW = 614;
  const maxLineW = rightW - 44;
  const preRenderedBlocks = await preRenderSolutionBlocks(solutionSteps, maxLineW);

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

    let cursorY = topY + 52;
    ctx.font = '15px Inter, system-ui, sans-serif';

    const renderedBlocks = visibleSteps.map((st, idx) => {
      const isCurrent = idx === solveIdx;
      const katexPair = preRenderedBlocks?.[idx] || null;
      const katexAsset = katexPair ? (isCurrent ? katexPair.active : katexPair.normal) : null;

      if (katexAsset) {
        return {
          idx,
          isCurrent,
          katexAsset,
          height: katexAsset.height
        };
      }

      const fallbackLines = wrapSubtitleText(ctx, st.lineText, maxLineW);
      return {
        idx,
        isCurrent,
        katexAsset: null,
        lines: fallbackLines,
        height: Math.max(22, fallbackLines.length * 22)
      };
    });

    const totalTextHeight = renderedBlocks.reduce(
      (sum, b) => sum + b.height + 14,
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
      const boxH = blk.height + 10;
      if (blk.isCurrent) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
        ctx.beginPath();
        ctx.roundRect(rightX + 14, cursorY - 4, rightW - 28, boxH, 8);
        ctx.fill();
      }

      if (blk.katexAsset) {
        ctx.drawImage(
          blk.katexAsset.canvas,
          rightX + 22,
          cursorY + 1,
          blk.katexAsset.width,
          blk.katexAsset.height
        );
      } else {
        ctx.fillStyle = blk.isCurrent ? '#ecfdf5' : '#cbd5e1';
        ctx.font = blk.isCurrent
          ? '600 15px Inter, system-ui, sans-serif'
          : '15px Inter, system-ui, sans-serif';
        let lineY = cursorY + 16;
        blk.lines.forEach((ln) => {
          ctx.fillText(ln, rightX + 22, lineY);
          lineY += 22;
        });
      }

      cursorY += boxH + 4;
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
    const subLines = wrapSubtitleText(ctx, speechText, W - 210).slice(0, 2);
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
