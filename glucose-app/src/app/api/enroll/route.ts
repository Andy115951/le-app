import { NextResponse } from "next/server";
import { adminCloud, jsonError, requestBody, serverConfig, validFamilyCode, verifyRequest } from "../_lib/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const rejected = verifyRequest(request, "enroll");
  if (rejected) return rejected;
  const config = serverConfig();
  const client = adminCloud();
  if (!client) return jsonError("家庭账号开通尚未配置，请联系维护者。", 503);
  const body = await requestBody(request);
  if (!body || !validFamilyCode(body.code, config.familyCode)) return jsonError("家庭开通码不正确。", 403);
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 8192) return jsonError("请先登录，再开通账号。", 401);
  try {
    const verified = await client.auth.getUser(authorization.slice(7));
    if (verified.error || !verified.data.user) return jsonError("登录已过期，请重新登录。", 401);
    const userId = verified.data.user.id;
    const existing = await client.from("glucose_accounts").select("status").eq("user_id", userId).maybeSingle();
    if (existing.error) return jsonError("无法检查账号准入状态，请稍后重试。", 503);
    if (existing.data?.status === "suspended") return jsonError("此账号的应用访问已停用，请联系维护者。", 403);
    if (!existing.data) {
      const inserted = await client.from("glucose_accounts").upsert({ user_id: userId, status: "active" }, { onConflict: "user_id", ignoreDuplicates: true });
      if (inserted.error) return jsonError("账号开通未完成，请稍后重试。", 503);
      const confirmed = await client.from("glucose_accounts").select("status").eq("user_id", userId).single();
      if (confirmed.error || confirmed.data.status !== "active") return jsonError("账号未获准访问，请联系维护者。", 403);
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("暂时无法连接开通服务，请保留输入并重试。", 503); }
}
