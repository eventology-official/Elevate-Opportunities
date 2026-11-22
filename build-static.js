const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const output = path.join(root, "dist");

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const rootFiles = fs.readdirSync(root, { withFileTypes: true });
for (const entry of rootFiles) {
  if (!entry.isFile()) continue;
  if (entry.name === "server.js" || entry.name === "build-static.js") continue;
  if (
    entry.name.endsWith(".html") ||
    entry.name.endsWith(".css") ||
    entry.name.endsWith(".js") ||
    entry.name.endsWith(".json") ||
    entry.name.endsWith(".webmanifest")
  ) {
    fs.copyFileSync(path.join(root, entry.name), path.join(output, entry.name));
  }
}

const imagesSource = path.join(root, "images");
const imagesOutput = path.join(output, "images");
if (fs.existsSync(imagesSource)) {
  fs.mkdirSync(imagesOutput, { recursive: true });
  for (const entry of fs.readdirSync(imagesSource)) {
    const source = path.join(imagesSource, entry);
    if (fs.statSync(source).isFile()) {
      fs.copyFileSync(source, path.join(imagesOutput, entry));
    }
  }
}

console.log("Static build complete:", output);
