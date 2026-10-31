import http from 'http';
import dotenv from 'dotenv';
import { getAllCategories, getTopCategories, getUncategorizedFailures, connectDb } from './db/mongo.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

function renderHtmlDashboard(categories = [], uncategorizedCount = 0) {
  const activeCount = categories.filter(c => (c.weakness || 0) >= 0.5).length;
  const exorcisedCount = categories.length - activeCount;

  const rows = categories.map(cat => {
    const isExorcised = (cat.weakness || 0) < 0.5;
    const statusBadge = isExorcised 
      ? `<span class="badge exorcised">Exorcised</span>`
      : `<span class="badge haunting">Haunting</span>`;
    
    return `
      <tr>
        <td><code>${cat.key}</code></td>
        <td><strong>${cat.name}</strong><br><small class="text-muted">${cat.description || ''}</small></td>
        <td><span class="weakness-score">${(cat.weakness || 0).toFixed(2)}</span></td>
        <td>${cat.count || 0}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>REVENANT | The Machine Remembers Every Sin</title>
  <style>
    :root {
      --bg: #0d0e15;
      --card-bg: #161822;
      --accent: #bd93f9;
      --red: #ff5555;
      --green: #50fa7b;
      --yellow: #f1fa8c;
      --cyan: #8be9fd;
      --text: #f8f8f2;
      --muted: #6272a4;
      --border: #282a36;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 2rem 1rem;
      line-height: 1.5;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 2.5rem; }
    pre.ghost-ascii {
      color: var(--accent);
      font-size: 0.95rem;
      font-family: monospace;
      margin-bottom: 1rem;
      display: inline-block;
      text-align: left;
    }
    h1 { font-size: 2.2rem; color: #fff; letter-spacing: 2px; margin-bottom: 0.4rem; }
    p.tagline { color: var(--muted); font-size: 1.1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.2rem;
      text-align: center;
    }
    .stat-val { font-size: 2rem; font-weight: bold; color: var(--cyan); }
    .stat-label { color: var(--muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow-x: auto;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th {
      background: #1e202e;
      color: var(--accent);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 1rem;
      border-bottom: 2px solid var(--border);
    }
    td { padding: 1rem; border-bottom: 1px solid var(--border); font-size: 0.95rem; }
    tr:hover { background: rgba(189, 147, 249, 0.05); }
    code { background: #282a36; padding: 2px 6px; border-radius: 4px; color: var(--yellow); font-size: 0.85rem; }
    .weakness-score { font-weight: bold; color: var(--cyan); font-family: monospace; }
    .text-muted { color: var(--muted); }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge.haunting { background: rgba(255, 85, 85, 0.2); color: var(--red); border: 1px solid var(--red); }
    .badge.exorcised { background: rgba(98, 114, 164, 0.2); color: var(--muted); border: 1px solid var(--muted); }
    footer { text-align: center; margin-top: 3rem; color: var(--muted); font-size: 0.85rem; }
    footer a { color: var(--accent); text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <pre class="ghost-ascii">
      .-.
     (o o)   R E V E N A N T
     | O \\   "The machine remembers every sin"
      \\   \\
       \`~~~'
      </pre>
      <h1>REVENANT CLOUD GRAVEYARD</h1>
      <p class="tagline">Personalized Error-Memory System for Competitive Programming & Algorithms</p>
    </header>

    <div class="grid">
      <div class="stat-card">
        <div class="stat-val">${categories.length}</div>
        <div class="stat-label">Total Ghost Roster</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: var(--red);">${activeCount}</div>
        <div class="stat-label">Actively Haunting</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: var(--muted);">${exorcisedCount}</div>
        <div class="stat-label">Exorcised Ghosts</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: var(--yellow);">${uncategorizedCount}</div>
        <div class="stat-label">Awaiting Séance</div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Ghost Identifier</th>
            <th>Name & Technical Cause</th>
            <th>Weakness Score</th>
            <th>Times Died</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <footer>
      <p>Built with ❤️ for <strong>Hacktoberfest 2026 & DEV Open-Source AI Challenge (Week 4)</strong></p>
      <p>Powered by <strong>Render</strong>, <strong>MongoDB Atlas</strong>, and local <strong>Gemma via Ollama</strong>.</p>
    </footer>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Healthcheck endpoint for Render monitoring
  if (url.pathname === '/health' || url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'haunted',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // JSON API: /api/ghosts
  if (url.pathname === '/api/ghosts') {
    try {
      const categories = await getAllCategories();
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: true, count: categories.length, ghosts: categories }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // JSON API: /api/quick-cache
  if (url.pathname === '/api/quick-cache') {
    try {
      const active = await getTopCategories(7);
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: true, count: active.length, cache: active }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // Main UI Dashboard: GET /
  if (url.pathname === '/' || url.pathname === '/graveyard') {
    try {
      const categories = await getAllCategories();
      const uncategorized = await getUncategorizedFailures();
      const html = renderHtmlDashboard(categories, uncategorized.length);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error rendering Graveyard: ${err.message}`);
    }
    return;
  }

  // 404 Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', availableRoutes: ['/', '/api/ghosts', '/api/quick-cache', '/health'] }));
});

server.listen(PORT, async () => {
  console.log(`👻 REVENANT Ghost Server running on port ${PORT}`);
  console.log(`   - Dashboard:    http://localhost:${PORT}/`);
  console.log(`   - API Ghosts:   http://localhost:${PORT}/api/ghosts`);
  console.log(`   - Health check: http://localhost:${PORT}/health`);
  
  // Connect to Atlas
  await connectDb();
});
