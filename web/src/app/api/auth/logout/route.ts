import { cookies } from "next/headers";
import {
  AUTH_SESSION_COOKIE_NAME,
  getExpiredAuthSessionCookieOptions,
} from "../../../../server/auth/session";
import { successResponse } from "../../_lib/mock-api-response";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(
    AUTH_SESSION_COOKIE_NAME,
    "",
    getExpiredAuthSessionCookieOptions()
  );

  return successResponse({ role: "viewer" as const });
}
