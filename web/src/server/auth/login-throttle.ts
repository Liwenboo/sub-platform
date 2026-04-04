type ThrottlePolicy = {
  maxFailures: number;
  windowMs: number;
  blockMs: number;
};

type ThrottleEntry = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
};

type CheckResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function getNumericEnvValue(keys: string[], fallback: number): number {
  for (const key of keys) {
    const rawValue = process.env[key]?.trim();
    if (!rawValue) {
      continue;
    }

    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return fallback;
}

function getThrottlePolicy(): ThrottlePolicy {
  return {
    maxFailures: getNumericEnvValue(
      ["AUTH_MAX_FAILURES", "SUB_PLATFORM_AUTH_MAX_FAILURES"],
      5
    ),
    windowMs: getNumericEnvValue(
      ["AUTH_WINDOW_SECONDS", "SUB_PLATFORM_AUTH_WINDOW_SECONDS"],
      300
    ) * 1000,
    blockMs: getNumericEnvValue(
      ["AUTH_BLOCK_SECONDS", "SUB_PLATFORM_AUTH_BLOCK_SECONDS"],
      300
    ) * 1000,
  };
}

function getThrottleStore(): Map<string, ThrottleEntry> {
  const globalState = globalThis as typeof globalThis & {
    __subPlatformLoginThrottleStore__?: Map<string, ThrottleEntry>;
  };

  if (!globalState.__subPlatformLoginThrottleStore__) {
    globalState.__subPlatformLoginThrottleStore__ = new Map<string, ThrottleEntry>();
  }

  return globalState.__subPlatformLoginThrottleStore__;
}

function getClientKey(ip: string, username: string): string {
  return `${ip}::${username.toLowerCase()}`;
}

export function resolveClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function checkLoginThrottle(ip: string, username: string): CheckResult {
  const store = getThrottleStore();
  const policy = getThrottlePolicy();
  const now = Date.now();
  const key = getClientKey(ip, username);
  const entry = store.get(key);

  if (!entry) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (entry.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)),
    };
  }

  if (now - entry.windowStartedAt > policy.windowMs) {
    store.delete(key);
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function recordLoginFailure(ip: string, username: string): void {
  const store = getThrottleStore();
  const policy = getThrottlePolicy();
  const now = Date.now();
  const key = getClientKey(ip, username);
  const currentEntry = store.get(key);

  if (!currentEntry || now - currentEntry.windowStartedAt > policy.windowMs) {
    store.set(key, {
      failures: 1,
      windowStartedAt: now,
      blockedUntil: 0,
    });
    return;
  }

  currentEntry.failures += 1;

  if (currentEntry.failures >= policy.maxFailures) {
    currentEntry.blockedUntil = now + policy.blockMs;
  }

  store.set(key, currentEntry);
}

export function resetLoginFailure(ip: string, username: string): void {
  const store = getThrottleStore();
  const key = getClientKey(ip, username);
  store.delete(key);
}
