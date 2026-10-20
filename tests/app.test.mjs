import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import {calculateResult} from '../js/session.js';

const root = new URL('../', import.meta.url);
const flush = async (iterations = 40) => { for (let i = 0; i < iterations; i++) await Promise.resolve(); };

test('application integration without a browser or server', async t => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const dom = new JSDOM(html, { url: 'https://code1430.example/', pretendToBeVisual: true });
  const saved = new Map();
  const timers = new Set();
  const originalSetTimeout = globalThis.setTimeout;
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, indexedDB: undefined,
    setInterval: () => 0,
    setTimeout: (callback, delay, ...args) => { const timer = originalSetTimeout(callback, delay, ...args); timers.add(timer); return timer; }
  })) { saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }); }
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const $ = selector => document.querySelector(selector);
  let api;
  try {
    let source = await readFile(new URL('js/app.js', root), 'utf8');
    source = source.replace(/from '(\.\/[^']+)'/g, (_, path) => `from '${new URL(path, new URL('js/app.js', root)).href}'`);
    source += '\nexport const integration = {state,prepareStart,startAttempt,updateResponse,checkCurrent,finishAttempt,onHidden,onVisible,openTool,closeTools,runPython,tick};\n';
    ({ integration: api } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`));
    await flush();
    assert.match($('#main').textContent, /Мыслить логично/);

    async function start({ grade = 7, topicId = 'all', mode = 'training', strict = false } = {}) {
      api.state.attempt = null;
      Object.assign(api.state.prefs, { grade, topicId, mode, strict, profileId: 'quick' });
      api.prepareStart();
      $('#student-name').value = 'Тест Ученик';
      $('#student-class').value = `${grade}А`;
      await api.startAttempt($('#student-form'));
      await flush();
      assert.equal(api.state.attempt.phase, 'active');
      return api.state.attempt;
    }

    await t.test('focus layout keeps the task primary and navigation preserves the attempt', async () => {
      const attempt = await start();
      assert.equal(document.body.classList.contains('focus-mode'), true);
      assert.equal($('.work-aside'), null);
      assert.equal($('.workspace-header'), null);
      assert.equal($('.focus-support details[open]'), null);
      assert.equal($('.focus-navigation #work-progress').max, attempt.questions.length);
      assert.equal($('#work-timer').getAttribute('role'), 'timer');
      assert.equal($('#work-timer').getAttribute('aria-live'), 'off');
      assert.equal($('.question-card .primary').dataset.action, 'check-answer');
      assert.equal($('[data-action="ask-finish"]').classList.contains('primary'), false);
      $('.focus-navigation').open = true;
      $('[data-question="1"]').click();
      assert.equal(attempt.currentIndex, 1);
      assert.equal(document.activeElement, $('#question-title'));
      assert.equal($('.focus-navigation').open, false);
      $('.focus-menu-links [data-screen="history"]').click();
      assert.equal(document.body.classList.contains('focus-mode'), false);
      $(`[data-open-attempt="${attempt.id}"]`).click();
      await flush();
      assert.equal(api.state.attempt, attempt);
      assert.equal(document.body.classList.contains('focus-mode'), true);
      api.updateResponse(attempt.questions[1].answer);
      $('[data-action="check-answer"]').focus();
      await api.checkCurrent();
      assert.equal(document.activeElement, $('[data-action="check-answer"]'));
      await api.finishAttempt();
      assert.equal(document.body.classList.contains('focus-mode'), false);
    });

    await t.test('debounced writes save the latest reply and finishing flushes the final input', async () => {
      const attempt = await start();
      const question = attempt.questions[0];
      for (const value of ['1', '12', '123']) api.updateResponse(value);
      await new Promise(resolve => originalSetTimeout(resolve, 300));
      await flush();
      assert.equal(JSON.parse(localStorage.getItem('code1430:attempts'))[attempt.id].responses[question.id].text, '123');
      assert.match($('[data-question="0"]').getAttribute('aria-label'), /ответ введён/);
      api.updateResponse('456');
      await api.finishAttempt();
      assert.equal(JSON.parse(localStorage.getItem('code1430:attempts'))[attempt.id].responses[question.id].text, '456');
    });

    await t.test('all correct answers finish with mark 5 and persist', async () => {
      const attempt = await start();
      for (let i = 0; i < attempt.questions.length; i++) {
        $(`[data-question="${i}"]`).click();
        api.updateResponse(attempt.questions[i].answer);
      }
      await api.finishAttempt();
      assert.equal(attempt.phase, 'finished');
      assert.equal(attempt.result.mark, 5);
      assert.equal(attempt.result.percent, 100);
      assert.match($('#main').textContent, /Работа готова/);
      const stored = JSON.parse(localStorage.getItem('code1430:attempts'));
      assert.equal(stored[attempt.id].phase, 'finished');
      assert.equal(localStorage.getItem('code1430:recovery'), null);
    });

    await t.test('history resume retains input before debounce completes', async () => {
      const attempt = await start();
      const question = attempt.questions[attempt.currentIndex];
      api.updateResponse(question.answer);
      $('[data-screen="history"]').click();
      $(`[data-open-attempt="${attempt.id}"]`).click();
      await flush();
      assert.equal(api.state.attempt.responses[question.id].text, question.answer);
      assert.equal(api.state.attempt, attempt, 'resuming the active work must preserve its live object');
      await api.finishAttempt();
    });

    const storageSource=await readFile(new URL('js/storage.js',root),'utf8');
    const remoteStorage=await import(`data:text/javascript;base64,${Buffer.from(storageSource+'\n// second application tab').toString('base64')}`);
    await t.test('a conflicting active tab opens the latest saved answer and explains the conflict',async()=>{
      const attempt=await start(),question=attempt.questions[0],remote=structuredClone(attempt);
      remote.responses[question.id].text='answer from the other tab';assert.equal(await remoteStorage.saveAttempt(remote),true);
      api.updateResponse('stale answer');
      assert.notEqual(api.state.attempt,attempt);assert.equal(api.state.attempt.responses[question.id].text,'answer from the other tab');
      assert.match($('#toast').textContent,/другой вкладке/);assert.equal($('#answer-input')?.value??document.querySelector('input[name="answer"]:checked')?.value,question.kind==='choice'?undefined:'answer from the other tab');
      await api.finishAttempt();
    });
    await t.test('a storage event opens the result submitted in another tab',async()=>{
      const attempt=await start(),remote=structuredClone(attempt);
      Object.assign(remote,{phase:'finished',finishedAt:Date.now(),finishReason:'Сдано в другой вкладке',result:calculateResult(remote.questions,remote.responses,remote.thresholds)});
      assert.equal(await remoteStorage.saveAttempt(remote),true);
      window.dispatchEvent(new dom.window.StorageEvent('storage',{key:'code1430:attempts'}));await flush(100);
      assert.equal(api.state.attempt.phase,'finished');assert.equal(api.state.screen,'result');assert.match($('#main').textContent,/Работа готова/);assert.match($('#toast').textContent,/другой вкладке/);
      api.updateResponse('stale answer');assert.equal((await remoteStorage.listAttempts()).find(a=>a.id===attempt.id).phase,'finished');
    });

    await t.test('strict control ends on the third hide without a return', async () => {
      const attempt = await start({ mode: 'control', strict: true });
      for (let i = 0; i < 2; i++) { api.onHidden(); api.onVisible(); $('#away-dialog').close(); }
      api.onHidden();
      await flush();
      assert.notEqual(attempt.phase, 'active');
      assert.match(attempt.finishReason, /лимит скрытий/);
      assert.equal(attempt.events.filter(event => event.type === 'hidden').length, 3);
    });

    await t.test('expired control rejects input and keeps the deadline timestamp', async () => {
      const attempt = await start({ mode: 'control' });
      const question = attempt.questions[0];
      attempt.endAt = Date.now() - 5000;
      api.updateResponse(question.answer);
      api.tick();
      await flush();
      assert.equal(attempt.responses[question.id].text, '');
      assert.equal(attempt.finishedAt, attempt.endAt);
      assert.match(attempt.finishReason, /Время истекло/);
    });

    await t.test('closing a running editor prevents output leaking to the next question', async () => {
      const attempt = await start({ grade: 9, topicId: 'g9-programming' });
      let resolveRun, options;
      let stops = 0;
      api.state.engine = {
        run(code, input, callbacks) { options = callbacks; return new Promise(resolve => { resolveRun = resolve; }); },
        stop() { stops++; resolveRun?.({ output: 'OLD_RUN_OUTPUT', error: 'Остановлено', durationMs: 0 }); }
      };
      const first = attempt.questions[0];
      api.openTool('python', first.id);
      $('#python-code').value = 'print("OLD_RUN_OUTPUT")';
      $('#python-code').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      const run = api.runPython();
      assert.equal(api.state.running, true);
      api.closeTools();
      await run;
      $('[data-action="next"]').click();
      api.openTool('python', attempt.questions[1].id);
      assert.ok(stops >= 1, 'closing the running editor should cancel its execution');
      assert.doesNotMatch($('#python-output').textContent, /OLD_RUN_OUTPUT/);
      assert.equal($('#python-code').readOnly, false);
      api.closeTools();
      api.state.engine = null;
      // Avoid starting the real Web Worker while ending this test-only attempt.
      for (const question of attempt.questions) attempt.responses[question.id].code = question.starterCode;
      await api.finishAttempt();
    });

    await t.test('program grading awards partial points by passed tests', async () => {
      const attempt = await start({ grade: 9, topicId: 'g9-programming' });
      const question = attempt.questions[0];
      attempt.responses[question.id].code = question.answer;
      let call = 0;
      api.state.engine = {
        run() {
          const index = call++;
          return Promise.resolve({ output: index < 2 ? question.tests[index].output : 'wrong output', error: null, durationMs: 0 });
        },
        stop() {}
      };
      await api.finishAttempt();
      const response = attempt.responses[question.id];
      assert.equal(response.testResults.filter(test => test.correct).length, 2);
      assert.equal(response.score, Math.round(question.points * 2 / question.tests.length * 100) / 100);
      assert.equal(response.correct, false);
      assert.equal(attempt.result.score, response.score);
      assert.equal(attempt.result.pending, 0);
      assert.notEqual(attempt.result.mark, null);
    });

    await t.test('a stale training checker stops before launching the next program test',async()=>{
      const attempt=await start({grade:9,topicId:'g9-programming'}),question=attempt.questions[0];attempt.responses[question.id].code=question.answer;
      let resolveRun,runCount=0;api.state.engine={run(){runCount++;return new Promise(resolve=>{resolveRun=resolve;});},stop(){resolveRun?.({output:'',error:'Stopped'});}};
      const check=api.checkCurrent();await flush();assert.equal(runCount,1);
      const remote=structuredClone(attempt);remote.responses[question.id].code='# updated in another tab';assert.equal(await remoteStorage.saveAttempt(remote),true);
      window.dispatchEvent(new dom.window.StorageEvent('storage',{key:'code1430:attempts'}));await flush(100);await check;
      assert.equal(runCount,1);assert.equal(api.state.grading,false);assert.equal(api.state.attempt.responses[question.id].code,'# updated in another tab');
      for(const q of api.state.attempt.questions)api.state.attempt.responses[q.id].code=q.starterCode;await api.finishAttempt();
    });

    await t.test('a stale final grader cannot launch more tests or replace the other tab result',async()=>{
      const attempt=await start({grade:9,topicId:'g9-programming'}),question=attempt.questions[0];attempt.responses[question.id].code=question.answer;
      let resolveRun,runCount=0;api.state.engine={run(){runCount++;return new Promise(resolve=>{resolveRun=resolve;});},stop(){resolveRun?.({output:'',error:'Stopped'});}};
      const finishing=api.finishAttempt();await flush(100);assert.equal(runCount,1);
      const remote=structuredClone(attempt);remote.phase='finished';remote.result=calculateResult(remote.questions,remote.responses,remote.thresholds);assert.equal(await remoteStorage.saveAttempt(remote),true);
      window.dispatchEvent(new dom.window.StorageEvent('storage',{key:'code1430:attempts'}));await flush(100);await finishing;
      assert.equal(runCount,1);assert.equal(api.state.grading,false);assert.equal(api.state.attempt.phase,'finished');assert.deepEqual(api.state.attempt.result,remote.result);
    });

    await t.test('Python infrastructure failure withholds mark and retry completes grading', async () => {
      const attempt = await start({ grade: 9, topicId: 'g9-programming' });
      for (const question of attempt.questions) attempt.responses[question.id].code = question.answer;
      api.state.engine = { run: async () => ({ output: '', error: 'Python unavailable', infrastructureError: true }), stop() {} };
      await api.finishAttempt();
      assert.equal(attempt.phase, 'finished');
      assert.equal(attempt.result.pending, attempt.questions.length);
      assert.equal(attempt.result.mark, null);
      const retry = $('[data-action="retry-grading"]');
      assert.ok(retry);
      api.state.engine = {
        run: async (code, input) => {
          const question = attempt.questions.find(question => question.answer === code);
          const sample = question.tests.find(sample => sample.input === input);
          assert.ok(sample, 'grading must run a declared test with its input');
          return { output: sample.output, error: null, durationMs: 0 };
        },
        stop() {}
      };
      retry.click();
      await flush(100);
      assert.equal(attempt.phase, 'finished');
      assert.equal(attempt.result.pending, 0);
      assert.equal(attempt.result.mark, 5);
      assert.equal(attempt.result.percent, 100);
      assert.ok(attempt.questions.every(question => attempt.responses[question.id].correct));
      assert.equal($('[data-action="retry-grading"]'), null);
      const stored = JSON.parse(localStorage.getItem('code1430:attempts'));
      assert.equal(stored[attempt.id].result.mark, 5);
    });
  } finally {
    for (const timer of timers) clearTimeout(timer);
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
    dom.window.close();
  }
});

test('storage preserves finalized results and removes stale fallback after successful IDB save', async () => {
  const dom = new JSDOM('', { url: 'https://code1430.example/' });
  const previousLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousIdb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const rows = new Map([['same-id', { id: 'same-id', phase: 'finished', startedAt: 1, updatedAt: 300, result: { mark: 5 } }]]);
  const db = { transaction() {
    const transaction = { objectStore: () => ({
      getAll: () => request([...rows.values()]),
      get: id => request(rows.get(id)),
      put: value => { rows.set(value.id, structuredClone(value)); return request(value.id); },
      delete: id => { rows.delete(id); return request(undefined); }
    }) };
    function request(value) {
      const request = {};
      queueMicrotask(() => { request.result = value; request.onsuccess?.(); transaction.oncomplete?.(); });
      return request;
    }
    return transaction;
  } };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: dom.window.localStorage });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open() { const request = { result: db }; queueMicrotask(() => request.onsuccess?.()); return request; } } });
  try {
    localStorage.setItem('code1430:attempts', JSON.stringify({ 'same-id': { id: 'same-id', phase: 'active', startedAt: 1, updatedAt: 100 } }));
    const source = await readFile(new URL('js/storage.js', root), 'utf8');
    const storage = await import(`data:text/javascript;base64,${Buffer.from(source + '\n// isolated storage test').toString('base64')}`);
    const [attempt] = await storage.listAttempts();
    assert.equal(attempt.phase, 'finished');
    assert.equal(attempt.result.mark, 5);
    assert.equal(await storage.saveAttempt({ id: 'same-id', phase: 'finished', startedAt: 1, result: { mark: 4 } }), false);
    await storage.saveAttempt(attempt);
    const fallback = JSON.parse(localStorage.getItem('code1430:attempts') || '{}');
    assert.equal(fallback['same-id'], undefined);
    const [saved] = await storage.listAttempts();
    assert.equal(saved.result.mark, 5);
  } finally {
    if (previousLocal) Object.defineProperty(globalThis, 'localStorage', previousLocal); else delete globalThis.localStorage;
    if (previousIdb) Object.defineProperty(globalThis, 'indexedDB', previousIdb); else delete globalThis.indexedDB;
    dom.window.close();
  }
});
