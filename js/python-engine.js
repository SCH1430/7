/** Browser-only Python controller. Each execution runs outside the UI thread. */
export class PythonEngine {
  constructor() {
    this.worker = null;
    this.bootPromise = null;
    this.bootResolve = null;
    this.bootReject = null;
    this.bootTimer = null;
    this.active = null;
    this.sequence = 0;
  }

  run(code, input = '', options = {}) {
    if (this.active) {
      return Promise.resolve({ output: '', error: 'Дождитесь завершения программы или нажмите «Остановить».', durationMs: 0 });
    }
    if (typeof code !== 'string' || code.length > 30000) {
      return Promise.resolve({ output: '', error: 'Допустимо не более 30 000 символов кода.', durationMs: 0 });
    }
    if (String(input).length > 50000) {
      return Promise.resolve({ output: '', error: 'Входные данные слишком велики: максимум 50 000 символов.', durationMs: 0 });
    }
    return new Promise((resolve) => {
      const task = {
        id: ++this.sequence, code, input: String(input), resolve,
        onOutput: options.onOutput, onStatus: options.onStatus,
        timeoutMs: Math.max(250, Math.min(15000, Number(options.timeoutMs) || 5000)),
        maxOutput: Math.max(256, Math.min(64000, Number(options.maxOutput) || 16000)),
        output: '', startedAt: 0, timer: null,
      };
      this.active = task;
      this.start(task);
    });
  }

  async start(task) {
    try {
      this.notify(task, 'loading');
      if (this.active !== task) return;
      await this.ensureWorker();
      if (this.active !== task) return;
      task.startedAt = performance.now();
      this.notify(task, 'running');
      task.timer = setTimeout(() => {
        if (this.active === task) this.abort(`Программа остановлена: лимит ${task.timeoutMs / 1000} с. Проверьте циклы и сложность решения.`);
      }, task.timeoutMs);
      this.worker.postMessage({ type: 'run', id: task.id, code: task.code, input: task.input, maxOutput: task.maxOutput });
    } catch (error) {
      if (this.active === task) {
        this.abort(`Не удалось запустить Python. ${error?.message || 'Проверьте доступность файлов интерпретатора.'}`, true);
      }
    }
  }

  ensureWorker() {
    if (this.bootPromise) return this.bootPromise;
    this.bootPromise = new Promise((resolve, reject) => {
      this.bootResolve = resolve;
      this.bootReject = reject;
    });
    const promise = this.bootPromise;
    try {
      const worker = new Worker(new URL('./python-worker.js', import.meta.url), { type: 'module', name: 'code1430-python' });
      this.worker = worker;
      worker.onmessage = (event) => { if (this.worker === worker) this.handleMessage(event.data); };
      worker.onerror = (event) => {
        if (this.worker !== worker) return;
        event.preventDefault?.();
        this.abort('Ошибка загрузки Python. Откройте тренажёр через GitHub Pages или локальный HTTP-сервер; запуск двойным щелчком по HTML не поддерживается.', true);
      };
      worker.onmessageerror = () => { if (this.worker === worker) this.abort('Ошибка обмена данными с Python. Запустите программу ещё раз.', true); };
      this.bootTimer = setTimeout(() => this.abort('Загрузка Python заняла слишком много времени. Проверьте соединение и попробуйте ещё раз.', true), 60000);
    } catch (error) {
      this.bootReject(error);
      this.bootResolve = this.bootReject = null;
      this.worker = null;
      this.bootPromise = null;
    }
    return promise;
  }

  handleMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') {
      clearTimeout(this.bootTimer);
      this.bootResolve?.();
      this.bootResolve = this.bootReject = null;
      return;
    }
    if (message.type === 'boot-error') {
      this.abort(`Python не загрузился: ${message.error || 'неизвестная ошибка'}`, true);
      return;
    }
    const task = this.active;
    if (!task || message.id !== task.id) return;
    if (message.type === 'output') {
      const chunk = String(message.chunk || '');
      task.output = (task.output + chunk).slice(0, task.maxOutput);
      try { task.onOutput?.(chunk); } catch { /* Consumer callbacks must not break the worker lifecycle. */ }
    } else if (message.type === 'done') {
      this.finish({ output: String(message.output ?? task.output).slice(0, task.maxOutput), error: message.error || null });
    }
  }

  notify(task, status) {
    try { task.onStatus?.(status); } catch { /* UI callback is optional. */ }
  }

  finish(result) {
    const task = this.active;
    if (!task) return;
    this.active = null;
    clearTimeout(task.timer);
    this.notify(task, 'idle');
    task.resolve({ ...result, durationMs: task.startedAt ? Math.round(performance.now() - task.startedAt) : 0 });
  }

  abort(message, infrastructureError = false) {
    const task = this.active;
    this.destroyWorker(message);
    if (task) this.finish({ output: task.output, error: message, ...(infrastructureError ? { infrastructureError: true } : {}) });
  }

  destroyWorker(reason = 'Интерпретатор остановлен.') {
    clearTimeout(this.bootTimer);
    this.worker?.terminate();
    this.worker = null;
    this.bootReject?.(new Error(reason));
    this.bootResolve = this.bootReject = null;
    this.bootPromise = null;
  }

  stop() {
    this.abort('Выполнение остановлено. Код и входные данные сохранены.');
  }

  dispose() {
    this.abort('Интерпретатор закрыт.');
  }
}
