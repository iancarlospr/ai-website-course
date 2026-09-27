// Writes client/<id>/client.js (window.CLIENT = …) from client/<id>/client.json for every client folder.
// Pages load client.js with a classic <script> so the theme works from file:// (no fetch).
// Usage: node design-c-ipr/client/sync.mjs            (the Design C generator also calls this)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
for (const id of fs.readdirSync(here)) {
  const json = path.join(here, id, 'client.json');
  if (!fs.existsSync(json)) continue;
  const data = JSON.parse(fs.readFileSync(json, 'utf8'));
  if (data.id !== id) throw new Error(`client.json "id" (${data.id}) must match its folder name (${id})`);
  const out = `/* GENERATED from client.json by client/sync.mjs — do not edit */\nwindow.CLIENT = ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(path.join(here, id, 'client.js'), out);
  console.log('wrote', path.relative(process.cwd(), path.join(here, id, 'client.js')));
}
