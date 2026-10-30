import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateDiagnosisSchema, heuristicDiagnose } from '../src/ai/diagnostician.js';

describe('Cold-Path Diagnostician & Schema Validator', () => {
  const validCategories = new Set(['int_overflow', 'off_by_one_index', 'unreset_global_state']);

  it('should accept valid JSON adhering to schema', () => {
    const raw = {
      category: 'int_overflow',
      is_new: false,
      line: 14,
      evidence: 'int sum = 0;',
      explanation: 'Integer overflow on 32-bit int.'
    };
    const res = validateDiagnosisSchema(raw, validCategories);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.sanitized.category, 'int_overflow');
    assert.strictEqual(res.sanitized.line, 14);
    assert.strictEqual(res.sanitized.is_new, false);
  });

  it('should downgrade unknown categories to uncategorized and mark is_new: true', () => {
    const raw = {
      category: 'some_unknown_weird_error',
      is_new: false,
      line: 5,
      evidence: 'weird syntax',
      explanation: 'unknown'
    };
    const res = validateDiagnosisSchema(raw, validCategories);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.sanitized.category, 'uncategorized');
    assert.strictEqual(res.sanitized.is_new, true);
  });

  it('should handle missing fields safely with sanitization defaults', () => {
    const raw = {};
    const res = validateDiagnosisSchema(raw, validCategories);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.sanitized.category, 'uncategorized');
    assert.strictEqual(res.sanitized.line, null);
  });

  it('should correctly diagnose compile error under heuristic mode', () => {
    const code = 'int main() { broken code }';
    const diag = heuristicDiagnose(code, { verdict: 'CE', errorOutput: 'error: expected ;' });
    assert.strictEqual(diag.category, 'compile_error');
  });

  it('should detect int_overflow under heuristic mode', () => {
    const code = 'int main() {\nint sum = 0;\n}';
    const diag = heuristicDiagnose(code, { verdict: 'WA', actualOutput: '-123' });
    assert.strictEqual(diag.category, 'int_overflow');
    assert.strictEqual(diag.line, 2);
  });
});
