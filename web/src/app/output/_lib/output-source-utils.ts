import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getSourceDisplayValue,
  parseSourceInput,
} from "../../_data/services/source-entry-service";
import type { SourceItem } from "../../_types/app-types";

const RAW_SOURCE_SIGNATURE_TTL_SECONDS = 60 * 5;

function readEnvValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function getRawSourceSignatureSecret(): string | null {
  return readEnvValue(["SESSION_SECRET", "SUB_PLATFORM_SESSION_SECRET"]);
}

function signRawSourcePayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function buildRawSourcePayload(sourceParam: string, issuedAtSeconds: number): string {
  return `${sourceParam}\n${issuedAtSeconds}`;
}

export function getRequestOrigin(): string {
  const configuredOrigin =
    readEnvValue([
      "INTERNAL_APP_ORIGIN",
      "SUB_PLATFORM_INTERNAL_APP_ORIGIN",
    ]) ??
    readEnvValue(["APP_INTERNAL_ORIGIN", "SUB_PLATFORM_APP_INTERNAL_ORIGIN"]);

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  const internalPort = readEnvValue(["PORT", "SUB_PLATFORM_PORT"]) ?? "3000";
  return `http://127.0.0.1:${internalPort}`;
}

export function getPublicRequestOrigin(request: Request): string {
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();

  if (
    forwardedHost &&
    (forwardedProto === "http" || forwardedProto === "https")
  ) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host")?.trim();
  if (host) {
    try {
      const parsed = new URL(request.url);
      const protocol = parsed.protocol.replace(/:$/, "").toLowerCase();
      if (protocol === "http" || protocol === "https") {
        return `${protocol}://${host}`;
      }
    } catch {
      // Fall back to request URL origin below.
    }
  }

  return new URL(request.url).origin;
}

export function createRawSourceAccessSignature(
  sourceParam: string,
  issuedAtSeconds: number
): string | null {
  const secret = getRawSourceSignatureSecret();
  if (!secret) {
    return null;
  }

  return signRawSourcePayload(
    buildRawSourcePayload(sourceParam, issuedAtSeconds),
    secret
  );
}

export function isRawSourceAccessSignatureValid(
  sourceParam: string,
  issuedAtSeconds: number,
  providedSignature: string | null
): boolean {
  if (!providedSignature) {
    return false;
  }

  const secret = getRawSourceSignatureSecret();
  if (!secret) {
    return false;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(issuedAtSeconds) ||
    Math.abs(nowInSeconds - issuedAtSeconds) > RAW_SOURCE_SIGNATURE_TTL_SECONDS
  ) {
    return false;
  }

  const expectedSignature = signRawSourcePayload(
    buildRawSourcePayload(sourceParam, issuedAtSeconds),
    secret
  );
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  const providedSignatureBuffer = Buffer.from(providedSignature);

  if (expectedSignatureBuffer.length !== providedSignatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedSignatureBuffer, providedSignatureBuffer);
}

export function resolveSelectedSources(sourceParam: string, sources: SourceItem[]) {
  const selectedIds = sourceParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value !== "none");

  if (selectedIds.length === 0) {
    return {
      ok: false as const,
      missingIds: [] as string[],
      sources: [] as SourceItem[],
    };
  }

  const selectedSources = selectedIds
    .map((id) => sources.find((source) => source.id === id) ?? null)
    .filter((source): source is SourceItem => source !== null);

  const missingIds = selectedIds.filter(
    (id) => !selectedSources.some((source) => source.id === id)
  );

  if (missingIds.length > 0) {
    return {
      ok: false as const,
      missingIds,
      sources: [] as SourceItem[],
    };
  }

  return {
    ok: true as const,
    missingIds: [] as string[],
    sources: selectedSources,
  };
}

export function collectValidRawSourceEntries(sources: SourceItem[]) {
  const entries: string[] = [];
  let skippedCount = 0;

  for (const source of sources) {
    const rawValue = getSourceDisplayValue(source);
    const lines = rawValue
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const parsed = parseSourceInput(line);
      if (!parsed || parsed.sourceType !== "raw") {
        skippedCount += 1;
        console.warn(
          `[output] Skipped invalid raw node line from source "${source.id}" (${source.name}).`
        );
        continue;
      }

      entries.push(line);
    }
  }

  return {
    entries: Array.from(new Set(entries)),
    skippedCount,
  };
}
