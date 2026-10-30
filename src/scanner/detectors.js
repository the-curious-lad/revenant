/**
 * Fast deterministic detectors for seeded competitive programming ghosts.
 * Runs in <5ms without LLM or network latency.
 */
export const DETECTORS = {
  int_overflow: {
    key: 'int_overflow',
    name: '32-bit Integer Overflow',
    check(code) {
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\bint\s+(sum|ans|total|product|res|acc|cost|c|cnt)\s*=\s*[0-9]/.test(line)) {
          return {
            matched: true,
            line: i + 1,
            evidence: line.trim(),
            explanation: 'Accumulator declared as 32-bit int. Sums exceeding 2*10^9 will silently overflow into negative values.'
          };
        }
      }
      return { matched: false };
    }
  },

  unreset_global_state: {
    key: 'unreset_global_state',
    name: 'Unreset Global State',
    check(code) {
      const hasMultiTest = /while\s*\(\s*(t--|test--|cases--|T--)\s*\)/.test(code);
      if (!hasMultiTest) return { matched: false };

      const lines = code.split('\n');
      let insideMain = false;
      const globalContainers = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/int\s+main\s*\(/.test(line)) {
          insideMain = true;
          continue;
        }

        if (!insideMain) {
          const match = line.match(/\b(vector\s*<[^>]+>\s+(\w+)|int\s+(\w+)\s*\[[^\]]+\])/);
          if (match) {
            const varName = match[2] || match[3];
            if (varName && !['dx', 'dy', 'MOD', 'INF'].includes(varName)) {
              globalContainers.push({ varName, line: i + 1, text: line.trim() });
            }
          }
        }
      }

      if (globalContainers.length > 0) {
        for (const item of globalContainers) {
          // Matches: adj.clear(), adj[i].clear(), memset(adj, ...), fill(adj, ...), adj[i] = false/0
          const clearPattern = new RegExp(`(${item.varName}(\\[[^\\]]+\\])?\\.clear|memset\\s*\\(\\s*${item.varName}|fill\\s*\\([^,]*${item.varName}|${item.varName}\\[[^\\]]+\\]\\s*=\\s*(false|0))`);
          if (!clearPattern.test(code)) {
            return {
              matched: true,
              line: item.line,
              evidence: item.text,
              explanation: `Global variable '${item.varName}' persists across testcases in while(t--) loop without .clear() or memset.`
            };
          }
        }
      }

      return { matched: false };
    }
  },

  modulo_arithmetic_negative: {
    key: 'modulo_arithmetic_negative',
    name: 'Negative Modulo Handling',
    check(code) {
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\([a-zA-Z0-9_]+\s*-\s*[a-zA-Z0-9_]+\)\s*%\s*(MOD|M|mod|1000000007)/.test(line)) {
          if (!line.includes('+') && !line.includes('MOD +')) {
            return {
              matched: true,
              line: i + 1,
              evidence: line.trim(),
              explanation: 'Subtractive modulo (a - b) % MOD can result in negative numbers in C++ if a < b.'
            };
          }
        }
      }
      return { matched: false };
    }
  },

  precision_loss_float: {
    key: 'precision_loss_float',
    name: 'Floating Point Precision Equality',
    check(code) {
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\b(double|float)\b/.test(code) && /([a-zA-Z0-9_]+\s*==\s*[a-zA-Z0-9_]+)/.test(line)) {
          if (!line.includes('int') && !line.includes('char') && !line.includes('for') && !line.includes('fabs') && !line.includes('1e-9')) {
            return {
              matched: true,
              line: i + 1,
              evidence: line.trim(),
              explanation: 'Direct equality comparison (==) on floating point values can fail due to rounding inaccuracies.'
            };
          }
        }
      }
      return { matched: false };
    }
  }
};

/**
 * Runs active category detectors (both hardcoded and dynamically synthesized) against source code.
 * @param {string} code - C++ source text
 * @param {Array<object>} activeCategories - Active categories from cache/database
 * @returns {Array<{ category: string, line: number, evidence: string, explanation: string }>}
 */
export function runHotScan(code, activeCategories = []) {
  const warnings = [];
  const lines = code.split('\n');

  for (const cat of activeCategories) {
    // 1. Check if hardcoded detector exists
    if (DETECTORS[cat.key]) {
      const res = DETECTORS[cat.key].check(code);
      if (res && res.matched) {
        warnings.push({
          category: cat.key,
          line: res.line,
          evidence: res.evidence,
          explanation: res.explanation
        });
      }
    } 
    // 2. Check if it's a dynamically synthesized category with detector_pattern
    else if (cat.detector_pattern) {
      try {
        const regex = new RegExp(cat.detector_pattern);
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            warnings.push({
              category: cat.key,
              line: i + 1,
              evidence: lines[i].trim(),
              explanation: cat.explanation || cat.description
            });
            break;
          }
        }
      } catch (err) {
        // Skip invalid regexes
      }
    }
  }

  return warnings;
}
