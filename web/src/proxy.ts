import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUTH_SESSION_COOKIE_NAME,
  getSessionFromToken,
  isViewerAnonymousAccessAllowed,
} from "./server/auth/session";

const ADMIN_PAGE_PREFIXES = ["/sources", "/settings"];
const VIEWER_PAGE_PREFIXES = ["/", "/outputs"];
const ADMIN_MUTATION_EXACT_PATHS = new Set([
  "/api/outputs/config",
  "/api/settings",
  "/api/settings/reset",
  "/api/app-data/reset",
  "/api/role",
]);
const ADMIN_MUTATION_PREFIX_PATHS = ["/api/sources"];
const VIEWER_READ_API_EXACT_PATHS = new Set([
  "/api/app-data",
  "/api/sources",
  "/api/outputs/config",
  "/api/settings",
  "/api/role",
]);

function isAdminPage(pathname: string): boolean {
  return ADMIN_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isViewerPage(pathname: string): boolean {
  return VIEWER_PAGE_PREFIXES.some((prefix) => {
    if (prefix === "/") {
      return pathname === "/";
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

function isAdminMutationApi(pathname: string, method: string): boolean {
  const normalizedMethod = method.toUpperCase();

  if (
    normalizedMethod === "GET" ||
    normalizedMethod === "HEAD" ||
    normalizedMethod === "OPTIONS"
  ) {
    return false;
  }

  if (ADMIN_MUTATION_EXACT_PATHS.has(pathname)) {
    return true;
  }

  return ADMIN_MUTATION_PREFIX_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isViewerReadApi(pathname: string, method: string): boolean {
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD") {
    return false;
  }

  return VIEWER_READ_API_EXACT_PATHS.has(pathname);
}

function buildAuthFailureResponse(status: 401 | 403): NextResponse {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: status === 401 ? "unauthorized" : "forbidden",
        message:
          status === 401
            ? "Authentication is required for this operation."
            : "Admin role is required for this operation.",
        recoverable: true,
      },
    },
    { status }
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const anonymousViewerAllowed = isViewerAnonymousAccessAllowed();
  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const session = getSessionFromToken(sessionToken);
  const isAdmin = session.authenticated && session.role === "admin";
  const isAuthenticated = session.authenticated;
  const isAuthApi = pathname.startsWith("/api/auth");

  if (isAdminMutationApi(pathname, request.method) && !isAdmin) {
    return buildAuthFailureResponse(isAuthenticated ? 403 : 401);
  }

  if (
    !isAuthApi &&
    isViewerReadApi(pathname, request.method) &&
    !anonymousViewerAllowed &&
    !isAuthenticated
  ) {
    return buildAuthFailureResponse(401);
  }

  if (isAdminPage(pathname) && !isAdmin) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);

    return NextResponse.redirect(loginUrl);
  }

  if (isViewerPage(pathname) && !anonymousViewerAllowed && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
