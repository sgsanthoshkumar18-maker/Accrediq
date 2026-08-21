/* AQcredix — local static server.
 *
 * The site has no build step and no dependencies, which is deliberate, but it also means
 * there is nothing to `npm run dev`. Opening a page with file:// is not equivalent: the
 * header and footer are fetched, the film is an iframe, and both are blocked by the
 * file:// origin rules. This serves the repository over http so what you see locally is
 * what Vercel serves.
 *
 *   node build/serve.js [port]
 *
 * It does NOT run the /api functions — those need `vercel dev`. Anything under /api
 * returns 501 rather than a confusing 404, so a failure there is unambiguous.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.argv[2] || 5599);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8"
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.startsWith("/api/")) {
    res.writeHead(501, { "content-type": "text/plain" });
    return res.end("Serverless functions are not run by build/serve.js — use `vercel dev`.");
  }
  if (p.endsWith("/")) p += "index.html";

  /* Resolve, then confirm the result is still inside the repository. Without this a
     request for /../../ walks out of the project and serves anything on the disk. */
  const full = path.resolve(ROOT, "." + p);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    res.writeHead(403); return res.end("forbidden");
  }

  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("404 " + p); }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(full).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(buf);
  });
}).listen(PORT, () => console.log("AQcredix on http://localhost:" + PORT + "/"));
