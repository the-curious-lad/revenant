# 👻 REVENANT: "Ghost in the Machine" Error-Memory Developer Tool

> *"Every mistake you make leaves a ghost behind. Ghosts linger, gain strength when repeated, fade when conquered, and haunt you before you run doomed code."*

Built for **DEV Open-Source AI Challenge: Week 4 (Theme: Ghost in the Machine)** & Hacktoberfest 2026.

---

## 🔮 What is REVENANT?

Developers don't fail randomly—we fail **systematically** according to personal blind spots (32-bit integer overflows, unreset global vectors in test loops, 0-vs-1 indexing, negative modulo operations).

Linters are too generic, and running an LLM on every save or run is far too slow. **REVENANT** is a personalized error-memory tool that:
1. **Remembers how you personally fail** by persisting failure snapshots into **MongoDB Atlas**.
2. **Warns you before you run doomed code** via a **<10ms Hot-Path Scanner** (Zero AI latency on the hot path).
3. **Diagnoses failures using local Gemma via Ollama** into strict JSON when tests fail.
4. **Summons Séances** to cluster uncategorized mistakes with **Atlas Vector Search**, proposing and validating new ghost categories.
5. **Simulates ghost exorcism & return** using a 14-day half-life decay formula:
   $$\text{weakness} = \text{weakness} \times 0.5^{(\Delta\text{days} / 14)} + 1$$

---

## ⚡ Architecture: Two-Path Decoupled Design

```
[ Developer runs: ghost run solution.cpp ]
                    │
                    ▼
  ┌─────────────────────────────────────────────────────────┐
  │ HOT PATH (< 10ms, ZERO LLM Latency)                     │
  │ 1. Snapshot code in memory                              │
  │ 2. Load Quick-Guess Cache (Top 7 highest weakness ghosts)│
  │ 3. Run fast deterministic detectors                     │
  │    └── Match found? ──► Print Spooky Warning & Evidence │
  │ 4. Compile with g++ & execute against sample tests      │
  │ 5. Classify verdict: AC, WA, TLE, RTE, CE               │
  └─────────────────────────┬───────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        [ Accepted (AC) ]           [ Failed (WA, RTE, TLE, CE) ]
        Ghosts retreat. Done.                     │
                                                  ▼
                        ┌──────────────────────────────────────────────────┐
                        │ COLD PATH (Async / Out-of-band via Gemma/Ollama) │
                        │ 1. Send failure context + Graveyard taxonomy     │
                        │ 2. Gemma returns strict JSON diagnosis           │
                        │ 3. Update category weakness in MongoDB Atlas     │
                        │ 4. If uncategorized: save with vector embedding  │
                        └──────────────────────────────────────────────────┘
```

---

## 📊 The 70/30 Empirical Backtest Benchmark

To prove that REVENANT is not AI snake oil, we include a reproducible benchmark (`ghost backtest`) that trains on the first 70% of chronological history and evaluates on the remaining 30%:

```text
  REVENANT 70/30 EMPIRICAL BACKTEST REPORT
  Chronological Split: 70 training runs (70%) | 30 evaluation runs (30%)

  Confusion Matrix:
    - True Positives  (Prevented Failures): 13
    - False Positives (False Alarms):       0
    - False Negatives (Missed Failures):    3
    - True Negatives  (Clean Runs):         14

┌──────────────────────┬──────────────┬──────────────────────────────────────────────┐
│ Metric               │ Result       │ Benchmark Meaning                            │
├──────────────────────┼──────────────┼──────────────────────────────────────────────┤
│ Precision            │ 100%         │ When warned, code would have genuinely failed│
├──────────────────────┼──────────────┼──────────────────────────────────────────────┤
│ Recall               │ 81.3%        │ Proportion of actual failures caught pre-run │
├──────────────────────┼──────────────┼──────────────────────────────────────────────┤
│ False Alarm Rate     │ 0.0%         │ Passing code wrongly flagged (<10% is gold)  │
├──────────────────────┼──────────────┼──────────────────────────────────────────────┤
│ F1 Score             │ 89.7%        │ Harmonic mean of precision and recall        │
├──────────────────────┼──────────────┼──────────────────────────────────────────────┤
│ Overall Accuracy     │ 90.0%        │ Total correct classifications                │
└──────────────────────┴──────────────┴──────────────────────────────────────────────┘
```

---

## 🚀 Quickstart

### Prerequisites
- **Node.js**: v20+
- **C++ Compiler**: `g++` (MinGW on Windows, or GCC/Clang on Linux/macOS)
- **Ollama** (optional, for local Gemma cold-path diagnosis): `ollama run gemma2:2b`
- **MongoDB Atlas** (optional, works seamlessly with offline local cache fallback)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/revenant.git
cd revenant

# Install dependencies
npm install

# Link globally to your terminal
npm link
```

### Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your `MONGODB_URI` from your MongoDB Atlas cluster dashboard.

---

## 🛠️ CLI Commands

### 1. Test Code Against Ghosts & Samples
```bash
ghost run solution.cpp
```
- Scans for top active ghosts in <10ms.
- Compiles with `g++ -O2 -std=c++17`.
- Automatically pairs `solution.in` / `solution.out` or runs against `tests/*.in`.
- Deterministically catches `AC`, `WA`, `TLE`, `RTE`, or `CE`.
- On failure, triggers the Cold-Path LLM diagnostician and updates weakness.

### 2. Inspect the Graveyard
```bash
ghost graveyard
# or: ghost status
```
Displays your complete roster of 16 canonical sins + custom ghosts, their death counts, current weakness scores, and whether they are active or **Exorcised** ($weakness < 0.5$).

### 3. Hold a Séance (`ghost seance`)
```bash
ghost seance
```
Clusters `uncategorized` failures in MongoDB using vector embeddings. When 3 or more similar failures form a cluster:
1. Local Gemma synthesizes a **brand-new Ghost Category** and regex detector.
2. The **Validation Gate** tests the rule against historical passing code.
3. If it generates false alarms, it is **rejected**. If clean, it is **promoted** into the Graveyard!

### 4. Run the 70/30 Empirical Backtest
```bash
ghost backtest
```
Replays submissions chronologically to generate empirical Precision, Recall, and False Alarm rates.

### 5. Launch the Webhook / Web Dashboard Server (Render-Ready)
```bash
npm start
```
Spins up the HTTP service on port 3000 (or `$PORT` on Render) serving the live dark-themed Graveyard dashboard and JSON APIs (`/api/ghosts`, `/health`).

---

## ☁️ Deploy to Render in 1 Click

REVENANT includes an official [`render.yaml`](./render.yaml) Blueprint:

1. Fork or push this repository to GitHub.
2. In your [Render Dashboard](https://dashboard.render.com/), select **New** $\rightarrow$ **Blueprint**.
3. Connect your repository. Render automatically reads `render.yaml`, spins up a Node.js web service, and sets up health checking on `/health`.
4. Add your `MONGODB_URI` environment variable in the Render dashboard, and your live cloud Graveyard is active!

---

## 🧪 Running Unit Tests
```bash
npm test
```
All 19 unit tests across 4 suites pass with 100% coverage on classifiers, schema validation, vector clustering, ReDoS protection, and backtest metrics.

---

## 📜 License
MIT License. Built with ❤️ for Hacktoberfest 2026.
