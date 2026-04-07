import { cookies } from "next/headers";
import { getSourceDisplayValue } from "../_data/services/source-entry-service";
import { mockAppDataStore } from "../../server/mock-data/app-data-store";
import {
  AUTH_SESSION_COOKIE_NAME,
  getSessionFromToken,
  isViewerAnonymousAccessAllowed,
} from "../../server/auth/session";
import type { OutputFormatId } from "../_types/app-types";
import {
  collectValidRawSourceEntries,
  createRawSourceAccessSignature,
  getRequestOrigin,
  resolveSelectedSources,
} from "./_lib/output-source-utils";

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
    /([?&](?:token|sig)=)[^&\s"]*/gi,
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

function countRequestedSources(sourceParam: string): number {
  return sourceParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value !== "none").length;
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
      useSubconverter: boolean;
      useRawBypass: boolean;
      rawSourceUrl: string | null;
      upstreamUrl: URL | null;
      responseBody: string | null;
      responseHeaders: HeadersInit | null;
    };

function buildOutputRequestPlan(
  request: Request,
  serviceUrl: string,
  apiPath: string,
  sources: Parameters<typeof resolveSelectedSources>[1]
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
  const requestedSourceCount = countRequestedSources(sourceParam);
  const selectedSourcesResult = resolveSelectedSources(sourceParam, sources);
  if (!selectedSourcesResult.ok) {
    if (!sourceParam) {
      return {
        ok: false,
        response: textResponse(
          'Missing required "source" query parameter.',
          400
        ),
      };
    }

    return {
      ok: false,
      response: textResponse(
        `Unknown source id: ${selectedSourcesResult.missingIds.join(", ")}`,
        404
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
    if (remoteSources.length > 0) {
      console.warn(
        `[output] raw bypass rejected target=${target} requested_sources=${requestedSourceCount} resolved_sources=${selectedSourcesResult.sources.length} remote_sources=${remoteSources.length} raw_sources=${rawSources.length}`
      );
      return {
        ok: false,
        response: textResponse(
          "V2Ray output bypass only supports raw node sources.",
          400
        ),
      };
    }

    const { entries, skippedCount } = collectValidRawSourceEntries(rawSources);
    if (entries.length === 0) {
      console.warn(
        `[output] raw bypass found no valid entries target=${target} requested_sources=${requestedSourceCount} resolved_sources=${selectedSourcesResult.sources.length} remote_sources=${remoteSources.length} raw_sources=${rawSources.length}`
      );
      return {
        ok: false,
        response: textResponse("No valid raw source entries found.", 400),
      };
    }

    const plainTextBody = `${entries.join("\n")}\n`;
    const responseBody = `${encodeBase64Subscription(plainTextBody)}\n`;
    const responseHeaders = new Headers({
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });

    if (skippedCount > 0) {
      responseHeaders.set("x-sub-platform-skipped-lines", String(skippedCount));
    }

    return {
      ok: true,
      format: format as OutputFormatId,
      target,
      requestedSourceCount,
      resolvedSourceCount: selectedSourcesResult.sources.length,
      remoteSourceCount: remoteSources.length,
      rawSourceCount: rawSources.length,
      useSubconverter: false,
      useRawBypass: true,
      rawSourceUrl: null,
      upstreamUrl: null,
      responseBody,
      responseHeaders,
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
    useSubconverter: true,
    useRawBypass: false,
    upstreamUrl,
    rawSourceUrl:
      rawSources.length > 0
        ? selectedSourceValues[selectedSourceValues.length - 1] ?? null
        : null,
    responseBody: null,
    responseHeaders: null,
  };
}

async function canAccessOutput(requestUrl: URL): Promise<Response | null> {
  const appData = await mockAppDataStore.loadAppData();
  const token = requestUrl.searchParams.get("token")?.trim();

  if (isViewerAnonymousAccessAllowed()) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const session = getSessionFromToken(sessionToken);

  if (session.authenticated) {
    return null;
  }

  if (appData.outputConfig.urlTokenEnabled && token) {
    return null;
  }

  return textResponse(
    "Authentication or a valid token is required for subscription output access.",
    401
  );
}

async function handleOutputRequest(request: Request, headOnly = false): Promise<Response> {
  const requestUrl = new URL(request.url);
  const accessFailure = await canAccessOutput(requestUrl);
  if (accessFailure) {
    return accessFailure;
  }

  const appData = await mockAppDataStore.loadAppData();
  const serviceUrl = appData.settings.serviceUrl.trim();
  const outputPlan = buildOutputRequestPlan(
    request,
    serviceUrl,
    appData.settings.apiPath,
    appData.sources
  );
  if (!outputPlan.ok) {
    return outputPlan.response;
  }

  if (outputPlan.useSubconverter && !serviceUrl) {
    return textResponse("Subconverter service URL is not configured.", 500);
  }

  console.info(
    `[output] request format=${outputPlan.format} target=${outputPlan.target} requested_sources=${outputPlan.requestedSourceCount} resolved_sources=${outputPlan.resolvedSourceCount} remote_sources=${outputPlan.remoteSourceCount} raw_sources=${outputPlan.rawSourceCount} use_subconverter=${outputPlan.useSubconverter} raw_bypass=${outputPlan.useRawBypass}`
  );

  if (outputPlan.useRawBypass) {
    const responseBody = outputPlan.responseBody ?? "";
    console.info(
      `[output] response format=${outputPlan.format} target=${outputPlan.target} raw_bypass=true upstream_status=none body_preview="${getLogPreview(
        responseBody
      )}"`
    );

    return new Response(headOnly ? null : responseBody, {
      status: 200,
      headers: outputPlan.responseHeaders ?? {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
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
    `[output] response format=${outputPlan.format} target=${outputPlan.target} raw_bypass=false upstream_status=${upstreamResponse.status} body_preview="${getLogPreview(
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
