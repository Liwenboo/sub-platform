import { cookies } from "next/headers";
import {
  AUTH_SESSION_COOKIE_NAME,
  getSessionFromToken,
  isViewerAnonymousAccessAllowed,
} from "../../../server/auth/session";
import { readStoredAppDataState } from "../../../server/mock-data/app-data-storage";
import { getPublishedSources } from "../../_data/services/app-data-service";
import {
  collectValidRawSourceEntries,
  isRawSourceAccessSignatureValid,
  resolveSelectedSources,
} from "../_lib/output-source-utils";

export const dynamic = "force-dynamic";

function encodeBase64Subscription(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function getLogPreview(value: string, maxLength = 120): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

type RawSourceAccessContext =
  | {
      ok: false;
      response: Response;
    }
  | {
      ok: true;
      isAdmin: boolean;
      hasSignedAccess: boolean;
      accessScope: "admin" | "viewer" | "public";
    };

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

async function canAccessRawSource(
  requestUrl: URL,
  urlTokenEnabled: boolean
): Promise<RawSourceAccessContext> {
  const token = requestUrl.searchParams.get("token")?.trim();
  const sourceParam = requestUrl.searchParams.get("source")?.trim() ?? "";
  const signature = requestUrl.searchParams.get("sig")?.trim() ?? null;
  const issuedAtSeconds = Number(requestUrl.searchParams.get("ts"));
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const session = getSessionFromToken(sessionToken);

  if (session.authenticated && session.role === "admin") {
    return {
      ok: true,
      isAdmin: true,
      hasSignedAccess: false,
      accessScope: "admin",
    };
  }

  if (isViewerAnonymousAccessAllowed()) {
    return {
      ok: true,
      isAdmin: false,
      hasSignedAccess: false,
      accessScope: "public",
    };
  }

  if (session.authenticated) {
    return {
      ok: true,
      isAdmin: false,
      hasSignedAccess: false,
      accessScope: "viewer",
    };
  }

  if (urlTokenEnabled && token) {
    return {
      ok: true,
      isAdmin: false,
      hasSignedAccess: false,
      accessScope: "public",
    };
  }

  if (
    sourceParam &&
    isRawSourceAccessSignatureValid(sourceParam, issuedAtSeconds, signature)
  ) {
    return {
      ok: true,
      isAdmin: false,
      hasSignedAccess: true,
      accessScope: "public",
    };
  }

  return {
    ok: false,
    response: textResponse("Authentication or a valid token is required.", 401),
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const appState = await readStoredAppDataState();
  const accessContext = await canAccessRawSource(requestUrl, appState.urlTokenEnabled);
  if (!accessContext.ok) {
    return accessContext.response;
  }

  const sourceParam = requestUrl.searchParams.get("source")?.trim() ?? "";
  const encoding = requestUrl.searchParams.get("encoding")?.trim().toLowerCase() ?? "plain";
  const useBase64Encoding = encoding === "base64";
  const requestedSourceIds = sourceParam
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value !== "none");
  const usingPublishedSnapshot =
    !accessContext.isAdmin && !accessContext.hasSignedAccess;
  const publishedSources = getPublishedSources(appState);
  const availableSources = usingPublishedSnapshot ? publishedSources : appState.sources;
  const usingFullSourceSet =
    accessContext.accessScope === "admin" && requestedSourceIds.length === 0;
  const requestedSourceCount = usingFullSourceSet
    ? availableSources.length
    : requestedSourceIds.length;
  console.info(
    `[output/raw] requested source ids="${sourceParam || "*"}" access_scope=${
      accessContext.accessScope
    } encoding=${useBase64Encoding ? "base64" : "plain"}`
  );
  if (!sourceParam && !usingFullSourceSet) {
    return textResponse('Missing required "source" query parameter.', 400);
  }

  const selectedSourcesResult = usingFullSourceSet
    ? {
        ok: true as const,
        missingIds: [] as string[],
        sources: availableSources,
      }
    : usingPublishedSnapshot
      ? {
          ok: true as const,
          missingIds: [] as string[],
          sources: availableSources.filter((source) =>
            requestedSourceIds.includes(source.id)
          ),
        }
      : resolveSelectedSources(sourceParam, availableSources);

  if (!selectedSourcesResult.ok) {
    if (selectedSourcesResult.missingIds.length > 0) {
      return textResponse(
        `Unknown source id: ${selectedSourcesResult.missingIds.join(", ")}`,
        404
      );
    }

    return textResponse("No raw sources selected.", 400);
  }

  if (selectedSourcesResult.sources.length === 0) {
    return textResponse(
      usingPublishedSnapshot
        ? "No published raw sources matched the requested source ids."
        : "No raw sources selected.",
      400
    );
  }

  const rawSources = selectedSourcesResult.sources.filter(
    (source) => source.sourceType === "raw"
  );
  console.info(
    `[output/raw] publish_state=${
      usingPublishedSnapshot ? "published" : accessContext.hasSignedAccess ? "signed" : "draft"
    } published_version_id=${appState.publishedVersionId ?? "none"} published_at=${
      appState.publishedAt ?? "none"
    } access_scope=${accessContext.accessScope} using_published_snapshot=${usingPublishedSnapshot} using_full_source_set=${usingFullSourceSet} requested_source_count=${requestedSourceCount} resolved_source_count=${
      selectedSourcesResult.sources.length
    } published_source_count=${publishedSources.length} raw_sources=${rawSources.length}`
  );
  const {
    entries,
    skippedCount,
    aliasAppliedCount,
    fallbackOriginalNameCount,
  } = collectValidRawSourceEntries(rawSources);

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
    `[output/raw] returning publish_state=${
      usingPublishedSnapshot ? "published" : accessContext.hasSignedAccess ? "signed" : "draft"
    } published_version_id=${appState.publishedVersionId ?? "none"} published_at=${
      appState.publishedAt ?? "none"
    } access_scope=${accessContext.accessScope} using_published_snapshot=${usingPublishedSnapshot} using_full_source_set=${usingFullSourceSet} requested_source_count=${requestedSourceCount} resolved_source_count=${
      selectedSourcesResult.sources.length
    } published_source_count=${publishedSources.length} entries=${entries.length} skipped=${skippedCount} alias_applied_count=${aliasAppliedCount} fallback_original_name_count=${fallbackOriginalNameCount} mode=${
      useBase64Encoding ? "base64" : "plain"
    } length=${responseBody.length} body_preview="${getLogPreview(responseBody)}"`
  );

  return new Response(responseBody, {
    status: 200,
    headers,
  });
}
