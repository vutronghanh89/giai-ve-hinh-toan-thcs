/* ============================================================================
   BỘ ĐỒNG BỘ MỐC THỜI GIAN (AUDIO TIMELINE) DÙNG CHUNG CHO WEB & XUẤT VIDEO
   - Hỗ trợ cả bài có sẵn audioTimeline và bài chỉ có file âm thanh (tự chia tỷ lệ)
   - Giúp tua (seek) chính xác từng bước dựng hình & lời giải mà không bị nhảy về đầu
   ============================================================================ */

export function buildEffectiveTimeline(lesson, totalDurationSec) {
  const drawingSteps = Array.isArray(lesson?.drawingSteps) ? lesson.drawingSteps : [];
  const solutionSteps = Array.isArray(lesson?.solutionSteps) ? lesson.solutionSteps : [];
  const totalDraw = drawingSteps.length;
  const totalSolve = solutionSteps.length;
  const totalSteps = Math.max(1, totalDraw + totalSolve);

  const rawTimeline = Array.isArray(lesson?.audioTimeline) ? lesson.audioTimeline : [];
  const validDuration =
    Number.isFinite(totalDurationSec) && totalDurationSec > 0 ? totalDurationSec : 0;

  if (rawTimeline.length > 0) {
    const rawEnd = Number(rawTimeline[rawTimeline.length - 1]?.endSec) || 0;
    const scale =
      validDuration > 0 && rawEnd > 0 && Math.abs(validDuration - rawEnd) > 0.35
        ? validDuration / rawEnd
        : 1;

    return rawTimeline.map((item, idx) => {
      const startSec = Math.max(0, (Number(item.startSec) || 0) * scale);
      const nextStart =
        idx + 1 < rawTimeline.length
          ? Math.max(startSec + 0.05, (Number(rawTimeline[idx + 1].startSec) || 0) * scale)
          : validDuration > 0
          ? validDuration
          : Math.max(startSec + 0.2, (Number(item.endSec) || startSec + 2) * scale);
      return {
        stepIndex: typeof item.stepIndex === 'number' ? item.stepIndex : idx,
        startSec,
        endSec: nextStart
      };
    });
  }

  // Tự động ước lượng mốc thời gian theo độ dài lời thoại từng bước nếu chưa có audioTimeline
  const allSteps = [...drawingSteps, ...solutionSteps];
  const weights = allSteps.map((st) => {
    const txt = String(st?.voiceExplanation || st?.caption || st?.lineText || '').trim();
    return Math.max(12, txt.length);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0) || totalSteps;
  const effectiveDuration = validDuration > 0 ? validDuration : totalSteps * 2.5;

  let cursor = 0;
  return Array.from({ length: totalSteps }).map((_, idx) => {
    const w = weights[idx] || 1;
    const span = (w / totalWeight) * effectiveDuration;
    const startSec = cursor;
    const endSec = idx === totalSteps - 1 ? effectiveDuration : cursor + span;
    cursor = endSec;
    return {
      stepIndex: idx,
      startSec,
      endSec
    };
  });
}

export function resolveVisualStateAtTime(lesson, elapsedSec, totalDurationSec) {
  const drawingSteps = Array.isArray(lesson?.drawingSteps) ? lesson.drawingSteps : [];
  const solutionSteps = Array.isArray(lesson?.solutionSteps) ? lesson.solutionSteps : [];
  const totalDraw = drawingSteps.length;
  const totalSolve = solutionSteps.length;
  const totalSteps = Math.max(1, totalDraw + totalSolve);

  const timeline = buildEffectiveTimeline(lesson, totalDurationSec);
  const t = Math.max(0, Number(elapsedSec) || 0);

  let hit = timeline[0];
  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    if (t >= item.startSec && (t < item.endSec || i === timeline.length - 1)) {
      hit = item;
      break;
    }
  }

  const globalIdx = Math.max(
    0,
    Math.min(totalSteps - 1, hit ? Number(hit.stepIndex) || 0 : 0)
  );

  if (globalIdx < totalDraw) {
    const span = Math.max(0.2, (hit?.endSec || 2.4) - (hit?.startSec || 0));
    const localElapsed = Math.max(0, t - (hit?.startSec || 0));
    const drawProg = Math.min(1, Math.max(0.08, localElapsed / (span * 0.75)));
    return {
      mode: 'draw',
      drawIdx: globalIdx,
      solveIdx: -1,
      drawProg,
      globalIdx,
      timeline
    };
  }

  const solveIdx = Math.min(totalSolve - 1, Math.max(0, globalIdx - totalDraw));
  return {
    mode: totalSolve > 0 ? 'solve' : 'draw',
    drawIdx: Math.max(0, totalDraw - 1),
    solveIdx: totalSolve > 0 ? solveIdx : -1,
    drawProg: 1,
    globalIdx,
    timeline
  };
}
