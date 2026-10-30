/**
 * Normalizes output string for competitive programming comparison:
 * - Trims trailing whitespace on each line
 * - Normalizes Windows (\r\n) to Unix (\n)
 * - Trims trailing empty lines
 */
export function normalizeOutput(text = '') {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Deterministically classifies execution results into a standard CP verdict.
 * @param {object} execResult - Result from executeBinary
 * @param {string} expectedOutput - Expected answer
 * @returns {{ verdict: 'AC' | 'WA' | 'TLE' | 'RTE', details: object }}
 */
export function classifyResult(execResult, expectedOutput = '') {
  if (execResult.timedOut) {
    return {
      verdict: 'TLE',
      details: {
        timeMs: execResult.timeMs,
        stderr: execResult.stderr
      }
    };
  }

  if (execResult.exitCode !== 0) {
    return {
      verdict: 'RTE',
      details: {
        exitCode: execResult.exitCode,
        signal: execResult.signal,
        errorOutput: execResult.stderr || `Process exited with code ${execResult.exitCode}`,
        timeMs: execResult.timeMs
      }
    };
  }

  const actualNorm = normalizeOutput(execResult.stdout);
  const expectedNorm = normalizeOutput(expectedOutput);

  if (actualNorm === expectedNorm) {
    return {
      verdict: 'AC',
      details: {
        timeMs: execResult.timeMs,
        stdout: execResult.stdout
      }
    };
  } else {
    return {
      verdict: 'WA',
      details: {
        actual: execResult.stdout,
        expected: expectedOutput,
        timeMs: execResult.timeMs,
        errorOutput: execResult.stderr
      }
    };
  }
}
