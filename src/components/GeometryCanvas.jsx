import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Grid, Tag } from 'lucide-react';

const COLOR_MAP = {
  main: '#e2e8f0',
  accent: '#38bdf8',
  emerald: '#34d399',
  red: '#fb7185'
};

const POLY_FILL_MAP = {
  blue: 'rgba(56, 189, 248, 0.16)',
  amber: 'rgba(251, 191, 36, 0.18)',
  emerald: 'rgba(52, 211, 153, 0.18)'
};

const POLY_STROKE_MAP = {
  blue: 'rgba(56, 189, 248, 0.55)',
  amber: 'rgba(251, 191, 36, 0.6)',
  emerald: 'rgba(52, 211, 153, 0.6)'
};

function normalizeSegKey(from, to) {
  return [`${from}-${to}`, `${to}-${from}`];
}

function drawVirtualTool(ctx, tool, targetX, targetY, angleRad = 0) {
  if (!tool) return;
  ctx.save();
  ctx.translate(targetX, targetY);
  ctx.rotate(angleRad);

  if (tool === 'ruler') {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-75, 6, 150, 24, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.75)';
    ctx.lineWidth = 1;
    for (let x = -65; x <= 65; x += 10) {
      const h = x % 20 === 0 ? 8 : 5;
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.lineTo(x, 6 + h);
      ctx.stroke();
    }
  } else if (tool === 'eke') {
    ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(78, 0);
    ctx.lineTo(0, -78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14, -14);
    ctx.lineTo(44, -14);
    ctx.lineTo(14, -44);
    ctx.closePath();
    ctx.stroke();
  } else if (tool === 'protractor') {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
    ctx.strokeStyle = 'rgba(252, 211, 77, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 56, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let deg = 0; deg <= 180; deg += 15) {
      const r = (deg * Math.PI) / 180;
      const x1 = Math.cos(r) * 48;
      const y1 = -Math.sin(r) * 48;
      const x2 = Math.cos(r) * 56;
      const y2 = -Math.sin(r) * 56;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  } else if (tool === 'compass') {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-16, -64);
    ctx.lineTo(18, -10);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(-16, -68, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export default function GeometryCanvas({
  geometry,
  mode = 'draw',
  activeDrawStep = 0,
  activeSolveStep = -1,
  activeStepConfig = null,
  drawProgress = 1
}) {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, W, H);

    const baseScale = Math.min(W / 440, H / 340) * zoom;

    ctx.save();
    ctx.translate(W / 2, H / 2);

    if (showGrid) {
      const stepPx = 25 * baseScale;
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W / 2; x += stepPx) {
        ctx.beginPath();
        ctx.moveTo(x, -H / 2);
        ctx.lineTo(x, H / 2);
        ctx.stroke();
        if (x > 0) {
          ctx.beginPath();
          ctx.moveTo(-x, -H / 2);
          ctx.lineTo(-x, H / 2);
          ctx.stroke();
        }
      }
      for (let y = 0; y < H / 2; y += stepPx) {
        ctx.beginPath();
        ctx.moveTo(-W / 2, y);
        ctx.lineTo(W / 2, y);
        ctx.stroke();
        if (y > 0) {
          ctx.beginPath();
          ctx.moveTo(-W / 2, -y);
          ctx.lineTo(W / 2, -y);
          ctx.stroke();
        }
      }
    }

    ctx.scale(baseScale, baseScale);

    const points = Array.isArray(geometry?.points) ? geometry.points : [];
    const segments = Array.isArray(geometry?.segments) ? geometry.segments : [];
    const circles = Array.isArray(geometry?.circles) ? geometry.circles : [];
    const rightAngles = Array.isArray(geometry?.rightAngles) ? geometry.rightAngles : [];
    const angleArcs = Array.isArray(geometry?.angleArcs) ? geometry.angleArcs : [];

    const pointMap = new Map();
    points.forEach((p) => pointMap.set(p.id, p));

    const maxDrawStep = mode === 'solve' ? 9999 : activeDrawStep;

    const hlSegments = new Set();
    (activeStepConfig?.highlightSegments || []).forEach((s) => {
      const [a, b] = String(s).split('-');
      if (a && b) {
        normalizeSegKey(a.trim(), b.trim()).forEach((k) => hlSegments.add(k));
      }
    });
    const hlPoints = new Set((activeStepConfig?.highlightPoints || []).map(String));
    const hlPolygons = Array.isArray(activeStepConfig?.highlightPolygons)
      ? activeStepConfig.highlightPolygons
      : [];
    const hlAngles = Array.isArray(activeStepConfig?.highlightAngles)
      ? activeStepConfig.highlightAngles
      : [];
    const hlRightAngles = Array.isArray(activeStepConfig?.highlightRightAngles)
      ? activeStepConfig.highlightRightAngles
      : [];

    hlPolygons.forEach((poly) => {
      const pts = (poly.points || []).map((id) => pointMap.get(id)).filter(Boolean);
      if (pts.length >= 3) {
        ctx.save();
        ctx.fillStyle = POLY_FILL_MAP[poly.color] || POLY_FILL_MAP.blue;
        ctx.strokeStyle = POLY_STROKE_MAP[poly.color] || POLY_STROKE_MAP.blue;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    });

    let toolAnchor = null;

    circles.forEach((c) => {
      const dStep = Number(c.drawStep) || 0;
      if (dStep > maxDrawStep) return;
      if (typeof c.hideAtStep === 'number' && maxDrawStep >= c.hideAtStep) return;

      const center = pointMap.get(c.center);
      if (!center) return;

      const isCurrentStep = mode === 'draw' && dStep === activeDrawStep;
      const prog = isCurrentStep ? Math.max(0.05, Math.min(1, drawProgress)) : 1;
      const startAng = typeof c.startAngle === 'number' ? c.startAngle : 0;
      const fullEndAng = typeof c.endAngle === 'number' ? c.endAngle : Math.PI * 2;
      const currentEndAng = startAng + (fullEndAng - startAng) * prog;

      ctx.save();
      ctx.strokeStyle = COLOR_MAP[c.color] || COLOR_MAP.main;
      ctx.lineWidth = isCurrentStep ? 2.2 : 1.6;
      if (c.style === 'dashed') ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, c.radius, startAng, currentEndAng, false);
      ctx.stroke();
      ctx.restore();

      if (isCurrentStep) {
        toolAnchor = {
          x: center.x + Math.cos(currentEndAng) * c.radius,
          y: center.y + Math.sin(currentEndAng) * c.radius,
          angle: 0
        };
      }
    });

    segments.forEach((seg) => {
      const dStep = Number(seg.drawStep) || 0;
      if (dStep > maxDrawStep) return;
      if (typeof seg.hideAtStep === 'number' && maxDrawStep >= seg.hideAtStep) return;

      const p1 = pointMap.get(seg.from);
      const p2 = pointMap.get(seg.to);
      if (!p1 || !p2) return;

      const isCurrentStep = mode === 'draw' && dStep === activeDrawStep;
      const prog = isCurrentStep ? Math.max(0.05, Math.min(1, drawProgress)) : 1;
      const isHighlighted =
        hlSegments.has(`${seg.from}-${seg.to}`) || hlSegments.has(`${seg.to}-${seg.from}`);

      let x1 = p1.x;
      let y1 = p1.y;
      let x2 = p1.x + (p2.x - p1.x) * prog;
      let y2 = p1.y + (p2.y - p1.y) * prog;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;

      if (seg.type === 'ray' && prog >= 0.99) {
        x2 += ux * 26;
        y2 += uy * 26;
      } else if (seg.type === 'line' && prog >= 0.99) {
        x1 -= ux * 26;
        y1 -= uy * 26;
        x2 += ux * 26;
        y2 += uy * 26;
      }

      ctx.save();
      if (isHighlighted) {
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3.2;
      } else {
        ctx.strokeStyle = COLOR_MAP[seg.color] || COLOR_MAP.main;
        ctx.lineWidth = isCurrentStep ? 2.4 : 1.9;
      }

      if (seg.style === 'dashed') {
        ctx.setLineDash([6, 5]);
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      const ticksFrom = typeof seg.ticksFromStep === 'number' ? seg.ticksFromStep : dStep;
      if (seg.ticks > 0 && maxDrawStep >= ticksFrom && prog >= 0.95) {
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const nx = -uy;
        const ny = ux;
        ctx.save();
        ctx.strokeStyle = isHighlighted ? '#34d399' : '#fbbf24';
        ctx.lineWidth = 1.7;
        for (let t = 0; t < seg.ticks; t++) {
          const offset = (t - (seg.ticks - 1) / 2) * 5;
          const bx = mx + ux * offset;
          const by = my + uy * offset;
          ctx.beginPath();
          ctx.moveTo(bx - nx * 5, by - ny * 5);
          ctx.lineTo(bx + nx * 5, by + ny * 5);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (isCurrentStep && !seg.noRuler) {
        toolAnchor = {
          x: x2,
          y: y2,
          angle: Math.atan2(dy, dx)
        };
      }
    });

    rightAngles.forEach((ra) => {
      const dStep = Number(ra.drawStep) || 0;
      if (dStep > maxDrawStep) return;
      if (typeof ra.solveRevealStep === 'number') {
        if (mode !== 'solve' || activeSolveStep < ra.solveRevealStep) return;
      }

      const v = pointMap.get(ra.vertex);
      const p1 = pointMap.get(ra.p1);
      const p2 = pointMap.get(ra.p2);
      if (!v || !p1 || !p2) return;

      const u1x = p1.x - v.x;
      const u1y = p1.y - v.y;
      const l1 = Math.hypot(u1x, u1y) || 1;
      const u2x = p2.x - v.x;
      const u2y = p2.y - v.y;
      const l2 = Math.hypot(u2x, u2y) || 1;

      const sz = 11;
      const ax = (u1x / l1) * sz;
      const ay = (u1y / l1) * sz;
      const bx = (u2x / l2) * sz;
      const by = (u2y / l2) * sz;

      const isHl = hlRightAngles.some(
        (h) => String(h.vertex || h) === String(ra.vertex)
      );

      ctx.save();
      ctx.strokeStyle = isHl ? '#34d399' : '#38bdf8';
      ctx.lineWidth = isHl ? 2.5 : 1.6;
      if (isHl) {
        ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(v.x + ax, v.y + ay);
        ctx.lineTo(v.x + ax + bx, v.y + ay + by);
        ctx.lineTo(v.x + bx, v.y + by);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(v.x + ax, v.y + ay);
      ctx.lineTo(v.x + ax + bx, v.y + ay + by);
      ctx.lineTo(v.x + bx, v.y + by);
      ctx.stroke();
      ctx.restore();
    });

    angleArcs.forEach((arc) => {
      const dStep = Number(arc.drawStep) || 0;
      if (dStep > maxDrawStep) return;
      if (typeof arc.solveRevealStep === 'number') {
        if (mode !== 'solve' || activeSolveStep < arc.solveRevealStep) return;
      }

      const v = pointMap.get(arc.vertex);
      const p1 = pointMap.get(arc.p1);
      const p2 = pointMap.get(arc.p2);
      if (!v || !p1 || !p2) return;

      const a1 = Math.atan2(p1.y - v.y, p1.x - v.x);
      const a2 = Math.atan2(p2.y - v.y, p2.x - v.x);
      let diff = a2 - a1;
      while (diff <= -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      const isHl = hlAngles.some(
        (h) =>
          String(h.vertex) === String(arc.vertex) &&
          ((String(h.p1) === String(arc.p1) && String(h.p2) === String(arc.p2)) ||
            (String(h.p1) === String(arc.p2) && String(h.p2) === String(arc.p1)))
      );

      ctx.save();
      ctx.strokeStyle = isHl ? '#34d399' : COLOR_MAP[arc.color] || '#38bdf8';
      ctx.lineWidth = isHl ? 2.6 : 1.7;
      ctx.beginPath();
      ctx.arc(v.x, v.y, arc.radius || 24, a1, a1 + diff, diff < 0);
      ctx.stroke();
      ctx.restore();
    });

    points.forEach((pt) => {
      const dStep = Number(pt.drawStep) || 0;
      if (dStep > maxDrawStep) return;
      if (typeof pt.hideAtStep === 'number' && maxDrawStep >= pt.hideAtStep) return;

      const isHl = hlPoints.has(String(pt.id));

      if (!pt.hideDot) {
        ctx.save();
        if (isHl) {
          ctx.fillStyle = 'rgba(52, 211, 153, 0.28)';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = isHl ? '#34d399' : '#f8fafc';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isHl ? 4.2 : 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (showLabels && pt.label) {
        ctx.save();
        ctx.font = isHl
          ? 'bold 14px Inter, system-ui, sans-serif'
          : '600 13px Inter, system-ui, sans-serif';
        ctx.fillStyle = isHl ? '#6ee7b7' : '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pt.label, pt.x + (pt.dx || 0), pt.y + (pt.dy || -14));
        ctx.restore();
      }
    });

    if (mode === 'draw' && drawProgress < 0.99 && activeStepConfig?.tool && toolAnchor) {
      drawVirtualTool(ctx, activeStepConfig.tool, toolAnchor.x, toolAnchor.y, toolAnchor.angle);
    }

    ctx.restore();
  }, [geometry, mode, activeDrawStep, activeSolveStep, activeStepConfig, drawProgress, zoom, showGrid, showLabels]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#0b1120]">
      <canvas ref={canvasRef} className="block h-full w-full" />

      <div className="pointer-events-none absolute left-3 top-3 max-w-[72%] rounded-xl border border-slate-700/70 bg-slate-900/85 px-3 py-2 backdrop-blur-md">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
          {mode === 'solve'
            ? 'HOÀN TẤT HÌNH VẼ'
            : `BƯỚC DỰNG HÌNH ${activeDrawStep + 1}`}
        </div>
        <div className="mt-0.5 text-xs text-slate-200 line-clamp-2">
          {mode === 'solve'
            ? 'Hình vẽ hoàn thiện.'
            : activeStepConfig?.caption || 'Đang dựng hình...'}
        </div>
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-xl border border-slate-700/70 bg-slate-900/85 p-1 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setShowLabels((v) => !v)}
          title="Ẩn/hiện tên điểm"
          className={`rounded-lg p-1.5 transition ${
            showLabels ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Tag className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowGrid((v) => !v)}
          title="Ẩn/hiện lưới tọa độ"
          className={`rounded-lg p-1.5 transition ${
            showGrid ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
          title="Phóng to"
          className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))}
          title="Thu nhỏ"
          className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="Đặt lại tỷ lệ 100%"
          className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
