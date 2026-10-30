import { spawn } from 'child_process';

/**
 * Runs a binary with provided input and a strict timeout.
 * @param {string} binaryPath - Path to the executable.
 * @param {string} input - Stdin text.
 * @param {number} timeoutMs - Max execution time in ms (default 2000ms).
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, signal: string, timeMs: number, timedOut: boolean }>}
 */
export function executeBinary(binaryPath, input = '', timeoutMs = 2000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let timedOut = false;
    let stdoutData = '';
    let stderrData = '';

    const child = spawn(binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();

    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const timeMs = Date.now() - startTime;
      resolve({
        stdout: stdoutData,
        stderr: stderrData,
        exitCode: code,
        signal,
        timeMs,
        timedOut
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout: stdoutData,
        stderr: stderrData + '\n' + err.message,
        exitCode: 1,
        signal: null,
        timeMs: Date.now() - startTime,
        timedOut: false
      });
    });
  });
}
