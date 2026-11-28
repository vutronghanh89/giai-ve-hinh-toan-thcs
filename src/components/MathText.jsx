import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * Chuẩn hóa tiếng Việt & đơn vị đo lỡ nằm bên trong dấu $...$
 * để KaTeX không bao giờ xóa khoảng trắng gây dính chữ (VD: "tạiDvàME" -> " tại D và ME").
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
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*(mm|cm|dm|km|m|độ|rad)(?=$|[^A-Za-zÀ-ỹ])/gi, (_, num, unit) => {
    if (unit.toLowerCase() === 'độ') return `${num}^\\circ`;
    return `${num}\\text{ ${unit}}`;
  });

  // Bọc các cụm từ tiếng Việt có dấu hoặc từ nối tiếng Việt thông dụng nằm trong biểu thức LaTeX
  const vnPhraseRegex =
    /(^|[\s,.;:()=<>+\-*/\\^_{}])((?:[A-Za-zÀ-ỹ]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][A-Za-zÀ-ỹ]*|\b(?:tai|va|hoac|voi|nen|suy|ra|vi|do|khi|theo|cat|bang|la|co|vuong|goc|song|dong|tam|ban|kinh|dien|tich|chu|vi|quat|lon|nho|don|vi|lam|tron|den|hang|phan|muoi|tram)\b)(?:\s+(?:[A-Za-zÀ-ỹ]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][A-Za-zÀ-ỹ]*|\b(?:tai|va|hoac|voi|nen|suy|ra|vi|do|khi|theo|cat|bang|la|co|vuong|goc|song|dong|tam|ban|kinh|dien|tich|chu|vi|quat|lon|nho|don|vi|lam|tron|den|hang|phan|muoi|tram)\b))*)(?=$|[\s,.;:()=<>+\-*/\\^_{}])/gi;

  s = s.replace(vnPhraseRegex, (full, prefix, phrase) => {
    const trimmedPhrase = phrase.trim();
    if (!trimmedPhrase) return full;
    const needsLeadingSpace = prefix === '' || /[^\s({[]/.test(prefix);
    const lead = needsLeadingSpace ? '\\ ' : '';
    return `${prefix}${lead}\\text{${trimmedPhrase}}\\ `;
  });

  // Phục hồi các khối \text{...} gốc
  s = s.replace(/__TEXSLOT_(\d+)__/g, (_, idx) => textSlots[Number(idx)] || '');

  return s.replace(/\s+/g, ' ').trim();
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

  s = s.replace(/([A-Za-z])_([A-Za-zÀ-ỹ0-9]+(?:\s+[A-Za-zÀ-ỹ0-9]+){0,2})/g, (_, base, sub) => {
    if (/^[0-9a-zA-Z]$/.test(sub)) return `${base}_${sub}`;
    return `${base}_{\\text{${sub.trim()}}}`;
  });

  s = s
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4');

  s = s
    .replace(/√\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/√([A-Za-z0-9.,]+)/g, '\\sqrt{$1}');

  let prev;
  let guard = 0;
  do {
    prev = s;
    s = s
      .replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\dfrac{$1}{$2}')
      .replace(/\(([^()]+)\)\s*\/\s*([A-Za-z0-9_.,^{}\\-]+(?:\s*\\cdot\s*[A-Za-z0-9_.,^{}\\-]+)*)/g, '\\dfrac{$1}{$2}')
      .replace(/([A-Za-z0-9_.,^{}\\-]+(?:\s*\\cdot\s*[A-Za-z0-9_.,^{}\\-]+)*)\s*\/\s*\(([^()]+)\)/g, '\\dfrac{$1}{$2}');
    guard++;
  } while (s !== prev && guard < 6);

  s = s.replace(
    /(^|[\s=≈(+×-])(\d+(?:[.,]\d+)?|[A-Z]{1,3}|\\pi)\s*\/\s*(\d+(?:[.,]\d+)?|[A-Z]{1,3})(?=$|[\s=≈)+×.,;:])/g,
    '$1\\dfrac{$2}{$3}'
  );

  s = s.replace(/\(\s*(mm|cm|dm|m|km|độ|rad)(\^[0-9]+)?\s*\)/gi, (_, unit, pow) => {
    return `\\ (\\text{${unit}}${pow || ''})`;
  });

  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Tách một chuỗi phép tính dài có nhiều dấu '=' hoặc '≈' (nằm ngoài ngoặc) thành nhiều dòng
 * để mỗi bước biến đổi nằm gọn trên 1 dòng riêng, không bị ngắt dòng giữa chừng.
 */
function splitMultiEqualityChain(line) {
  const parts = [];
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
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
 * Tìm vị trí dấu ':' tách giữa lời dẫn tiếng Việt và biểu thức toán dài (nằm ngoài ngoặc & ngoài $...$)
 */
function findLeadColonSplitIndex(line) {
  let inDollar = false;
  let parenDepth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '$' && line[i - 1] !== '\\') {
      inDollar = !inDollar;
    } else if (!inDollar) {
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
 * Kiểm tra xem phần biểu thức sau lời dẫn hoặc cả dòng có phải là công thức dài cần tách dòng riêng không
 */
function shouldBreakExpressionToOwnLine(exprPart) {
  const t = String(exprPart || '').trim();
  if (!t) return false;
  const eqCount = (t.match(/[=≈]/g) || []).length;
  const hasFractionOrRoot = /\\dfrac|\\frac|\\sqrt|\)\s*\/|\b\d+\s*\/\s*\d+\b/.test(t);
  return eqCount >= 2 || (eqCount >= 1 && (hasFractionOrRoot || t.length > 34));
}

/**
 * Tách một dòng trong lời giải thành các dòng con hợp lý:
 * 1. Tách lời dẫn trước dấu ':' nếu theo sau là công thức dài.
 * 2. Tách chuỗi biến đổi nhiều dấu '=' / '≈' thành từng dòng riêng biệt (mỗi vế 1 dòng).
 */
function expandSolutionLineIntoRows(rawLine) {
  const trimmed = String(rawLine || '').trim();
  if (!trimmed) return [];

  const rows = [];
  let working = trimmed;

  // Bước 1: Kiểm tra cấu trúc "<Lời dẫn tiếng Việt>: <Công thức dài>"
  const colonIdx = findLeadColonSplitIndex(working);
  if (colonIdx > 4 && colonIdx < working.length - 4) {
    const lead = working.slice(0, colonIdx + 1).trim();
    const rest = working.slice(colonIdx + 1).trim();
    if (shouldBreakExpressionToOwnLine(rest)) {
      rows.push({ text: lead, isEqStep: false, indent: false });
      working = rest;
    }
  }

  // Bước 2: Nếu dòng chỉ gồm 1 khối $...$ chứa nhiều dấu '=' / '≈', tách từng vế ra 1 dòng riêng
  const pureDollarMatch = working.match(/^\$([^$\n]+)\$$/);
  if (pureDollarMatch) {
    const innerTex = pureDollarMatch[1].trim();
    const chain = splitMultiEqualityChain(innerTex);
    if (chain.length >= 2 && (chain.length >= 3 || innerTex.length > 42)) {
      chain.forEach((seg, i) => {
        rows.push({
          text: `$${seg}$`,
          isEqStep: true,
          indent: i > 0
        });
      });
      return rows;
    }
  }

  // Bước 3: Nếu dòng kết thúc bằng một câu kết luận ngắn sau công thức dài (VD: "... = 623 (cm²). Vậy diện tích...")
  const sentenceSplitMatch = working.match(/^(\$[^$\n]+\$)\s*([.,;])\s+([A-ZÀ-Ỹ].+)$/);
  if (sentenceSplitMatch) {
    const firstPart = `${sentenceSplitMatch[1]}${sentenceSplitMatch[2]}`;
    const tailSentence = sentenceSplitMatch[3].trim();
    const subRows = expandSolutionLineIntoRows(firstPart);
    rows.push(...subRows);
    rows.push({ text: tailSentence, isEqStep: false, indent: false });
    return rows;
  }

  // Bước 4: Nếu là biểu thức dạng thường (không bọc $) có nhiều dấu '=' hoặc phân số
  if (!working.includes('$')) {
    const chain = splitMultiEqualityChain(working);
    if (chain.length >= 2 && (chain.length >= 3 || working.length > 42 || /\)\s*\/|\b\d+\s*\/\s*\d+\b/.test(working))) {
      chain.forEach((seg, i) => {
        rows.push({
          text: seg,
          isEqStep: true,
          indent: i > 0,
          plainMath: true
        });
      });
      return rows;
    }
  }

  rows.push({
    text: working,
    isEqStep: rows.length > 0,
    indent: false
  });
  return rows;
}

/**
 * Render đoạn văn bản hỗn hợp (tiếng Việt + biểu thức toán không bọc $)
 */
function renderMixedVietnameseAndMath(text, keyPrefix = 'seg') {
  const tokenRegex =
    /(\([^()]+\)\s*\/\s*(?:\([^()]+\)|[A-Za-z0-9_.,²³°π]+)|(?:△\s*[A-Z]{2,4}|∠\s*[A-Za-z0-9]{2,4}|√(?:\([^()]+\)|[A-Za-z0-9.,]+)|[A-Za-z]{1,3}(?:_[A-Za-z0-9]+)?(?:²|³)?)\s*(?:=|≈|⊥|∥|≤|≥|≠|<|>)\s*[^,.;:()]+|(?:△\s*[A-Z]{2,4}|∠\s*[A-Za-z0-9]{2,4}|√(?:\([^()]+\)|[A-Za-z0-9.,]+)|\b\d+\s*\/\s*\d+\b|[A-Z]{1,3}(?:²|³)))/g;

  const nodes = [];
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`${keyPrefix}-t-${idx++}`}>{text.slice(lastIndex, match.index)}</span>
      );
    }
    const rawToken = match[0];
    const latex = convertPlainMathToLatex(rawToken);
    const html = renderKatexHtml(latex, false);
    if (html) {
      nodes.push(
        <span
          key={`${keyPrefix}-m-${idx++}`}
          className="math-atomic mx-0.5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else {
      nodes.push(
        <span key={`${keyPrefix}-f-${idx++}`} className="math-atomic font-medium text-emerald-200">
          {rawToken}
        </span>
      );
    }
    lastIndex = match.index + rawToken.length;
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={`${keyPrefix}-end`}>{text.slice(lastIndex)}</span>);
  }

  return nodes.length > 0 ? nodes : text;
}

function renderInlineLatexOrText(lineText, rowKey) {
  if (lineText.includes('$')) {
    const parts = lineText.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
    return parts.map((part, pIdx) => {
      if (!part) return null;
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const tex = part.slice(2, -2).trim();
        const html = renderKatexHtml(tex, true);
        return html ? (
          <div
            key={`${rowKey}-disp-${pIdx}`}
            className="my-0.5 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <code key={`${rowKey}-disp-err-${pIdx}`}>{tex}</code>
        );
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        const tex = part.slice(1, -1).trim();
        const html = renderKatexHtml(tex, false);
        return html ? (
          <span
            key={`${rowKey}-inl-${pIdx}`}
            className="math-atomic mx-0.5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <code key={`${rowKey}-inl-err-${pIdx}`}>{tex}</code>
        );
      }
      return <span key={`${rowKey}-txt-${pIdx}`}>{part}</span>;
    });
  }

  return renderMixedVietnameseAndMath(lineText, rowKey);
}

/**
 * Component hiển thị văn bản & công thức Toán học chuẩn xác:
 * - Khắc phục dính chữ tiếng Việt trong LaTeX.
 * - Tự động xuống dòng riêng cho công thức dài và tách chuỗi biến đổi nhiều dấu '='.
 * - Giữ mỗi công thức trọn vẹn trên 1 dòng, không ngắt gãy giữa chừng.
 */
export default function MathText({ text, className = '', blockEquations = true }) {
  const renderedContent = useMemo(() => {
    const input = String(text ?? '');
    if (!input.trim()) return null;

    const rawLines = input.split('\n');
    return rawLines.map((rawLine, lineIdx) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return <div key={`empty-${lineIdx}`} className="h-1" />;

      if (!blockEquations) {
        return (
          <div
            key={`inline-line-${lineIdx}`}
            className={`leading-snug ${lineIdx > 0 ? 'mt-0.5' : ''}`}
          >
            {renderInlineLatexOrText(trimmed, `il-${lineIdx}`)}
          </div>
        );
      }

      const expandedRows = expandSolutionLineIntoRows(trimmed);
      return (
        <div
          key={`sol-line-${lineIdx}`}
          className={`flex flex-col gap-0.5 ${lineIdx > 0 ? 'mt-1' : ''}`}
        >
          {expandedRows.map((row, rIdx) => {
            if (row.plainMath) {
              const latex = convertPlainMathToLatex(row.text);
              const html = renderKatexHtml(latex, false);
              return (
                <div
                  key={`r-${lineIdx}-${rIdx}`}
                  className={`math-eq-line overflow-x-auto leading-snug ${
                    row.indent ? 'pl-4 sm:pl-6' : ''
                  }`}
                >
                  {html ? (
                    <span
                      className="math-atomic"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  ) : (
                    <span className="math-atomic">{row.text}</span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={`r-${lineIdx}-${rIdx}`}
                className={`leading-snug ${
                  row.isEqStep ? 'math-eq-line overflow-x-auto' : ''
                } ${row.indent ? 'pl-4 sm:pl-6' : ''}`}
              >
                {renderInlineLatexOrText(row.text, `r-${lineIdx}-${rIdx}`)}
              </div>
            );
          })}
        </div>
      );
    });
  }, [text, blockEquations]);

  return <div className={`math-text-block ${className}`}>{renderedContent}</div>;
}
