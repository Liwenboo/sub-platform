import type { UserRole } from "../_types/app-types";

const SENSITIVE_QUERY_KEYS = ["token", "key", "secret", "auth", "signature", "sig"];

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export function canManageSources(role: UserRole): boolean {
  return isAdminRole(role);
}

export function canManageOutputsPublish(role: UserRole): boolean {
  return isAdminRole(role);
}

export function canManageSettings(role: UserRole): boolean {
  return isAdminRole(role);
}

export function shouldShowSettingsNav(role: UserRole): boolean {
  return isAdminRole(role);
}

export function shouldShowSourcesNav(role: UserRole): boolean {
  return isAdminRole(role);
}

export function shouldShowSourceInternalColumns(role: UserRole): boolean {
  return isAdminRole(role);
}

export function isNavItemVisible(role: UserRole, href: string): boolean {
  if (!isAdminRole(role)) {
    return href === "/";
  }

  if (href === "/sources") {
    return shouldShowSourcesNav(role);
  }

  if (href === "/settings") {
    return shouldShowSettingsNav(role);
  }

  return true;
}

function maskMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail) {
    return "***";
  }

  return `${value.slice(0, head)}***${value.slice(-tail)}`;
}

export function maskSubscriptionUrl(url: string, role: UserRole): string {
  if (isAdminRole(role)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/...`;
  } catch {
    return maskMiddle(url, 8, 4);
  }
}

export function maskServiceUrl(url: string, role: UserRole): string {
  if (isAdminRole(role)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/***`;
  } catch {
    return maskMiddle(url, 8, 4);
  }
}

export function maskApiPath(path: string, role: UserRole): string {
  if (isAdminRole(role)) {
    return path;
  }

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "/***";
  }

  return `/${segments[0]}/...`;
}

export function maskSensitiveParamsInUrl(url: string, role: UserRole): string {
  if (isAdminRole(role)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.includes(key.toLowerCase())) {
        parsed.searchParams.set(key, "***");
      }
    }
    return parsed.toString();
  } catch {
    return url.replace(
      /([?&](?:token|key|secret|auth|signature|sig)=)[^&]*/gi,
      "$1***"
    );
  }
}
