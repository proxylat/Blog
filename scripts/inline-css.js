import fs from 'fs/promises';
import path from 'path';

const buildDir = '_site';
const cssPath = path.join(buildDir, 'css', 'main.css');

async function findHtmlFiles(dir, files = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await findHtmlFiles(full, files);
    else if (entry.isFile() && full.endsWith('.html')) files.push(full);
  }
  return files;
}

try {
  const css = await fs.readFile(cssPath, 'utf8');
  const htmlFiles = await findHtmlFiles(buildDir);

  if (!htmlFiles.length) {
    console.warn('No HTML files found. Skipping CSS inlining.');
  } else {
    await Promise.all(htmlFiles.map(async (file) => {
      let html = await fs.readFile(file, 'utf8');
      html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>|<link[^>]*rel=["']?preload["']?[^>]*as=["']style["'][^>]*>/gi, '');
      let prev;
      do { prev = html.length; html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ''); } while (html.length !== prev);
      html = html.replace(/<\/head>/i, `<style>${css}</style></head>`);
      await fs.writeFile(file, html);
      console.log(`Inlined: ${file}`);
    }));

    await Promise.all([
      fs.rm(path.join(buildDir, 'css'), { recursive: true, force: true }),
      fs.rm(path.join(buildDir, 'assets'), { recursive: true, force: true }),
    ]);
    console.log('Removed: _site\\css and _site\\assets');
  }
} catch (err) {
  console.error('Inline CSS failed:', err);
  process.exit(1);
}
