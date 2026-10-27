import { NextResponse } from "next/server";
import { ensureAnonymousId, getCurrentUser } from "@/lib/auth/session";
import { parseDrawAction } from "@/lib/manual-draw";
import { isReadingId } from "@/lib/reading-id";
import {
  applyManualDraw,
  canAccessReading,
  getReading,
} from "@/lib/store/readings";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const respond = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  const { id } = await ctx.params;
  if (!isReadingId(id)) return respond({ error: "未找到" }, 404);
  try {
    const user = await getCurrentUser();
    const anon = await ensureAnonymousId();
    const reading = await getReading(id);
    if (!reading || !(await canAccessReading(reading, user?.id ?? null, anon)))
      return respond({ error: "未找到" }, 404);
    const raw = await req.text();
    if (raw.length > 4096) return respond({ error: "无效的选牌操作" }, 400);
    const action = parseDrawAction(JSON.parse(raw));
    if (!action) return respond({ error: "无效的选牌操作" }, 400);
    const updated = await applyManualDraw(
      id,
      { userId: user?.id ?? null, anonymousId: user ? null : anon },
      action,
    );
    return respond({ reading: updated });
  } catch (e) {
    if (e instanceof SyntaxError)
      return respond({ error: "无效的选牌操作" }, 400);
    const code = e && typeof e === "object" && "code" in e ? e.code : null;
    if (code === "P0002") return respond({ error: "未找到" }, 404);
    if (code === "40001")
      return respond(
        {
          error: "另一页更新了本局，已为你保留最新进度。",
          code: "draw_conflict",
        },
        409,
      );
    if (code === "22023")
      return respond({ error: "选牌状态已变化，请刷新后继续。" }, 400);
    return respond(
      { error: "这次操作没能保存，请重试。不会重新洗牌或额外扣除额度。" },
      500,
    );
  }
}
