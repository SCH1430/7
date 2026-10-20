import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { highlightPython, mountPythonHighlight } from '../js/python-highlight.js';

const parse = source => {
  const element = new JSDOM('<pre></pre>').window.document.querySelector('pre');
  element.innerHTML = highlightPython(source);
  return element;
};

test('Python syntax highlighting preserves code, whitespace and untrusted content', () => {
  const samples = [
    '', '\n', 'print("Привет, 1430!")\n',
    'def сумма(числа):\n\treturn sum(числа) # комментарий\n',
    'print("</span><img src=x onerror=alert(1)>")\n# & <script>alert(1)</script>',
    'if a <= 2 and b != None:\n    print(a ** 2)',
    'x = 0xFF + 0b1010 + 0o77 + .5 + 3.2e-4 + 1_000 + 2j',
    'a = 1\r\nb = 2\r',
  ];
  for (const source of samples) {
    const element = parse(source);
    assert.equal(element.textContent, source);
    assert.equal(element.querySelectorAll('script,img,a,input').length, 0);
    for (const node of element.querySelectorAll('*')) {
      assert.equal(node.tagName, 'SPAN');
      assert.match(node.className, /^py-token-(keyword|builtin|string|number|comment|operator)$/);
      assert.equal(node.attributes.length, 1);
    }
  }
});

test('comments, quoted strings and triple strings do not leak keyword highlighting', () => {
  const source = 'text = """for a in range(3):\n# not a comment\nprint(a)"""\n# def hidden():\nprint("a\\\"#b")';
  const element = parse(source);
  assert.equal(element.textContent, source);
  assert.equal(element.querySelectorAll('.py-token-keyword').length, 0);
  assert.equal(element.querySelectorAll('.py-token-comment').length, 1);
  assert.equal(element.querySelectorAll('.py-token-string').length, 2);
  assert.equal(element.querySelectorAll('.py-token-builtin').length, 1);
  assert.match(element.querySelector('.py-token-string').textContent, /# not a comment/);
  for (const code of ["r'\\n'", 'f"Ответ: {x}"', 'br"abc"', 'rf"abc"', "'''unfinished\n# data"]) {
    const result = parse(code);
    assert.equal(result.querySelectorAll('.py-token-string').length, 1);
    assert.equal(result.querySelector('.py-token-string').textContent, code);
  }
});

test('mounted layer preserves textarea identity, listeners, editing and error state', () => {
  const dom = new JSDOM('<label for="code">Код</label><div class="code-editor"><div>1</div><textarea id="code">print(1)</textarea></div>', { pretendToBeVisual: true });
  const document = dom.window.document, textarea = document.querySelector('textarea');
  let originalInputCalls = 0;
  textarea.addEventListener('input', () => originalInputCalls++);
  const instance = mountPythonHighlight(textarea);
  assert.equal(mountPythonHighlight(textarea), instance);
  assert.equal(document.querySelector('textarea'), textarea);
  assert.equal(textarea.labels.length, 1);
  assert.equal(textarea.getAttribute('wrap'), 'off');
  const shell = document.querySelector('.py-highlight-shell');
  const layer = shell.querySelector('.py-highlight-layer');
  assert.equal(layer.getAttribute('aria-hidden'), 'true');
  assert.equal(layer.textContent, 'print(1)');
  textarea.value = 'for i in range(2):\n    print(i)';
  textarea.dispatchEvent(new dom.window.Event('input'));
  assert.equal(originalInputCalls, 1);
  assert.equal(layer.textContent, textarea.value);
  assert.equal(layer.querySelectorAll('.py-token-keyword').length, 2);
  textarea.scrollTop = 30;
  textarea.scrollLeft = 16;
  textarea.dispatchEvent(new dom.window.Event('scroll'));
  assert.equal(layer.scrollTop, 30);
  assert.equal(layer.scrollLeft, 16);
  instance.setErrorLine(2);
  assert.equal(shell.dataset.errorLine, '2');
  assert.equal(textarea.getAttribute('aria-invalid'), 'true');
  assert.equal(shell.querySelector('.py-error-line').hidden, false);
  instance.setErrorLine(999);
  assert.equal(textarea.hasAttribute('aria-invalid'), false);
  instance.setErrorLine(1);
  textarea.value = 'print(42)\n';
  instance.refresh();
  assert.equal(textarea.hasAttribute('aria-invalid'), false);
  assert.equal(layer.querySelector('.py-layout-tail').textContent, '\u200b');
  assert.equal(layer.textContent.replace(/\u200b$/, ''), textarea.value);
  textarea.readOnly = true;
  instance.refresh();
  assert.equal(textarea.readOnly, true);
  instance.destroy();
  assert.equal(document.querySelector('.py-highlight-shell'), null);
  assert.equal(document.querySelector('textarea'), textarea);
  assert.equal(textarea.getAttribute('wrap'), null);
  assert.equal(textarea.value, 'print(42)\n');
  assert.equal(textarea.labels.length, 1);
  instance.destroy();
  dom.window.close();
});
