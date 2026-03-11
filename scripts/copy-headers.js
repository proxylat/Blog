const fs = require('fs').promises;
const path = require('path');

const sourceFile = '_headers';
const destDir = '_site';
const destFile = path.join(destDir, '_headers');

(async () => {
  try {
    await fs.access(sourceFile);
    await fs.copyFile(sourceFile, destFile);
    console.log(`✓ Copied ${sourceFile} to ${destFile}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`Warning: ${sourceFile} not found. Skipping copy.`);
    } else {
      console.error(`Error copying ${sourceFile}:`, err.message);
      process.exit(1);
    }
  }
})();

