import { NextResponse } from "next/server";
import { serverConfig } from "../_lib/server";

export const dynamic = "force-dynamic";
export function GET() {
  const config = serverConfig();
  return NextResponse.json({
    configured: config.configured,
    registrationAvailable: config.configured && !!config.serviceRoleKey && !!config.familyCode,
    url: config.configured ? config.url : null,
    anonKey: config.configured ? config.anonKey : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
