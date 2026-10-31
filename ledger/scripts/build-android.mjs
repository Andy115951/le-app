import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const client = resolve(root, "apps/client");
const env = { ...process.env, NODE_ENV: "production" };
const qa = process.argv.includes("--qa");
if (qa) env.LEDGER_QA = "1";
else delete env.LEDGER_QA;
const applicationId = qa ? "app.local.ledger.qa" : "app.local.ledger";
if (!env.JAVA_HOME && existsSync("/opt/homebrew/opt/openjdk@21"))
  env.JAVA_HOME = "/opt/homebrew/opt/openjdk@21";
if (!env.ANDROID_HOME && process.platform === "darwin")
  env.ANDROID_HOME = resolve(homedir(), "Library/Android/sdk");
if (env.ANDROID_HOME) env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: client,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!process.argv.includes("--skip-prebuild"))
  run(process.platform === "win32" ? "npx.cmd" : "npx", [
    "expo",
    "prebuild",
    "--platform",
    "android",
    "--no-install",
  ]);
const gradle = await readFile(
  resolve(client, "android/app/build.gradle"),
  "utf8",
);
if (
  !gradle.includes(`applicationId '${applicationId}'`) &&
  !gradle.includes(`applicationId "${applicationId}"`)
) {
  throw new Error(
    "Generated Android package does not match this build. Run again without --skip-prebuild.",
  );
}
const architectures = process.env.LEDGER_ANDROID_ARCHS || "arm64-v8a";
run(
  process.platform === "win32" ? "android/gradlew.bat" : "./android/gradlew",
  [
    "-p",
    "android",
    ":app:assembleRelease",
    "--no-daemon",
    "--no-parallel",
    "--max-workers=1",
    "-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m",
    "-Pkotlin.compiler.execution.strategy=in-process",
    `-PreactNativeArchitectures=${architectures}`,
    "--console=plain",
  ],
);
await mkdir(resolve(root, "artifacts"), { recursive: true });
const filename = qa ? "ledger-0.1.0-qa.apk" : "ledger-0.1.0-test.apk";
await copyFile(
  resolve(client, "android/app/build/outputs/apk/release/app-release.apk"),
  resolve(root, "artifacts", filename),
);
console.log(
  `Test APK: ledger/artifacts/${filename} (${applicationId}; development signing only)`,
);
