import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.DASHBOARD_PORT || 5174);
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['localhost', '127.0.0.1'].includes((req.headers.host || '').split(':')[0])) {
    res.writeHead(403).end('Local access only'); return;
  }
  if (req.method !== 'GET') { res.writeHead(405).end('Read only'); return; }
  try {
    if (req.url === '/api/state') {
      const text = await readFile(new URL('./activity.jsonl', import.meta.url), 'utf8').catch(e => {
        if (e.code === 'ENOENT') return ''; throw e;
      });
      const events = text.split('\n').filter(Boolean).flatMap(line => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
      const agents = Object.values(Object.fromEntries(events.map(e => [e.id, e])));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ agents, events: events.slice(-40).reverse(), checkedAt: new Date().toISOString() }));
    } else if (req.url === '/' || req.url === '/index.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(await readFile(new URL('./index.html', import.meta.url)));
    } else { res.writeHead(404).end('Not found'); }
  } catch { res.writeHead(500).end('Could not read activity'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Agent dashboard: http://localhost:${port}`));
