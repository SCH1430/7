import { highlightPython } from './python-highlight.js';

const escape = value => String(value ?? '').replace(/[&<>"'\r]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','\r':'&#13;'}[character]));
const classes = value => String(value ?? '').split(/\s+/).filter(token => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(token)).join(' ');

// A pipe in a formula is not enough to make a table. Only consecutive rows
// with the bank's explicit spaced separators and a consistent width qualify.
function cells(line) {
  if (!line.includes(' | ') || line.includes('||')) return null;
  const parts = line.split(' | ');
  if (parts.length < 2 || parts.some(part => !part.trim())) return null;
  return parts;
}

function tableMarkup(rows) {
  const [header, ...body] = rows;
  return `<div class="prompt-table-wrap" tabindex="0" role="region" aria-label="Таблица из условия, можно прокручивать по горизонтали"><table class="prompt-table"><caption>Таблица из условия</caption><thead><tr>${header.map(value => `<th scope="col">${escape(value)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${row.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function textMarkup(value) {
  const lines = value.split('\n'), parts = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) parts.push(`<p class="prompt-paragraph">${escape(paragraph.join('\n'))}</p>`);
    paragraph = [];
  };
  for (let index = 0; index < lines.length;) {
    const row = cells(lines[index]);
    if (row) {
      let end = index + 1;
      const rows = [row];
      while (end < lines.length) {
        const next = cells(lines[end]);
        if (!next || next.length !== row.length) break;
        rows.push(next);end++;
      }
      // A nonnumeric header distinguishes the authored data tables from
      // adjacent arithmetic examples such as "1 | 2" and "3 | 4".
      const heading = row.some(cell => /[\p{L}№]/u.test(cell))
        && !row.some(cell => /[=<>→≡]/.test(cell))
        && (row.some(cell => /[\p{L}]{2,}|№/u.test(cell)) || rows.slice(1).some(values => values.some(cell => /^-?\d+(?:[.,]\d+)?$/.test(cell.trim()))));
      if (rows.length >= 2 && heading) {
        flush();parts.push(tableMarkup(rows));index = end;continue;
      }
    }
    if (!lines[index].trim()) flush();else paragraph.push(lines[index]);
    index++;
  }
  flush();
  return parts.join('');
}

function samples(value) {
  const match = /(^|\r?\n)Пример входа:[ \t]*\r?\n([\s\S]*?)\r?\nПример вывода:[ \t]*\r?\n([\s\S]*)$/.exec(value);
  if (!match) return null;
  return { before: value.slice(0, match.index), input: match[2], output: match[3] };
}

/** Safe display only: no markdown, math evaluation, or changes to task data. */
export function renderPrompt(value = '', { className = '' } = {}) {
  const source = String(value ?? '');
  const sample = samples(source), extra = classes(className);
  const prose = textMarkup(sample ? sample.before : source);
  const panels = sample ? `<div class="prompt-samples"><section class="prompt-sample"><h4>Пример входа:</h4><pre tabindex="0" aria-label="Пример входных данных"><code>${escape(sample.input)}</code></pre></section><section class="prompt-sample"><h4>Пример вывода:</h4><pre tabindex="0" aria-label="Пример результата"><code>${escape(sample.output)}</code></pre></section></div>` : '';
  return `<div class="prompt-content${extra ? ' ' + extra : ''}">${prose}${panels}</div>`;
}

/** The code node's textContent is exactly source, including indentation. */
export function renderCode(value = '', { label = 'Python', copy = true } = {}) {
  const source = String(value ?? '');
  return `<figure class="source-code"><figcaption class="source-code-header"><span>${escape(label)}</span>${copy ? '<button type="button" class="source-code-copy" data-copy-code aria-label="Скопировать код">Скопировать</button>' : ''}</figcaption><pre class="code-block" tabindex="0" aria-label="${escape(label)}"><code>${highlightPython(source)}</code></pre></figure>`;
}
