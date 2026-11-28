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

/**
 * Vẽ đầu bút chì tại tọa độ hiện tại của nét vẽ
 */
function drawPencilTip(ctx, x, y, angleRad = -Math.PI / 4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Thân bút chì nghiêng 45 độ
  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#fef3c7';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(10, -4);
  ctx.lineTo(42, -4);
  ctx.lineTo(42, 4);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Đầu gỗ gọt nhọn
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(10, -4);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();

  // Ngòi chì đen
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(4, -1.6);
  ctx.lineTo(4, 1.6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Vẽ dụng cụ hình học chuẩn kỹ thuật:
 * - Thước thẳng (ruler): Đặt cố định từ gốc đến cuối, vạch chia mm & cm, đánh số rõ nét 0, 1, 2...
 * - Ê-ke (eke): Đặt cố định tại đỉnh góc vuông với kích thước lớn bao trùm cạnh vuông góc, có vạch chia số.
 * - Thước đo độ (protractor): Đặt tâm trùng đỉnh góc, vạch 0° áp sát cạnh gốc, có chia độ & số đo.
 * - Compa (compass): Chân kim cố định tại tâm O, khẩu độ mở đúng bằng bán kính R, chân bút quay tới đâu nét hiện tới đó.
 */
function drawVirtualTool(ctx, toolCfg) {
  if (!toolCfg || !toolCfg.tool || toolCfg.tool === 'none') return;
  const { tool } = toolCfg;

  if (tool === 'ruler') {
    const { startX, startY, penX, penY, angleRad = 0, rulerLength = 240, pxPerCm = 30 } = toolCfg;
    const len = Math.max(120, Number(rulerLength) || 240);
    const stepCm = Math.max(18, Number(pxPerCm) || 30);
    const totalCm = Math.floor((len - 20) / stepCm);

    ctx.save();
    ctx.translate(startX, startY);
    ctx.rotate(angleRad);

    // Thân thước trong suốt ánh xanh (vạch 0 nằm tại x = 0, kéo dài sang phải tới len - 12)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.20)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-14, 5, len + 14, 34, 4);
    ctx.fill();
    ctx.stroke();

    // Vạch chia mm, nửa cm và cm kèm chữ số đo rõ nét
    ctx.font = '600 9.5px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#e0f2fe';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxMm = totalCm * 10;
    for (let mm = 0; mm <= maxMm; mm++) {
      const x = (mm / 10) * stepCm;
      const isCm = mm % 10 === 0;
      const isHalfCm = mm % 5 === 0 && !isCm;
      const tickH = isCm ? 11 : isHalfCm ? 7.5 : 4.5;

      ctx.strokeStyle = isCm
        ? 'rgba(240, 249, 255, 0.95)'
        : 'rgba(186, 230, 253, 0.65)';
      ctx.lineWidth = isCm ? 1.2 : 0.85;
      ctx.beginPath();
      ctx.moveTo(x, 5);
      ctx.lineTo(x, 5 + tickH);
      ctx.stroke();

      if (isCm) {
        const cmVal = mm / 10;
        ctx.fillText(String(cmVal), x, 18);
      }
    }

    // Nhãn đơn vị cm ở cuối thước
    ctx.font = '600 8.5px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('cm', totalCm * stepCm + 16, 19);

    ctx.restore();

    // Bút chì trượt dọc mép thước từ start đến pen
    if (Number.isFinite(penX) && Number.isFinite(penY)) {
      drawPencilTip(ctx, penX, penY, angleRad - Math.PI / 3);
    }
    return;
  }

  if (tool === 'eke') {
    const {
      vertexX,
      vertexY,
      penX,
      penY,
      angleRad = 0,
      ekeSize = 180,
      flipY = false,
      pxPerCm = 30
    } = toolCfg;
    const size = Math.max(120, Number(ekeSize) || 180);
    const dirY = flipY ? 1 : -1;
    const stepCm = Math.max(18, Number(pxPerCm) || 30);

    ctx.save();
    ctx.translate(vertexX, vertexY);
    ctx.rotate(angleRad);

    // Tam giác ê-ke lớn bao trùm cạnh vuông góc
    ctx.fillStyle = 'rgba(52, 211, 153, 0.20)';
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.92)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, dirY * size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Khoét lỗ tam giác bên trong ê-ke
    const inner1 = Math.round(size * 0.22);
    const inner2 = Math.round(size * 0.62);
    ctx.beginPath();
    ctx.moveTo(inner1, dirY * inner1);
    ctx.lineTo(inner2, dirY * inner1);
    ctx.lineTo(inner1, dirY * inner2);
    ctx.closePath();
    ctx.stroke();

    // Vạch chia số đo trên cạnh góc vuông đứng (cạnh kẻ đường vuông góc)
    ctx.font = '600 9px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#d1fae5';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const maxMm = Math.floor((size - 22) / stepCm) * 10;
    for (let mm = 0; mm <= maxMm; mm++) {
      const d = (mm / 10) * stepCm;
      const y = dirY * d;
      const isCm = mm % 10 === 0;
      const isHalf = mm % 5 === 0 && !isCm;
      const tickW = isCm ? 10 : isHalf ? 6.5 : 4;

      ctx.strokeStyle = isCm ? 'rgba(236, 253, 245, 0.95)' : 'rgba(167, 243, 208, 0.65)';
      ctx.lineWidth = isCm ? 1.15 : 0.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tickW, y);
      ctx.stroke();

      if (isCm && mm > 0) {
        ctx.fillText(String(mm / 10), 12, y);
      }
    }

    // Vạch chia trên cạnh góc vuông ngang (cạnh áp sát đường chuẩn)
    for (let mm = 10; mm <= maxMm; mm += 5) {
      const x = (mm / 10) * stepCm;
      const isCm = mm % 10 === 0;
      const tickH = isCm ? 8 : 5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, dirY * tickH);
      ctx.stroke();
    }

    ctx.restore();

    if (Number.isFinite(penX) && Number.isFinite(penY)) {
      drawPencilTip(ctx, penX, penY, angleRad - Math.PI / 5);
    }
    return;
  }

  if (tool === 'protractor') {
    const {
      vertexX,
      vertexY,
      baseAngleRad = 0,
      targetDeg = 60,
      progress = 1,
      radius = 84
    } = toolCfg;
    const R = Math.max(68, Number(radius) || 84);
    const currentDeg = Math.max(0, Math.min(180, targetDeg * progress));
    const markRad = (-currentDeg * Math.PI) / 180;

    ctx.save();
    ctx.translate(vertexX, vertexY);
    ctx.rotate(baseAngleRad);

    // Nửa hình tròn thước đo độ trong suốt màu vàng hổ phách
    ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
    ctx.strokeStyle = 'rgba(252, 211, 77, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, R, Math.PI, 0, false);
    ctx.lineTo(R, 8);
    ctx.lineTo(-R, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vòng cung trong & vạch tâm 0° - 180°
    ctx.beginPath();
    ctx.arc(0, 0, R - 20, Math.PI, 0, false);
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Đường chuẩn 0° - 180° đi qua tâm
    ctx.beginPath();
    ctx.moveTo(-R + 4, 0);
    ctx.lineTo(R - 4, 0);
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.stroke();

    // Chia vạch mỗi 5° và ghi số mỗi 10° / 30°
    ctx.font = '600 8px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#fef3c7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let deg = 0; deg <= 180; deg += 5) {
      const r = (-deg * Math.PI) / 180;
      const isMajor = deg % 10 === 0;
      const innerR = isMajor ? R - 10 : R - 6;
      ctx.strokeStyle = isMajor ? 'rgba(254, 249, 195, 0.95)' : 'rgba(253, 224, 71, 0.6)';
      ctx.lineWidth = isMajor ? 1.1 : 0.75;
      ctx.beginPath();
      ctx.moveTo(Math.cos(r) * innerR, Math.sin(r) * innerR);
      ctx.lineTo(Math.cos(r) * R, Math.sin(r) * R);
      ctx.stroke();

      if (deg % 20 === 0) {
        const textR = R - 16;
        ctx.fillText(String(deg), Math.cos(r) * textR, Math.sin(r) * textR);
      }
    }

    // Tia chỉ góc động từ 0° đến số đo góc mục tiêu + chấm đánh dấu
    const dotX = Math.cos(markRad) * (R + 4);
    const dotY = Math.sin(markRad) * (R + 4);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dotX, dotY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Nhãn hiển thị số đo góc đang đo
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(dotX + 6, dotY - 12, 34, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = '700 10px Inter, system-ui, sans-serif';
    ctx.fillText(`${Math.round(currentDeg)}°`, dotX + 23, dotY - 3);

    ctx.restore();
    return;
  }

  if (tool === 'compass') {
    const { centerX, centerY, penX, penY } = toolCfg;
    if (!Number.isFinite(centerX) || !Number.isFinite(penX)) return;

    const dx = penX - centerX;
    const dy = penY - centerY;
    const radius = Math.hypot(dx, dy) || 1;
    const midX = (centerX + penX) / 2;
    const midY = (centerY + penY) / 2;

    // Vector pháp tuyến hướng lên trên để đặt tay cầm compa tự nhiên
    let nx = dy / radius;
    let ny = -dx / radius;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const legHeight = Math.max(68, Math.min(135, radius * 0.78));
    const hingeX = midX + nx * legHeight;
    const hingeY = midY + ny * legHeight;

    ctx.save();

    // Chân kim cố định tại tâm O
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + (hingeX - centerX) * 0.16, centerY + (hingeY - centerY) * 0.16);
    ctx.stroke();

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(centerX + (hingeX - centerX) * 0.16, centerY + (hingeY - centerY) * 0.16);
    ctx.lineTo(hingeX, hingeY);
    ctx.stroke();

    // Vòng tròn nhỏ đánh dấu tâm chân kim cố định
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Chân bút chì quay theo cung tròn tới đúng (penX, penY)
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(hingeX, hingeY);
    ctx.lineTo(penX + (hingeX - penX) * 0.16, penY + (hingeY - penY) * 0.16);
    ctx.stroke();

    // Đầu chì tiếp xúc đúng nét vẽ
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(penX + (hingeX - penX) * 0.16, penY + (hingeY - penY) * 0.16);
    ctx.lineTo(penX, penY);
    ctx.stroke();

    // Khớp xoay & tay cầm phía trên compa
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(hingeX, hingeY);
    ctx.lineTo(hingeX + nx * 16, hingeY + ny * 16);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(hingeX, hingeY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }
}

export function computeGeometryBounds(geometry, includeLabels = true) {
  const points = Array.isArray(geometry?.points) ? geometry.points : [];
  const segments = Array.isArray(geometry?.segments) ? geometry.segments : [];
  const circles = Array.isArray(geometry?.circles) ? geometry.circles : [];

  const pointMap = new Map();
  points.forEach((p) => pointMap.set(p.id, p));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const includeXY = (x, y, pad = 0) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x - pad < minX) minX = x - pad;
    if (x + pad > maxX) maxX = x + pad;
    if (y - pad < minY) minY = y - pad;
    if (y + pad > maxY) maxY = y + pad;
  };

  points.forEach((pt) => {
    includeXY(pt.x, pt.y, 12);
    if (includeLabels && pt.label) {
      const lx = pt.x + (pt.dx || 0);
      const ly = pt.y + (pt.dy || -14);
      includeXY(lx, ly, 16);
    }
  });

  segments.forEach((seg) => {
    const p1 = pointMap.get(seg.from);
    const p2 = pointMap.get(seg.to);
    if (!p1 || !p2) return;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    if (seg.type === 'ray') {
      includeXY(p2.x + ux * 28, p2.y + uy * 28, 10);
    } else if (seg.type === 'line') {
      includeXY(p1.x - ux * 28, p1.y - uy * 28, 10);
      includeXY(p2.x + ux * 28, p2.y + uy * 28, 10);
    }
  });

  circles.forEach((c) => {
    const center = pointMap.get(c.center);
    if (!center) return;
    const r = Math.max(1, Number(c.radius) || 0);
    const startAng = typeof c.startAngle === 'number' ? c.startAngle : 0;
    const endAng = typeof c.endAngle === 'number' ? c.endAngle : Math.PI * 2;
    const span = endAng - startAng;

    if (Math.abs(span) >= Math.PI * 1.99) {
      includeXY(center.x - r, center.y - r, 10);
      includeXY(center.x + r, center.y + r, 10);
    } else {
      const steps = 36;
      for (let i = 0; i <= steps; i++) {
        const ang = startAng + (span * i) / steps;
        includeXY(center.x + Math.cos(ang) * r, center.y + Math.sin(ang) * r, 10);
      }
    }
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { minX: -160, maxX: 160, minY: -120, maxY: 120, cx: 0, cy: 0, width: 320, height: 240 };
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: Math.max(80, maxX - minX),
    height: Math.max(80, maxY - minY)
  };
}

export function renderGeometryScene(
  ctx,
  W,
  H,
  {
    geometry,
    mode = 'draw',
    activeDrawStep = 0,
    activeSolveStep = -1,
    activeStepConfig = null,
    drawProgress = 1,
    zoom = 1,
    showGrid = true,
    showLabels = true,
    padTop = 48,
    padBottom = 22,
    padX = 28
  }
) {
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, W, H);

  const bounds = computeGeometryBounds(geometry, showLabels);
  const availW = Math.max(120, W - padX * 2);
  const availH = Math.max(120, H - padTop - padBottom);
  const fitScale = Math.min(availW / bounds.width, availH / bounds.height);
  const effectiveScale = fitScale * zoom;

  const centerScreenX = W / 2;
  const centerScreenY = padTop + availH / 2;

  ctx.save();

  if (showGrid) {
    const stepPx = Math.max(16, 26 * effectiveScale);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.24)';
    ctx.lineWidth = 1;
    for (let x = centerScreenX; x < W; x += stepPx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let x = centerScreenX - stepPx; x > 0; x -= stepPx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = centerScreenY; y < H; y += stepPx) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let y = centerScreenY - stepPx; y > 0; y -= stepPx) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  ctx.translate(centerScreenX, centerScreenY);
  ctx.scale(effectiveScale, effectiveScale);
  ctx.translate(-bounds.cx, -bounds.cy);

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

  // Tô đa giác nổi bật (hỗ trợ cả dạng mảng ["O","A","B"] lẫn object {points: [...]})
  hlPolygons.forEach((poly) => {
    const rawPts = Array.isArray(poly) ? poly : poly?.points || [];
    const polyColor = Array.isArray(poly) ? 'blue' : poly?.color || 'blue';
    const pts = rawPts.map((id) => pointMap.get(id)).filter(Boolean);
    if (pts.length >= 3) {
      ctx.save();
      ctx.fillStyle = POLY_FILL_MAP[polyColor] || POLY_FILL_MAP.blue;
      ctx.strokeStyle = POLY_STROKE_MAP[polyColor] || POLY_STROKE_MAP.blue;
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

  let activeToolConfig = null;
  const progNow = Math.max(0.02, Math.min(1, drawProgress));

  // 1. Vẽ đường tròn & cung tròn compa (bút quay đến đâu nét hiện đến đó)
  circles.forEach((c) => {
    const dStep = Number(c.drawStep) || 0;
    if (dStep > maxDrawStep) return;
    if (typeof c.hideAtStep === 'number' && maxDrawStep >= c.hideAtStep) return;

    const center = pointMap.get(c.center);
    if (!center) return;

    const isCurrentStep = mode === 'draw' && dStep === activeDrawStep;
    const prog = isCurrentStep ? progNow : 1;
    const startAng = typeof c.startAngle === 'number' ? c.startAngle : 0;
    const fullEndAng = typeof c.endAngle === 'number' ? c.endAngle : Math.PI * 2;
    const currentEndAng = startAng + (fullEndAng - startAng) * prog;

    ctx.save();
    ctx.strokeStyle = COLOR_MAP[c.color] || COLOR_MAP.main;
    ctx.lineWidth = isCurrentStep ? 2.2 : 1.7;
    if (c.style === 'dashed') ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, c.radius, startAng, currentEndAng, fullEndAng < startAng);
    ctx.stroke();
    ctx.restore();

    if (isCurrentStep) {
      const penX = center.x + Math.cos(currentEndAng) * c.radius;
      const penY = center.y + Math.sin(currentEndAng) * c.radius;
      activeToolConfig = {
        tool: 'compass',
        centerX: center.x,
        centerY: center.y,
        penX,
        penY
      };
    }
  });

  // 2. Vẽ các đoạn thẳng, tia và đường thẳng
  segments.forEach((seg) => {
    const dStep = Number(seg.drawStep) || 0;
    if (dStep > maxDrawStep) return;
    if (typeof seg.hideAtStep === 'number' && maxDrawStep >= seg.hideAtStep) return;

    const p1 = pointMap.get(seg.from);
    const p2 = pointMap.get(seg.to);
    if (!p1 || !p2) return;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    let sx = p1.x;
    let sy = p1.y;
    let ex = p2.x;
    let ey = p2.y;
    if (seg.type === 'ray') {
      ex = p2.x + ux * 24;
      ey = p2.y + uy * 24;
    } else if (seg.type === 'line') {
      sx = p1.x - ux * 24;
      sy = p1.y - uy * 24;
      ex = p2.x + ux * 24;
      ey = p2.y + uy * 24;
    }

    const isCurrentStep = mode === 'draw' && dStep === activeDrawStep;
    const prog = isCurrentStep ? progNow : 1;
    const curX = sx + (ex - sx) * prog;
    const curY = sy + (ey - sy) * prog;

    const isHighlighted =
      hlSegments.has(`${seg.from}-${seg.to}`) || hlSegments.has(`${seg.to}-${seg.from}`);

    ctx.save();
    if (isHighlighted || isCurrentStep) {
      ctx.strokeStyle = COLOR_MAP.emerald;
      ctx.lineWidth = 2.8;
      ctx.shadowColor = 'rgba(52, 211, 153, 0.55)';
      ctx.shadowBlur = 8;
    } else {
      ctx.strokeStyle = COLOR_MAP[seg.color] || COLOR_MAP.main;
      ctx.lineWidth = 2.0;
    }
    if (seg.style === 'dashed') ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(curX, curY);
    ctx.stroke();
    ctx.restore();

    // Ký hiệu vạch bằng nhau trên đoạn thẳng
    if (seg.ticks && prog >= 0.98) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const nx = -uy;
      const ny = ux;
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.8;
      for (let t = 0; t < seg.ticks; t++) {
        const offset = (t - (seg.ticks - 1) / 2) * 5;
        const tx = mx + ux * offset;
        const ty = my + uy * offset;
        ctx.beginPath();
        ctx.moveTo(tx - nx * 5.5, ty - ny * 5.5);
        ctx.lineTo(tx + nx * 5.5, ty + ny * 5.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Nhãn độ dài đoạn thẳng (ví dụ: 6 cm)
    if (showLabels && seg.label && prog >= 0.92) {
      const mx = (p1.x + p2.x) / 2 + (Number(seg.labelDx) || 0);
      const my = (p1.y + p2.y) / 2 + (Number(seg.labelDy) || -12);
      ctx.save();
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.fillStyle = isHighlighted ? '#6ee7b7' : '#bae6fd';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seg.label, mx, my);
      ctx.restore();
    }

    // Gắn dụng cụ vẽ cố định cho bước vẽ hiện tại
    if (isCurrentStep && !seg.noRuler) {
      const stepTool = activeStepConfig?.tool || (seg.ekeSize ? 'eke' : 'ruler');
      const segAngle = Math.atan2(ey - sy, ex - sx);

      if (stepTool === 'eke' || seg.ekeSize) {
        // Đặt đỉnh góc vuông ê-ke tại chân đường vuông góc p2 (ví dụ điểm H)
        // Cạnh góc vuông 1 áp sát đường chuẩn, cạnh góc vuông 2 đi qua p1 (ví dụ điểm B)
        const dirToP1Angle = Math.atan2(p1.y - p2.y, p1.x - p2.x);
        const ekeAngle = dirToP1Angle + Math.PI / 2;
        const fullSegLen = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const ekeSize = Math.max(
          Number(activeStepConfig?.ekeSize) || Number(seg.ekeSize) || 180,
          fullSegLen + 40
        );
        activeToolConfig = {
          tool: 'eke',
          vertexX: p2.x,
          vertexY: p2.y,
          penX: curX,
          penY: curY,
          angleRad: ekeAngle,
          ekeSize,
          flipY: false
        };
      } else if (stepTool === 'ruler') {
        const fullSegLen = Math.hypot(ex - sx, ey - sy);
        const rulerLength = Math.max(
          Number(activeStepConfig?.rulerLength) || Number(seg.rulerLength) || 240,
          fullSegLen + 36
        );
        activeToolConfig = {
          tool: 'ruler',
          startX: sx,
          startY: sy,
          penX: curX,
          penY: curY,
          angleRad: segAngle,
          rulerLength
        };
      }
    }
  });

  // 3. Vẽ các cung góc & hỗ trợ bước dùng thước đo độ (protractor)
  angleArcs.forEach((arc) => {
    const dStep = Number(arc.drawStep) || 0;
    if (dStep > maxDrawStep) return;

    const v = pointMap.get(arc.vertex);
    const p1 = pointMap.get(arc.p1);
    const p2 = pointMap.get(arc.p2);
    if (!v || !p1 || !p2) return;

    const a1 = Math.atan2(p1.y - v.y, p1.x - v.x);
    const a2 = Math.atan2(p2.y - v.y, p2.x - v.x);
    let diff = a2 - a1;
    while (diff <= -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const isCurrentStep = mode === 'draw' && dStep === activeDrawStep;
    const prog = isCurrentStep ? progNow : 1;
    const r = Number(arc.radius) || 28;
    const isHl = hlAngles.some((item) =>
      typeof item === 'string'
        ? item.startsWith(`${arc.vertex}-`)
        : item?.vertex === arc.vertex
    );

    ctx.save();
    ctx.strokeStyle = isHl ? COLOR_MAP.emerald : COLOR_MAP[arc.color] || COLOR_MAP.accent;
    ctx.lineWidth = isHl ? 2.4 : 1.7;
    ctx.beginPath();
    ctx.arc(v.x, v.y, r, a1, a1 + diff * prog, diff < 0);
    ctx.stroke();

    if (showLabels && arc.label && prog >= 0.9) {
      const midAng = a1 + diff / 2;
      const lr = r + 16;
      const lx = v.x + Math.cos(midAng) * lr + (Number(arc.labelDx) || 0);
      const ly = v.y + Math.sin(midAng) * lr + (Number(arc.labelDy) || 0);
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.fillStyle = isHl ? '#6ee7b7' : '#fde047';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(arc.label, lx, ly);
    }
    ctx.restore();

    if (isCurrentStep && activeStepConfig?.tool === 'protractor') {
      const degVal = parseFloat(String(arc.label || '60').replace(/[^0-9.]/g, '')) || 60;
      activeToolConfig = {
        tool: 'protractor',
        vertexX: v.x,
        vertexY: v.y,
        baseAngleRad: a1,
        targetDeg: degVal,
        progress: prog
      };
    }
  });

  // Fallback nếu bước hiện tại khai báo protractor mà chưa gắn qua angleArcs
  if (mode === 'draw' && activeStepConfig?.tool === 'protractor' && !activeToolConfig) {
    const firstArc = angleArcs.find((a) => Number(a.drawStep) === activeDrawStep) || angleArcs[0];
    if (firstArc) {
      const v = pointMap.get(firstArc.vertex);
      const p1 = pointMap.get(firstArc.p1);
      if (v && p1) {
        const degVal = parseFloat(String(firstArc.label || '60').replace(/[^0-9.]/g, '')) || 60;
        activeToolConfig = {
          tool: 'protractor',
          vertexX: v.x,
          vertexY: v.y,
          baseAngleRad: Math.atan2(p1.y - v.y, p1.x - v.x),
          targetDeg: degVal,
          progress: progNow
        };
      }
    }
  }

  // 4. Vẽ ký hiệu góc vuông
  rightAngles.forEach((ra) => {
    const dStep = Number(ra.drawStep) || 0;
    if (dStep > maxDrawStep) return;

    const v = pointMap.get(ra.vertex);
    const p1 = pointMap.get(ra.p1);
    const p2 = pointMap.get(ra.p2);
    if (!v || !p1 || !p2) return;

    const u1x = (p1.x - v.x) / (Math.hypot(p1.x - v.x, p1.y - v.y) || 1);
    const u1y = (p1.y - v.y) / (Math.hypot(p1.x - v.x, p1.y - v.y) || 1);
    const u2x = (p2.x - v.x) / (Math.hypot(p2.x - v.x, p2.y - v.y) || 1);
    const u2y = (p2.y - v.y) / (Math.hypot(p2.x - v.x, p2.y - v.y) || 1);
    const sz = Number(ra.size) || 13;

    const isHl = hlRightAngles.some((item) =>
      typeof item === 'string' ? item === ra.vertex : item?.vertex === ra.vertex
    );

    ctx.save();
    ctx.strokeStyle = isHl ? COLOR_MAP.emerald : COLOR_MAP.accent;
    ctx.lineWidth = isHl ? 2.3 : 1.6;
    ctx.beginPath();
    ctx.moveTo(v.x + u1x * sz, v.y + u1y * sz);
    ctx.lineTo(v.x + (u1x + u2x) * sz, v.y + (u1y + u2y) * sz);
    ctx.lineTo(v.x + u2x * sz, v.y + u2y * sz);
    ctx.stroke();
    ctx.restore();
  });

  // 5. Vẽ các điểm và tên điểm (ẩn chấm tròn ở đầu tia/đường thẳng)
  points.forEach((pt) => {
    const dStep = Number(pt.drawStep) || 0;
    if (dStep > maxDrawStep) return;

    const isHl = hlPoints.has(pt.id);
    if (!pt.hideDot && !pt.isRayEndpoint) {
      ctx.save();
      if (isHl) {
        ctx.fillStyle = 'rgba(52, 211, 153, 0.28)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = isHl ? COLOR_MAP.emerald : '#f8fafc';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isHl ? 4.2 : 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (showLabels && pt.label) {
      const lx = pt.x + (Number(pt.dx) || 0);
      const ly = pt.y + (Number(pt.dy) || -14);
      ctx.save();
      ctx.font = '700 13.5px Inter, system-ui, sans-serif';
      ctx.fillStyle = isHl ? COLOR_MAP.emerald : '#f1f5f9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pt.label, lx, ly);
      ctx.restore();
    }
  });

  // 6. Vẽ dụng cụ hình học trên cùng để không bị nét vẽ che khuất
  if (mode === 'draw' && activeToolConfig) {
    drawVirtualTool(ctx, activeToolConfig);
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
    const parent = canvas.parentElement;
    if (!parent) return;

    const render = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(260, Math.floor(rect.width));
      const H = Math.max(220, Math.floor(rect.height));

      if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
      }

      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);
      renderGeometryScene(ctx, W, H, {
        geometry,
        mode,
        activeDrawStep,
        activeSolveStep,
        activeStepConfig,
        drawProgress,
        zoom,
        showGrid,
        showLabels
      });
      ctx.restore();
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [geometry, mode, activeDrawStep, activeSolveStep, activeStepConfig, drawProgress, zoom, showGrid, showLabels]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800/80 select-none">
      <canvas ref={canvasRef} className="w-full h-full block" />

      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-lg p-1 shadow-lg">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)))}
          title="Phóng to"
          className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
          title="Thu nhỏ"
          className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="Căn vừa khung"
          className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-700/80 mx-0.5" />
        <button
          type="button"
          onClick={() => setShowGrid((v) => !v)}
          title="Bật/tắt lưới ô ly"
          className={`p-1.5 rounded-md transition ${
            showGrid ? 'text-sky-400 bg-sky-500/15' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowLabels((v) => !v)}
          title="Bật/tắt nhãn tên điểm & số đo"
          className={`p-1.5 rounded-md transition ${
            showLabels ? 'text-emerald-400 bg-emerald-500/15' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
