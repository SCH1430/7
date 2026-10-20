export function calculate(expression) {
  const source = String(expression).trim().replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').replaceAll(',', '.');
  if (!source) return 0;
  if (source.length > 240) throw new Error('Выражение слишком длинное.');
  const tokens = [];
  const re = /\s*(?:(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?|(\*\*|\/\/|[+\-*/%^()]))/gy;
  let cursor = 0;
  while (cursor < source.length) {
    re.lastIndex = cursor;
    const m = re.exec(source);
    if (!m) throw new Error('Используйте числа, скобки и знаки операций.');
    tokens.push(m[1] ? Number(m[1] + (m[2] || '')) : m[3]);
    cursor = re.lastIndex;
  }
  let i = 0, depth = 0;
  function finite(x) { if (!Number.isFinite(x)) throw new Error('Результат слишком велик или не определён.'); return x; }
  function atom() {
    if (++depth > 35) throw new Error('Слишком много вложенных скобок.');
    let value;
    if (tokens[i] === '(') { i++; value = sum(); if (tokens[i++] !== ')') throw new Error('Проверьте скобки.'); }
    else if (typeof tokens[i] === 'number') value = tokens[i++];
    else throw new Error('Ожидается число или открывающая скобка.');
    depth--; return finite(value);
  }
  function power() { let x = atom(); if (tokens[i] === '^' || tokens[i] === '**') { i++; x = finite(x ** unary()); } return x; }
  function unary() { if (tokens[i] === '+') {i++; return unary();} if (tokens[i] === '-') {i++; return -unary();} return power(); }
  function product() {
    let x = unary();
    while (['*', '/', '//', '%'].includes(tokens[i])) {
      const op = tokens[i++], y = unary();
      if (y === 0 && op !== '*') throw new Error('На ноль делить нельзя.');
      x = finite(op === '*' ? x * y : op === '/' ? x / y : op === '//' ? Math.floor(x / y) : x - Math.floor(x / y) * y);
    }
    return x;
  }
  function sum() { let x = product(); while (tokens[i] === '+' || tokens[i] === '-') { const op=tokens[i++], y=product(); x=finite(op==='+'?x+y:x-y); } return x; }
  const result = sum();
  if (i !== tokens.length) throw new Error('Проверьте порядок операций и скобки.');
  return Object.is(result, -0) ? 0 : result;
}
export function formatCalculator(value) { return Number.isInteger(value) && Math.abs(value) < 1e15 ? String(value) : String(Number(value.toPrecision(13))); }
