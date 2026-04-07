import type { AppDataState, SourceItem } from "../../app/_types/app-types";
import type {
  RemoteApiErrorDto,
  RemoteAppDataDto,
  RemoteCreateSourceRequestDto,
  RemoteOutputConfigDto,
  RemoteRoleDto,
  RemoteSettingsDto,
  RemoteSourceDto,
} from "../../app/_data/repositories/remote-app-data-api-types";
import {
  appDataReducer,
  normalizeAppDataState,
} from "../../app/_data/services/app-data-service";
import {
  readStoredAppDataState,
  resetStoredAppDataState,
  updateStoredAppDataState,
  writeStoredAppDataState,
} from "./app-data-storage";
import type {
  AppDataStore,
  AppDataStoreMutationResult,
} from "./app-data-store-contract";

function createStoreError(
  code: string,
  message: string,
  recoverable = true
): RemoteApiErrorDto {
  return {
    code,
    message,
    recoverable,
  };
}

function createMutationSuccess<T>(data: T): AppDataStoreMutationResult<T> {
  return {
    ok: true,
    data,
  };
}

function createMutationFailure<T>(
  status: number,
  code: string,
  message: string,
  recoverable = true
): AppDataStoreMutationResult<T> {
  return {
    ok: false,
    status,
    error: createStoreError(code, message, recoverable),
  };
}

function mapSourceToDto(source: SourceItem): RemoteSourceDto {
  return {
    id: source.id,
    name: source.name,
    sourceType: source.sourceType,
    sourceProtocol: source.sourceProtocol,
    url: source.url,
    content: source.content,
    tags: [...source.tags],
    status: source.status,
    updatedAt: source.updatedAt,
  };
}

function mapStateToOutputConfigDto(state: AppDataState): RemoteOutputConfigDto {
  return {
    defaultSourceId: state.defaultSourceId,
    defaultOutputFormat: state.defaultOutputFormat,
    urlTokenEnabled: state.urlTokenEnabled,
    publishedSourceIds: state.publishedSourceIds,
    publishedAt: state.publishedAt,
    publishedVersionId: state.publishedVersionId,
  };
}

function mapStateToSettingsDto(state: AppDataState): RemoteSettingsDto {
  return {
    serviceUrl: state.serviceUrl,
    apiPath: state.apiPath,
    serviceCheckStatus: state.serviceCheckStatus,
    serviceLastCheckedAt: state.serviceLastCheckedAt,
    publishDomain: state.publishDomain,
    httpsEnabled: state.httpsEnabled,
    userNoticeEnabled: state.userNoticeEnabled,
    userNoticeTitle: state.userNoticeTitle,
    userNoticeMessage: state.userNoticeMessage,
    userNoticeUpdatedAt: state.userNoticeUpdatedAt,
  };
}

function mapStateToRoleDto(state: AppDataState): RemoteRoleDto {
  return {
    role: state.role,
  };
}

function mapStateToAppDataDto(state: AppDataState): RemoteAppDataDto {
  return {
    role: state.role,
    sources: state.sources.map(mapSourceToDto),
    outputConfig: mapStateToOutputConfigDto(state),
    settings: mapStateToSettingsDto(state),
  };
}

function mapStateToSourcesDto(state: AppDataState): RemoteSourceDto[] {
  return state.sources.map(mapSourceToDto);
}

function mapAppDataDtoToState(appData: RemoteAppDataDto): AppDataState {
  return normalizeAppDataState({
    role: appData.role,
    sources: appData.sources.map((source) => ({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      sourceProtocol: source.sourceProtocol,
      url: source.url,
      content: source.content,
      tags: [...source.tags],
      status: source.status,
      updatedAt: source.updatedAt,
    })),
    defaultSourceId: appData.outputConfig.defaultSourceId,
    defaultOutputFormat: appData.outputConfig.defaultOutputFormat,
    urlTokenEnabled: appData.outputConfig.urlTokenEnabled,
    publishedSourceIds: appData.outputConfig.publishedSourceIds,
    publishedAt: appData.outputConfig.publishedAt,
    publishedVersionId: appData.outputConfig.publishedVersionId,
    serviceUrl: appData.settings.serviceUrl,
    apiPath: appData.settings.apiPath,
    serviceCheckStatus: appData.settings.serviceCheckStatus,
    serviceLastCheckedAt: appData.settings.serviceLastCheckedAt,
    publishDomain: appData.settings.publishDomain,
    httpsEnabled: appData.settings.httpsEnabled,
    userNoticeEnabled: appData.settings.userNoticeEnabled,
    userNoticeTitle: appData.settings.userNoticeTitle,
    userNoticeMessage: appData.settings.userNoticeMessage,
    userNoticeUpdatedAt: appData.settings.userNoticeUpdatedAt,
  });
}

function createSourceItem(
  source: RemoteCreateSourceRequestDto["source"]
): SourceItem {
  return {
    id: source.id?.trim() || `src-${crypto.randomUUID().slice(0, 8)}`,
    name: source.name,
    sourceType: source.sourceType,
    sourceProtocol: source.sourceProtocol,
    url: source.url,
    content: source.content,
    tags: [...source.tags],
    status: source.status,
    updatedAt: source.updatedAt || new Date().toISOString(),
  };
}

function applySettingsPatch(
  state: AppDataState,
  settings: Partial<RemoteSettingsDto>
): AppDataState {
  let nextState = state;

  if (settings.serviceUrl !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_service_url",
      serviceUrl: settings.serviceUrl,
    });
  }

  if (settings.apiPath !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_api_path",
      apiPath: settings.apiPath,
    });
  }

  if (settings.serviceCheckStatus !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_service_check_status",
      status: settings.serviceCheckStatus,
    });
  }

  if (settings.serviceLastCheckedAt !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_service_last_checked_at",
      checkedAt: settings.serviceLastCheckedAt,
    });
  }

  if (settings.publishDomain !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_publish_domain",
      publishDomain: settings.publishDomain,
    });
  }

  if (settings.httpsEnabled !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_https_enabled",
      httpsEnabled: settings.httpsEnabled,
    });
  }

  if (settings.userNoticeEnabled !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_user_notice_enabled",
      enabled: settings.userNoticeEnabled,
    });
  }

  if (settings.userNoticeTitle !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_user_notice_title",
      title: settings.userNoticeTitle,
    });
  }

  if (settings.userNoticeMessage !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_user_notice_message",
      message: settings.userNoticeMessage,
    });
  }

  if (settings.userNoticeUpdatedAt !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_user_notice_updated_at",
      updatedAt: settings.userNoticeUpdatedAt,
    });
  }

  return normalizeAppDataState(nextState);
}

function applyOutputConfigPatch(
  state: AppDataState,
  outputConfig: Partial<RemoteOutputConfigDto>
): AppDataState {
  let nextState = state;

  if (outputConfig.defaultSourceId !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_default_source",
      id: outputConfig.defaultSourceId,
    });
  }

  if (outputConfig.defaultOutputFormat !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_default_output_format",
      format: outputConfig.defaultOutputFormat,
    });
  }

  if (outputConfig.urlTokenEnabled !== undefined) {
    nextState = appDataReducer(nextState, {
      type: "set_url_token_enabled",
      enabled: outputConfig.urlTokenEnabled,
    });
  }

  if (
    outputConfig.publishedSourceIds !== undefined ||
    outputConfig.publishedAt !== undefined ||
    outputConfig.publishedVersionId !== undefined
  ) {
    nextState = appDataReducer(nextState, {
      type: "set_published_output_sources",
      sourceIds: outputConfig.publishedSourceIds ?? nextState.publishedSourceIds,
      publishedAt: outputConfig.publishedAt ?? nextState.publishedAt,
      publishedVersionId:
        outputConfig.publishedVersionId ?? nextState.publishedVersionId,
    });
  }

  return normalizeAppDataState(nextState);
}

function createSqliteAppDataStore(): AppDataStore {
  return {
    async loadAppData() {
      return mapStateToAppDataDto(await readStoredAppDataState());
    },
    async saveAppData(appData) {
      const nextState = await writeStoredAppDataState(mapAppDataDtoToState(appData));
      return createMutationSuccess(mapStateToAppDataDto(nextState));
    },
    async resetAppData() {
      return mapStateToAppDataDto(await resetStoredAppDataState());
    },
    async listSources() {
      return mapStateToSourcesDto(await readStoredAppDataState());
    },
    async createSource(request) {
      const nextState = await updateStoredAppDataState((currentState) =>
        appDataReducer(currentState, {
          type: "add_source",
          source: createSourceItem(request.source),
        })
      );

      return createMutationSuccess(mapStateToSourcesDto(nextState));
    },
    async updateSource(sourceId, request) {
      const currentState = await readStoredAppDataState();
      const targetExists = currentState.sources.some((source) => source.id === sourceId);

      if (!targetExists) {
        return createMutationFailure(
          404,
          "source_not_found",
          `Source "${sourceId}" could not be found.`
        );
      }

      const nextState = await updateStoredAppDataState((state) =>
        appDataReducer(state, {
          type: "update_source",
          id: sourceId,
          source: {
            name: request.source.name,
            sourceType: request.source.sourceType,
            sourceProtocol: request.source.sourceProtocol,
            url: request.source.url,
            content: request.source.content,
            tags: [...request.source.tags],
            status: request.source.status,
            updatedAt: request.source.updatedAt,
          },
        })
      );

      return createMutationSuccess(mapStateToSourcesDto(nextState));
    },
    async removeSource(sourceId) {
      const currentState = await readStoredAppDataState();
      const targetExists = currentState.sources.some((source) => source.id === sourceId);

      if (!targetExists) {
        return createMutationFailure(
          404,
          "source_not_found",
          `Source "${sourceId}" could not be found.`
        );
      }

      const nextState = await updateStoredAppDataState((state) =>
        appDataReducer(state, {
          type: "delete_source",
          id: sourceId,
        })
      );

      return createMutationSuccess(mapStateToSourcesDto(nextState));
    },
    async getSettings() {
      return mapStateToSettingsDto(await readStoredAppDataState());
    },
    async saveSettings(request) {
      const nextState = await updateStoredAppDataState((currentState) =>
        applySettingsPatch(currentState, request.settings)
      );

      return createMutationSuccess(mapStateToSettingsDto(nextState));
    },
    async resetSettings() {
      const nextState = await updateStoredAppDataState((currentState) =>
        appDataReducer(currentState, {
          type: "reset_settings_defaults",
        })
      );

      return mapStateToSettingsDto(nextState);
    },
    async getOutputConfig() {
      return mapStateToOutputConfigDto(await readStoredAppDataState());
    },
    async saveOutputConfig(request) {
      const nextState = await updateStoredAppDataState((currentState) =>
        applyOutputConfigPatch(currentState, request.outputConfig)
      );

      return createMutationSuccess(mapStateToOutputConfigDto(nextState));
    },
    async getRole() {
      return mapStateToRoleDto(await readStoredAppDataState());
    },
    async setRole(request) {
      const nextState = await updateStoredAppDataState((currentState) =>
        appDataReducer(currentState, {
          type: "set_role",
          role: request.role,
        })
      );

      return createMutationSuccess(mapStateToRoleDto(nextState));
    },
  };
}

export const mockAppDataStore = createSqliteAppDataStore();
