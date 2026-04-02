import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const DIST = path.resolve('./_site');

const getAttr = (tag, attr) => tag.match(new RegExp(`\\b${attr}=["']([^"']*)["']`, 'i'))?.[1] ?? null;
const hasAttr = (tag, attr) => new RegExp(`\\b${attr}[=\\s>]`, 'i').test(tag);
const addAttr = (tag, attrs) => tag.replace(/(\s*\/?)>$/, ` ${attrs}$1>`);

async function processFile(file) {
  let html = readFileSync(file, 'utf8');
  if (!html.includes('<img') && !html.includes('<video')) return;

  const rel = path.relative(DIST, file).replace(/\\/g, '/');
  const isPost = /^\d{4}\//.test(rel);
  const imgLogs = [];
  let imgCount = 0, result = '', lastIndex = 0, changed = false;

  for (const match of html.matchAll(/<img[^>]*>/gi)) {
    let t = match[0];
    const src = getAttr(t, 'src') ?? '';
    const isExternal = /^(https?:)?\/\//.test(src);
    const isIcon = /icon-(github|discord)\.webp/.test(src);
    const isGif = src.toLowerCase().endsWith('.gif');

    imgCount++;
    const isCritical = src.includes('logo.avif') || (!isIcon && imgCount <= 2) || (!isPost && isIcon);
    const imgActions = [];

    if (isGif && !hasAttr(t, 'style')) {
      t = addAttr(t, 'style="display:block;margin:0 auto;max-width:100%;height:auto"');
      imgActions.push('gif-style');
    }
    if (!hasAttr(t, 'loading') && !isCritical) {
      t = addAttr(t, 'loading="lazy"');
      imgActions.push('lazy');
    }
    if (src && !isExternal && !src.startsWith('data:') && !(hasAttr(t, 'width') && hasAttr(t, 'height'))) {
      const imgPath = path.join(DIST, src.replace(/^\/+/, ''));
      if (existsSync(imgPath)) {
        try {
          const { width, height } = await sharp(imgPath).metadata();
          if (width && height) {
            t = addAttr(t, `width="${width}" height="${height}"`);
            imgActions.push(`${width}x${height}`);
          }
        } catch (_) {}
      }
    }

    if (t !== match[0]) changed = true;
    if (imgActions.length) imgLogs.push(`  ${src || '(no src)'} → ${imgActions.join(', ')}`);
    result += html.slice(lastIndex, match.index) + t;
    lastIndex = match.index + match[0].length;
  }

  result += html.slice(lastIndex);

  if (result.includes('<video')) {
    result = result.replace(/<video\b([^>]*)>/gi, (full, attrs) => {
      if (hasAttr(full, 'style')) return full;
      changed = true;
      imgLogs.push(`  <video> → style-injected`);
      return `<video style="display:block;margin:1rem auto;max-width:100%;height:auto" ${attrs}>`;
    });
  }

  if (changed) {
    writeFileSync(file, result);
    console.log(`[size] ${rel}`);
    imgLogs.forEach(l => console.log(l));
  }
}

async function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    entry.isDirectory() ? await walk(full) : entry.name.endsWith('.html') && await processFile(full);
  }
}

walk(DIST).catch(err => { console.error(err); process.exit(1); });