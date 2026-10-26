import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { chunkText } from "@/lib/ai/chunk";
import type {
  FollowUpInput,
  InterpretInput,
  StreamOptions,
  TarotAI,
  TokenVerseInput,
} from "@/lib/ai/types";
import {
  followUpMessages,
  followUpSystemPrompt,
  interpretSystemPrompt,
  interpretUserPrompt,
  tokenVerseSystemPrompt,
  tokenVerseUserPrompt,
} from "@/lib/ai/prompts";

import { getDeepSeekConfig } from "./config";
export { baseUrlFromChatCompletions, getDeepSeekConfig } from "./config";

function getClient() {
  const cfg = getDeepSeekConfig();
  if (!cfg.configured) {
    throw new Error(`DeepSeek not configured: ${cfg.reason}`);
  }
  const openai = createOpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    name: "deepseek",
    // deepseek-v4-flash may spend completion budget on reasoning; stock disables it.
    fetch: async (input, init) => {
      if (init?.body && typeof init.body === "string") {
        try {
          const parsed = JSON.parse(init.body) as Record<string, unknown>;
          if (parsed.thinking == null) {
            parsed.thinking = { type: "disabled" };
            init = { ...init, body: JSON.stringify(parsed) };
          }
        } catch {
          /* leave body unchanged */
        }
      }
      return globalThis.fetch(input, init);
    },
  });
  return { model: openai.chat(cfg.model), cfg };
}

export const deepseekAI: TarotAI = {
  async interpret(input: InterpretInput) {
    const { model } = getClient();
    const { text } = await generateText({
      model,
      system: interpretSystemPrompt(input),
      prompt: interpretUserPrompt(input),
    });
    return text.trim();
  },
  async followUp(input: FollowUpInput) {
    const { model } = getClient();
    const { text } = await generateText({
      model,
      system: followUpSystemPrompt(input),
      messages: followUpMessages(input),
    });
    return text.trim();
  },
  async tokenVerse(input: TokenVerseInput) {
    const { model } = getClient();
    const { text } = await generateText({
      model,
      system: tokenVerseSystemPrompt(),
      prompt: tokenVerseUserPrompt(input),
    });
    return text.trim().replace(/^["「『]|["」』]$/g, "").trim();
  },
  async *interpretStream(input: InterpretInput, options?: StreamOptions) {
    if (options?.instant) {
      const text = await this.interpret(input);
      yield* chunkText(text, options);
      return;
    }
    const { model } = getClient();
    const result = streamText({
      model,
      system: interpretSystemPrompt(input),
      prompt: interpretUserPrompt(input),
    });
    for await (const delta of result.textStream) {
      if (delta) yield delta;
    }
  },
  async *followUpStream(input: FollowUpInput, options?: StreamOptions) {
    if (options?.instant) {
      const text = await this.followUp(input);
      yield* chunkText(text, options);
      return;
    }
    const { model } = getClient();
    const result = streamText({
      model,
      system: followUpSystemPrompt(input),
      messages: followUpMessages(input),
    });
    for await (const delta of result.textStream) {
      if (delta) yield delta;
    }
  },
};
