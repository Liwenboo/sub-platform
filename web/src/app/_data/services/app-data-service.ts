import {
  APP_DEFAULT_ROLE,
  APP_DEFAULT_SOURCE_STATUS,
  APP_DEFAULT_SOURCE_UPDATED_AT,
  APP_INITIAL_SOURCES,
  APP_SETTINGS_DEFAULTS,
  cloneDefaultSources,
} from "../defaults/app-data-defaults";
import {
  isHttpSubscriptionUrl,
  resolveSourceProtocol,
} from "./source-entry-service";
import type {
  AppDataState,
  OutputFormatId,
  PersistedAppDataSnapshot,
  ServiceCheckStatus,
  SourceProtocol,
  SourceItem,
  SourceStatus,
  SourceType,
  UserRole,
} from "../../_types/app-types";

export type AppDataAction =
  | { type: "hydrate_from_snapshot"; snapshot: PersistedAppDataSnapshot | null }
  | { type: "set_role"; role: UserRole }
  | { type: "add_source"; source: SourceItem }
  | { type: "update_source"; id: string; source: Omit<SourceItem, "id"> }
  | { type: "delete_source"; id: string }
  | { type: "set_default_source"; id: string | null }
  | { type: "set_default_output_format"; format: OutputFormatId }
  | { type: "set_url_token_enabled"; enabled: boolean }
  | { type: "set_service_url"; serviceUrl: string }
  | { type: "set_api_path"; apiPath: string }
  | { type: "set_service_check_status"; status: ServiceCheckStatus }
  | { type: "set_service_last_checked_at"; checkedAt: string | null }
  | { type: "set_publish_domain"; publishDomain: string }
  | { type: "set_https_enabled"; httpsEnabled: boolean }
  | { type: "reset_settings_defaults" }
  | { type: "reset_local_data" };

const outputFormatIds: OutputFormatId[] = [
  "clash",
  "clash-meta",
  "v2ray",
  "sing-box",
];
const sourceStatusValues: SourceStatus[] = ["online", "warning", "paused"];
const serviceCheckStatusValues: ServiceCheckStatus[] = [
  "not_checked",
  "checking",
  "success",
  "failed",
];
const baseDefaultSourceId = APP_INITIAL_SOURCES[0]?.id ?? null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRole(value: unknown): UserRole | null {
  if (value === "admin" || value === "viewer") {
    return value;
  }

  if (value === "guest") {
    return "viewer";
  }

  return null;
}

function normalizeOutputFormat(value: unknown): OutputFormatId | null {
  if (typeof value !== "string") {
    return null;
  }

  return outputFormatIds.includes(value as OutputFormatId)
    ? (value as OutputFormatId)
    : null;
}

function normalizeSourceStatus(value: unknown): SourceStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  return sourceStatusValues.includes(value as SourceStatus)
    ? (value as SourceStatus)
    : null;
}

function normalizeSourceType(value: unknown): SourceType | null {
  if (value === "remote" || value === "raw") {
    return value;
  }

  return null;
}

function normalizeSourceProtocol(value: unknown): SourceProtocol | null {
  if (
    value === "http" ||
    value === "https" ||
    value === "vmess" ||
    value === "vless" ||
    value === "trojan" ||
    value === "ss" ||
    value === "socks" ||
    value === "mixed" ||
    value === "unknown"
  ) {
    return value;
  }

  return null;
}

function normalizeServiceCheckStatus(value: unknown): ServiceCheckStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  return serviceCheckStatusValues.includes(value as ServiceCheckStatus)
    ? (value as ServiceCheckStatus)
    : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeOptionalCheckedAt(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickFromRecord(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }

  return undefined;
}

function pickFromRecords(keys: string[], records: Array<Record<string, unknown> | null>): unknown {
  for (const record of records) {
    if (!record) {
      continue;
    }

    const value = pickFromRecord(record, keys);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function isNormalizedSourceItem(value: unknown): value is SourceItem {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    return false;
  }

  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    return false;
  }

  if (!normalizeSourceType(value.sourceType)) {
    return false;
  }

  if (!normalizeSourceProtocol(value.sourceProtocol)) {
    return false;
  }

  if (typeof value.url !== "string" || value.url.trim().length === 0) {
    return false;
  }

  if (
    value.content !== null &&
    value.content !== undefined &&
    (typeof value.content !== "string" || value.content.trim().length === 0)
  ) {
    return false;
  }

  if (!normalizeSourceStatus(value.status)) {
    return false;
  }

  if (typeof value.updatedAt !== "string" || value.updatedAt.trim().length === 0) {
    return false;
  }

  if (!Array.isArray(value.tags)) {
    return false;
  }

  return value.tags.every(
    (tag) => typeof tag === "string" && tag.trim().length > 0 && tag.trim() === tag
  );
}

function sanitizeSourceItem(value: unknown, index: number): SourceItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id =
    normalizeNonEmptyString(
      pickFromRecord(value, ["id", "sourceId", "key", "uuid"]),
      `src-legacy-${index + 1}`
    ) || `src-legacy-${index + 1}`;
  const name =
    normalizeNonEmptyString(
      pickFromRecord(value, ["name", "sourceName", "title"]),
      `导入源 ${index + 1}`
    ) || `导入源 ${index + 1}`;
  const rawSourceValue = normalizeNonEmptyString(
    pickFromRecord(value, ["url", "sourceUrl", "subscriptionUrl", "raw", "content"]),
    `https://example.com/sub/legacy-${index + 1}`
  );
  const sourceType =
    normalizeSourceType(pickFromRecord(value, ["sourceType", "type"])) ??
    (isHttpSubscriptionUrl(rawSourceValue) ? "remote" : "raw");
  const content =
    sourceType === "raw"
      ? normalizeNonEmptyString(
          pickFromRecord(value, ["content", "raw", "url", "sourceUrl"]),
          rawSourceValue
        )
      : null;
  const url =
    sourceType === "raw"
      ? content ?? rawSourceValue
      : normalizeNonEmptyString(
          pickFromRecord(value, ["url", "sourceUrl", "subscriptionUrl"]),
          rawSourceValue
        ) || rawSourceValue;
  const sourceProtocol =
    normalizeSourceProtocol(pickFromRecord(value, ["sourceProtocol", "protocol"])) ??
    resolveSourceProtocol(sourceType === "raw" ? content ?? url : url) ??
    (sourceType === "remote" ? "https" : "unknown");
  const status =
    normalizeSourceStatus(pickFromRecord(value, ["status", "state"])) ??
    APP_DEFAULT_SOURCE_STATUS;
  const updatedAt =
    normalizeNonEmptyString(
      pickFromRecord(value, ["updatedAt", "lastUpdatedAt", "lastUpdated"]),
      APP_DEFAULT_SOURCE_UPDATED_AT
    ) || APP_DEFAULT_SOURCE_UPDATED_AT;
  const tags = normalizeTags(pickFromRecord(value, ["tags", "labels"]));

  return {
    id,
    name,
    sourceType,
    sourceProtocol,
    url,
    content,
    status,
    updatedAt,
    tags,
  };
}

function normalizeSources(value: unknown, fallbackSources: SourceItem[]): SourceItem[] {
  if (!Array.isArray(value)) {
    return fallbackSources.map((source) => ({ ...source, tags: [...source.tags] }));
  }

  if (value.length === 0) {
    return [];
  }

  if (value.every((item) => isNormalizedSourceItem(item))) {
    return value as SourceItem[];
  }

  const normalized = value
    .map((item, index) => sanitizeSourceItem(item, index))
    .filter((item): item is SourceItem => item !== null);

  if (normalized.length === 0) {
    return fallbackSources.map((source) => ({ ...source, tags: [...source.tags] }));
  }

  return normalized;
}

function resolveDefaultSourceId(
  sources: SourceItem[],
  defaultSourceId: string | null
): string | null {
  if (sources.length === 0) {
    return null;
  }

  if (defaultSourceId && sources.some((source) => source.id === defaultSourceId)) {
    return defaultSourceId;
  }

  return sources[0].id;
}

function getFallbackDefaultSourceId(sources: SourceItem[]): string | null {
  return resolveDefaultSourceId(sources, baseDefaultSourceId);
}

function createBaseDefaultState(): AppDataState {
  const sources = cloneDefaultSources();

  return {
    role: APP_DEFAULT_ROLE,
    sources,
    defaultSourceId: sources[0]?.id ?? baseDefaultSourceId,
    ...APP_SETTINGS_DEFAULTS,
  };
}

function extractSnapshotRecords(snapshot: PersistedAppDataSnapshot): {
  root: Record<string, unknown>;
  settings: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  service: Record<string, unknown> | null;
  publish: Record<string, unknown> | null;
} {
  const root = snapshot as Record<string, unknown>;
  const settings = isRecord(root.settings) ? root.settings : null;
  const output = isRecord(root.output) ? root.output : null;
  const service = isRecord(root.service) ? root.service : null;
  const publish = isRecord(root.publish) ? root.publish : null;

  return { root, settings, output, service, publish };
}

export function normalizeAppDataState(state: AppDataState): AppDataState {
  const defaultState = createBaseDefaultState();
  const sources = normalizeSources(state.sources, defaultState.sources);
  const nextDefaultSourceId =
    typeof state.defaultSourceId === "string" ? state.defaultSourceId : null;

  return {
    role: normalizeRole(state.role) ?? defaultState.role,
    sources,
    defaultSourceId: resolveDefaultSourceId(sources, nextDefaultSourceId),
    defaultOutputFormat:
      normalizeOutputFormat(state.defaultOutputFormat) ??
      defaultState.defaultOutputFormat,
    urlTokenEnabled:
      normalizeBoolean(state.urlTokenEnabled) ?? defaultState.urlTokenEnabled,
    serviceUrl: normalizeNonEmptyString(state.serviceUrl, defaultState.serviceUrl),
    apiPath: normalizeNonEmptyString(state.apiPath, defaultState.apiPath),
    serviceCheckStatus:
      normalizeServiceCheckStatus(state.serviceCheckStatus) ??
      defaultState.serviceCheckStatus,
    serviceLastCheckedAt: normalizeOptionalCheckedAt(state.serviceLastCheckedAt),
    publishDomain: normalizeNonEmptyString(
      state.publishDomain,
      defaultState.publishDomain
    ),
    httpsEnabled: normalizeBoolean(state.httpsEnabled) ?? defaultState.httpsEnabled,
  };
}

export function createDefaultAppDataState(): AppDataState {
  return normalizeAppDataState(createBaseDefaultState());
}

export function hydrateAppDataState(
  defaultState: AppDataState,
  snapshot: PersistedAppDataSnapshot | null
): AppDataState {
  if (!snapshot || !isRecord(snapshot)) {
    return normalizeAppDataState(defaultState);
  }

  const nextState: AppDataState = { ...defaultState };
  const { root, settings, output, service, publish } = extractSnapshotRecords(snapshot);
  const role = normalizeRole(
    pickFromRecords(["role", "currentRole", "userRole"], [root, settings])
  );

  if (role) {
    nextState.role = role;
  }

  const rawSources = pickFromRecords(
    ["sources", "sourceList", "subscriptions"],
    [root, settings]
  );
  if (rawSources !== undefined) {
    nextState.sources = normalizeSources(rawSources, defaultState.sources);
  }

  const defaultSourceId = pickFromRecords(
    ["defaultSourceId", "selectedSourceId"],
    [root, settings, output]
  );
  if (typeof defaultSourceId === "string" || defaultSourceId === null) {
    nextState.defaultSourceId = defaultSourceId;
  }

  const defaultOutputFormat = normalizeOutputFormat(
    pickFromRecords(["defaultOutputFormat", "outputFormat", "format"], [
      root,
      settings,
      output,
    ])
  );
  if (defaultOutputFormat) {
    nextState.defaultOutputFormat = defaultOutputFormat;
  }

  const urlTokenEnabled = normalizeBoolean(
    pickFromRecords(["urlTokenEnabled", "enableUrlToken", "urlToken"], [
      root,
      settings,
      output,
    ])
  );
  if (urlTokenEnabled !== null) {
    nextState.urlTokenEnabled = urlTokenEnabled;
  }

  const serviceUrl = pickFromRecords(
    ["serviceUrl", "subconverterUrl", "url"],
    [root, settings, service]
  );
  if (typeof serviceUrl === "string") {
    nextState.serviceUrl = serviceUrl;
  }

  const apiPath = pickFromRecords(["apiPath", "basePath", "path"], [
    root,
    settings,
    service,
  ]);
  if (typeof apiPath === "string") {
    nextState.apiPath = apiPath;
  }

  const serviceCheckStatus = normalizeServiceCheckStatus(
    pickFromRecords(["serviceCheckStatus", "checkStatus", "status"], [
      root,
      settings,
      service,
    ])
  );
  if (serviceCheckStatus) {
    nextState.serviceCheckStatus = serviceCheckStatus;
  }

  const serviceLastCheckedAt = pickFromRecords(
    ["serviceLastCheckedAt", "lastCheckedAt", "checkedAt"],
    [root, settings, service]
  );
  if (typeof serviceLastCheckedAt === "string" || serviceLastCheckedAt === null) {
    nextState.serviceLastCheckedAt = serviceLastCheckedAt;
  }

  const publishDomain = pickFromRecords(["publishDomain", "domain", "host"], [
    root,
    settings,
    publish,
  ]);
  if (typeof publishDomain === "string") {
    nextState.publishDomain = publishDomain;
  }

  const httpsEnabled = normalizeBoolean(
    pickFromRecords(["httpsEnabled", "enableHttps", "https"], [
      root,
      settings,
      publish,
    ])
  );
  if (httpsEnabled !== null) {
    nextState.httpsEnabled = httpsEnabled;
  }

  return normalizeAppDataState(nextState);
}

export function buildPersistedSnapshot(
  state: AppDataState
): PersistedAppDataSnapshot {
  const normalizedState = normalizeAppDataState(state);

  return {
    version: 1,
    role: normalizedState.role,
    sources: normalizedState.sources,
    defaultSourceId: normalizedState.defaultSourceId,
    defaultOutputFormat: normalizedState.defaultOutputFormat,
    urlTokenEnabled: normalizedState.urlTokenEnabled,
    serviceUrl: normalizedState.serviceUrl,
    apiPath: normalizedState.apiPath,
    serviceCheckStatus: normalizedState.serviceCheckStatus,
    serviceLastCheckedAt: normalizedState.serviceLastCheckedAt,
    publishDomain: normalizedState.publishDomain,
    httpsEnabled: normalizedState.httpsEnabled,
  };
}

export function appDataReducer(
  state: AppDataState,
  action: AppDataAction
): AppDataState {
  if (action.type === "hydrate_from_snapshot") {
    return hydrateAppDataState(createDefaultAppDataState(), action.snapshot);
  }

  if (action.type === "set_role") {
    return normalizeAppDataState({ ...state, role: action.role });
  }

  if (action.type === "add_source") {
    const nextSources = [action.source, ...state.sources];
    return normalizeAppDataState({
      ...state,
      sources: nextSources,
      defaultSourceId: state.defaultSourceId ?? action.source.id,
    });
  }

  if (action.type === "update_source") {
    return normalizeAppDataState({
      ...state,
      sources: state.sources.map((source) =>
        source.id === action.id ? { id: action.id, ...action.source } : source
      ),
    });
  }

  if (action.type === "delete_source") {
    const nextSources = state.sources.filter((source) => source.id !== action.id);
    const defaultSourceStillValid =
      state.defaultSourceId !== null &&
      nextSources.some((source) => source.id === state.defaultSourceId);

    return normalizeAppDataState({
      ...state,
      sources: nextSources,
      defaultSourceId: defaultSourceStillValid
        ? state.defaultSourceId
        : nextSources[0]?.id ?? null,
    });
  }

  if (action.type === "set_default_source") {
    const isValidSelection =
      action.id !== null && state.sources.some((source) => source.id === action.id);

    return normalizeAppDataState({
      ...state,
      defaultSourceId: isValidSelection ? action.id : state.sources[0]?.id ?? null,
    });
  }

  if (action.type === "set_default_output_format") {
    return normalizeAppDataState({ ...state, defaultOutputFormat: action.format });
  }

  if (action.type === "set_url_token_enabled") {
    return normalizeAppDataState({ ...state, urlTokenEnabled: action.enabled });
  }

  if (action.type === "set_service_url") {
    return normalizeAppDataState({
      ...state,
      serviceUrl: action.serviceUrl,
      serviceCheckStatus: "not_checked",
      serviceLastCheckedAt: null,
    });
  }

  if (action.type === "set_api_path") {
    return normalizeAppDataState({
      ...state,
      apiPath: action.apiPath,
      serviceCheckStatus: "not_checked",
      serviceLastCheckedAt: null,
    });
  }

  if (action.type === "set_service_check_status") {
    return normalizeAppDataState({ ...state, serviceCheckStatus: action.status });
  }

  if (action.type === "set_service_last_checked_at") {
    return normalizeAppDataState({ ...state, serviceLastCheckedAt: action.checkedAt });
  }

  if (action.type === "set_publish_domain") {
    return normalizeAppDataState({ ...state, publishDomain: action.publishDomain });
  }

  if (action.type === "set_https_enabled") {
    return normalizeAppDataState({ ...state, httpsEnabled: action.httpsEnabled });
  }

  if (action.type === "reset_settings_defaults") {
    return normalizeAppDataState({
      ...state,
      ...APP_SETTINGS_DEFAULTS,
      defaultSourceId: getFallbackDefaultSourceId(state.sources),
    });
  }

  if (action.type === "reset_local_data") {
    return createDefaultAppDataState();
  }

  return normalizeAppDataState(state);
}
