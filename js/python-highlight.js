/* Small local tokenizer for the educational Python editor. It never executes code. */
const KEYWORDS = new Set(('False None True and as assert async await break case class continue def del elif else except finally for from global if import in is lambda match nonlocal not or pass raise return try while with yield').split(' '));
const BUILTINS = new Set(('abs all any bin bool bytearray bytes callable chr complex dict divmod enumerate filter float format frozenset hash hex input int isinstance issubclass iter len list map max min next oct ord pow print range repr reversed round set slice sorted str sum tuple type zip Exception ValueError TypeError ZeroDivisionError IndexError KeyError RuntimeError StopIteration EOFError AssertionError ArithmeticError LookupError OverflowError RecursionError').split(' '));
const NUMBER = /^(?:0[xX][\da-fA-F](?:[\da-fA-F_]*[\da-fA-F])?|0[bB][01](?:[01_]*[01])?|0[oO][0-7](?:[0-7_]*[0-7])?|(?:\d(?:[\d_]*\d)?(?:\.(?:\d(?:[\d_]*\d)?)?)?|\.\d(?:[\d_]*\d)?)(?:[eE][+-]?\d(?:[\d_]*\d)?)?)[jJ]?/;
const WORD_START = /[\p{L}_]/u;
const WORD_PART = /[\p{L}\p{N}\p{M}_]/u;
const STRING_PREFIX = /^(?:[rRuUbBfF]|[rR][bBfF]|[bBfF][rR])(?=["'])/;
const escapeHtml = value => value.replace(/[&<>"'\r]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','\r':'&#13;'}[character]));
const span = (kind, value) => `<span class="py-token-${kind}">${escapeHtml(value)}</span>`;

/** Highlight source with fixed class names. textContent of the result is the source. */
export function highlightPython(value = '') {
  const code = String(value ?? '');
  const output = [];
  let position = 0;
  while (position < code.length) {
    const start = position, character = code[position];
    if (character === '#') {
      while (position < code.length && !/[\r\n]/.test(code[position])) position++;
      output.push(span('comment', code.slice(start, position)));
      continue;
    }
    const prefix = code.slice(position).match(STRING_PREFIX)?.[0] || '';
    const quotePosition = position + prefix.length;
    const quote = code[quotePosition];
    if (quote === '"' || quote === "'") {
      const triple = code.slice(quotePosition, quotePosition + 3) === quote.repeat(3);
      const delimiter = quote.repeat(triple ? 3 : 1);
      position = quotePosition + delimiter.length;
      while (position < code.length) {
        if (code[position] === '\\') { position = Math.min(code.length, position + 2); continue; }
        if (code.slice(position, position + delimiter.length) === delimiter) { position += delimiter.length; break; }
        if (!triple && /[\r\n]/.test(code[position])) break;
        position++;
      }
      output.push(span('string', code.slice(start, position)));
      continue;
    }
    if (/\d/.test(character) || (character === '.' && /\d/.test(code[position + 1] || ''))) {
      const number = code.slice(position).match(NUMBER)?.[0];
      if (number) { output.push(span('number', number)); position += number.length; continue; }
    }
    if (WORD_START.test(character)) {
      position++;
      while (position < code.length && WORD_PART.test(code[position])) position++;
      const word = code.slice(start, position);
      output.push(KEYWORDS.has(word) ? span('keyword', word) : BUILTINS.has(word) ? span('builtin', word) : escapeHtml(word));
      continue;
    }
    if (/[+\-*/%=!<>~^&|:@]/.test(character)) {
      position++;
      while (position < code.length && /[+\-*/%=!<>~^&|:@]/.test(code[position])) position++;
      output.push(span('operator', code.slice(start, position)));
      continue;
    }
    output.push(escapeHtml(character));
    position++;
  }
  return output.join('');
}

const mounted = new WeakMap();

/**
 * Adds a decorative text layer beneath the existing textarea without replacing it.
 * Call refresh() after setting textarea.value or calling setRangeText().
 */
export function mountPythonHighlight(textarea) {
  if (!textarea || textarea.tagName !== 'TEXTAREA') throw new TypeError('Нужен элемент textarea.');
  if (mounted.has(textarea)) return mounted.get(textarea);
  const document = textarea.ownerDocument, view = document.defaultView;
  const shell = document.createElement('div');
  shell.className = 'py-highlight-shell';
  const pre = document.createElement('pre');
  pre.className = 'py-highlight-layer';
  pre.setAttribute('aria-hidden', 'true');
  const code = document.createElement('code');
  pre.append(code);
  const errorLine = document.createElement('div');
  errorLine.className = 'py-error-line';
  errorLine.hidden = true;
  errorLine.setAttribute('aria-hidden', 'true');
  const oldInvalid = textarea.getAttribute('aria-invalid');
  const oldWrap = textarea.getAttribute('wrap');
  textarea.before(shell);
  shell.append(errorLine, pre, textarea);
  textarea.classList.add('py-highlight-input');
  textarea.setAttribute('wrap', 'off');
  let lastValue = null, line = null, destroyed = false;

  function syncScroll() {
    pre.scrollTop = textarea.scrollTop;
    pre.scrollLeft = textarea.scrollLeft;
    if (line != null) {
      const style = view?.getComputedStyle(textarea);
      const lineHeight = parseFloat(style?.lineHeight) || (parseFloat(style?.fontSize) || 13) * 1.7;
      const top = (parseFloat(style?.paddingTop) || 15) + (line - 1) * lineHeight - textarea.scrollTop;
      errorLine.style.height = `${lineHeight}px`;
      errorLine.style.transform = `translateY(${top}px)`;
      errorLine.hidden = top + lineHeight < 0 || (textarea.clientHeight > 0 && top > textarea.clientHeight);
    }
  }
  function syncSize() {
    if (textarea.clientWidth > 0) pre.style.width = `${textarea.clientWidth}px`;
    if (textarea.clientHeight > 0) pre.style.height = `${textarea.clientHeight}px`;
    syncScroll();
  }
  function setErrorLine(number) {
    const parsed = Number(number);
    line = Number.isInteger(parsed) && parsed > 0 && parsed <= textarea.value.split('\n').length ? parsed : null;
    if (line == null) {
      errorLine.hidden = true;
      delete shell.dataset.errorLine;
      if (oldInvalid == null) textarea.removeAttribute('aria-invalid'); else textarea.setAttribute('aria-invalid', oldInvalid);
    } else {
      shell.dataset.errorLine = String(line);
      textarea.setAttribute('aria-invalid', 'true');
      errorLine.hidden = false;
      syncScroll();
    }
  }
  function refresh() {
    if (destroyed) return;
    if (lastValue !== textarea.value) {
      lastValue = textarea.value;
      code.innerHTML = highlightPython(lastValue);
      // An empty final line needs a visible layout box, but is not part of the source.
      if (!lastValue || lastValue.endsWith('\n')) {
        const tail = document.createElement('span');
        tail.className = 'py-layout-tail';
        tail.textContent = '\u200b';
        code.append(tail);
      }
      setErrorLine(null);
    }
    syncSize();
  }
  const observer = view?.ResizeObserver ? new view.ResizeObserver(syncSize) : null;
  observer?.observe(textarea);
  textarea.addEventListener('input', refresh);
  textarea.addEventListener('scroll', syncScroll);
  textarea.addEventListener('focus', syncSize);
  view?.addEventListener('resize', syncSize);
  const api = {
    refresh, setErrorLine,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      textarea.removeEventListener('input', refresh);
      textarea.removeEventListener('scroll', syncScroll);
      textarea.removeEventListener('focus', syncSize);
      view?.removeEventListener('resize', syncSize);
      textarea.classList.remove('py-highlight-input');
      if (oldWrap == null) textarea.removeAttribute('wrap'); else textarea.setAttribute('wrap', oldWrap);
      if (oldInvalid == null) textarea.removeAttribute('aria-invalid'); else textarea.setAttribute('aria-invalid', oldInvalid);
      shell.before(textarea);
      shell.remove();
      mounted.delete(textarea);
    }
  };
  mounted.set(textarea, api);
  refresh();
  return api;
}
