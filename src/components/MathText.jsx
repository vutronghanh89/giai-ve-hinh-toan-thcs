import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * Render một chuỗi LaTeX sang HTML bằng KaTeX an toàn (không bao giờ crash giao diện)
 */
function renderKatexHtml(latex, displayMode = false) {
  try {
    return katex.renderToString(latex, {
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
 * Chuyển đổi biểu thức toán học viết dạng văn bản thường (VD: (π . R² . n) / 360, BC², ∠xOz, △ABC, √25)
 * sang chuẩn LaTeX hiển thị phân số dọc, căn thức, mũ và ký hiệu hình học sắc nét.
 */
export function convertPlainMathToLatex(rawExpr) {
  let s = String(rawExpr || '').trim();
  if (!s) return '';

  // Ký hiệu hình học & toán học cơ bản
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

  // Chỉ số dưới có chữ tiếng Việt hoặc số (VD: S_quạt lớn -> S_{\text{quạt lớn}}, S_1 -> S_1)
  s = s.replace(/([A-Za-z])_([A-Za-zÀ-ỹ0-9]+(?:\s+[A-Za-zÀ-ỹ0-9]+){0,2})/g, (_, base, sub) => {
    if (/^[0-9a-zA-Z]$/.test(sub)) return `${base}_${sub}`;
    return `${base}_{\\text{${sub.trim()}}}`;
  });

  // Lũy thừa Unicode
  s = s
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4');

  // Căn bậc hai: √(biểu thức) hoặc √25 hoặc √AB
  s = s
    .replace(/√\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/√([A-Za-z0-9.,]+)/g, '\\sqrt{$1}');

  // Phân số dạng (tử) / (mẫu), (tử) / mẫu, tử / (mẫu)
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

  // Phân số đơn giản: 1/2, 12 / 5, AB / CD
  s = s.replace(
    /(^|[\s=≈(+×-])(\d+(?:[.,]\d+)?|[A-Z]{1,3}|\\pi)\s*\/\s*(\d+(?:[.,]\d+)?|[A-Z]{1,3})(?=$|[\s=≈)+×.,;:])/g,
    '$1\\dfrac{$2}{$3}'
  );

  // Đơn vị đo đi kèm trong ngoặc: (cm²), (cm), (m²)
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
  let depth = 0;
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);

    if (depth === 0 && (ch === '=' || ch === '≈')) {
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
 * Kiểm tra xem một dòng văn bản có phải là dòng phương trình / dãy biến đổi công thức thuần túy không
 */
function isStandaloneEquationLine(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const startsLikeMath =
    /^(?:⇒|⇔|∴|∵)?\s*(?:S_[A-Za-zÀ-ỹ0-9_\s]+|[A-Z]{1,4}(?:²|³|\^2|\^3)?|∠[A-Za-z0-9]+|[a-z]\s*=)\s*(?:=|≈|≤|≥|<|>)/i.test(
      trimmed
    );
  const hasSlashFraction = /\)\s*\/|\b\d+\s*\/\s*\d+\b/.test(trimmed);
  const eqCount = (trimmed.match(/[=≈]/g) || []).length;
  return startsLikeMath && (eqCount >= 2 || hasSlashFraction);
}

/**
 * Render đoạn văn bản hỗn hợp (tiếng Việt + biểu thức toán không bọc $)
 * sao cho mọi cụm ký hiệu toán học đều được bọc atomic (không bao giờ gãy đôi giữa chừng).
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

/**
 * Component hiển thị văn bản & công thức Toán học chuẩn xác:
 * 1. Hỗ trợ trực tiếp LaTeX ($...$ và $$...$$) qua KaTeX.
 * 2. Tự động nhận diện và chuẩn hóa các công thức viết thường trong bài mẫu cũ
 *    (phân số dọc \dfrac, căn thức, số mũ, góc, tam giác).
 * 3. Tự động ngắt dòng thông minh tại dấu '=' / '≈' đối với dãy biến đổi dài
 *    và khóa chống gãy dòng giữa chừng cho từng cụm công thức.
 */
export default function MathText({ text, className = '', blockEquations = true }) {
  const renderedContent = useMemo(() => {
    const input = String(text ?? '');
    if (!input.trim()) return null;

    // Trường hợp 1: Chuỗi có chứa ký hiệu LaTeX tường minh ($...$ hoặc $$...$$)
    if (input.includes('$')) {
      const lines = input.split('\n');
      return lines.map((line, lineIdx) => {
        const parts = line.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
        return (
          <div key={`lx-line-${lineIdx}`} className={lineIdx > 0 ? 'mt-1.5' : ''}>
            {parts.map((part, pIdx) => {
              if (!part) return null;
              if (part.startsWith('$$') && part.endsWith('$$')) {
                const tex = part.slice(2, -2).trim();
                const html = renderKatexHtml(tex, true);
                return html ? (
                  <div
                    key={`disp-${pIdx}`}
                    className="my-1.5 overflow-x-auto py-0.5"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ) : (
                  <code key={`disp-err-${pIdx}`}>{tex}</code>
                );
              }
              if (part.startsWith('$') && part.endsWith('$')) {
                const tex = part.slice(1, -1).trim();
                const html = renderKatexHtml(tex, false);
                return html ? (
                  <span
                    key={`inl-${pIdx}`}
                    className="math-atomic mx-0.5"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ) : (
                  <code key={`inl-err-${pIdx}`}>{tex}</code>
                );
              }
              return <span key={`txt-${pIdx}`}>{part}</span>;
            })}
          </div>
        );
      });
    }

    // Trường hợp 2: Văn bản toán học chưa bọc $ (tương thích toàn bộ bài mẫu cũ & dữ liệu nhập tay)
    const rawLines = input.split('\n');
    return rawLines.map((rawLine, lineIdx) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return <div key={`empty-${lineIdx}`} className="h-2" />;

      if (blockEquations && isStandaloneEquationLine(trimmed)) {
        const eqSegments = splitMultiEqualityChain(trimmed);
        if (eqSegments.length >= 2) {
          return (
            <div
              key={`eq-chain-${lineIdx}`}
              className={`math-eq-line flex flex-col gap-1.5 ${lineIdx > 0 ? 'mt-1.5' : ''}`}
            >
              {eqSegments.map((seg, segIdx) => {
                const latex = convertPlainMathToLatex(seg);
                const html = renderKatexHtml(latex, false);
                return (
                  <div
                    key={`eq-step-${segIdx}`}
                    className={`overflow-x-auto py-0.5 ${segIdx > 0 ? 'pl-5 sm:pl-7' : ''}`}
                  >
                    {html ? (
                      <span
                        className="math-atomic"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    ) : (
                      <span className="math-atomic">{seg}</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
      }

      return (
        <div
          key={`mix-line-${lineIdx}`}
          className={`leading-relaxed ${lineIdx > 0 ? 'mt-1' : ''}`}
        >
          {renderMixedVietnameseAndMath(rawLine, `l${lineIdx}`)}
        </div>
      );
    });
  }, [text, blockEquations]);

  return <div className={`math-text-block ${className}`}>{renderedContent}</div>;
}
