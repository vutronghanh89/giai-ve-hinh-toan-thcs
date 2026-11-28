import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * Chuẩn hóa tiếng Việt & đơn vị đo lỡ nằm bên trong dấu $...$
 * để KaTeX không bao giờ xóa khoảng trắng gây dính chữ (VD: "tại D và ME").
 */
export function sanitizeLatexVietnameseText(rawLatex) {
  let s = String(rawLatex || '').trim();
  if (!s) return '';

  // Tách các lệnh \text{...} có sẵn ra để không bọc lồng nhau
  const textSlots = [];
  s = s.replace(/\\(?:text|mathrm|textbf|textit)\{([^{}]*)\}/g, (_, inner) => {
    const token = `__TEXSLOT_${textSlots.length}__`;
    textSlots.push(`\\text{${inner}}`);
    return token;
  });

  // Tách số dính liền đơn vị đo (VD: 24cm -> 24\text{ cm}, 150° -> 150^\circ)
  s = s.replace(
    /(\d+(?:[.,]\d+)?)\s*(mm|cm|dm|km|m|độ|rad)(?=$|[^A-Za-zÀ-ỹ])/gi,
    (_, num, unit) => {
      if (unit.toLowerCase() === 'độ') return `${num}^\\circ`;
      return `${num}\\text{ ${unit}}`;
    }
  );

  // Bọc các cụm từ tiếng Việt có dấu hoặc từ nối tiếng Việt thông dụng nằm trong biểu thức LaTeX
  const vnPhraseRegex =
    /(^|[\s,.;:()=<>+\-*/\\^_{}])((?:[A-Za-zÀ-ỹ]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][A-Za-zÀ-ỹ]*|\b(?:tai|va|hoac|voi|nen|suy|ra|vi|do|khi|theo|cat|bang|la|co|vuong|goc|song|dong|tam|ban|kinh|dien|tich|chu|vi|quat|lon|nho|don|vi|lam|tron|den|hang|phan|muoi|tram)\b)(?:\s+(?:[A-Za-zÀ-ỹ]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][A-Za-zÀ-ỹ]*|\b(?:tai|va|hoac|voi|nen|suy|ra|vi|do|khi|theo|cat|bang|la|co|vuong|goc|song|dong|tam|ban|kinh|dien|tich|chu|vi|quat|lon|nho|don|vi|lam|tron|den|hang|phan|muoi|tram)\b))*)(?=$|[\s,.;:()=<>+\-*/\\^_{}])/gi;

  s = s.replace(vnPhraseRegex, (full, prefix, phrase) => {
    const trimmedPhrase = phrase.trim();
    if (!trimmedPhrase) return full;
    const hasLeftSpace = /\s$/.test(prefix) || prefix === '';
    const leadSpace = hasLeftSpace && prefix !== '' ? ' ' : '';
    return `${prefix}\\text{${leadSpace}${trimmedPhrase} }`;
  });

  // Phục hồi các khối \text{...} gốc
  s = s.replace(/__TEXSLOT_(\d+)__/g, (_, idx) => textSlots[Number(idx)] || '');

  return s.replace(/\s+/g, ' ').trim();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render một chuỗi LaTeX sang HTML bằng KaTeX an toàn
 */
function renderKatexHtml(latex, displayMode = false) {
  try {
    const cleaned = sanitizeLatexVietnameseText(latex);
    return katex.renderToString(cleaned, {
      throwOnError: false,
      displayMode,
      strict: false,
      trust: false
    });
  } catch {
    return null;
  }
}

/**
 * Chuyển đổi biểu thức toán học viết dạng văn bản thường sang chuẩn LaTeX
 */
export function convertPlainMathToLatex(rawExpr) {
  let s = String(rawExpr || '').trim();
  if (!s) return '';

  s = s
    .replace(/△\s*([A-Za-z0-9]+)/g, '\\triangle $1')
    .replace(/∠\s*([A-Za-z0-9]{2,4})/g, '\\widehat{$1}')
    .replace(/⊥/g, ' \\perp ')
    .replace(/∥/g, ' \\parallel ')
    .replace(/⇒/g, ' \\Rightarrow ')
    .replace(/⇔/g, ' \\Leftrightarrow ')
    .replace(/≈/g, ' \\approx ')
    .replace(/≤/g, ' \\le ')
    .replace(/≥/g, ' \\ge ')
    .replace(/≠/g, ' \\neq ')
    .replace(/±/g, ' \\pm ')
    .replace(/×/g, ' \\times ')
    .replace(/·/g, ' \\cdot ')
    .replace(/\s+\.\s+/g, ' \\cdot ')
    .replace(/π/g, '\\pi ')
    .replace(/°/g, '^\\circ');

  s = s.replace(
    /([A-Za-z])_([A-Za-zÀ-ỹ0-9]+(?:\s+[A-Za-zÀ-ỹ0-9]+){0,2})/g,
    (_, base, sub) => {
      if (/^[0-9a-zA-Z]$/.test(sub)) return `${base}_${sub}`;
      return `${base}_{\\text{${sub.trim()}}}`;
    }
  );

  s = s.replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4');

  s = s
    .replace(/√\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/√([A-Za-z0-9.,]+)/g, '\\sqrt{$1}');

  let prev;
  let guard = 0;
  do {
    prev = s;
    s = s
      .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\dfrac{$1}{$2}')
      .replace(
        /\(([^()]+)\)\s*\/\s*([A-Za-z0-9_.,^{}\\-]+(?:\s*\\cdot\s*[A-Za-z0-9_.,^{}\\-]+)*)/g,
        '\\dfrac{$1}{$2}'
      )
      .replace(
        /([A-Za-z0-9_.,^{}\\-]+(?:\s*\\cdot\s*[A-Za-z0-9_.,^{}\\-]+)*)\s*\/\s*\(([^()]+)\)/g,
        '\\dfrac{$1}{$2}'
      );
    guard++;
  } while (s !== prev && guard < 6);

  s = s.replace(
    /(^|[\s=≈(+×-])(\d+(?:[.,]\d+)?|[A-Z]{1,3}|\\pi)\s*\/\s*(\d+(?:[.,]\d+)?|[A-Z]{1,3})(?=$|[\s=≈)+×.,;:])/g,
    '$1\\dfrac{$2}{$3}'
  );

  s = s.replace(
    /\(\s*(mm|cm|dm|m|km|độ|rad)(\^[0-9]+)?\s*\)/gi,
    (_, unit, pow) => {
      return `\\ (\\text{${unit}}${pow || ''})`;
    }
  );

  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Tách chuỗi biểu thức có nhiều dấu '=' hoặc '≈' (ngoài ngoặc/dấu nhọn) thành từng cụm nguyên tử
 * để hiển thị liền trên 1 dòng và chỉ tự động xuống dòng đúng trước dấu '=' khi chạm mép khung.
 */
function splitAtomicEqualityChunks(latexExpr) {
  const parts = [];
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let current = '';

  for (let i = 0; i < latexExpr.length; i++) {
    const ch = latexExpr[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);

    const atTopLevel = parenDepth === 0 && braceDepth === 0 && bracketDepth === 0;
    if (atTopLevel && (ch === '=' || ch === '≈')) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * Kết xuất một khối biểu thức LaTeX thành HTML KaTeX:
 * - Giữ toàn bộ vế biến đổi trên cùng 1 hàng ngang nếu còn chỗ.
 * - Chỉ ngắt dòng tại dấu '=' / '≈' khi chạm giới hạn chiều rộng khung.
 */
function renderLatexSegmentHtml(rawLatex) {
  const cleaned = String(rawLatex || '').trim();
  if (!cleaned) return '';

  const chunks = splitAtomicEqualityChunks(cleaned);
  if (chunks.length <= 1) {
    const html = renderKatexHtml(cleaned, false);
    if (!html) return escapeHtml(`$${cleaned}$`);
    return `<span class="math-atomic">${html}</span>`;
  }

  return chunks
    .map((chunk) => {
      const html = renderKatexHtml(chunk, false);
      if (!html) return `<span class="math-atomic">${escapeHtml(chunk)}</span>`;
      return `<span class="math-atomic">${html}</span>`;
    })
    .join(' ');
}

/**
 * Tìm vị trí dấu ':' ngăn cách lời dẫn dài với chuỗi phép tính phía sau (ngoài ngoặc và ngoài $...$)
 */
function findIntroColonIndex(line) {
  let inMath = false;
  let parenDepth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '$' && line[i - 1] !== '\\') {
      inMath = !inMath;
    } else if (!inMath) {
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      else if (ch === ':' && parenDepth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Kết xuất một dòng đơn (không chứa \n) thành HTML KaTeX chuẩn xác
 */
function renderSingleLineHtml(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return '';

  // Tách token $...$ và văn bản thường bên ngoài
  const tokens = trimmed.split(/(\$[^$]+\$)/g).filter(Boolean);
  return tokens
    .map((tok) => {
      if (tok.startsWith('$') && tok.endsWith('$') && tok.length >= 2) {
        const inner = tok.slice(1, -1);
        return renderLatexSegmentHtml(inner);
      }

      // Hỗ trợ công thức viết dạng thuần chưa bọc $...$ (nếu có chứa ký hiệu toán đặc biệt)
      if (/[△∠⊥∥⇒⇔≈≤≥≠±×·π°²³√]|(?:\([^()]+\)\s*\/\s*\([^()]+\))/.test(tok)) {
        const converted = convertPlainMathToLatex(tok);
        return renderLatexSegmentHtml(converted);
      }

      return escapeHtml(tok);
    })
    .join('');
}

/**
 * Hàm dựng HTML KaTeX dùng chung cho cả giao diện Web và bộ xuất Video
 */
export function renderMathBlockHtml(text, { inline = false } = {}) {
  const raw = String(text || '');
  if (!raw.trim()) return '';

  // Gom các dòng bị tách cứng ngay trước dấu '=' hoặc '≈' về cùng 1 dòng
  // để tự động nằm gọn trên 1 hàng và chỉ xuống dòng khi chạm giới hạn khung
  const normalized = raw.replace(/\r?\n\s*([=≈])/g, ' $1');

  const rawLines = normalized.split(/\r?\n/);
  const finalLines = [];

  for (const rLine of rawLines) {
    const line = rLine.trim();
    if (!line) continue;

    // Nếu lời dẫn trước dấu ':' khá dài (>= 45 ký tự) và phía sau là chuỗi tính toán có phân số/nhiều dấu '='
    // thì tách phần phép tính xuống dòng ngay bên dưới lời dẫn cho thoáng mắt
    const colonIdx = findIntroColonIndex(line);
    if (!inline && colonIdx >= 45 && colonIdx < line.length - 1) {
      const before = line.slice(0, colonIdx + 1).trim();
      const after = line.slice(colonIdx + 1).trim();
      const hasComplexFormula =
        /\\d?frac|\\sqrt/.test(after) || (after.match(/[=≈]/g) || []).length >= 2;

      if (hasComplexFormula) {
        finalLines.push(before);
        finalLines.push(after);
        continue;
      }
    }

    finalLines.push(line);
  }

  if (inline) {
    return finalLines.map((ln) => renderSingleLineHtml(ln)).join(' ');
  }

  return finalLines
    .map((ln) => {
      const hasFraction = /\\d?frac/.test(ln);
      const cls = hasFraction ? 'math-line math-eq-line' : 'math-line';
      return `<div class="${cls}">${renderSingleLineHtml(ln)}</div>`;
    })
    .join('');
}

export default function MathText({ text, className = '', inline = false }) {
  const html = useMemo(() => renderMathBlockHtml(text, { inline }), [text, inline]);

  if (!html) return null;

  if (inline) {
    return (
      <span
        className={`math-text-block ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      className={`math-text-block ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
