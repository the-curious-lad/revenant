/**
 * Generates an authentic dataset of 50 competitive programming submissions
 * with realistic mistake distributions (repeated personal blind spots)
 * to benchmark the 70/30 backtest.
 */
export function generateBenchmarkDataset(totalRuns = 100) {
  const problems = [
    { title: 'Prefix Sum Max', defaultSin: 'int_overflow' },
    { title: 'Graph BFS Traversal', defaultSin: 'unreset_global_state' },
    { title: 'Modulo Combination nCr', defaultSin: 'modulo_arithmetic_negative' },
    { title: 'Binary Search Lower Bound', defaultSin: 'off_by_one_index' },
    { title: 'Tree Diameter DFS', defaultSin: 'unreset_global_state' },
    { title: 'Array Accumulator', defaultSin: 'int_overflow' },
    { title: 'Coordinate Compression', defaultSin: 'off_by_one_index' },
    { title: 'Subarray XOR Sum', defaultSin: 'int_overflow' },
    { title: 'Geometry Angle Compare', defaultSin: 'precision_loss_float' },
    { title: 'Connected Components', defaultSin: 'unreset_global_state' }
  ];

  const runs = [];
  const baseDate = new Date('2026-10-01T10:00:00Z').getTime();

  // Generate realistic chronological runs (default 100 runs for robust statistical power)
  for (let i = 0; i < totalRuns; i++) {
    const prob = problems[i % problems.length];
    const timestamp = new Date(baseDate + i * 14 * 3600 * 1000).toISOString();

    // 40% clean solutions, 60% failures initially (tapers down as dev learns)
    const isSuccess = (i > 30 && (i % 3 === 0)) || (i % 4 === 0);

    if (isSuccess) {
      runs.push({
        file: `problem_${i + 1}_${prob.title.toLowerCase().replace(/\s+/g, '_')}.cpp`,
        code: `
#include <iostream>
#include <vector>
using namespace std;
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    long long clean_sum = 0;
    int n; if (cin >> n) {
        for (int j = 0; j < n; j++) { long long x; cin >> x; clean_sum += x; }
        cout << clean_sum << "\\n";
    }
    return 0;
}
`,
        verdict: 'AC',
        category: null,
        timestamp
      });
    } else {
      // Failing run with one of the developer's recurring sins
      const sin = prob.defaultSin;
      let faultyCode = '';

      if (sin === 'int_overflow') {
        faultyCode = `
#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    int sum = 0; // BUG: 32-bit int overflow on 10^9 values
    for (int j = 0; j < n; j++) { int val; cin >> val; sum += val; }
    cout << sum << "\\n";
}
`;
      } else if (sin === 'unreset_global_state') {
        faultyCode = `
#include <iostream>
#include <vector>
using namespace std;
vector<int> adj[100005]; // BUG: Not cleared between testcases!
int main() {
    int t; cin >> t;
    while (t--) {
        int n, m; cin >> n >> m;
        for (int j = 0; j < m; j++) { int u, v; cin >> u >> v; adj[u].push_back(v); }
    }
}
`;
      } else if (sin === 'modulo_arithmetic_negative') {
        faultyCode = `
#include <iostream>
using namespace std;
const int MOD = 1e9 + 7;
int main() {
    long long a, b; cin >> a >> b;
    long long ans = (a - b) % MOD; // BUG: Negative modulo!
    cout << ans << "\\n";
}
`;
      } else if (sin === 'precision_loss_float') {
        faultyCode = `
#include <iostream>
using namespace std;
int main() {
    double a, b; cin >> a >> b;
    if (a == b) cout << "EQUAL\\n"; // BUG: Direct float equality
}
`;
      } else {
        faultyCode = `
#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    int a[100];
    for (int j = 1; j <= n; j++) cin >> a[j]; // 1-based indexing on small array
}
`;
      }

      runs.push({
        file: `problem_${i + 1}_${prob.title.toLowerCase().replace(/\s+/g, '_')}.cpp`,
        code: faultyCode,
        verdict: sin === 'unreset_global_state' ? 'WA' : (sin === 'int_overflow' ? 'WA' : 'WA'),
        category: sin,
        timestamp
      });
    }
  }

  return runs;
}
