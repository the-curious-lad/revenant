import { recordFailure, getUncategorizedFailures, getAllCategories } from '../src/db/mongo.js';
import { generateEmbedding } from '../src/ai/ollama.js';

// Seed 3 uncategorized failures that share a specific blindspot:
// E.g. Missing vector reserve before massive loop (TLE)
const code1 = `
#include <vector>
using namespace std;
int main() {
    vector<int> huge_array;
    for (int i = 0; i < 50000000; i++) {
        huge_array.push_back(i);
    }
}
`;

const code2 = `
#include <vector>
using namespace std;
void solve() {
    vector<int> buffer_stream;
    for (int i = 0; i < 30000000; i++) {
        buffer_stream.push_back(i);
    }
}
int main() { solve(); }
`;

const code3 = `
#include <vector>
using namespace std;
int main() {
    vector<int> data_collection;
    for (int i = 0; i < 40000000; i++) {
        data_collection.push_back(i * 2);
    }
}
`;

console.log('Seeding 3 uncategorized failures with vector reallocation TLE...');

await recordFailure({
  file: 'problem_a.cpp',
  snapshot: code1,
  verdict: 'TLE',
  category: 'uncategorized',
  evidence: 'vector push_back without reserve in 5e7 loop',
  explanation: 'Reallocation overhead caused TLE'
});

await recordFailure({
  file: 'problem_b.cpp',
  snapshot: code2,
  verdict: 'TLE',
  category: 'uncategorized',
  evidence: 'vector push_back without reserve in 3e7 loop',
  explanation: 'Reallocation overhead caused TLE'
});

await recordFailure({
  file: 'problem_c.cpp',
  snapshot: code3,
  verdict: 'TLE',
  category: 'uncategorized',
  evidence: 'vector push_back without reserve in 4e7 loop',
  explanation: 'Reallocation overhead caused TLE'
});

console.log('Done seeding. Uncategorized count:', (await getUncategorizedFailures()).length);
