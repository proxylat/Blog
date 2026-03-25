import fs from 'fs/promises';
import path from 'path';
import dropcss from 'dropcss';
import { transform } from 'lightningcss';

const dir = '_site';
const cssFile = path.join(dir, 'css', 'main.css');
const pct = (a, b) => ((1 - b / a) * 100).toFixed(2);

const htmlFiles = async d => {
  const entries = await fs.readdir(d, { withFileTypes: true });
  const files = await Promise.all(entries.map(e => {
    const res = path.join(d, e.name);
    return e.isDirectory()
      ? htmlFiles(res)
      : (e.isFile() && path.extname(e.name).toLowerCase() === '.html' ? res : []);
  }));
  return files.flat();
};

const clean = h => h
  .replace(/<\?xml[^>]*\?>/g, '')
  .replace(/<svg[\s\S]*?<\/svg>/gi, '');

const run = async () => {
  let css;
  try {
    css = await fs.readFile(cssFile, 'utf8');
  } catch (e) {
    console.error(`Error reading CSS: ${e.message}`);
    process.exit(1);
  }

  const orig = Buffer.byteLength(css);
  console.log(`Original: ${orig} bytes`);

  let htmlList;
  try {
    htmlList = await htmlFiles(dir);
    if (!htmlList.length) console.warn('No HTML files found.');
  } catch (e) {
    console.error(`Error finding HTML files: ${e.message}`);
    process.exit(1);
  }

  const htmlParts = await Promise.all(
    htmlList.map(f =>
      fs.readFile(f, 'utf8').then(clean).catch(e => {
        console.warn(`Warning: Could not read ${f}: ${e.message}`);
        return '';
      })
    )
  );

  const html = htmlParts.join(' ');
  if (!html.trim()) console.warn('Combined HTML is empty. DropCSS might not be effective.');

  let purged;
  try {
    const result = dropcss({
      html,
      css,
      shouldDrop: (sel) => {
        if (sel.includes('.dark-theme')) return false;
        if (sel.includes(':visited')) return false
        if (sel.includes('h3') || sel.includes('h4')) return false;
        return true;
      },
    });
    purged = result.css;
  } catch (e) {
    console.error(`DropCSS failed: ${e.message}`);
    process.exit(1);
  }

  const mid = Buffer.byteLength(purged);
  console.log(`DropCSS: ${mid} bytes (-${pct(orig, mid)}%)`);

  let final;
  try {
    const { code } = transform({
      filename: 'main.css',
      code: Buffer.from(purged),
      minify: true,
      targets: {
        chrome: 120000,
        firefox: 120000,
        safari: 170000,
        edge: 120000,
        ios_saf: 170000,
        android: 120000,
      },
      drafts: { nesting: true, customMedia: true },
      cssModules: false,
    });
    final = code.toString();
  } catch (e) {
    console.error(`LightningCSS failed: ${e.message}`);
    process.exit(1);
  }

  const end = Buffer.byteLength(final);
  console.log(`LightningCSS: ${end} bytes (-${pct(orig, end)}% total)`);
  await fs.writeFile(cssFile, final);
  console.log('Optimization complete!');
};

run().catch(e => { console.error('Unexpected error:', e); process.exit(1); });
