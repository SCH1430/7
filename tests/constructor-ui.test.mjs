import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createConstructorController } from '../js/constructor-ui.js';
import { LEGACY_BANK_VERSION, TEMPLATE_CATALOG, generateQuestions, isTemplateAvailable } from '../js/bank.js';
import { parseConstructorDraft, serializeConstructorDraft, createConstructorDraft, generateConstructorQuestions } from '../js/constructor.js';

const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function setup(initialStorage = {}) {
  const dom = new JSDOM('<main></main>', { url: 'https://school.example/code1430/' });
  const root = dom.window.document.querySelector('main');
  for (const [key, value] of Object.entries(initialStorage)) dom.window.localStorage.setItem(key, value);
  const starts = [], issues = [], notices = [];
  const controller = createConstructorController({ root, onStart: (draft, variant) => starts.push({ draft, variant }), onIssue: (draft, variant) => issues.push({ draft, variant }), onNotice: message => notices.push(message) });
  const $ = selector => root.querySelector(selector);
  const click = action => { const element = $(`[data-ctor-action="${action}"]`);assert.ok(element, action);element.click(); };
  const change = (selector, value) => { const element = $(selector);assert.ok(element, selector);if (element.type === 'checkbox') element.checked = value;else element.value = String(value);element.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  const inputTitle = value => { const element = $('[data-ctor-field="title"]');element.value = value;element.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  const working = () => parseConstructorDraft(JSON.parse(dom.window.localStorage.getItem('code1430:constructor:working')).data);
  controller.render();
  return { dom, root, starts, issues, notices, controller, $, click, change, inputTitle, working, close: () => { controller.dispose();dom.window.close(); } };
}

async function importDraft(app, draft) {
  const file = { size: 1000, text: async () => serializeConstructorDraft(draft) };
  Object.defineProperty(app.$('#ctor-import'), 'files', { configurable: true, value: [file] });
  app.$('#ctor-import').dispatchEvent(new app.dom.window.Event('change', { bubbles: true }));
  await flush();
  if (app.$('[data-ctor-action="confirm"]')) app.click('confirm');
}

test('constructor builds ordered weighted slots and immutable issued revisions', async () => {
  const app = setup();
  try {
    const templates = TEMPLATE_CATALOG.filter(item => item.grade === 7).slice(0, 2);
    for (const template of templates) app.$(`[data-ctor-template="${template.id}"]`).click();
    assert.equal(app.working().slots.length, 2);
    assert.deepEqual(app.working().slots.map(slot => slot.templateId), templates.map(item => item.id));
    app.change('[data-ctor-points]', 4);
    app.click('down');
    assert.equal(app.working().slots[1].points, 4);
    assert.equal(app.working().slots[1].templateId, templates[0].id);
    app.inputTitle('Контрольная <script>bad()</script>');
    assert.equal(app.root.querySelector('script'), null);
    app.change('[data-ctor-field="variant"]', 12);
    app.click('issue');await flush();
    assert.equal(app.issues.length, 1);
    assert.equal(app.issues[0].variant, 12);
    assert.equal(app.issues[0].draft.revision, 1);
    const first = structuredClone(app.issues[0].draft);
    app.change('[data-ctor-points]', 5);
    app.click('issue');await flush();
    assert.equal(app.issues[1].draft.revision, 2);
    assert.deepEqual(app.issues[0].draft, first, 'already issued snapshot must not be edited');
    app.click('save');await flush();
    assert.equal(app.working().revision, 2, 'saving an unchanged revision must not increment it');
    app.click('start');await flush();
    assert.equal(app.starts[0].draft.revision, 2);
    assert.equal(app.starts[0].variant, 12);
    assert.match(app.root.textContent, /9 баллов/);
  } finally { app.close(); }
});

test('constructor resumes local draft, filters catalog and protects Python requirement', async () => {
  const app = setup();
  try {
    app.change('[data-ctor-field="grade"]', 9);
    app.change('[data-ctor-field="topic"]', 'g9-programming');
    const program = TEMPLATE_CATALOG.find(item => item.grade === 9 && item.kind === 'program');
    app.change('[data-ctor-field="python"]', false);
    app.$(`[data-ctor-template="${program.id}"]`).click();
    assert.equal(app.working().python, true);
    assert.equal(app.$('[data-ctor-field="python"]').disabled, true);
    app.click('preview');
    assert.equal(app.root.querySelectorAll('.ctor-preview-question').length, 1);
    assert.equal(app.root.querySelector('.ctor-solution'), null);
    app.change('[data-ctor-field="answers"]', true);
    assert.ok(app.root.querySelector('.ctor-solution pre').textContent.length > 5);
    const before = app.working();
    app.root.innerHTML = '<h1>Другой экран</h1>';
    app.controller.render();
    assert.equal(app.root.querySelectorAll('[data-ctor-slot]').length, 1);
    app.controller.dispose();
    const again = createConstructorController({ root: app.root });again.render();
    assert.equal(app.$('[data-ctor-field="grade"]').value, '9');
    assert.equal(app.root.querySelector('[data-ctor-slot]').dataset.ctorSlot, before.slots[0].id);
    again.dispose();
  } finally { app.close(); }
});

test('constructor validates imports before replacing draft and keeps unsupported saved records', async () => {
  const unknown = { id: 'future', updatedAt: 1, data: '{"future":true}' };
  const app = setup({ 'code1430:constructor:templates': JSON.stringify([unknown]) });
  try {
    app.click('preset');app.click('save');
    const stored = JSON.parse(app.dom.window.localStorage.getItem('code1430:constructor:templates'));
    assert.deepEqual(stored.find(item => item.id === 'future'), unknown);
    const before = app.working();
    const invalidFile = { size: 8, text: async () => '{"x":1}' };
    Object.defineProperty(app.$('#ctor-import'), 'files', { configurable: true, value: [invalidFile] });
    app.$('#ctor-import').dispatchEvent(new app.dom.window.Event('change', { bubbles: true }));await flush();
    assert.deepEqual(app.working(), before);
    assert.match(app.notices.at(-1), /Файл|файл|поле|шаблон/);
    const imported = createConstructorDraft({ grade: 11 });imported.title = 'Импортированная работа';
    const validFile = { size: 1000, text: async () => serializeConstructorDraft(imported) };
    Object.defineProperty(app.$('#ctor-import'), 'files', { configurable: true, value: [validFile] });
    app.$('#ctor-import').dispatchEvent(new app.dom.window.Event('change', { bubbles: true }));await flush();
    assert.equal(app.working().id, imported.id);
    assert.equal(app.working().grade, 11);
    assert.equal(app.$('[data-ctor-field="title"]').value, imported.title);
  } finally { app.close(); }
});

test('constructor grade reset and deletion require explicit in-app confirmation', async () => {
  const app = setup();
  try {
    app.click('preset');app.click('save');
    const original = app.working();
    app.change('[data-ctor-field="grade"]', 10);
    assert.equal(app.working().grade, 7);
    assert.equal(app.root.querySelectorAll('[data-ctor-slot]').length, 5);
    app.click('cancel');
    assert.equal(app.working().id, original.id);
    app.change('[data-ctor-field="grade"]', 10);app.click('confirm');
    assert.equal(app.working().grade, 10);
    assert.equal(app.working().slots.length, 0);
    app.change('[data-ctor-field="saved"]', original.id);
    app.click('copy');
    assert.equal(app.working().grade, 7);
    assert.notEqual(app.working().id, original.id);
    assert.equal(app.working().revision, 1);
    assert.equal(app.working().slots.length, 5);
    assert.notEqual(app.working().slots[0].id, original.slots[0].id);
  } finally { app.close(); }
});

test('imported revisions become the baseline for subsequent changes', async () => {
  const app = setup();
  try {
    const imported = createConstructorDraft({ grade: 7 });
    imported.revision = 8;
    imported.slots = [{ id: 'imported-slot', templateId: TEMPLATE_CATALOG.find(item => item.grade === 7).id, points: 2 }];
    const file = { size: 1000, text: async () => serializeConstructorDraft(imported) };
    Object.defineProperty(app.$('#ctor-import'), 'files', { configurable: true, value: [file] });
    app.$('#ctor-import').dispatchEvent(new app.dom.window.Event('change', { bubbles: true }));await flush();
    app.change('[data-ctor-points]', 4);
    app.click('issue');await flush();
    assert.equal(app.issues[0].draft.id, imported.id);
    assert.equal(app.issues[0].draft.revision, 9, 'editing imported revision 8 must issue revision 9');
    app.click('issue');await flush();
    assert.equal(app.issues[1].draft.revision, 9, 'unchanged imported work must keep its issued revision');
  } finally { app.close(); }
});

test('restoring an older revision advances beyond the latest content without reusing its number', async () => {
  const app = setup();
  try {
    app.click('preset');app.click('issue');await flush();
    const original = structuredClone(app.issues[0].draft);
    app.change('[data-ctor-points]', 7);app.click('issue');await flush();
    const latest = structuredClone(app.issues[1].draft);
    assert.equal(latest.revision, 2);
    await importDraft(app, original);
    app.click('save');
    assert.equal(app.working().revision, 3, 'restored revision 1 must become revision 3 after revision 2');
    assert.deepEqual(app.working().slots, original.slots);
    app.click('issue');await flush();
    assert.equal(app.issues.at(-1).draft.revision, 3, 'issuing unchanged restored content must retain its new number');
    app.change('[data-ctor-points]', 8);app.click('issue');await flush();
    assert.equal(app.issues.at(-1).draft.revision, 4);
    const unchanged = structuredClone(app.issues.at(-1).draft);
    unchanged.revision = 1;
    await importDraft(app, unchanged);
    app.click('save');
    assert.equal(app.working().revision, 4, 'importing identical content with an old revision must not create a new revision');
    const saved = JSON.parse(app.dom.window.localStorage.getItem('code1430:constructor:templates'));
    assert.equal(parseConstructorDraft(saved[0].data).revision, 4);
    assert.equal(latest.slots[0].points, 7, 'already issued snapshots remain unchanged');
  } finally { app.close(); }
});

test('old saved drafts retain their bank while catalog samples, additions and presets use that version', async () => {
  const draft = createConstructorDraft({ grade: 8 });
  draft.bankVersion = LEGACY_BANK_VERSION;draft.revision = 5;
  draft.slots = [{ id: 'old-slot', templateId: 'g8-bases-addition', points: 3 }];
  const data = serializeConstructorDraft(draft);
  const oldSignature = JSON.stringify({ ...draft, id: undefined, revision: undefined, bankVersion: undefined });
  const app = setup({
    'code1430:constructor:templates': JSON.stringify([{ id: draft.id, updatedAt: 1, data }]),
    'code1430:constructor:working': JSON.stringify({ data, variant: 3, baseSignature: oldSignature }),
  });
  try {
    const available = TEMPLATE_CATALOG.filter(item => item.grade === 8 && isTemplateAvailable(item.id, LEGACY_BANK_VERSION));
    assert.equal(app.working().bankVersion, LEGACY_BANK_VERSION);
    assert.deepEqual([...app.root.querySelectorAll('[data-ctor-template]')].map(item => item.dataset.ctorTemplate), available.map(item => item.id));
    const sample = generateQuestions({ grade: 8, seed: 1430, variant: 1, bankVersion: LEGACY_BANK_VERSION, templateIds: [available[0].id] })[0];
    const details = app.$('[data-ctor-sample]');details.open = true;
    details.dispatchEvent(new app.dom.window.Event('toggle'));
    assert.equal(app.$('.ctor-template .ctor-condition').textContent, sample.prompt);
    app.click('issue');await flush();
    assert.equal(app.issues[0].draft.revision, 5, 'migrating an old baseline must not create a false revision');
    assert.equal(app.issues[0].draft.bankVersion, LEGACY_BANK_VERSION);
    app.click('preview');
    assert.equal(app.$('.ctor-preview-question .ctor-condition').textContent, generateConstructorQuestions(draft, { variant: 3 })[0].prompt);
    app.$(`[data-ctor-template="${available[0].id}"]`).click();
    assert.equal(app.working().bankVersion, LEGACY_BANK_VERSION);
    app.click('clear');app.click('confirm');
    app.click('preset');
    assert.ok(app.working().slots.every(slot => isTemplateAvailable(slot.templateId, LEGACY_BANK_VERSION)));
    app.click('start');await flush();
    assert.equal(app.starts[0].draft.bankVersion, LEGACY_BANK_VERSION);
    assert.equal(app.starts[0].draft.revision, 6);
  } finally { app.close(); }
});

test('issued revisions stay stable and advance once when local storage rejects writes', async () => {
  const app = setup();
  try {
    app.click('preset');app.click('save');
    const storagePrototype = Object.getPrototypeOf(app.dom.window.localStorage);
    storagePrototype.setItem = () => { throw new Error('Quota exceeded'); };
    app.change('[data-ctor-points]', 7);
    app.click('issue');await flush();
    assert.equal(app.issues[0].draft.revision, 2);
    app.click('issue');await flush();
    assert.equal(app.issues[1].draft.revision, 2, 'a failed write must not increment an unchanged issued snapshot');
    app.change('[data-ctor-points]', 8);
    app.click('start');await flush();
    assert.equal(app.starts[0].draft.revision, 3);
    assert.equal(app.issues[0].draft.slots[0].points, 7, 'earlier issued work remains isolated');
    assert.match(app.$('#ctor-status').textContent, /не сохранён/);
    assert.match(app.notices.at(-1), /Не удалось сохранить шаблон/);
  } finally { app.close(); }
});

test('catalog search preserves focus, combines filters and leaves the saved work unchanged', () => {
  const app = setup();
  try {
    app.click('preset');app.click('save');
    const before = app.working(), all = TEMPLATE_CATALOG.filter(item => item.grade === 7);
    const search = app.$('[data-ctor-field="search"]');search.focus();
    const type = value => { search.value = value;search.dispatchEvent(new app.dom.window.Event('input', { bubbles: true })); };
    for (const query of ['б', 'би', 'биты']) {
      type(query);
      assert.equal(app.dom.window.document.activeElement, search, 'typing must keep the same focused search input');
      assert.equal(app.$('[data-ctor-field="search"]'), search);
    }
    assert.ok(app.root.querySelectorAll('.ctor-template').length > 0);
    assert.ok(app.root.querySelectorAll('.ctor-template').length < all.length);
    type('ИНФОРМАЦИЯ ОБЪЕМ');
    const normalize = value => value.toLowerCase().replace(/ё/g, 'е');
    const expected = all.filter(item => ['информация', 'объем'].every(word => normalize(`${item.title} ${item.topicTitle}`).includes(word)));
    assert.deepEqual([...app.root.querySelectorAll('[data-ctor-template]')].map(item => item.dataset.ctorTemplate), expected.map(item => item.id));
    app.change('[data-ctor-field="level"]', 'advanced');
    const filtered = expected.filter(item => item.difficulty === 'advanced');
    assert.equal(app.root.querySelectorAll('.ctor-template').length, filtered.length);
    assert.equal(app.$('[data-ctor-result-count]').textContent, `Найдено ${filtered.length} из ${all.length} типов`);
    assert.deepEqual(app.working(), before, 'searching and filtering must not alter the draft or revision');
    search.focus();type('нет такого <img src=x onerror=bad()>');
    assert.equal(app.root.querySelectorAll('.ctor-template').length, 0);
    assert.ok(app.$('.ctor-no-results'));
    assert.equal(app.root.querySelector('img'), null);
    app.click('reset-filters');
    assert.equal(app.$('[data-ctor-field="search"]').value, '');
    assert.equal(app.dom.window.document.activeElement, search);
    assert.equal(app.$('[data-ctor-field="level"]').value, 'all');
    assert.equal(app.root.querySelectorAll('.ctor-template').length, all.length);
    assert.deepEqual(app.working(), before);
  } finally { app.close(); }
});

test('filtered tasks can be added and preview solutions stay absent until explicitly revealed', () => {
  const app = setup();
  try {
    app.change('[data-ctor-field="grade"]', 9);
    const program = TEMPLATE_CATALOG.find(item => item.grade === 9 && item.kind === 'program');
    const search = app.$('[data-ctor-field="search"]');search.value = program.title;
    search.dispatchEvent(new app.dom.window.Event('input', { bubbles: true }));
    app.$(`[data-ctor-template="${program.id}"]`).click();
    assert.equal(app.working().slots[0].templateId, program.id);
    assert.equal(app.$('[data-ctor-field="search"]').value, program.title);
    assert.equal(app.$('[data-ctor-field="python"]').disabled, true);
    assert.equal(app.root.querySelector('.ctor-solution'), null);
    app.click('preview');
    const question = generateConstructorQuestions(app.working())[0];
    assert.equal(app.root.querySelector('.ctor-solution'), null);
    assert.ok(!app.$('.ctor-preview-question').textContent.includes(question.answer), 'the preview must not include solution source before consent');
    app.change('[data-ctor-field="answers"]', true);
    assert.equal(app.$('.ctor-solution pre code').textContent, question.answer);
    app.change('[data-ctor-field="answers"]', false);
    assert.equal(app.root.querySelector('.ctor-solution'), null, 'hiding answers must remove solution content from the DOM');
  } finally { app.close(); }
});

test('catalog only builds conditions for opened samples and keeps their code and choices', () => {
  const app = setup();
  try {
    assert.equal(app.root.querySelectorAll('.ctor-template').length, 160);
    assert.equal(app.root.querySelectorAll('.ctor-sample .prompt-content').length, 0, 'closed samples should not add hidden prompt markup');
    for (const kind of ['choice', 'program']) {
      const item = TEMPLATE_CATALOG.find(item => item.kind === kind);
      app.change('[data-ctor-field="grade"]', item.grade);
      const details = app.$(`[data-ctor-sample="${item.id}"]`);
      details.open = true;details.dispatchEvent(new app.dom.window.Event('toggle'));
      const q = generateQuestions({ grade: item.grade, seed: 1430, variant: 1, templateIds: [item.id] })[0];
      const condition = details.querySelector('.ctor-condition');
      assert.ok(condition, 'the native non-bubbling toggle event should populate the opened sample');
      assert.equal(details.querySelectorAll('.ctor-options li').length, q.options?.length || 0);
      if (q.code) assert.equal(details.querySelector('pre code').textContent, q.code);
      if (q.kind === 'program') assert.equal(details.querySelectorAll('.prompt-sample').length, 2);
      details.open = false;details.dispatchEvent(new app.dom.window.Event('toggle'));
      details.open = true;details.dispatchEvent(new app.dom.window.Event('toggle'));
      assert.equal(details.querySelector('.ctor-condition'), condition, 'reopening should reuse already formatted sample nodes');
      assert.equal(app.root.querySelectorAll('.ctor-sample .prompt-content').length, 1);
    }
    app.controller.dispose();
    const unopened = app.root.querySelector('[data-ctor-sample]:not([open])');
    unopened.open = true;unopened.dispatchEvent(new app.dom.window.Event('toggle'));
    assert.equal(unopened.querySelector('.ctor-condition'), null, 'disposing must remove the captured toggle listener');
  } finally { app.close(); }
});
