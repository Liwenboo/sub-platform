import { cookies } from "next/headers";
import {
  getSourceDisplayValue,
  parseSourceInput,
} from "../_data/services/source-entry-service";
import {
  AUTH_SESSION_COOKIE_NAME,
  getSessionFromToken,
  isViewerAnonymousAccessAllowed,
} from "../../server/auth/session";
import type { OutputFormatId, SourceItem } from "../_types/app-types";
import { getPublishedSources } from "../_data/services/app-data-service";
import {
  collectValidRawSourceEntries,
  createAdminSubscriptionToken,
  createRawSourceAccessSignature,
  getRequestOrigin,
  isAdminSubscriptionTokenValid,
  resolveSelectedSources,
} from "./_lib/output-source-utils";
import { readStoredAppDataState } from "../../server/mock-data/app-data-storage";

export const dynamic = "force-dynamic";

const OUTPUT_FORMAT_TARGET_MAP: Record<OutputFormatId, string> = {
  clash: "clash",
  "clash-meta": "clash",
  v2ray: "v2ray",
  "sing-box": "singbox",
};

const RAW_BYPASS_FORMATS = new Set<OutputFormatId>(["v2ray"]);

const FORWARDED_QUERY_KEYS = new Set([
  "emoji",
  "udp",
  "tfo",
]);

function maskSensitiveValueForLog(input: string): string {
  return input.replace(
    /([?&](?:token|admin_token|sig)=)[^&\s"]*/gi,
    "$1***"
  );
}

function getLogPreview(value: string, maxLength = 120): string {
  const normalized = maskSensitiveValueForLog(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function textResponse(
  message: string,
  status: number,
  headers?: HeadersInit,
  body?: string | null
): Response {
  return new Response(body ?? message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function normalizeApiPath(apiPath: string): string {
  const trimmed = apiPath.trim();
  if (!trimmed) {
    return "/sub";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function encodeBase64Subscription(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

type OutputRequestPlan =
  | {
      ok: false;
      response: Response;
    }
  | {
      ok: true;
      format: OutputFormatId;
      target: string;
      requestedSourceCount: number;
      resolvedSourceCount: number;
      remoteSourceCount: number;
      rawSourceCount: number;
      rawSources: SourceItem[];
      remoteSources: SourceItem[];
      usingFullSourceSet: boolean;
      useSubconverter: boolean;
      useRawBypass: boolean;
      rawSourceUrl: string | null;
      upstreamUrl: URL | null;
    };

type OutputAccessContext =
  | {
      ok: false;
      response: Response;
    }
  | {
      ok: true;
      isAdmin: boolean;
      accessScope: "admin_full" | "viewer" | "public";
      tokenType: "session_admin" | "admin_token" | "viewer_token" | "viewer_session" | "none";
      signatureType: "none";
    };

type V2rayBypassResult = {
  ok: boolean;
  status: number;
  responseBody: string | null;
  responseHeaders: Headers;
  fetchedRemoteCount: number;
  remoteFetchStatuses: string[];
  aliasAppliedCount: number;
  fallbackOriginalNameCount: number;
  skippedCount: number;
  errorMessage?: string;
};

function parseRequestedSourceIds(sourceParam: string): string[] {
  return Array.from(
    new Set(
      sourceParam
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value) => value !== "none")
    )
  );
}

function normalizeSubscriptionText(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r/g, "").trim();
}

function tryDecodeBase64Subscription(value: string): string | null {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized || normalized.length % 4 === 1) {
    return null;
  }

  if (!/^[A-Za-z0-9+/=_-]+$/.test(normalized)) {
    return null;
  }

  try {
    const base64Value = normalized.replace(/-/g, "+").replace(/_/g, "/");
    const paddingLength = (4 - (base64Value.length % 4 || 4)) % 4;
    const paddedValue = `${base64Value}${"=".repeat(paddingLength)}`;
    const decoded = Buffer.from(paddedValue, "base64").toString("utf8");
    const normalizedDecoded = normalizeSubscriptionText(decoded);

    return normalizedDecoded || null;
  } catch {
    return null;
  }
}

function collectValidEntriesFromSubscriptionText(content: string) {
  const normalizedContent = normalizeSubscriptionText(content);
  if (!normalizedContent) {
    return {
      entries: [] as string[],
      skippedCount: 0,
    };
  }

  const lines = normalizedContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: string[] = [];
  let skippedCount = 0;

  for (const line of lines) {
    const parsed = parseSourceInput(line);
    if (!parsed || parsed.sourceType !== "raw") {
      skippedCount += 1;
      continue;
    }

    entries.push(line);
  }

  return {
    entries: Array.from(new Set(entries)),
    skippedCount,
  };
}

function collectRemoteSubscriptionEntries(content: string) {
  const plainResult = collectValidEntriesFromSubscriptionText(content);
  if (plainResult.entries.length > 0) {
    return plainResult;
  }

  const decodedContent = tryDecodeBase64Subscription(content);
  if (!decodedContent) {
    return plainResult;
  }

  const decodedResult = collectValidEntriesFromSubscriptionText(decodedContent);
  if (decodedResult.entries.length > 0) {
    return decodedResult;
  }

  return plainResult;
}

async function buildV2rayBypassResult(
  rawSources: SourceItem[],
  remoteSources: SourceItem[]
): Promise<V2rayBypassResult> {
  const rawResult = collectValidRawSourceEntries(rawSources);
  const mergedEntries = [...rawResult.entries];
  const remoteFetchStatuses: string[] = [];
  let fetchedRemoteCount = 0;
  let skippedRemoteCount = 0;
  let fallbackOriginalNameCount = rawResult.fallbackOriginalNameCount;
  const aliasAppliedCount = rawResult.aliasAppliedCount;

  for (const source of remoteSources) {
    const remoteUrl = getSourceDisplayValue(source);
    const maskedRemoteUrl = maskSensitiveValueForLog(remoteUrl);

    try {
      const remoteResponse = await fetch(remoteUrl, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "text/plain, */*",
        },
      });

      remoteFetchStatuses.push(`${source.id}:${remoteResponse.status}`);

      if (!remoteResponse.ok) {
        console.error(
          `[output] v2ray remote fetch failed source=${source.id} status=${remoteResponse.status} url=${maskedRemoteUrl}`
        );
        continue;
      }

      const remoteBody = await remoteResponse.text();
      const remoteEntriesResult = collectRemoteSubscriptionEntries(remoteBody);
      if (remoteEntriesResult.entries.length === 0) {
        console.warn(
          `[output] v2ray remote fetch returned no valid nodes source=${source.id} status=${remoteResponse.status} url=${maskedRemoteUrl} body_preview="${getLogPreview(
            remoteBody
          )}"`
        );
        skippedRemoteCount += remoteEntriesResult.skippedCount;
        continue;
      }

      fetchedRemoteCount += 1;
      skippedRemoteCount += remoteEntriesResult.skippedCount;
      fallbackOriginalNameCount += remoteEntriesResult.entries.length;
      mergedEntries.push(...remoteEntriesResult.entries);
    } catch {
      remoteFetchStatuses.push(`${source.id}:fetch_error`);
      console.error(
        `[output] v2ray remote fetch error source=${source.id} url=${maskedRemoteUrl}`
      );
    }
  }

  const normalizedEntries = Array.from(new Set(mergedEntries));
  if (normalizedEntries.length === 0) {
    return {
      ok: false,
      status: 400,
      responseBody: null,
      responseHeaders: new Headers({
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      }),
      fetchedRemoteCount,
      remoteFetchStatuses,
      aliasAppliedCount,
      fallbackOriginalNameCount,
      skippedCount: rawResult.skippedCount + skippedRemoteCount,
      errorMessage: "No valid raw or remote subscription entries found.",
    };
  }

  const plainTextBody = `${normalizedEntries.join("\n")}\n`;
  const responseBody = `${encodeBase64Subscription(plainTextBody)}\n`;
  const responseHeaders = new Headers({
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  const skippedTotal = rawResult.skippedCount + skippedRemoteCount;

  if (skippedTotal > 0) {
    responseHeaders.set("x-sub-platform-skipped-lines", String(skippedTotal));
  }

  return {
    ok: true,
    status: 200,
    responseBody,
    responseHeaders,
    fetchedRemoteCount,
    remoteFetchStatuses,
    aliasAppliedCount,
    fallbackOriginalNameCount,
    skippedCount: skippedTotal,
  };
}

function buildOutputRequestPlan(
  request: Request,
  serviceUrl: string,
  apiPath: string,
  sources: Parameters<typeof resolveSelectedSources>[1],
  usingPublishedSnapshot: boolean,
  allowAllSourcesWhenMissing: boolean
): OutputRequestPlan {
  const requestUrl = new URL(request.url);
  const format = requestUrl.searchParams.get("format")?.trim();
  if (!format) {
    return {
      ok: false,
      response: textResponse(
        'Missing required "format" query parameter.',
        400
      ),
    };
  }

  if (!Object.prototype.hasOwnProperty.call(OUTPUT_FORMAT_TARGET_MAP, format)) {
    return {
      ok: false,
      response: textResponse(
        `Unsupported output format: ${format}`,
        400
      ),
    };
  }

  const sourceParam = requestUrl.searchParams.get("source")?.trim() ?? "";
  const requestedSourceIds = parseRequestedSourceIds(sourceParam);
  const usingFullSourceSet =
    allowAllSourcesWhenMissing && requestedSourceIds.length === 0;
  const requestedSourceCount = usingFullSourceSet
    ? sources.length
    : requestedSourceIds.length;
  if (!sourceParam && !usingFullSourceSet) {
    return {
      ok: false,
      response: textResponse('Missing required "source" query parameter.', 400),
    };
  }

  if (requestedSourceIds.length === 0 && !usingFullSourceSet) {
    return {
      ok: false,
      response: textResponse("No valid sources selected for output.", 400),
    };
  }

  const selectedSourcesResult = usingFullSourceSet
    ? {
        ok: true as const,
        missingIds: [] as string[],
        sources,
      }
    : usingPublishedSnapshot
      ? {
          ok: true as const,
          missingIds: [] as string[],
          sources: sources.filter((source) => requestedSourceIds.includes(source.id)),
        }
      : resolveSelectedSources(sourceParam, sources);

  if (!selectedSourcesResult.ok) {
    return {
      ok: false,
      response: textResponse(
        `Unknown source id: ${selectedSourcesResult.missingIds.join(", ")}`,
        404
      ),
    };
  }

  if (selectedSourcesResult.sources.length === 0) {
    return {
      ok: false,
      response: textResponse(
        usingPublishedSnapshot
          ? "No published sources matched the requested source ids."
          : "No valid sources selected for output.",
        400
      ),
    };
  }

  const remoteSources = selectedSourcesResult.sources.filter(
    (source) => source.sourceType === "remote"
  );
  const rawSources = selectedSourcesResult.sources.filter(
    (source) => source.sourceType === "raw"
  );
  const selectedSourceValues = remoteSources.map((source) =>
    getSourceDisplayValue(source)
  );
  const target = OUTPUT_FORMAT_TARGET_MAP[format as OutputFormatId];

  if (RAW_BYPASS_FORMATS.has(format as OutputFormatId)) {
    return {
      ok: true,
      format: format as OutputFormatId,
      target,
      requestedSourceCount,
      resolvedSourceCount: selectedSourcesResult.sources.length,
      remoteSourceCount: remoteSources.length,
      rawSourceCount: rawSources.length,
      rawSources,
      remoteSources,
      usingFullSourceSet,
      useSubconverter: false,
      useRawBypass: true,
      rawSourceUrl: null,
      upstreamUrl: null,
    };
  }

  if (rawSources.length > 0) {
    const rawSourceParam = rawSources.map((source) => source.id).join(",");
    const rawSourceUrl = new URL("/output/raw", getRequestOrigin(request));
    rawSourceUrl.searchParams.set("source", rawSourceParam);
    rawSourceUrl.searchParams.set("encoding", "base64");

    const token = requestUrl.searchParams.get("token")?.trim();
    if (token) {
      rawSourceUrl.searchParams.set("token", token);
    }

    const adminToken = requestUrl.searchParams.get("admin_token")?.trim();
    if (adminToken) {
      rawSourceUrl.searchParams.set("admin_token", adminToken);
    } else if (!usingPublishedSnapshot) {
      const generatedAdminToken = createAdminSubscriptionToken();
      if (generatedAdminToken) {
        rawSourceUrl.searchParams.set("admin_token", generatedAdminToken);
      }
    }

    const issuedAtSeconds = Math.floor(Date.now() / 1000);
    const signature = createRawSourceAccessSignature(
      rawSourceParam,
      issuedAtSeconds
    );
    if (signature) {
      rawSourceUrl.searchParams.set("ts", String(issuedAtSeconds));
      rawSourceUrl.searchParams.set("sig", signature);
    }

    selectedSourceValues.push(rawSourceUrl.toString());
  }

  if (selectedSourceValues.length === 0) {
    return {
      ok: false,
      response: textResponse("No valid sources selected for output.", 400),
    };
  }

  const upstreamUrl = new URL(
    normalizeApiPath(apiPath),
    serviceUrl.endsWith("/") ? serviceUrl : `${serviceUrl}/`
  );
  upstreamUrl.searchParams.set("target", target);
  upstreamUrl.searchParams.set("url", selectedSourceValues.join("|"));

  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (key === "format" || key === "source" || key === "token") {
      continue;
    }

    if (FORWARDED_QUERY_KEYS.has(key)) {
      upstreamUrl.searchParams.set(key, value);
    }
  }

  return {
    ok: true,
    format: format as OutputFormatId,
    target,
    requestedSourceCount,
    resolvedSourceCount: selectedSourcesResult.sources.length,
    remoteSourceCount: remoteSources.length,
    rawSourceCount: rawSources.length,
    rawSources,
    remoteSources,
    usingFullSourceSet,
    useSubconverter: true,
    useRawBypass: false,
    upstreamUrl,
    rawSourceUrl:
      rawSources.length > 0
        ? selectedSourceValues[selectedSourceValues.length - 1] ?? null
        : null,
  };
}

async function canAccessOutput(
  requestUrl: URL,
  urlTokenEnabled: boolean
): Promise<OutputAccessContext> {
  const token = requestUrl.searchParams.get("token")?.trim();
  const adminToken = requestUrl.searchParams.get("admin_token")?.trim() ?? null;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const session = getSessionFromToken(sessionToken);

  if (session.authenticated && session.role === "admin") {
    return {
      ok: true,
      isAdmin: true,
      accessScope: "admin_full",
      tokenType: "session_admin",
      signatureType: "none",
    };
  }

  if (isAdminSubscriptionTokenValid(adminToken)) {
    return {
      ok: true,
      isAdmin: true,
      accessScope: "admin_full",
      tokenType: "admin_token",
      signatureType: "none",
    };
  }

  if (isViewerAnonymousAccessAllowed()) {
    return {
      ok: true,
      isAdmin: false,
      accessScope: "public",
      tokenType: "none",
      signatureType: "none",
    };
  }

  if (session.authenticated) {
    return {
      ok: true,
      isAdmin: false,
      accessScope: "viewer",
      tokenType: "viewer_session",
      signatureType: "none",
    };
  }

  if (urlTokenEnabled && token) {
    return {
      ok: true,
      isAdmin: false,
      accessScope: "public",
      tokenType: "viewer_token",
      signatureType: "none",
    };
  }

  return {
    ok: false,
    response: textResponse(
      "Authentication or a valid token is required for subscription output access.",
      401
    ),
  };
}

async function handleOutputRequest(request: Request, headOnly = false): Promise<Response> {
  const requestUrl = new URL(request.url);
  const appState = await readStoredAppDataState();
  const accessContext = await canAccessOutput(requestUrl, appState.urlTokenEnabled);
  if (!accessContext.ok) {
    return accessContext.response;
  }

  const publishedSources = getPublishedSources(appState);
  const usingPublishedSnapshot = !accessContext.isAdmin;
  const effectiveSources = usingPublishedSnapshot ? publishedSources : appState.sources;
  const serviceUrl = appState.serviceUrl.trim();
  const outputPlan = buildOutputRequestPlan(
    request,
    serviceUrl,
    appState.apiPath,
    effectiveSources,
    usingPublishedSnapshot,
    accessContext.accessScope === "admin_full"
  );
  if (!outputPlan.ok) {
    return outputPlan.response;
  }

  if (outputPlan.useSubconverter && !serviceUrl) {
    return textResponse("Subconverter service URL is not configured.", 500);
  }

  console.info(
    `[output] request format=${outputPlan.format} target=${outputPlan.target} access_scope=${
      accessContext.accessScope
    } token_type=${accessContext.tokenType} signature_type=${
      accessContext.signatureType
    } publish_state=${
      usingPublishedSnapshot ? "published" : "draft"
    } published_version_id=${appState.publishedVersionId ?? "none"} published_at=${
      appState.publishedAt ?? "none"
    } using_published_snapshot=${usingPublishedSnapshot} using_full_source_set=${
      outputPlan.usingFullSourceSet
    } requested_source_count=${
      outputPlan.requestedSourceCount
    } resolved_source_count=${outputPlan.resolvedSourceCount} published_source_count=${
      publishedSources.length
    } remote_sources=${
      outputPlan.remoteSourceCount
    } raw_sources=${outputPlan.rawSourceCount} use_subconverter=${
      outputPlan.useSubconverter
    } raw_bypass=${outputPlan.useRawBypass}`
  );

  if (outputPlan.useRawBypass) {
    const bypassResult = await buildV2rayBypassResult(
      outputPlan.rawSources,
      outputPlan.remoteSources
    );
    const remoteFetchStatusValue =
      bypassResult.remoteFetchStatuses.length > 0
        ? bypassResult.remoteFetchStatuses.join(",")
        : "none";

    if (!bypassResult.ok) {
      console.error(
        `[output] response format=${outputPlan.format} target=${outputPlan.target} access_scope=${
          accessContext.accessScope
        } token_type=${accessContext.tokenType} signature_type=${
          accessContext.signatureType
        } publish_state=${
          usingPublishedSnapshot ? "published" : "draft"
        } published_version_id=${appState.publishedVersionId ?? "none"} published_at=${
          appState.publishedAt ?? "none"
        } using_published_snapshot=${usingPublishedSnapshot} using_full_source_set=${
          outputPlan.usingFullSourceSet
        } requested_source_count=${outputPlan.requestedSourceCount} resolved_source_count=${
          outputPlan.resolvedSourceCount
        } published_source_count=${publishedSources.length} raw_sources=${
          outputPlan.rawSourceCount
        } remote_sources=${
          outputPlan.remoteSourceCount
        } fetched_remote_count=${bypassResult.fetchedRemoteCount} alias_applied_count=${
          bypassResult.aliasAppliedCount
        } fallback_original_name_count=${
          bypassResult.fallbackOriginalNameCount
        } remote_fetch_status="${remoteFetchStatusValue}" raw_bypass=true upstream_status=none body_preview="${getLogPreview(
          bypassResult.errorMessage ?? ""
        )}"`
      );
      return textResponse(bypassResult.errorMessage ?? "Invalid subscription content.", bypassResult.status);
    }

    const responseBody = bypassResult.responseBody ?? "";
    console.info(
      `[output] response format=${outputPlan.format} target=${outputPlan.target} access_scope=${
        accessContext.accessScope
      } token_type=${accessContext.tokenType} signature_type=${
        accessContext.signatureType
      } publish_state=${
        usingPublishedSnapshot ? "published" : "draft"
      } published_version_id=${appState.publishedVersionId ?? "none"} published_at=${
        appState.publishedAt ?? "none"
      } using_published_snapshot=${usingPublishedSnapshot} using_full_source_set=${
        outputPlan.usingFullSourceSet
      } requested_source_count=${outputPlan.requestedSourceCount} resolved_source_count=${
        outputPlan.resolvedSourceCount
      } published_source_count=${publishedSources.length} raw_sources=${
        outputPlan.rawSourceCount
      } remote_sources=${
        outputPlan.remoteSourceCount
      } fetched_remote_count=${bypassResult.fetchedRemoteCount} alias_applied_count=${
        bypassResult.aliasAppliedCount
      } fallback_original_name_count=${
        bypassResult.fallbackOriginalNameCount
      } remote_fetch_status="${remoteFetchStatusValue}" raw_bypass=true upstream_status=none body_preview="${getLogPreview(
        responseBody
      )}"`
    );

    return new Response(headOnly ? null : responseBody, {
      status: bypassResult.status,
      headers: bypassResult.responseHeaders,
    });
  }

  if (outputPlan.rawSourceUrl) {
    try {
      const rawPreviewResponse = await fetch(outputPlan.rawSourceUrl, {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "text/plain, */*",
        },
      });
      const rawPreviewBody = await rawPreviewResponse.text();
      console.info(
        `[output] raw source probe mode=base64-remote-url status=${rawPreviewResponse.status} length=${rawPreviewBody.length} url=${maskSensitiveValueForLog(
          outputPlan.rawSourceUrl
        )} body_preview="${getLogPreview(rawPreviewBody)}"`
      );
    } catch {
      console.error(
        `[output] failed to prefetch raw source url ${maskSensitiveValueForLog(
          outputPlan.rawSourceUrl
        )}`
      );
    }
  }

  let upstreamResponse: Response;
  const maskedUpstreamUrl = maskSensitiveValueForLog(
    outputPlan.upstreamUrl?.toString() ?? ""
  );
  console.info(
    `[output] proxying request to subconverter format=${outputPlan.format} target=${outputPlan.target} mode=base64-remote-url url=${maskedUpstreamUrl}`
  );
  try {
    upstreamResponse = await fetch(outputPlan.upstreamUrl!, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "text/plain, text/yaml, application/x-yaml, */*",
      },
    });
  } catch {
    console.error(
      `[output] subconverter request failed format=${outputPlan.format} target=${outputPlan.target} upstream_status=unreachable`
    );
    return textResponse("Subconverter upstream is unreachable.", 502);
  }

  const upstreamBody = await upstreamResponse.text();
  console.info(
    `[output] response format=${outputPlan.format} target=${outputPlan.target} access_scope=${
      accessContext.accessScope
    } token_type=${accessContext.tokenType} signature_type=${
      accessContext.signatureType
    } publish_state=${
      usingPublishedSnapshot ? "published" : "draft"
    } published_version_id=${appState.publishedVersionId ?? "none"} published_at=${
      appState.publishedAt ?? "none"
    } using_published_snapshot=${usingPublishedSnapshot} using_full_source_set=${
      outputPlan.usingFullSourceSet
    } requested_source_count=${outputPlan.requestedSourceCount} resolved_source_count=${
      outputPlan.resolvedSourceCount
    } published_source_count=${publishedSources.length} raw_bypass=false upstream_status=${upstreamResponse.status} body_preview="${getLogPreview(
      upstreamBody
    )}"`
  );

  if (!upstreamResponse.ok) {
    console.error(
      `[output] subconverter upstream returned HTTP ${upstreamResponse.status} for ${maskedUpstreamUrl}`
    );
    return textResponse(
      `Subconverter upstream returned HTTP ${upstreamResponse.status}.`,
      502
    );
  }

  const responseHeaders = new Headers({
    "cache-control": "no-store",
    "content-type":
      upstreamResponse.headers.get("content-type")?.trim() ||
      "text/plain; charset=utf-8",
  });

  const contentDisposition = upstreamResponse.headers.get("content-disposition");
  if (contentDisposition) {
    responseHeaders.set("content-disposition", contentDisposition);
  }

  return new Response(headOnly ? null : upstreamBody, {
    status: 200,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) {
  return handleOutputRequest(request);
}

export async function HEAD(request: Request) {
  return handleOutputRequest(request, true);
}
