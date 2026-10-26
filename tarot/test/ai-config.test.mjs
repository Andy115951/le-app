import test from "node:test";
import assert from "node:assert/strict";
import { baseUrlFromChatCompletions, getDeepSeekConfig } from "../src/lib/ai/config.ts";

const env = { DEEPSEEK_API_KEY: "synthetic-key-for-config-tests" };

test("default model requests use the public provider endpoint", () => {
  const config = getDeepSeekConfig(env);
  assert.equal(config.configured, true);
  assert.equal(config.chatUrl, "https://api.deepseek.com/chat/completions");
});

test("independent compatible gateways and models are configurable", () => {
  const config = getDeepSeekConfig({ ...env, DEEPSEEK_API_URL: "https://model.example.com/custom/v1/chat/completions", DEEPSEEK_MODEL: "custom-model" });
  assert.equal(config.configured, true);
  assert.equal(config.model, "custom-model");
  assert.equal(config.baseURL, "https://model.example.com/custom/v1");
  assert.equal(baseUrlFromChatCompletions("https://model.example.com/v1/chat/completions/"), "https://model.example.com/v1");
});

test("invalid endpoints never expose credentials in configuration failure results", () => {
  for (const url of ["http://model.example.com/v1", "https://user:secret@model.example.com/v1", "https://model.example.com/v1?key=secret", "https://model.example.com/v1#secret", "invalid"]) {
    const config = getDeepSeekConfig({ ...env, DEEPSEEK_API_URL: url });
    assert.deepEqual(config, { configured: false, reason: "invalid_api_url" });
    assert.ok(!JSON.stringify(config).includes(env.DEEPSEEK_API_KEY));
  }
  assert.deepEqual(getDeepSeekConfig({}), { configured: false, reason: "missing_api_key" });
});
