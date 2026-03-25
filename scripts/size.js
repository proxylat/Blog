import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const DIST = path.resolve('./_site');

const getAttr = (tag, attr) => {
  const m = tag.match(new RegExp(`\\b${attr}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
};
const hasAttr = (tag, attr) => new RegExp(`\\b${attr}[=\\s>]`, 'i').test(tag);
const addAttr = (tag, attrs) => tag.replace(/(\s*\/?)>$/, ` ${attrs}$1>`);

async function processFile(file) {
  let html = readFileSync(file, 'utf8');
  if (!html.includes('<img')) return;

  const imgRegex = /<img[^>]*>/gi;
  let imgIndex = 0;
  let result = '';
  let lastIndex = 0;
  let match;
  let changed = false;

  while ((match = imgRegex.exec(html)) !== null) {
    imgIndex++;
    let t = match[0];
    const src = getAttr(t, 'src') || '';
    const isExternal = src.startsWith('http') || src.startsWith('//');
    const isAboveTheFold = imgIndex <= 2;
    const isLogo = src.includes('logo.avif');

    if (src.toLowerCase().includes('.gif') && !hasAttr(t, 'style')) {
      t = addAttr(t, 'style="display:block;margin:0 auto;max-width:100%;height:auto"'); changed = true;
    }
    if (!hasAttr(t, 'loading') && !isAboveTheFold && !isLogo) {
      t = addAttr(t, 'loading="lazy"'); changed = true;
    }
    if (!hasAttr(t, 'decoding') && isExternal && !src.toLowerCase().includes('.gif')) {
      t = addAttr(t, 'decoding="async"'); changed = true;
    }
    if (!(hasAttr(t, 'width') && hasAttr(t, 'height')) && src && !isExternal && !src.startsWith('data:')) {
      const imgPath = path.join(DIST, src.replace(/^\/+/, ''));
      if (existsSync(imgPath)) {
        try {
          const { width, height } = await sharp(imgPath).metadata();
          if (width && height) {
            t = addAttr(t, `width="${width}" height="${height}"`); changed = true;
          }
        } catch (_) {}
      }
    }

    result += html.slice(lastIndex, match.index) + t;
    lastIndex = match.index + match[0].length;
  }

  result += html.slice(lastIndex);
  if (result.includes('<video')) {
    result = result.replace(/<video\b([^>]*)>/gi, (_, attrs) => {
      if (/\bstyle=(["'])([^"']*)\1/.test(attrs)) {
        return `<video ${attrs.replace(/\bstyle=(["'])/, 'style=$1display:block;margin:1rem auto;')}>`;
      }
      return `<video style="display:block;margin:1rem auto;max-width:100%;height:auto" ${attrs}>`;
    });
    changed = true;
  }

  if (changed) writeFileSync(file, result);
}

async function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { await walk(full); continue; }
    if (entry.name.endsWith('.html')) await processFile(full);
  }
}

walk(DIST).then(() => console.log('Done')).catch(err => { console.error(err); process.exit(1); });
