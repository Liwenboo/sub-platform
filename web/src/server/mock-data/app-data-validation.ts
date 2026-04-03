import type {
  OutputFormatId,
  SourceStatus,
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
import type { AppDataStoreMutationResult } from "./app-data-store-contract";

const SOURCE_STATUS_VALUES: SourceStatus[] = ["online", "warning", "paused"];
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

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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
  const normalizedId = normalizeOptionalString(source.id);
  const normalizedName = normalizeOptionalString(source.name);
  const normalizedUrl = normalizeOptionalString(source.url);
  const normalizedTags = normalizeTags(source.tags);
  const normalizedUpdatedAt = normalizeOptionalString(source.updatedAt);

  if (!normalizedName) {
    return createValidationFailure(
      "validation_failed",
      'Source "name" cannot be empty.'
    );
  }

  if (!normalizedUrl) {
    return createValidationFailure(
      "validation_failed",
      'Source "url" cannot be empty.'
    );
  }

  if (!isHttpUrl(normalizedUrl)) {
    return createValidationFailure(
      "validation_failed",
      'Source "url" must be a valid http/https URL.'
    );
  }

  if (!SOURCE_STATUS_VALUES.includes(source.status)) {
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

  if (
    normalizedId &&
    currentState.sources.some((item) => item.id === normalizedId)
  ) {
    return createValidationFailure(
      "validation_failed",
      `Source id "${normalizedId}" already exists.`
    );
  }

  return createValidationSuccess({
    source: {
      ...source,
      id: normalizedId,
      name: normalizedName,
      url: normalizedUrl,
      tags: normalizedTags,
      updatedAt: normalizedUpdatedAt ?? "",
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

  const normalizedName = normalizeOptionalString(request.source.name);
  const normalizedUrl = normalizeOptionalString(request.source.url);
  const normalizedTags = normalizeTags(request.source.tags);
  const normalizedUpdatedAt = normalizeOptionalString(request.source.updatedAt);

  if (!normalizedName) {
    return createValidationFailure(
      "validation_failed",
      'Source "name" cannot be empty.'
    );
  }

  if (!normalizedUrl) {
    return createValidationFailure(
      "validation_failed",
      'Source "url" cannot be empty.'
    );
  }

  if (!isHttpUrl(normalizedUrl)) {
    return createValidationFailure(
      "validation_failed",
      'Source "url" must be a valid http/https URL.'
    );
  }

  if (!SOURCE_STATUS_VALUES.includes(request.source.status)) {
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

  if (!normalizedUpdatedAt) {
    return createValidationFailure(
      "validation_failed",
      'Source "updatedAt" cannot be empty.'
    );
  }

  return createValidationSuccess({
    sourceId,
    source: {
      ...request.source,
      name: normalizedName,
      url: normalizedUrl,
      tags: normalizedTags,
      updatedAt: normalizedUpdatedAt,
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
    if (normalizedServiceUrl.length > 0 && !isHttpUrl(normalizedServiceUrl)) {
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
