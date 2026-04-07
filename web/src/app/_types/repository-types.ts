import type {
  AppDataState,
  OutputFormatId,
  ServiceCheckStatus,
  SourceItem,
  UserRole,
} from "./app-types";

export type OutputConfigState = {
  defaultSourceId: string | null;
  defaultOutputFormat: OutputFormatId;
  urlTokenEnabled: boolean;
  publishedSourceIds: string[];
  publishedAt: string | null;
  publishedVersionId: number | null;
};

export type OutputConfigPatch = Partial<OutputConfigState>;

export type SystemSettingsState = {
  serviceUrl: string;
  apiPath: string;
  serviceCheckStatus: ServiceCheckStatus;
  serviceLastCheckedAt: string | null;
  publishDomain: string;
  httpsEnabled: boolean;
  userNoticeEnabled: boolean;
  userNoticeTitle: string;
  userNoticeMessage: string;
  userNoticeUpdatedAt: string | null;
};

export type SystemSettingsPatch = Partial<SystemSettingsState>;

export type SourcesData = {
  items: SourceItem[];
};

export type RoleData = {
  role: UserRole;
};

export type RepositoryErrorCode =
  | "not_implemented"
  | "remote_request_failed"
  | "remote_response_invalid"
  | "validation_failed"
  | "invalid_output_format"
  | "invalid_role"
  | "source_not_found"
  | "storage_unavailable"
  | "storage_parse_failed"
  | "storage_write_failed"
  | "storage_clear_failed"
  | "unknown";

export type RepositoryError = {
  code: RepositoryErrorCode;
  message: string;
  recoverable: boolean;
};

export type RepositoryResult<T> = {
  ok: boolean;
  data: T;
  state: AppDataState;
  error: RepositoryError | null;
};

export type RepositoryMaybePromise<T> = T | Promise<T>;

export type LoadAppDataRequest = {
  fallbackState?: AppDataState;
};

export type SaveAppDataRequest = {
  state: AppDataState;
};

export type ResetAppDataRequest = {
  fallbackState?: AppDataState;
};

export type StateRequest = {
  state: AppDataState;
};

export type CreateSourceRequest = StateRequest & {
  source: SourceItem;
};

export type UpdateSourceRequest = StateRequest & {
  sourceId: string;
  source: Omit<SourceItem, "id">;
};

export type RemoveSourceRequest = StateRequest & {
  sourceId: string;
};

export type SaveOutputConfigRequest = StateRequest & {
  outputConfig: OutputConfigPatch;
};

export type SaveSettingsRequest = StateRequest & {
  settings: SystemSettingsPatch;
};

export type SetRoleRequest = StateRequest & {
  role: UserRole;
};

export type AppDataRepository = {
  loadAppData: (
    request?: LoadAppDataRequest
  ) => RepositoryMaybePromise<RepositoryResult<AppDataState>>;
  saveAppData: (
    request: SaveAppDataRequest
  ) => RepositoryMaybePromise<RepositoryResult<AppDataState>>;
  getSources: (
    request: StateRequest
  ) => RepositoryMaybePromise<RepositoryResult<SourcesData>>;
  createSource: (
    request: CreateSourceRequest
  ) => RepositoryMaybePromise<RepositoryResult<SourcesData>>;
  updateSource: (
    request: UpdateSourceRequest
  ) => RepositoryMaybePromise<RepositoryResult<SourcesData>>;
  removeSource: (
    request: RemoveSourceRequest
  ) => RepositoryMaybePromise<RepositoryResult<SourcesData>>;
  getOutputConfig: (
    request: StateRequest
  ) => RepositoryMaybePromise<RepositoryResult<OutputConfigState>>;
  saveOutputConfig: (
    request: SaveOutputConfigRequest
  ) => RepositoryMaybePromise<RepositoryResult<OutputConfigState>>;
  getSettings: (
    request: StateRequest
  ) => RepositoryMaybePromise<RepositoryResult<SystemSettingsState>>;
  saveSettings: (
    request: SaveSettingsRequest
  ) => RepositoryMaybePromise<RepositoryResult<SystemSettingsState>>;
  getRole: (
    request: StateRequest
  ) => RepositoryMaybePromise<RepositoryResult<RoleData>>;
  setRole: (
    request: SetRoleRequest
  ) => RepositoryMaybePromise<RepositoryResult<RoleData>>;
  resetSettings: (
    request: StateRequest
  ) => RepositoryMaybePromise<RepositoryResult<SystemSettingsState>>;
  resetAppData: (
    request?: ResetAppDataRequest
  ) => RepositoryMaybePromise<RepositoryResult<AppDataState>>;
};
