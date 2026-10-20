import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnPythonSync } from './helpers/python.mjs';
import { registerGrade9 } from '../js/bank-grade9.js';

const rows = [];
const sum = a => a.reduce((n, x) => n + x, 0);
const numeric = (prompt, answer, explanation, extra = {}) => ({ kind: 'number', prompt, answer: String(answer), explanation, points: 1, ...extra });
const textual = (prompt, answer, explanation, extra = {}) => ({ kind: 'text', prompt, answer: String(answer), explanation, points: 1, ...extra });
registerGrade9({
  add: (topic, key, title, level, reason, build) => rows.push({ topic, key: key.slice(4), title, level, reason, build }), sum, numeric, textual,
  codeOutput: (code, answer, explanation) => numeric('Какое число выведет программа Python?', answer, explanation, { code }),
  program: (prompt, answer, tests) => ({ kind: 'program', prompt, answer, tests, points: 3 }),
});
function random(seed) {
  let state = seed >>> 0;
  const r = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = a => a[r.int(0, a.length - 1)];
  r.array = (n, a, b) => Array.from({ length: n }, () => r.int(a, b));
  return r;
}
const match = (prompt, regex) => { const m = prompt.match(regex); assert.ok(m, `Unparsed condition: ${prompt}`); return m.slice(1); };
const numbers = (prompt, regex) => match(prompt, regex).map(Number);
const sequence = (prompt, regex) => match(prompt, regex)[0].split(', ').map(Number);

// These solvers read the rendered conditions, never the answer or solution steps.
function tableOracle(key, p) {
  switch (key) {
    case 'minimum': return sequence(p, /записаны числа ([\d, -]+)\./).sort((a, b) => a - b)[0];
    case 'maximum': return sequence(p, /записаны числа ([\d, -]+)\./).sort((a, b) => b - a)[0];
    case 'rectangle-range': { const [c1, r1, c2, r2] = match(p, /диапазон ([A-Z])(\d+):([A-Z])(\d+)/); let count = 0; for (let c = c1.charCodeAt(0); c <= c2.charCodeAt(0); c++) for (let r = +r1; r <= +r2; r++) count++; return count; }
    case 'nonadjacent-sum': { const values = sequence(p, /записаны числа ([\d, -]+)\./); const refs = [...p.matchAll(/A(\d)(?=[;)])/g)].map(m => +m[1] - 1); return refs.reduce((n, i) => n + values[i], 0); }
    case 'numeric-count': return [...p.matchAll(/в A\d число -?\d+/gi)].length;
    case 'if-value': { const [x, edge, bonus] = numbers(p, /A1 = (\d+)\. Вычислите =ЕСЛИ\(A1>=(\d+);A1\+(\d+);A1\)/); return x < edge ? x : x + bonus; }
    case 'sumif': { const values = sequence(p, /записаны числа ([\d, -]+)\./), [edge] = numbers(p, /строго больше (-?\d+)/); let n = 0; for (const x of values) if (x > edge) n += x; return n; }
    case 'percentage': { const [total, solved] = numbers(p, /заданий (\d+), в B1 выполнено (\d+)/); return 100 * solved / total; }
    case 'horizontal-copy': { const [row, shift] = numbers(p, /В C(\d+).*на (\d+) столбца/); return `=${String.fromCharCode(65 + shift)}${row}+$B$1`; }
    case 'average-add': { const [count, mean, added] = numbers(p, /арифметическое (\d+).*равно (\d+).*значением (\d+)/); const values = [...Array(count).fill(mean), added]; return sum(values) / values.length; }
    case 'mixed-copy': { const [row, dx, dy] = numbers(p, /В C(\d+).*на (\d+) столбца вправо и на (\d+) строки/); return `=$A${row + dy}+${String.fromCharCode(66 + dx)}$1`; }
    case 'conditional-average': { const values = sequence(p, /записаны числа ([\d, -]+)\./), [edge] = numbers(p, /строго больше (-?\d+)/); const good = values.filter(x => x > edge); return sum(good) / good.length; }
    case 'lookup-chain': { const [x, k, b] = numbers(p, /A1 = (\d+); B1 содержит =A1\*(\d+); C1 содержит =B1-(\d+)/); const cells = { A1: x }; cells.B1 = cells.A1 * k; cells.C1 = cells.B1 - b; cells.D1 = cells.C1 + cells.B1; return cells.D1; }
    case 'sum-product': { const price = sequence(p, /Цены в A1:A3: ([\d, ]+)\./), quantity = sequence(p, /Количества в B1:B3: ([\d, ]+)\./); let out = 0; for (let i = 0; i < 3; i++) for (let unit = 0; unit < quantity[i]; unit++) out += price[i]; return out; }
    case 'two-criteria': { const scores = sequence(p, /Баллы по строкам 1–5: ([\d, ]+)\./), absence = sequence(p, /тем же строкам: ([\d, ]+)\./), [edge] = numbers(p, /не меньше (\d+)/); return scores.map((s, i) => Number(!(s < edge || absence[i] > 1))).reduce((a, b) => a + b, 0); }
    default: throw new Error(`No table oracle: ${key}`);
  }
}
function networkOracle(key, p) {
  switch (key) {
    case 'domain-part': return new URL(match(p, /Дан адрес (\S+)\./)[0]).hostname;
    case 'url-file': return new URL(match(p, /В адресе (\S+) укажите/)[0]).pathname.split('/').at(-1);
    case 'dns-record': { const [name] = match(p, /соответствует (\S+)\?/); const line = p.split('\n').find(line => line.startsWith(name + ' — ')); return line.split(' — ')[1]; }
    case 'graph-degree': { const [node] = match(p, /узел ([A-E])\?/); return [...p.matchAll(/([A-E])–([A-E])/g)].filter(m => m[1] === node || m[2] === node).length; }
    case 'packet-count': { const [size, capacity] = numbers(p, /передать (\d+) байт.*более (\d+) байт/); let packets = 0, remaining = size; while (remaining > 0) { packets++; remaining -= capacity; } return packets; }
    case 'sequential-transfer': { const [a, b, speed] = numbers(p, /Файлы (\d+) Кбайт и (\d+) Кбайт.*скоростью (\d+) Кбайт/); return a / speed + b / speed; }
    case 'parallel-transfer': { const [a, va, b, vb] = numbers(p, /передачи: (\d+) Кбайт со скоростью (\d+) Кбайт\/с и (\d+) Кбайт со скоростью (\d+)/); let time = 0; while (time * va < a || time * vb < b) time++; return time; }
    case 'overhead-bytes': { const [count, payload, header] = numbers(p, /Передано (\d+) пакетов.*каждом (\d+) байт.*и (\d+) байт/); return count * payload + count * header; }
    case 'network-address': { const [address] = match(p, /IPv4-адрес ([\d.]+) и маску/); return address.split('.').map((n, i) => +n & [255, 255, 255, 0][i]).join('.'); }
    case 'two-hop-routes': { const adjacent = new Map(); for (const [, a, b] of p.matchAll(/([A-Z])–([A-Z])/g)) { if (!adjacent.has(a)) adjacent.set(a, new Set()); if (!adjacent.has(b)) adjacent.set(b, new Set()); adjacent.get(a).add(b); adjacent.get(b).add(a); } return [...adjacent.get('A')].filter(x => adjacent.get(x).has('Z')).length; }
    case 'via-node': { const d = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => i === j ? 0 : Infinity)); for (const [, a, b, n] of p.matchAll(/([A-D])–([A-D]) = (\d+)/g)) { const i = a.charCodeAt(0) - 65, j = b.charCodeAt(0) - 65; d[i][j] = d[j][i] = +n; } for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) d[i][j] = Math.min(d[i][j], d[i][k] + d[k][j]); return d[0][2] + d[2][3]; }
    case 'route-count-dag': { const edges = [...p.matchAll(/([A-F])→([A-F])/g)].map(m => [m[1], m[2]]); const visit = x => x === 'F' ? 1 : edges.filter(([a]) => a === x).reduce((n, [, b]) => n + visit(b), 0); return visit('A'); }
    case 'compress-pipeline': { const [size, setup, percent, speed] = numbers(p, /Файл (\d+) Кбайт.*за (\d+) с до (\d+)%.*скоростью (\d+)/); return setup + (size - size * (100 - percent) / 100) / speed; }
    case 'change-speed': { const [size, first, v1, v2] = numbers(p, /Файл (\d+) Кбайт.*первые (\d+) Кбайт со скоростью (\d+) Кбайт\/с, остаток со скоростью (\d+)/); return first / v1 + (size - first) / v2; }
    case 'packet-time': { const [size, header, speed] = numbers(p, /содержит (\d+) байт.*пакета (\d+) байт.*Скорость (\d+) бит/); let remaining = size, transmitted = 0; while (remaining > 0) { const payload = Math.min(100, remaining); transmitted += payload + header; remaining -= payload; } return transmitted / (speed / 8); }
    default: throw new Error(`No network oracle: ${key}`);
  }
}

test('grade 9 expansion contains sixty balanced distinct types with worked solutions', () => {
  assert.equal(rows.length, 60);
  assert.equal(new Set(rows.map(x => x.topic + '-' + x.key)).size, 60);
  for (const topic of ['g9-python', 'g9-programming', 'g9-tables', 'g9-networks']) for (const level of ['basic', 'standard', 'advanced']) assert.equal(rows.filter(x => x.topic === topic && x.level === level).length, 5);
  for (const [index, row] of rows.entries()) for (const seed of [0, 1, 19, 1430, 2026, 4294967295]) {
    const q = row.build(random(seed + index));
    assert.ok(q.prompt && q.answer !== undefined && q.explanation && row.reason);
    assert.ok(q.solutionSteps.length >= 2 && q.solutionSteps.length <= 5);
    assert.equal(new Set(q.solutionSteps).size, q.solutionSteps.length);
    assert.ok(q.solutionSteps.every(x => typeof x === 'string' && x.length >= 10));
    if (q.kind === 'program') { assert.ok(q.tests.length >= 5); assert.doesNotMatch(q.answer, /^\s*(?:import|from)\s/m); }
  }
});

test('grade 9 spreadsheet and network answers match independent condition solvers', () => {
  for (const [index, row] of rows.entries()) {
    if (!['g9-tables', 'g9-networks'].includes(row.topic)) continue;
    for (let seed = 0; seed < 40; seed++) {
      const q = row.build(random(seed * 7919 + index));
      const expected = row.topic === 'g9-tables' ? tableOracle(row.key, q.prompt) : networkOracle(row.key, q.prompt);
      if (q.kind === 'number') assert.ok(Math.abs(Number(q.answer) - Number(expected)) < 1e-9, `${row.key}: ${q.prompt}; ${q.answer} vs ${expected}`);
      else assert.equal(q.answer, String(expected), `${row.key}: ${q.prompt}`);
    }
  }
});

test('grade 9 traces execute in Python and every program test agrees with an independent oracle', () => {
  const samples = [];
  for (const [index, row] of rows.entries()) if (row.topic === 'g9-python' || row.topic === 'g9-programming') for (const seed of [1, 7, 19, 1430, 2026, 9973]) samples.push({ key: row.key, ...row.build(random(seed + index)) });
  const python = String.raw`import json,sys,io,contextlib,re
items=json.load(sys.stdin)
def run(code,source):
    saved=sys.stdin
    sys.stdin=io.StringIO(source)
    output=io.StringIO()
    try:
        with contextlib.redirect_stdout(output):
            exec(compile(code,'student-solution','exec'),{})
    finally:
        sys.stdin=saved
    return output.getvalue().strip().split()
def oracle(key,source,prompt):
    if key=='vowels':
        return str(sum(source.lower().count(c) for c in 'аеёиоуыэюя'))
    if key=='palindrome':
        s=''.join(source.lower().split())
        return 'ДА' if all(s[i]==s[len(s)-i-1] for i in range(len(s)//2)) else 'НЕТ'
    a=list(map(int,source.split()))
    if key=='abs-gap': return str(max(a)-min(a))
    if key=='minimum-three': return str(sorted(a)[0])
    if key=='even-indicator': return str(int((a[0]//2)*2==a[0]))
    if key=='last-digit': return str(int(str(abs(a[0]))[-1]))
    if key=='rectangle': return str(a[0]*a[1])+' '+str(a[0]+a[1]+a[0]+a[1])
    if key=='factorial':
        p=1
        for x in range(a[0],0,-1): p*=x
        return str(p)
    if key=='sum-even': return str(sum(x for x in a if (x//2)*2==x))
    if key=='reverse-list': return ' '.join(str(a[i]) for i in range(len(a)-1,-1,-1))
    if key=='digits-product':
        n=a[0]
        if n==0: return '0'
        p=1
        while n:
            p*=n%10
            n//=10
        return str(p)
    if key=='longest-run':
        best=0
        for start in range(len(a)):
            end=start
            while end<len(a) and a[end]==a[start]: end+=1
            best=max(best,end-start)
        return str(best)
    if key=='second-distinct':
        top=max(a)
        smaller=[x for x in a if x<top]
        return str(max(smaller)) if smaller else 'НЕТ'
    if key=='gcd':
        bound=max(a)
        candidates=[]
        for d in range(1,int(bound**0.5)+1):
            if bound%d==0: candidates.extend([d,bound//d])
        return str(max(d for d in candidates if a[0]%d==0 and a[1]%d==0))
    if key=='first-above':
        edge=int(re.search(r'строго больше (-?\d+)',prompt)[1])
        indices=[i for i,x in enumerate(a) if x>edge]
        return str(min(indices)) if indices else '-1'
    raise AssertionError(key)
count=0
for q in items:
    if 'code' in q:
        assert run(q['code'],'')==str(q['answer']).strip().split(),q
        count+=1
    else:
        for case in q['tests']:
            correct=oracle(q['key'],case['input'],q['prompt']).split()
            assert case['output'].strip().split()==correct,(q['key'],case,correct)
            assert run(q['answer'],case['input'])==correct,(q['key'],case,q['answer'])
            count+=1
print(count)
`;
  const result = spawnPythonSync(['-c', python], { input: JSON.stringify(samples), encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Number(result.stdout.trim()) >= 700);
  for (const item of samples.filter(x => x.kind === 'program')) assert.match(item.prompt, /1000000|1000|n ≤ 12/, item.key);
  for (const item of samples.filter(x => x.kind === 'program')) for (const entry of item.tests) assert.ok(entry.output.length <= 8000, item.key + ': excessive output');
});
