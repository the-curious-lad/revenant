import { describe, it } from 'node:test';
import assert from 'node:assert';
import { cosineSimilarity, clusterFailures } from '../src/ai/clustering.js';
import { validateSynthesizedCategory } from '../src/ai/synthesizer.js';
import { validateProposedDetector } from '../src/scanner/validator.js';

describe('Séance Clustering, Synthesis & Validation Gate', () => {
  it('should compute exact cosine similarity', () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];

    assert.strictEqual(cosineSimilarity(v1, v2), 1.0);
    assert.strictEqual(cosineSimilarity(v1, v3), 0.0);
  });

  it('should cluster failures when 3 or more have similarity >= threshold', () => {
    const baseVec = [0.5, 0.5, 0.5, 0.5];
    const similarVec1 = [0.51, 0.49, 0.5, 0.5];
    const similarVec2 = [0.49, 0.51, 0.5, 0.5];
    const differentVec = [-0.5, -0.5, 0.5, 0.5];

    const failures = [
      { file: 'f1.cpp', embedding: baseVec },
      { file: 'f2.cpp', embedding: similarVec1 },
      { file: 'f3.cpp', embedding: similarVec2 },
      { file: 'f4.cpp', embedding: differentVec }
    ];

    const clusters = clusterFailures(failures, 0.85, 3);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0].items.length, 3);
  });

  it('should validate synthesized category schema properly', () => {
    const raw = {
      key: 'Vector_Capacity_Bug',
      name: 'Vector Capacity',
      description: 'Calling push_back without reserve',
      detector_pattern: 'vector<.*>.*for.*push_back',
      explanation: 'Avoid reallocation overhead'
    };

    const res = validateSynthesizedCategory(raw);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.category.key, 'vector_capacity_bug');
    assert.strictEqual(res.category.status, 'active');
  });

  it('should reject proposed detector with catastrophic backtracking (ReDoS check)', () => {
    const proposal = {
      key: 'dangerous_pattern',
      detector_pattern: '(a+)+$'
    };

    const res = validateProposedDetector(proposal, [{ snapshot: 'aaaaa' }], []);
    assert.strictEqual(res.passed, false);
    assert.ok(res.reason.includes('backtracking'));
  });

  it('should reject proposed detector that fires too often on passing solutions (False Alarm Gate)', () => {
    const proposal = {
      key: 'overly_broad_detector',
      detector_pattern: 'int\\s+main' // Matches every C++ program!
    };

    const clusterFails = [
      { snapshot: 'int main() { fail1(); }' },
      { snapshot: 'int main() { fail2(); }' },
      { snapshot: 'int main() { fail3(); }' }
    ];

    const passingSolutions = [
      'int main() { return 0; }',
      'int main() { solve(); return 0; }',
      'int main() { ios::sync_with_stdio(0); }'
    ];

    const res = validateProposedDetector(proposal, clusterFails, passingSolutions);
    assert.strictEqual(res.passed, false);
    assert.ok(res.reason.includes('false alarms'));
  });

  it('should accept proposed detector with high recall and low false alarms', () => {
    const proposal = {
      key: 'specific_custom_sin',
      detector_pattern: 'vector<int>\\s+custom_global_bad'
    };

    const clusterFails = [
      { snapshot: 'vector<int> custom_global_bad;\nint main() {}' },
      { snapshot: 'vector<int> custom_global_bad;\nvoid solve() {}' },
      { snapshot: 'vector<int> custom_global_bad;\nint x = 1;' }
    ];

    const passingSolutions = [
      'int main() { return 0; }',
      'void solve() { vector<int> local; }'
    ];

    const res = validateProposedDetector(proposal, clusterFails, passingSolutions);
    assert.strictEqual(res.passed, true);
    assert.strictEqual(res.stats.failMatches, 3);
    assert.strictEqual(res.stats.passFalseAlarms, 0);
  });
});
