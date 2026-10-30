import fs from 'fs';
import path from 'path';

/**
 * Validates a proposed detector rule against failing examples and historical passing solutions
 * to ensure high recall and zero/low false-positive rate.
 * 
 * @param {object} categoryProposal - { key, detector_pattern, ... }
 * @param {Array<object>} clusterFails - The failing cases that triggered the cluster
 * @param {Array<string>} passingCodeSamples - Array of known passing C++ solution texts
 * @returns {{ passed: boolean, reason: string, stats: object }}
 */
export function validateProposedDetector(categoryProposal, clusterFails = [], passingCodeSamples = []) {
  const pattern = categoryProposal.detector_pattern;

  if (!pattern || typeof pattern !== 'string') {
    return {
      passed: false,
      reason: 'Missing or non-string detector pattern',
      stats: { failMatches: 0, passFalseAlarms: 0 }
    };
  }

  // 1. Static ReDoS Safety: Check for nested catastrophic quantifier patterns like (a+)+ or (.*)*
  if (/(\+|\*|\{[0-9]+,\})\s*\)\s*(\+|\*|\{[0-9]+,\})/.test(pattern)) {
    return {
      passed: false,
      reason: 'Rejected due to catastrophic backtracking risk (nested quantifiers ReDoS pattern)',
      stats: { failMatches: 0, passFalseAlarms: 0 }
    };
  }

  let regex;
  try {
    regex = new RegExp(pattern);
  } catch (err) {
    return {
      passed: false,
      reason: `Invalid regex syntax: ${err.message}`,
      stats: { failMatches: 0, passFalseAlarms: 0 }
    };
  }

  // 2. Dynamic Execution Timeout Safety Probe
  const probeString = 'a'.repeat(25) + 'X';
  const start = Date.now();
  try {
    regex.test(probeString);
    if (Date.now() - start > 100) {
      return {
        passed: false,
        reason: 'Rejected due to execution hang on probe string (ReDoS safety gate)',
        stats: { failMatches: 0, passFalseAlarms: 0 }
      };
    }
  } catch (probeErr) {
    return {
      passed: false,
      reason: `Probe failure: ${probeErr.message}`,
      stats: { failMatches: 0, passFalseAlarms: 0 }
    };
  }

  // 3. Recall Check: Must trigger on the failures that inspired it
  let failMatches = 0;
  for (const item of clusterFails) {
    if (item.snapshot && regex.test(item.snapshot)) {
      failMatches++;
    }
  }

  const recallRate = clusterFails.length > 0 ? failMatches / clusterFails.length : 0;
  if (recallRate < 0.5) {
    return {
      passed: false,
      reason: `Insufficient recall: only caught ${failMatches}/${clusterFails.length} target failures (${(recallRate * 100).toFixed(0)}%)`,
      stats: { failMatches, passFalseAlarms: 0, recallRate }
    };
  }

  // 4. Precision / False-Alarm Check: Must NOT trigger heavily on passing solutions
  let falseAlarms = 0;
  for (const passCode of passingCodeSamples) {
    if (passCode && regex.test(passCode)) {
      falseAlarms++;
    }
  }

  const falseAlarmRate = passingCodeSamples.length > 0 ? falseAlarms / passingCodeSamples.length : 0;
  if (falseAlarmRate > 0.25) {
    return {
      passed: false,
      reason: `Too many false alarms: triggered on ${falseAlarms}/${passingCodeSamples.length} passing solutions (${(falseAlarmRate * 100).toFixed(0)}% false alarm rate)`,
      stats: { failMatches, passFalseAlarms: falseAlarms, falseAlarmRate }
    };
  }

  return {
    passed: true,
    reason: `Validated: caught ${failMatches}/${clusterFails.length} failures with ${falseAlarms} false alarms.`,
    stats: { failMatches, passFalseAlarms: falseAlarms, recallRate, falseAlarmRate }
  };
}
