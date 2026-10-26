import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
const root = resolve(new URL("../dist", import.meta.url).pathname);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    if (url.pathname === "/_preview") {
      response.writeHead(200, { "Content-Type": mime[".html"], "Cache-Control": "no-store" });
      response.end(await readFile(new URL("./preview-frame.html", import.meta.url)));
      return;
    }
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    const isFile = await stat(path).then(entry => entry.isFile()).catch(() => false);
    const chosen = isFile ? path : !extname(path) ? resolve(root, "index.html") : null;
    if (!chosen) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "Content-Type": mime[extname(chosen)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(await readFile(chosen));
  } catch { response.writeHead(500); response.end("Preview unavailable"); }
}).listen(8089, "127.0.0.1", () => console.log("Sugar Notes Web preview: http://localhost:8089"));
