import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4175);
const root = process.cwd();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function resolveFile(urlPath) {
  const cleanPath = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  const safePath = normalize(cleanPath).replace(/^[/\\]+/, "").replace(/^(\.\.[/\\])+/, "");
  const target = join(root, safePath === "" ? "index.html" : safePath);
  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  return join(root, "index.html");
}

createServer((request, response) => {
  const file = resolveFile(request.url || "/");
  if (!file) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  response.writeHead(200, {
    "Content-Type": types[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`Cricket Crew Toss running at http://localhost:${port}`);
});
