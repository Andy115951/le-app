"use client";

import { useQuota } from "@/hooks/use-quota";
import { GuestLoginCta } from "@/components/quota/guest-login-cta";

/**
 * P45 — soft home nudge when guest readings are exhausted.
 * Avoids competing with first-visit guide while quota is still unused.
 */
export function GuestQuotaNudge() {
  const { user, remaining, loading, oauth, error, refresh } = useQuota();

  if (loading) return null;
  if (error) return (
    <p className="text-center text-sm text-muted-foreground" role="status">
      额度服务暂不可用，请稍后重试。{" "}
      <button type="button" className="underline" onClick={() => void refresh()}>重试额度</button>
    </p>
  );
  if (user) return null;
  if (remaining.readings > 0) return null;

  return (
    <div className="mx-auto max-w-md pt-1">
      <GuestLoginCta
        nextPath="/"
        githubEnabled={oauth.github}
        tip="今日访客起卦烛火已用尽。轻轻登录，明天额度更宽，历史也会并入账号。"
        compact
      />
    </div>
  );
}
