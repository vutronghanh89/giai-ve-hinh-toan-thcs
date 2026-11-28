import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Chuẩn hóa các biểu thức toán học viết thường thành LaTeX chuẩn sách giáo khoa
 * để hiển thị đồng nhất trên cả giao diện Web lẫn Video xuất ra.
 */
export function normalizePlainMathSegment(segment) {
  let s = String(segment || '');
  if (!s.trim()) return s;

  // Chuyển phân số dạng (a . b) / c hoặc a/b sang $\dfrac{...}{...}$
  s = s.replace(
    /\(([^()]+)\)\s*\/\s*(\d+|[a-zA-Z0-9^]+|\([^()]+\))/g,
    (_, num, den) => {
      const cleanDen = den.startsWith('(') && den.endsWith(')') ? den.slice(1, -1) : den;
      return `$\\dfrac{${num.trim()}}{${cleanDen.trim()}}$`;
    }
  );

  s = s.replace(
    /(?<![\w/\\])(\d+)\s*\/\s*(\d+)(?![\w/])/g,
    (_, num, den) => `$\\dfrac{${num}}{${den}}$`
  );

  // Chuyển các ký hiệu Unicode nếu dữ liệu cũ chưa bọc $...$
  s = s.replace(/∠([A-Z]{1,3})/g, (_, ang) => `$\\widehat{${ang}}$`);
  s = s.replace(/△([A-Z]{3})/g, (_, tri) => `$\\triangle ${tri}$`);
  s = s.replace(/⊥/g, '$\\perp$');
  s = s.replace(/∥/g, '$\\parallel$');
  s = s.replace(/⇒/g, '$\\Rightarrow$');
  s = s.replace(/⇔/g, '$\\Leftrightarrow$');

  return s;
}

export function renderMathToHtml(rawText) {
  const input = String(rawText ?? '');
  if (!input) return '';

  // Tách các khối $$...$$ và $...$
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  const rawParts = input.split(tokenRegex);

  const normalizedParts = rawParts.map((part) => {
    if (!part) return '';
    if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('$') && part.endsWith('$'))) {
      return part;
    }
    return normalizePlainMathSegment(part);
  });

  const recombined = normalizedParts.join('');
  const finalTokens = recombined.split(tokenRegex);

  return finalTokens
    .map((tok) => {
      if (!tok) return '';
      if (tok.startsWith('$$') && tok.endsWith('$$')) {
        const expr = tok.slice(2, -2).trim();
        try {
          return katex.renderToString(expr, {
            displayMode: true,
            throwOnError: false,
            strict: false
          });
        } catch {
          return escapeHtml(tok);
        }
      }
      if (tok.startsWith('$') && tok.endsWith('$')) {
        const expr = tok.slice(1, -1).trim();
        try {
          const html = katex.renderToString(expr, {
            displayMode: false,
            throwOnError: false,
            strict: false
          });
          return `<span class="math-atomic">${html}</span>`;
        } catch {
          return escapeHtml(tok);
        }
      }
      return escapeHtml(tok).replace(/\n/g, '<br/>');
    })
    .join('');
}

export default function MathText({ text, className = '', inline = false }) {
  const html = useMemo(() => renderMathToHtml(text), [text]);
  const Tag = inline ? 'span' : 'div';

  return (
    <Tag
      className={`math-text-block ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
