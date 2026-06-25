import { readFile, writeFile, readdir, rm } from 'fs/promises';
import path from 'path';

const buildDir = '_site';
const cssDir = path.join(buildDir, 'css');
const cssPath = path.join(cssDir, 'main.css');

async function findHtmlFiles(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await findHtmlFiles(full, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

let css;
try {
  css = await readFile(cssPath, 'utf8');
} catch {
  console.warn('[inline] main.css not found, skipping');
  process.exit(0);
}

const files = await findHtmlFiles(buildDir);

for (const file of files) {
  let html = await readFile(file, 'utf8');
  const before = Buffer.byteLength(html, 'utf8');

  html = html.replace(/<link[^>]*href="[^"]*main\.css[^"]*"[^>]*>/g, '');
  html = html.replace('</head>', `<style>${css}</style></head>`);

  await writeFile(file, html);
  const after = Buffer.byteLength(html, 'utf8');
  console.log(`[inline] ${path.relative(buildDir, file)} — ${(after - before) / 1024 | 0}KB added`);
}

await rm(cssDir, { recursive: true });
console.log(`[inline] deleted unused css/ directory`);
