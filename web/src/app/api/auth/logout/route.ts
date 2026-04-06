import { cookies } from "next/headers";
import {
  AUTH_SESSION_COOKIE_NAME,
  getExpiredAuthSessionCookieOptions,
} from "../../../../server/auth/session";
import { successResponse } from "../../_lib/mock-api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set(
    AUTH_SESSION_COOKIE_NAME,
    "",
    getExpiredAuthSessionCookieOptions(request)
  );

  return successResponse({ role: "viewer" as const });
}
