/* ============================================================================
   BỘ KẾT XUẤT VĂN BẢN & CÔNG THỨC TOÁN HỌC SẮC NÉT TRÊN HTML5 CANVAS
   - Hiển thị phân số xếp tầng (tử số / gạch ngang / mẫu số)
   - Hiển thị ký hiệu góc có mũ (∠ / mũ góc trên đỉnh), căn bậc hai, lũy thừa, chỉ số dưới
   - Tự động tách dòng công thức dài & chuỗi biến đổi nhiều dấu '=' giống hệt web
   ============================================================================ */

import { sanitizeLatexVietnameseText } from '../components/MathText.jsx';

function replaceBasicSymbols(str) {
  return String(str || '')
    .replace(/\\triangle\s*/g, '△')
    .replace(/\\perp/g, '⊥')
    .replace(/\\parallel/g, '∥')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\approx/g, '≈')
    .replace(/\\le\b/g, '≤')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\pm\b/g, '±')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\circ/g, '°')
    .replace(/\^\s*\{\s*°\s*\}/g, '°')
    .replace(/\^\s*°/g, '°')
    .replace(/\^\s*\{\s*2\s*\}/g, '²')
    .replace(/\^\s*2(?![0-9])/g, '²')
    .replace(/\^\s*\{\s*3\s*\}/g, '³')
    .replace(/\^\s*3(?![0-9])/g, '³')
    .replace(/\^\s*\{\s*4\s*\}/g, '⁴')
    .replace(/\^\s*4(?![0-9])/g, '⁴')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^{}]*)\}/g, '$1')
    .replace(/\\textbf\{([^{}]*)\}/g, '$1')
    .replace(/\\textit\{([^{}]*)\}/g, '$1')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '')
    .replace(/\\ /g, ' ')
    .replace(/\{,\}/g, ',')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ');
}

function readBalancedBraces(str, startIdx) {
  if (str[startIdx] !== '{') return null;
  let depth = 0;
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return {
          content: str.slice(startIdx + 1, i),
          endIdx: i + 1
        };
      }
    }
  }
  return null;
}

/**
 * Phân tích một chuỗi hỗn hợp (chữ + $LaTeX$) thành danh sách các token đồ họa:
 * - { type: 'text', value }
 * - { type: 'frac', num, den }
 * - { type: 'hat', value }
 * - { type: 'sqrt', value }
 * - { type: 'sub', base, sub }
 */
function tokenizeMathParagraph(rawText) {
  const tokens = [];
  const parts = String(rawText || '').split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  for (const part of parts) {
    if (!part) continue;
    const isMath =
      (part.startsWith('$$') && part.endsWith('$$')) ||
      (part.startsWith('$') && part.endsWith('$'));

    if (!isMath) {
      // Xử lý cả các phân số dạng thường (a)/(b) ngoài $...$
      const cleanPlain = replaceBasicSymbols(part);
      pushPlainWithSubscripts(tokens, cleanPlain);
      continue;
    }

    let inner = part.startsWith('$$') ? part.slice(2, -2) : part.slice(1, -1);
    inner = sanitizeLatexVietnameseText(inner);

    let i = 0;
    let textBuf = '';
    const flushBuf = () => {
      if (textBuf) {
        pushPlainWithSubscripts(tokens, replaceBasicSymbols(textBuf));
        textBuf = '';
      }
    };

    while (i < inner.length) {
      if (inner.startsWith('\\dfrac', i) || inner.startsWith('\\frac', i)) {
        const cmdLen = inner.startsWith('\\dfrac', i) ? 6 : 5;
        let p = i + cmdLen;
        while (p < inner.length && inner[p] === ' ') p++;
        const numGrp = readBalancedBraces(inner, p);
        if (numGrp) {
          let q = numGrp.endIdx;
          while (q < inner.length && inner[q] === ' ') q++;
          const denGrp = readBalancedBraces(inner, q);
          if (denGrp) {
            flushBuf();
            tokens.push({
              type: 'frac',
              num: replaceBasicSymbols(numGrp.content).trim(),
              den: replaceBasicSymbols(denGrp.content).trim()
            });
            i = denGrp.endIdx;
            continue;
          }
        }
      }

      if (inner.startsWith('\\widehat', i) || inner.startsWith('\\hat', i)) {
        const cmdLen = inner.startsWith('\\widehat', i) ? 8 : 4;
        let p = i + cmdLen;
        while (p < inner.length && inner[p] === ' ') p++;
        const grp = readBalancedBraces(inner, p);
        if (grp) {
          flushBuf();
          tokens.push({
            type: 'hat',
            value: replaceBasicSymbols(grp.content).trim()
          });
          i = grp.endIdx;
          continue;
        }
      }

      if (inner.startsWith('\\sqrt', i)) {
        let p = i + 5;
        while (p < inner.length && inner[p] === ' ') p++;
        const grp = readBalancedBraces(inner, p);
        if (grp) {
          flushBuf();
          tokens.push({
            type: 'sqrt',
            value: replaceBasicSymbols(grp.content).trim()
          });
          i = grp.endIdx;
          continue;
        }
      }

      textBuf += inner[i];
      i++;
    }
    flushBuf();
  }

  return tokens;
}

function pushPlainWithSubscripts(tokens, text) {
  // Tách từ và khoảng trắng để xuống dòng mượt mà
  const pieces = text.split(/(\s+)/);
  for (const piece of pieces) {
    if (!piece) continue;
    if (/^\s+$/.test(piece)) {
      tokens.push({ type: 'space', value: ' ' });
      continue;
    }
    const subMatch = piece.match(/^([A-Za-z])_([0-9a-zA-Z]{1,3})([.,;:)]*)$/);
    if (subMatch) {
      tokens.push({
        type: 'sub',
        base: subMatch[1],
        sub: subMatch[2],
        suffix: subMatch[3] || ''
      });
    } else {
      tokens.push({ type: 'text', value: piece });
    }
  }
}

function measureToken(ctx, tok, fontSize, fontWeight = '400') {
  const family = 'Inter, system-ui, -apple-system, sans-serif';
  if (tok.type === 'space') {
    ctx.font = `${fontWeight} ${fontSize}px ${family}`;
    return { width: ctx.measureText(' ').width, height: fontSize * 1.4, hasFrac: false };
  }
  if (tok.type === 'text') {
    ctx.font = `${fontWeight} ${fontSize}px ${family}`;
    return { width: ctx.measureText(tok.value).width, height: fontSize * 1.4, hasFrac: false };
  }
  if (tok.type === 'hat') {
    ctx.font = `600 ${fontSize}px ${family}`;
    return { width: ctx.measureText(tok.value).width + 4, height: fontSize * 1.55, hasFrac: false };
  }
  if (tok.type === 'sqrt') {
    ctx.font = `${fontWeight} ${fontSize}px ${family}`;
    const label = `√${tok.value}`;
    return { width: ctx.measureText(label).width + 4, height: fontSize * 1.45, hasFrac: false };
  }
  if (tok.type === 'sub') {
    ctx.font = `${fontWeight} ${fontSize}px ${family}`;
    const baseW = ctx.measureText(tok.base).width;
    const sufW = tok.suffix ? ctx.measureText(tok.suffix).width : 0;
    ctx.font = `${fontWeight} ${Math.max(10, Math.round(fontSize * 0.72))}px ${family}`;
    const subW = ctx.measureText(tok.sub).width;
    return { width: baseW + subW + sufW + 1, height: fontSize * 1.45, hasFrac: false };
  }
  if (tok.type === 'frac') {
    const subSize = Math.max(11, Math.round(fontSize * 0.82));
    ctx.font = `600 ${subSize}px ${family}`;
    const wNum = ctx.measureText(tok.num).width;
    const wDen = ctx.measureText(tok.den).width;
    return {
      width: Math.max(wNum, wDen) + 12,
      height: subSize * 2.25 + 6,
      hasFrac: true
    };
  }
  return { width: 0, height: fontSize * 1.4, hasFrac: false };
}

function drawToken(ctx, tok, x, centerY, fontSize, color, fontWeight = '400') {
  const family = 'Inter, system-ui, -apple-system, sans-serif';
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  if (tok.type === 'space' || tok.type === 'text') {
    ctx.font = `${fontWeight} ${fontSize}px ${family}`;
    ctx.fillText(tok.value, x, centerY);
  } else if (tok.type === 'hat') {
    ctx.font = `600 ${fontSize}px ${family}`;
    const w = ctx.measureText(tok.value).width;
    ctx.fillText(tok.value, x + 2, centerY + 2);
    // Vẽ dấu mũ góc trên đầu chữ
    const hatTopY = centerY - fontSize * 0.56;
    const hatBaseY = centerY - fontSize * 0.34;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x + 2, hatBaseY);
    ctx.lineTo(x + 2 + w / 2, hatTopY);
    ctx.lineTo(x + 2 + w, hatBaseY);
    ctx.stroke();
  } else if (tok.type === 'sqrt') {
    ctx.font = `${fontWeight} ${fontSize}px ${family}`;
    const radW = ctx.measureText('√').width;
    const valW = ctx.measureText(tok.value).width;
    ctx.fillText('√', x, centerY + 1);
    ctx.fillText(tok.value, x + radW, centerY + 1);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x + radW - 1, centerY - fontSize * 0.44);
    ctx.lineTo(x + radW + valW + 2, centerY - fontSize * 0.44);
    ctx.stroke();
  } else if (tok.type === 'sub') {
    ctx.font = `${fontWeight} ${fontSize}px ${family}`;
    const baseW = ctx.measureText(tok.base).width;
    ctx.fillText(tok.base, x, centerY);
    const subSize = Math.max(10, Math.round(fontSize * 0.72));
    ctx.font = `${fontWeight} ${subSize}px ${family}`;
    const subW = ctx.measureText(tok.sub).width;
    ctx.fillText(tok.sub, x + baseW, centerY + fontSize * 0.24);
    if (tok.suffix) {
      ctx.font = `${fontWeight} ${fontSize}px ${family}`;
      ctx.fillText(tok.suffix, x + baseW + subW, centerY);
    }
  } else if (tok.type === 'frac') {
    const subSize = Math.max(11, Math.round(fontSize * 0.82));
    ctx.font = `600 ${subSize}px ${family}`;
    const wNum = ctx.measureText(tok.num).width;
    const wDen = ctx.measureText(tok.den).width;
    const boxW = Math.max(wNum, wDen) + 12;
    const midX = x + boxW / 2;

    ctx.textAlign = 'center';
    ctx.fillText(tok.num, midX, centerY - subSize * 0.62);

    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x + 3, centerY);
    ctx.lineTo(x + boxW - 3, centerY);
    ctx.stroke();

    ctx.fillText(tok.den, midX, centerY + subSize * 0.66);
  }

  ctx.restore();
}

/**
 * Tách một dòng lời giải thành các dòng con giống hệt MathText.jsx
 */
export function expandSolutionRowsForCanvas(rawLine) {
  const trimmed = String(rawLine || '').trim();
  if (!trimmed) return [];

  const rows = [];
  let working = trimmed;

  // Tách "<Lời dẫn tiếng Việt>: <Công thức dài>"
  let inDollar = false;
  let parenDepth = 0;
  let colonIdx = -1;
  for (let i = 0; i < working.length; i++) {
    const ch = working[i];
    if (ch === '$' && working[i - 1] !== '\\') inDollar = !inDollar;
    else if (!inDollar) {
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      else if (ch === ':' && parenDepth === 0) {
        colonIdx = i;
        break;
      }
    }
  }

  if (colonIdx > 4 && colonIdx < working.length - 4) {
    const lead = working.slice(0, colonIdx + 1).trim();
    const rest = working.slice(colonIdx + 1).trim();
    const eqCount = (rest.match(/[=≈]/g) || []).length;
    const hasFracOrRoot = /\\dfrac|\\frac|\\sqrt|\)\s*\/|\b\d+\s*\/\s*\d+\b/.test(rest);
    if (eqCount >= 2 || (eqCount >= 1 && (hasFracOrRoot || rest.length > 34))) {
      rows.push({ text: lead, indent: false });
      working = rest;
    }
  }

  // Tách chuỗi nhiều dấu '=' / '≈' bên trong $...$
  const pureDollar = working.match(/^\$([^$\n]+)\$$/);
  if (pureDollar) {
    const inner = pureDollar[1].trim();
    const parts = [];
    let pDepth = 0;
    let bDepth = 0;
    let cur = '';
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === '(') pDepth++;
      else if (c === ')') pDepth = Math.max(0, pDepth - 1);
      else if (c === '{') bDepth++;
      else if (c === '}') bDepth = Math.max(0, bDepth - 1);

      if (pDepth === 0 && bDepth === 0 && (c === '=' || c === '≈')) {
        if (cur.trim()) parts.push(cur.trim());
        cur = c;
      } else {
        cur += c;
      }
    }
    if (cur.trim()) parts.push(cur.trim());

    if (parts.length >= 2 && (parts.length >= 3 || inner.length > 42)) {
      parts.forEach((seg, i) => {
        rows.push({ text: `$${seg}$`, indent: i > 0 });
      });
      return rows;
    }
  }

  rows.push({ text: working, indent: false });
  return rows;
}

/**
 * Đo và chia dòng một đoạn văn bản toán học theo bề rộng maxWidth
 */
export function layoutMathLines(ctx, text, maxWidth, fontSize = 15, fontWeight = '400') {
  const tokens = tokenizeMathParagraph(text);
  const lines = [];
  let currentLine = [];
  let curW = 0;
  let curH = fontSize * 1.42;

  for (const tok of tokens) {
    const dim = measureToken(ctx, tok, fontSize, fontWeight);
    if (tok.type === 'space' && currentLine.length === 0) {
      continue;
    }
    if (curW + dim.width > maxWidth && currentLine.length > 0 && tok.type !== 'space') {
      // Bỏ khoảng trắng cuối dòng
      while (currentLine.length > 0 && currentLine[currentLine.length - 1].tok.type === 'space') {
        currentLine.pop();
      }
      lines.push({ items: currentLine, height: curH });
      currentLine = [];
      curW = 0;
      curH = fontSize * 1.42;
    }
    currentLine.push({ tok, width: dim.width });
    curW += dim.width;
    if (dim.height > curH) curH = dim.height;
  }

  if (currentLine.length > 0) {
    while (currentLine.length > 0 && currentLine[currentLine.length - 1].tok.type === 'space') {
      currentLine.pop();
    }
    if (currentLine.length > 0) {
      lines.push({ items: currentLine, height: curH });
    }
  }

  return lines;
}

/**
 * Vẽ các dòng đã được layoutMathLines lên Canvas, trả về tổng chiều cao đã vẽ
 */
export function drawLaidOutMathLines(
  ctx,
  laidOutLines,
  startX,
  startY,
  fontSize = 15,
  color = '#e2e8f0',
  fontWeight = '400'
) {
  let y = startY;
  for (const line of laidOutLines) {
    const centerY = y + line.height / 2;
    let x = startX;
    for (const item of line.items) {
      drawToken(ctx, item.tok, x, centerY, fontSize, color, fontWeight);
      x += item.width;
    }
    y += line.height + 2;
  }
  return y - startY;
}
