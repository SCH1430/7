import { loadPyodide } from '../vendor/pyodide/pyodide.mjs';

// These restrictions are for a small educational editor. They are not a security
// boundary against a person who can change the locally running application.
export const RUNNER_SOURCE = String.raw`
import ast as _ast
import builtins as _builtins
import sys as _sys
import traceback as _traceback
import contextlib as _contextlib

_sys.setrecursionlimit(1200)

class _SchoolOutputLimit(Exception):
    pass

class _SchoolWriter:
    def __init__(self, limit, emit):
        self.limit = limit
        self.emit = emit
        self.parts = []
        self.size = 0

    def write(self, value):
        value = str(value)
        remaining = self.limit - self.size
        if len(value) > remaining:
            if remaining > 0:
                piece = value[:remaining]
                self.parts.append(piece)
                self.size += len(piece)
                self.emit(piece)
            raise _SchoolOutputLimit('Слишком большой вывод. Ограничьте количество print().')
        self.parts.append(value)
        self.size += len(value)
        if value:
            self.emit(value)
        return len(value)

    def flush(self):
        pass

def _school_run(source, stdin, output_limit, emit):
    writer = _SchoolWriter(int(output_limit), emit)
    lines = str(stdin).replace('\r\n', '\n').replace('\r', '\n').split('\n')
    if lines and lines[-1] == '':
        lines.pop()
    position = 0

    def school_input(prompt=''):
        nonlocal position
        if prompt:
            writer.write(str(prompt))
        if position >= len(lines):
            raise EOFError('Не хватает входных данных. Добавьте строку в поле «Входные данные».')
        value = lines[position]
        position += 1
        return value

    allowed = (
        'int float str bool list tuple set dict frozenset range len sum min max '
        'abs round map filter sorted reversed enumerate zip bin oct hex chr ord '
        'all any divmod pow format repr isinstance issubclass type iter next '
        'print slice complex bytes bytearray hash callable '
        'Exception ValueError TypeError ZeroDivisionError IndexError KeyError '
        'RuntimeError StopIteration EOFError AssertionError ArithmeticError '
        'LookupError OverflowError RecursionError'
    ).split()
    safe_builtins = {name: getattr(_builtins, name) for name in allowed}
    safe_builtins['input'] = school_input
    scope = {'__builtins__': safe_builtins, '__name__': '__main__'}
    error = None
    try:
        tree = _ast.parse(source, filename='решение.py', mode='exec')
        for node in _ast.walk(tree):
            if isinstance(node, (_ast.Import, _ast.ImportFrom)):
                raise SyntaxError('В этом редакторе import отключён. Используйте базовый Python и встроенные функции.', ('решение.py', node.lineno, node.col_offset + 1, source.splitlines()[node.lineno - 1]))
            if isinstance(node, _ast.Attribute) and node.attr.startswith('_'):
                raise SyntaxError('Служебные атрибуты в учебном редакторе недоступны.', ('решение.py', node.lineno, node.col_offset + 1, source.splitlines()[node.lineno - 1]))
            if isinstance(node, _ast.Name) and node.id.startswith('__'):
                raise SyntaxError('Служебные имена в учебном редакторе недоступны.', ('решение.py', node.lineno, node.col_offset + 1, source.splitlines()[node.lineno - 1]))
        compiled = compile(tree, 'решение.py', 'exec')
        with _contextlib.redirect_stdout(writer), _contextlib.redirect_stderr(writer):
            exec(compiled, scope, scope)
    except BaseException as exc:
        if isinstance(exc, SyntaxError):
            error = f'Строка {exc.lineno or 1}: {exc.msg}'
        elif isinstance(exc, _SchoolOutputLimit):
            error = str(exc)
        else:
            frames = _traceback.extract_tb(exc.__traceback__)
            user_frames = [frame for frame in frames if frame.filename == 'решение.py']
            prefix = f'Строка {user_frames[-1].lineno}: ' if user_frames else ''
            error = prefix + type(exc).__name__ + ': ' + str(exc)
    return {'output': ''.join(writer.parts), 'error': error}
`;

const inBrowserWorker = typeof self !== 'undefined'
  && typeof WorkerGlobalScope !== 'undefined'
  && self instanceof WorkerGlobalScope;

if (inBrowserWorker) {
  let pyodide;
  let runner;
  let running = false;

  const initialize = async () => {
    const runtimeLocation = new URL('../vendor/pyodide/', import.meta.url);
    let indexURL = runtimeLocation.href;
    if (runtimeLocation.protocol === 'file:' && typeof process !== 'undefined' && process.versions?.node) {
      // URL.pathname includes an extra slash before Windows drive letters.
      const { fileURLToPath } = await import('node:url');
      indexURL = fileURLToPath(runtimeLocation);
    }
    pyodide = await loadPyodide({
      // Node smoke tests need a filesystem path; browsers use the local HTTP URL.
      indexURL,
      stdout: () => {},
      stderr: () => {},
    });
    pyodide.runPython(RUNNER_SOURCE);
    runner = pyodide.globals.get('_school_run');
    self.postMessage({ type: 'ready', version: pyodide.version });
  };

  self.onmessage = (event) => {
    const message = event.data;
    if (!message || message.type !== 'run') return;
    if (!runner || running) {
      self.postMessage({ type: 'done', id: message.id, output: '', error: 'Интерпретатор ещё не готов.' });
      return;
    }
    running = true;
    let result;
    try {
      result = runner(String(message.code), String(message.input || ''), Number(message.maxOutput) || 16000, (chunk) => {
        self.postMessage({ type: 'output', id: message.id, chunk: String(chunk) });
      });
      const converted = result.toJs({ dict_converter: Object.fromEntries });
      self.postMessage({ type: 'done', id: message.id, output: converted.output, error: converted.error ?? null });
    } catch (error) {
      self.postMessage({ type: 'done', id: message.id, output: '', error: String(error?.message || error) });
    } finally {
      result?.destroy?.();
      running = false;
    }
  };

  initialize().catch((error) => self.postMessage({ type: 'boot-error', error: String(error?.message || error) }));
}
