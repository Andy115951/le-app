import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(
  fileURLToPath(new URL("../apps/ui-qa/dist/", import.meta.url)),
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    let filename = resolve(root, "." + pathname);
    if (filename !== root && !filename.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(filename)).isDirectory())
      filename = resolve(filename, "index.html");
    const contents = await readFile(filename);
    response.writeHead(200, {
      "Content-Type": types[extname(filename)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
server.listen(4188, "127.0.0.1", () =>
  console.log("Read-only synthetic UI QA: http://127.0.0.1:4188"),
);
