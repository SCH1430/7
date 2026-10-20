import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from '../vendor/pyodide/pyodide.mjs';
import { RUNNER_SOURCE } from '../js/python-worker.js';
import { Worker as NodeWorker } from 'node:worker_threads';
import { PythonEngine } from '../js/python-engine.js';
import { TEMPLATE_CATALOG, generateQuestions } from '../js/bank.js';

const indexURL = fileURLToPath(new URL('../vendor/pyodide/', import.meta.url));
const runtime = await loadPyodide({ indexURL, stdout: () => {}, stderr: () => {} });
runtime.runPython(RUNNER_SOURCE);
const runner = runtime.globals.get('_school_run');

function run(code, input = '', maxOutput = 16000) {
  let streamed = '';
  const result = runner(code, input, maxOutput, chunk => { streamed += chunk; });
  const value = result.toJs({ dict_converter: Object.fromEntries });
  value.error ??= null;
  result.destroy();
  assert.equal(value.output, streamed, 'stream and final output agree');
  return value;
}

const successful = [
  ['print(2 + 3 * 4)', '', '14\n'],
  ['a, b = map(int, input().split())\nprint(a + b)', '17 25\n', '42\n'],
  ['def f(n):\n    s = 0\n    while n:\n        s += n % 3\n        n //= 3\n    return s\nprint(f(26))', '', '6\n'],
  ['s = "ИНФОРМАТИКА"\nprint(s.count("И"))\nprint(bin(45)[2:])', '', '2\n101101\n'],
  ['def fac(n):\n    return 1 if n <= 1 else n * fac(n - 1)\nprint(fac(6))', '', '720\n'],
  ['print(sum(x * x for x in range(5)))\nprint(sorted({3, 1, 2}))', '', '30\n[1, 2, 3]\n'],
  ['print(input())\nprint(input())', '\ntext\n', '\ntext\n'],
];
for (const [code, input, expected] of successful) {
  const result = run(code, input);
  assert.equal(result.error, null);
  assert.equal(result.output, expected);
}

assert.match(run('import math').error, /import отключён/);
assert.match(run('from os import system').error, /import отключён/);
assert.match(run('open("file.txt")').error, /NameError/);
assert.match(run('print((1).__class__)').error, /Служебные атрибуты/);
assert.match(run('print(__builtins__)').error, /Служебные имена/);
assert.match(run('print(input())').error, /Не хватает входных данных/);
assert.match(run('print(1/0)').error, /Строка 1: ZeroDivisionError/);
assert.match(run('for i in range(3)\n    print(i)').error, /Строка 1/);
assert.equal(run('x = 9').error, null);
assert.match(run('print(x)').error, /NameError/, 'globals are fresh per run');
const limited = run('print("a" * 1000)', '', 50);
assert.equal(limited.output.length, 50);
assert.match(limited.error, /Слишком большой вывод/);
let bankCases=0,bankPrograms=0,bankTraces=0;
for(const template of TEMPLATE_CATALOG){
  const question=generateQuestions({grade:template.grade,templateIds:[template.id],seed:2026,variant:7})[0];
  if(question.kind==='program'){
    bankPrograms++;
    for(const sample of question.tests){
      const result=run(question.answer,sample.input,8000);
      assert.equal(result.error,null,`${template.id}: ${result.error}`);
      assert.deepEqual(result.output.trim().split(/\s+/),sample.output.trim().split(/\s+/),template.id);
      bankCases++;
    }
  }else if(question.code){
    bankTraces++;const result=run(question.code);
    assert.equal(result.error,null,`${template.id}: ${result.error}`);
    assert.equal(result.output.trim(),String(question.answer).trim(),template.id);bankCases++;
  }
}
console.log(JSON.stringify({pythonBankCases:bankCases,programFamilies:bankPrograms,tracingFamilies:bankTraces}));
runner.destroy();
console.log(`Python runtime smoke: ${successful.length} positive and 11 negative/isolation checks passed. Pyodide ${runtime.version}.`);

// A Node worker adapter exercises the actual browser controller/worker protocol
// with real WASM execution. This is not a substitute for browser UI testing.
class NodeWorkerAdapter {
  constructor(url) {
    this.thread = new NodeWorker(`
      const { parentPort } = require('node:worker_threads');
      global.WorkerGlobalScope = class WorkerGlobalScope {};
      global.self = new WorkerGlobalScope();
      self.postMessage = (data) => parentPort.postMessage(data);
      parentPort.on('message', (data) => self.onmessage?.({ data }));
      import(${JSON.stringify(url.href)}).catch(error => parentPort.postMessage({type:'boot-error', error:error.message}));
    `, { eval: true });
    this.thread.on('message', data => this.onmessage?.({ data }));
    this.thread.on('error', error => this.onerror?.({ message: error.message, preventDefault() {} }));
  }
  postMessage(data) { this.thread.postMessage(data); }
  terminate() { this.thread.terminate(); }
}

const previousWorker = globalThis.Worker;
globalThis.Worker = NodeWorkerAdapter;
const engine = new PythonEngine();
try {
  const statuses = [];
  const first = await engine.run('print(sum(map(int, input().split())))', '4 5 6', { onStatus: status => statuses.push(status) });
  assert.equal(first.error, null);
  assert.equal(first.output, '15\n');
  assert.notEqual(first.infrastructureError, true);
  assert.deepEqual(statuses, ['loading', 'running', 'idle']);
  const invalid = await engine.run('print(1 / 0)');
  assert.match(invalid.error, /ZeroDivisionError/);
  assert.notEqual(invalid.infrastructureError, true);
  const timedOut = await engine.run('while True:\n    pass', '', { timeoutMs: 250 });
  assert.match(timedOut.error, /лимит/);
  assert.notEqual(timedOut.infrastructureError, true);
  const recovered = await engine.run('print("снова работает")');
  assert.equal(recovered.error, null);
  assert.equal(recovered.output, 'снова работает\n');
  const long = engine.run('while True:\n    pass');
  const concurrent = await engine.run('print(9)');
  assert.match(concurrent.error, /Дождитесь/);
  setTimeout(() => engine.stop(), 50);
  const stopped = await long;
  assert.match(stopped.error, /остановлено/);
  assert.notEqual(stopped.infrastructureError, true);
  console.log('Worker protocol: real execution, stdin/stdout, timeout, recovery, concurrent-run guard and Stop passed.');
} finally {
  engine.dispose();
  globalThis.Worker = previousWorker;
}

// Infrastructure failures must never be graded as mistakes in a student's code.
const previousSetTimeout = globalThis.setTimeout;
const infrastructureScenarios = ['constructor', 'boot-error', 'error', 'messageerror', 'boot-timeout'];
try {
  // Exercise the actual 60-second boot deadline without slowing down this test.
  globalThis.setTimeout = (callback, delay, ...args) => previousSetTimeout(callback, delay === 60000 ? 10 : delay, ...args);
  for (const scenario of infrastructureScenarios) {
    let terminated = false;
    globalThis.Worker = class FailureWorker {
      constructor() {
        if (scenario === 'constructor') throw new Error('Worker is unavailable');
        queueMicrotask(() => {
          if (scenario === 'boot-error') this.onmessage?.({ data: { type: 'boot-error', error: 'WASM is unavailable' } });
          if (scenario === 'error') this.onerror?.({ preventDefault() {} });
          if (scenario === 'messageerror') this.onmessageerror?.();
        });
      }
      postMessage() {}
      terminate() { terminated = true; }
    };
    const failedEngine = new PythonEngine();
    const result = await failedEngine.run('print(1)');
    assert.equal(result.infrastructureError, true, scenario);
    assert.equal(typeof result.error, 'string', scenario);
    assert.equal(result.durationMs, 0, scenario);
    assert.equal(failedEngine.active, null, scenario);
    assert.equal(failedEngine.worker, null, scenario);
    if (scenario !== 'constructor') assert.equal(terminated, true, scenario);
    failedEngine.dispose();
  }
  console.log('Infrastructure classification: constructor, boot error, worker error, message error and boot timeout passed.');
} finally {
  globalThis.setTimeout = previousSetTimeout;
  globalThis.Worker = previousWorker;
}
