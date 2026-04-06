import { cookies } from "next/headers";
import { mockAppDataStore } from "../../../server/mock-data/app-data-store";
import {
  AUTH_SESSION_COOKIE_NAME,
  getSessionFromToken,
  isViewerAnonymousAccessAllowed,
} from "../../../server/auth/session";
import {
  collectValidRawSourceEntries,
  isRawSourceAccessSignatureValid,
  resolveSelectedSources,
} from "../_lib/output-source-utils";

export const dynamic = "force-dynamic";

function encodeBase64Subscription(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function getLogPreview(value: string, maxLength = 300): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function textResponse(message: string, status: number, headers?: HeadersInit): Response {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

async function canAccessRawSource(requestUrl: URL): Promise<Response | null> {
  const appData = await mockAppDataStore.loadAppData();
  const token = requestUrl.searchParams.get("token")?.trim();
  const sourceParam = requestUrl.searchParams.get("source")?.trim() ?? "";
  const signature = requestUrl.searchParams.get("sig")?.trim() ?? null;
  const issuedAtSeconds = Number(requestUrl.searchParams.get("ts"));

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

  if (
    sourceParam &&
    isRawSourceAccessSignatureValid(sourceParam, issuedAtSeconds, signature)
  ) {
    return null;
  }

  return textResponse("Authentication or a valid token is required.", 401);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const accessFailure = await canAccessRawSource(requestUrl);
  if (accessFailure) {
    return accessFailure;
  }

  const sourceParam = requestUrl.searchParams.get("source")?.trim() ?? "";
  const encoding = requestUrl.searchParams.get("encoding")?.trim().toLowerCase() ?? "plain";
  const useBase64Encoding = encoding === "base64";
  console.info(
    `[output/raw] requested source ids="${sourceParam}" encoding=${useBase64Encoding ? "base64" : "plain"}`
  );
  if (!sourceParam) {
    return textResponse('Missing required "source" query parameter.', 400);
  }

  const appData = await mockAppDataStore.loadAppData();
  const selectedSourcesResult = resolveSelectedSources(sourceParam, appData.sources);

  if (!selectedSourcesResult.ok) {
    if (selectedSourcesResult.missingIds.length > 0) {
      return textResponse(
        `Unknown source id: ${selectedSourcesResult.missingIds.join(", ")}`,
        404
      );
    }

    return textResponse("No raw sources selected.", 400);
  }

  const rawSources = selectedSourcesResult.sources.filter(
    (source) => source.sourceType === "raw"
  );
  console.info(
    `[output/raw] resolved_sources=${selectedSourcesResult.sources.length} raw_sources=${rawSources.length}`
  );
  const { entries, skippedCount } = collectValidRawSourceEntries(rawSources);

  if (entries.length === 0) {
    console.error(`[output/raw] no valid raw node entries found for source ids="${sourceParam}"`);
    return textResponse("No valid raw source entries found.", 400);
  }

  const headers = new Headers({
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });

  if (skippedCount > 0) {
    headers.set("x-sub-platform-skipped-lines", String(skippedCount));
  }

  const plainTextBody = `${entries.join("\n")}\n`;
  const responseBody = useBase64Encoding
    ? `${encodeBase64Subscription(plainTextBody)}\n`
    : plainTextBody;
  console.info(
    `[output/raw] returning entries=${entries.length} skipped=${skippedCount} mode=${
      useBase64Encoding ? "base64" : "plain"
    } length=${responseBody.length} body_preview="${getLogPreview(responseBody)}"`
  );

  return new Response(responseBody, {
    status: 200,
    headers,
  });
}
