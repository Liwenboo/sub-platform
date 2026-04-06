import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "../../app/_types/app-types";

export const AUTH_SESSION_COOKIE_NAME = "sp_admin_session";

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEFAULT_VIEWER_ACCESS_MODE: ViewerAccessMode = "authenticated";
const DEFAULT_SESSION_COOKIE_SECURE_MODE: SessionCookieSecureMode = "auto";

type AuthConfigKey =
  | "ADMIN_USERNAME"
  | "ADMIN_PASSWORD"
  | "SESSION_SECRET";

type AuthConfig = {
  adminUsername: string | null;
  adminPassword: string | null;
  sessionSecret: string | null;
};

export type ViewerAccessMode = "anonymous" | "authenticated";
export type SessionCookieSecureMode = "auto" | "true" | "false";

type SessionPayload = {
  role: UserRole;
  iat: number;
  exp: number;
};

type SessionState = {
  authenticated: boolean;
  role: UserRole;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function readEnvValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function getAuthConfig(): AuthConfig {
  return {
    adminUsername: readEnvValue(["ADMIN_USERNAME", "SUB_PLATFORM_ADMIN_USERNAME"]),
    adminPassword: readEnvValue(["ADMIN_PASSWORD", "SUB_PLATFORM_ADMIN_PASSWORD"]),
    sessionSecret: readEnvValue(["SESSION_SECRET", "SUB_PLATFORM_SESSION_SECRET"]),
  };
}

function getMissingAuthConfigKeys(config: AuthConfig): AuthConfigKey[] {
  const missingKeys: AuthConfigKey[] = [];

  if (!config.adminUsername) {
    missingKeys.push("ADMIN_USERNAME");
  }

  if (!config.adminPassword) {
    missingKeys.push("ADMIN_PASSWORD");
  }

  if (!config.sessionSecret) {
    missingKeys.push("SESSION_SECRET");
  }

  return missingKeys;
}

function warnAuthConfigIssuesOnce(): void {
  const globalState = globalThis as typeof globalThis & {
    __subPlatformAuthConfigWarned__?: boolean;
  };

  if (globalState.__subPlatformAuthConfigWarned__) {
    return;
  }

  const missingKeys = getMissingAuthConfigKeys(getAuthConfig());
  if (missingKeys.length === 0) {
    return;
  }

  console.error(
    `[auth] Missing required environment variables: ${missingKeys.join(
      ", "
    )}. Login will be unavailable until configured.`
  );
  globalState.__subPlatformAuthConfigWarned__ = true;
}

export function getAuthConfigIssues(): string[] {
  const missingKeys = getMissingAuthConfigKeys(getAuthConfig());

  if (missingKeys.length > 0) {
    warnAuthConfigIssuesOnce();
  }

  return missingKeys;
}

export function getViewerAccessMode(): ViewerAccessMode {
  const rawMode = readEnvValue([
    "VIEWER_ACCESS_MODE",
    "SUB_PLATFORM_VIEWER_ACCESS_MODE",
  ]);

  if (rawMode === "anonymous" || rawMode === "authenticated") {
    return rawMode;
  }

  return DEFAULT_VIEWER_ACCESS_MODE;
}

export function isViewerAnonymousAccessAllowed(): boolean {
  return getViewerAccessMode() === "anonymous";
}

export function getSessionCookieSecureMode(): SessionCookieSecureMode {
  const rawMode = readEnvValue([
    "SESSION_COOKIE_SECURE",
    "SUB_PLATFORM_SESSION_COOKIE_SECURE",
  ]);

  if (rawMode === "true" || rawMode === "false" || rawMode === "auto") {
    return rawMode;
  }

  return DEFAULT_SESSION_COOKIE_SECURE_MODE;
}

function parseSessionPayload(token: string): SessionPayload | null {
  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const secret = getAuthConfig().sessionSecret;
  if (!secret) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  const providedSignatureBuffer = Buffer.from(providedSignature);

  if (expectedSignatureBuffer.length !== providedSignatureBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(expectedSignatureBuffer, providedSignatureBuffer)) {
    return null;
  }

  const decodedPayload = decodeBase64Url(encodedPayload);

  if (!decodedPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(decodedPayload) as Partial<SessionPayload>;

    if (payload.role !== "admin" && payload.role !== "viewer") {
      return null;
    }

    if (
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.iat) ||
      !Number.isFinite(payload.exp)
    ) {
      return null;
    }

    return {
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function getAdminSessionTtlSeconds(): number {
  const configured = Number(
    readEnvValue(["SESSION_TTL_SECONDS", "SUB_PLATFORM_SESSION_TTL_SECONDS"])
  );

  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }

  return DEFAULT_SESSION_TTL_SECONDS;
}

export function isAuthConfigReady(): boolean {
  return getMissingAuthConfigKeys(getAuthConfig()).length === 0;
}

export function verifyAdminCredentials(
  username: string,
  password: string
): boolean {
  const config = getAuthConfig();
  const expectedUsername = config.adminUsername;
  const expectedPassword = config.adminPassword;

  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  return username === expectedUsername && password === expectedPassword;
}

export function createSessionToken(
  role: UserRole,
  now = Date.now(),
  ttlSeconds = getAdminSessionTtlSeconds()
): string | null {
  const secret = getAuthConfig().sessionSecret;

  if (!secret) {
    return null;
  }

  const iat = Math.floor(now / 1000);
  const exp = iat + Math.max(1, ttlSeconds);
  const payload: SessionPayload = {
    role,
    iat,
    exp,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function createAdminSessionToken(
  now = Date.now(),
  ttlSeconds = getAdminSessionTtlSeconds()
): string | null {
  return createSessionToken("admin", now, ttlSeconds);
}

export function getSessionFromToken(token: string | undefined): SessionState {
  if (!token) {
    return {
      authenticated: false,
      role: "viewer",
    };
  }

  const payload = parseSessionPayload(token);
  if (!payload) {
    return {
      authenticated: false,
      role: "viewer",
    };
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowInSeconds) {
    return {
      authenticated: false,
      role: "viewer",
    };
  }

  return {
    authenticated: true,
    role: payload.role,
  };
}

export function getRoleFromSessionToken(token: string | undefined): UserRole {
  return getSessionFromToken(token).role;
}

function resolveRequestProtocol(request?: Request): "http" | "https" | null {
  if (!request) {
    return null;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  if (forwardedProto) {
    const normalizedProto = forwardedProto.split(",")[0]?.trim().toLowerCase();

    if (normalizedProto === "http" || normalizedProto === "https") {
      return normalizedProto;
    }
  }

  try {
    const protocol = new URL(request.url).protocol.replace(/:$/, "").toLowerCase();

    if (protocol === "http" || protocol === "https") {
      return protocol;
    }
  } catch {
    return null;
  }

  return null;
}

export function shouldUseSecureAuthCookie(request?: Request): boolean {
  const configuredMode = getSessionCookieSecureMode();

  if (configuredMode === "true") {
    return true;
  }

  if (configuredMode === "false") {
    return false;
  }

  const requestProtocol = resolveRequestProtocol(request);

  if (requestProtocol === "https") {
    return true;
  }

  if (requestProtocol === "http") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

export function getAuthSessionCookieOptions(
  request: Request | undefined,
  maxAgeSeconds: number
) {
  const maxAge = Math.max(1, Math.floor(maxAgeSeconds));

  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureAuthCookie(request),
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
  };
}

export function getExpiredAuthSessionCookieOptions(request?: Request) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureAuthCookie(request),
    maxAge: 0,
    expires: new Date(0),
  };
}

// Emit a clear startup/runtime hint when required auth env vars are missing.
void getAuthConfigIssues();
