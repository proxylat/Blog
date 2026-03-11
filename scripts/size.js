const fs = require("fs");
const path = require("path");
const { imageSize } = require("image-size");
const { JSDOM } = require("jsdom");

const DIST = path.resolve("./_site");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (!entry.name.endsWith(".html")) continue;

    processFile(full);
  }
}

function processFile(file) {
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes("<img")) return;

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  let changed = false;

  const article = doc.querySelector("article");
  const imgs = article
    ? article.querySelectorAll("img")
    : doc.querySelectorAll("img");

  let imgIndex = 0;

  imgs.forEach(img => {
    imgIndex++;

    const needsSize =
      !(img.hasAttribute("width") && img.hasAttribute("height"));

    const isAboveTheFold = imgIndex <= 2;

    if (!img.hasAttribute("loading") && !isAboveTheFold) {
      const src = img.getAttribute("src") || "";
      const isLogo =
        src.includes("logo.avif") || img.hasAttribute("fetchpriority");

      if (!isLogo) {
        img.setAttribute("loading", "lazy");
        changed = true;
      }
    }

    if (!needsSize) return;

    const src = img.getAttribute("src");
    if (!src || src.startsWith("http") || src.startsWith("data:")) return;

    const imgPath = path.join(DIST, src);
    if (!fs.existsSync(imgPath)) return;

    const buffer = fs.readFileSync(imgPath);
    const { width, height } = imageSize(buffer);

    img.setAttribute("width", width);
    img.setAttribute("height", height);

    changed = true;
  });

  if (changed) {
    fs.writeFileSync(file, dom.serialize());
  }
}

walk(DIST);

console.log("Done");

