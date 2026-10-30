import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyResult, normalizeOutput } from '../src/runner/classifier.js';

describe('Deterministic Verdict Classifier', () => {
  it('should classify identical output as AC', () => {
    const execRes = {
      exitCode: 0,
      stdout: '42\n',
      stderr: '',
      timeMs: 15,
      timedOut: false
    };
    const res = classifyResult(execRes, '42\n');
    assert.strictEqual(res.verdict, 'AC');
  });

  it('should ignore Windows CRLF and trailing whitespace differences in AC', () => {
    const execRes = {
      exitCode: 0,
      stdout: 'Line 1   \r\nLine 2\r\n\r\n',
      stderr: '',
      timeMs: 10,
      timedOut: false
    };
    const res = classifyResult(execRes, 'Line 1\nLine 2');
    assert.strictEqual(res.verdict, 'AC');
  });

  it('should classify output differences as WA', () => {
    const execRes = {
      exitCode: 0,
      stdout: '-1294967296\n',
      stderr: '',
      timeMs: 12,
      timedOut: false
    };
    const res = classifyResult(execRes, '5000000000\n');
    assert.strictEqual(res.verdict, 'WA');
  });

  it('should classify timeout as TLE', () => {
    const execRes = {
      exitCode: null,
      stdout: '',
      stderr: '',
      timeMs: 2005,
      timedOut: true
    };
    const res = classifyResult(execRes, 'anything');
    assert.strictEqual(res.verdict, 'TLE');
  });

  it('should classify non-zero exit codes as RTE', () => {
    const execRes = {
      exitCode: 139,
      signal: 'SIGSEGV',
      stdout: '',
      stderr: 'Segmentation fault (core dumped)',
      timeMs: 5,
      timedOut: false
    };
    const res = classifyResult(execRes, 'anything');
    assert.strictEqual(res.verdict, 'RTE');
  });
});
