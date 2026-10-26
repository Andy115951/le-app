import { NextResponse } from "next/server";
import {
  isGithubOAuthConfigured,
  isGoogleOAuthConfigured,
} from "@/lib/auth/oauth";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { QUOTAS, getUsage } from "@/lib/store/readings";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const anon = await ensureAnonymousId();
    const subject = user ? `user:${user.id}` : `anon:${anon}`;
    const usage = await getUsage(subject);
    const quota = user ? QUOTAS.user : QUOTAS.guest;
    return NextResponse.json({
      user,
      anonymousId: anon,
      usage,
      quota,
      oauth: {
        github: isGithubOAuthConfigured(),
        google: isGoogleOAuthConfigured(),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "额度暂不可用，请稍后重试。" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
