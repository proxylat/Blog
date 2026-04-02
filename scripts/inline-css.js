import Beasties from 'beasties';
import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';

const buildDir = '_site';

async function findHtmlFiles(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await findHtmlFiles(full, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

const beasties = new Beasties({
  path: buildDir,
  preload: 'swap',
  minify: true,
  pruneSource: false,
  logLevel: 'warn',
});

const files = await findHtmlFiles(buildDir);

for (const file of files) {
  const before = await readFile(file, 'utf8');
  const after = await beasties.process(before);
  await writeFile(file, after);

  const kb = s => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1);
  console.log(`[beasties] ${path.relative(buildDir, file)} — ${kb(before)}KB → ${kb(after)}KB`);
};