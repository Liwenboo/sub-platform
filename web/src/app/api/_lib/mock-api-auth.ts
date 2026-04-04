import { cookies } from "next/headers";
import type { UserRole } from "../../_types/app-types";
import {
  AUTH_SESSION_COOKIE_NAME,
  getSessionFromToken,
  isViewerAnonymousAccessAllowed,
} from "../../../server/auth/session";
import { errorResponse } from "./mock-api-response";

export async function getRequestRole(): Promise<UserRole> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;

  return getSessionFromToken(sessionToken).role;
}

export async function requireViewerReadAccess(): Promise<Response | null> {
  if (isViewerAnonymousAccessAllowed()) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const session = getSessionFromToken(sessionToken);

  if (session.authenticated) {
    return null;
  }

  return errorResponse(
    401,
    "unauthorized",
    "Authentication is required for viewer access."
  );
}

export async function requireAdminForMutation(): Promise<Response | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const session = getSessionFromToken(sessionToken);

  if (session.authenticated && session.role === "admin") {
    return null;
  }

  if (session.authenticated) {
    return errorResponse(
      403,
      "forbidden",
      "Admin role is required for this operation."
    );
  }

  return errorResponse(
    401,
    "unauthorized",
    "Authentication is required for this operation."
  );
}
