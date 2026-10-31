import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma2:2b';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

/**
 * Checks if the Ollama daemon is running and reachable.
 * @returns {Promise<boolean>}
 */
export async function isOllamaAvailable() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Calls local Ollama to generate strict JSON.
 * @param {string} prompt - Prompt to pass to Ollama.
 * @param {string} systemPrompt - System prompt.
 * @returns {Promise<{ success: boolean, rawText?: string, data?: object, error?: string }>}
 */
export async function generateJsonCompletion(prompt, systemPrompt = '') {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000); // 35s max for local LLM cold starts

    const body = {
      model: OLLAMA_MODEL,
      prompt,
      system: systemPrompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1,
        top_p: 0.9
      }
    };

    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        success: false,
        error: `Ollama returned HTTP ${res.status}: ${res.statusText}`
      };
    }

    const json = await res.json();
    const rawText = json.response;

    try {
      const data = JSON.parse(rawText);
      return {
        success: true,
        rawText,
        data
      };
    } catch (parseErr) {
      return {
        success: false,
        rawText,
        error: `Failed to parse LLM JSON response: ${parseErr.message}`
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Ollama request timed out' : err.message
    };
  }
}

/**
 * Generates vector embeddings for a given text snippet via Ollama.
 * @param {string} text - Text to embed.
 * @returns {Promise<Array<number> | null>}
 */
export async function generateEmbedding(text) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s for embedding model cold load

    const res = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_EMBED_MODEL,
        prompt: text
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      return json.embedding || null;
    }
    return null;
  } catch (err) {
    return null;
  }
}
