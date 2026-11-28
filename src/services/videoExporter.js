/* ============================================================================
   BỘ XUẤT VIDEO BÀI GIẢNG MP4 TỐC ĐỘ CAO (WEBCODECS H.264 + AAC + KATEX)
   - Kết xuất HD 1280x720 gồm đầy đủ: Đề bài, GT – KL, Hình vẽ động, Lời giải & Phụ đề
   - Hiển thị công thức KaTeX chuẩn xác và ngắt dòng đồng nhất 100% như trên Web
   - Xuất tệp .mp4 tốc độ cao (nhanh gấp 6–12 lần thời gian thực) + tự động dự phòng
   ============================================================================ */

import { renderGeometryScene } from '../components/GeometryCanvas.jsx';
import { renderMathBlockHtml } from '../components/MathText.jsx';
import { slugifyVietnamese } from './githubStorageService.js';
import { SimpleMp4Muxer } from './mp4Muxer.js';

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
 * Thu thập CSS của KaTeX đang nạp trên trang và nhúng font .woff2 thành data:base64
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
        rawCss = rawCss.split(matchStr).join('url("")');
      }
    }

    return rawCss;
  })();

  return cachedInlinedKatexCssPromise;
}

/**
 * Kết xuất một đoạn HTML KaTeX thành ảnh Canvas 2x Retina sắc nét
 */
async function rasterizeKatexHtml({
  htmlContent,
  width,
  fontSize = 15,
  lineHeight = 1.44,
  color = '#cbd5e1',
  fontWeight = '400',
  katexCss,
  measureHost
}) {
  const dpr = 2;
  measureHost.style.width = `${width}px`;
  measureHost.style.fontSize = `${fontSize}px`;
  measureHost.style.lineHeight = String(lineHeight);
  measureHost.innerHTML = `<div class="math-text-block" style="font-weight:${fontWeight};color:${color};">${htmlContent}</div>`;

  const rect = measureHost.getBoundingClientRect();
  const boxW = width;
  const boxH = Math.max(20, Math.ceil(rect.height) + 4);

  const xhtml = `
    <div xmlns="http://www.w3.org/1999/xhtml"
         class="math-text-block"
         style="width:${boxW}px;font-family:Inter,system-ui,-apple-system,sans-serif;font-size:${fontSize}px;font-weight:${fontWeight};line-height:${lineHeight};color:${color};margin:0;padding:0;">
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
  offscreen.toDataURL('image/png');

  return { canvas: offscreen, width: boxW, height: boxH };
}

/**
 * Kết xuất trước toàn bộ Đề bài, GT–KL và từng bước Lời giải bằng KaTeX
 */
async function preRenderLectureTypography(lesson, rightW) {
  try {
    const katexCss = await getInlinedKatexCss();
    const measureHost = document.createElement('div');
    measureHost.style.cssText = [
      'position:fixed',
      'left:-99999px',
      'top:0',
      'font-family:Inter,system-ui,-apple-system,sans-serif',
      'visibility:hidden',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(measureHost);

    const innerW = rightW - 36;
    const halfColW = Math.floor((innerW - 18) / 2);

    // 1. Đề bài
    let problemAsset = null;
    const problemText = String(lesson?.problemText || '').trim();
    if (problemText) {
      const pHtml = renderMathBlockHtml(problemText);
      if (pHtml) {
        problemAsset = await rasterizeKatexHtml({
          htmlContent: pHtml,
          width: innerW,
          fontSize: 13.5,
          lineHeight: 1.4,
          color: '#f1f5f9',
          fontWeight: '400',
          katexCss,
          measureHost
        });
      }
    }

    // 2. Giả thiết (GT) & Kết luận (KL)
    const givenList = Array.isArray(lesson?.given)
      ? lesson.given.filter(Boolean)
      : lesson?.given
      ? [String(lesson.given)]
      : [];
    const proveList = Array.isArray(lesson?.prove)
      ? lesson.prove.filter(Boolean)
      : lesson?.prove
      ? [String(lesson.prove)]
      : [];

    let givenAsset = null;
    if (givenList.length > 0) {
      const gHtml = givenList
        .map((item) => renderMathBlockHtml(`• ${String(item).trim()}`))
        .join('');
      if (gHtml) {
        givenAsset = await rasterizeKatexHtml({
          htmlContent: gHtml,
          width: halfColW,
          fontSize: 13,
          lineHeight: 1.38,
          color: '#e2e8f0',
          fontWeight: '400',
          katexCss,
          measureHost
        });
      }
    }

    let proveAsset = null;
    if (proveList.length > 0) {
      const kHtml = proveList
        .map((item) => renderMathBlockHtml(`• ${String(item).trim()}`))
        .join('');
      if (kHtml) {
        proveAsset = await rasterizeKatexHtml({
          htmlContent: kHtml,
          width: halfColW,
          fontSize: 13,
          lineHeight: 1.38,
          color: '#e2e8f0',
          fontWeight: '400',
          katexCss,
          measureHost
        });
      }
    }

    // 3. Các bước lời giải
    const solutionSteps = Array.isArray(lesson?.solutionSteps) ? lesson.solutionSteps : [];
    const maxLineW = rightW - 44;
    const solutionAssets = [];

    for (const st of solutionSteps) {
      const html = renderMathBlockHtml(st?.lineText || '');
      if (!html) {
        solutionAssets.push(null);
        continue;
      }
      const normal = await rasterizeKatexHtml({
        htmlContent: html,
        width: maxLineW,
        fontSize: 14.5,
        lineHeight: 1.44,
        color: '#cbd5e1',
        fontWeight: '400',
        katexCss,
        measureHost
      });
      const active = await rasterizeKatexHtml({
        htmlContent: html,
        width: maxLineW,
        fontSize: 14.5,
        lineHeight: 1.44,
        color: '#ecfdf5',
        fontWeight: '600',
        katexCss,
        measureHost
      });
      solutionAssets.push({ normal, active });
    }

    measureHost.remove();
    return { problemAsset, givenAsset, proveAsset, solutionAssets };
  } catch {
    return null;
  }
}

function wrapCleanText(ctx, text, maxWidth) {
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

/**
 * Tạo hàm vẽ từng khung hình HD 1280x720 tại mốc thời gian elapsedSec
 */
function createFrameRenderer({
  ctx,
  W,
  H,
  lesson,
  hasAudio,
  totalDurationSec,
  preRendered
}) {
  const drawingSteps = lesson?.drawingSteps || [];
  const solutionSteps = lesson?.solutionSteps || [];
  const totalDraw = drawingSteps.length;
  const totalSolve = solutionSteps.length;
  const totalSteps = Math.max(1, totalDraw + totalSolve);
  const timeline = Array.isArray(lesson?.audioTimeline) ? lesson.audioTimeline : [];
  const fallbackStepDuration = 2.4;

  const rightX = 646;
  const topY = 74;
  const rightW = 614;
  const bodyH = 540;

  return (elapsedSec) => {
    let mode = 'draw';
    let drawIdx = 0;
    let solveIdx = -1;
    let drawProg = 1;

    if (hasAudio && timeline.length > 0) {
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
      const stepDur = hasAudio
        ? totalDurationSec / totalSteps
        : fallbackStepDuration;
      const globalIdx = Math.min(totalSteps - 1, Math.floor(elapsedSec / Math.max(0.2, stepDur)));
      const localSec = elapsedSec - globalIdx * stepDur;
      if (globalIdx < totalDraw) {
        mode = 'draw';
        drawIdx = globalIdx;
        drawProg = Math.min(1, Math.max(0.08, localSec / Math.max(0.15, stepDur * 0.75)));
      } else {
        mode = 'solve';
        drawIdx = Math.max(0, totalDraw - 1);
        solveIdx = Math.min(totalSolve - 1, Math.max(0, globalIdx - totalDraw));
      }
    }

    const activeCfg =
      mode === 'draw' ? drawingSteps[drawIdx] || null : solutionSteps[solveIdx] || null;

    // 1. Nền tổng thể
    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, W, H);

    // 2. Thanh tiêu đề trên cùng
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

    // 3. Khung hình vẽ bên trái
    const leftX = 20;
    const leftW = 610;

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

    // 4. Khung trên bên phải: ĐỀ BÀI & GT – KL
    const pAsset = preRendered?.problemAsset || null;
    const gAsset = preRendered?.givenAsset || null;
    const kAsset = preRendered?.proveAsset || null;
    const hasGtKl = Boolean(gAsset || kAsset);
    const gtKlRowH = hasGtKl
      ? Math.max(gAsset?.height || 0, kAsset?.height || 0) + 24
      : 0;

    const rawProblemCardH =
      34 +
      (pAsset ? pAsset.height + 8 : 38) +
      (hasGtKl ? gtKlRowH + 8 : 4);
    const problemCardH = Math.min(220, Math.max(104, rawProblemCardH));

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(rightX, topY, rightW, problemCardH, 14);
    ctx.fill();
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.fillText('ĐỀ BÀI & GIẢ THIẾT – KẾT LUẬN', rightX + 18, topY + 22);

    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(rightX, topY + 30);
    ctx.lineTo(rightX + rightW, topY + 30);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(rightX + 8, topY + 32, rightW - 16, problemCardH - 36);
    ctx.clip();

    let pCursorY = topY + 36;
    if (pAsset) {
      ctx.drawImage(
        pAsset.canvas,
        rightX + 18,
        pCursorY,
        pAsset.width,
        pAsset.height
      );
      pCursorY += pAsset.height + 6;
    } else if (lesson?.problemText) {
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '13.5px Inter, system-ui, sans-serif';
      const pLines = wrapCleanText(ctx, lesson.problemText, rightW - 36).slice(0, 3);
      pLines.forEach((ln) => {
        ctx.fillText(ln, rightX + 18, pCursorY + 14);
        pCursorY += 19;
      });
      pCursorY += 4;
    }

    if (hasGtKl) {
      const halfW = Math.floor((rightW - 36) / 2);
      const col1X = rightX + 18;
      const col2X = rightX + 18 + halfW + 10;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(col1X - 4, pCursorY, rightW - 28, gtKlRowH, 8);
      ctx.stroke();

      // Đường chia dọc giữa GT và KL
      ctx.beginPath();
      ctx.moveTo(col2X - 6, pCursorY + 4);
      ctx.lineTo(col2X - 6, pCursorY + gtKlRowH - 4);
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 12.5px Inter, system-ui, sans-serif';
      ctx.fillText('GT:', col1X + 2, pCursorY + 15);
      if (gAsset) {
        ctx.drawImage(
          gAsset.canvas,
          col1X + 2,
          pCursorY + 19,
          gAsset.width,
          gAsset.height
        );
      }

      ctx.fillStyle = '#fbbf24';
      ctx.fillText('KL:', col2X + 2, pCursorY + 15);
      if (kAsset) {
        ctx.drawImage(
          kAsset.canvas,
          col2X + 2,
          pCursorY + 19,
          kAsset.width,
          kAsset.height
        );
      }
    }
    ctx.restore();

    // 5. Khung dưới bên phải: LỜI GIẢI CHI TIẾT
    const solveTopY = topY + problemCardH + 10;
    const solveH = bodyH - problemCardH - 10;

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(rightX, solveTopY, rightW, solveH, 14);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 14.5px Inter, system-ui, sans-serif';
    ctx.fillText('LỜI GIẢI CHI TIẾT', rightX + 18, solveTopY + 24);

    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(rightX, solveTopY + 33);
    ctx.lineTo(rightX + rightW, solveTopY + 33);
    ctx.stroke();

    const visibleSteps =
      mode === 'solve' && solveIdx >= 0 ? solutionSteps.slice(0, solveIdx + 1) : [];

    if (visibleSteps.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.fillText(
        `Đang dựng hình theo giả thiết (Bước ${Math.min(drawIdx + 1, Math.max(1, totalDraw))}/${Math.max(1, totalDraw)})...`,
        rightX + 18,
        solveTopY + 62
      );
      ctx.fillStyle = '#64748b';
      ctx.font = '13.5px Inter, system-ui, sans-serif';
      ctx.fillText(
        'Các bước chứng minh chi tiết sẽ hiển thị ngay sau khi dựng xong hình.',
        rightX + 18,
        solveTopY + 86
      );
    } else {
      let cursorY = solveTopY + 44;
      const maxLineW = rightW - 44;

      const renderedBlocks = visibleSteps.map((st, idx) => {
        const isCurrent = idx === solveIdx;
        const katexPair = preRendered?.solutionAssets?.[idx] || null;
        const katexAsset = katexPair ? (isCurrent ? katexPair.active : katexPair.normal) : null;

        if (katexAsset) {
          return {
            idx,
            isCurrent,
            katexAsset,
            height: katexAsset.height
          };
        }

        const fallbackLines = wrapCleanText(ctx, st.lineText, maxLineW);
        return {
          idx,
          isCurrent,
          katexAsset: null,
          lines: fallbackLines,
          height: Math.max(22, fallbackLines.length * 22)
        };
      });

      const totalTextHeight = renderedBlocks.reduce(
        (sum, b) => sum + b.height + 13,
        0
      );
      const availTextHeight = solveH - 46;
      if (totalTextHeight > availTextHeight) {
        cursorY -= totalTextHeight - availTextHeight;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(rightX + 8, solveTopY + 36, rightW - 16, solveH - 42);
      ctx.clip();

      renderedBlocks.forEach((blk) => {
        const boxH = blk.height + 9;
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
            ? '600 14.5px Inter, system-ui, sans-serif'
            : '14.5px Inter, system-ui, sans-serif';
          let lineY = cursorY + 15;
          blk.lines.forEach((ln) => {
            ctx.fillText(ln, rightX + 22, lineY);
            lineY += 22;
          });
        }

        cursorY += boxH + 4;
      });
      ctx.restore();
    }

    // 6. Thanh lời thuyết minh dưới cùng
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
    const subLines = wrapCleanText(ctx, speechText, W - 210).slice(0, 2);
    subLines.forEach((sl, i) => {
      ctx.fillText(sl, 175, subY + 24 + i * 24);
    });
  };
}

/**
 * Luồng chính (siêu nhanh): Kết xuất offline bằng WebCodecs (H.264 + AAC) -> tệp .mp4
 */
async function exportFastWebCodecsMp4({
  canvas,
  drawFrameAtTime,
  audioUrl,
  totalDurationSecFallback,
  onProgress,
  signal
}) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  const W = canvas.width;
  const H = canvas.height;
  const fps = 24;

  const videoCodecCandidates = [
    'avc1.4d002a', // H.264 Main L4.2
    'avc1.42001f', // H.264 Baseline L3.1
    'avc1.640028'  // H.264 High L4.0
  ];

  let supportedVideoConfig = null;
  for (const codec of videoCodecCandidates) {
    try {
      const check = await VideoEncoder.isConfigSupported({
        codec,
        width: W,
        height: H,
        bitrate: 3_000_000,
        framerate: fps,
        avc: { format: 'avc' }
      });
      if (check?.supported) {
        supportedVideoConfig = check.config;
        break;
      }
    } catch {
      // thử codec tiếp theo
    }
  }

  if (!supportedVideoConfig) return null;

  // Giải mã âm thanh (nếu có) bằng AudioContext
  let decodedAudio = null;
  if (audioUrl) {
    try {
      const resp = await fetch(audioUrl);
      const arrayBuf = await resp.arrayBuffer();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const actx = new AudioCtx();
      try {
        decodedAudio = await actx.decodeAudioData(arrayBuf);
      } finally {
        actx.close().catch(() => {});
      }
    } catch {
      decodedAudio = null;
    }
  }

  const totalDurationSec =
    decodedAudio && Number.isFinite(decodedAudio.duration) && decodedAudio.duration > 0
      ? decodedAudio.duration
      : totalDurationSecFallback;

  const sampleRate = decodedAudio ? decodedAudio.sampleRate : 48000;
  const channels = decodedAudio ? Math.min(2, Math.max(1, decodedAudio.numberOfChannels)) : 2;

  const muxer = new SimpleMp4Muxer({
    width: W,
    height: H,
    fps,
    sampleRate,
    channels
  });

  // 1. Mã hóa âm thanh AAC (nếu trình duyệt hỗ trợ AudioEncoder + mp4a.40.2)
  if (decodedAudio && typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined') {
    try {
      const aCheck = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate,
        numberOfChannels: channels,
        bitrate: 128_000
      });

      if (aCheck?.supported) {
        let aError = null;
        const audioEncoder = new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: (err) => {
            aError = err;
          }
        });
        audioEncoder.configure(aCheck.config);

        const totalSamples = decodedAudio.length;
        const chunkSamples = 1024;
        const ch0 = decodedAudio.getChannelData(0);
        const ch1 = channels > 1 ? decodedAudio.getChannelData(1) : ch0;

        for (let offset = 0; offset < totalSamples; offset += chunkSamples) {
          if (signal?.aborted) throw new Error('ABORTED');
          if (aError) break;
          const frameCount = Math.min(chunkSamples, totalSamples - offset);
          const planar = new Float32Array(frameCount * channels);
          planar.set(ch0.subarray(offset, offset + frameCount), 0);
          if (channels > 1) {
            planar.set(ch1.subarray(offset, offset + frameCount), frameCount);
          }

          const timestampUs = Math.round((offset / sampleRate) * 1_000_000);
          const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate,
            numberOfFrames: frameCount,
            numberOfChannels: channels,
            timestamp: timestampUs,
            data: planar
          });
          audioEncoder.encode(audioData);
          audioData.close();
        }

        await audioEncoder.flush();
        audioEncoder.close();
      }
    } catch (e) {
      if (e?.message === 'ABORTED') throw e;
      // Bỏ qua lỗi audio encoder để vẫn xuất trọn vẹn video hình
    }
  }

  onProgress?.(8);

  // 2. Kết xuất & mã hóa từng khung hình H.264 ở tốc độ tối đa (nhanh gấp 6-12 lần)
  let vError = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      vError = err;
    }
  });
  videoEncoder.configure(supportedVideoConfig);

  const totalFrames = Math.max(1, Math.ceil(totalDurationSec * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    if (signal?.aborted) {
      try {
        videoEncoder.close();
      } catch {}
      throw new Error('ABORTED');
    }
    if (vError) {
      try {
        videoEncoder.close();
      } catch {}
      return null;
    }

    const elapsedSec = frameIdx / fps;
    drawFrameAtTime(elapsedSec);

    const timestampUs = frameIdx * frameDurationUs;
    const frame = new VideoFrame(canvas, {
      timestamp: timestampUs,
      duration: frameDurationUs
    });

    const isKeyFrame = frameIdx % (fps * 2) === 0;
    videoEncoder.encode(frame, { keyFrame: isKeyFrame });
    frame.close();

    // Điều tiết hàng đợi encoder & cập nhật thanh tiến trình mượt mà
    if (videoEncoder.encodeQueueSize > 8) {
      await new Promise((r) => setTimeout(r, 4));
    } else if (frameIdx % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    if (frameIdx % 3 === 0 || frameIdx === totalFrames - 1) {
      const pct = Math.min(97, 8 + Math.round(((frameIdx + 1) / totalFrames) * 89));
      onProgress?.(pct);
    }
  }

  await videoEncoder.flush();
  videoEncoder.close();

  const mp4Bytes = muxer.finalize();
  onProgress?.(100);
  return new Blob([mp4Bytes], { type: 'video/mp4' });
}

/**
 * Luồng dự phòng bằng MediaRecorder (ưu tiên video/mp4 nếu trình duyệt hỗ trợ)
 */
async function exportFallbackMediaRecorder({
  canvas,
  drawFrameAtTime,
  audioUrl,
  totalDurationSecFallback,
  onProgress,
  signal
}) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error(
      'Trình duyệt của thầy chưa hỗ trợ xuất video. Hãy dùng Chrome hoặc Edge phiên bản mới nhất.'
    );
  }

  let audioCtx = null;
  let audioEl = null;
  const mixedStream = canvas.captureStream(25);

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
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];
  const selectedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  const recorder = selectedMime
    ? new MediaRecorder(mixedStream, { mimeType: selectedMime, videoBitsPerSecond: 3_000_000 })
    : new MediaRecorder(mixedStream);

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const totalDurationSec =
    audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0
      ? audioEl.duration
      : totalDurationSecFallback;

  return new Promise((resolve, reject) => {
    let rafId = null;
    const startTimeMs = performance.now();
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
      const outType = selectedMime.includes('mp4') ? 'video/mp4' : selectedMime || 'video/mp4';
      resolve(new Blob(chunks, { type: outType }));
    };

    recorder.start(200);
    if (audioEl) audioEl.play().catch(() => {});

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

export async function exportLectureVideo({
  lesson,
  audioUrl,
  onProgress,
  signal
}) {
  const W = 1280;
  const H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const drawingSteps = lesson?.drawingSteps || [];
  const solutionSteps = lesson?.solutionSteps || [];
  const totalSteps = Math.max(1, drawingSteps.length + solutionSteps.length);
  const totalDurationSecFallback = totalSteps * 2.4;

  onProgress?.(2);
  const rightW = 614;
  const preRendered = await preRenderLectureTypography(lesson, rightW);
  onProgress?.(5);

  const drawFrameAtTime = createFrameRenderer({
    ctx,
    W,
    H,
    lesson,
    hasAudio: Boolean(audioUrl),
    totalDurationSec: totalDurationSecFallback,
    preRendered
  });

  // Ưu tiên xuất .mp4 tốc độ cao bằng WebCodecs (H.264 + AAC)
  let videoBlob = await exportFastWebCodecsMp4({
    canvas,
    drawFrameAtTime,
    audioUrl,
    totalDurationSecFallback,
    onProgress,
    signal
  });

  // Dự phòng tự động nếu trình duyệt không hỗ trợ WebCodecs
  if (!videoBlob) {
    videoBlob = await exportFallbackMediaRecorder({
      canvas,
      drawFrameAtTime,
      audioUrl,
      totalDurationSecFallback,
      onProgress,
      signal
    });
  }

  const url = URL.createObjectURL(videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugifyVietnamese(lesson?.title || 'bai-giang-hinh-hoc')}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}
