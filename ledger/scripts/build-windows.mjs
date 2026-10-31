import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const desktop = resolve(root, "apps/desktop");
const target = "x86_64-pc-windows-msvc";
const env = { ...process.env, NODE_ENV: "production" };
const native = process.platform === "win32";
const extraPaths =
  process.platform === "darwin"
    ? [
        "/opt/homebrew/opt/llvm/bin",
        "/opt/homebrew/opt/lld/bin",
        "/usr/local/opt/llvm/bin",
        "/usr/local/opt/lld/bin",
      ].filter(existsSync)
    : [];
const inheritedPath =
  Object.entries(env).find(([key]) => key.toLowerCase() === "path")?.[1] || "";
for (const key of Object.keys(env)) {
  if (key.toLowerCase() === "path") delete env[key];
}
env.PATH = [
  ...extraPaths,
  resolve(homedir(), ".cargo/bin"),
  inheritedPath,
].join(delimiter);
// Compiler/SDK caches and all output stay ignored, outside distributable inputs.
env.CARGO_TARGET_DIR = resolve(root, "apps/desktop/src-tauri/target");
env.XWIN_CACHE_DIR ||= resolve(root, "artifacts/toolchains/xwin");
env.XWIN_ARCH ||= "x86_64";
// Tauri configures its Windows CRT linkage. Do not override its UCRT policy.
// Remap user-specific Rust source paths in distributable binaries.
const buildFlags = [`--remap-path-prefix=${homedir()}=/build`];
if (native) {
  // Windows account directories can contain spaces: keep each flag intact.
  const inheritedFlags =
    env.CARGO_ENCODED_RUSTFLAGS?.split("\x1f") ||
    env.RUSTFLAGS?.trim().split(/\s+/).filter(Boolean) ||
    [];
  env.CARGO_ENCODED_RUSTFLAGS = [...inheritedFlags, ...buildFlags].join("\x1f");
  delete env.RUSTFLAGS;
} else {
  env.RUSTFLAGS = [env.RUSTFLAGS, ...buildFlags].filter(Boolean).join(" ");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: desktop,
    env,
    stdio: "inherit",
    shell: native,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const args = [
  "run",
  "build",
  "-w",
  "@ledger/desktop",
  "--",
  "--target",
  target,
  "--config",
  "src-tauri/tauri.windows.conf.json",
  "--ci",
];
if (!native) args.push("--runner", "cargo-xwin");
run(native ? "npm.cmd" : "npm", args);

const version = JSON.parse(
  await readFile(resolve(desktop, "package.json"), "utf8"),
).version;
const bundle = resolve(env.CARGO_TARGET_DIR, target, "release/bundle/nsis");
const installers = (await readdir(bundle)).filter((name) =>
  name.endsWith(`_${version}_x64-setup.exe`),
);
if (installers.length !== 1)
  throw new Error("Expected exactly one Windows NSIS installer.");
const output = resolve(root, "artifacts/windows");
await mkdir(output, { recursive: true });
const name = `ledger-${version}-windows-x64-setup.exe`;
const destination = resolve(output, name);
await copyFile(resolve(bundle, installers[0]), destination);
const digest = createHash("sha256")
  .update(await readFile(destination))
  .digest("hex");
await writeFile(resolve(output, `${name}.sha256`), `${digest}  ${name}\n`);
console.log(`Windows x64 test installer: artifacts/windows/${name}`);
console.log(`SHA-256: ${digest}`);
