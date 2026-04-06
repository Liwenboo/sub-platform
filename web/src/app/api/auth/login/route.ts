import { cookies } from "next/headers";
import {
  AUTH_SESSION_COOKIE_NAME,
  createAdminSessionToken,
  getAuthConfigIssues,
  getAdminSessionTtlSeconds,
  getAuthSessionCookieOptions,
  verifyAdminCredentials,
} from "../../../../server/auth/session";
import {
  checkLoginThrottle,
  recordLoginFailure,
  resetLoginFailure,
  resolveClientIp,
} from "../../../../server/auth/login-throttle";
import { errorResponse, parseJsonBody, successResponse } from "../../_lib/mock-api-response";

export const dynamic = "force-dynamic";

type LoginRequestBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = await parseJsonBody<LoginRequestBody>(request);

  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  const authConfigIssues = getAuthConfigIssues();

  if (authConfigIssues.length > 0) {
    return errorResponse(
      500,
      "auth_config_invalid",
      `Authentication config is incomplete. Missing env vars: ${authConfigIssues.join(
        ", "
      )}.`,
      false
    );
  }

  const clientIp = resolveClientIp(request);
  const throttleCheck = checkLoginThrottle(clientIp, username || "unknown");

  if (!throttleCheck.allowed) {
    const response = errorResponse(
      429,
      "too_many_attempts",
      "Too many login attempts. Please retry later."
    );
    response.headers.set("Retry-After", String(throttleCheck.retryAfterSeconds));
    return response;
  }

  if (!username || !password) {
    recordLoginFailure(clientIp, username || "unknown");
    return errorResponse(
      401,
      "invalid_credentials",
      "Invalid username or password."
    );
  }

  if (!verifyAdminCredentials(username, password)) {
    recordLoginFailure(clientIp, username);
    return errorResponse(401, "invalid_credentials", "Invalid username or password.");
  }

  const sessionToken = createAdminSessionToken();
  if (!sessionToken) {
    return errorResponse(
      500,
      "session_create_failed",
      "Failed to create admin session.",
      false
    );
  }

  resetLoginFailure(clientIp, username);

  const cookieStore = await cookies();
  cookieStore.set(
    AUTH_SESSION_COOKIE_NAME,
    sessionToken,
    getAuthSessionCookieOptions(request, getAdminSessionTtlSeconds())
  );

  return successResponse({ role: "admin" as const });
}
