import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { BANK_VERSION } from '../js/bank.js';
import { readAssignmentUrl, makeAssignmentUrl } from '../js/assignment.js';

const root = new URL('../', import.meta.url);
const flush = async (times = 30) => { for (let i = 0; i < times; i++) await Promise.resolve(); };
const blueprint = questions => questions.map(q => [q.templateId, q.kind, q.points, q.difficulty, q.topicId]);
const content = questions => questions.map(q => [q.prompt, q.code || '', q.options || []]);

test('v1.1 user flows: levels, variants, links, error practice and highlighting', async t => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const dom = new JSDOM(html, { url: 'https://school.example/code-1430/', pretendToBeVisual: true });
  const saved = new Map(), timers = new Set(), downloads = [];
  const originalSetTimeout = globalThis.setTimeout;
  const replacements = {
    window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, indexedDB: undefined,
    setInterval: () => 0,
    setTimeout: (callback, delay, ...args) => { const timer = originalSetTimeout(callback, delay, ...args); timers.add(timer); return timer; },
    __upgradeDownloads: downloads,
  };
  for (const [name, value] of Object.entries(replacements)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const $ = selector => document.querySelector(selector);
  const change = (selector, value) => { const control = $(selector); assert.ok(control, selector); control.value = value; control.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  const click = selector => { const button = $(selector); assert.ok(button, selector); button.click(); };
  const submit = selector => $(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  let api;
  try {
    let source = await readFile(new URL('js/app.js', root), 'utf8');
    source = source.replace(/from '(\.\/[^']+)'/g, (_, path) => `from '${new URL(path, new URL('js/app.js', root)).href}'`);
    source = source.replace('createPngZip,downloadBlob,downloadPngPage', 'createPngZip,downloadBlob as originalDownloadBlob,downloadPngPage');
    source += '\nconst downloadBlob=(blob,filename)=>globalThis.__upgradeDownloads.push({blob,filename});\nexport const upgradeApi={state,showScreen,prepareStart,startAttempt,updateResponse,finishAttempt,restoreAttempt,getLocalConfig,createDraft,readSharedWork};\n';
    ({ upgradeApi: api } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`));
    await flush();
    assert.ok($('#difficulty-select'));
    assert.ok($('#variant-select'));

    async function startFromUi(name = 'Ученик Для Теста') {
      click('[data-action="prepare-start"]');
      assert.equal($('#start-dialog').open, true);
      $('#student-name').value = name;
      $('#student-class').value = `${api.state.draft.config.grade}А`;
      submit('#student-form');
      await flush();
      assert.equal(api.state.attempt.phase, 'active');
      return api.state.attempt;
    }
    async function clearCurrent() {
      if (api.state.attempt?.phase === 'active') await api.finishAttempt();
      if (api.state.attempt?.phase === 'finished') click('[data-action="new-work"]');
      if (api.state.assignment || api.state.assignmentError) click('[data-action="leave-assignment"]');
      await flush();
    }

    await t.test('difficulty and variant controls generate equivalent independent work', async () => {
      change('#difficulty-select', 'advanced');
      change('#variant-select', '30');
      const first = await startFromUi();
      assert.equal(first.difficulty, 'advanced');
      assert.equal(first.variant, 30);
      assert.ok(first.questions.every(q => q.difficulty === 'advanced'));
      await api.finishAttempt();
      click('[data-action="new-work"]');
      change('#variant-select', '29');
      const second = await startFromUi();
      assert.notEqual(second.id, first.id);
      assert.equal(second.seed, first.seed);
      assert.equal(second.variant, 29);
      assert.deepEqual(blueprint(second.questions), blueprint(first.questions));
      assert.notDeepEqual(content(second.questions), content(first.questions));
      assert.ok(Object.values(second.responses).every(r => r.text === '' && r.checked === false));
      await clearCurrent();
    });

    let sharedConfig, sharedUrl;
    await t.test('share form creates 30 links containing rules and no student data', async () => {
      click('[data-grade="8"]');
      click('[data-mode="control"]');
      change('#profile-select', 'thematic');
      change('#difficulty-select', 'mixed');
      change('#variant-select', '7');
      change('#strict-select', 'yes');
      api.state.prefs.studentName = 'PRIVATE_STUDENT_NAME';
      click('[data-action="prepare-share"]');
      assert.equal($('#share-dialog').open, true);
      $('#share-title').value = 'Проверка систем счисления';
      $('#share-minutes').value = '37';
      $('#share-calculator').checked = false;
      $('#share-python').checked = false;
      submit('#share-form');
      await flush();
      sharedUrl = $('#share-url').value;
      sharedConfig = readAssignmentUrl(sharedUrl);
      assert.equal(sharedConfig.minutes, 37);
      assert.equal(sharedConfig.variant, 7);
      assert.equal(sharedConfig.calculator, false);
      assert.equal(sharedConfig.python, false);
      assert.equal(sharedConfig.strict, true);
      assert.equal(sharedConfig.bankVersion, BANK_VERSION);
      assert.ok(!JSON.stringify(sharedConfig).includes('PRIVATE_STUDENT_NAME'));
      assert.ok(!Object.hasOwn(sharedConfig, 'studentName'));
      assert.ok(!Object.hasOwn(sharedConfig, 'answers'));
      click('[data-action="download-variants"]');
      await flush();
      assert.equal(downloads.length, 1);
      assert.match(downloads[0].filename, /30вариантов/);
      const text = await downloads[0].blob.text();
      const links = text.split('\n').filter(line => line.startsWith('https://'));
      assert.equal(links.length, 30);
      assert.equal(new Set(links).size, 30);
      links.forEach((url, index) => assert.deepEqual(readAssignmentUrl(url), { ...sharedConfig, variant: index + 1 }));
      assert.ok(!text.includes('PRIVATE_STUDENT_NAME'));
      click('[data-action="close-share"]');
    });

    await t.test('recipient sees fixed rules and hash changes preserve the active work', async () => {
      window.history.replaceState(null, '', sharedUrl);
      window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
      await flush();
      assert.equal($('#difficulty-select'), null);
      assert.equal($('#variant-select'), null);
      assert.equal($('[data-action="prepare-share"]'), null);
      assert.match($('#main').textContent, /Параметры этой работы фиксированы/);
      assert.match($('#main').textContent, /37 мин/);
      const attempt = await startFromUi('Получатель Ссылки');
      assert.equal(attempt.source, 'assignment');
      assert.equal(attempt.variant, 7);
      assert.equal(attempt.minutes, 37);
      assert.equal(attempt.endAt - attempt.startedAt, 37 * 60000);
      assert.deepEqual(attempt.tools, { calculator: false, python: false });
      assert.equal(attempt.strict, true);
      assert.equal(attempt.studentName, 'Получатель Ссылки');
      assert.deepEqual(attempt.assignmentConfig, sharedConfig);
      api.updateResponse(attempt.questions[0].answer);
      const deadline = attempt.endAt;
      const differentUrl = makeAssignmentUrl({ ...sharedConfig, variant: 9, minutes: 5 }, window.location.href);
      window.history.replaceState(null, '', differentUrl);
      window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
      await flush();
      assert.equal(api.state.attempt, attempt);
      assert.equal(attempt.variant, 7);
      assert.equal(attempt.endAt, deadline);
      assert.equal(attempt.responses[attempt.questions[0].id].text, attempt.questions[0].answer);
      assert.equal(api.state.assignment.variant, 9, 'the newly opened link is queued for a later work');
      await clearCurrent();
    });

    let sourceAttempt;
    await t.test('mistake practice creates fresh unanswered tasks and preserves the original grade', async () => {
      click('[data-grade="7"]');
      click('[data-topic="g7-information"]');
      click('[data-mode="training"]');
      change('#difficulty-select', 'basic');
      change('#profile-select', 'quick');
      sourceAttempt = await startFromUi();
      for (let i = 0; i < sourceAttempt.questions.length; i++) {
        click(`[data-question="${i}"]`);
        api.updateResponse(i < 2 ? sourceAttempt.questions[i].answer : '-99999999');
      }
      await api.finishAttempt();
      const snapshot = structuredClone(sourceAttempt);
      const wrong = sourceAttempt.questions.filter(q => sourceAttempt.responses[q.id].correct === false);
      assert.equal(wrong.length, 3);
      click('[data-action="practice-mistakes"]');
      assert.equal($('#start-dialog').open, true);
      assert.equal(api.state.attempt, sourceAttempt, 'opening a practice does not modify the finished work');
      assert.equal(api.state.draft.questions.length, wrong.length);
      submit('#student-form');
      await flush();
      const practice = api.state.attempt;
      assert.notEqual(practice.id, sourceAttempt.id);
      assert.equal(practice.source, 'practice');
      assert.equal(practice.sourceAttemptId, sourceAttempt.id);
      assert.equal(practice.mode, 'training');
      assert.equal(practice.endAt, null);
      assert.deepEqual(practice.questions.map(q => q.templateId), wrong.map(q => q.templateId));
      assert.ok(Object.values(practice.responses).every(r => r.text === '' && r.checked === false && r.correct === null));
      practice.questions.forEach((q, index) => {
        assert.notEqual(q.id, wrong[index].id);
        assert.notEqual(q.prompt, wrong[index].prompt, 'parameterized arithmetic should use fresh data');
      });
      assert.deepEqual(sourceAttempt, snapshot);
      const stored = JSON.parse(localStorage.getItem('code1430:attempts'));
      assert.deepEqual(stored[sourceAttempt.id].result, snapshot.result);
      await clearCurrent();
    });

    await t.test('all-correct result offers no mistake practice', async () => {
      const attempt = await startFromUi();
      for (let i = 0; i < attempt.questions.length; i++) {
        click(`[data-question="${i}"]`);
        api.updateResponse(attempt.questions[i].answer);
      }
      await api.finishAttempt();
      assert.equal(attempt.result.mark, 5);
      assert.equal($('[data-action="practice-mistakes"]'), null);
      await clearCurrent();
    });

    await t.test('saved v1.0 attempts without new metadata remain readable and resumable', async () => {
      const legacy = structuredClone(sourceAttempt);
      legacy.id = 'legacy-v1-active';
      legacy.version = 1;
      legacy.variant = 'ABC123';
      legacy.phase = 'active';
      legacy.finishedAt = null;
      legacy.result = null;
      for (const key of ['seriesId', 'difficulty', 'source', 'sourceAttemptId', 'sourceVariant', 'assignmentConfig', 'blueprint', 'workTitle']) delete legacy[key];
      for (const q of legacy.questions) for (const key of ['difficulty', 'difficultyTitle', 'difficultyReason']) delete q[key];
      await api.restoreAttempt(legacy);
      assert.equal(api.state.attempt.id, legacy.id);
      assert.equal(api.state.attempt.variant, 'ABC123');
      assert.equal(api.state.attempt.responses[legacy.questions[0].id].text, legacy.responses[legacy.questions[0].id].text);
      assert.match($('#main').textContent, /ABC123/);
      await api.finishAttempt();
      assert.equal(api.state.attempt.phase, 'finished');
      assert.deepEqual(api.state.attempt.result, sourceAttempt.result);
      await clearCurrent();
    });

    await t.test('Python highlighting tracks editing without changing the stored source', async () => {
      click('[data-grade="9"]');
      click('[data-topic="g9-programming"]');
      change('#difficulty-select', 'mixed');
      const attempt = await startFromUi();
      click('[data-action="open-program"]');
      const code = 'for n in range(3):\n    print("<tag>", n) # комментарий\n';
      $('#python-code').value = code;
      $('#python-code').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      const layer = $('.py-highlight-layer code');
      assert.ok(layer.querySelector('.py-token-keyword'));
      assert.ok(layer.querySelector('.py-token-string'));
      assert.ok(layer.querySelector('.py-token-comment'));
      assert.equal(layer.querySelector('tag'), null, 'source text must not become markup');
      assert.equal($('#python-code').value, code);
      assert.equal(attempt.responses[attempt.questions[0].id].code, code);
      click('[data-action="close-tools"]');
      for (const q of attempt.questions) attempt.responses[q.id].code = q.starterCode;
      await clearCurrent();
    });
  } finally {
    for (const timer of timers) clearTimeout(timer);
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    dom.window.close();
  }
});
