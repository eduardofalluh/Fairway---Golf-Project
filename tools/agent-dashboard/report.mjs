import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [id, name, model, status, summary] = process.argv.slice(2);
if (!id || !name || !model || !['working', 'completed', 'blocked', 'idle'].includes(status) || !summary) {
  console.error('Usage: node report.mjs ID NAME MODEL working|completed|blocked|idle SUMMARY');
  process.exit(1);
}
const event = { id, name, model, status, summary, at: new Date().toISOString() };
appendFileSync(fileURLToPath(new URL('./activity.jsonl', import.meta.url)), JSON.stringify(event) + '\n');
console.log(`${name}: ${status}`);
