import type {
  OutputFormatId,
  SourceStatus,
  SourceType,
  UserRole,
} from "../../app/_types/app-types";
import type { AppDataState } from "../../app/_types/app-types";
import type {
  RemoteCreateSourceRequestDto,
  RemoteSaveOutputConfigRequestDto,
  RemoteSaveSettingsRequestDto,
  RemoteSetRoleRequestDto,
  RemoteSettingsDto,
  RemoteUpdateSourceRequestDto,
} from "../../app/_data/repositories/remote-app-data-api-types";
import {
  isHttpSubscriptionUrl,
  resolveSourceProtocol,
} from "../../app/_data/services/source-entry-service";
import type { AppDataStoreMutationResult } from "./app-data-store-contract";

const SOURCE_STATUS_VALUES: SourceStatus[] = ["online", "warning", "paused"];
const SOURCE_TYPE_VALUES: SourceType[] = ["remote", "raw"];
const OUTPUT_FORMAT_VALUES: OutputFormatId[] = [
  "clash",
  "clash-meta",
  "v2ray",
  "sing-box",
];
const USER_ROLE_VALUES: UserRole[] = ["admin", "viewer"];
const SERVICE_CHECK_STATUS_VALUES: RemoteSettingsDto["serviceCheckStatus"][] = [
  "not_checked",
  "checking",
  "success",
  "failed",
];

function createValidationFailure<T>(
  code: string,
  message: string,
  status = 400,
  recoverable = true
): AppDataStoreMutationResult<T> {
  return {
    ok: false,
    status,
    error: {
      code,
      message,
      recoverable,
    },
  };
}

function createValidationSuccess<T>(value: T): AppDataStoreMutationResult<T> {
  return {
    ok: true,
    data: value,
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim();
}

function normalizeTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length === value.length ? normalized : null;
}

function normalizeSourceInput(
  source: {
    name?: unknown;
    sourceType?: unknown;
    sourceProtocol?: unknown;
    url?: unknown;
    content?: unknown;
    tags?: unknown;
    updatedAt?: unknown;
    status?: unknown;
    id?: unknown;
  }
): AppDataStoreMutationResult<{
  id?: string;
  name: string;
  sourceType: SourceType;
  sourceProtocol: RemoteCreateSourceRequestDto["source"]["sourceProtocol"];
  url: string;
  content: string | null;
  tags: string[];
  status: SourceStatus;
  updatedAt: string;
}> {
  const normalizedId = normalizeOptionalString(source.id);
  const normalizedName = normalizeOptionalString(source.name);
  const normalizedSourceType =
    normalizeOptionalString(source.sourceType) ?? "remote";
  const normalizedUrl = normalizeOptionalString(source.url);
  const normalizedContent = normalizeOptionalString(source.content);
  const normalizedTags = normalizeTags(source.tags);
  const normalizedUpdatedAt = normalizeOptionalString(source.updatedAt);
  const normalizedSourceProtocol = normalizeOptionalString(source.sourceProtocol);

  if (!normalizedName) {
    return createValidationFailure(
      "validation_failed",
      'Source "name" cannot be empty.'
    );
  }

  if (!SOURCE_TYPE_VALUES.includes(normalizedSourceType as SourceType)) {
    return createValidationFailure(
      "validation_failed",
      'Source "sourceType" must be either "remote" or "raw".'
    );
  }

  if (!SOURCE_STATUS_VALUES.includes(source.status as SourceStatus)) {
    return createValidationFailure(
      "validation_failed",
      'Source "status" is invalid.'
    );
  }

  if (normalizedTags === null) {
    return createValidationFailure(
      "validation_failed",
      'Source "tags" must be a string array.'
    );
  }

  if (normalizedSourceType === "remote") {
    if (!normalizedUrl) {
      return createValidationFailure(
        "validation_failed",
        'Remote source "url" cannot be empty.'
      );
    }

    if (!isHttpSubscriptionUrl(normalizedUrl)) {
      return createValidationFailure(
        "validation_failed",
        'Remote source "url" must be a valid http/https URL.'
      );
    }

    return createValidationSuccess({
      id: normalizedId,
      name: normalizedName,
      sourceType: "remote",
      sourceProtocol:
        (normalizedSourceProtocol === "http" || normalizedSourceProtocol === "https"
          ? normalizedSourceProtocol
          : resolveSourceProtocol(normalizedUrl)) ?? "https",
      url: normalizedUrl,
      content: null,
      tags: normalizedTags,
      status: source.status as SourceStatus,
      updatedAt: normalizedUpdatedAt ?? "",
    });
  }

  const rawContent = normalizedContent ?? normalizedUrl;
  if (!rawContent) {
    return createValidationFailure(
      "validation_failed",
      'Raw source "content" cannot be empty.'
    );
  }

  const resolvedProtocol = resolveSourceProtocol(rawContent);
  if (
    !resolvedProtocol ||
    resolvedProtocol === "http" ||
    resolvedProtocol === "https" ||
    resolvedProtocol === "unknown"
  ) {
    return createValidationFailure(
      "validation_failed",
      'Raw source "content" must start with vmess://, vless://, trojan://, ss:// or socks://.'
    );
  }

  return createValidationSuccess({
    id: normalizedId,
    name: normalizedName,
    sourceType: "raw",
    sourceProtocol:
      (normalizedSourceProtocol === "vmess" ||
      normalizedSourceProtocol === "vless" ||
      normalizedSourceProtocol === "trojan" ||
      normalizedSourceProtocol === "ss" ||
      normalizedSourceProtocol === "socks" ||
      normalizedSourceProtocol === "mixed"
        ? normalizedSourceProtocol
        : resolvedProtocol) ?? resolvedProtocol,
    url: rawContent,
    content: rawContent,
    tags: normalizedTags,
    status: source.status as SourceStatus,
    updatedAt: normalizedUpdatedAt ?? "",
  });
}

export function validateCreateSourceRequest(
  currentState: AppDataState,
  request: RemoteCreateSourceRequestDto
): AppDataStoreMutationResult<RemoteCreateSourceRequestDto> {
  if (!request?.source) {
    return createValidationFailure(
      "validation_failed",
      'Request body must include a valid "source" object.'
    );
  }

  const { source } = request;
  const normalizedSourceResult = normalizeSourceInput(source);
  if (!normalizedSourceResult.ok) {
    return normalizedSourceResult;
  }

  const normalizedSource = normalizedSourceResult.data;

  if (
    normalizedSource.id &&
    currentState.sources.some((item) => item.id === normalizedSource.id)
  ) {
    return createValidationFailure(
      "validation_failed",
      `Source id "${normalizedSource.id}" already exists.`
    );
  }

  return createValidationSuccess({
    source: {
      ...source,
      id: normalizedSource.id,
      name: normalizedSource.name,
      sourceType: normalizedSource.sourceType,
      sourceProtocol: normalizedSource.sourceProtocol,
      url: normalizedSource.url,
      content: normalizedSource.content,
      tags: normalizedSource.tags,
      status: normalizedSource.status,
      updatedAt: normalizedSource.updatedAt,
    },
  });
}

export function validateUpdateSourceRequest(
  sourceId: string,
  request: RemoteUpdateSourceRequestDto
): AppDataStoreMutationResult<RemoteUpdateSourceRequestDto> {
  if (!request?.source) {
    return createValidationFailure(
      "validation_failed",
      'Request body must include a valid "source" object.'
    );
  }

  if (isString(request.sourceId) && request.sourceId.trim() !== sourceId) {
    return createValidationFailure(
      "validation_failed",
      'Request "sourceId" does not match the route parameter.'
    );
  }

  const normalizedSourceResult = normalizeSourceInput(request.source);
  if (!normalizedSourceResult.ok) {
    return normalizedSourceResult;
  }

  if (!normalizedSourceResult.data.updatedAt) {
    return createValidationFailure(
      "validation_failed",
      'Source "updatedAt" cannot be empty.'
    );
  }

  return createValidationSuccess({
    sourceId,
    source: {
      ...request.source,
      name: normalizedSourceResult.data.name,
      sourceType: normalizedSourceResult.data.sourceType,
      sourceProtocol: normalizedSourceResult.data.sourceProtocol,
      url: normalizedSourceResult.data.url,
      content: normalizedSourceResult.data.content,
      tags: normalizedSourceResult.data.tags,
      status: normalizedSourceResult.data.status,
      updatedAt: normalizedSourceResult.data.updatedAt,
    },
  });
}

export function validateSaveSettingsRequest(
  request: RemoteSaveSettingsRequestDto
): AppDataStoreMutationResult<RemoteSaveSettingsRequestDto> {
  if (!request?.settings || typeof request.settings !== "object") {
    return createValidationFailure(
      "validation_failed",
      'Request body must include a valid "settings" object.'
    );
  }

  const { settings } = request;

  if (settings.serviceUrl !== undefined) {
    if (!isString(settings.serviceUrl)) {
      return createValidationFailure(
        "validation_failed",
        '"serviceUrl" must be a string.'
      );
    }

    const normalizedServiceUrl = settings.serviceUrl.trim();
    if (normalizedServiceUrl.length > 0 && !isHttpSubscriptionUrl(normalizedServiceUrl)) {
      return createValidationFailure(
        "validation_failed",
        '"serviceUrl" must be a valid http/https URL when provided.'
      );
    }

    settings.serviceUrl = normalizedServiceUrl;
  }

  if (settings.apiPath !== undefined && !isString(settings.apiPath)) {
    return createValidationFailure(
      "validation_failed",
      '"apiPath" must be a string.'
    );
  }

  if (settings.publishDomain !== undefined && !isString(settings.publishDomain)) {
    return createValidationFailure(
      "validation_failed",
      '"publishDomain" must be a string.'
    );
  }

  if (
    settings.httpsEnabled !== undefined &&
    !isBoolean(settings.httpsEnabled)
  ) {
    return createValidationFailure(
      "validation_failed",
      '"httpsEnabled" must be a boolean.'
    );
  }

  if (
    settings.serviceCheckStatus !== undefined &&
    !SERVICE_CHECK_STATUS_VALUES.includes(settings.serviceCheckStatus)
  ) {
    return createValidationFailure(
      "validation_failed",
      '"serviceCheckStatus" is invalid.'
    );
  }

  if (
    settings.serviceLastCheckedAt !== undefined &&
    settings.serviceLastCheckedAt !== null &&
    !isString(settings.serviceLastCheckedAt)
  ) {
    return createValidationFailure(
      "validation_failed",
      '"serviceLastCheckedAt" must be a string or null.'
    );
  }

  if (
    settings.userNoticeEnabled !== undefined &&
    !isBoolean(settings.userNoticeEnabled)
  ) {
    return createValidationFailure(
      "validation_failed",
      '"userNoticeEnabled" must be a boolean.'
    );
  }

  if (
    settings.userNoticeTitle !== undefined &&
    !isString(settings.userNoticeTitle)
  ) {
    return createValidationFailure(
      "validation_failed",
      '"userNoticeTitle" must be a string.'
    );
  }

  if (
    settings.userNoticeMessage !== undefined &&
    !isString(settings.userNoticeMessage)
  ) {
    return createValidationFailure(
      "validation_failed",
      '"userNoticeMessage" must be a string.'
    );
  }

  if (
    settings.userNoticeUpdatedAt !== undefined &&
    settings.userNoticeUpdatedAt !== null &&
    !isString(settings.userNoticeUpdatedAt)
  ) {
    return createValidationFailure(
      "validation_failed",
      '"userNoticeUpdatedAt" must be a string or null.'
    );
  }

  return createValidationSuccess(request);
}

export function validateSaveOutputConfigRequest(
  currentState: AppDataState,
  request: RemoteSaveOutputConfigRequestDto
): AppDataStoreMutationResult<RemoteSaveOutputConfigRequestDto> {
  if (!request?.outputConfig || typeof request.outputConfig !== "object") {
    return createValidationFailure(
      "validation_failed",
      'Request body must include a valid "outputConfig" object.'
    );
  }

  const { outputConfig } = request;

  if (
    outputConfig.defaultOutputFormat !== undefined &&
    !OUTPUT_FORMAT_VALUES.includes(outputConfig.defaultOutputFormat)
  ) {
    return createValidationFailure(
      "invalid_output_format",
      `"defaultOutputFormat" must be one of: ${OUTPUT_FORMAT_VALUES.join(", ")}.`
    );
  }

  if (outputConfig.defaultSourceId !== undefined) {
    if (
      outputConfig.defaultSourceId !== null &&
      !isString(outputConfig.defaultSourceId)
    ) {
      return createValidationFailure(
        "validation_failed",
        '"defaultSourceId" must be a string or null.'
      );
    }

    if (
      isString(outputConfig.defaultSourceId) &&
      !currentState.sources.some((source) => source.id === outputConfig.defaultSourceId)
    ) {
      return createValidationFailure(
        "source_not_found",
        `Default source "${outputConfig.defaultSourceId}" could not be found.`,
        404
      );
    }
  }

  if (
    outputConfig.urlTokenEnabled !== undefined &&
    !isBoolean(outputConfig.urlTokenEnabled)
  ) {
    return createValidationFailure(
      "validation_failed",
      '"urlTokenEnabled" must be a boolean.'
    );
  }

  if (outputConfig.publishedSourceIds !== undefined) {
    if (!Array.isArray(outputConfig.publishedSourceIds)) {
      return createValidationFailure(
        "validation_failed",
        '"publishedSourceIds" must be a string array.'
      );
    }

    const normalizedPublishedSourceIds = outputConfig.publishedSourceIds
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    if (normalizedPublishedSourceIds.length !== outputConfig.publishedSourceIds.length) {
      return createValidationFailure(
        "validation_failed",
        '"publishedSourceIds" must be a string array.'
      );
    }

    const missingPublishedSourceIds = normalizedPublishedSourceIds.filter(
      (sourceId) => !currentState.sources.some((source) => source.id === sourceId)
    );

    if (missingPublishedSourceIds.length > 0) {
      return createValidationFailure(
        "source_not_found",
        `Published source "${missingPublishedSourceIds[0]}" could not be found.`,
        404
      );
    }
  }

  if (
    outputConfig.publishedAt !== undefined &&
    outputConfig.publishedAt !== null &&
    !isString(outputConfig.publishedAt)
  ) {
    return createValidationFailure(
      "validation_failed",
      '"publishedAt" must be a string or null.'
    );
  }

  if (
    outputConfig.publishedVersionId !== undefined &&
    outputConfig.publishedVersionId !== null &&
    (typeof outputConfig.publishedVersionId !== "number" ||
      !Number.isFinite(outputConfig.publishedVersionId))
  ) {
    return createValidationFailure(
      "validation_failed",
      '"publishedVersionId" must be a number or null.'
    );
  }

  return createValidationSuccess(request);
}

export function validateSetRoleRequest(
  request: RemoteSetRoleRequestDto
): AppDataStoreMutationResult<RemoteSetRoleRequestDto> {
  if (!request || !isString(request.role)) {
    return createValidationFailure(
      "validation_failed",
      'Request body must include a valid "role".'
    );
  }

  if (!USER_ROLE_VALUES.includes(request.role as UserRole)) {
    return createValidationFailure(
      "invalid_role",
      '"role" must be either "admin" or "viewer".'
    );
  }

  return createValidationSuccess({
    role: request.role as UserRole,
  });
}
