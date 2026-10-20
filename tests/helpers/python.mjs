import { spawnSync } from 'node:child_process';

const interpreters = new Map();

export function spawnPythonSync(args, options = {}) {
  const env = {
    ...process.env,
    ...options.env,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
  };
  const executable = env.PYTHON_EXECUTABLE?.trim();
  const key = JSON.stringify([executable || '', env.PATH, env.Path]);
  let interpreter = interpreters.get(key);
  if (!interpreter) {
    const candidates = executable
      ? [{ command: executable, prefix: [] }]
      : [
        { command: 'python3', prefix: [] },
        { command: 'python', prefix: [] },
        { command: 'py', prefix: ['-3'] },
      ];
    interpreter = candidates.find(({ command, prefix }) => {
      const probe = spawnSync(command, [...prefix, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)'], {
        env,
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true,
      });
      return !probe.error && probe.status === 0;
    });
    if (!interpreter) {
      throw new Error(executable
        ? `PYTHON_EXECUTABLE does not point to a working Python 3.7+ interpreter: ${executable}`
        : 'Python 3.7+ is required for these tests. Install Python or set PYTHON_EXECUTABLE to its executable path.');
    }
    interpreters.set(key, interpreter);
  }
  return spawnSync(interpreter.command, [...interpreter.prefix, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
    env,
  });
}
