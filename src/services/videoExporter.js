/* ============================================================================
   BỘ XUẤT VIDEO BÀI GIẢNG SIÊU TỐC & TUA ĐƯỢC MƯỢT MÀ (.MP4 H.264 + AAC)
   - Kết xuất đầy đủ bố cục 4 khung chuẩn như web:
     [ Đề bài ] | [ GT - KL ]
     [ Hình vẽ động ] | [ Lời giải chi tiết hiện đồng bộ theo lời thoại ]
     [ Thanh Lời thuyết minh ]
   - Dùng WebCodecs (VideoEncoder + AudioEncoder) + mp4-muxer (fastStart)
     -> Xuất nhanh gấp 5–15 lần thời gian thực, không treo ở 98%
     -> Tạo tệp .mp4 chuẩn có bảng chỉ mục keyframe mỗi 1 giây nên tua mượt trên mọi trình phát
   ============================================================================ */

import { renderGeometryScene } from '../components/GeometryCanvas.jsx';
import { slugifyVietnamese, loadExternalScript } from './githubStorageService.js';
import { resolveVisualStateAtTime } from './timelineHelper.js';
import {
  expandSolutionRowsForCanvas,
  layoutMathLines,
  drawLaidOutMathLines
} from './canvasMathRenderer.js';

const MP4_MUXER_CDNS = [
  'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.min.js',
  'https://unpkg.com/mp4-muxer@5.1.3/build/mp4-muxer.min.js'
];

async function ensureMp4MuxerLoaded() {
  if (typeof window !== 'undefined' && window.Mp4Muxer?.Muxer) {
    return window.Mp4Muxer;
  }
  for (const url of MP4_MUXER_CDNS) {
    try {
      await loadExternalScript(url);
      if (window.Mp4Muxer?.Muxer) return window.Mp4Muxer;
    } catch {
      // Thử CDN dự phòng tiếp theo
    }
  }
  return null;
}

function drawRoundedCard(ctx, x, y, w, h, r, fill, stroke) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function truncateTextToWidth(ctx, text, maxWidth) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (ctx.measureText(s).width <= maxWidth) return s;
  let end = s.length;
  while (end > 1 && ctx.measureText(`${s.slice(0, end)}…`).width > maxWidth) {
    end--;
  }
  return `${s.slice(0, end)}…`;
}

/**
 * Vẽ toàn bộ 1 khung hình bài giảng (1600x900) khớp giao diện web:
 * Header + Hàng 1 (Đề bài | GT - KL) + Hàng 2 (Hình vẽ | Lời giải) + Lời thuyết minh
 */
function renderFullLectureFrame(ctx, W, H, lesson, elapsedSec, totalDurationSec) {
  const drawingSteps = Array.isArray(lesson?.drawingSteps) ? lesson.drawingSteps : [];
  const solutionSteps = Array.isArray(lesson?.solutionSteps) ? lesson.solutionSteps : [];
  const totalSolve = solutionSteps.length;

  const state = resolveVisualStateAtTime(lesson, elapsedSec, totalDurationSec);
  const { mode, drawIdx, solveIdx, drawProg } = state;

  const activeCfg =
    mode === 'draw' ? drawingSteps[drawIdx] || null : solutionSteps[solveIdx] || null;

  const family = 'Inter, system-ui, -apple-system, sans-serif';

  // 1. Nền tổng thể
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, W, H);

  // 2. Thanh Header trên cùng (y: 0..54)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, 54);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 54);
  ctx.lineTo(W, 54);
  ctx.stroke();

  // Logo △
  const grad = ctx.createLinearGradient(20, 11, 52, 43);
  grad.addColorStop(0, '#10b981');
  grad.addColorStop(1, '#0d9488');
  drawRoundedCard(ctx, 20, 11, 32, 32, 8, grad, null);
  ctx.fillStyle = '#020617';
  ctx.font = `bold 17px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('△', 36, 27);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Tiêu đề ứng dụng + Badge lớp + Chủ đề
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 16px ${family}`;
  const appTitle = 'Giải & Vẽ Hình Toán Hình Học THCS';
  ctx.fillText(appTitle, 62, 25);
  const appTitleW = ctx.measureText(appTitle).width;

  const gradeText = String(lesson?.grade || 'Toán THCS');
  ctx.font = `bold 12px ${family}`;
  const gradeW = ctx.measureText(gradeText).width + 16;
  const badgeX = 62 + appTitleW + 10;
  drawRoundedCard(ctx, badgeX, 11, gradeW, 20, 5, 'rgba(16, 185, 129, 0.16)', null);
  ctx.fillStyle = '#34d399';
  ctx.fillText(gradeText, badgeX + 8, 25);

  if (lesson?.topic) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `13px ${family}`;
    const topicX = badgeX + gradeW + 10;
    const topicStr = truncateTextToWidth(ctx, `• ${lesson.topic}`, W - topicX - 24);
    ctx.fillText(topicStr, topicX, 25);
  }

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `500 13px ${family}`;
  ctx.fillText(
    truncateTextToWidth(ctx, lesson?.title || 'Bài giảng Hình học THCS', W - 90),
    62,
    45
  );

  // ============================================================================
  // HÀNG 1: [ Ô 1: ĐỀ BÀI ]  |  [ Ô 2: GT - KL ]   (y: 64..234, height: 170)
  // ============================================================================
  const marginX = 20;
  const gap = 14;
  const colW = (W - marginX * 2 - gap) / 2; // 773px
  const row1Y = 64;
  const row1H = 170;
  const cardHeaderH = 32;

  // --- Ô 1: ĐỀ BÀI ---
  const leftX = marginX;
  drawRoundedCard(ctx, leftX, row1Y, colW, row1H, 12, '#0f172a', '#1e293b');
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(leftX, row1Y, colW, row1H, 12);
  ctx.clip();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(leftX, row1Y, colW, cardHeaderH);
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(leftX, row1Y + cardHeaderH);
  ctx.lineTo(leftX + colW, row1Y + cardHeaderH);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 13px ${family}`;
  ctx.fillText('ĐỀ BÀI', leftX + 16, row1Y + 21);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 12px ${family}`;
  ctx.textAlign = 'right';
  ctx.fillText(
    truncateTextToWidth(ctx, lesson?.title || '', colW - 120),
    leftX + colW - 14,
    row1Y + 21
  );
  ctx.textAlign = 'left';

  // Nội dung đề bài (tự co cỡ chữ nếu đề dài để hiển thị trọn vẹn)
  const problemBodyH = row1H - cardHeaderH - 14;
  let probFontSize = 14.5;
  let probLines = layoutMathLines(ctx, lesson?.problemText || '', colW - 32, probFontSize, '400');
  const calcLinesHeight = (lns) => lns.reduce((s, l) => s + l.height + 2, 0);
  if (calcLinesHeight(probLines) > problemBodyH) {
    probFontSize = 13;
    probLines = layoutMathLines(ctx, lesson?.problemText || '', colW - 32, probFontSize, '400');
  }
  if (calcLinesHeight(probLines) > problemBodyH) {
    probFontSize = 12;
    probLines = layoutMathLines(ctx, lesson?.problemText || '', colW - 32, probFontSize, '400');
  }
  drawLaidOutMathLines(
    ctx,
    probLines,
    leftX + 16,
    row1Y + cardHeaderH + 8,
    probFontSize,
    '#e2e8f0',
    '400'
  );
  ctx.restore();

  // --- Ô 2: GT - KL ---
  const rightX = marginX + colW + gap;
  drawRoundedCard(ctx, rightX, row1Y, colW, row1H, 12, '#0f172a', '#1e293b');
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rightX, row1Y, colW, row1H, 12);
  ctx.clip();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(rightX, row1Y, colW, cardHeaderH);
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(rightX, row1Y + cardHeaderH);
  ctx.lineTo(rightX + colW, row1Y + cardHeaderH);
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = `bold 13px ${family}`;
  ctx.fillText('GT - KL', rightX + 16, row1Y + 21);

  // Đường chia đôi cột GT và KL
  const midGtKlX = rightX + colW * 0.54;
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.85)';
  ctx.beginPath();
  ctx.moveTo(midGtKlX, row1Y + cardHeaderH + 6);
  ctx.lineTo(midGtKlX, row1Y + row1H - 8);
  ctx.stroke();

  const givenList = Array.isArray(lesson?.given) ? lesson.given : [];
  const proveList = Array.isArray(lesson?.prove) ? lesson.prove : [];
  const gtFontSize = givenList.length >= 4 || proveList.length >= 3 ? 12.5 : 13.5;

  // Cột Giả thiết (GT)
  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 13px ${family}`;
  ctx.fillText('Giả thiết (GT):', rightX + 16, row1Y + cardHeaderH + 18);

  let gtY = row1Y + cardHeaderH + 24;
  const gtMaxW = midGtKlX - rightX - 34;
  for (const item of givenList) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `bold 13px ${family}`;
    ctx.fillText('•', rightX + 18, gtY + gtFontSize * 0.85);
    const lines = layoutMathLines(ctx, item, gtMaxW, gtFontSize, '400');
    const usedH = drawLaidOutMathLines(ctx, lines, rightX + 30, gtY, gtFontSize, '#e2e8f0', '400');
    gtY += usedH + 2;
  }

  // Cột Kết luận (KL)
  ctx.fillStyle = '#34d399';
  ctx.font = `bold 13px ${family}`;
  ctx.fillText('Kết luận (KL):', midGtKlX + 14, row1Y + cardHeaderH + 18);

  let klY = row1Y + cardHeaderH + 24;
  const klMaxW = rightX + colW - midGtKlX - 32;
  for (const item of proveList) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `bold 13px ${family}`;
    ctx.fillText('•', midGtKlX + 16, klY + gtFontSize * 0.85);
    const lines = layoutMathLines(ctx, item, klMaxW, gtFontSize, '400');
    const usedH = drawLaidOutMathLines(ctx, lines, midGtKlX + 28, klY, gtFontSize, '#e2e8f0', '400');
    klY += usedH + 2;
  }
  ctx.restore();

  // ============================================================================
  // HÀNG 2: [ Ô 3: HÌNH VẼ ]  |  [ Ô 4: LỜI GIẢI CHI TIẾT ]  (y: 246..806, h: 560)
  // ============================================================================
  const row2Y = 246;
  const row2H = 560;

  // --- Ô 3: HÌNH VẼ ---
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(leftX, row2Y, colW, row2H, 12);
  ctx.clip();
  ctx.translate(leftX, row2Y);

  renderGeometryScene(ctx, colW, row2H, {
    geometry: lesson?.geometry,
    mode,
    activeDrawStep: drawIdx,
    activeSolveStep: solveIdx,
    activeStepConfig: activeCfg,
    drawProgress: drawProg,
    zoom: 1,
    showGrid: true,
    showLabels: true,
    padTop: 62,
    padBottom: 20,
    padX: 28
  });

  // Thẻ trạng thái bước dựng hình góc trên bên trái (y hệt GeometryCanvas.jsx)
  const badgeTitle =
    mode === 'solve' ? 'HOÀN TẤT HÌNH VẼ' : `BƯỚC DỰNG HÌNH ${drawIdx + 1}`;
  const badgeSub =
    mode === 'solve'
      ? 'Hình vẽ hoàn thiện.'
      : activeCfg?.caption || 'Đang dựng hình...';

  ctx.font = `12.5px ${family}`;
  const subMeasured = ctx.measureText(badgeSub).width;
  const pillW = Math.min(colW - 36, Math.max(210, subMeasured + 30));
  drawRoundedCard(ctx, 14, 14, pillW, 44, 9, 'rgba(15, 23, 42, 0.88)', 'rgba(51, 65, 85, 0.85)');

  ctx.fillStyle = '#34d399';
  ctx.font = `bold 11px ${family}`;
  ctx.fillText(badgeTitle, 26, 30);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = `12.5px ${family}`;
  ctx.fillText(truncateTextToWidth(ctx, badgeSub, pillW - 24), 26, 48);
  ctx.restore();

  drawRoundedCard(ctx, leftX, row2Y, colW, row2H, 12, null, '#1e293b');

  // --- Ô 4: LỜI GIẢI CHI TIẾT (Hiện từng bước đồng bộ lời thoại) ---
  drawRoundedCard(ctx, rightX, row2Y, colW, row2H, 12, '#0f172a', '#1e293b');
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rightX, row2Y, colW, row2H, 12);
  ctx.clip();

  const solHeaderH = 36;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(rightX, row2Y, colW, solHeaderH);
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(rightX, row2Y + solHeaderH);
  ctx.lineTo(rightX + colW, row2Y + solHeaderH);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 13.5px ${family}`;
  ctx.fillText('LỜI GIẢI CHI TIẾT', rightX + 16, row2Y + 23);

  const counterLabel = `${mode === 'solve' ? Math.max(0, solveIdx + 1) : 0} / ${totalSolve}`;
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 12.5px ${family}`;
  ctx.textAlign = 'right';
  ctx.fillText(counterLabel, rightX + colW - 18, row2Y + 23);
  ctx.textAlign = 'left';

  const visibleSteps =
    mode === 'solve' && solveIdx >= 0 ? solutionSteps.slice(0, solveIdx + 1) : [];

  const bodyTop = row2Y + solHeaderH + 10;
  const bodyBottom = row2Y + row2H - 10;
  const availSolH = bodyBottom - bodyTop;

  if (visibleSteps.length === 0) {
    // Khung thông báo khi đang ở giai đoạn dựng hình (y hệt web)
    drawRoundedCard(
      ctx,
      rightX + 16,
      bodyTop + 6,
      colW - 32,
      availSolH - 12,
      10,
      'rgba(15, 23, 42, 0.45)',
      '#1e293b'
    );
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 15px ${family}`;
    ctx.fillText(
      'Đang ở giai đoạn dựng hình từng bước',
      rightX + colW / 2,
      bodyTop + availSolH / 2 - 12
    );
    ctx.fillStyle = '#94a3b8';
    ctx.font = `13px ${family}`;
    ctx.fillText(
      'Lời giải chi tiết sẽ tự động xuất hiện đồng bộ ngay sau khi dựng xong hình.',
      rightX + colW / 2,
      bodyTop + availSolH / 2 + 14
    );
    ctx.textAlign = 'left';
  } else {
    const solFontSize = 15;
    const cardPadX = 14;
    const cardPadY = 9;
    const cardGap = 8;
    const cardW = colW - 32;

    const preparedCards = visibleSteps.map((st, idx) => {
      const isCurrent = idx === solveIdx;
      const weight = isCurrent ? '600' : '400';
      const subRows = expandSolutionRowsForCanvas(st.lineText);
      const laidRows = subRows.map((sr) => {
        const indentPx = sr.indent ? 24 : 0;
        const lines = layoutMathLines(
          ctx,
          sr.text,
          cardW - cardPadX * 2 - indentPx,
          solFontSize,
          weight
        );
        const h = lines.reduce((acc, l) => acc + l.height + 2, 0);
        return { lines, indentPx, height: h };
      });
      const contentH = laidRows.reduce((acc, r) => acc + r.height + 2, 0);
      const boxH = Math.max(36, contentH + cardPadY * 2 - 2);
      return { isCurrent, weight, laidRows, boxH };
    });

    const totalStackH = preparedCards.reduce(
      (acc, c, i) => acc + c.boxH + (i > 0 ? cardGap : 0),
      0
    );

    let scrollOffset = 0;
    if (totalStackH > availSolH) {
      scrollOffset = totalStackH - availSolH;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(rightX + 6, bodyTop, colW - 12, availSolH);
    ctx.clip();

    let curY = bodyTop - scrollOffset;
    preparedCards.forEach((card) => {
      drawRoundedCard(
        ctx,
        rightX + 16,
        curY,
        cardW,
        card.boxH,
        10,
        card.isCurrent ? 'rgba(6, 78, 59, 0.42)' : 'rgba(15, 23, 42, 0.65)',
        card.isCurrent ? 'rgba(16, 185, 129, 0.75)' : 'rgba(30, 41, 59, 0.6)'
      );

      let innerY = curY + cardPadY;
      card.laidRows.forEach((row) => {
        const used = drawLaidOutMathLines(
          ctx,
          row.lines,
          rightX + 16 + cardPadX + row.indentPx,
          innerY,
          solFontSize,
          card.isCurrent ? '#ffffff' : '#e2e8f0',
          card.weight
        );
        innerY += used + 2;
      });

      curY += card.boxH + cardGap;
    });

    ctx.restore();
  }

  ctx.restore();

  // ============================================================================
  // THANH LỜI THUYẾT MINH DƯỚI CÙNG (y: 818..886, height: 68)
  // ============================================================================
  const subY = 818;
  const subH = 68;
  drawRoundedCard(ctx, marginX, subY, W - marginX * 2, subH, 12, '#0f172a', '#1e293b');

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 13px ${family}`;
  ctx.fillText('LỜI THUYẾT MINH:', marginX + 18, subY + 26);

  const speechText =
    activeCfg?.voiceExplanation || activeCfg?.caption || activeCfg?.lineText || '';
  const speechLines = layoutMathLines(ctx, speechText, W - marginX * 2 - 195, 14.5, '400').slice(
    0,
    2
  );
  drawLaidOutMathLines(
    ctx,
    speechLines,
    marginX + 168,
    subY + 11,
    14.5,
    '#f1f5f9',
    '400'
  );
}

/**
 * Giải mã & chuyển đổi âm thanh (MP3/WAV) sang PCM 48kHz Stereo mượt mà
 * (Khắc phục hoàn toàn lỗi kẹt 98% do lệch tần số 24kHz của edge-tts)
 */
async function decodeAndResampleAudio(audioUrl) {
  if (!audioUrl) return null;
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error('Không tải được tệp âm thanh để ghép video.');
  const arrayBuf = await res.arrayBuffer();

  const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
  let decoded;
  try {
    decoded = await tempCtx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    await tempCtx.close().catch(() => {});
  }

  const targetRate = 48000;
  const targetChannels = 2;
  const totalFrames = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const offlineCtx = new OfflineAudioContext(targetChannels, totalFrames, targetRate);

  const src = offlineCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offlineCtx.destination);
  src.start(0);

  const rendered = await offlineCtx.startRendering();
  return {
    audioBuffer: rendered,
    durationSec: decoded.duration,
    sampleRate: targetRate,
    numberOfChannels: targetChannels
  };
}

/**
 * Chọn codec H.264 được phần cứng/trình duyệt hỗ trợ tốt nhất
 */
async function pickSupportedH264Codec(width, height, framerate) {
  const candidates = [
    'avc1.4d002a', // Main Profile Level 4.2 (1080p/900p)
    'avc1.42002a', // Baseline Profile Level 4.2
    'avc1.4d001f', // Main Profile Level 3.1
    'avc1.42001f', // Baseline Profile Level 3.1
    'avc1.64002a'  // High Profile Level 4.2
  ];

  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        framerate,
        bitrate: 3_500_000
      });
      if (support?.supported) return codec;
    } catch {
      // Thử codec tiếp theo
    }
  }
  return null;
}

/**
 * Xuất video .MP4 siêu tốc bằng WebCodecs (VideoEncoder + AudioEncoder) + mp4-muxer (FastStart)
 */
async function exportFastMp4WithWebCodecs({ lesson, audioUrl, onProgress, signal }) {
  const Mp4Muxer = await ensureMp4MuxerLoaded();
  if (!Mp4Muxer || typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') {
    return false;
  }

  const W = 1600;
  const H = 900;
  const FPS = 30;

  const h264Codec = await pickSupportedH264Codec(W, heightOrEven(H), FPS);
  if (!h264Codec) return false;

  onProgress?.(2);

  let decodedAudio = null;
  if (audioUrl) {
    try {
      decodedAudio = await decodeAndResampleAudio(audioUrl);
    } catch {
      decodedAudio = null;
    }
  }

  if (signal?.aborted) throw new Error('ABORTED');

  const drawingSteps = lesson?.drawingSteps || [];
  const solutionSteps = lesson?.solutionSteps || [];
  const totalSteps = Math.max(1, drawingSteps.length + solutionSteps.length);
  const totalDurationSec =
    decodedAudio && decodedAudio.durationSec > 0
      ? decodedAudio.durationSec
      : totalSteps * 2.5;

  const hasAudio = Boolean(decodedAudio);
  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({
    target,
    video: {
      codec: 'avc',
      width: W,
      height: H
    },
    audio: hasAudio
      ? {
          codec: 'aac',
          sampleRate: decodedAudio.sampleRate,
          numberOfChannels: decodedAudio.numberOfChannels
        }
      : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset'
  });

  let encoderError = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderError = err;
    }
  });

  videoEncoder.configure({
    codec: h264Codec,
    width: W,
    height: H,
    framerate: FPS,
    bitrate: 3_500_000,
    latencyMode: 'quality'
  });

  let audioEncoder = null;
  if (hasAudio) {
    const aacSupport = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate: decodedAudio.sampleRate,
      numberOfChannels: decodedAudio.numberOfChannels,
      bitrate: 128_000
    }).catch(() => ({ supported: false }));

    if (aacSupport?.supported) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (err) => {
          encoderError = err;
        }
      });
      audioEncoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: decodedAudio.sampleRate,
        numberOfChannels: decodedAudio.numberOfChannels,
        bitrate: 128_000
      });
    }
  }

  onProgress?.(6);

  // Mã hóa toàn bộ luồng âm thanh trước (mất < 0.2 giây)
  if (audioEncoder && decodedAudio) {
    const { audioBuffer, sampleRate, numberOfChannels } = decodedAudio;
    const totalSamples = audioBuffer.length;
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
    const chunkSamples = 1024;

    for (let offset = 0; offset < totalSamples; offset += chunkSamples) {
      if (signal?.aborted) throw new Error('ABORTED');
      if (encoderError) throw encoderError;

      const count = Math.min(chunkSamples, totalSamples - offset);
      const planar = new Float32Array(count * numberOfChannels);
      planar.set(ch0.subarray(offset, offset + count), 0);
      if (numberOfChannels > 1) {
        planar.set(ch1.subarray(offset, offset + count), count);
      }

      const timestampUs = Math.round((offset / sampleRate) * 1_000_000);
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: count,
        numberOfChannels,
        timestamp: timestampUs,
        data: planar
      });
      audioEncoder.encode(audioData);
      audioData.close();

      if (audioEncoder.encodeQueueSize > 24) {
        await audioEncoder.flush();
      }
    }

    await audioEncoder.flush();
    audioEncoder.close();
  }

  onProgress?.(10);

  // Kết xuất khung hình video nhanh tối đa (không phải chờ 1x theo thời gian thực)
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const totalFrames = Math.max(1, Math.ceil(totalDurationSec * FPS));
  const frameDurationUs = Math.round(1_000_000 / FPS);

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    if (signal?.aborted) {
      try {
        videoEncoder.close();
      } catch {}
      throw new Error('ABORTED');
    }
    if (encoderError) throw encoderError;

    const elapsedSec = Math.min(totalDurationSec, frameIdx / FPS);
    renderFullLectureFrame(ctx, W, H, lesson, elapsedSec, totalDurationSec);

    const timestampUs = frameIdx * frameDurationUs;
    const vf = new VideoFrame(canvas, {
      timestamp: timestampUs,
      duration: frameDurationUs
    });

    // Chèn keyframe mỗi 1 giây (30 khung hình) để tua video cực nhạy trên mọi trình phát
    const isKeyFrame = frameIdx % FPS === 0;
    videoEncoder.encode(vf, { keyFrame: isKeyFrame });
    vf.close();

    // Điều tiết hàng đợi encoder & cập nhật tiến trình mượt mà
    if (videoEncoder.encodeQueueSize > 12) {
      await videoEncoder.flush();
    }

    if (frameIdx % 4 === 0 || frameIdx === totalFrames - 1) {
      const pct = 10 + Math.round(((frameIdx + 1) / totalFrames) * 86);
      onProgress?.(Math.min(96, pct));
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress?.(97);
  await videoEncoder.flush();
  videoEncoder.close();

  if (encoderError) throw encoderError;

  onProgress?.(99);
  muxer.finalize();

  const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(mp4Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugifyVietnamese(lesson?.title || 'bai-giang-hinh-hoc')}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  onProgress?.(100);
  return true;
}

function heightOrEven(h) {
  return h % 2 === 0 ? h : h - 1;
}

/**
 * Phương án dự phòng bằng MediaRecorder nếu trình duyệt cũ không hỗ trợ WebCodecs
 */
async function exportWithMediaRecorderFallback({ lesson, audioUrl, onProgress, signal }) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error(
      'Trình duyệt của thầy chưa hỗ trợ xuất video. Hãy dùng Google Chrome hoặc Microsoft Edge phiên bản mới.'
    );
  }

  const W = 1600;
  const H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const drawingSteps = lesson?.drawingSteps || [];
  const solutionSteps = lesson?.solutionSteps || [];
  const totalSteps = Math.max(1, drawingSteps.length + solutionSteps.length);

  let audioCtx = null;
  let audioEl = null;
  const mixedStream = canvas.captureStream(30);

  if (audioUrl) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioEl = new Audio();
      audioEl.crossOrigin = 'anonymous';
      audioEl.src = audioUrl;
      await new Promise((resolve, reject) => {
        audioEl.onloadedmetadata = () => resolve();
        audioEl.onerror = () => reject(new Error('Không nạp được âm thanh.'));
      });
      const source = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
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
    ? new MediaRecorder(mixedStream, { mimeType: selectedMime, videoBitsPerSecond: 3_500_000 })
    : new MediaRecorder(mixedStream);

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const totalDurationSec =
    audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0
      ? audioEl.duration
      : totalSteps * 2.5;

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
      const blob = new Blob(chunks, { type: selectedMime || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugifyVietnamese(lesson?.title || 'bai-giang-hinh-hoc')}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      resolve();
    };

    recorder.start(250);
    if (audioEl) {
      audioEl.play().catch(() => {});
    }

    const tick = () => {
      if (stopped) return;
      const elapsedSec = audioEl
        ? audioEl.currentTime
        : (performance.now() - startTimeMs) / 1000;

      renderFullLectureFrame(ctx, W, H, lesson, elapsedSec, totalDurationSec);
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

export async function exportLectureVideo({ lesson, audioUrl, onProgress, signal }) {
  try {
    const fastOk = await exportFastMp4WithWebCodecs({
      lesson,
      audioUrl,
      onProgress,
      signal
    });
    if (fastOk) return;
  } catch (err) {
    if (err?.message === 'ABORTED') throw err;
    // Nếu WebCodecs gặp lỗi phần cứng, tự chuyển sang phương án dự phòng
  }

  await exportWithMediaRecorderFallback({
    lesson,
    audioUrl,
    onProgress,
    signal
  });
}
