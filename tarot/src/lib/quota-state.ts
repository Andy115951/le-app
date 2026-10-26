type QuotaStatus = {
  loading: boolean;
  error: string | null;
  remaining: { readings: number; messages: number };
};

export const QUOTA_UNAVAILABLE_MESSAGE = "暂时无法读取额度，请稍后重试。";

/** Only a successful quota response can establish exhaustion. */
export function isQuotaExhausted(state: QuotaStatus, bucket: "readings" | "messages", cost = 1) {
  return !state.loading && !state.error && state.remaining[bucket] < cost;
}
