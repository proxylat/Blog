const fs = require('fs').promises;
const path = require('path');

const buildDir = '_site';
const cssPath = path.join(buildDir, 'css', 'main.css');

async function findHtmlFiles(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await findHtmlFiles(fullPath, files);
    } else if (entry.isFile() && fullPath.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

(async () => {
  try {
    const css = await fs.readFile(cssPath, 'utf8');

    const htmlFiles = await findHtmlFiles(buildDir);
    if (!htmlFiles.length) {
      console.warn('No HTML files found. Skipping CSS inlining.');
      return;
    }

    for (const file of htmlFiles) {
      let html = await fs.readFile(file, 'utf8');
      const beforeLength = html.length;

html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>|<link(?=.*rel=["']preload["'])(?![^>]*as=["']font["'])[^>]*as=["']style["'][^>]*>/gi, '');

      let previousLength;
      do {
        previousLength = html.length;
        html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      } while (html.length !== previousLength);

      html = html.replace(
        /<\/head>/i,
        `<style>${css}</style></head>`
      );

      await fs.writeFile(file, html);
      console.log(`CSS inlined successfully: ${file}`);
    }

    await fs.rm(path.join(buildDir, 'css'), {
      recursive: true,
      force: true
    });

    await fs.rm(path.join(buildDir, 'assets'), {
      recursive: true,
      force: true
    });

    console.log('CSS directory removed: _site/css and _site/assets');
  } catch (err) {
    console.error('Inline CSS failed:', err);
    process.exit(1);
  }
})();
