import fs from 'fs/promises';
import path from 'path';
import pkg from '@minify-html/node';
const { minify } = pkg;

const buildDir = '_site';

async function findHtmlFiles(dir, files = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await findHtmlFiles(fullPath, files);
    } else if (entry.isFile() && path.extname(fullPath) === '.html') {
      files.push(fullPath);
    }
  }
  return files;
}

(async () => {
  const files = await findHtmlFiles(buildDir);
  if (!files.length) return;

  const options = {
    minify_js: true,
    minify_css: true,
    minify_doctype: true,
    remove_bangs: true,
    remove_processing_instructions: true
  };

  for (const file of files) {
    try {
      let html = await fs.readFile(file);
      const originalSize = html.length;

      let htmlStr = html.toString('utf8').replace(
        /<script(?![^>]*\b(?:async|defer))(?=[^>]*\bsrc="[^"]+")/g,
        '<script defer'
      );

      const minified = minify(Buffer.from(htmlStr), options);
      const minifiedSize = minified.length;
      const percent = ((1 - minifiedSize / originalSize) * 100).toFixed(2);

      await fs.writeFile(file, minified);
      console.log(`${file} — ${originalSize} → ${minifiedSize} bytes (-${percent}%)`);
    } catch (err) {
      console.error(`Error in ${file}: ${err.message}`);
      process.exit(1);
    }
  }
})().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
