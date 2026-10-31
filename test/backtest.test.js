import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runBacktest } from '../src/eval/backtest.js';
import { generateBenchmarkDataset } from '../src/eval/dataset_generator.js';

describe('70/30 Empirical Backtest Evaluator', () => {
  it('should generate a 100-run authentic benchmark dataset', () => {
    const dataset = generateBenchmarkDataset(100);
    assert.strictEqual(dataset.length, 100);
    assert.ok(dataset.some(d => d.verdict === 'AC'));
    assert.ok(dataset.some(d => d.verdict === 'WA'));
  });

  it('should split history into exact 70/30 partitions and calculate confusion matrix', () => {
    const dataset = generateBenchmarkDataset(100);
    const res = runBacktest(dataset, { split: 0.70 });

    assert.strictEqual(res.trainCount, 70);
    assert.strictEqual(res.testCount, 30);

    const { tp, fp, fn, tn } = res.confusionMatrix;
    assert.strictEqual(tp + fp + fn + tn, 30);

    assert.ok(res.metrics.precision >= 0 && res.metrics.precision <= 100);
    assert.ok(res.metrics.recall >= 0 && res.metrics.recall <= 100);
    assert.ok(res.metrics.falseAlarmRate >= 0 && res.metrics.falseAlarmRate <= 100);
  });

  it('should throw error when history is too small', () => {
    assert.throws(() => {
      runBacktest([{ verdict: 'AC' }]);
    }, /Insufficient history/);
  });
});
