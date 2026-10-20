import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderPrompt, renderCode } from '../js/presentation.js';
import { TEMPLATE_CATALOG, BANK_STATS, generateQuestions } from '../js/bank.js';

const dom = new JSDOM('<main></main>');
const root = dom.window.document.querySelector('main');
const parse = html => { root.innerHTML = html;return root; };
const compact = value => value.replace(/\s+/g, ' ').trim();
function promptText(node) {
  return [...node.children].map(child => {
    if (child.matches('.prompt-table-wrap')) return [...child.querySelectorAll('tr')].map(row => [...row.cells].map(cell => cell.textContent).join(' | ')).join('\n');
    if (child.matches('.prompt-samples')) return [...child.querySelectorAll('.prompt-sample')].map(panel => `${panel.querySelector('h4').textContent}\n${panel.querySelector('pre').textContent}`).join('\n');
    return child.textContent;
  }).join('\n');
}

test('all 800 task prompts keep their complete content through display formatting', () => {
  let tables = 0, samples = 0;
  for (const row of TEMPLATE_CATALOG) {
    const q = generateQuestions({ grade: row.grade, templateIds: [row.id], seed: 1430, variant: 7 })[0];
    const before = JSON.stringify(q), element = parse(renderPrompt(q.prompt)).firstElementChild;
    assert.equal(compact(promptText(element)), compact(q.prompt), row.id);
    assert.equal(JSON.stringify(q), before);
    tables += element.querySelectorAll('table').length;
    if (q.kind === 'program') {
      assert.equal(element.querySelectorAll('.prompt-sample').length, 2, row.id);
      assert.equal(element.querySelector('.prompt-sample pre').textContent, q.tests[0].input.trim(), row.id);
      assert.equal(element.querySelectorAll('.prompt-sample pre')[1].textContent, q.tests[0].output.trim(), row.id);
      samples++;
    }
  }
  assert.ok(tables >= 2, "all existing tables remain formatted");
  assert.equal(samples, BANK_STATS.programmingTemplates);
});

test('tables have headers, captions and keyboard scrolling without parsing formulas', () => {
  let element = parse(renderPrompt('Условие\n№ | Значение\n1 | <tag>\n2 | 45\nНайдите сумму.'));
  const table = element.querySelector('table');assert.ok(table);
  assert.equal(table.querySelector('caption').textContent, 'Таблица из условия');
  assert.deepEqual([...table.querySelectorAll('th')].map(cell => [cell.getAttribute('scope'), cell.textContent]), [['col', '№'], ['col', 'Значение']]);
  assert.equal(table.querySelector('td:nth-child(2)').textContent, '<tag>');assert.equal(element.querySelector('tag'), null);
  assert.equal(element.querySelector('.prompt-table-wrap').tabIndex, 0);
  for (const text of ['A | B', 'A | B\nB | C', '1 | 2\n3 | 4', '|A| = 5, |B| = 9', 'x | y = 3\na | b = 4', 'Имя | Баллы\nИван | 5 | лишнее']) {
    element = parse(renderPrompt(text));assert.equal(element.querySelector('table'), null, text);assert.equal(compact(element.textContent), compact(text));
  }
});

test('sample panels preserve empty lines, leading whitespace, line endings and literal text', () => {
  for (const [input, output] of [['\ntext\n\n', '\n2\n'], ['', ''], ['  1  2\n\t3', '<script>alert(1)</script>'], ['one\r\n\r\ntwo', 'a\r\nb']]) {
    const element = parse(renderPrompt(`Условие.\n\nПример входа:\n${input}\nПример вывода:\n${output}`));
    assert.equal(element.querySelectorAll('.prompt-sample pre')[0].textContent, input);
    assert.equal(element.querySelectorAll('.prompt-sample pre')[1].textContent, output);
    assert.equal(element.querySelector('script'), null);
  }
});

test('static highlighted code preserves exact source and only emits safe markup', () => {
  for (const source of ['\n', 'for i in range(3):\n\tprint(i)\n', 'a = 1\r\nb = 2\r', 'print("</code><img src=x onerror=alert(1)>")\n# & <script>']) {
    const element = parse(renderCode(source, { label: '<img src=x>', copy: true }));
    assert.equal(element.querySelector('.source-code code').textContent, source);
    assert.equal(element.querySelectorAll('img,script').length, 0);
    assert.equal(element.querySelectorAll('[data-copy-code]').length, 1);
    assert.equal(element.querySelector('.source-code figcaption span').textContent, '<img src=x>');
    assert.equal(element.querySelector('.source-code pre').tabIndex, 0);
  }
  assert.equal(parse(renderCode('print(1)', { copy: false })).querySelector('[data-copy-code]'), null);
  const attack = parse(renderPrompt('<img src=x onerror=alert(1)> & text', { className: 'ctor-condition x" onclick="alert(1)' }));
  assert.equal(attack.querySelector('img'), null);assert.equal(attack.firstElementChild.getAttribute('onclick'), null);assert.ok(attack.firstElementChild.classList.contains('ctor-condition'));
});
