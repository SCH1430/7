const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../bank.js');
const O = require('../oge-core.js');
const Zip = require('../oge-zip.js');
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&gt;', '>').replaceAll('&lt;', '<');
// These independent parsers audit the original displayed templates. The added
// difficulty families have different statements and their own content audit.
const legacyOge = task => /^oge-(?:fipi|authored)-\d+(?:-\d+)?$/.test(task.bankId);

test('source name puzzle has exactly one solution; file-size ordering is explicit', () => {
  const task = C.bank.find(t => t.id === 'base-5').task;
  const names = task.fields.map(f => f.label), surnames = task.fields[0].options;
  const assignments = [];
  for (const a of surnames) for (const b of surnames) for (const c of surnames) {
    const picked = [a, b, c];
    if (new Set(picked).size === 3 && picked.every((s, i) => s[0] !== names[i][0]) && c !== 'Иванова') assignments.push(picked);
  }
  assert.deepEqual(assignments, [task.fields.map(f => f.correct)]);
  const sizes = C.bank.find(t => t.id === 'advanced-4').task;
  assert.match(sizes.body, /фотография занимает больше места, чем презентация, а презентация — больше, чем документ/);
  const kb = value => parseFloat(value.replace(',', '.')) * (value.includes('Мбайт') ? 1024 : 1);
  const ordered = [...sizes.fields[0].options].sort((a, b) => kb(a) - kb(b));
  assert.deepEqual(sizes.fields.map(f => f.correct), [ordered[0], ordered[2], ordered[1]]);
});

test('every legacy OGE logic statement gives the minimum natural counterexample from its displayed condition', () => {
  for (const task of O.bank.filter(t => t.n === 3 && legacyOge(t))) {
    const condition = task.body.match(/<blockquote>(.*?)<\/blockquote>/)[1];
    const [, a, b, c] = condition.match(/x ≥ (\d+).*x = (\d+).*x ≤ (\d+)/).map(Number);
    let expected = 1;
    while ((!(expected >= a) && !(expected === b)) || expected <= c) expected++;
    assert.equal(Number(task.key), expected, task.bankId);
  }
});

test('all legacy OGE URL keys reconstruct the actual protocol, server and file in the condition', () => {
  for (const task of O.bank.filter(t => t.n === 7 && legacyOge(t))) {
    const parts = [...task.body.matchAll(/<td>(.*?)<\/td>/g)].map(m => decode(m[1]));
    const values = [...task.body.matchAll(/<strong>(.*?)<\/strong>/g)].map(m => m[1]);
    const [file, server, protocol] = values;
    assert.equal([...task.key].map(n => parts[Number(n) - 1]).join(''), `${protocol}://${server}/${file}`, task.bankId);
  }
});

test('all legacy OGE search-query keys satisfy inclusion-exclusion using the displayed table', () => {
  for (const task of O.bank.filter(t => t.n === 8 && legacyOge(t))) {
    const rows = [...task.body.matchAll(/<tr>(.*?)<\/tr>/g)].slice(1);
    const [union, intersection, left] = rows.map(row => Number([...row[1].matchAll(/<td>(.*?)<\/td>/g)][1][1]));
    const right = union + intersection - left;
    assert.ok(intersection >= 0 && intersection <= Math.min(left, right), task.bankId);
    assert.equal(Number(task.key), right, task.bankId);
  }
});

test('official non-prefix cipher still has exactly one complete decoding', () => {
  const task = O.tasks[1];
  const letters = [...task.body.matchAll(/<th>(.*?)<\/th>/g)].map(m => m[1]);
  const codes = [...task.body.matchAll(/<td>(.*?)<\/td>/g)].map(m => m[1]);
  const message = task.body.match(/<pre>(.*?)<\/pre>/)[1];
  function solve(rest) {
    if (!rest) return [''];
    return codes.flatMap((code, i) => rest.startsWith(code) ? solve(rest.slice(code.length)).map(tail => letters[i] + tail) : []);
  }
  assert.deepEqual(solve(message), [task.key]);
});

test('authored spreadsheet keys match the rows actually shipped to the pupil', async () => {
  for (const task of O.bank.filter(t => t.n === 14 && t.origin === 'authored' && legacyOge(t))) {
    const zip = await Zip.read(fs.readFileSync(path.join(__dirname, '..', task.asset, task.download)));
    const xml = new TextDecoder().decode(zip.get('content.xml'));
    const rows = [...xml.matchAll(/<table:table-row>(.*?)<\/table:table-row>/gs)].slice(1).map(row =>
      [...row[1].matchAll(/office:value="([^"]+)"/g)].map(value => Number(value[1])));
    const g = task.grading;
    assert.equal(rows.length, g.rowCount, task.bankId);
    // Numeric source columns: school, class, score (participant names are text).
    assert.ok(rows.every(row => row.length === 3), task.bankId);
    assert.equal(rows.filter(r => r[1] === g.countClass && r[2] > g.countThreshold).length, g.answer1, task.bankId);
    const scores = rows.filter(r => r[0] === g.meanSchool).map(r => r[2]);
    assert.ok(scores.length > 0, task.bankId);
    assert.ok(Math.abs(scores.reduce((a, b) => a + b, 0) / scores.length - g.answer2) < 0.005, task.bankId);
    for (const [grade, count] of Object.entries(g.chart)) assert.equal(rows.filter(r => r[1] === Number(grade)).length, count, task.bankId);
  }
});
