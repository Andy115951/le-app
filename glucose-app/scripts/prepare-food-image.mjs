import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Optimize a built-in imagegen result for the website. This does not call an API.
const root = fileURLToPath(new URL("../", import.meta.url));
const [id, source, promptFile] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]+$/.test(id || "") || !source || !promptFile) {
  throw new Error("Usage: node scripts/prepare-food-image.mjs <food-id> <source.png> <prompt.txt>");
}
const images = path.join(root, "public/images/foods");
const provenance = path.join(root, "assets/food-images");
await mkdir(images, { recursive: true });
await mkdir(provenance, { recursive: true });
const output = path.join(images, `${id}.webp`);
await sharp(source).rotate().resize(640, 640, { fit: "contain", background: "#f4f5ef" }).webp({ quality: 84 }).toFile(output);
await writeFile(path.join(provenance, `${id}.json`), JSON.stringify({
  id,
  image: `/images/foods/${id}.webp`,
  method: "Built-in image_gen tool; resized and compressed locally to WebP",
  generatedAt: new Date().toISOString().slice(0, 10),
  prompt: await readFile(promptFile, "utf8"),
}, null, 2) + "\n");
console.log(`Prepared ${id}.webp`);
