import { NextResponse } from "next/server";
import {
  CUSTOM_SCENE,
  SCENES,
  type DetailLevel,
  type RitualSpeed,
  type SceneId,
  type SpreadType,
} from "@/data/scenes";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import {
  QUOTAS,
  createReading,
  getUsage,
  listReadings,
} from "@/lib/store/readings";
import { isReadingId } from "@/lib/reading-id";
import { isManualDrawConflict } from "@/lib/manual-draw";

export async function GET() {
  const user = await getCurrentUser();
  const anon = await ensureAnonymousId();
  const readings = await listReadings({
    userId: user?.id,
    anonymousId: user ? null : anon,
  });
  return NextResponse.json(
    { readings },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "无效请求" }, { status: 400 });
    }
    const user = await getCurrentUser();
    const anon = await ensureAnonymousId();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: "无效请求" }, { status: 400 });
    const requestId = req.headers.get("Idempotency-Key");
    if (requestId && !isReadingId(requestId))
      return NextResponse.json({ error: "无效请求" }, { status: 400 });
    const question = String(body.question || "").trim();
    if (question.length < 4 || question.length > 200) {
      return NextResponse.json(
        { error: "问题长度需在 4–200 字" },
        { status: 400 },
      );
    }
    const scene = (body.scene || "custom") as SceneId;
    const known = [...SCENES, CUSTOM_SCENE].some((s) => s.id === scene);
    if (!known)
      return NextResponse.json({ error: "未知场景" }, { status: 400 });
    const allowedSpreads: SpreadType[] = [
      "three_card",
      "single",
      "five_cross",
      "relation_dual",
      "choice_fork",
      "moon_triad",
      "celtic_cross",
    ];
    const rawSpread = (body.spreadType || "three_card") as SpreadType;
    if (!allowedSpreads.includes(rawSpread)) {
      return NextResponse.json({ error: "未知牌阵" }, { status: 400 });
    }
    const spreadType = rawSpread;
    const detailLevel = (body.detailLevel || "brief") as DetailLevel;
    const ritualSpeed = (body.ritualSpeed || "normal") as RitualSpeed;
    if (
      !["brief", "detailed"].includes(detailLevel) ||
      !["slow", "normal", "fast"].includes(ritualSpeed)
    )
      return NextResponse.json({ error: "未知起卦选项" }, { status: 400 });
    const silentReveal = Boolean(body.silentReveal);
    let reading;
    try {
      reading = await createReading({
        requestId: requestId ?? undefined,
        userId: user?.id ?? null,
        anonymousId: anon,
        question,
        scene,
        spreadType,
        detailLevel,
        ritualSpeed,
        silentReveal,
      });
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "message" in e &&
        e.message === "reading_quota"
      ) {
        const usage = await getUsage(user ? `user:${user.id}` : `anon:${anon}`);
        return NextResponse.json(
          {
            error: user
              ? "今日新占卜额度已用尽，明天再来点亮一盏吧。"
              : "访客今日起卦的烛火已用尽。登录后可以继续点亮。",
            code: "quota",
            usage,
            quota: user ? QUOTAS.user : QUOTAS.guest,
          },
          { status: 429 },
        );
      }
      if (isManualDrawConflict(e))
        return NextResponse.json(
          { error: "这次起卦请求已使用，请返回历史继续原来的记录。" },
          { status: 409 },
        );
      throw e;
    }
    return NextResponse.json(
      { reading },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "创建失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
