import { deepseekAI, getDeepSeekConfig } from "../src/lib/ai/deepseek";

if (!process.argv.includes("--run-live")) {
  console.error("Pass --run-live to send the synthetic prompt to the configured model provider.");
  process.exit(1);
}

const cfg = getDeepSeekConfig();
if (!cfg.configured) {
  console.error("Model configuration is incomplete:", cfg.reason);
  process.exit(1);
}
console.log("Running a live model smoke check with synthetic input.");

const input: import("../src/lib/ai/types").InterpretInput = {
  question: "最近工作压力大，怎么调整心态？",
  scene: "career" as const,
  detailLevel: "brief" as const,
  spreadResult: {
    spread: "three_card",
    cards: [
      { position: "past", cardId: "major_09", reversed: false, positionLabel: "过去" },
      { position: "present", cardId: "major_17", reversed: false, positionLabel: "现在" },
      { position: "future", cardId: "major_07", reversed: true, positionLabel: "建议" },
    ],
  },
};

let chunks = 0;
let chars = 0;
try {
  for await (const part of deepseekAI.interpretStream(input)) {
    chunks += 1;
    chars += part.length;
  }
} catch {
  console.error("Live model check failed. Provider error details are not printed.");
  process.exit(2);
}
console.log(JSON.stringify({ chunks, chars }));
if (chars < 20) process.exit(2);
