#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import Table from 'cli-table3';

import { printBanner, printWarning, printVerdict } from '../src/ui/spooky.js';
import { compileCpp, cleanupBinary } from '../src/runner/compiler.js';
import { executeBinary } from '../src/runner/executor.js';
import { classifyResult } from '../src/runner/classifier.js';
import { findTestCases } from '../src/runner/test_finder.js';
import { runHotScan } from '../src/scanner/detectors.js';
import { 
  getTopCategories, 
  getAllCategories, 
  getUncategorizedFailures,
  saveNewCategory,
  linkFailuresToCategory,
  recordFailure, 
  closeDb 
} from '../src/db/mongo.js';
import { diagnoseFailure } from '../src/ai/diagnostician.js';
import { generateEmbedding } from '../src/ai/ollama.js';
import { clusterFailures } from '../src/ai/clustering.js';
import { synthesizeNewCategory } from '../src/ai/synthesizer.js';
import { validateProposedDetector } from '../src/scanner/validator.js';
import { runBacktest, formatBacktestReport } from '../src/eval/backtest.js';
import { generateBenchmarkDataset } from '../src/eval/dataset_generator.js';

const program = new Command();

program
  .name('ghost')
  .description('REVENANT: Error-memory developer tool that remembers how you fail')
  .version('0.1.0');

/**
 * COMMAND: ghost run <file>
 */
program
  .command('run <file>')
  .description('Pre-scan, compile, and execute a solution against test cases')
  .option('-t, --timeout <ms>', 'Execution timeout per test in milliseconds', '2000')
  .option('--no-precheck', 'Skip the pre-flight ghost detector scan')
  .action(async (file, options) => {
    printBanner();

    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`Error: File '${file}' not found.`));
      process.exit(1);
    }

    const code = fs.readFileSync(filePath, 'utf8');

    // 1. HOT PATH: Pre-flight scan against top active ghosts
    if (options.precheck) {
      const activeCategories = await getTopCategories(7);
      const warnings = runHotScan(code, activeCategories);

      if (warnings.length > 0) {
        for (const warn of warnings) {
          printWarning(warn.category, warn.line, warn.evidence, warn.explanation);
        }
      }
    }

    // 2. Compilation
    console.log(chalk.cyan(`[1/2] Compiling ${path.basename(filePath)} with g++...`));
    const compResult = await compileCpp(filePath);

    if (!compResult.success) {
      printVerdict('CE', { errorOutput: compResult.error });
      
      const graveyard = await getAllCategories();
      const diagnosis = await diagnoseFailure(code, {
        verdict: 'CE',
        errorOutput: compResult.error
      }, graveyard);

      printDiagnosisSummary(diagnosis);

      await recordFailure({
        file: path.basename(filePath),
        snapshot: code,
        verdict: 'CE',
        category: diagnosis.category,
        line: diagnosis.line,
        evidence: diagnosis.evidence,
        explanation: diagnosis.explanation,
        errorOutput: compResult.error
      });

      await closeDb();
      process.exit(1);
    }

    const binaryPath = compResult.binaryPath;

    try {
      // 3. Test Case Discovery
      const testCases = findTestCases(filePath);
      const timeoutMs = parseInt(options.timeout, 10) || 2000;

      if (testCases.length === 0) {
        console.log(chalk.yellow(`\nNo test cases found (*.in / tests/*.in). Running with empty input...`));
        const res = await executeBinary(binaryPath, '', timeoutMs);
        if (res.exitCode !== 0 || res.timedOut) {
          const classified = classifyResult(res, '');
          printVerdict(classified.verdict, classified.details);

          const graveyard = await getAllCategories();
          const diagnosis = await diagnoseFailure(code, {
            verdict: classified.verdict,
            actualOutput: res.stdout,
            errorOutput: res.stderr
          }, graveyard);

          printDiagnosisSummary(diagnosis);

          let embedding = null;
          if (diagnosis.is_new || diagnosis.category === 'uncategorized') {
            embedding = await generateEmbedding(`${code}\nError: ${classified.verdict}`);
          }

          await recordFailure({
            file: path.basename(filePath),
            snapshot: code,
            verdict: classified.verdict,
            category: diagnosis.category,
            line: diagnosis.line,
            evidence: diagnosis.evidence,
            explanation: diagnosis.explanation,
            errorOutput: res.stderr || classified.details.errorOutput,
            embedding
          });
          process.exit(1);
        } else {
          console.log(chalk.green(`✔ Program finished with exit code 0 (${res.timeMs}ms). Output:`));
          if (res.stdout) console.log(chalk.white(res.stdout));
        }
      } else {
        console.log(chalk.cyan(`[2/2] Running against ${testCases.length} test case(s)...`));
        let allPassed = true;

        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i];
          const execRes = await executeBinary(binaryPath, tc.input, timeoutMs);
          const classified = classifyResult(execRes, tc.expectedOutput);

          if (classified.verdict !== 'AC') {
            allPassed = false;
            printVerdict(classified.verdict, {
              ...classified.details,
              testIndex: i + 1,
              totalTests: testCases.length
            });

            const graveyard = await getAllCategories();
            const failureContext = {
              verdict: classified.verdict,
              testName: tc.name,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              actualOutput: execRes.stdout,
              errorOutput: execRes.stderr
            };

            const diagnosis = await diagnoseFailure(code, failureContext, graveyard);
            printDiagnosisSummary(diagnosis);

            let embedding = null;
            if (diagnosis.is_new || diagnosis.category === 'uncategorized') {
              embedding = await generateEmbedding(`${code}\nError: ${classified.verdict}`);
            }

            await recordFailure({
              file: path.basename(filePath),
              snapshot: code,
              verdict: classified.verdict,
              testName: tc.name,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              actualOutput: execRes.stdout,
              errorOutput: execRes.stderr,
              category: diagnosis.category,
              line: diagnosis.line,
              evidence: diagnosis.evidence,
              explanation: diagnosis.explanation,
              is_new: diagnosis.is_new,
              embedding
            });

            break;
          }
        }

        if (allPassed) {
          printVerdict('AC', { totalTests: testCases.length });
        } else {
          await closeDb();
          process.exit(1);
        }
      }
    } finally {
      cleanupBinary(binaryPath);
      await closeDb();
    }
  });

function printDiagnosisSummary(diagnosis) {
  console.log(chalk.magentaBright('\n┌── COLD-PATH GHOST DIAGNOSIS ──────────────────'));
  console.log(chalk.white(`│ Identified Sin:  ${chalk.bold.yellow(diagnosis.category)}`));
  if (diagnosis.line) {
    console.log(chalk.white(`│ Suspect Line:    ${chalk.yellow(diagnosis.line)}`));
  }
  if (diagnosis.evidence) {
    console.log(chalk.white(`│ Evidence:        ${chalk.italic(diagnosis.evidence)}`));
  }
  if (diagnosis.explanation) {
    console.log(chalk.white(`│ Technical Cause: ${chalk.gray(diagnosis.explanation)}`));
  }
  console.log(chalk.magentaBright('└────────────────────────────────────────────────\n'));
}

/**
 * COMMAND: ghost seance
 */
program
  .command('seance')
  .description('Hold a séance to cluster uncategorized failures and mint new ghost categories')
  .option('-t, --threshold <score>', 'Minimum cosine similarity threshold (0.0 to 1.0)', '0.75')
  .option('-m, --min-size <n>', 'Minimum cluster size to form a ghost', '3')
  .action(async (options) => {
    printBanner();

    console.log(chalk.magentaBright.bold('🔮 GHOST SÉANCE COMMENCED: Communing with the Machine...\n'));

    const threshold = parseFloat(options.threshold) || 0.75;
    const minSize = parseInt(options.minSize, 10) || 3;

    const uncategorized = await getUncategorizedFailures();
    console.log(chalk.cyan(`Gathered ${chalk.bold(uncategorized.length)} uncategorized failure spirits from the database.`));

    if (uncategorized.length < minSize) {
      console.log(chalk.yellow(`\nNot enough wandering spirits to form a séance.`));
      console.log(chalk.gray(`(Need at least ${minSize} uncategorized failures to detect a pattern; currently have ${uncategorized.length}).`));
      console.log(chalk.gray('Continue coding. When repeat mistakes accumulate, the séance will find them.\n'));
      await closeDb();
      return;
    }

    console.log(chalk.cyan('Verifying spectral vector embeddings...'));
    for (const f of uncategorized) {
      if (!f.embedding || f.embedding.length === 0) {
        f.embedding = await generateEmbedding(`${f.snapshot || ''}\n${f.errorOutput || ''}`);
        if (!f.embedding) {
          f.embedding = generateFallbackVector(f.snapshot || '');
        }
      }
    }

    console.log(chalk.cyan(`Clustering failure vectors (threshold: ${threshold}, min size: ${minSize})...`));
    const clusters = clusterFailures(uncategorized, threshold, minSize);

    if (clusters.length === 0) {
      console.log(chalk.yellow('\nNo dense clusters formed.'));
      console.log(chalk.gray('The uncategorized failures are too dissimilar to form a recurring pattern (all similarity scores < threshold).'));
      console.log(chalk.gray('No new categories were minted.\n'));
      await closeDb();
      return;
    }

    console.log(chalk.greenBright(`\nFound ${chalk.bold(clusters.length)} recurring failure cluster(s)!\n`));

    const passingSamples = [];
    const examplesDir = path.resolve(process.cwd(), 'examples');
    if (fs.existsSync(examplesDir)) {
      const files = fs.readdirSync(examplesDir).filter(f => f.endsWith('_ac.cpp') || f.endsWith('.cpp'));
      for (const f of files) {
        if (!f.includes('overflow') && !f.includes('infinite') && !f.includes('rte')) {
          passingSamples.push(fs.readFileSync(path.join(examplesDir, f), 'utf8'));
        }
      }
    }

    for (const cluster of clusters) {
      console.log(chalk.bold.yellow(`\n┌── EVALUATING SPECTRAL CLUSTER (${cluster.items.length} failures, Avg Similarity: ${cluster.avgSimilarity}) ──`));
      for (const item of cluster.items) {
        console.log(chalk.gray(`│  - ${item.file} (${item.verdict}): ${item.evidence || item.actualOutput || 'Fail'}`));
      }

      console.log(chalk.cyan('│  Consulting Gemma to synthesize new Ghost Category...'));
      const synthesis = await synthesizeNewCategory(cluster.items);

      if (!synthesis.success || !synthesis.category) {
        console.log(chalk.red(`│  ✘ Synthesis failed: ${synthesis.error}`));
        console.log(chalk.bold.yellow('└──────────────────────────────────────────────────────────'));
        continue;
      }

      const proposed = synthesis.category;
      console.log(chalk.white(`│  Proposed: [${chalk.bold.yellow(proposed.key)}] "${proposed.name}"`));
      console.log(chalk.white(`│  Pattern:  ${chalk.cyan(proposed.detector_pattern)}`));

      console.log(chalk.cyan('│  Running Validation Gate against historical passing solutions...'));
      const validation = validateProposedDetector(proposed, cluster.items, passingSamples);

      if (!validation.passed) {
        console.log(chalk.red(`│  ✘ VALIDATION REJECTED: ${validation.reason}`));
        console.log(chalk.gray('│    The proposed detector did not meet precision/recall standards and was discarded.'));
        console.log(chalk.bold.yellow('└──────────────────────────────────────────────────────────'));
      } else {
        console.log(chalk.greenBright(`│  ✔ VALIDATION PASSED! ${validation.reason}`));
        await saveNewCategory(proposed);
        await linkFailuresToCategory(cluster.items.map(i => i.file), proposed.key);
        console.log(chalk.greenBright(`│  👻 NEW GHOST PROMOTED TO THE GRAVEYARD: [${proposed.key}]`));
        console.log(chalk.bold.yellow('└──────────────────────────────────────────────────────────'));
      }
    }

    console.log(chalk.magentaBright('\nSéance complete. The Graveyard has been updated.\n'));
    await closeDb();
  });

function generateFallbackVector(text) {
  const vec = new Array(32).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[text.charCodeAt(i) % 32] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

/**
 * COMMAND: ghost backtest
 * Replays failure history with a 70/30 split to measure Precision, Recall, and False Alarms
 */
program
  .command('backtest')
  .description('Run a 70/30 empirical backtest to measure precision, recall, and false alarm rate')
  .option('-s, --split <ratio>', 'Train/Test split ratio', '0.70')
  .action(async (options) => {
    printBanner();

    console.log(chalk.magentaBright.bold('📊 COMMENCING 70/30 EMPIRICAL BACKTEST BENCHMARK...\n'));

    const split = parseFloat(options.split) || 0.70;
    const dataset = generateBenchmarkDataset();

    console.log(chalk.cyan(`Loaded benchmark history with ${chalk.bold(dataset.length)} chronological submissions.`));
    console.log(chalk.cyan(`Partitioning: ${Math.floor(dataset.length * split)} training runs (70%) | ${dataset.length - Math.floor(dataset.length * split)} evaluation runs (30%)...\n`));

    const results = runBacktest(dataset, { split });
    console.log(formatBacktestReport(results));
    await closeDb();
  });

/**
 * COMMAND: ghost graveyard / ghost status
 */
program
  .command('graveyard')
  .alias('status')
  .description('Inspect the graveyard of active and exorcised ghosts')
  .action(async () => {
    printBanner();

    const categories = await getAllCategories();

    const table = new Table({
      head: [
        chalk.magenta('Ghost Key'),
        chalk.magenta('Name'),
        chalk.magenta('Weakness'),
        chalk.magenta('Times Died'),
        chalk.magenta('Status')
      ],
      colWidths: [26, 36, 12, 14, 12]
    });

    for (const cat of categories) {
      const isExorcised = (cat.weakness || 0) < 0.5;
      const statusStr = isExorcised ? chalk.gray('Exorcised') : chalk.redBright('Haunting');
      table.push([
        chalk.white(cat.key),
        chalk.yellow(cat.name),
        chalk.cyan((cat.weakness || 0).toFixed(2)),
        chalk.white(cat.count || 0),
        statusStr
      ]);
    }

    console.log(chalk.bold.white('\n  CURRENT ROSTER OF GHOSTS IN THE MACHINE (THE GRAVEYARD):\n'));
    console.log(table.toString());
    console.log('');
    await closeDb();
  });

program.parse(process.argv);
