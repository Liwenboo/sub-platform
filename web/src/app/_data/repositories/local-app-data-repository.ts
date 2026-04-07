"use client";

import type { AppDataState } from "../../_types/app-types";
import type {
  AppDataRepository,
  OutputConfigState,
  RepositoryError,
  RepositoryResult,
  RoleData,
  SourcesData,
  SystemSettingsState,
} from "../../_types/repository-types";
import type { AppDataAction } from "../services/app-data-service";
import {
  appDataReducer,
  buildPersistedSnapshot,
  createDefaultAppDataState,
  hydrateAppDataState,
  normalizeAppDataState,
} from "../services/app-data-service";
import {
  createLocalStorageAppDataAdapter,
  type AppDataStorageAdapter,
  type AppDataStorageAdapterError,
} from "../adapters/local-storage-app-data-adapter";

function reduceAppDataState(state: AppDataState, action: AppDataAction): AppDataState {
  return normalizeAppDataState(appDataReducer(state, action));
}

function getSourcesData(state: AppDataState): SourcesData {
  return { items: state.sources };
}

function getOutputConfigData(state: AppDataState): OutputConfigState {
  return {
    defaultSourceId: state.defaultSourceId,
    defaultOutputFormat: state.defaultOutputFormat,
    urlTokenEnabled: state.urlTokenEnabled,
    publishedSourceIds: state.publishedSourceIds,
    publishedAt: state.publishedAt,
    publishedVersionId: state.publishedVersionId,
  };
}

function getSystemSettingsData(state: AppDataState): SystemSettingsState {
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

function getRoleData(state: AppDataState): RoleData {
  return { role: state.role };
}

function createRepositoryError(
  code: RepositoryError["code"],
  message: string,
  recoverable = true
): RepositoryError {
  return {
    code,
    message,
    recoverable,
  };
}

function mapStorageError(
  error: AppDataStorageAdapterError | null
): RepositoryError | null {
  if (!error) {
    return null;
  }

  return createRepositoryError(error.code, error.message);
}

function createSuccessResult<T>(state: AppDataState, data: T): RepositoryResult<T> {
  return {
    ok: true,
    data,
    state,
    error: null,
  };
}

function createFailureResult<T>(
  state: AppDataState,
  data: T,
  error: RepositoryError
): RepositoryResult<T> {
  return {
    ok: false,
    data,
    state,
    error,
  };
}

function persistAppDataState<T>(
  storageAdapter: AppDataStorageAdapter,
  state: AppDataState,
  data: T
): RepositoryResult<T> {
  const normalizedState = normalizeAppDataState(state);
  const persistResult = storageAdapter.saveSnapshot(
    buildPersistedSnapshot(normalizedState)
  );
  const mappedError = mapStorageError(persistResult.error);

  if (mappedError) {
    return createFailureResult(normalizedState, data, mappedError);
  }

  return createSuccessResult(normalizedState, data);
}

export function createLocalAppDataRepository(
  storageAdapter: AppDataStorageAdapter = createLocalStorageAppDataAdapter()
): AppDataRepository {
  return {
    loadAppData(request) {
      const fallbackState = normalizeAppDataState(
        request?.fallbackState ?? createDefaultAppDataState()
      );
      const { snapshot, error } = storageAdapter.loadSnapshot();
      const nextState = normalizeAppDataState(
        hydrateAppDataState(fallbackState, snapshot)
      );
      const mappedError = mapStorageError(error);

      if (mappedError) {
        return createFailureResult(nextState, nextState, mappedError);
      }

      return createSuccessResult(nextState, nextState);
    },
    saveAppData(request) {
      const nextState = normalizeAppDataState(request.state);
      return persistAppDataState(storageAdapter, nextState, nextState);
    },
    getSources(request) {
      const nextState = normalizeAppDataState(request.state);
      return createSuccessResult(nextState, getSourcesData(nextState));
    },
    createSource(request) {
      const nextState = reduceAppDataState(request.state, {
        type: "add_source",
        source: request.source,
      });

      return persistAppDataState(
        storageAdapter,
        nextState,
        getSourcesData(nextState)
      );
    },
    updateSource(request) {
      const currentState = normalizeAppDataState(request.state);
      const targetExists = currentState.sources.some(
        (source) => source.id === request.sourceId
      );

      if (!targetExists) {
        return createFailureResult(
          currentState,
          getSourcesData(currentState),
          createRepositoryError(
            "source_not_found",
            `Source "${request.sourceId}" could not be found.`
          )
        );
      }

      const nextState = reduceAppDataState(currentState, {
        type: "update_source",
        id: request.sourceId,
        source: request.source,
      });

      return persistAppDataState(
        storageAdapter,
        nextState,
        getSourcesData(nextState)
      );
    },
    removeSource(request) {
      const currentState = normalizeAppDataState(request.state);
      const targetExists = currentState.sources.some(
        (source) => source.id === request.sourceId
      );

      if (!targetExists) {
        return createFailureResult(
          currentState,
          getSourcesData(currentState),
          createRepositoryError(
            "source_not_found",
            `Source "${request.sourceId}" could not be found.`
          )
        );
      }

      const nextState = reduceAppDataState(currentState, {
        type: "delete_source",
        id: request.sourceId,
      });

      return persistAppDataState(
        storageAdapter,
        nextState,
        getSourcesData(nextState)
      );
    },
    getOutputConfig(request) {
      const nextState = normalizeAppDataState(request.state);
      return createSuccessResult(nextState, getOutputConfigData(nextState));
    },
    saveOutputConfig(request) {
      let nextState = normalizeAppDataState(request.state);

      if (request.outputConfig.defaultSourceId !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_default_source",
          id: request.outputConfig.defaultSourceId,
        });
      }

      if (request.outputConfig.defaultOutputFormat !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_default_output_format",
          format: request.outputConfig.defaultOutputFormat,
        });
      }

      if (request.outputConfig.urlTokenEnabled !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_url_token_enabled",
          enabled: request.outputConfig.urlTokenEnabled,
        });
      }

      if (
        request.outputConfig.publishedSourceIds !== undefined ||
        request.outputConfig.publishedAt !== undefined ||
        request.outputConfig.publishedVersionId !== undefined
      ) {
        nextState = reduceAppDataState(nextState, {
          type: "set_published_output_sources",
          sourceIds:
            request.outputConfig.publishedSourceIds ?? nextState.publishedSourceIds,
          publishedAt:
            request.outputConfig.publishedAt ?? nextState.publishedAt,
          publishedVersionId:
            request.outputConfig.publishedVersionId ?? nextState.publishedVersionId,
        });
      }

      return persistAppDataState(
        storageAdapter,
        nextState,
        getOutputConfigData(nextState)
      );
    },
    getSettings(request) {
      const nextState = normalizeAppDataState(request.state);
      return createSuccessResult(nextState, getSystemSettingsData(nextState));
    },
    saveSettings(request) {
      let nextState = normalizeAppDataState(request.state);

      if (request.settings.serviceUrl !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_service_url",
          serviceUrl: request.settings.serviceUrl,
        });
      }

      if (request.settings.apiPath !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_api_path",
          apiPath: request.settings.apiPath,
        });
      }

      if (request.settings.serviceCheckStatus !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_service_check_status",
          status: request.settings.serviceCheckStatus,
        });
      }

      if (request.settings.serviceLastCheckedAt !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_service_last_checked_at",
          checkedAt: request.settings.serviceLastCheckedAt,
        });
      }

      if (request.settings.publishDomain !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_publish_domain",
          publishDomain: request.settings.publishDomain,
        });
      }

      if (request.settings.httpsEnabled !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_https_enabled",
          httpsEnabled: request.settings.httpsEnabled,
        });
      }

      if (request.settings.userNoticeEnabled !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_user_notice_enabled",
          enabled: request.settings.userNoticeEnabled,
        });
      }

      if (request.settings.userNoticeTitle !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_user_notice_title",
          title: request.settings.userNoticeTitle,
        });
      }

      if (request.settings.userNoticeMessage !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_user_notice_message",
          message: request.settings.userNoticeMessage,
        });
      }

      if (request.settings.userNoticeUpdatedAt !== undefined) {
        nextState = reduceAppDataState(nextState, {
          type: "set_user_notice_updated_at",
          updatedAt: request.settings.userNoticeUpdatedAt,
        });
      }

      return persistAppDataState(
        storageAdapter,
        nextState,
        getSystemSettingsData(nextState)
      );
    },
    getRole(request) {
      const nextState = normalizeAppDataState(request.state);
      return createSuccessResult(nextState, getRoleData(nextState));
    },
    setRole(request) {
      const nextState = reduceAppDataState(request.state, {
        type: "set_role",
        role: request.role,
      });

      return persistAppDataState(storageAdapter, nextState, getRoleData(nextState));
    },
    resetSettings(request) {
      const nextState = reduceAppDataState(request.state, {
        type: "reset_settings_defaults",
      });

      return persistAppDataState(
        storageAdapter,
        nextState,
        getSystemSettingsData(nextState)
      );
    },
    resetAppData(request) {
      const fallbackState = normalizeAppDataState(
        request?.fallbackState ?? createDefaultAppDataState()
      );
      const clearResult = storageAdapter.clearSnapshot();
      const mappedError = mapStorageError(clearResult.error);

      if (mappedError) {
        return createFailureResult(fallbackState, fallbackState, mappedError);
      }

      return createSuccessResult(fallbackState, fallbackState);
    },
  };
}
