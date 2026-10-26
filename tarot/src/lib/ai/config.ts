/** Public defaults; deployments can select their own compatible provider. */
const DEFAULT_CHAT_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";

function normalizeChatUrl(value: string | undefined): string | null {
  const candidate = String(value || DEFAULT_CHAT_URL).trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.hostname) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Derive OpenAI SDK baseURL from a full chat-completions URL (stock style). */
export function baseUrlFromChatCompletions(chatUrl: string): string {
  const u = new URL(chatUrl);
  let path = u.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) {
    path = path.slice(0, -"/chat/completions".length) || "";
  }
  u.pathname = path;
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/+$/, "");
}

export function getDeepSeekConfig(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = String(env.DEEPSEEK_API_KEY || "").trim();
  const model = String(env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim();
  const chatUrl = normalizeChatUrl(env.DEEPSEEK_API_URL);
  if (apiKey.length < 16) return { configured: false as const, reason: "missing_api_key" };
  if (!model) return { configured: false as const, reason: "missing_model" };
  if (!chatUrl) return { configured: false as const, reason: "invalid_api_url" };
  return {
    configured: true as const,
    apiKey,
    model: model.slice(0, 100),
    chatUrl,
    baseURL: baseUrlFromChatCompletions(chatUrl),
  };
}
