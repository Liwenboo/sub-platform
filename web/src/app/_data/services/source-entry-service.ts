import type {
  SourceItem,
  SourceProtocol,
  SourceType,
} from "../../_types/app-types";

export type ParsedSourceInput = {
  sourceType: SourceType;
  sourceProtocol: SourceProtocol;
  url: string;
  content: string | null;
};

const RAW_PROTOCOLS = new Set<SourceProtocol>([
  "vmess",
  "vless",
  "trojan",
  "ss",
  "socks",
]);

function normalizeProtocolFromScheme(scheme: string): SourceProtocol | null {
  const normalizedScheme = scheme.trim().toLowerCase();

  if (normalizedScheme === "http" || normalizedScheme === "https") {
    return normalizedScheme;
  }

  if (
    normalizedScheme === "vmess" ||
    normalizedScheme === "vless" ||
    normalizedScheme === "trojan" ||
    normalizedScheme === "ss"
  ) {
    return normalizedScheme;
  }

  if (normalizedScheme === "socks" || normalizedScheme === "socks5") {
    return "socks";
  }

  return null;
}

function extractScheme(value: string): string | null {
  const matched = value.trim().match(/^([a-zA-Z][\w+.-]*):\/\//);
  return matched?.[1] ?? null;
}

export function isHttpSubscriptionUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveSourceProtocol(value: string): SourceProtocol | null {
  const lines = value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const protocols = new Set<SourceProtocol>();

  for (const line of lines) {
    const scheme = extractScheme(line);
    if (!scheme) {
      return null;
    }

    const protocol = normalizeProtocolFromScheme(scheme);
    if (!protocol) {
      return null;
    }

    protocols.add(protocol);
  }

  if (protocols.size === 1) {
    return [...protocols][0] ?? null;
  }

  const hasRemoteProtocol = [...protocols].some(
    (protocol) => protocol === "http" || protocol === "https"
  );
  const hasRawProtocol = [...protocols].some((protocol) => RAW_PROTOCOLS.has(protocol));

  if (hasRemoteProtocol && !hasRawProtocol && protocols.size <= 2) {
    return protocols.has("https") ? "https" : "http";
  }

  return "mixed";
}

export function parseSourceInput(value: string): ParsedSourceInput | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const sourceProtocol = resolveSourceProtocol(trimmed);
  if (!sourceProtocol) {
    return null;
  }

  if (sourceProtocol === "http" || sourceProtocol === "https") {
    return {
      sourceType: "remote",
      sourceProtocol,
      url: trimmed,
      content: null,
    };
  }

  return {
    sourceType: "raw",
    sourceProtocol,
    url: trimmed,
    content: trimmed,
  };
}

export function getSourceProtocolLabel(protocol: SourceProtocol): string {
  switch (protocol) {
    case "http":
      return "HTTP";
    case "https":
      return "HTTPS";
    case "vmess":
      return "VMess";
    case "vless":
      return "VLESS";
    case "trojan":
      return "Trojan";
    case "ss":
      return "Shadowsocks";
    case "socks":
      return "SOCKS";
    case "mixed":
      return "Mixed";
    default:
      return "Unknown";
  }
}

export function getSourceTypeLabel(sourceType: SourceType): string {
  return sourceType === "remote" ? "远程订阅源" : "原始节点";
}

export function getSourceDisplayValue(
  source: Pick<SourceItem, "sourceType" | "url" | "content">
): string {
  if (source.sourceType === "raw") {
    return source.content?.trim() || source.url.trim();
  }

  return source.url.trim();
}
