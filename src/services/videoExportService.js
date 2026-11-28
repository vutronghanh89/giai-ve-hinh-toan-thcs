/* ============================================================================
   DỊCH VỤ XUẤT VIDEO BÀI GIẢNG CHUẨN ĐỊNH DẠNG .MP4 (1920x1080 FULL HD)
   - Bố cục đồng nhất 100% với giao diện Web:
     + Tiêu đề bài giảng
     + Hàng 1: Đề bài (trái) & GT - KL (phải)
     + Hàng 2: Hình vẽ minh họa đồng bộ từng bước (trái) & Lời giải chi tiết (phải)
   - Hiển thị công thức KaTeX chuẩn sách giáo khoa (mũ góc \widehat{DAE}, phân số dọc...)
   - Đóng gói chuẩn container .mp4 (H.264 + AAC qua WebCodecs/mp4-muxer, tự động
     fallback sang MediaRecorder nếu trình duyệt cũ không hỗ trợ WebCodecs).
   ============================================================================ */

import { renderMathToHtml } from '../components/MathText.jsx';
import { renderGeometryScene } from '../components/GeometryCanvas.jsx';
import { loadExternalScript, slugifyVietnamese } from './githubStorageService.js';

const MP4_MUXER_CDN = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.min.js';

/**
 * Trích xuất các quy tắc CSS của KaTeX đang nạp trên trang (bỏ qua @font-face ngoài
 * để SVG foreignObject vẽ lên Canvas không bao giờ bị lỗi bảo mật taint).
 */
function collectSafeKatexCss() {
  const rules = [];
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let cssRules;
      try {
        cssRules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!cssRules) continue;
      for (const rule of Array.from(cssRules)) {
        const text = rule.cssText || '';
        if (text.startsWith('@font-face')) continue;
        if (text.includes('.katex') || text.includes('.math-atomic')) {
          rules.push(text);
        }
      }
    }
  } catch {
    // ignore
  }
  return rules.join('\n');
}

function escapeXmlForSvg(str) {
  return String(str || '')
    .replace(/&nbsp;/g, '&#160;')
    .replace(/<br>/gi, '<br/>')
    .replace(/<hr>/gi, '<hr/>');
}

/**
 * Tạo ảnh bitmap sẵn từ nội dung HTML đã render KaTeX để vẽ siêu nét & siêu nhanh
 * lên từng khung hình video (đảm bảo ký hiệu góc \widehat{DAE}, phân số dọc y hệt Web).
 */
async function rasterizeRichMathBlock({
  text,
  width,
  fontSize = 18,
  lineHeight = 1.55,
  color = '#e2e8f0',
  katexCss = ''
}) {
  const mathHtml = escapeXmlForSvg(renderMathToHtml(text));

  // Đo chiều cao thực tế bằng phần tử DOM ẩn
  const measureDiv = document.createElement('div');
  measureDiv.style.position = 'fixed';
  measureDiv.style.left = '-99999px';
  measureDiv.style.top = '0';
  measureDiv.style.width = `${width}px`;
  measureDiv.style.fontFamily = "'Times New Roman', Georgia, system-ui, serif";
  measureDiv.style.fontSize = `${fontSize}px`;
  measureDiv.style.lineHeight = String(lineHeight);
  measureDiv.style.color = color;
  measureDiv.style.wordBreak = 'break-word';
  measureDiv.innerHTML = mathHtml;
  document.body.appendChild(measureDiv);

  const measuredHeight = Math.max(Math.ceil(fontSize * lineHeight), Math.ceil(measureDiv.scrollHeight) + 6);
  document.body.removeChild(measureDiv);

  const dpr = 2;
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width * dpr}" height="${measuredHeight * dpr}" viewBox="0 0 ${width} ${measuredHeight}">
      <style>
        ${katexCss}
        .root-box {
          width: ${width}px;
          font-family: 'Times New Roman', Georgia, system-ui, serif;
          font-size: ${fontSize}px;
          line-height: ${lineHeight};
          color: ${color};
          word-break: break-word;
        }
        .root-box .katex {
          font-family: 'Times New Roman', Georgia, serif !important;
          font-size: 1.05em;
          color: ${color};
        }
        .math-atomic {
          display: inline-block;
          white-space: nowrap;
          vertical-align: middle;
        }
      </style>
      <foreignObject x="0" y="0" width="${width}" height="${measuredHeight}">
        <div xmlns="http://www.w3.org/1999/xhtml" class="root-box">${mathHtml}</div>
      </foreignObject>
    </svg>
  `.trim();

  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('SVG rasterize failed'));
      image.src = svgUrl;
    });

    // Kiểm tra chống taint canvas trên trình duyệt
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 4;
    testCanvas.height = 4;
    const tCtx = testCanvas.getContext('2d');
    tCtx.drawImage(img, 0, 0, 4, 4);
    tCtx.getImageData(0, 0, 1, 1);

    return {
      img,
      width,
      height: measuredHeight,
      fallbackText: null
    };
  } catch {
    return {
      img: null,
      width,
      height: measuredHeight,
      fallbackText: String(text || '')
    };
  }
}

/**
 * Bộ vẽ toán dự phòng thuần Canvas (vẽ mũ góc nhọn ^ phía trên tên 3 điểm, phân số có gạch ngang)
 * chỉ kích hoạt nếu trình duyệt chặn SVG foreignObject.
 */
function drawMathFallbackOnCanvas(ctx, rawText, x, y, maxWidth, fontSize = 18, color = '#e2e8f0') {
  const cleaned = String(rawText || '')
    .replace(/\$/g, '')
    .replace(/\\dfrac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\perp/g, '⊥')
    .replace(/\\parallel/g, '∥')
    .replace(/\\triangle/g, '△')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\approx/g, '≈')
    .replace(/\\pi/g, 'π')
    .replace(/\\cdot/g, '·')
    .replace(/\^\\circ/g, '°')
    .replace(/\\text\{([^{}]+)\}/g, '$1');

  ctx.save();
  ctx.font = `500 ${fontSize}px 'Times New Roman', Georgia, serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  const lines = cleaned.split('\n');
  let cursorY = y;
  const lineH = Math.round(fontSize * 1.55);

  for (const rawLine of lines) {
    // Tách token \widehat{ABC} để vẽ dấu mũ ^ trên đầu tên góc
    const parts = rawLine.split(/(\\widehat\{[^{}]+\})/g);
    let cursorX = x;

    for (const part of parts) {
      if (!part) continue;
      const hatMatch = part.match(/^\\widehat\{([^{}]+)\}$/);
      if (hatMatch) {
        const angName = hatMatch[1];
        const w = ctx.measureText(angName).width;
        if (cursorX + w > x + maxWidth) {
          cursorX = x;
          cursorY += lineH;
        }
        // Vẽ dấu mũ góc nhọn trên đầu tên góc
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cursorX + 1, cursorY + 3);
        ctx.lineTo(cursorX + w / 2, cursorY - 3);
        ctx.lineTo(cursorX + w - 1, cursorY + 3);
        ctx.stroke();
        ctx.restore();

        ctx.fillText(angName, cursorX, cursorY + 3);
        cursorX += w;
      } else {
        const words = part.split(/(\s+)/);
        for (const word of words) {
          if (!word) continue;
          const w = ctx.measureText(word).width;
          if (cursorX > x && cursorX + w > x + maxWidth && word.trim()) {
            cursorX = x;
            cursorY += lineH;
          }
          ctx.fillText(word, cursorX, cursorY + 3);
          cursorX += w;
        }
      }
    }
    cursorY += lineH;
  }

  ctx.restore();
  return cursorY - y;
}

function drawRoundedPanel(ctx, x, y, w, h, radius = 14, fill = '#0f172a', stroke = '#1e293b') {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSectionBadge(ctx, text, x, y, bgColor, textColor) {
  ctx.save();
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  const tw = ctx.measureText(text).width;
  const pw = tw + 20;
  const ph = 24;
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, 6);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 10, y + ph / 2);
  ctx.restore();
}

async function decodeLessonAudioBuffer(audioUrl, fallbackDurationSec) {
  const sampleRate = 48000;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return { sampleRate, length: Math.ceil(fallbackDurationSec * sampleRate), channelData: new Float32Array(Math.ceil(fallbackDurationSec * sampleRate)), durationSec: fallbackDurationSec };
  }

  const ctx = new AudioCtx({ sampleRate });
  try {
    if (audioUrl) {
      const res = await fetch(audioUrl);
      if (res.ok) {
        const arrBuf = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrBuf);
        const mono = new Float32Array(decoded.length);
        const numCh = decoded.numberOfChannels;
        for (let ch = 0; ch < numCh; ch++) {
          const data = decoded.getChannelData(ch);
          for (let i = 0; i < decoded.length; i++) {
            mono[i] += data[i] / numCh;
          }
        }
        return {
          sampleRate: decoded.sampleRate,
          length: decoded.length,
          channelData: mono,
          durationSec: decoded.duration
        };
      }
    }
  } catch {
    // Fallback silent buffer
  } finally {
    ctx.close().catch(() => {});
  }

  const silentLen = Math.max(sampleRate, Math.ceil(fallbackDurationSec * sampleRate));
  return {
    sampleRate,
    length: silentLen,
    channelData: new Float32Array(silentLen),
    durationSec: silentLen / sampleRate
  };
}

export async function exportLessonToMp4({ lesson, audioUrl, onProgress }) {
  if (!lesson) throw new Error('Không có dữ liệu bài học để xuất video.');

  const drawingSteps = Array.isArray(lesson.drawingSteps) ? lesson.drawingSteps : [];
  const solutionSteps = Array.isArray(lesson.solutionSteps) ? lesson.solutionSteps : [];
  const totalDrawSteps = drawingSteps.length;
  const totalSolveSteps = solutionSteps.length;
  const totalSteps = Math.max(1, totalDrawSteps + totalSolveSteps);

  onProgress?.({ percent: 4, label: 'Đang chuẩn bị âm thanh và công thức toán KaTeX...' });

  const fallbackTotalSec = totalSteps * 2.8;
  const audioInfo = await decodeLessonAudioBuffer(audioUrl, fallbackTotalSec);

  const rawTimeline = Array.isArray(lesson.audioTimeline) && lesson.audioTimeline.length > 0
    ? lesson.audioTimeline
    : Array.from({ length: totalSteps }, (_, idx) => ({
        stepIndex: idx,
        startSec: Number(((idx * audioInfo.durationSec) / totalSteps).toFixed(3)),
        endSec: Number((((idx + 1) * audioInfo.durationSec) / totalSteps).toFixed(3))
      }));

  const totalDurationSec = Math.max(
    audioInfo.durationSec,
    rawTimeline[rawTimeline.length - 1]?.endSec || fallbackTotalSec
  );

  // Pre-render toàn bộ khối chữ + KaTeX giống hệt trên Web
  const katexCss = collectSafeKatexCss();

  const problemBlock = await rasterizeRichMathBlock({
    text: lesson.problemText || '',
    width: 874,
    fontSize: 17.5,
    lineHeight: 1.5,
    color: '#f1f5f9',
    katexCss
  });

  const givenBlocks = [];
  for (const g of lesson.given || []) {
    givenBlocks.push(
      await rasterizeRichMathBlock({
        text: `• ${g}`,
        width: 416,
        fontSize: 16.5,
        lineHeight: 1.48,
        color: '#e2e8f0',
        katexCss
      })
    );
  }

  const proveBlocks = [];
  for (const p of lesson.prove || []) {
    proveBlocks.push(
      await rasterizeRichMathBlock({
        text: `• ${p}`,
        width: 416,
        fontSize: 16.5,
        lineHeight: 1.48,
        color: '#a7f3d0',
        katexCss
      })
    );
  }

  const solutionBlocks = [];
  for (let i = 0; i < solutionSteps.length; i++) {
    onProgress?.({
      percent: 6 + Math.round((i / Math.max(1, solutionSteps.length)) * 14),
      label: `Đang kết xuất công thức KaTeX dòng ${i + 1}/${solutionSteps.length}...`
    });
    solutionBlocks.push(
      await rasterizeRichMathBlock({
        text: solutionSteps[i].lineText || '',
        width: 846,
        fontSize: 18.5,
        lineHeight: 1.58,
        color: '#f8fafc',
        katexCss
      })
    );
  }

  // Khởi tạo Canvas Full HD 1920 x 1080
  const W = 1920;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });

  // Hàm vẽ 1 khung hình tại thời điểm tSec (Bố cục y hệt Web: Tiêu đề + Đề bài + GT-KL + Hình + Lời giải)
  const drawFrameAtTime = (tSec) => {
    const hit =
      rawTimeline.find((item) => tSec >= item.startSec && tSec < item.endSec) ||
      rawTimeline[rawTimeline.length - 1];

    const globalIdx = hit ? hit.stepIndex : 0;
    const isDrawMode = globalIdx < totalDrawSteps;
    const mode = isDrawMode ? 'draw' : 'solve';
    const activeDrawStep = isDrawMode ? globalIdx : Math.max(0, totalDrawSteps - 1);
    const activeSolveStep = isDrawMode
      ? -1
      : Math.min(totalSolveSteps - 1, Math.max(0, globalIdx - totalDrawSteps));

    let drawProgress = 1;
    if (isDrawMode && hit) {
      const span = Math.max(0.2, hit.endSec - hit.startSec);
      drawProgress = Math.min(1, Math.max(0.08, (tSec - hit.startSec) / (span * 0.75)));
    }

    const activeStepConfig = isDrawMode
      ? drawingSteps[activeDrawStep] || null
      : solutionSteps[activeSolveStep] || null;

    // 1. Nền chính
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, W, H);

    // 2. Thanh tiêu đề trên cùng
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, 66);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 66);
    ctx.lineTo(W, 66);
    ctx.stroke();

    // Icon tam giác
    const grad = ctx.createLinearGradient(28, 13, 68, 53);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(1, '#0d9488');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(28, 13, 40, 40, 10);
    ctx.fill();

    ctx.fillStyle = '#020617';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('△', 48, 34);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 21px Inter, system-ui, sans-serif';
    ctx.fillText(lesson.title || 'Giải & Vẽ Hình Toán Hình Học THCS', 82, 26);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 14px Inter, system-ui, sans-serif';
    ctx.fillText(
      `${lesson.grade || 'Toán THCS'}  •  ${lesson.topic || 'Hình học phẳng'}`,
      82,
      49
    );

    // 3. HÀNG 1: ĐỀ BÀI (trái) & GT - KL (phải)
    const row1Y = 80;
    const row1H = 186;
    const colW = 922;
    const leftX = 28;
    const rightX = 970;

    // Card ĐỀ BÀI
    drawRoundedPanel(ctx, leftX, row1Y, colW, row1H, 14, '#0f172a', '#1e293b');
    drawSectionBadge(ctx, 'ĐỀ BÀI', leftX + 18, row1Y + 14, 'rgba(14, 165, 233, 0.16)', '#38bdf8');

    ctx.save();
    ctx.beginPath();
    ctx.rect(leftX + 18, row1Y + 46, colW - 36, row1H - 56);
    ctx.clip();
    if (problemBlock.img) {
      ctx.drawImage(problemBlock.img, leftX + 18, row1Y + 48, problemBlock.width, problemBlock.height);
    } else {
      drawMathFallbackOnCanvas(
        ctx,
        problemBlock.fallbackText,
        leftX + 18,
        row1Y + 48,
        colW - 36,
        17.5,
        '#f1f5f9'
      );
    }
    ctx.restore();

    // Card GT - KL
    drawRoundedPanel(ctx, rightX, row1Y, colW, row1H, 14, '#0f172a', '#1e293b');
    drawSectionBadge(ctx, 'GT - KL', rightX + 18, row1Y + 14, 'rgba(245, 158, 11, 0.16)', '#fbbf24');

    const midGtKlX = rightX + colW / 2;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(midGtKlX, row1Y + 46);
    ctx.lineTo(midGtKlX, row1Y + row1H - 12);
    ctx.stroke();

    ctx.font = '700 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textBaseline = 'top';
    ctx.fillText('GT', rightX + 20, row1Y + 48);
    ctx.fillStyle = '#34d399';
    ctx.fillText('KL', midGtKlX + 16, row1Y + 48);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rightX + 18, row1Y + 68, colW / 2 - 28, row1H - 78);
    ctx.clip();
    let gy = row1Y + 68;
    for (const gb of givenBlocks) {
      if (gb.img) {
        ctx.drawImage(gb.img, rightX + 18, gy, gb.width, gb.height);
        gy += gb.height + 2;
      } else {
        gy += drawMathFallbackOnCanvas(ctx, gb.fallbackText, rightX + 18, gy, colW / 2 - 28, 16, '#e2e8f0') + 2;
      }
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(midGtKlX + 14, row1Y + 68, colW / 2 - 30, row1H - 78);
    ctx.clip();
    let py = row1Y + 68;
    for (const pb of proveBlocks) {
      if (pb.img) {
        ctx.drawImage(pb.img, midGtKlX + 14, py, pb.width, pb.height);
        py += pb.height + 2;
      } else {
        py += drawMathFallbackOnCanvas(ctx, pb.fallbackText, midGtKlX + 14, py, colW / 2 - 30, 16, '#a7f3d0') + 2;
      }
    }
    ctx.restore();

    // 4. HÀNG 2: HÌNH VẼ MINH HỌA (trái) & LỜI GIẢI CHI TIẾT (phải)
    const row2Y = 282;
    const row2H = 772;

    // Card HÌNH VẼ MINH HỌA
    drawRoundedPanel(ctx, leftX, row2Y, colW, row2H, 16, '#0f172a', '#1e293b');
    drawSectionBadge(ctx, 'HÌNH VẼ MINH HỌA', leftX + 18, row2Y + 14, 'rgba(56, 189, 248, 0.14)', '#7dd3fc');

    const statusBadgeText = isDrawMode
      ? `Dựng hình: Bước ${activeDrawStep + 1}/${totalDrawSteps}`
      : `Chứng minh: Bước ${activeSolveStep + 1}/${Math.max(1, totalSolveSteps)}`;
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusBadgeText, leftX + colW - 20, row2Y + 26);
    ctx.textAlign = 'left';

    const geoX = leftX + 16;
    const geoY = row2Y + 50;
    const geoW = colW - 32;
    const geoH = row2H - 66;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(geoX, geoY, geoW, geoH, 12);
    ctx.clip();
    ctx.translate(geoX, geoY);

    renderGeometryScene(ctx, geoW, geoH, {
      geometry: lesson.geometry,
      mode,
      activeDrawStep,
      activeSolveStep,
      activeStepConfig,
      drawProgress,
      zoom: 1.18,
      showGrid: true,
      showLabels: true
    });

    if (isDrawMode && activeStepConfig?.caption) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(14, geoH - 46, geoW - 28, 34, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#bae6fd';
      ctx.font = '500 14.5px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(activeStepConfig.caption, 26, geoH - 29);
    }
    ctx.restore();

    // Card LỜI GIẢI CHI TIẾT
    drawRoundedPanel(ctx, rightX, row2Y, colW, row2H, 16, '#0f172a', '#1e293b');
    drawSectionBadge(ctx, 'LỜI GIẢI CHI TIẾT', rightX + 18, row2Y + 14, 'rgba(16, 185, 129, 0.16)', '#34d399');

    const visibleCount = isDrawMode ? 0 : activeSolveStep + 1;
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${visibleCount} / ${totalSolveSteps} dòng`, rightX + colW - 20, row2Y + 26);
    ctx.textAlign = 'left';

    const listX = rightX + 18;
    const listY = row2Y + 52;
    const listW = colW - 36;
    const listH = row2H - 68;

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    if (visibleCount === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 17px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('Đang dựng hình theo giả thiết bài toán...', listX + 12, listY + 18);
    } else {
      // Tính tổng chiều cao các dòng đã hiển thị để tự động cuộn mượt khi bài giải dài
      const itemGap = 10;
      const itemHeights = [];
      let totalContentH = 0;
      for (let i = 0; i < visibleCount; i++) {
        const blk = solutionBlocks[i];
        const h = (blk ? blk.height : 34) + 18;
        itemHeights.push(h);
        totalContentH += h + itemGap;
      }

      const scrollOffset = Math.max(0, totalContentH - listH + 12);
      let curY = listY - scrollOffset;

      for (let i = 0; i < visibleCount; i++) {
        const blk = solutionBlocks[i];
        const boxH = itemHeights[i];
        const isCurrentLine = i === activeSolveStep;

        if (curY + boxH >= listY - 20 && curY <= listY + listH + 20) {
          drawRoundedPanel(
            ctx,
            listX,
            curY,
            listW,
            boxH,
            10,
            isCurrentLine ? 'rgba(6, 78, 59, 0.42)' : 'rgba(15, 23, 42, 0.72)',
            isCurrentLine ? 'rgba(52, 211, 153, 0.65)' : 'rgba(51, 65, 85, 0.55)'
          );

          if (blk?.img) {
            ctx.drawImage(blk.img, listX + 16, curY + 9, blk.width, blk.height);
          } else if (blk) {
            drawMathFallbackOnCanvas(
              ctx,
              blk.fallbackText,
              listX + 16,
              curY + 9,
              listW - 32,
              18.5,
              '#f8fafc'
            );
          }
        }
        curY += boxH + itemGap;
      }
    }

    ctx.restore();
  };

  const slug = slugifyVietnamese(lesson.title || lesson.id || 'bai-giang-hinh-hoc');
  const fileName = `${slug}.mp4`;

  // ƯU TIÊN 1: WebCodecs (VideoEncoder H.264 + AudioEncoder AAC + mp4-muxer) -> Xuất .mp4 siêu tốc & chuẩn 100%
  await loadExternalScript(MP4_MUXER_CDN).catch(() => null);

  if (typeof window !== 'undefined' && typeof window.VideoEncoder !== 'undefined' && window.Mp4Muxer) {
    try {
      const fps = 25;
      const totalFrames = Math.max(1, Math.ceil(totalDurationSec * fps));
      const { Muxer, ArrayBufferTarget } = window.Mp4Muxer;

      const hasAudioEncoder = typeof window.AudioEncoder !== 'undefined';
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: 'avc',
          width: W,
          height: H
        },
        ...(hasAudioEncoder
          ? {
              audio: {
                codec: 'aac',
                numberOfChannels: 1,
                sampleRate: audioInfo.sampleRate
              }
            }
          : {}),
        fastStart: 'in-memory'
      });

      const videoEncoder = new window.VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (err) => {
          throw err;
        }
      });

      videoEncoder.configure({
        codec: 'avc1.420028',
        width: W,
        height: H,
        bitrate: 4_500_000,
        framerate: fps
      });

      let audioEncoder = null;
      if (hasAudioEncoder) {
        audioEncoder = new window.AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: (err) => {
            throw err;
          }
        });
        audioEncoder.configure({
          codec: 'mp4a.40.2',
          numberOfChannels: 1,
          sampleRate: audioInfo.sampleRate,
          bitrate: 128_000
        });

        // Nạp toàn bộ dữ liệu âm thanh PCM vào AudioEncoder
        const chunkSamples = 1024;
        const pcm = audioInfo.channelData;
        for (let offset = 0; offset < pcm.length; offset += chunkSamples) {
          const slice = pcm.subarray(offset, Math.min(pcm.length, offset + chunkSamples));
          const audioData = new window.AudioData({
            format: 'f32-planar',
            sampleRate: audioInfo.sampleRate,
            numberOfFrames: slice.length,
            numberOfChannels: 1,
            timestamp: Math.round((offset / audioInfo.sampleRate) * 1_000_000),
            data: slice
          });
          audioEncoder.encode(audioData);
          audioData.close();
        }
      }

      for (let f = 0; f < totalFrames; f++) {
        const tSec = Math.min(totalDurationSec, f / fps);
        drawFrameAtTime(tSec);

        const timestampUs = Math.round((f * 1_000_000) / fps);
        const frame = new window.VideoFrame(canvas, {
          timestamp: timestampUs,
          duration: Math.round(1_000_000 / fps)
        });
        videoEncoder.encode(frame, { keyFrame: f % (fps * 2) === 0 });
        frame.close();

        if (f % 10 === 0 || f === totalFrames - 1) {
          onProgress?.({
            percent: 20 + Math.round(((f + 1) / totalFrames) * 76),
            label: `Đang kết xuất video MP4 (${Math.round(((f + 1) / totalFrames) * 100)}%)...`
          });
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      onProgress?.({ percent: 98, label: 'Đang hoàn tất đóng gói tệp .mp4...' });
      await videoEncoder.flush();
      if (audioEncoder) await audioEncoder.flush();
      muxer.finalize();

      const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' });
      triggerBlobDownload(mp4Blob, fileName);
      onProgress?.({ percent: 100, label: 'Xuất video .mp4 thành công!' });
      return fileName;
    } catch (webCodecsErr) {
      console.warn('WebCodecs MP4 fallback to MediaRecorder:', webCodecsErr);
    }
  }

  // ƯU TIÊN 2 (Fallback): MediaRecorder MP4 / WebM
  const stream = canvas.captureStream(25);
  let audioCtx = null;
  let sourceNode = null;

  if (audioInfo.channelData && audioInfo.length > 0) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx({ sampleRate: audioInfo.sampleRate });
      const buf = audioCtx.createBuffer(1, audioInfo.length, audioInfo.sampleRate);
      buf.copyToChannel(audioInfo.channelData, 0);
      const dest = audioCtx.createMediaStreamDestination();
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = buf;
      sourceNode.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    } catch {
      // continue video-only if audio stream fails
    }
  }

  const candidateTypes = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];
  const chosenMime =
    candidateTypes.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';

  const chunks = [];
  const recorder = new MediaRecorder(stream, {
    ...(chosenMime ? { mimeType: chosenMime } : {}),
    videoBitsPerSecond: 4_500_000
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const donePromise = new Promise((resolve) => {
    recorder.onstop = () => {
      const outBlob = new Blob(chunks, { type: chosenMime || 'video/mp4' });
      triggerBlobDownload(outBlob, fileName);
      resolve(fileName);
    };
  });

  recorder.start(250);
  if (sourceNode) sourceNode.start(0);

  const startMs = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const elapsedSec = (performance.now() - startMs) / 1000;
      const clamped = Math.min(totalDurationSec, elapsedSec);
      drawFrameAtTime(clamped);
      onProgress?.({
        percent: 20 + Math.round((clamped / totalDurationSec) * 78),
        label: `Đang ghi hình video MP4 (${Math.round((clamped / totalDurationSec) * 100)}%)...`
      });
      if (elapsedSec >= totalDurationSec) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  if (sourceNode) {
    try {
      sourceNode.stop();
    } catch {
      // ignore
    }
  }
  if (audioCtx) audioCtx.close().catch(() => {});

  return await donePromise;
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
