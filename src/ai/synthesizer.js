import { generateJsonCompletion, isOllamaAvailable } from './ollama.js';

const SEANCE_SYSTEM_PROMPT = `You are REVENANT's Code Séance Synthesis Agent.
You are inspecting a cluster of 3 or more recurring C++ competitive programming failures.
Your goal is to identify the COMMON BLIND SPOT shared by these failures and mint a BRAND NEW Ghost Category.

RULES:
1. Return ONLY valid JSON matching the exact schema below.
2. "key": A short, snake_case identifier (e.g. "vector_capacity_realloc", "custom_comparator_equality").
3. "name": Concise human-readable title (e.g. "Vector Reallocation Overhead").
4. "description": 1-sentence technical explanation of why this bug causes failures in C++.
5. "detector_pattern": A lightweight, safe regular expression pattern to detect this code pattern. Must be valid JavaScript RegExp syntax.
6. "explanation": Atmospheric, spooky warning message with concrete advice.

SCHEMA:
{
  "key": "string",
  "name": "string",
  "description": "string",
  "detector_pattern": "string",
  "explanation": "string"
}`;

/**
 * Validates the synthesized category proposal schema.
 * @param {object} data
 * @returns {{ valid: boolean, category?: object, error?: string }}
 */
export function validateSynthesizedCategory(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Synthesis output is not a valid object' };
  }

  const key = String(data.key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 40);

  if (!key || key.length < 3) {
    return { valid: false, error: 'Category key must be at least 3 characters' };
  }

  const name = String(data.name || 'Unnamed Mistake').trim().slice(0, 50);
  const description = String(data.description || 'Recurring competitive programming error').trim().slice(0, 250);
  const pattern = String(data.detector_pattern || '').trim();
  const explanation = String(data.explanation || 'Beware of repeating this past failure.').trim().slice(0, 250);

  // Validate regex syntax
  if (!pattern) {
    return { valid: false, error: 'Missing detector_pattern' };
  }

  try {
    new RegExp(pattern);
  } catch (regErr) {
    return { valid: false, error: `Invalid regular expression pattern: ${regErr.message}` };
  }

  return {
    valid: true,
    category: {
      key,
      name,
      description,
      detector_pattern: pattern,
      explanation,
      weakness: 2.0,
      count: 3,
      status: 'active',
      lastSeen: new Date().toISOString()
    }
  };
}

/**
 * Proposes a new category from a cluster of failures using Ollama (with heuristic fallback).
 * @param {Array<object>} clusterItems - Array of 3+ failure documents
 * @returns {Promise<{ success: boolean, category?: object, error?: string }>}
 */
export async function synthesizeNewCategory(clusterItems) {
  const ollamaOnline = await isOllamaAvailable();

  if (!ollamaOnline) {
    // Deterministic fallback synthesizer
    return heuristicSynthesize(clusterItems);
  }

  const examplesPrompt = clusterItems.slice(0, 3).map((item, idx) => {
    return `--- RECURRING FAILURE #${idx + 1} (${item.file || 'solution.cpp'}, Verdict: ${item.verdict}) ---
CODE:
${item.snapshot ? item.snapshot.slice(0, 1000) : '// No snapshot'}

OUTPUT / ERROR:
${item.actualOutput || item.errorOutput || 'Test mismatch'}
`;
  }).join('\n\n');

  const prompt = `Inspect these 3 recurring C++ failures and synthesize a new Ghost Category:

${examplesPrompt}

Analyze the common root cause and return strictly valid JSON matching the schema.`;

  const res = await generateJsonCompletion(prompt, SEANCE_SYSTEM_PROMPT);

  if (res.success && res.data) {
    const validated = validateSynthesizedCategory(res.data);
    if (validated.valid) {
      return { success: true, category: validated.category };
    }
  }

  return heuristicSynthesize(clusterItems);
}

/**
 * Fallback synthesizer for offline mode.
 */
function heuristicSynthesize(clusterItems) {
  const commonFile = clusterItems[0]?.file || 'solution.cpp';
  const timestamp = Date.now().toString().slice(-4);
  const key = `custom_blindspot_${timestamp}`;

  return {
    success: true,
    category: {
      key,
      name: `Synthesized Habit (${key})`,
      description: `Recurring uncategorized pattern observed in ${clusterItems.length} runs including ${commonFile}.`,
      detector_pattern: '\\b(while|for)\\s*\\(',
      explanation: 'The spirits remember this recurring structure causing past demises.',
      weakness: 2.0,
      count: clusterItems.length,
      status: 'active',
      lastSeen: new Date().toISOString()
    }
  };
}
