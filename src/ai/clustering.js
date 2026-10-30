/**
 * Computes cosine similarity between two numeric vectors.
 * Returns value between -1.0 and 1.0.
 * @param {Array<number>} vecA
 * @param {Array<number>} vecB
 * @returns {number}
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Clusters uncategorized failures based on vector embeddings using a density threshold.
 * 
 * @param {Array<object>} failures - Array of failure documents containing { _id, snapshot, embedding, ... }
 * @param {number} similarityThreshold - Minimum cosine similarity to be in the same cluster (default 0.78)
 * @param {number} minClusterSize - Minimum cluster size to qualify as a recurring pattern (default 3)
 * @returns {Array<{ id: string, items: Array<object>, similarityScore: number }>}
 */
export function clusterFailures(failures = [], similarityThreshold = 0.78, minClusterSize = 3) {
  // Filter for failures that have valid embeddings
  const embeddedFailures = failures.filter(f => Array.isArray(f.embedding) && f.embedding.length > 0);
  if (embeddedFailures.length < minClusterSize) {
    return [];
  }

  const visited = new Set();
  const clusters = [];

  for (let i = 0; i < embeddedFailures.length; i++) {
    if (visited.has(i)) continue;

    const currentCluster = [embeddedFailures[i]];
    let totalSimilarity = 1.0;
    let comparisons = 1;

    for (let j = i + 1; j < embeddedFailures.length; j++) {
      if (visited.has(j)) continue;

      const sim = cosineSimilarity(embeddedFailures[i].embedding, embeddedFailures[j].embedding);
      if (sim >= similarityThreshold) {
        currentCluster.push(embeddedFailures[j]);
        totalSimilarity += sim;
        comparisons++;
        visited.add(j);
      }
    }

    if (currentCluster.length >= minClusterSize) {
      visited.add(i);
      clusters.push({
        id: `cluster_${clusters.length + 1}_${Date.now()}`,
        items: currentCluster,
        avgSimilarity: Number((totalSimilarity / comparisons).toFixed(3))
      });
    }
  }

  return clusters;
}
