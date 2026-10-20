import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnPythonSync } from './helpers/python.mjs';
import { registerGrade10 } from '../js/bank-grade10.js';

// The small adapter deliberately tests this module independently of the bank's
// selection machinery. Arithmetic answers are recomputed from the visible task.
const templates = [];
const numeric = (prompt, answer, explanation, extra = {}) => ({ kind: 'number', prompt, answer: String(answer), explanation, points: 1, ...extra });
registerGrade10({
  add: (topicId, key, title, difficulty, difficultyReason, build) => templates.push({ id: `${topicId}-${key}`, topicId, key, title, difficulty, difficultyReason, build }),
  numeric,
  textual: (prompt, answer, explanation) => ({ kind: 'text', prompt, answer: String(answer), explanation, points: 1 }),
  codeOutput: (code, answer, explanation) => numeric('Какое число выведет программа Python?', answer, explanation, { code }),
  program: (prompt, answer, tests, starterCode) => ({ kind: 'program', prompt, answer, tests, starterCode, points: 3 }),
});
function random(seed) {
  let state = seed;
  const r = () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = a => a[r.int(0, a.length - 1)];
  r.array = (n, a, b) => Array.from({ length: n }, () => r.int(a, b));
  return r;
}
const range = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
const sum = a => a.reduce((s, n) => s + n, 0);
const captures = (p, regex) => { const m = p.match(regex); assert.ok(m, `${regex}: ${p}`); return m.slice(1).map(Number); };
const numbers = p => [...p.matchAll(/-?\d+/g)].map(m => Number(m[0]));

function expectedFromPrompt(key, p) {
  const n = numbers(p);
  switch (key) {
    case 'ext-not-implication': { const [a, b] = captures(p, /При A = (\d), B = (\d)/); return Number(a === 1 && b === 0); }
    case 'ext-exclusive-or': { const [a, b] = captures(p, /При A = (\d), B = (\d)/); return (a + b) % 2; }
    case 'ext-set-difference': return n[0] - n[2];
    case 'ext-set-complement': return n[0] - n[1];
    case 'ext-equivalence-chain': { const [a, b, c] = captures(p, /При A = (\d), B = (\d), C = (\d)/); return a === b && b !== c ? 0 : 1; }
    case 'ext-exactly-one': { const [a, b, both] = n; return (a - both) + (b - both); }
    case 'ext-interval-union': { const [a, b, c, d] = n; return new Set([...range(a, b), ...range(c, d)]).size; }
    case 'ext-divisible-or': { const [end, a, b] = captures(p, /от 1 до (\d+).*на (\d+) ИЛИ на (\d+)/); return range(1, end).filter(x => x % a === 0 || x % b === 0).length; }
    case 'ext-free-rows-or': { const count = n[0]; return range(0, 2 ** count - 1).filter(bits => (bits & 1) || (bits & 2)).length; }
    case 'ext-symmetric-interval': { const [a, b, c, d] = n; return range(Math.min(a, c), Math.max(b, d)).filter(x => (a <= x && x <= b) !== (c <= x && x <= d)).length; }
    case 'ext-triple-union': { const [a, b, c, ab, ac, bc, abc] = n; const onlyA = a - ab - ac + abc, onlyB = b - ab - bc + abc, onlyC = c - ac - bc + abc; return onlyA + onlyB + onlyC + (ab - abc) + (ac - abc) + (bc - abc) + abc; }
    case 'ext-exactly-two-sets': { const [ab, ac, bc, triple] = n; return ab - triple + ac - triple + bc - triple; }
    case 'ext-implication-bound': { const [end, b] = captures(p, /от 1 до (\d+).*x ≤ (\d+)/); return range(-1, end + 1).find(a => range(1, end).every(x => !(x <= b) || x < a)); }
    case 'ext-chain-row-count': { const [count] = captures(p, /всего (\d+) независимых/); return range(0, 2 ** count - 1).filter(bits => { const a = bits & 1, b = (bits >> 1) & 1, c = (bits >> 2) & 1; return (a === 0 || b === 1) && (b === 0 || c === 1); }).length; }
    case 'ext-counterexample-sum': { const [end, a, b] = captures(p, /от 1 до (\d+).*x > (\d+).*x > (\d+)/); return sum(range(1, end).filter(x => x > a && !(x > b))); }
    case 'ext-audio-duration': { const [size, rate, depth] = n; return size * 8 / depth / rate; }
    case 'ext-sample-count': { const [seconds, rate, channels] = n; return seconds * channels * rate; }
    case 'ext-packet-headers': { const [count, payload, header] = n; return count * payload + count * header; }
    case 'ext-palette-table': return n[0] * 24 / 8;
    case 'ext-variable-code-length': { const [a, b, c] = captures(p, /(\d+) букв А, (\d+) букв Б и (\d+) букв В/); return '0'.repeat(a).length + '10'.repeat(b).length + '11'.repeat(c).length; }
    case 'ext-padded-rows': { const [w, h, depth] = n; let rowBits = w * depth; while (rowBits % 8) rowBits++; return rowBits / 8 * h; }
    case 'ext-color-depth-saving': { const [w, h, before, after] = n; const original = w * h * before / 8, next = w * h * after / 8; return (original - next) / 1024; }
    case 'ext-alphabet-capacity': { const [length, bits] = n; let codes = 1; for (let i = 0; i < bits / length; i++) codes *= 2; return codes; }
    case 'ext-parity-blocks': { const [data, block] = n; let remaining = data, count = 0; while (remaining > 0) { count++; remaining -= block; } return count * block + count; }
    case 'ext-store-forward': { const [size, a, delay, b] = n; return size / a + delay + size / b; }
    case 'ext-prefix-missing': { const [, a, b] = p.match(/А — ([01]+), Б — ([01]+)/); const valid = ['00', '01', '10', '11'].filter(c => [a, b].every(old => !c.startsWith(old) && !old.startsWith(c))); assert.equal(valid.length, 1); return valid[0]; }
    case 'ext-record-overhead': { const [count, size, length, alphabet] = n; let width = 0, capacity = 1; while (capacity < alphabet) { width++; capacity *= 2; } let allocated = 0; while (allocated * 8 < width * length) allocated++; return size / count - allocated; }
    case 'ext-recode-length': { const [a, b, delta] = n; return delta * 8 / (b - a); }
    case 'ext-compression-choice': { const [size, pack, percent, speed] = n; const choices = [size / speed, size / speed * (percent / 100) + pack]; return choices.sort((a, b) => a - b)[0]; }
    case 'ext-packet-last': { const [size, payload, header] = n; let remains = size, transmitted = 0; while (remains > 0) { const part = Math.min(remains, payload); transmitted += part + header; remains -= part; } return transmitted; }
    case 'ext-tree-edges': return n[0] - 1;
    case 'ext-degree-sum': return n[0] + n[0];
    case 'ext-directed-complete': { const count = n[0]; let arcs = 0; for (let i = 0; i < count; i++) for (let j = 0; j < count; j++) if (i !== j) arcs++; return arcs; }
    case 'ext-weighted-average': { const [a, sa, b, sb] = n; const files = [...Array(a).fill(sa), ...Array(b).fill(sb)]; return sum(files) / files.length; }
    case 'ext-binary-decisions': { const depth = n[0]; let leaves = ['']; for (let i = 0; i < depth; i++) leaves = leaves.flatMap(prefix => [prefix + '0', prefix + '1']); return leaves.length; }
    case 'ext-bipartite': { const [a, b] = n; return range(1, a).flatMap(i => range(1, b).map(j => [i, j])).length; }
    case 'ext-ordered-roles': { const count = n[0]; return range(1, count).flatMap(a => range(1, count).filter(b => a !== b)).length; }
    case 'ext-parallel-schedule': { const [a, b, c] = n; let ready = 0; while (ready < a || ready < b) ready++; return ready + c; }
    case 'ext-remove-cycle-edges': { const [vertices, edges] = n; return edges - vertices + 1; }
    case 'ext-table-weighted-sum': { const [na, a, nb, b, discount] = n; return (na * a + nb * b) / 100 * (100 - discount); }
    case 'ext-grid-mandatory': {
      const [x, y, u, v] = captures(p, /в \((\d+), (\d+)\).*через точку \((\d+), (\d+)\)/);
      const count = (px, py, visited) => { const passed = visited || px === u && py === v; if (px === x && py === y) return Number(passed); return (px < x ? count(px + 1, py, passed) : 0) + (py < y ? count(px, py + 1, passed) : 0); };
      return count(0, 0, false);
    }
    case 'ext-binary-tree-total': { const [depth] = captures(p, /на уровне (\d+) — ни одного/); const count = d => d === 0 ? 1 : 1 + 2 * count(d - 1); return count(depth); }
    case 'ext-team-with-fixed': { const [count, k] = captures(p, /Из (\d+) учеников.*из (\d+) человек/); let answer = 0; for (let mask = 0; mask < 2 ** count; mask++) if ((mask & 1) && mask.toString(2).replace(/0/g, '').length === k) answer++; return answer; }
    case 'ext-adjacency-two-step': { const groups = [...p.matchAll(/соответственно ([01], [01], [01], [01])/g)].map(m => m[1].split(', ').map(Number)); let count = 0; for (let i = 0; i < 4; i++) if (groups[0][i] && groups[1][i]) count++; return count; }
    case 'ext-critical-path': { const [a, b, c, d, e] = [...p.matchAll(/[ABCDE] = (\d+)/g)].map(m => Number(m[1])); const ends = { A: a }; ends.B = ends.A + b; ends.C = ends.A + c; ends.D = ends.B + d; ends.E = Math.max(ends.C, ends.D) + e; return ends.E; }
    default: throw new Error(`No independent checker for ${key}`);
  }
}

test('grade 10 adds sixty balanced distinct templates with meaningful worked steps', () => {
  assert.equal(templates.length, 60);
  assert.equal(new Set(templates.map(t => t.id)).size, 60);
  assert.equal(new Set(templates.map(t => t.title)).size, 60);
  for (const topic of ['logic', 'encoding', 'algorithms', 'models']) for (const level of ['basic', 'standard', 'advanced']) {
    assert.equal(templates.filter(t => t.topicId === `g10-${topic}` && t.difficulty === level).length, 5);
  }
  for (const item of templates) for (const seed of [1, 23, 1430, 98765]) {
    const q = item.build(random(seed));
    assert.ok(q.prompt && q.answer !== undefined, item.id);
    assert.ok(q.solutionSteps.length >= 2 && q.solutionSteps.length <= 5, item.id);
    assert.ok(q.solutionSteps.every(step => step.length >= 10), item.id);
    assert.equal(new Set(q.solutionSteps).size, q.solutionSteps.length, item.id);
    if (q.kind === 'program') assert.ok(q.tests.length >= 5, item.id);
  }
});

test('grade 10 arithmetic and logic answers are checked independently from visible conditions', () => {
  const checked = new Set();
  for (const item of templates) for (let seed = 1; seed <= 40; seed++) {
    const q = item.build(random(seed * 2027));
    if (q.kind === 'program' || q.code) continue;
    const expected = expectedFromPrompt(item.key, q.prompt);
    if (q.kind === 'text') assert.equal(q.answer, expected, `${item.id}, seed=${seed}`);
    else assert.ok(Math.abs(Number(q.answer) - expected) < 1e-9, `${item.id}, seed=${seed}: ${q.answer} != ${expected}\n${q.prompt}`);
    checked.add(item.id);
  }
  assert.equal(checked.size, 45);
});

test('grade 10 Python traces and five programs pass execution and independent reference checks', () => {
  const samples = [];
  for (const item of templates) for (let seed = 1; seed <= 12; seed++) {
    const q = item.build(random(seed * 1957));
    if (q.code) samples.push({ id: item.id, key: item.key, code: q.code, prompt: q.prompt, tests: [{ input: '', output: q.answer }] });
    if (q.kind === 'program') samples.push({ id: item.id, key: item.key, code: q.answer, prompt: q.prompt, tests: q.tests });
  }
  const python = String.raw`import json, sys, io, contextlib, re
items = json.load(sys.stdin)
count = 0
covered = set()
for item in items:
    covered.add(item['id'])
    for case in item['tests']:
        if item['key'].startswith('ext-program-'):
            s = case['input'].strip()
            key = item['key']
            if key == 'ext-program-palindrome':
                expected = 'YES' if all(s[i] == s[len(s)-1-i] for i in range(len(s)//2)) else 'NO'
            elif key == 'ext-program-second-max':
                a = [int(x) for x in s.split()]
                expected = str(max(x for x in a if x != max(a)))
            elif key == 'ext-program-increasing-run':
                a = [int(x) for x in s.split()]
                lengths = [j-i+1 for i in range(len(a)) for j in range(i,len(a)) if all(a[k] < a[k+1] for k in range(i,j))]
                expected = str(max(lengths))
            elif key == 'ext-program-prefix-maximum':
                a = [int(x) for x in s.split()]
                expected = str(max(sum(a[:i]) for i in range(1,len(a)+1)))
            elif key == 'ext-program-overlap':
                p = re.search(r'подстроки ([01]+)',item['prompt']).group(1)
                expected = str(sum(s.startswith(p,i) for i in range(len(s))))
            assert expected == case['output'].strip(), (item['id'],case,expected)
        old = sys.stdin
        sys.stdin = io.StringIO(case['input'])
        output = io.StringIO()
        try:
            with contextlib.redirect_stdout(output):
                exec(compile(item['code'],item['id'],'exec'),{})
        finally:
            sys.stdin = old
        assert output.getvalue().strip() == case['output'].strip(), (item['id'],case,output.getvalue())
        count += 1
print(json.dumps({'types':len(covered),'executions':count}))
`;
  const run = spawnPythonSync(['-c', python], { input: JSON.stringify(samples), encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024 });
  assert.equal(run.status, 0, run.stderr);
  const evidence = JSON.parse(run.stdout);
  assert.equal(evidence.types, 15);
  assert.equal(evidence.executions, 600);
});
