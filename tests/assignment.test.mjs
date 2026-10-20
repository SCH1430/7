import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK_VERSION, GRADES } from '../js/bank.js';
import { ASSIGNMENT_VERSION, MAX_VARIANTS, normalizeAssignment, encodeAssignment, decodeAssignment, makeAssignmentUrl, readAssignmentUrl } from '../js/assignment.js';

function config(overrides = {}) {
  return { v: ASSIGNMENT_VERSION, bankVersion: BANK_VERSION, title: 'Контрольная №2 · логика', grade: 8, topicId: GRADES.find(row => row.grade === 8).topics[0].id, profileId: 'thematic', difficulty: 'standard', seed: 4294967295, variant: 30, mode: 'control', strict: true, minutes: 25, calculator: false, python: true, ...overrides };
}
const rawToken = object => Buffer.from(typeof object === 'string' ? object : JSON.stringify(object), 'utf8').toString('base64url');

test('work links round-trip Unicode and preserve repository subpath', () => {
  const expected = config();
  const token = encodeAssignment(expected);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeAssignment(token), expected);
  const url = makeAssignmentUrl(expected, 'https://school.example/code-1430/?student=private#old');
  assert.ok(url.startsWith('https://school.example/code-1430/#work='));
  assert.ok(!url.includes('private'));
  assert.deepEqual(readAssignmentUrl(url), expected);
  assert.equal(readAssignmentUrl('http://localhost:8080/code-1430/'), null);
  assert.equal(readAssignmentUrl('https://school.example/code-1430/#about'), null);
  assert.equal(MAX_VARIANTS, 30);
});

test('normalization leaves original configuration unchanged and supports all grades', () => {
  const original = config({ title: '  Работа 🐍  ', mode: 'training', strict: true });
  const normalized = normalizeAssignment(original);
  assert.equal(normalized.title, 'Работа 🐍');
  assert.equal(normalized.strict, false);
  assert.equal(original.strict, true);
  assert.equal(original.title, '  Работа 🐍  ');
  const withoutTitle = config();delete withoutTitle.title;
  assert.equal(decodeAssignment(encodeAssignment(withoutTitle)).title, '');
  for (const row of GRADES) for (const topic of row.topics) {
    assert.equal(decodeAssignment(encodeAssignment(config({ grade: row.grade, topicId: topic.id }))).topicId, topic.id);
  }
});

test('configuration validation rejects wrong versions and semantic inconsistencies', () => {
  for (const changes of [
    { v: 2 }, { bankVersion: 'old-bank' }, { grade: 6 }, { grade: 12 }, { grade: '8' },
    { topicId: 'missing' }, { topicId: GRADES[0].topics[0].id }, { profileId: 'final' }, { profileId: 'exam' },
    { difficulty: 'expert' }, { seed: -1 }, { seed: 4294967296 }, { seed: 0.1 }, { variant: 0 }, { variant: 31 },
    { mode: 'teacher' }, { strict: 'yes' }, { minutes: 4 }, { minutes: 121 }, { minutes: 25.5 },
    { calculator: 1 }, { python: null }, { title: 99 }, { title: 'a'.repeat(81) }, { title: 'line\nbreak' },
    { studentName: 'Must not enter a link' }, { answers: { q: 42 } },
  ]) assert.throws(() => encodeAssignment(config(changes)), /Ссылка на работу:/, JSON.stringify(changes));
  assert.equal(decodeAssignment(encodeAssignment(config({ profileId: 'final', topicId: 'all' }))).topicId, 'all');
  assert.throws(() => decodeAssignment(rawToken(config({ bankVersion: 'old-bank' }))), /версия банка заданий отличается/);
  assert.throws(() => encodeAssignment(null), /параметры работы/);
  assert.throws(() => encodeAssignment([]), /параметры работы/);
  assert.throws(() => encodeAssignment(Object.create({ v: 1 })), /объект параметров/);
  const withGetter = config();Object.defineProperty(withGetter, 'seed', { get() { throw new Error('must not run'); } });
  assert.throws(() => encodeAssignment(withGetter), /объект параметров/);
});

test('decoding rejects corrupt, oversized and prototype-bearing payloads without pollution', () => {
  for (const token of ['', 'A', '***', 'x'.repeat(4097), 'eyJ2IjoxfQ==', rawToken('{bad'), rawToken('null'), rawToken('[]')]) {
    assert.throws(() => decodeAssignment(token), /Ссылка на работу:/);
  }
  const malformedUtf8 = Buffer.from([0xff, 0xfe, 0xc0]).toString('base64url');
  assert.throws(() => decodeAssignment(malformedUtf8), /параметры работы повреждены/);
  const json = JSON.stringify(config()).replace(/}$/, ',"__proto__":{"polluted":true}}');
  assert.throws(() => decodeAssignment(rawToken(json)), /неизвестные параметры/);
  assert.equal({}.polluted, undefined);
  assert.throws(() => decodeAssignment(rawToken(config({ constructor: {} }))), /неизвестные параметры/);
  assert.throws(() => decodeAssignment(rawToken(config({ prototype: {} }))), /неизвестные параметры/);
});

test('URL validation rejects ambiguous works and unsafe schemes', () => {
  const token = encodeAssignment(config());
  for (const url of [
    `https://school.example/#work=${token}&work=${token}`,
    `https://school.example/#work=${token}&extra=value`,
    'https://school.example/#work=',
    `https://school.example/#work=%${token.charCodeAt(0).toString(16)}${token.slice(1)}`,
    `https://school.example/#work=${token}=`,
    `javascript:alert(1)#work=${token}`,
    `file:///index.html#work=${token}`,
    `https://user:password@school.example/#work=${token}`,
    'relative/path', 'x'.repeat(12289),
  ]) assert.throws(() => readAssignmentUrl(url), /Ссылка на работу:/, url.slice(0, 80));
  assert.throws(() => makeAssignmentUrl(config(), 'javascript:alert(1)'), /HTTP или HTTPS/);
});
