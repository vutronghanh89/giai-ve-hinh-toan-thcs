import React, { useEffect, useRef } from 'react';

const COLOR_MAP = {
  main: '#e2e8f0',
  accent: '#38bdf8',
  emerald: '#34d399',
  red: '#fb7185'
};

const POLYGON_FILL_MAP = {
  blue: 'rgba(56, 189, 248, 0.14)',
  amber: 'rgba(251, 191, 36, 0.15)',
  emerald: 'rgba(52, 211, 153, 0.16)'
};

function drawRulerTool(ctx, x1, y1, x2, y2, progress) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 5) return;

  const angle = Math.atan2(dy, dx);
  const rulerLen = Math.max(dist + 40, 140);
  const rulerH = 26;

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  // Thân thước nhựa trong suốt màu vàng nhạt
  ctx.fillStyle = 'rgba(253, 224, 71, 0.22)';
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-16, 4, rulerLen, rulerH, 4);
  ctx.fill();
  ctx.stroke();

  // Vạch chia milimet / centimet
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= rulerLen - 24; x += 8) {
    const isCm = x % 40 === 0;
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, 4 + (isCm ? 10 : 5));
    ctx.stroke();
  }

  // Đầu bút chì chạy dọc mép thước theo progress
  const penX = dist * progress;
  ctx.translate(penX, 0);
  ctx.rotate(-0.45);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, -28, 7, 22);
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(7, -6);
  ctx.lineTo(3.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(3.5, -1, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCompassTool(ctx, cx, cy, px, py) {
  const dx = px - cx;
  const dy = py - cy;
  const r = Math.hypot(dx, dy);
  if (r < 4) return;

  const midX = (cx + px) / 2;
  const midY = (cy + py) / 2;
  const perpX = -dy / r;
  const perpY = dx / r;
  const apexX = midX + perpX * Math.max(70, r * 0.75);
  const apexY = midY + perpY * Math.max(70, r * 0.75);

  ctx.save();
  // Tay cầm đỉnh compa
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(apexX + perpX * 16, apexY + perpY * 16);
  ctx.stroke();

  // Hai chân compa sáng bóng
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  ctx.strokeStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(px, py);
  ctx.stroke();

  // Khớp xoay
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(apexX, apexY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Kim nhọn tại tâm
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawTickMarks(ctx, x1, y1, x2, y2, ticks, color) {
  if (!ticks || ticks <= 0) return;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 10) return;

  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const spacing = 4.5;
  const halfTick = 5.5;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  const startOffset = -((ticks - 1) * spacing) / 2;

  for (let i = 0; i < ticks; i++) {
    const offset = startOffset + i * spacing;
    const bx = mx + ux * offset;
    const by = my + uy * offset;
    ctx.beginPath();
    ctx.moveTo(bx - nx * halfTick, by - ny * halfTick);
    ctx.lineTo(bx + nx * halfTick, by + ny * halfTick);
    ctx.stroke();
  }
  ctx.restore();
}

export default function GeometryCanvas({
  problem,
  mode, // 'drawing' | 'solving'
  currentStepIndex,
  stepProgress, // 0..1
  showGrid,
  showTools,
  showFullFigure,
  zoom,
  onZoomChange
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !problem?.geometry) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Nền bảng tối hiện đại
    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, W, H);

    // Lưới tọa độ nhẹ
    if (showGrid) {
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.28)';
      ctx.lineWidth = 1;
      const step = 25 * zoom;
      const cx = W / 2;
      const cy = H / 2;
      for (let x = cx % step; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = cy % step; y < H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }

    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);

    const { points = [], segments = [], circles = [], rightAngles = [], angleArcs = [] } = problem.geometry;
    const pointMap = new Map(points.map((p) => [p.id, p]));

    const activeStepObj =
      mode === 'drawing'
        ? problem.drawingSteps?.[currentStepIndex]
        : problem.solutionSteps?.[currentStepIndex];

    const highlightSegSet = new Set(
      (activeStepObj?.highlightSegments || []).flatMap((s) => {
        const [a, b] = String(s).split('-');
        return [`${a}-${b}`, `${b}-${a}`];
      })
    );
    const highlightPtSet = new Set(activeStepObj?.highlightPoints || []);

    const effectiveDrawStep = showFullFigure || mode === 'solving' ? 999 : currentStepIndex;
    const effectiveProgress = showFullFigure || mode === 'solving' ? 1 : stepProgress;

    // 1. Tô màu đa giác nổi bật khi đang giảng lời giải
    if (mode === 'solving' && Array.isArray(activeStepObj?.highlightPolygons)) {
      activeStepObj.highlightPolygons.forEach((poly) => {
        const coords = (poly.points || []).map((id) => pointMap.get(id)).filter(Boolean);
        if (coords.length >= 3) {
          ctx.save();
          ctx.fillStyle = POLYGON_FILL_MAP[poly.color] || POLYGON_FILL_MAP.blue;
          ctx.beginPath();
          ctx.moveTo(coords[0].x, coords[0].y);
          for (let i = 1; i < coords.length; i++) {
            ctx.lineTo(coords[i].x, coords[i].y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      });
    }

    let activeToolRender = null;

    // 2. Vẽ đường tròn
    circles.forEach((circle) => {
      if (circle.drawStep > effectiveDrawStep) return;
      const center = pointMap.get(circle.center);
      if (!center) return;

      const isCurrent = mode === 'drawing' && !showFullFigure && circle.drawStep === currentStepIndex;
      const prog = isCurrent ? effectiveProgress : 1;
      const endAngle = -Math.PI / 2 + Math.PI * 2 * prog;

      ctx.save();
      ctx.strokeStyle = COLOR_MAP[circle.color] || COLOR_MAP.main;
      ctx.lineWidth = isCurrent ? 2.4 : 1.9;
      if (circle.style === 'dashed') ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, circle.radius, -Math.PI / 2, endAngle);
      ctx.stroke();
      ctx.restore();

      if (isCurrent && prog < 0.99 && showTools) {
        const px = center.x + Math.cos(endAngle) * circle.radius;
        const py = center.y + Math.sin(endAngle) * circle.radius;
        activeToolRender = () => drawCompassTool(ctx, center.x, center.y, px, py);
      }
    });

    // 3. Vẽ đoạn thẳng
    segments.forEach((seg) => {
      if (seg.drawStep > effectiveDrawStep) return;
      const p1 = pointMap.get(seg.from);
      const p2 = pointMap.get(seg.to);
      if (!p1 || !p2) return;

      const isCurrent = mode === 'drawing' && !showFullFigure && seg.drawStep === currentStepIndex;
      const prog = isCurrent ? effectiveProgress : 1;
      const curX = p1.x + (p2.x - p1.x) * prog;
      const curY = p1.y + (p2.y - p1.y) * prog;

      const isHighlighted = highlightSegSet.has(`${seg.from}-${seg.to}`);
      const baseColor = COLOR_MAP[seg.color] || COLOR_MAP.main;

      ctx.save();
      if (isHighlighted) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 2.1;
      }
      if (seg.style === 'dashed') ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(curX, curY);
      ctx.stroke();
      ctx.restore();

      // Ký hiệu đoạn bằng nhau
      const ticksVisibleStep = seg.ticksFromStep ?? seg.drawStep;
      if (seg.ticks > 0 && ticksVisibleStep <= effectiveDrawStep && prog > 0.85) {
        drawTickMarks(ctx, p1.x, p1.y, p2.x, p2.y, seg.ticks, isHighlighted ? '#38bdf8' : baseColor);
      }

      if (isCurrent && prog < 0.99 && showTools && !activeToolRender) {
        activeToolRender = () => drawRulerTool(ctx, p1.x, p1.y, p2.x, p2.y, prog);
      }
    });

    // 4. Ký hiệu góc vuông
    rightAngles.forEach((ra) => {
      const visible =
        showFullFigure ||
        (mode === 'drawing' && ra.drawStep <= currentStepIndex && ra.solveRevealStep === undefined) ||
        (mode === 'solving' &&
          (ra.solveRevealStep === undefined || ra.solveRevealStep <= currentStepIndex));
      if (!visible) return;

      const v = pointMap.get(ra.vertex);
      const p1 = pointMap.get(ra.p1);
      const p2 = pointMap.get(ra.p2);
      if (!v || !p1 || !p2) return;

      const d1 = Math.hypot(p1.x - v.x, p1.y - v.y);
      const d2 = Math.hypot(p2.x - v.x, p2.y - v.y);
      if (d1 < 5 || d2 < 5) return;

      const sz = 12;
      const u1x = ((p1.x - v.x) / d1) * sz;
      const u1y = ((p1.y - v.y) / d1) * sz;
      const u2x = ((p2.x - v.x) / d2) * sz;
      const u2y = ((p2.y - v.y) / d2) * sz;

      ctx.save();
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(v.x + u1x, v.y + u1y);
      ctx.lineTo(v.x + u1x + u2x, v.y + u1y + u2y);
      ctx.lineTo(v.x + u2x, v.y + u2y);
      ctx.stroke();
      ctx.restore();
    });

    // 5. Cung góc
    angleArcs.forEach((arc) => {
      const visible =
        showFullFigure ||
        (mode === 'drawing' && arc.drawStep <= currentStepIndex && arc.solveRevealStep === undefined) ||
        (mode === 'solving' &&
          (arc.solveRevealStep === undefined || arc.solveRevealStep <= currentStepIndex));
      if (!visible) return;

      const v = pointMap.get(arc.vertex);
      const p1 = pointMap.get(arc.p1);
      const p2 = pointMap.get(arc.p2);
      if (!v || !p1 || !p2) return;

      const a1 = Math.atan2(p1.y - v.y, p1.x - v.x);
      const a2 = Math.atan2(p2.y - v.y, p2.x - v.x);
      let diff = a2 - a1;
      while (diff <= -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      ctx.save();
      ctx.strokeStyle = COLOR_MAP[arc.color] || COLOR_MAP.accent;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.arc(v.x, v.y, arc.radius || 22, a1, a1 + diff, diff < 0);
      ctx.stroke();
      ctx.restore();
    });

    // 6. Vẽ các điểm & nhãn tên điểm
    points.forEach((pt) => {
      if (pt.drawStep > effectiveDrawStep) return;
      const isHighlighted = highlightPtSet.has(pt.id);

      ctx.save();
      if (isHighlighted) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isHighlighted ? '#38bdf8' : '#f8fafc';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isHighlighted ? 4.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = isHighlighted ? 'bold 15px Inter, system-ui, sans-serif' : '600 14px Inter, system-ui, sans-serif';
      ctx.fillStyle = isHighlighted ? '#7dd3fc' : '#f1f5f9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pt.label, pt.x + (pt.dx || 0), pt.y + (pt.dy || -14));
      ctx.restore();
    });

    // 7. Vẽ dụng cụ (thước / compa) nếu đang ở bước vẽ dở
    if (activeToolRender) {
      activeToolRender();
    }

    ctx.restore();
  }, [problem, mode, currentStepIndex, stepProgress, showGrid, showTools, showFullFigure, zoom]);

  return (
    <div className="relative w-full h-full min-h-[340px] bg-[#090f1d] rounded-2xl border border-slate-800 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-xl px-2 py-1 text-xs">
        <button
          onClick={() => onZoomChange(Math.max(0.65, +(zoom - 0.1).toFixed(2)))}
          className="px-1.5 py-0.5 text-slate-300 hover:text-white"
          title="Thu nhỏ"
        >
          -
        </button>
        <span className="text-slate-400 font-mono min-w-[38px] text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => onZoomChange(Math.min(1.6, +(zoom + 0.1).toFixed(2)))}
          className="px-1.5 py-0.5 text-slate-300 hover:text-white"
          title="Phóng to"
        >
          +
        </button>
      </div>
    </div>
  );
}
