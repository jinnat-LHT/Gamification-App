import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.join(root, 'Leadership_quest_Admin_Enhanced.html');
const hostingPath = path.join(root, '.openai', 'hosting.json');
const distRoot = path.join(root, 'dist');
const serverDir = path.join(distRoot, 'server');
const distOpenAiDir = path.join(distRoot, '.openai');

const html = fs.readFileSync(htmlPath, 'utf8');
const worker = `const html = ${JSON.stringify(html)};\n\nexport default {\n  async fetch(request) {\n    const url = new URL(request.url);\n    if (url.pathname === '/' || url.pathname === '/index.html') {\n      return new Response(html, {\n        headers: {\n          'content-type': 'text/html; charset=UTF-8',\n          'cache-control': 'no-store',\n          'x-content-type-options': 'nosniff'\n        }\n      });\n    }\n    return new Response('Not found', { status: 404 });\n  }\n};\n`;

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(serverDir, { recursive: true });
fs.mkdirSync(distOpenAiDir, { recursive: true });
fs.writeFileSync(path.join(serverDir, 'index.js'), worker, 'utf8');
fs.copyFileSync(hostingPath, path.join(distOpenAiDir, 'hosting.json'));

console.log(`Built Leadership Quest Admin Portal (${html.length.toLocaleString()} characters)`);
