import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { readAssignmentUrl } from '../js/assignment.js';
import { parseConstructorDraft } from '../js/constructor.js';
import { buildReportLayout } from '../js/export.js';

const root = new URL('../', import.meta.url);
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const planOf = questions => questions.map(q => ({ templateId: q.templateId, points: q.points }));

test('v1.2 app connects the constructor, immutable links, grading and report export', async t => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const dom = new JSDOM(html, { url: 'https://school.example/code-1430/', pretendToBeVisual: true });
  const saved = new Map(), timers = new Set(), downloads = [];
  const originalSetTimeout = globalThis.setTimeout;
  const replacements = {
    window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, indexedDB: undefined,
    setInterval: () => 0,
    setTimeout: (callback, delay, ...args) => { const timer = originalSetTimeout(callback, delay, ...args); timers.add(timer); return timer; },
    __constructorAppDownloads: downloads,
  };
  for (const [name, value] of Object.entries(replacements)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const $ = selector => document.querySelector(selector);
  const click = selector => { const button = $(selector); assert.ok(button, selector); button.click(); };
  const change = (selector, value) => {
    const control = $(selector); assert.ok(control, selector);
    if (control.type === 'checkbox') control.checked = value;
    else control.value = String(value);
    control.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  };
  const title = value => {
    const control = $('[data-ctor-field="title"]'); assert.ok(control);
    control.value = value; control.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  const submit = selector => { const form = $(selector); assert.ok(form, selector); form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); };
  const working = () => parseConstructorDraft(JSON.parse(localStorage.getItem('code1430:constructor:working')).data);
  const slots = [
    { templateId: 'g8-bases-octal', points: 1 },
    { templateId: 'g8-bases-binary', points: 2 },
    { templateId: 'g8-bases-tobinary', points: 7 },
  ];
  const thresholds = { five: 95, four: 80, three: 60 };
  const gradingScale = 'Оценка 5 — от 95%; 4 — от 80%; 3 — от 60%; 2 — менее 60%.';
  let api, issuedUrl, issued, recipientAttempt;

  try {
    const appUrl = new URL('js/app.js', root);
    let source = await readFile(appUrl, 'utf8');
    source = source.replace(/from '(\.\/[^']+)'/g, (_, path) => `from '${new URL(path, appUrl).href}'`);
    source = source.replace('createPngZip,downloadBlob,downloadPngPage', 'createPngZip,downloadBlob as originalDownloadBlob,downloadPngPage');
    source += '\nconst downloadBlob=(blob,filename)=>globalThis.__constructorAppDownloads.push({blob,filename});\nexport const constructorAppApi={state,constructorController,startConstructedDraft,shareConstructedDraft,updateResponse,finishAttempt,buildReport};\n';
    ({ constructorAppApi: api } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`));
    await flush();

    async function startDialog(name) {
      assert.equal($('#start-dialog').open, true);
      $('#student-name').value = name;
      $('#student-class').value = '8Б';
      submit('#student-form'); await flush();
      assert.equal(api.state.attempt.phase, 'active');
      assert.equal($('#start-dialog').open, false);
      return api.state.attempt;
    }

    await t.test('issuing a saved constructor revision creates v2 links with the ordered weighted plan', async () => {
      click('[data-screen="constructor"]');
      change('[data-ctor-field="grade"]', 8);
      title('Системы счисления · подготовка');
      for (const slot of slots) click(`[data-ctor-action="add"][data-ctor-template="${slot.templateId}"]`);
      for (let i = 0; i < slots.length; i++) change(`[data-ctor-slot="${working().slots[i].id}"] [data-ctor-points]`, slots[i].points);
      change('[data-ctor-field="mode"]', 'control');
      change('[data-ctor-field="minutes"]', 31);
      change('[data-ctor-field="strict"]', true);
      change('[data-ctor-field="calculator"]', false);
      change('[data-ctor-field="python"]', false);
      for (const [mark, percent] of Object.entries(thresholds)) change(`[data-ctor-threshold="${mark}"]`, percent);
      change('[data-ctor-field="variant"]', 13);
      click('[data-ctor-action="save"]'); await flush();
      title('Системы счисления · контроль №2');
      api.state.prefs.studentName = 'PRIVATE_STUDENT_NAME';
      click('[data-ctor-action="issue"]'); await flush();
      assert.equal($('#share-dialog').open, true);
      assert.equal($('#share-title').readOnly, true);
      assert.equal($('#share-minutes').readOnly, true);
      assert.equal($('#share-calculator').disabled, true);
      assert.equal($('#share-python').disabled, true);
      submit('#share-form'); await flush();
      issuedUrl = $('#share-url').value;
      issued = readAssignmentUrl(issuedUrl);
      assert.equal(issued.v, 2);
      assert.equal(issued.profileId, 'custom');
      assert.equal(issued.revision, 2);
      assert.equal(issued.workId, working().id);
      assert.equal(issued.title, 'Системы счисления · контроль №2');
      assert.equal(issued.grade, 8);
      assert.equal(issued.variant, 13);
      assert.equal(issued.minutes, 31);
      assert.equal(issued.strict, true);
      assert.equal(issued.calculator, false);
      assert.equal(issued.python, false);
      assert.deepEqual(issued.slots, slots);
      assert.deepEqual(issued.thresholds, thresholds);
      assert.ok(!JSON.stringify(issued).includes('PRIVATE_STUDENT_NAME'));
      assert.equal(Object.hasOwn(issued, 'answers'), false);

      click('[data-action="download-variants"]'); await flush();
      assert.equal(downloads.length, 1);
      const text = await downloads[0].blob.text();
      assert.ok(text.includes(gradingScale));
      assert.ok(text.includes(`Редакция: 2 · шаблон ${issued.workId}`));
      const links = text.split('\n').filter(line => line.startsWith('https://'));
      assert.equal(links.length, 30);
      links.forEach((link, index) => assert.deepEqual(readAssignmentUrl(link), { ...issued, variant: index + 1 }));
      click('[data-action="close-share"]');
    });

    await t.test('editing and saving the next draft leaves already issued app config and link unchanged', async () => {
      title('Следующая редакция, другие правила');
      change(`[data-ctor-slot="${working().slots[2].id}"] [data-ctor-points]`, 4);
      change('[data-ctor-threshold="five"]', 100);
      change('[data-ctor-threshold="four"]', 90);
      change('[data-ctor-threshold="three"]', 80);
      click('[data-ctor-action="save"]'); await flush();
      assert.equal(working().revision, 3);
      assert.deepEqual(readAssignmentUrl(issuedUrl), issued);
      assert.deepEqual(api.state.shareConfig, issued);
      assert.equal(issued.slots[2].points, 7);
      assert.equal(issued.thresholds.three, 60);
    });

    await t.test('opening v2 starts the original revision with its time, tools, exact tasks and points', async () => {
      window.history.replaceState(null, '', issuedUrl);
      window.dispatchEvent(new dom.window.HashChangeEvent('hashchange')); await flush();
      assert.equal(api.state.assignmentError, '');
      assert.deepEqual(api.state.assignment, issued);
      assert.match($('#main').textContent, /Редакция 2 · 10 баллов/);
      assert.ok($('#main').textContent.includes(gradingScale));
      assert.equal($('#difficulty-select'), null);
      assert.equal($('#variant-select'), null);
      click('[data-action="prepare-start"]');
      assert.ok($('#start-dialog-content').textContent.includes(gradingScale));
      recipientAttempt = await startDialog('Получатель Контрольной');
      assert.equal(recipientAttempt.source, 'assignment');
      assert.equal(recipientAttempt.profileId, 'custom');
      assert.equal(recipientAttempt.constructorWorkId, issued.workId);
      assert.equal(recipientAttempt.constructorRevision, 2);
      assert.equal(recipientAttempt.variant, 13);
      assert.equal(recipientAttempt.endAt - recipientAttempt.startedAt, 31 * 60000);
      assert.equal(recipientAttempt.strict, true);
      assert.deepEqual(recipientAttempt.tools, { calculator: false, python: false });
      assert.deepEqual(recipientAttempt.assignmentConfig, issued);
      assert.notEqual(recipientAttempt.assignmentConfig, api.state.assignment);
      assert.deepEqual(planOf(recipientAttempt.questions), slots);
      assert.deepEqual(recipientAttempt.thresholds, thresholds);
    });

    await t.test('an active work blocks constructor access and both constructor launch callbacks', async () => {
      api.updateResponse('-999999');
      const before = structuredClone(recipientAttempt);
      const storedDraft = localStorage.getItem('code1430:constructor:working');
      click('[data-screen="constructor"]');
      assert.match($('#main').textContent, /Завершите текущую работу/);
      assert.equal($('[data-ctor-root]'), null);
      assert.equal($('.ctor-preview-question'), null);
      api.startConstructedDraft(working(), 2);
      api.shareConstructedDraft(working(), 2);
      assert.equal($('#start-dialog').open, false);
      assert.equal($('#share-dialog').open, false);
      assert.equal(api.state.attempt, recipientAttempt);
      assert.deepEqual(recipientAttempt, before);
      assert.equal(localStorage.getItem('code1430:constructor:working'), storedDraft);
      click('[data-action="resume"]');
      assert.ok($('[data-question="2"]'));
    });

    await t.test('grading and the exported report preserve custom weights, thresholds and issued revision', async () => {
      for (let i = 0; i < recipientAttempt.questions.length; i++) {
        click(`[data-question="${i}"]`);
        api.updateResponse(i === 2 ? recipientAttempt.questions[i].answer : '-999999');
      }
      await api.finishAttempt();
      assert.equal(recipientAttempt.phase, 'finished');
      assert.deepEqual(recipientAttempt.result, { score: 7, maxScore: 10, percent: 70, mark: 3, pending: 0 });
      assert.ok($('#main').textContent.includes(gradingScale));
      assert.equal($('.big-mark').firstChild.textContent, '3');
      const report = api.buildReport(recipientAttempt);
      assert.equal(report.constructorRevision, 2);
      assert.equal(report.constructorWorkId, issued.workId);
      assert.equal(report.gradingScale, gradingScale);
      assert.equal(report.workTitle, issued.title);
      assert.equal(report.mark, 3);
      assert.deepEqual(planOf(report.questions), slots);
      assert.deepEqual(report.questions.map(q => q.score), [0, 0, 7]);
      const outputText = buildReportLayout(report).pages.flatMap(page => page.commands.filter(command => command.type === 'text').map(command => command.text)).join('\n');
      assert.match(outputText, /Редакция: 2/);
      assert.ok(outputText.includes(issued.workId));
      assert.match(outputText, /Шкала оценивания: Оценка 5 — от 95%/);
      assert.match(outputText, /4 — от 80%; 3 — от 60%/);
      assert.match(outputText, /7 из 10 баллов \(70%\).*Оценка: 3/);
      const stored = JSON.parse(localStorage.getItem('code1430:attempts'))[recipientAttempt.id];
      assert.deepEqual(stored.result, recipientAttempt.result);
      assert.deepEqual(stored.thresholds, thresholds);
      assert.equal(stored.constructorRevision, 2);
      assert.deepEqual(stored.assignmentConfig, issued);
    });

    await t.test('the edited constructor revision can start locally without changing the earlier result', async () => {
      const previous = structuredClone(recipientAttempt);
      click('[data-action="new-work"]');
      click('[data-action="leave-assignment"]');
      click('[data-screen="constructor"]');
      assert.equal($('[data-ctor-field="title"]').value, 'Следующая редакция, другие правила');
      click('[data-ctor-action="start"]'); await flush();
      const local = await startDialog('Автор Следующей Редакции');
      assert.equal(local.source, 'constructor');
      assert.equal(local.constructorWorkId, issued.workId);
      assert.equal(local.constructorRevision, 3);
      assert.equal(local.assignmentConfig.v, 2);
      assert.deepEqual(planOf(local.questions), [...slots.slice(0, 2), { ...slots[2], points: 4 }]);
      assert.deepEqual(local.thresholds, { five: 100, four: 90, three: 80 });
      assert.deepEqual(recipientAttempt, previous);
      await api.finishAttempt();
    });
  } finally {
    api?.constructorController.dispose();
    for (const timer of timers) clearTimeout(timer);
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    dom.window.close();
  }
});
