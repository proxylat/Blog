import Beasties from 'beasties';
import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';

const buildDir = '_site';

async function generateCriticalCssWithBeasties() {
    console.log('\nStarting Critical CSS generation with "Beasties" package...');

    const findHtmlFilesRecursive = async (dir) => {
        let htmlFiles = [];
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                htmlFiles = htmlFiles.concat(await findHtmlFilesRecursive(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.html')) {
                const relativePath = path.relative(buildDir, fullPath);
                htmlFiles.push({ name: entry.name, url: relativePath.replace(/\\/g, '/') });
            }
        }
        return htmlFiles;
    };

    const pagesToProcess = await findHtmlFilesRecursive(buildDir);

    if (pagesToProcess.length === 0) {
        console.log('No HTML files found to process. Skipping Critical CSS generation.');
        return;
    }

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';

    const beastiesOptions = {
        path: buildDir,
        preload: true,
        noscript: true,
        minify: true,
        browser: {
            path: executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process'
            ]
        },
    };

    await Promise.all(pagesToProcess.map(async (page) => {
        const htmlPath = path.join(buildDir, page.url);
        try {
            const htmlContentBefore = await readFile(htmlPath, 'utf8');
            const htmlSizeBeforeKb = (Buffer.byteLength(htmlContentBefore, 'utf8') / 1024).toFixed(2);

            const beasties = new Beasties(beastiesOptions);

            const newHtml = await beasties.process(htmlContentBefore);

            await writeFile(htmlPath, newHtml);

            const htmlSizeAfterKb = (Buffer.byteLength(newHtml, 'utf8') / 1024).toFixed(2);

            console.log(`  HTML size before "Beasties": ${htmlSizeBeforeKb} KB`);
            console.log(`  HTML size after "Beasties" : ${htmlSizeAfterKb} KB`);
            console.log(`  Difference                 : ${(htmlSizeAfterKb - htmlSizeBeforeKb).toFixed(2)} KB (inlined Critical CSS size)`);
            console.log(`Critical CSS generated and inlined for ${page.url}.`);

        } catch (error) {
            console.error(`Error generating Critical CSS for ${page.url}:`, error.message);
            console.error(error);
        }
    }));

    console.log('\n"Beasties" Critical CSS generation complete.');
}

generateCriticalCssWithBeasties().catch(error => {
    console.error('An unhandled error occurred during "Beasties" Critical CSS generation:', error);
    console.error(error);
    process.exit(1);
});