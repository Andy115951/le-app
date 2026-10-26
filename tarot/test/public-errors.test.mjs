import test from "node:test";
import assert from "node:assert/strict";
import { publicAuthError } from "../src/lib/public-errors.ts";
import { ndjsonStreamResponse } from "../src/lib/ai/ndjson-stream.ts";

test("only known user-facing authentication errors pass through", () => {
  assert.equal(publicAuthError(new Error("用户名或密码错误"), "登录失败"), "用户名或密码错误");
  assert.equal(publicAuthError(new Error("Authorization: Bearer synthetic-private-key"), "登录失败"), "登录失败");
  assert.equal(publicAuthError({ message: "用户名已存在" }, "注册失败"), "注册失败");
});
test("stream errors never return upstream headers, keys, or request bodies", async () => {
  const response = ndjsonStreamResponse(async write => {
    write({ t: "delta", c: "合成文本" });
    throw new Error("Authorization: Bearer synthetic-private-key; private-question");
  });
  const events = (await response.text()).trim().split("\n").map(JSON.parse);
  assert.deepEqual(events, [{ t: "delta", c: "合成文本" }, { t: "error", error: "生成暂时失败，请稍后重试。" }]);
});
