import { renderGeometryScene } from '../components/GeometryCanvas.jsx';

function pickSupportedVideoMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function sanitizeFilename(title) {
  return (
    (title || 'bai-giang-hinh-hoc')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'bai-giang-hinh-hoc'
  );
}

function wrapTextLines(ctx, text, maxWidth) {
  const rawParagraphs = String(text || '').split('\n');
  const lines = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      const testLine = current ? `${current} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        current = testLine;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawRoundedPanel(ctx, x, y, w, h, r, fill, stroke, lineWidth = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Vẽ một khung hình video hoàn chỉnh 1280x720 gồm:
 * - Thanh tiêu đề bài học
 * - Khung hình vẽ hình học (trái)
 * - Khung Đề bài + GT/KL + Danh sách các bước tự cuộn (phải)
 * - Dải phụ đề lời dẫn phía dưới cùng
 */
function renderCompositeVideoFrame(ctx, W, H, state) {
  const {
    problem,
    mode,
    currentStepIndex,
    stepProgress,
    showGrid,
    showTools,
    overallProgress = 0
  } = state;

  // Nền tổng thể
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, W, H);

  // 1. Thanh tiêu đề trên cùng (y: 0 -> 46)
  ctx.fillStyle = '#070d19';
  ctx.fillRect(0, 0, W, 46);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.lineTo(W, 46);
  ctx.stroke();

  // Badge khối lớp
  drawRoundedPanel(ctx, 16, 10, 74, 26, 8, 'rgba(14, 165, 233, 0.2)', 'rgba(56, 189, 248, 0.5)');
  ctx.font = 'bold 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(problem.grade || 'Toán THCS', 53, 23);

  // Tên bài học
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  const titleText = problem.title || 'Bài giảng hình học trực quan';
  ctx.fillText(titleText, 102, 23);

  // Nhãn trạng thái bên phải tiêu đề
  const phaseLabel = mode === 'drawing' ? 'PHẦN 1: CÁC BƯỚC VẼ HÌNH' : 'PHẦN 2: LỜI GIẢI CHI TIẾT';
  const phaseBg = mode === 'drawing' ? 'rgba(14, 165, 233, 0.18)' : 'rgba(16, 185, 129, 0.18)';
  const phaseStroke = mode === 'drawing' ? 'rgba(56, 189, 248, 0.5)' : 'rgba(52, 211, 153, 0.5)';
  const phaseColor = mode === 'drawing' ? '#7dd3fc' : '#6ee7b7';
  drawRoundedPanel(ctx, W - 236, 10, 220, 26, 8, phaseBg, phaseStroke);
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = phaseColor;
  ctx.textAlign = 'center';
  ctx.fillText(phaseLabel, W - 126, 23);

  // Bố cục 2 cột chính: y = 56 -> 634 (cao 578px)
  const topY = 56;
  const mainH = 578;
  const leftX = 16;
  const leftW = 736;
  const rightX = 764;
  const rightW = 500;

  // 2. CỘT TRÁI: Khung hình vẽ hình học
  drawRoundedPanel(ctx, leftX, topY, leftW, mainH, 16, '#090f1d', '#1e293b', 1.2);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(leftX, topY, leftW, mainH, 16);
  ctx.clip();
  ctx.translate(leftX, topY);
  renderGeometryScene(ctx, leftW, mainH, {
    problem,
    mode,
    currentStepIndex,
    stepProgress,
    showGrid,
    showTools,
    showFullFigure: false,
    zoom: 1,
    autoFit: true
  });
  ctx.restore();

  // 3. CỘT PHẢI: Đề bài + GT/KL (trên) & Danh sách các bước tự cuộn (dưới)
  const pad = 12;
  const innerW = rightW - pad * 2;

  // Tính toán chiều cao khối Đề bài & GT-KL
  ctx.font = '13px Inter, system-ui, sans-serif';
  const probLines = wrapTextLines(ctx, problem.problemText || '', innerW).slice(0, 6);
  const givenList = (problem.given || []).slice(0, 4);
  const proveList = (problem.prove || []).slice(0, 4);
  const gtklRows = Math.max(givenList.length, proveList.length, 1);

  const probTextH = probLines.length * 18;
  const gtklBoxH = 26 + gtklRows * 17;
  const problemCardH = 32 + probTextH + 10 + gtklBoxH + 10;

  drawRoundedPanel(ctx, rightX, topY, rightW, problemCardH, 14, '#0f172a', '#1e293b', 1.1);

  // Tiêu đề Đề bài
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`ĐỀ BÀI (${(problem.grade || '').toUpperCase()})`, rightX + pad, topY + 10);

  if (problem.topic) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(problem.topic, rightX + rightW - pad, topY + 10);
  }

  // Nội dung đề bài
  ctx.textAlign = 'left';
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#f1f5f9';
  let curY = topY + 28;
  for (const line of probLines) {
    ctx.fillText(line, rightX + pad, curY);
    curY += 18;
  }

  // Hai ô GT - KL
  curY += 6;
  const halfW = (innerW - 8) / 2;
  drawRoundedPanel(ctx, rightX + pad, curY, halfW, gtklBoxH, 10, '#070d19', '#1e293b');
  drawRoundedPanel(ctx, rightX + pad + halfW + 8, curY, halfW, gtklBoxH, 10, '#070d19', '#1e293b');

  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('GT', rightX + pad + 8, curY + 7);
  ctx.fillStyle = '#34d399';
  ctx.fillText('KL', rightX + pad + halfW + 16, curY + 7);

  ctx.font = '11.5px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  givenList.forEach((g, idx) => {
    const line = wrapTextLines(ctx, `• ${g}`, halfW - 14)[0] || '';
    ctx.fillText(line, rightX + pad + 8, curY + 23 + idx * 17);
  });
  proveList.forEach((p, idx) => {
    const line = wrapTextLines(ctx, `• ${p}`, halfW - 14)[0] || '';
    ctx.fillText(line, rightX + pad + halfW + 16, curY + 23 + idx * 17);
  });

  // Thanh tab Vẽ hình / Lời giải
  const tabY = topY + problemCardH + 8;
  const tabH = 30;
  const drawStepsCount = problem.drawingSteps?.length || 0;
  const solveStepsCount = problem.solutionSteps?.length || 0;

  drawRoundedPanel(ctx, rightX, tabY, rightW, tabH, 10, '#0f172a', '#1e293b');
  const tabBtnW = (rightW - 10) / 2;

  if (mode === 'drawing') {
    drawRoundedPanel(ctx, rightX + 3, tabY + 3, tabBtnW, tabH - 6, 7, '#0ea5e9', null);
  } else {
    drawRoundedPanel(ctx, rightX + 7 + tabBtnW, tabY + 3, tabBtnW, tabH - 6, 7, '#10b981', null);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = mode === 'drawing' ? '#082f49' : '#94a3b8';
  ctx.fillText(`Các bước vẽ hình (${drawStepsCount})`, rightX + 3 + tabBtnW / 2, tabY + tabH / 2);

  ctx.fillStyle = mode === 'solving' ? '#022c22' : '#94a3b8';
  ctx.fillText(
    `Lời giải chi tiết (${solveStepsCount})`,
    rightX + 7 + tabBtnW + tabBtnW / 2,
    tabY + tabH / 2
  );

  // Khung danh sách các bước (tự động cuộn theo bước đang giảng)
  const listY = tabY + tabH + 8;
  const listH = topY + mainH - listY;
  drawRoundedPanel(ctx, rightX, listY, rightW, listH, 14, '#0f172a', '#1e293b', 1.1);

  const steps = mode === 'drawing' ? problem.drawingSteps || [] : problem.solutionSteps || [];
  ctx.font = '13px Inter, system-ui, sans-serif';
  const cardInnerW = rightW - 36;

  // Đo chiều cao từng thẻ bước để tính vị trí cuộn chính xác
  const cards = steps.map((st, idx) => {
    const rawText =
      mode === 'drawing' ? `Bước ${idx + 1}: ${st.caption || ''}` : st.lineText || '';
    const lines = wrapTextLines(ctx, rawText, cardInnerW);
    const cardH = Math.max(36, lines.length * 18 + 16);
    return { idx, lines, cardH };
  });

  let totalCardsH = 10;
  let activeOffsetY = 10;
  cards.forEach((c) => {
    if (c.idx === currentStepIndex) {
      activeOffsetY = totalCardsH;
    }
    totalCardsH += c.cardH + 7;
  });

  // Giữ thẻ đang giảng nằm ở vùng 1/3 phía trên của khung danh sách
  const maxScroll = Math.max(0, totalCardsH - listH + 10);
  const desiredScroll = Math.max(0, Math.min(maxScroll, activeOffsetY - listH * 0.25));

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rightX + 2, listY + 2, rightW - 4, listH - 4, 12);
  ctx.clip();

  let itemY = listY + 10 - desiredScroll;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  cards.forEach((c) => {
    const isActive = c.idx === currentStepIndex;
    if (itemY + c.cardH >= listY && itemY <= listY + listH) {
      const fill = isActive
        ? mode === 'drawing'
          ? 'rgba(12, 74, 110, 0.65)'
          : 'rgba(6, 78, 59, 0.65)'
        : 'rgba(7, 13, 25, 0.85)';
      const stroke = isActive
        ? mode === 'drawing'
          ? 'rgba(56, 189, 248, 0.8)'
          : 'rgba(52, 211, 153, 0.8)'
        : '#1e293b';

      drawRoundedPanel(ctx, rightX + 10, itemY, rightW - 20, c.cardH, 10, fill, stroke, isActive ? 1.5 : 1);

      ctx.font = isActive ? '600 13px Inter, system-ui, sans-serif' : '13px Inter, system-ui, sans-serif';
      ctx.fillStyle = isActive ? '#f8fafc' : '#cbd5e1';
      c.lines.forEach((ln, lIdx) => {
        ctx.fillText(ln, rightX + 18, itemY + 8 + lIdx * 18);
      });
    }
    itemY += c.cardH + 7;
  });

  ctx.restore();

  // 4. DẢI PHỤ ĐỀ LỜI DẪN PHÍA DƯỚI CÙNG (y: 644 -> 708)
  const footerY = 644;
  const footerH = 64;
  drawRoundedPanel(ctx, 16, footerY, W - 32, footerH, 12, '#070d19', '#1e293b', 1.1);

  const badgeText =
    mode === 'drawing'
      ? `Vẽ ${currentStepIndex + 1}/${drawStepsCount}`
      : `Giải ${currentStepIndex + 1}/${solveStepsCount}`;
  const badgeFill = mode === 'drawing' ? 'rgba(14, 165, 233, 0.22)' : 'rgba(16, 185, 129, 0.22)';
  const badgeColor = mode === 'drawing' ? '#38bdf8' : '#34d399';

  drawRoundedPanel(ctx, 28, footerY + 16, 86, 28, 7, badgeFill, null);
  ctx.font = 'bold 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = badgeColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, 71, footerY + 30);

  // Lời dẫn hiện tại (tự xuống dòng tối đa 2 dòng để không bị cắt chữ)
  const activeStepObj =
    mode === 'drawing'
      ? problem.drawingSteps?.[currentStepIndex]
      : problem.solutionSteps?.[currentStepIndex];
  const narration =
    mode === 'drawing'
      ? activeStepObj?.voiceExplanation || activeStepObj?.caption || ''
      : activeStepObj?.voiceExplanation || activeStepObj?.lineText || '';

  ctx.font = '500 15px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const subLines = wrapTextLines(ctx, narration, W - 156).slice(0, 2);
  if (subLines.length === 1) {
    ctx.fillText(subLines[0], 126, footerY + 21);
  } else if (subLines.length >= 2) {
    ctx.fillText(subLines[0], 126, footerY + 11);
    ctx.fillText(subLines[1], 126, footerY + 32);
  }

  // Thanh tiến trình mảnh dưới đáy footer
  const barW = (W - 56) * Math.max(0, Math.min(1, overallProgress));
  if (barW > 0) {
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(28, footerY + footerH - 4, barW, 3);
  }
}

/**
 * Kết xuất toàn bộ bài giảng thành tệp video MP4 có âm thanh và tự động tải về máy.
 */
export async function exportLessonToMp4({
  problem,
  unifiedAudioConfig,
  showGrid = true,
  showTools = true,
  onProgress,
  cancelSignal
}) {
  if (!problem) {
    throw new Error('Chưa có bài học nào để xuất video.');
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Trình duyệt của thầy chưa hỗ trợ ghi video trực tiếp.');
  }

  const W = 1280;
  const H = 720;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = W;
  exportCanvas.height = H;
  const ctx = exportCanvas.getContext('2d');

  const totalDrawingSteps = problem.drawingSteps?.length || 0;
  const totalSolutionSteps = problem.solutionSteps?.length || 0;
  const totalSteps = totalDrawingSteps + totalSolutionSteps;
  if (totalSteps === 0) {
    throw new Error('Bài học chưa có các bước vẽ hình hoặc lời giải.');
  }

  const mimeType = pickSupportedVideoMimeType();
  const isMp4 = mimeType.includes('mp4');
  const ext = isMp4 ? 'mp4' : 'webm';

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  const audioDest = audioCtx.createMediaStreamDestination();

  // Bộ dao động siêu nhỏ giữ luồng âm thanh luôn thông suốt
  const keepAliveOsc = audioCtx.createOscillator();
  const keepAliveGain = audioCtx.createGain();
  keepAliveGain.gain.value = 0.00001;
  keepAliveOsc.connect(keepAliveGain);
  keepAliveGain.connect(audioDest);
  keepAliveOsc.start();

  const canvasStream = exportCanvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks()
  ]);

  const chunks = [];
  const recorder = mimeType
    ? new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 4_500_000 })
    : new MediaRecorder(combinedStream, { videoBitsPerSecond: 4_500_000 });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  let rafId = null;
  let activeAudioEl = null;

  const cleanup = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (activeAudioEl) {
      activeAudioEl.pause();
      activeAudioEl.src = '';
    }
    try {
      keepAliveOsc.stop();
      audioCtx.close();
    } catch {
      // ignore
    }
  };

  try {
    // TRƯỜNG HỢP 1: Bài học có 1 file âm thanh thống nhất + bảng mốc thời gian
    if (unifiedAudioConfig?.src && Array.isArray(unifiedAudioConfig.timeline)) {
      const audioEl = new Audio();
      audioEl.crossOrigin = 'anonymous';
      audioEl.preload = 'auto';
      audioEl.src = unifiedAudioConfig.src;
      activeAudioEl = audioEl;

      await new Promise((resolve, reject) => {
        audioEl.onloadedmetadata = () => resolve();
        audioEl.onerror = () => reject(new Error('Không thể tải tệp âm thanh để ghép video.'));
        audioEl.load();
      });

      const sourceNode = audioCtx.createMediaElementSource(audioEl);
      sourceNode.connect(audioDest);

      const timeline = unifiedAudioConfig.timeline;
      const totalDur =
        (Number.isFinite(audioEl.duration) && audioEl.duration > 0
          ? audioEl.duration
          : timeline[timeline.length - 1]?.endSec) || 10;

      // Vẽ khung hình đầu tiên trước khi bấm ghi
      renderCompositeVideoFrame(ctx, W, H, {
        problem,
        mode: 'drawing',
        currentStepIndex: 0,
        stepProgress: 0,
        showGrid,
        showTools,
        overallProgress: 0
      });

      recorder.start(250);
      await audioEl.play();

      await new Promise((resolve, reject) => {
        const tick = () => {
          if (cancelSignal?.aborted) {
            reject(new Error('CANCELLED'));
            return;
          }

          const t = audioEl.currentTime;
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

          let mode = 'drawing';
          let stepIdx = 0;
          let stepProg = 1;

          if (activeCue) {
            const gIdx = activeCue.stepIndex;
            if (gIdx < totalDrawingSteps) {
              mode = 'drawing';
              stepIdx = gIdx;
            } else {
              mode = 'solving';
              stepIdx = Math.min(totalSolutionSteps - 1, gIdx - totalDrawingSteps);
            }
            const span = Math.max(0.15, activeCue.endSec - activeCue.startSec);
            stepProg = Math.min(1, Math.max(0, (t - activeCue.startSec) / (span * 0.88)));
          }

          const overall = Math.min(1, t / totalDur);
          renderCompositeVideoFrame(ctx, W, H, {
            problem,
            mode,
            currentStepIndex: stepIdx,
            stepProgress: stepProg,
            showGrid,
            showTools,
            overallProgress: overall
          });

          if (onProgress) {
            onProgress({
              percent: Math.round(overall * 100),
              currentSec: t,
              totalSec: totalDur
            });
          }

          if (audioEl.ended || t >= totalDur) {
            // Vẽ thêm khung kết thúc hoàn chỉnh
            renderCompositeVideoFrame(ctx, W, H, {
              problem,
              mode: totalSolutionSteps > 0 ? 'solving' : 'drawing',
              currentStepIndex:
                totalSolutionSteps > 0 ? totalSolutionSteps - 1 : totalDrawingSteps - 1,
              stepProgress: 1,
              showGrid,
              showTools,
              overallProgress: 1
            });
            setTimeout(resolve, 350);
            return;
          }

          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
      });
    } else {
      // TRƯỜNG HỢP 2: Bài cũ từng tệp step_X.mp3 hoặc bài chưa có âm thanh
      recorder.start(250);

      for (let gIdx = 0; gIdx < totalSteps; gIdx++) {
        if (cancelSignal?.aborted) {
          throw new Error('CANCELLED');
        }

        const mode = gIdx < totalDrawingSteps ? 'drawing' : 'solving';
        const stepIdx = mode === 'drawing' ? gIdx : gIdx - totalDrawingSteps;

        let stepAudioUrl = null;
        if (problem.hasStaticAudio && problem.audioBasePath) {
          const manifestItem = problem.audioManifest?.find((m) => m.stepIndex === gIdx);
          const fileName = manifestItem?.file || `step_${gIdx}.mp3`;
          stepAudioUrl = `${problem.audioBasePath}/${fileName}`;
        }

        await new Promise((resolve) => {
          const fallbackMs = mode === 'drawing' ? 2400 : 3000;
          let stepAudio = null;

          if (stepAudioUrl) {
            stepAudio = new Audio();
            stepAudio.crossOrigin = 'anonymous';
            stepAudio.src = stepAudioUrl;
            activeAudioEl = stepAudio;
            try {
              const node = audioCtx.createMediaElementSource(stepAudio);
              node.connect(audioDest);
            } catch {
              // ignore
            }
          }

          const startTime = performance.now();
          let audioFinished = !stepAudio;
          let expectedMs = fallbackMs;

          if (stepAudio) {
            stepAudio.onloadedmetadata = () => {
              if (Number.isFinite(stepAudio.duration) && stepAudio.duration > 0) {
                expectedMs = stepAudio.duration * 1000;
              }
            };
            stepAudio.onended = () => {
              audioFinished = true;
            };
            stepAudio.onerror = () => {
              audioFinished = true;
            };
            stepAudio.play().catch(() => {
              audioFinished = true;
            });
          }

          const stepLoop = (now) => {
            if (cancelSignal?.aborted) {
              resolve();
              return;
            }
            const elapsed = now - startTime;
            const p = Math.min(1, elapsed / Math.max(400, expectedMs * 0.88));
            const overall = (gIdx + Math.min(1, elapsed / expectedMs)) / totalSteps;

            renderCompositeVideoFrame(ctx, W, H, {
              problem,
              mode,
              currentStepIndex: stepIdx,
              stepProgress: p,
              showGrid,
              showTools,
              overallProgress: overall
            });

            if (onProgress) {
              onProgress({
                percent: Math.min(99, Math.round(overall * 100)),
                currentSec: 0,
                totalSec: 0
              });
            }

            if ((stepAudio && audioFinished) || (!stepAudio && elapsed >= fallbackMs)) {
              setTimeout(resolve, 150);
              return;
            }
            rafId = requestAnimationFrame(stepLoop);
          };

          rafId = requestAnimationFrame(stepLoop);
        });
      }
    }

    if (cancelSignal?.aborted) {
      throw new Error('CANCELLED');
    }

    // Dừng ghi hình và tải tệp xuống
    const blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType || 'video/mp4' }));
      };
      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        resolve(new Blob(chunks, { type: mimeType || 'video/mp4' }));
      }
    });

    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${sanitizeFilename(problem.title)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

    return { ext, isMp4 };
  } finally {
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    cleanup();
  }
}
