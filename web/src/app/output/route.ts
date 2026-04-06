import { cookies } from "next/headers";
import { getSourceDisplayValue } from "../_data/services/source-entry-service";
import { mockAppDataStore } from "../../server/mock-data/app-data-store";
import {
  AUTH_SESSION_COOKIE_NAME,
  getSessionFromToken,
  isViewerAnonymousAccessAllowed,
} from "../../server/auth/session";
import type { OutputFormatId, SourceItem } from "../_types/app-types";

export const dynamic = "force-dynamic";

const OUTPUT_FORMAT_TARGET_MAP: Record<OutputFormatId, string> = {
  clash: "clash",
  "clash-meta": "clash",
  v2ray: "v2ray",
  "sing-box": "singbox",
};

const FORWARDED_QUERY_KEYS = new Set([
  "emoji",
  "udp",
  "tfo",
  "sort",
  "name",
]);

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

function resolveSelectedSources(sourceParam: string, sources: SourceItem[]) {
  const selectedIds = sourceParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value !== "none");

  if (selectedIds.length === 0) {
    return {
      ok: false as const,
      response: textResponse(
        'Missing required "source" query parameter.',
        400
      ),
    };
  }

  const selectedSources = selectedIds
    .map((id) => sources.find((source) => source.id === id) ?? null)
    .filter((source): source is SourceItem => source !== null);

  if (selectedSources.length !== selectedIds.length) {
    const missingIds = selectedIds.filter(
      (id) => !selectedSources.some((source) => source.id === id)
    );

    return {
      ok: false as const,
      response: textResponse(
        `Unknown source id: ${missingIds.join(", ")}`,
        404
      ),
    };
  }

  return {
    ok: true as const,
    data: selectedSources,
  };
}

function buildUpstreamUrl(requestUrl: URL, serviceUrl: string, apiPath: string, sources: SourceItem[]) {
  const format = requestUrl.searchParams.get("format")?.trim();
  if (!format) {
    return {
      ok: false as const,
      response: textResponse(
        'Missing required "format" query parameter.',
        400
      ),
    };
  }

  if (!Object.prototype.hasOwnProperty.call(OUTPUT_FORMAT_TARGET_MAP, format)) {
    return {
      ok: false as const,
      response: textResponse(
        `Unsupported output format: ${format}`,
        400
      ),
    };
  }

  const sourceParam = requestUrl.searchParams.get("source")?.trim() ?? "";
  const selectedSourcesResult = resolveSelectedSources(sourceParam, sources);
  if (!selectedSourcesResult.ok) {
    return selectedSourcesResult;
  }

  const selectedSourceValues = selectedSourcesResult.data.map((source) =>
    getSourceDisplayValue(source)
  );

  const upstreamUrl = new URL(
    normalizeApiPath(apiPath),
    serviceUrl.endsWith("/") ? serviceUrl : `${serviceUrl}/`
  );
  upstreamUrl.searchParams.set(
    "target",
    OUTPUT_FORMAT_TARGET_MAP[format as OutputFormatId]
  );
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
    ok: true as const,
    data: upstreamUrl,
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

  if (!serviceUrl) {
    return textResponse("Subconverter service URL is not configured.", 500);
  }

  const upstreamUrlResult = buildUpstreamUrl(
    requestUrl,
    serviceUrl,
    appData.settings.apiPath,
    appData.sources
  );
  if (!upstreamUrlResult.ok) {
    return upstreamUrlResult.response;
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrlResult.data, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "text/plain, text/yaml, application/x-yaml, */*",
      },
    });
  } catch {
    return textResponse("Subconverter upstream is unreachable.", 502);
  }

  const upstreamBody = await upstreamResponse.text();

  if (!upstreamResponse.ok) {
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
