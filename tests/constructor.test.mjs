import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK_VERSION, LEGACY_BANK_VERSION, PREVIOUS_BANK_VERSION, TEMPLATE_CATALOG, checkAnswer, generateQuestions, isTemplateAvailable } from '../js/bank.js';
import { createConstructorDraft, validateConstructorDraft, generateConstructorQuestions, summarizeDraft, createConstructorAssignment, serializeConstructorDraft, parseConstructorDraft, MAX_CONSTRUCTOR_BYTES } from '../js/constructor.js';

function numberedDraft(grade = 8) {
  const draft = createConstructorDraft({ grade });
  draft.title = 'Системы счисления · 8А';
  draft.seed = 1430;
  const ids = grade === 8 ? ['g8-bases-addition', 'g8-bases-binary', 'g8-bases-hex', 'g8-bases-tobinary'] : TEMPLATE_CATALOG.filter(t => t.grade === grade).slice(0, 4).map(t => t.id);
  draft.slots = ids.map((templateId, index) => ({ id: `slot-${index + 1}`, templateId, points: index + 2 }));
  return draft;
}

test('constructor catalog exposes every template with stable public metadata only', () => {
  assert.equal(TEMPLATE_CATALOG.length, 800);
  assert.equal(new Set(TEMPLATE_CATALOG.map(t => t.id)).size, 800);
  assert.deepEqual([...new Set(TEMPLATE_CATALOG.map(t => t.grade))], [7, 8, 9, 10, 11]);
  assert.ok(Object.isFrozen(TEMPLATE_CATALOG));
  for (const row of TEMPLATE_CATALOG) {
    assert.ok(Object.isFrozen(row));
    assert.ok(['number', 'choice', 'text', 'program'].includes(row.kind));
    assert.ok(row.title && row.topicTitle && row.difficultyTitle && row.difficultyReason);
    assert.ok(['basic', 'standard', 'advanced'].includes(row.difficulty));
    assert.ok(Number.isInteger(row.points) && row.points > 0);
    assert.equal(row.answer, undefined);
    assert.equal(row.tests, undefined);
    assert.equal(row.build, undefined);
  }
});

test('custom order, weights and slot identities remain equal across 30 variants', () => {
  const draft = numberedDraft();
  const before = structuredClone(draft);
  const all = Array.from({ length: 30 }, (_, index) => generateConstructorQuestions(draft, { variant: index + 1 }));
  const plan = all[0].map(q => [q.templateId, q.slotId, q.kind, q.difficulty, q.points]);
  assert.deepEqual(plan.map(row => row[0]), draft.slots.map(slot => slot.templateId));
  assert.equal(all[0][0].difficulty, 'advanced', 'explicit slot order is not automatically sorted');
  for (const questions of all) {
    assert.deepEqual(questions.map(q => [q.templateId, q.slotId, q.kind, q.difficulty, q.points]), plan);
    assert.equal(questions.reduce((sum, q) => sum + q.points, 0), 14);
    for (const q of questions) assert.equal(checkAnswer(q, q.answer).score, q.points, 'grading uses the custom weight');
  }
  assert.equal(new Set(all.map(questions => JSON.stringify(questions.map(q => [q.prompt, q.code, q.options])))).size, 30);
  assert.deepEqual(generateConstructorQuestions(draft, { variant: 12 }), all[11]);
  assert.deepEqual(draft, before, 'preview does not change draft identity, rules or slots');
});

test('drafts can be unfinished while issued work must be ready and internally consistent', () => {
  const blank = createConstructorDraft();
  blank.title = '';
  assert.equal(validateConstructorDraft(blank).slots.length, 0);
  assert.throws(() => createConstructorAssignment(blank), /название/);
  blank.title = 'Проверочная';
  assert.throws(() => generateConstructorQuestions(blank), /хотя бы одно/);
  const draft = createConstructorDraft({ grade: 9 });
  const program = TEMPLATE_CATALOG.find(row => row.grade === 9 && row.kind === 'program');
  draft.slots = [{ id: 'python-slot', templateId: program.id, points: 5 }];
  draft.python = false;
  assert.equal(validateConstructorDraft(draft).python, false);
  assert.equal(summarizeDraft(draft).hasPrograms, true);
  assert.ok(summarizeDraft(draft).warnings.some(w => /Python/.test(w)));
  assert.throws(() => createConstructorAssignment(draft), /Включите Python/);
  draft.python = true;
  assert.equal(createConstructorAssignment(draft).python, true);
  draft.mode = 'training'; draft.strict = true;
  assert.equal(validateConstructorDraft(draft).strict, false);
  assert.equal(draft.strict, true, 'normalization leaves the input untouched');
});

test('summary and issue snapshot retain manual points, thresholds and independent revision', () => {
  const draft = numberedDraft();
  draft.thresholds = { five: 90, four: 75, three: 55 };
  draft.revision = 3;
  const summary = summarizeDraft(draft);
  assert.equal(summary.count, 4);
  assert.equal(summary.maxScore, 14);
  assert.equal(Object.values(summary.levels).reduce((a, b) => a + b), 4);
  assert.ok(summary.warnings.some(w => /не возрастает/.test(w)));
  const issued = createConstructorAssignment(draft, { variant: 8 });
  assert.equal(issued.v, 2);
  assert.equal(issued.bankVersion, BANK_VERSION);
  assert.equal(issued.profileId, 'custom');
  assert.equal(issued.variant, 8);
  assert.equal(issued.workId, draft.id);
  assert.equal(issued.revision, 3);
  assert.deepEqual(issued.thresholds, draft.thresholds);
  assert.deepEqual(issued.slots, draft.slots.map(({ templateId, points }) => ({ templateId, points })));
  draft.title = 'Изменённое название';
  draft.slots[0].points = 10;
  draft.thresholds.five = 95;
  draft.revision = 4;
  assert.equal(issued.title, 'Системы счисления · 8А');
  assert.equal(issued.slots[0].points, 2);
  assert.equal(issued.thresholds.five, 90);
  assert.equal(issued.revision, 3);
  assert.equal(issued.studentName, undefined);
  assert.equal(issued.answers, undefined);
});

test('portable JSON round-trips Unicode and unfinished drafts without retaining student data', () => {
  const draft = numberedDraft();
  const text = serializeConstructorDraft(draft);
  const file = JSON.parse(text);
  assert.equal(file.format, 'code1430-constructor');
  assert.equal(file.schemaVersion, 1);
  assert.equal(file.bankVersion, BANK_VERSION);
  assert.deepEqual(parseConstructorDraft(text), draft);
  assert.deepEqual(parseConstructorDraft('\uFEFF' + text), draft);
  const loaded = parseConstructorDraft(text);
  loaded.slots[0].points = 10;
  assert.equal(draft.slots[0].points, 2);
  const blank = createConstructorDraft();
  assert.deepEqual(parseConstructorDraft(serializeConstructorDraft(blank)), blank);
  assert.throws(() => serializeConstructorDraft({ ...draft, studentName: 'Ученик' }), /недопустимое поле/);
});

test('legacy constructor JSON preserves its bank through preview, export and issued assignments', () => {
  const source = numberedDraft();
  for (const bankVersion of [LEGACY_BANK_VERSION, PREVIOUS_BANK_VERSION]) {
    const file = JSON.parse(serializeConstructorDraft(source));
    file.bankVersion = bankVersion;
    assert.equal(file.draft.bankVersion, undefined, 'schema 1 keeps bank version in the envelope');
    const draft = parseConstructorDraft(JSON.stringify(file));
    assert.equal(draft.bankVersion, bankVersion);
    const expected = generateQuestions({ grade: draft.grade, seed: draft.seed, variant: 12, bankVersion, templateIds: draft.slots.map(slot => slot.templateId) })
      .map((question, index) => ({ ...question, points: draft.slots[index].points, slotId: draft.slots[index].id }));
    assert.deepEqual(generateConstructorQuestions(draft, { variant: 12 }), expected);
    assert.notDeepEqual(generateConstructorQuestions(source, { variant: 12 }), expected, 'bank version changes the generated source data');
    const exported = JSON.parse(serializeConstructorDraft(draft));
    assert.equal(exported.bankVersion, bankVersion);
    assert.deepEqual(parseConstructorDraft(JSON.stringify(exported)), draft);
    assert.equal(createConstructorAssignment(draft, { variant: 12 }).bankVersion, bankVersion);
    const newer = TEMPLATE_CATALOG.find(item => item.grade === draft.grade && !isTemplateAvailable(item.id, bankVersion));
    assert.ok(newer);
    assert.throws(() => validateConstructorDraft({ ...draft, slots: [{ id: 'newer-slot', templateId: newer.id, points: 1 }] }), /недоступен/);
    assert.throws(() => parseConstructorDraft(JSON.stringify({ ...file, draft: { ...file.draft, bankVersion: BANK_VERSION } })), /не совпадает/);
  }
  const { bankVersion, ...oldInMemoryDraft } = source;
  assert.equal(validateConstructorDraft(oldInMemoryDraft).bankVersion, BANK_VERSION, 'older callers without bankVersion still use the current bank');
});

test('invalid points, thresholds, grades, slot identities and imported content fail clearly', () => {
  const draft = numberedDraft();
  const bad = patch => ({ ...structuredClone(draft), ...patch });
  assert.throws(() => validateConstructorDraft(bad({ grade: 7 })), /относится к 8 классу/);
  assert.throws(() => validateConstructorDraft(bad({ slots: [{ id: 'a', templateId: 'not-found', points: 1 }] })), /не найден/);
  assert.throws(() => validateConstructorDraft(bad({ slots: [{ ...draft.slots[0], points: 0 }] })), /от 1 до 10/);
  assert.throws(() => validateConstructorDraft(bad({ slots: [{ ...draft.slots[0], points: 1.5 }] })), /целое/);
  assert.throws(() => validateConstructorDraft(bad({ slots: [draft.slots[0], draft.slots[0]] })), /повторяется/);
  assert.throws(() => validateConstructorDraft(bad({ slots: Array.from({ length: 31 }, (_, i) => ({ ...draft.slots[0], id: `x-${i}` })) })), /не более 30/);
  assert.throws(() => validateConstructorDraft(bad({ thresholds: { five: 70, four: 70, three: 50 } })), /Пороги должны возрастать/);
  assert.throws(() => validateConstructorDraft(bad({ seed: -1 })), /Номер набора/);
  assert.throws(() => generateConstructorQuestions(draft, { variant: 31 }), /Номер варианта/);
  const envelope = JSON.parse(serializeConstructorDraft(draft));
  assert.throws(() => parseConstructorDraft(JSON.stringify({ ...envelope, bankVersion: 'old-version' })), /Версия банка/);
  assert.throws(() => parseConstructorDraft(JSON.stringify({ ...envelope, schemaVersion: 999 })), /Версия файла/);
  assert.throws(() => parseConstructorDraft('not json'), /Не удалось прочитать JSON/);
  assert.throws(() => parseConstructorDraft('x'.repeat(MAX_CONSTRUCTOR_BYTES + 1)), /слишком большой/);
  assert.throws(() => parseConstructorDraft('Я'.repeat(MAX_CONSTRUCTOR_BYTES / 2 + 1)), /слишком большой/);
  assert.throws(() => parseConstructorDraft(serializeConstructorDraft(draft).replace('"draft": {', '"draft": {"__proto__": {"polluted": true},')), /недопустимое поле/);
  assert.equal({}.polluted, undefined);
  assert.throws(() => validateConstructorDraft(Object.assign(Object.create({ inherited: true }), draft)), /ожидается объект/);
});
