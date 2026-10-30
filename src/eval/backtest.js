import chalk from 'chalk';
import Table from 'cli-table3';
import { runHotScan } from '../scanner/detectors.js';
import { SEED_CATEGORIES } from '../db/mongo.js';

/**
 * Runs a rigorous 70/30 chronological backtest on historical code submissions.
 * 
 * @param {Array<object>} chronologicalHistory - Chronological array of runs:
 *   { file, code, verdict, expectedVerdict, category, timestamp }
 * @param {object} options - Configuration options
 * @returns {object} Evaluation metrics
 */
export function runBacktest(chronologicalHistory = [], options = {}) {
  const trainSplit = options.split || 0.70;
  const n = chronologicalHistory.length;

  if (n < 4) {
    throw new Error(`Insufficient history for backtest: need at least 4 runs, got ${n}.`);
  }

  const splitIdx = Math.floor(n * trainSplit);
  const trainSet = chronologicalHistory.slice(0, splitIdx);
  const testSet = chronologicalHistory.slice(splitIdx);

  // 1. Train the error memory on the first 70%
  // We simulate weakness buildup and decay on the training set
  const memoryCategories = JSON.parse(JSON.stringify(SEED_CATEGORIES));
  const categoryMap = new Map(memoryCategories.map(c => [c.key, c]));

  for (const run of trainSet) {
    if (run.verdict !== 'AC' && run.category) {
      const cat = categoryMap.get(run.category);
      if (cat) {
        cat.weakness = (cat.weakness || 1.0) + 1.0;
        cat.count = (cat.count || 0) + 1;
        cat.lastSeen = run.timestamp || new Date().toISOString();
        cat.status = 'active';
      }
    }
  }

  // Filter top active ghosts in the Quick-Guess Cache (top 7 with weakness >= 0.5)
  const activeCache = Array.from(categoryMap.values())
    .filter(c => c.status === 'active' && c.weakness >= 0.5)
    .sort((a, b) => b.weakness - a.weakness)
    .slice(0, 7);

  // 2. Evaluate on the remaining 30%
  let tp = 0; // Warned & Failed (Good catch!)
  let fp = 0; // Warned & Passed (False alarm)
  let fn = 0; // Silent & Failed (Missed bug)
  let tn = 0; // Silent & Passed (Correctly quiet)

  const detailedResults = [];

  for (let i = 0; i < testSet.length; i++) {
    const run = testSet[i];
    const warnings = runHotScan(run.code || '', activeCache);
    const warned = warnings.length > 0;
    const actuallyFailed = run.verdict !== 'AC';

    let classification = '';

    if (warned && actuallyFailed) {
      tp++;
      classification = 'TP (Caught Failure)';
    } else if (warned && !actuallyFailed) {
      fp++;
      classification = 'FP (False Alarm)';
    } else if (!warned && actuallyFailed) {
      fn++;
      classification = 'FN (Missed Failure)';
    } else {
      tn++;
      classification = 'TN (Clean Pass)';
    }

    detailedResults.push({
      file: run.file || `run_${i + 1}.cpp`,
      actualVerdict: run.verdict,
      warned,
      warningCategory: warned ? warnings[0].category : null,
      classification
    });

    // Update memory progressively during test set (simulating continuous learning)
    if (actuallyFailed && run.category) {
      const cat = categoryMap.get(run.category);
      if (cat) {
        cat.weakness = (cat.weakness || 1.0) + 1.0;
        cat.count = (cat.count || 0) + 1;
      }
    }
  }

  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const falseAlarmRate = (fp + tn) > 0 ? fp / (fp + tn) : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = (tp + tn) / (tp + tn + fp + fn);

  return {
    trainCount: trainSet.length,
    testCount: testSet.length,
    confusionMatrix: { tp, fp, fn, tn },
    metrics: {
      precision: Number((precision * 100).toFixed(1)),
      recall: Number((recall * 100).toFixed(1)),
      falseAlarmRate: Number((falseAlarmRate * 100).toFixed(1)),
      f1Score: Number((f1 * 100).toFixed(1)),
      accuracy: Number((accuracy * 100).toFixed(1))
    },
    detailedResults
  };
}

/**
 * Formats backtest results into an ASCII table ready for terminal and markdown reports.
 */
export function formatBacktestReport(results) {
  const { metrics, confusionMatrix, trainCount, testCount } = results;

  const table = new Table({
    head: [chalk.magenta('Metric'), chalk.magenta('Result'), chalk.magenta('Benchmark Meaning')],
    colWidths: [22, 14, 46]
  });

  table.push(
    [chalk.white('Precision'), chalk.greenBright.bold(`${metrics.precision}%`), chalk.gray('When warned, code would have genuinely failed')],
    [chalk.white('Recall'), chalk.cyan.bold(`${metrics.recall}%`), chalk.gray('Proportion of actual failures caught pre-flight')],
    [chalk.white('False Alarm Rate'), chalk.yellow.bold(`${metrics.falseAlarmRate}%`), chalk.gray('Passing code wrongly flagged (<10% is gold standard)')],
    [chalk.white('F1 Score'), chalk.white.bold(`${metrics.f1Score}%`), chalk.gray('Harmonic mean of precision and recall')],
    [chalk.white('Overall Accuracy'), chalk.white.bold(`${metrics.accuracy}%`), chalk.gray('Total correct classifications')]
  );

  return `
  REVENANT 70/30 EMPIRICAL BACKTEST REPORT
  Chronological Split: ${trainCount} training runs (70%) | ${testCount} evaluation runs (30%)

  Confusion Matrix:
    - True Positives  (Prevented Failures): ${confusionMatrix.tp}
    - False Positives (False Alarms):       ${confusionMatrix.fp}
    - False Negatives (Missed Failures):    ${confusionMatrix.fn}
    - True Negatives  (Clean Runs):         ${confusionMatrix.tn}

${table.toString()}
`;
}
