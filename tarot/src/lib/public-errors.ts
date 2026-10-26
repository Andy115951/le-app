const AUTH_ERRORS = new Set([
  "用户名需为 3–24 位字母数字下划线",
  "密码至少 6 位",
  "用户名已存在",
  "用户名或密码错误",
]);

export function publicAuthError(error: unknown, fallback: string) {
  return error instanceof Error && AUTH_ERRORS.has(error.message) ? error.message : fallback;
}
