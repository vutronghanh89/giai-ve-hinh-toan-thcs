import React, { useMemo } from 'react';
import katex from 'katex';

const VN_DIACRITIC_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

function normalizeUnicodeSubSup(str) {
  return String(str || '')
    .replace(/₀/g, '_0')
    .replace(/₁/g, '_1')
    .replace(/₂/g, '_2')
    .replace(/₃/g, '_3')
    .replace(/₄/g, '_4')
    .replace(/₅/g, '_5')
    .replace(/₆/g, '_6')
    .replace(/₇/g, '_7')
    .replace(/₈/g, '_8')
    .replace(/₉/g, '_9')
    .replace(/⁰/g, '^0')
    .replace(/¹/g, '^1')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/⁵/g, '^5')
    .replace(/⁶/g, '^6')
    .replace(/⁷/g, '^7')
    .replace(/⁸/g, '^8')
    .replace(/⁹/g, '^9');
}

/**
 * Chuyển đổi các phép chia dạng a/b hoặc (a + b)/c sang phân số đứng \dfrac{...}{...}
 */
function convertSlashFractionsToDfrac(latexStr) {
  let s = String(latexStr || '');
  if (!s.includes('/')) return s;

  // Bảo vệ các lệnh \dfrac{...}{...}, \frac{...}{...}, \text{...} có sẵn
  const slots = [];
  const stash = (m) => {
    const tok = `__FRACSLOT_${slots.length}__`;
    slots.push(m);
    return tok;
  };

  s = s.replace(/\\(?:d?frac)\{[^{}]*\}\{[^{}]*\}/g, stash);
  s = s.replace(/\\text\{[^{}]*\}/g, stash);

  const atomPattern =
    '(?:__FRACSLOT_\\d+__|[A-Za-z0-9_.,^{}\\\\]+(?:\\s*\\\\(?:cdot|times)\\s*[A-Za-z0-9_.,^{}\\\\]+)*)';

  // 1. Dạng phân số nằm gọn trong ngoặc đơn: (125/3) -> \left(\dfrac{125}{3}\right)
  s = s.replace(
    new RegExp(
      `\\(\\s*(${atomPattern}(?:\\s*[+-]\\s*${atomPattern})*)\\s*\\/\\s*(${atomPattern}(?:\\s*[+-]\\s*${atomPattern})*)\\s*\\)`,
      'g'
    ),
    '\\left(\\dfrac{$1}{$2}\\right)'
  );

  // 2. Dạng tử hoặc mẫu có ngoặc đơn: (π · R^2 · n) / 360 -> \dfrac{\pi \cdot R^2 \cdot n}{360}
  let prev;
  let guard = 0;
  do {
    prev = s;
    s = s
      .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\dfrac{$1}{$2}')
      .replace(new RegExp(`\\(([^()]+)\\)\\s*\\/\\s*(${atomPattern})`, 'g'), '\\dfrac{$1}{$2}')
      .replace(new RegExp(`(${atomPattern})\\s*\\/\\s*\\(([^()]+)\\)`, 'g'), '\\dfrac{$1}{$2}');
    guard++;
  } while (s !== prev && guard < 6);

  // 3. Dạng phân số không ngoặc: 125/3, AC/BC, 6 \cdot 8 / 10 -> \dfrac{...}{...}
  s = s.replace(
    new RegExp(`(${atomPattern})\\s*\\/\\s*(${atomPattern})`, 'g'),
    '\\dfrac{$1}{$2}'
  );

  for (let i = 0; i < 3; i++) {
    s = s.replace(/__FRACSLOT_(\d+)__/g, (_, idx) => slots[Number(idx)] || '');
  }

  return s;
}

/**
 * Chuẩn hóa tiếng Việt & đơn vị đo nằm bên trong dấu $...$
 * để KaTeX KHÔNG bao giờ in nghiêng chữ tiếng Việt hay làm dính liền các từ.
 */
export function sanitizeLatexVietnameseText(rawLatex) {
  let s = normalizeUnicodeSubSup(String(rawLatex || '').trim());
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
    /(\d+(?:[.,]\d+)?)\s*(mm|cm|dm|km|m|độ|rad)(\^[0-9]+)?(?=$|[^A-Za-zÀ-ỹ])/gi,
    (_, num, unit, pow) => {
      if (unit.toLowerCase() === 'độ') return `${num}^\\circ`;
      return `${num}${stash(`\\text{ ${unit}}${pow || ''}`)}`;
    }
  );

  // Đơn vị nằm trong ngoặc đơn: (cm^2) -> (\text{cm}^2)
  s = s.replace(
    /\(\s*(mm|cm|dm|m|km|độ|rad)(\^[0-9]+)?\s*\)/gi,
    (_, unit, pow) => `(${stash(`\\text{${unit}}${pow || ''}`)})`
  );

  // 5. Nhận diện từ tiếng Việt (bao gồm cả từ 1 chữ cái có dấu như: ở, à, ạ, ý, ...)
  const isMathIdentifier = (word) => {
    if (!word) return false;
    if (word === 'đpcm' || word === 'ĐPCM') return false;
    if (VN_DIACRITIC_REGEX.test(word)) return false;
    if (/^[A-Za-z]$/.test(word)) return true;
    if (/^(?:[A-Z]{2,6}|[xyz]O[xyz]|O[xyz]{1,2})$/.test(word)) return true;
    return false;
  };

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

  // 7. Chuyển đổi các phép chia '/' còn lại thành phân số đứng \dfrac
  s = convertSlashFractionsToDfrac(s);

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
  let s = normalizeUnicodeSubSup(String(rawExpr || '').trim());
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
    .replace(/√\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/√([A-Za-z0-9.,]+)/g, '\\sqrt{$1}');

  s = s.replace(
    /([A-Za-z])_([A-Za-zÀ-ỹ0-9]+(?:\s+[A-Za-zÀ-ỹ0-9]+){0,2})/g,
    (_, base, sub) => {
      if (/^[0-9a-zA-Z]$/.test(sub)) return `${base}_${sub}`;
      return `${base}_{\\text{${sub.trim()}}}`;
    }
  );

  s = convertSlashFractionsToDfrac(s);

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

  const sanitized = sanitizeLatexVietnameseText(cleaned);

  // Nếu biểu thức có chứa nhiều từ tiếng Việt dài, cho phép xuống dòng tự nhiên theo khung
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

const MATH_FUNC_WORDS = new Set(['sin', 'cos', 'tan', 'cot', 'log', 'ln']);
const UNIT_WORDS = new Set(['mm', 'cm', 'dm', 'km', 'm', 'độ', 'rad']);

function isVietnameseProseToken(token) {
  const clean = token.replace(/^[([{"']+|[)\]}"'.,;:!?]+$/g, '');
  if (!clean) return false;

  // Có dấu tiếng Việt (kể cả từ 1 chữ cái như "ở", "à", "ý") -> chắc chắn là tiếng Việt
  if (VN_DIACRITIC_REGEX.test(clean)) return true;

  // Từ có từ 2 chữ cái trở lên và chứa chữ thường -> tiếng Việt (trừ sin/cos/tan/cot, đơn vị đo, xOy/Oxy)
  if (clean.length >= 2 && /[a-z]/.test(clean)) {
    const lower = clean.toLowerCase();
    if (MATH_FUNC_WORDS.has(lower)) return false;
    if (UNIT_WORDS.has(lower)) return false;
    if (/^(?:[xyz]O[xyz]|O[xyz]{1,2})$/.test(clean)) return false;
    return true;
  }

  return false;
}

function isNontrivialMathExpression(expr) {
  const s = expr.trim();
  if (!s) return false;
  // Chứa phân số, dấu bằng/xấp xỉ/bất đẳng thức, phép nhân/cộng/trừ, mũ, chỉ số dưới, ký hiệu hình học/Hy Lạp, hàm lượng giác
  return (
    /[=≈<>≤≥≠±×·*/⊥∥⇒⇔△∠π°²³⁴√_^]/.test(s) ||
    /\b(?:sin|cos|tan|cot|log|ln)\b/.test(s)
  );
}

/**
 * Tách phần văn bản thường (ngoài dấu $...$) thành:
 * - Lời văn tiếng Việt (tự động xuống dòng chuẩn xác theo khung chứa)
 * - Biểu thức toán học (kết xuất bằng KaTeX với phân số đứng \dfrac, số mũ, ký hiệu chuẩn xác)
 */
function renderPlainTextWithSmartMath(plainText) {
  const text = String(plainText || '');
  if (!text) return '';

  const rawParts = text.split(/(\s+)/);
  const segments = [];
  let bufType = null; // 'prose' | 'math'
  let buf = '';

  const flush = () => {
    if (!buf) return;
    segments.push({ type: bufType, value: buf });
    buf = '';
    bufType = null;
  };

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    if (!part) continue;

    if (/^\s+$/.test(part)) {
      if (bufType) buf += part;
      else segments.push({ type: 'prose', value: part });
      continue;
    }

    // Dấu câu kết thúc mệnh đề tiếng Việt (':', ';', '!', '?', hoặc '.' đứng cuối/trước khoảng trắng)
    const isSentenceBreak = /[:;!?]$/.test(part) || /\.$/.test(part);
    const isProse = isVietnameseProseToken(part);

    if (isProse) {
      // Nếu là đơn vị đo (cm, cm², m...) đi ngay sau biểu thức toán thì giữ chung với khối toán
      const coreUnit = part.replace(/^[([{"']+|[)\]}"'.,;:!?]+$/g, '');
      const unitBase = coreUnit.replace(/[²³⁴^0-9]+$/g, '').toLowerCase();
      if (bufType === 'math' && UNIT_WORDS.has(unitBase)) {
        const trailingPunctMatch = part.match(/([.?!:;]+)$/);
        if (trailingPunctMatch) {
          const mathPart = part.slice(0, -trailingPunctMatch[1].length);
          buf += mathPart;
          flush();
          bufType = 'prose';
          buf = trailingPunctMatch[1];
        } else {
          buf += part;
        }
        continue;
      }

      if (bufType === 'math') flush();
      bufType = 'prose';
      buf += part;
      continue;
    }

    // Token hiện tại là ký hiệu toán / số / biến / phân số / ngoặc
    // Tách dấu ngoặc mở đầu nếu đang ở giữa câu tiếng Việt (VD: "(R = 24 cm" -> "(" thuộc prose, "R = 24 cm" thuộc math)
    let workPart = part;
    if (bufType === 'prose' && /^\(+/.test(workPart) && !/^\([^()]+\//.test(workPart)) {
      const leadParens = workPart.match(/^\(+/)[0];
      buf += leadParens;
      workPart = workPart.slice(leadParens.length);
      if (!workPart) continue;
    }

    if (bufType === 'prose') flush();
    bufType = 'math';

    if (isSentenceBreak) {
      const m = workPart.match(/^(.*?)([.,;:!?]+)$/);
      if (m && m[1]) {
        buf += m[1];
        flush();
        bufType = 'prose';
        buf = m[2];
      } else {
        buf += workPart;
        flush();
      }
    } else {
      buf += workPart;
    }
  }
  flush();

  return segments
    .map((seg) => {
      if (seg.type === 'math') {
        const leadSpace = seg.value.match(/^\s*/)[0];
        const trailSpace = seg.value.match(/\s*$/)[0];
        const core = seg.value.trim();

        // Tách dấu ngoặc đóng thừa ở cuối nếu trong biểu thức không có ngoặc mở tương ứng
        let cleanCore = core;
        let extraTrail = '';
        const openCount = (cleanCore.match(/\(/g) || []).length;
        const closeCount = (cleanCore.match(/\)/g) || []).length;
        if (closeCount > openCount) {
          const diff = closeCount - openCount;
          const tailMatch = cleanCore.match(new RegExp(`(\\){1,${diff}})$`));
          if (tailMatch) {
            extraTrail = tailMatch[1];
            cleanCore = cleanCore.slice(0, -extraTrail.length);
          }
        }

        if (isNontrivialMathExpression(cleanCore)) {
          const latex = convertPlainMathToLatex(cleanCore);
          return `${escapeHtml(leadSpace)}${renderLatexSegmentHtml(latex)}${escapeHtml(extraTrail + trailSpace)}`;
        }
      }
      return escapeHtml(seg.value);
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
      return renderPlainTextWithSmartMath(tok);
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
        /\\d?frac|\\sqrt|\//.test(after) || (after.match(/[=≈]/g) || []).length >= 2;

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
      const hasFraction = /\\d?frac|\//.test(ln);
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
