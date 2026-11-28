import React, { useMemo } from 'react';
import katex from 'katex';

const VN_DIACRITIC_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

/**
 * Chuẩn hóa tiếng Việt & đơn vị đo nằm bên trong dấu $...$
 * để KaTeX KHÔNG bao giờ in nghiêng chữ tiếng Việt hay làm dính liền các từ.
 */
export function sanitizeLatexVietnameseText(rawLatex) {
  let s = String(rawLatex || '').trim();
  if (!s) return '';

  // 1. Tách các hàm lượng giác viết dính tên góc (VD: \sinB -> \sin B, sinB -> \sin B)
  s = s.replace(/\\(sin|cos|tan|cot|log|ln)\s*([A-Za-z0-9])/g, '\\$1 $2');
  s = s.replace(/(^|[^\\A-Za-zÀ-ỹ])(sin|cos|tan|cot)\s+([A-Z])/g, '$1\\$2 $3');

  // 2. Tách các khối \text{...}, \mathrm{...}, \textbf{...} có sẵn để bảo toàn
  const protectedSlots = [];
  const stash = (val) => {
    const token = `__SLOT_${protectedSlots.length}__`;
    protectedSlots.push(val);
    return token;
  };

  s = s.replace(/\\(?:text|mathrm|textbf|textit)\{([^{}]*)\}/g, (_, inner) =>
    stash(`\\text{${inner}}`)
  );

  // 3. Tách toàn bộ lệnh LaTeX (\dfrac, \triangle, \widehat, \pi, \approx, \sin, ...)
  s = s.replace(/\\[a-zA-Z]+/g, (cmd) => stash(cmd));

  // 4. Tách số dính liền đơn vị đo (VD: 24cm -> 24\text{ cm}, 150° -> 150^\circ)
  s = s.replace(
    /(\d+(?:[.,]\d+)?)\s*(mm|cm|dm|km|m|độ|rad)(?=$|[^A-Za-zÀ-ỹ])/gi,
    (_, num, unit) => {
      if (unit.toLowerCase() === 'độ') return `${num}^\\circ`;
      return `${num}${stash(`\\text{ ${unit}}`)}`;
    }
  );

  // 5. Nhận diện từ tiếng Việt (bao gồm cả từ 1 chữ cái có dấu như: ở, à, ạ, ý, ổ, ế, ...)
  const isMathIdentifier = (word) => {
    if (!word) return false;
    if (word === 'đpcm' || word === 'ĐPCM') return false;
    // Bất kỳ từ nào có dấu tiếng Việt (kể cả 1 ký tự như "ở", "à", "ý") đều là tiếng Việt
    if (VN_DIACRITIC_REGEX.test(word)) return false;
    // 1 chữ cái Latin đơn (A, B, C, x, y, R, r, S, n, ...)
    if (/^[A-Za-z]$/.test(word)) return true;
    // Tên điểm/đoạn/góc/đa giác viết hoa (AB, BC, ABC, ADME, ...) hoặc hệ trục Oxy, xOy
    if (/^(?:[A-Z]{2,6}|[xyz]O[xyz]|O[xyz]{1,2})$/.test(word)) return true;
    return false;
  };

  // Quét từng token từ / khoảng trắng / ký hiệu để gom các từ tiếng Việt liền nhau thành \text{...}
  const rawTokens = s.split(/(\s+)/);
  const out = [];
  let vnBuffer = [];
  let prevWasMathOrWord = false;

  const flushVnBuffer = (nextIsMathOrWord) => {
    if (vnBuffer.length === 0) return;
    const phrase = vnBuffer.join(' ');
    const lead = prevWasMathOrWord ? ' ' : '';
    const trail = nextIsMathOrWord ? ' ' : '';
    out.push(`\\text{${lead}${phrase}${trail}}`);
    vnBuffer = [];
    prevWasMathOrWord = true;
  };

  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];
    if (!tok) continue;

    if (/^\s+$/.test(tok)) {
      if (vnBuffer.length === 0) {
        out.push(tok);
      }
      continue;
    }

    // Kiểm tra từ tiếng Việt (cho phép 1 ký tự nếu có dấu tiếng Việt, hoặc >= 2 ký tự chữ cái)
    const plainWordMatch = tok.match(/^([([{"']*)([A-Za-zÀ-ỹ]+)([)\]}"'.,;:!?]*)$/);
    if (plainWordMatch) {
      const [, openPunc, coreWord, closePunc] = plainWordMatch;
      if (!isMathIdentifier(coreWord)) {
        if (openPunc) {
          flushVnBuffer(false);
          out.push(openPunc);
          prevWasMathOrWord = false;
        }
        vnBuffer.push(coreWord);
        if (closePunc) {
          flushVnBuffer(false);
          out.push(closePunc);
          prevWasMathOrWord = false;
        }
        continue;
      }
    }

    // Token hiện tại là biểu thức Toán / số / placeholder lệnh LaTeX
    const startsWithMathChar = /^[A-Za-z0-9_\\]/.test(tok);
    flushVnBuffer(startsWithMathChar);
    out.push(tok);
    prevWasMathOrWord = /[A-Za-z0-9_)\]}]$/.test(tok);
  }

  flushVnBuffer(false);
  s = out.join('');

  // 6. Phục hồi toàn bộ lệnh LaTeX & các khối \text{...} đã tách
  for (let pass = 0; pass < 3; pass++) {
    s = s.replace(/__SLOT_(\d+)__/g, (_, idx) => protectedSlots[Number(idx)] || '');
  }

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
 * Chuyển đổi cụm ký hiệu toán học viết dạng văn bản thường sang chuẩn LaTeX
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
    .replace(/π/g, '\\pi ')
    .replace(/°/g, '^\\circ')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/√\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/√([A-Za-z0-9.,]+)/g, '\\sqrt{$1}');

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
 * - Nếu chứa lời văn tiếng Việt dài: cho phép ngắt dòng tự nhiên theo khung chứa.
 * - Nếu là dãy biến đổi toán học thuần túy: giữ liền trên 1 hàng ngang và chỉ xuống dòng ngay trước dấu '=' / '≈' khi chạm mép khung.
 */
function renderLatexSegmentHtml(rawLatex) {
  const cleaned = String(rawLatex || '').trim();
  if (!cleaned) return '';

  const sanitized = sanitizeLatexVietnameseText(cleaned);

  // Nếu biểu thức có chứa nhiều từ tiếng Việt (VD: \text{...}), không ép nowrap toàn khối
  // để tránh tràn khung chứa trên Đề bài / GT-KL
  const textMatches = sanitized.match(/\\text\{[^}]+\}/g) || [];
  const totalVietnameseWords = textMatches.join(' ').trim().split(/\s+/).filter(Boolean).length;
  if (totalVietnameseWords >= 3) {
    const html = renderKatexHtml(cleaned, false);
    if (!html) return escapeHtml(`$${cleaned}$`);
    return `<span class="math-inline-wrap">${html}</span>`;
  }

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
 * Render văn bản thường (nằm NGOÀI dấu $...$) sao cho:
 * - Toàn bộ câu văn tiếng Việt tự động xuống dòng chuẩn xác theo độ rộng khung chứa (không bao giờ tràn ngang).
 * - Các ký hiệu toán rời rạc (150°, cm², △ABC, ∠ABC, ⊥, ∥, π, ≈, √...) được kết xuất đẹp mắt.
 */
function renderPlainProseWithInlineSymbols(plainText) {
  const text = String(plainText || '');
  if (!text) return '';

  // Chỉ bắt các cụm ký hiệu toán học cục bộ (không nuốt cả câu văn tiếng Việt)
  const inlineMathPattern =
    /(△\s*[A-Za-z0-9]+|∠\s*[A-Za-z0-9]{2,4}|\b[A-Z]{1,3}\s*[⊥∥]\s*[A-Z]{1,3}\b|\b(?:mm|cm|dm|km|m)[²³⁴]|\d+(?:[.,]\d+)?°|√\([^()]+\)|√[A-Za-z0-9.,]+|[⊥∥⇒⇔≈≤≥≠π])/g;

  const parts = text.split(inlineMathPattern);
  return parts
    .map((part, idx) => {
      if (!part) return '';
      if (idx % 2 === 1) {
        // Đơn vị có số mũ như cm² -> giữ font thẳng đẹp mắt
        const unitPowMatch = part.match(/^(mm|cm|dm|km|m)([²³⁴])$/);
        if (unitPowMatch) {
          const exp = { '²': '2', '³': '3', '⁴': '4' }[unitPowMatch[2]] || '';
          return `${escapeHtml(unitPowMatch[1])}<sup>${exp}</sup>`;
        }
        const latex = convertPlainMathToLatex(part);
        const html = renderKatexHtml(latex, false);
        if (html) return `<span class="math-atomic">${html}</span>`;
      }
      return escapeHtml(part);
    })
    .join('');
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

  const tokens = trimmed.split(/(\$[^$]+\$)/g).filter(Boolean);
  return tokens
    .map((tok) => {
      if (tok.startsWith('$') && tok.endsWith('$') && tok.length >= 2) {
        const inner = tok.slice(1, -1);
        return renderLatexSegmentHtml(inner);
      }
      return renderPlainProseWithInlineSymbols(tok);
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
