import { NextResponse } from "next/server";
import { adminCloud, jsonError, requestBody, serverConfig, validFamilyCode, verifyRequest } from "../_lib/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const rejected = verifyRequest(request, "register");
  if (rejected) return rejected;
  const config = serverConfig();
  const client = adminCloud();
  if (!client) return jsonError("家庭账号开通尚未配置，请联系维护者。", 503);
  const body = await requestBody(request);
  if (!body || !validFamilyCode(body.code, config.familyCode)) return jsonError("家庭开通码不正确。", 403);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 256)
    return jsonError("请输入有效邮箱，密码至少 10 位且不超过 256 位。");
  let newlyCreatedUserId: string | null = null;
  let admissionComplete = false;
  async function compensate() {
    if (!newlyCreatedUserId || admissionComplete) return;
    const userId = newlyCreatedUserId;
    newlyCreatedUserId = null;
    try {
      const cleanup = await client!.auth.admin.deleteUser(userId);
      if (cleanup.error) console.error("Glucose registration compensation did not complete.");
    } catch { console.error("Glucose registration compensation did not complete."); }
  }
  try {
    // Admin createUser fails for existing email; it cannot grant access to an unverified existing account.
    const created = await client.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) return jsonError("账号无法注册。若邮箱已使用，请先登录再输入家庭码开通。", 400);
    newlyCreatedUserId = created.data.user.id;
    const admitted = await client.from("glucose_accounts").insert({ user_id: newlyCreatedUserId, status: "active" });
    if (admitted.error) {
      // Compensation is restricted to the newly created id returned above.
      await compensate();
      return jsonError("账号开通未完成，请重试；如邮箱已存在，请登录后再次开通。", 503);
    }
    admissionComplete = true;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await compensate();
    return jsonError("暂时无法确认开通结果。请稍后使用同一邮箱登录；若可登录，再输入家庭码开通。", 503);
  }
}
