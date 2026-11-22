const fs = require("node:fs");
const path = require("node:path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

module.exports = function elevateHandler(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "https://localhost").pathname);
  } catch {
    pathname = "/";
  }

  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/login") pathname = "/login.html";

  const root = __dirname;
  const dist = path.join(root, "dist");
  const publicRoot = fs.existsSync(dist) ? dist : root;
  let target = path.resolve(publicRoot, `.${pathname}`);

  if (target !== publicRoot && !target.startsWith(publicRoot + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    target = path.join(publicRoot, "index.html");
  }

  if (!fs.existsSync(target)) {
    res.writeHead(404);
    res.end("404 Not Found");
    return;
  }

  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
  });
  fs.createReadStream(target).pipe(res);
};
