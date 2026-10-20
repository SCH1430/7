import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK_VERSION, TEMPLATE_CATALOG } from '../js/bank.js';
import { ASSIGNMENT_VERSION, CONSTRUCTOR_ASSIGNMENT_VERSION, normalizeAssignment, encodeAssignment, decodeAssignment, makeAssignmentUrl, readAssignmentUrl } from '../js/assignment.js';

const template = (grade, kind) => TEMPLATE_CATALOG.find(item => item.grade === grade && (!kind || item.kind === kind));
const rawToken = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
function constructed(overrides = {}) {
  return {
    v: CONSTRUCTOR_ASSIGNMENT_VERSION, bankVersion: BANK_VERSION,
    title: 'Контрольная «Системы счисления» 🧮', grade: 8, topicId: 'all', profileId: 'custom', difficulty: 'mixed',
    seed: 1430, variant: 30, mode: 'control', strict: true, minutes: 40, calculator: false, python: true,
    workId: 'work_1430_84f5', revision: 3,
    slots: [{ templateId: template(8).id, points: 2 }, { templateId: template(8).id, points: 5 }],
    thresholds: { five: 90, four: 75, three: 55 },
    ...overrides,
  };
}

test('constructor links carry a complete weighted plan for thirty slots and all variants', () => {
  const catalog = TEMPLATE_CATALOG.filter(item => item.grade === 8);
  const slots = Array.from({ length: 30 }, (_, index) => ({ templateId: catalog[index % catalog.length].id, points: index % 10 + 1 }));
  const config = constructed({ slots });
  for (let variant = 1; variant <= 30; variant++) {
    const input = { ...config, variant };
    const url = makeAssignmentUrl(input, 'https://school1430.example/informatics/?student=private#prior');
    assert.ok(url.startsWith('https://school1430.example/informatics/#work='));
    assert.deepEqual(readAssignmentUrl(url), input);
    assert.ok(url.length < 16384);
    const payload = JSON.parse(Buffer.from(url.split('#work=')[1], 'base64url').toString('utf8'));
    assert.equal(payload.slots.length, 30);
    assert.equal(payload.slots.reduce((total, slot) => total + slot.points, 0), 165);
    assert.equal(payload.studentName, undefined);
    assert.equal(payload.answers, undefined);
    assert.ok(payload.slots.every(slot => Object.keys(slot).sort().join(',') === 'points,templateId'));
    assert.ok(!url.includes('private'));
  }
});

test('issued constructor links remain unchanged after the source draft is edited', () => {
  const config = constructed();
  const snapshot = structuredClone(config);
  const url = makeAssignmentUrl(config, 'https://school1430.example/code/');
  const normalized = normalizeAssignment(config);
  config.slots[0].points = 10;
  config.slots.reverse();
  config.thresholds.five = 99;
  config.title = 'Следующая редакция';
  config.revision++;
  assert.deepEqual(readAssignmentUrl(url), snapshot);
  assert.deepEqual(normalized, snapshot);
  assert.notEqual(normalized.slots, config.slots);
  assert.notEqual(normalized.thresholds, config.thresholds);
});

test('constructor validation enforces class, tools, plan size, weights and grading thresholds', () => {
  const program = template(9, 'program');
  assert.ok(program);
  const invalid = [
    { v: 3 }, { workId: '' }, { workId: '../work' }, { workId: 'a'.repeat(81) },
    { revision: 0 }, { revision: 1.5 }, { revision: 1000001 },
    { profileId: 'quick' }, { topicId: template(8).topicId }, { difficulty: 'advanced' },
    { slots: [] }, { slots: Array.from({ length: 31 }, () => ({ templateId: template(8).id, points: 1 })) },
    { slots: [{ templateId: 'missing', points: 1 }] }, { slots: [{ templateId: template(7).id, points: 1 }] },
    { slots: [{ templateId: template(8).id, points: 0 }] }, { slots: [{ templateId: template(8).id, points: 11 }] },
    { slots: [{ templateId: template(8).id, points: 2.5 }] }, { slots: [{ templateId: template(8).id, points: '2' }] },
    { thresholds: { five: 70, four: 75, three: 50 } }, { thresholds: { five: 85, four: 50, three: 50 } },
    { thresholds: { five: 101, four: 75, three: 50 } }, { thresholds: { five: 85, four: 75, three: 0 } },
    { thresholds: { five: 85.5, four: 75, three: 50 } }, { thresholds: {} },
    { studentName: 'Не передаётся' }, { answers: [] }, { bankVersion: 'unknown' },
    { grade: 9, python: false, slots: [{ templateId: program.id, points: 3 }] },
  ];
  for (const changes of invalid) assert.throws(() => encodeAssignment(constructed(changes)), /Ссылка на работу:/, JSON.stringify(changes));
  const valid = constructed({ workId: 'a'.repeat(80), revision: 1000000, grade: 9, python: true, slots: [{ templateId: program.id, points: 7 }] });
  assert.deepEqual(decodeAssignment(encodeAssignment(valid)), valid);
  const training = normalizeAssignment(constructed({ mode: 'training', strict: true }));
  assert.equal(training.strict, false);
});

test('constructor payloads reject nested unknown keys, getters and prototype pollution', () => {
  const ownExtra = constructed();ownExtra.slots[0].studentAnswer = '42';
  assert.throws(() => encodeAssignment(ownExtra), /неизвестные параметры/);
  const thresholdExtra = constructed();thresholdExtra.thresholds.teacher = true;
  assert.throws(() => encodeAssignment(thresholdExtra), /неизвестные параметры/);
  const getter = constructed();Object.defineProperty(getter.slots[0], 'points', { get() { throw new Error('getter must not run'); } });
  assert.throws(() => encodeAssignment(getter), /недопустимый объект/);
  const listGetter = constructed();Object.defineProperty(listGetter.slots, '0', { get() { throw new Error('getter must not run'); } });
  assert.throws(() => encodeAssignment(listGetter), /недопустимый объект/);
  const sparse = constructed({ slots: Array(2) });
  assert.throws(() => encodeAssignment(sparse), /недопустимый объект/);
  const nestedPrototype = JSON.stringify(constructed()).replace('"points":2', '"points":2,"__proto__":{"polluted":true}');
  assert.throws(() => decodeAssignment(rawToken(nestedPrototype)), /неизвестные параметры/);
  const thresholdPrototype = JSON.stringify(constructed()).replace('"five":90', '"five":90,"constructor":{}');
  assert.throws(() => decodeAssignment(rawToken(thresholdPrototype)), /неизвестные параметры/);
  assert.equal({}.polluted, undefined);
  assert.throws(() => decodeAssignment(rawToken(JSON.stringify(constructed()) + ' '.repeat(8193))), /слишком велик/);
});

test('legacy links retain their original schema and limits', () => {
  const legacy = { v: ASSIGNMENT_VERSION, bankVersion: BANK_VERSION, title: '', grade: 8, topicId: 'all', profileId: 'quick', difficulty: 'basic', seed: 42, variant: 2, mode: 'control', strict: false, minutes: 12, calculator: false, python: false };
  assert.equal(ASSIGNMENT_VERSION, 1);
  assert.equal(CONSTRUCTOR_ASSIGNMENT_VERSION, 2);
  assert.deepEqual(readAssignmentUrl(makeAssignmentUrl(legacy, 'https://school1430.example/')), legacy);
  assert.throws(() => encodeAssignment({ ...legacy, slots: constructed().slots }), /неизвестные параметры/);
  assert.throws(() => decodeAssignment(rawToken(JSON.stringify(legacy).padEnd(3073, ' '))), /слишком велик/);
  const modern = constructed();
  assert.deepEqual(decodeAssignment(rawToken(JSON.stringify(modern).padEnd(3500, ' '))), modern);
});
