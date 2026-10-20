import assert from 'node:assert/strict';
import { spawnPythonSync } from './helpers/python.mjs';

import { GRADES, BANK_STATS, TEMPLATE_CATALOG, LEGACY_BANK_VERSION, isTemplateAvailable, generateQuestions, checkAnswer } from '../js/bank.js';
assert.equal(GRADES.length, 5);
assert.equal(BANK_STATS.topics, 20);
assert.equal(BANK_STATS.templates, 800);
const covered = new Set();
const pythonSamples = [];
let generated = 0;
let independentMathChecks = 0;

// Use different algorithms to check the graph/combinatorics answer keys.
function checkMathKey(q) {
  if (q.templateId === 'g9-networks-route') {
    const graph = Array.from({ length: 4 }, (_, a) => Array.from({ length: 4 }, (_, b) => a === b ? 0 : Infinity));
    for (const [, a, b, distance] of q.prompt.matchAll(/([ABCD])–([ABCD]) = (\d+)/g)) {
      const x = a.charCodeAt(0) - 65, y = b.charCodeAt(0) - 65;
      graph[x][y] = graph[y][x] = Number(distance);
    }
    for (let k = 0; k < 4; k++) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) graph[a][b] = Math.min(graph[a][b], graph[a][k] + graph[k][b]);
    assert.equal(Number(q.answer), graph[0][3]);
  } else if (q.templateId === 'g11-graphs-grid') {
    const [, right, up] = q.prompt.match(/(\d+) шагов вправо и (\d+) шагов вверх/);
    const routes = Array.from({ length: Number(up) + 1 }, () => Array(Number(right) + 1).fill(1));
    for (let y = 1; y <= Number(up); y++) for (let x = 1; x <= Number(right); x++) routes[y][x] = routes[y - 1][x] + routes[y][x - 1];
    assert.equal(Number(q.answer), routes[Number(up)][Number(right)]);
  } else if (q.templateId === 'g11-data-remainders') {
    const [, last, divisor] = q.prompt.match(/…, (\d+)\..*деления на (\d+)/);
    let pairs = 0;
    for (let a = 0; a <= Number(last); a++) for (let b = a + 1; b <= Number(last); b++) if ((b - a) % Number(divisor) === 0) pairs++;
    assert.equal(Number(q.answer), pairs);
  } else if (q.templateId === 'g11-algorithms-parity') {
    const n = Number(q.prompt.match(/N = (\d+)/)[1]);
    const binary = n.toString(2);
    let parity = 0;
    for (const digit of binary) parity ^= Number(digit);
    assert.equal(Number(q.answer), parseInt(binary + parity, 2));
  } else return;
  independentMathChecks++;
}

function inspectQuestion(q, { collectPython = false, sample = '' } = {}) {
  generated++;
  assert.ok(q.title && q.prompt && q.explanation && q.topicTitle, q.templateId);
  assert.ok(Number.isInteger(q.points) && q.points > 0, q.templateId);
  assert.ok(['basic', 'standard', 'advanced'].includes(q.difficulty));
  assert.ok(q.difficultyReason);
  if (!isTemplateAvailable(q.templateId, LEGACY_BANK_VERSION)) {
    assert.ok(Array.isArray(q.solutionSteps) && q.solutionSteps.length >= 2, `${q.templateId}: step-by-step explanation`);
    assert.ok(q.solutionSteps.every(step => typeof step === 'string' && step.trim().length >= 10), `${q.templateId}: meaningful steps`);
    assert.ok(new Set(q.solutionSteps.map(step => step.trim())).size >= 2, `${q.templateId}: steps must differ`);
  }
  checkMathKey(q);
  covered.add(q.templateId);
  if (q.kind === 'program') {
    assert.ok(q.tests.length >= 3, q.templateId);
    assert.ok(!/^\s*(import|from)\s/m.test(q.answer));
    if (collectPython) pythonSamples.push({ code: q.answer, tests: q.tests, id: `${q.templateId}:${sample}` });
  } else {
    assert.equal(checkAnswer(q, q.answer).correct, true, q.templateId);
    assert.equal(checkAnswer(q, '').correct, false, 'blank answer');
    assert.equal(checkAnswer(q, 'это неверный ответ').correct, false);
    if (q.kind === 'number') assert.ok(Number.isFinite(Number(q.answer)), q.templateId);
    if (q.kind === 'choice') {
      assert.ok(q.options.some(option => option.value === q.answer), q.templateId);
      assert.equal(new Set(q.options.map(option => option.label)).size, q.options.length, `${q.templateId}: repeated choices`);
    }
    if (q.code && collectPython) pythonSamples.push({ code: q.code, tests: [{ input: '', output: q.answer }], id: `${q.templateId}:${sample}` });
  }
}

// Explicit template plans ensure coverage of all 800 families; no random luck is involved.
for (const template of TEMPLATE_CATALOG) {
  for (const [seed, variant] of [[1, 1], [1430, 7], [81021, 30]]) {
    const args = { grade: template.grade, topicId: template.topicId, seed, variant, templateIds: [template.id] };
    const questions = generateQuestions(args);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].templateId, template.id);
    assert.equal(questions[0].kind, template.kind, `${template.id}: catalog answer type must stay stable`);
    assert.equal(questions[0].points, template.points, `${template.id}: catalog weight must stay stable`);
    assert.deepEqual(questions, generateQuestions(args), 'deterministic explicit template generation');
    inspectQuestion(questions[0], { collectPython: true, sample: `${seed}/${variant}` });
  }
}
for (const grade of GRADES) {
  assert.equal(grade.topics.length, 4);
  assert.equal(TEMPLATE_CATALOG.filter(template => template.grade === grade.grade).length, 160);
  for (const topic of grade.topics) {
    const types=TEMPLATE_CATALOG.filter(template=>template.topicId===topic.id);
    assert.equal(types.length,40,topic.id);
    const added=types.filter(template=>template.id.includes('-plus-'));
    assert.equal(added.length,20,topic.id);
    for(const [level,count] of [['basic',7],['standard',7],['advanced',6]])assert.equal(added.filter(template=>template.difficulty===level).length,count,`${topic.id}/${level}`);
  }
  for (const topic of [{ id: 'all' }, ...grade.topics]) {
    for (const seed of [19, 1430, 'школа']) {
      const args = { grade: grade.grade, topicId: topic.id, count: 15, seed };
      const questions = generateQuestions(args);
      assert.deepEqual(questions, generateQuestions(args), 'deterministic generated plan');
      assert.equal(questions.length, 15);
      assert.equal(new Set(questions.map(q => q.id)).size, 15);
      const signatures = new Set();
      for (const q of questions) {
        const signature = JSON.stringify([q.prompt, q.code || '', (q.options || []).map(o => o.label).sort()]);
        assert.ok(!signatures.has(signature) || q.repeated, `${q.templateId}: unmarked duplicate`);
        signatures.add(signature);
        inspectQuestion(q);
      }
    }
  }
}
assert.equal(covered.size, 800);
assert.throws(() => generateQuestions({ grade: 6 }));
assert.throws(() => generateQuestions({ grade: 7, topicId: 'missing' }));
assert.equal(checkAnswer({ kind: 'number', answer: '1.5', points: 2 }, ' 1,5 ').score, 2);
assert.equal(checkAnswer({ kind: 'number', answer: '12', points: 1 }, 'Infinity').correct, false);
assert.equal(checkAnswer({ kind: 'number', answer: '12', points: 1 }, '12.000000001').correct, false);
assert.equal(checkAnswer({ kind: 'number', answer: '2000000000', points: 1 }, '2000000001').correct, false);
assert.equal(checkAnswer({ kind: 'number', answer: '1.5', points: 1 }, '1.5000000001').correct, true);
assert.equal(checkAnswer({ kind: 'number', answer: '1.5', points: 1 }, '1.50000001').correct, false);
assert.equal(checkAnswer({ kind: 'text', answer: '11010', points: 1 }, '1 1010').correct, true);

const batchCode = `import json, sys, io, contextlib\nitems = json.load(sys.stdin)\ncount = 0\nfor item in items:\n    for case in item['tests']:\n        old = sys.stdin\n        sys.stdin = io.StringIO(case['input'])\n        out = io.StringIO()\n        try:\n            with contextlib.redirect_stdout(out):\n                exec(compile(item['code'], item['id'], 'exec'), {})\n        finally:\n            sys.stdin = old\n        actual = out.getvalue().strip().split()\n        expected = case['output'].strip().split()\n        assert actual == expected, (item['id'], item['code'], case, actual)\n        count += 1\nprint(count)\n`;
const python = spawnPythonSync(['-c', batchCode], { input: JSON.stringify(pythonSamples), encoding: 'utf8', timeout: 40000, maxBuffer: 1024 * 1024 });
assert.equal(python.status, 0, python.stderr);
console.log(JSON.stringify({ ok: true, ...BANK_STATS, generatedQuestions: generated, templatesCovered: covered.size, pythonCasesExecuted: Number(python.stdout.trim()), independentMathChecks }));
