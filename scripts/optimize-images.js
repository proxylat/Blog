import { readFileSync, existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';

function openTarget(target) {
  const cmd = process.platform === 'win32' ? 'start ""'
    : process.platform === 'darwin' ? 'open'
    : 'xdg-open';
  try { execSync(`${cmd} "${target}"`); } catch (_) {}
}

const configPath = process.argv[2] || './config.json';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const inputPath = path.resolve(config.input || './imgs');
const outputDir = path.resolve(config.outputDir || './_site/imgs');
const deleteOriginal = Boolean(config.deleteOriginal);
const openFirst = config.openFirst !== false;
const recursive = config.recursive !== false;
const webpOptions = config.webp || { quality: 85, effort: 4 };

const allowedExts = new Set([
  '.jpg', '.jpeg', '.png', '.avif',
  '.gif', '.tif', '.tiff', '.bmp', '.webp',
]);

const isImage = filePath => allowedExts.has(path.extname(filePath).toLowerCase());

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function collectFiles(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (fullPath.startsWith(outputDir + path.sep)) continue;
    if (entry.isDirectory()) {
      if (recursive) results.push(...await collectFiles(fullPath));
      continue;
    }
    if (entry.isFile() && isImage(fullPath)) results.push(fullPath);
  }
  return results;
}

function getOutputPath(sourceFile, baseInputDir) {
  const parsed = path.parse(sourceFile);
  if (!recursive) return path.join(outputDir, `${parsed.name}.webp`);
  const relativeDir = path.relative(baseInputDir, path.dirname(sourceFile));
  return path.join(outputDir, relativeDir, `${parsed.name}.webp`);
}

async function collectInputs() {
  const stat = await fs.stat(inputPath);
  if (stat.isFile()) {
    if (!isImage(inputPath)) throw new Error(`Unsupported input file: ${inputPath}`);
    return { baseDir: path.dirname(inputPath), files: [inputPath] };
  }
  return { baseDir: inputPath, files: await collectFiles(inputPath) };
}

async function convertFile(sourceFile, baseDir) {
  const destination = getOutputPath(sourceFile, baseDir);
  await ensureDir(path.dirname(destination));
  await sharp(sourceFile).webp(webpOptions).toFile(destination);
  if (deleteOriginal) {
    const sameFile = path.resolve(sourceFile) === path.resolve(destination);
    if (!sameFile) await fs.unlink(sourceFile).catch(() => {});
  }
  return destination;
}

async function main() {
  if (!existsSync(inputPath)) throw new Error(`Input not found: ${inputPath}`);
  await ensureDir(outputDir);
  const { baseDir, files } = await collectInputs();
  if (!files.length) throw new Error('No image files found.');

  const generated = await Promise.all(
    files.map(f => convertFile(f, baseDir).then(out => { console.log(`Created: ${out}`); return out; }))
  );

  if (openFirst && generated.length > 0) openTarget(generated[0]);
}

main().catch(err => { console.error(err); process.exit(1); });
