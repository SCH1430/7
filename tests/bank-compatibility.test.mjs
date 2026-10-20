import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BANK_VERSION, LEGACY_BANK_VERSION, PREVIOUS_BANK_VERSION, SUPPORTED_BANK_VERSIONS, TEMPLATE_CATALOG, generateBlueprint, generateQuestions, isTemplateAvailable } from '../js/bank.js';
import { normalizeAssignment, makeAssignmentUrl, readAssignmentUrl } from '../js/assignment.js';
import { createConstructorDraft, serializeConstructorDraft, parseConstructorDraft, createConstructorAssignment, generateConstructorQuestions } from '../js/constructor.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/bank-v2026.10.20-2.json', import.meta.url), 'utf8'));
const previousFixture = JSON.parse(await readFile(new URL('./fixtures/bank-v2026.10.20-3.json', import.meta.url), 'utf8'));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('all 630 legacy snapshots keep their exact plan, question text, keys and Python tests', () => {
  assert.equal(fixture.bankVersion, LEGACY_BANK_VERSION);
  assert.equal(fixture.templates.length, 100);
  assert.equal(fixture.cases.length, 630);
  assert.ok(SUPPORTED_BANK_VERSIONS.includes(fixture.bankVersion));
  for (const item of fixture.cases) {
    assert.deepEqual(generateBlueprint(item.config), item.blueprint);
    assert.equal(digest(generateQuestions(item.config)), item.questionsSha256, JSON.stringify(item.config));
  }
});

test('legacy v1 and v2 links retain the requested bank instead of normalizing to the new default', () => {
  for (const item of [fixture.cases.find(item => item.config.grade === 8 && !item.config.templateIds), fixture.cases.find(item => item.config.grade === 9 && item.config.templateIds)]) {
    const old = item.config;
    const config = {
      v: old.templateIds ? 2 : 1, bankVersion: old.bankVersion, title: 'Ранее выданная работа',
      grade: old.grade, topicId: old.templateIds ? 'all' : old.topicId, profileId: old.templateIds ? 'custom' : 'quick', difficulty: old.difficulty,
      seed: old.seed, variant: old.variant, mode: 'control', strict: false, minutes: 25, calculator: true, python: true,
      ...(old.templateIds ? { workId: 'issued-before-update', revision: 2, slots: old.templateIds.map(templateId => ({ templateId, points: 2 })), thresholds: { five: 85, four: 70, three: 50 } } : {}),
    };
    const decoded = readAssignmentUrl(makeAssignmentUrl(config, 'https://example.github.io/code1430/'));
    assert.equal(decoded.bankVersion, LEGACY_BANK_VERSION);
    const questions = generateQuestions({ ...decoded, count: old.count, ...(decoded.slots ? { templateIds: decoded.slots.map(slot => slot.templateId) } : {}) });
    assert.equal(digest(questions), item.questionsSha256);
  }
});

test('a legacy declaration cannot inject new templates or an unknown bank version', () => {
  const added = TEMPLATE_CATALOG.find(template => !fixture.templates.includes(template.id));
  assert.ok(added);
  assert.equal(isTemplateAvailable(added.id, LEGACY_BANK_VERSION), false);
  assert.equal(isTemplateAvailable(added.id, BANK_VERSION), true);
  assert.throws(() => generateQuestions({ grade: added.grade, bankVersion: LEGACY_BANK_VERSION, templateIds: [added.id] }), /Шаблон/);
  const draft = createConstructorDraft({ grade: added.grade });
  draft.slots = [{ id: 'a', templateId: added.id, points: 1 }];
  const issued = createConstructorAssignment(draft);
  assert.throws(() => normalizeAssignment({ ...issued, bankVersion: LEGACY_BANK_VERSION }), /шаблон/);
  assert.throws(() => normalizeAssignment({ ...issued, bankVersion: '2099.01.01' }), /версия банка/);
  assert.throws(() => generateQuestions({ grade: 7, bankVersion: '2099.01.01' }), /Версия банка/);
});

test('old constructor JSON remains editable and preserves its bank when replayed or issued again', () => {
  const item = fixture.cases.find(item => item.config.grade === 8 && item.config.templateIds);
  const draft = createConstructorDraft({ grade: 8 });
  draft.seed = item.config.seed;
  draft.slots = item.config.templateIds.map((templateId, index) => ({ id: `s-${index}`, templateId, points: 1 }));
  const envelope = JSON.parse(serializeConstructorDraft(draft));
  envelope.bankVersion = LEGACY_BANK_VERSION;
  const restored = parseConstructorDraft(JSON.stringify(envelope));
  assert.deepEqual(restored, { ...draft, bankVersion: LEGACY_BANK_VERSION });
  assert.equal(createConstructorAssignment(restored).bankVersion, LEGACY_BANK_VERSION);
  assert.deepEqual(parseConstructorDraft(serializeConstructorDraft(restored)), restored);
  const original = generateQuestions(item.config);
  const legacyConstructor = generateConstructorQuestions(restored, { variant: item.config.variant });
  assert.deepEqual(legacyConstructor.map(({ slotId, points, ...question }) => question), original.map(({ points, ...question }) => question), 'replay must preserve the entire generated question without overriding the bank');
  assert.deepEqual(legacyConstructor.map(q => q.points), restored.slots.map(slot => slot.points));
  const added = TEMPLATE_CATALOG.find(template => template.grade === 8 && !fixture.templates.includes(template.id));
  envelope.draft.slots[0].templateId = added.id;
  assert.throws(() => parseConstructorDraft(JSON.stringify(envelope)), /недоступен.*версии банка/);
});

test('all 1530 previous-bank snapshots retain the full 400-template bank exactly', () => {
  assert.equal(previousFixture.bankVersion, PREVIOUS_BANK_VERSION);
  assert.equal(previousFixture.templates.length, 400);
  assert.equal(previousFixture.cases.length, 1530);
  assert.ok(SUPPORTED_BANK_VERSIONS.includes(PREVIOUS_BANK_VERSION));
  assert.equal(TEMPLATE_CATALOG.filter(t => isTemplateAvailable(t.id, LEGACY_BANK_VERSION)).length, 100);
  assert.equal(TEMPLATE_CATALOG.filter(t => isTemplateAvailable(t.id, PREVIOUS_BANK_VERSION)).length, 400);
  for (const item of previousFixture.cases) {
    assert.deepEqual(generateBlueprint(item.config), item.blueprint, JSON.stringify(item.config));
    assert.equal(digest(generateQuestions(item.config)), item.questionsSha256, JSON.stringify(item.config));
  }
});

test('previous-bank v1 and v2 links preserve their issued version and answers', () => {
  const selected = [
    previousFixture.cases.find(item => item.config.grade === 8 && !item.config.templateIds && item.config.count === 5),
    previousFixture.cases.find(item => item.config.grade === 9 && item.config.templateIds?.[0].includes('-ext-')),
  ];
  assert.ok(selected.every(Boolean));
  for (const item of selected) {
    const old = item.config;
    const config = {
      v: old.templateIds ? 2 : 1, bankVersion: PREVIOUS_BANK_VERSION, title: 'Работа из банка 400',
      grade: old.grade, topicId: old.templateIds ? 'all' : old.topicId, profileId: old.templateIds ? 'custom' : 'quick', difficulty: old.difficulty,
      seed: old.seed, variant: old.variant, mode: 'control', strict: false, minutes: 25, calculator: true, python: true,
      ...(old.templateIds ? { workId: 'issued-with-400', revision: 3, slots: old.templateIds.map(templateId => ({ templateId, points: 2 })), thresholds: { five: 85, four: 70, three: 50 } } : {}),
    };
    const decoded = readAssignmentUrl(makeAssignmentUrl(config, 'https://example.github.io/code1430/'));
    assert.equal(decoded.bankVersion, PREVIOUS_BANK_VERSION);
    const questions = generateQuestions({ ...decoded, count: old.count, ...(decoded.slots ? { templateIds: decoded.slots.map(slot => slot.templateId) } : {}) });
    assert.equal(digest(questions), item.questionsSha256);
  }
});

test('both historical declarations reject types introduced in the second expansion', () => {
  const added = TEMPLATE_CATALOG.find(template => !previousFixture.templates.includes(template.id));
  assert.ok(added, 'second expansion must be registered');
  const draft = createConstructorDraft({ grade: added.grade });
  draft.slots = [{ id: 'new-slot', templateId: added.id, points: added.points }];
  const issued = createConstructorAssignment(draft);
  assert.equal(issued.bankVersion, BANK_VERSION);
  assert.equal(isTemplateAvailable(added.id, BANK_VERSION), true);
  for (const bankVersion of [LEGACY_BANK_VERSION, PREVIOUS_BANK_VERSION]) {
    assert.equal(isTemplateAvailable(added.id, bankVersion), false);
    assert.throws(() => generateQuestions({ grade: added.grade, bankVersion, templateIds: [added.id] }), /Шаблон/);
    assert.throws(() => normalizeAssignment({ ...issued, bankVersion }), /шаблон/);
    const envelope = JSON.parse(serializeConstructorDraft(draft));
    envelope.bankVersion = bankVersion;
    assert.throws(() => parseConstructorDraft(JSON.stringify(envelope)), /недоступен.*версии банка/);
  }
});

test('400-template constructor JSON remains editable and can reproduce its original questions', () => {
  const item = previousFixture.cases.find(item => item.config.grade === 8 && item.config.templateIds?.[0].includes('-ext-'));
  assert.ok(item);
  const draft = createConstructorDraft({ grade: 8 });
  draft.seed = item.config.seed;
  draft.slots = item.config.templateIds.map((templateId, index) => ({ id: `s-${index}`, templateId, points: 1 }));
  const envelope = JSON.parse(serializeConstructorDraft(draft));
  envelope.bankVersion = PREVIOUS_BANK_VERSION;
  const restored = parseConstructorDraft(JSON.stringify(envelope));
  assert.deepEqual(restored, { ...draft, bankVersion: PREVIOUS_BANK_VERSION });
  assert.equal(createConstructorAssignment(restored).bankVersion, PREVIOUS_BANK_VERSION);
  assert.deepEqual(parseConstructorDraft(serializeConstructorDraft(restored)), restored);
  const original = generateQuestions(item.config);
  const restoredQuestions = generateConstructorQuestions(restored, { variant: item.config.variant });
  assert.deepEqual(restoredQuestions.map(({ slotId, points, ...question }) => question), original.map(({ points, ...question }) => question), 'replay must preserve the entire generated question without overriding the bank');
  assert.deepEqual(restoredQuestions.map(q => q.points), restored.slots.map(slot => slot.points));
});
