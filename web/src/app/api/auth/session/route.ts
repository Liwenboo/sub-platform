import { cookies } from "next/headers";
import { successResponse } from "../../_lib/mock-api-response";
import {
  getAuthConfigIssues,
  AUTH_SESSION_COOKIE_NAME,
  getSessionFromToken,
  getViewerAccessMode,
} from "../../../../server/auth/session";
import { createAdminSubscriptionToken } from "../../../output/_lib/output-source-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const session = getSessionFromToken(sessionToken);
  const authConfigIssues = getAuthConfigIssues();
  const viewerAccessMode = getViewerAccessMode();
  const adminSubscriptionToken =
    session.authenticated && session.role === "admin"
      ? createAdminSubscriptionToken()
      : null;

  return successResponse({
    authenticated: session.authenticated,
    role: session.role,
    adminSubscriptionToken,
    viewerAccessMode,
    anonymousViewerAllowed: viewerAccessMode === "anonymous",
    authConfigReady: authConfigIssues.length === 0,
    authConfigIssues,
  });
}
