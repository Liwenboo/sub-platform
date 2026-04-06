"use client";

import type { RepositoryError } from "../../_types/repository-types";
import type { RemoteApiResponseDto } from "./remote-app-data-api-types";
import type { RemoteEndpointDefinition } from "./remote-app-data-endpoints";
import {
  REMOTE_APP_DATA_BASE_URL,
  REMOTE_APP_DATA_TIMEOUT_MS,
} from "./app-data-repository-config";

export type RemoteAppDataClientConfig = {
  baseUrl: string;
  timeoutMs: number;
  defaultHeaders: Record<string, string>;
};

export type RemoteAppDataClientRequest<TRequestDto> = {
  operation: string;
  endpoint: RemoteEndpointDefinition;
  pathParams?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: TRequestDto | null;
};

export type RemoteAppDataClientResult<TResponseDto> = {
  ok: boolean;
  response: RemoteApiResponseDto<TResponseDto> | null;
  error: RepositoryError | null;
  status: number | null;
  request: {
    url: string;
    method: RemoteEndpointDefinition["method"];
    headers: Record<string, string>;
    body: unknown;
    timeoutMs: number;
  };
};

const REMOTE_APP_DATA_CLIENT_CONFIG: RemoteAppDataClientConfig = {
  baseUrl: REMOTE_APP_DATA_BASE_URL,
  timeoutMs: REMOTE_APP_DATA_TIMEOUT_MS,
  defaultHeaders: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
};

function createClientError(
  code: RepositoryError["code"],
  message: string,
  recoverable: boolean
): RepositoryError {
  return {
    code,
    message,
    recoverable,
  };
}

function applyPathParams(
  path: string,
  pathParams?: Record<string, string>
): string {
  if (!pathParams) {
    return path;
  }

  return Object.entries(pathParams).reduce(
    (nextPath, [key, value]) => nextPath.replace(`:${key}`, encodeURIComponent(value)),
    path
  );
}

function buildQueryString(
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!query) {
    return "";
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
}

function buildRequestUrl(
  config: RemoteAppDataClientConfig,
  endpoint: RemoteEndpointDefinition,
  pathParams?: Record<string, string>,
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  const normalizedBaseUrl = config.baseUrl.replace(/\/+$/, "");
  const resolvedPath = applyPathParams(endpoint.path, pathParams);
  const queryString = buildQueryString(query);

  return `${normalizedBaseUrl}${resolvedPath}${queryString}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRemoteApiResponseDto<TResponseDto>(
  value: unknown
): value is RemoteApiResponseDto<TResponseDto> {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.success !== "boolean") {
    return false;
  }

  const hasData = Object.prototype.hasOwnProperty.call(value, "data");
  const hasError = Object.prototype.hasOwnProperty.call(value, "error");

  return hasData && hasError;
}

function createRequestSnapshot(
  url: string,
  method: RemoteEndpointDefinition["method"],
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
) {
  return {
    url,
    method,
    headers,
    body,
    timeoutMs,
  };
}

export function createRemoteAppDataClient(
  config: RemoteAppDataClientConfig = REMOTE_APP_DATA_CLIENT_CONFIG
) {
  return {
    async execute<TRequestDto, TResponseDto>(
      request: RemoteAppDataClientRequest<TRequestDto>
    ): Promise<RemoteAppDataClientResult<TResponseDto>> {
      const url = buildRequestUrl(
        config,
        request.endpoint,
        request.pathParams,
        request.query
      );
      const headers = { ...config.defaultHeaders };
      const requestBody = request.body ?? null;
      const requestSnapshot = createRequestSnapshot(
        url,
        request.endpoint.method,
        headers,
        requestBody,
        config.timeoutMs
      );

      try {
        if (typeof fetch !== "function") {
          return {
            ok: false,
            response: null,
            status: null,
            error: createClientError(
              "remote_request_failed",
              `Fetch is not available for remote operation "${request.operation}".`,
              true
            ),
            request: requestSnapshot,
          };
        }

        const controller = new AbortController();
        const timeoutId = globalThis.setTimeout(() => {
          controller.abort();
        }, config.timeoutMs);

        let response: Response;

        try {
          const shouldSendJsonBody =
            request.endpoint.method !== "GET" &&
            requestBody !== null &&
            requestBody !== undefined;

          response = await fetch(url, {
            method: request.endpoint.method,
            headers,
            body: shouldSendJsonBody ? JSON.stringify(requestBody) : undefined,
            signal: controller.signal,
            cache: "no-store",
            credentials: "same-origin",
          });
        } finally {
          globalThis.clearTimeout(timeoutId);
        }

        const rawText = await response.text();
        let parsed: unknown = null;

        if (rawText.length > 0) {
          try {
            parsed = JSON.parse(rawText);
          } catch {
            return {
              ok: false,
              response: null,
              status: response.status,
              error: createClientError(
                response.ok ? "remote_response_invalid" : "remote_request_failed",
                response.ok
                  ? `Remote operation "${request.operation}" returned invalid JSON.`
                  : `Remote operation "${request.operation}" failed with HTTP ${response.status}.`,
                true
              ),
              request: requestSnapshot,
            };
          }
        }

        if (!isRemoteApiResponseDto<TResponseDto>(parsed)) {
          return {
            ok: false,
            response: null,
            status: response.status,
            error: createClientError(
              response.ok ? "remote_response_invalid" : "remote_request_failed",
              response.ok
                ? `Remote operation "${request.operation}" returned an invalid response payload.`
                : `Remote operation "${request.operation}" failed with HTTP ${response.status}.`,
              true
            ),
            request: requestSnapshot,
          };
        }

        return {
          ok: response.ok && parsed.success,
          response: parsed,
          error: null,
          status: response.status,
          request: requestSnapshot,
        };
      } catch {
        return {
          ok: false,
          response: null,
          status: null,
          error: createClientError(
            "remote_request_failed",
            `Remote operation "${request.operation}" failed before a response was received.`,
            true
          ),
          request: requestSnapshot,
        };
      }
    },
  };
}
