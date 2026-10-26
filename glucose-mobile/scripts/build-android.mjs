import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const env = { ...process.env, NODE_ENV: "production" };
if (!env.JAVA_HOME && existsSync("/opt/homebrew/opt/openjdk@21")) env.JAVA_HOME = "/opt/homebrew/opt/openjdk@21";
if (!env.ANDROID_HOME && process.platform === "darwin") env.ANDROID_HOME = resolve(homedir(), "Library/Android/sdk");
if (env.ANDROID_HOME) env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const resume = process.argv.includes("--skip-prebuild");
if (resume && !existsSync(resolve(root, "android/gradlew"))) throw new Error("No generated Android project to resume. Run without --skip-prebuild first.");
if (!resume) run(process.platform === "win32" ? "npx.cmd" : "npx", ["expo", "prebuild", "--platform", "android", "--no-install"]);
run(process.platform === "win32" ? "android/gradlew.bat" : "./android/gradlew", ["-p", "android", ":app:assembleRelease", "--no-daemon", "--no-parallel", "--max-workers=1", "-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m", "-Pkotlin.compiler.execution.strategy=in-process", "-PreactNativeArchitectures=arm64-v8a", "--console=plain"]);
const { expo } = JSON.parse(await readFile(resolve(root, "app.json"), "utf8"));
const name = `sugarnotes-${expo.version}-arm64-test.apk`;
const target = resolve(root, "artifacts", name);
await mkdir(resolve(root, "artifacts"), { recursive: true });
await copyFile(resolve(root, "android/app/build/outputs/apk/release/app-release.apk"), target);
const digest = createHash("sha256").update(await readFile(target)).digest("hex");
await writeFile(`${target}.sha256`, `${digest}  ${name}\n`);
console.log(`Internal test APK: ${target}\nUses the generated development signing key; configure production signing before distribution.`);
