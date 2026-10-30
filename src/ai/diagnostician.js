import { generateJsonCompletion, isOllamaAvailable } from './ollama.js';
import { DETECTORS } from '../scanner/detectors.js';

const SYSTEM_PROMPT = `You are REVENANT's Cold-Path Failure Classifier.
Your task is to analyze failed C++ competitive programming code along with its error output,
and map the failure to the EXACT matching category from the provided Graveyard list.

RULES:
1. Output ONLY valid JSON matching the schema below. No conversational text or markdown code fences.
2. If the mistake clearly matches a category from the list, use that exact category key.
3. If the mistake does not fit any known category, set "category": "uncategorized" and "is_new": true.
4. "line" must be an integer indicating the suspected offending line, or null.
5. "evidence" must be a short snippet from the code or test discrepancy.
6. "explanation" must be a concise (1-sentence) technical explanation.

SCHEMA:
{
  "category": "string",
  "is_new": boolean,
  "line": number | null,
  "evidence": "string",
  "explanation": "string"
}`;

/**
 * Validates that an LLM response strictly conforms to the expected JSON schema.
 * @param {object} data
 * @param {Set<string>} validCategories
 * @returns {{ valid: boolean, sanitized?: object, error?: string }}
 */
export function validateDiagnosisSchema(data, validCategories) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Output is not a valid JSON object' };
  }

  const category = String(data.category || 'uncategorized').trim();
  const is_new = Boolean(data.is_new);
  const line = Number.isInteger(data.line) ? data.line : null;
  const evidence = String(data.evidence || '').slice(0, 300);
  const explanation = String(data.explanation || 'Unspecified failure').slice(0, 300);

  // Validate category membership
  const resolvedCategory = validCategories.has(category) ? category : 'uncategorized';

  return {
    valid: true,
    sanitized: {
      category: resolvedCategory,
      is_new: resolvedCategory === 'uncategorized' || is_new,
      line,
      evidence,
      explanation
    }
  };
}

/**
 * Fast deterministic fallback classifier when Ollama is offline.
 * @param {string} code
 * @param {object} failureContext
 * @returns {object}
 */
export function heuristicDiagnose(code, failureContext) {
  const { verdict, errorOutput } = failureContext;

  if (verdict === 'CE') {
    return {
      category: 'compile_error',
      is_new: false,
      line: null,
      evidence: (errorOutput || '').split('\n')[0] || 'Syntax error',
      explanation: 'Code failed to compile with g++.'
    };
  }

  // Check known deterministic detectors first
  for (const [key, detector] of Object.entries(DETECTORS)) {
    const res = detector.check(code);
    if (res && res.matched) {
      return {
        category: key,
        is_new: false,
        line: res.line,
        evidence: res.evidence,
        explanation: res.explanation
      };
    }
  }

  return {
    category: 'uncategorized',
    is_new: true,
    line: null,
    evidence: failureContext.actualOutput ? `Got: ${failureContext.actualOutput.trim()}` : 'Test failure',
    explanation: `Failed with verdict ${verdict}.`
  };
}

/**
 * Diagnoses a failed run using local Gemma via Ollama (with heuristic fallback).
 * @param {string} code - C++ source text
 * @param {object} failureContext - { verdict, input, expectedOutput, actualOutput, errorOutput }
 * @param {Array<object>} graveyardCategories - List of all categories
 * @returns {Promise<object>}
 */
export async function diagnoseFailure(code, failureContext, graveyardCategories = []) {
  const validCategoryKeys = new Set(graveyardCategories.map(c => c.key));
  validCategoryKeys.add('uncategorized');
  validCategoryKeys.add('compile_error');

  const ollamaOnline = await isOllamaAvailable();

  if (!ollamaOnline) {
    // Graceful offline fallback
    const heuristic = heuristicDiagnose(code, failureContext);
    heuristic.source = 'heuristic_offline';
    return heuristic;
  }

  // Number the lines for the LLM
  const numberedCode = code
    .split('\n')
    .map((line, idx) => `${idx + 1}: ${line}`)
    .join('\n');

  const categoriesCatalog = graveyardCategories
    .map(c => `- ${c.key}: ${c.description}`)
    .join('\n');

  const prompt = `FAILED C++ SOURCE CODE:
\`\`\`cpp
${numberedCode}
\`\`\`

TEST RUN DISCREPANCY:
- Verdict: ${failureContext.verdict}
${failureContext.input ? `- Stdin Input:\n${failureContext.input}` : ''}
${failureContext.expectedOutput ? `- Expected Output:\n${failureContext.expectedOutput}` : ''}
${failureContext.actualOutput ? `- Actual Output:\n${failureContext.actualOutput}` : ''}
${failureContext.errorOutput ? `- Stderr / Error Output:\n${failureContext.errorOutput}` : ''}

AVAILABLE GRAVEYARD CATEGORIES:
${categoriesCatalog}

Analyze why the code failed and return strictly valid JSON matching the schema.`;

  const result = await generateJsonCompletion(prompt, SYSTEM_PROMPT);

  if (result.success && result.data) {
    const validated = validateDiagnosisSchema(result.data, validCategoryKeys);
    if (validated.valid) {
      validated.sanitized.source = 'ollama_gemma';
      return validated.sanitized;
    }
  }

  // Fallback if LLM produced invalid JSON
  const heuristic = heuristicDiagnose(code, failureContext);
  heuristic.source = 'heuristic_fallback';
  return heuristic;
}
