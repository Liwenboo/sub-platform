"use client";

import type { AppDataState } from "../../_types/app-types";
import type {
  AppDataRepository,
  CreateSourceRequest,
  OutputConfigState,
  RepositoryError,
  RepositoryResult,
  RemoveSourceRequest,
  RoleData,
  SaveOutputConfigRequest,
  SaveSettingsRequest,
  SetRoleRequest,
  SourcesData,
  SystemSettingsState,
  UpdateSourceRequest,
} from "../../_types/repository-types";
import type {
  RemoteAppDataDto,
  RemoteOutputConfigDto,
  RemoteRoleDto,
  RemoteSettingsDto,
  RemoteSourceDto,
} from "./remote-app-data-api-types";
import { createRemoteAppDataClient } from "./remote-app-data-client";
import { REMOTE_APP_DATA_ENDPOINTS } from "./remote-app-data-endpoints";
import {
  mapCreateSourceRequestToDto,
  mapOutputConfigDtoToDomain,
  mapRoleDtoToDomain,
  mapRemoteApiErrorToRepositoryError,
  mapRemoteAppDataDtoToDomainState,
  mapSaveOutputConfigRequestToDto,
  mapSaveSettingsRequestToDto,
  mapSetRoleRequestToDto,
  mapSettingsDtoToDomain,
  mapSourcesDtoToDomain,
  mapUpdateSourceRequestToDto,
} from "./remote-app-data-mappers";
import {
  createDefaultAppDataState,
  normalizeAppDataState,
} from "../services/app-data-service";

const remoteAppDataClient = createRemoteAppDataClient();

function createNotImplementedError(methodName: string): RepositoryError {
  return {
    code: "not_implemented",
    message: `Remote app data repository method "${methodName}" is not implemented yet.`,
    recoverable: false,
  };
}

function createNotImplementedResult<T>(
  methodName: string,
  state: AppDataState,
  data: T
): RepositoryResult<T> {
  return {
    ok: false,
    data,
    state,
    error: createNotImplementedError(methodName),
  };
}

function createRemoteFailureResult<T>(
  methodName: string,
  state: AppDataState,
  data: T,
  error: RepositoryError | null
): RepositoryResult<T> {
  return {
    ok: false,
    data,
    state,
    error:
      error ??
      mapRemoteApiErrorToRepositoryError(
        null,
        `Remote request for "${methodName}" failed.`
      ),
  };
}

function createRemoteSuccessResult<T>(
  state: AppDataState,
  data: T
): RepositoryResult<T> {
  return {
    ok: true,
    data,
    state,
    error: null,
  };
}

function getPlaceholderSourcesData(state: AppDataState): SourcesData {
  return { items: state.sources };
}

function getPlaceholderOutputConfigData(state: AppDataState): OutputConfigState {
  return {
    defaultSourceId: state.defaultSourceId,
    defaultOutputFormat: state.defaultOutputFormat,
    urlTokenEnabled: state.urlTokenEnabled,
    publishedSourceIds: state.publishedSourceIds,
    publishedAt: state.publishedAt,
    publishedVersionId: state.publishedVersionId,
  };
}

function getPlaceholderSettingsData(state: AppDataState): SystemSettingsState {
  return {
    serviceUrl: state.serviceUrl,
    apiPath: state.apiPath,
    serviceCheckStatus: state.serviceCheckStatus,
    serviceLastCheckedAt: state.serviceLastCheckedAt,
    publishDomain: state.publishDomain,
    httpsEnabled: state.httpsEnabled,
  };
}

function getPlaceholderRoleData(state: AppDataState): RoleData {
  return { role: state.role };
}

function mergeSourcesIntoState(
  state: AppDataState,
  sourcesData: SourcesData
): AppDataState {
  const normalizedState = normalizeAppDataState(state);

  return normalizeAppDataState({
    ...normalizedState,
    sources: sourcesData.items,
  });
}

function mergeSettingsIntoState(
  state: AppDataState,
  settingsData: SystemSettingsState
): AppDataState {
  const normalizedState = normalizeAppDataState(state);

  return normalizeAppDataState({
    ...normalizedState,
    serviceUrl: settingsData.serviceUrl,
    apiPath: settingsData.apiPath,
    serviceCheckStatus: settingsData.serviceCheckStatus,
    serviceLastCheckedAt: settingsData.serviceLastCheckedAt,
    publishDomain: settingsData.publishDomain,
    httpsEnabled: settingsData.httpsEnabled,
  });
}

function mergeOutputConfigIntoState(
  state: AppDataState,
  outputConfigData: OutputConfigState
): AppDataState {
  const normalizedState = normalizeAppDataState(state);

  return normalizeAppDataState({
    ...normalizedState,
    defaultSourceId: outputConfigData.defaultSourceId,
    defaultOutputFormat: outputConfigData.defaultOutputFormat,
    urlTokenEnabled: outputConfigData.urlTokenEnabled,
    publishedSourceIds: outputConfigData.publishedSourceIds,
    publishedAt: outputConfigData.publishedAt,
    publishedVersionId: outputConfigData.publishedVersionId,
  });
}

function mergeRoleIntoState(state: AppDataState, roleData: RoleData): AppDataState {
  const normalizedState = normalizeAppDataState(state);

  return normalizeAppDataState({
    ...normalizedState,
    role: roleData.role,
  });
}

async function executeSourcesRequest(
  methodName: "getSources" | "createSource" | "updateSource" | "removeSource",
  currentState: AppDataState,
  clientCall: ReturnType<
    typeof remoteAppDataClient.execute<unknown, RemoteSourceDto[]>
  >
): Promise<RepositoryResult<SourcesData>> {
  const fallbackState = normalizeAppDataState(currentState);
  const clientResult = await clientCall;

  if (clientResult.error) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderSourcesData(fallbackState),
      clientResult.error
    );
  }

  if (!clientResult.response) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderSourcesData(fallbackState),
      {
        code: "remote_response_invalid",
        message: `Remote operation "${methodName}" returned an empty response.`,
        recoverable: true,
      }
    );
  }

  if (!clientResult.response.success || !clientResult.response.data) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderSourcesData(fallbackState),
      mapRemoteApiErrorToRepositoryError(
        clientResult.response.error,
        `Remote operation "${methodName}" failed.`
      )
    );
  }

  const nextSourcesData = mapSourcesDtoToDomain(clientResult.response.data);
  const nextState = mergeSourcesIntoState(fallbackState, nextSourcesData);

  return createRemoteSuccessResult(nextState, getPlaceholderSourcesData(nextState));
}

async function executeSettingsRequest(
  methodName: "getSettings" | "saveSettings" | "resetSettings",
  currentState: AppDataState,
  clientCall: ReturnType<
    typeof remoteAppDataClient.execute<unknown, RemoteSettingsDto>
  >
): Promise<RepositoryResult<SystemSettingsState>> {
  const fallbackState = normalizeAppDataState(currentState);
  const clientResult = await clientCall;

  if (clientResult.error) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderSettingsData(fallbackState),
      clientResult.error
    );
  }

  if (!clientResult.response) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderSettingsData(fallbackState),
      {
        code: "remote_response_invalid",
        message: `Remote operation "${methodName}" returned an empty response.`,
        recoverable: true,
      }
    );
  }

  if (!clientResult.response.success || !clientResult.response.data) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderSettingsData(fallbackState),
      mapRemoteApiErrorToRepositoryError(
        clientResult.response.error,
        `Remote operation "${methodName}" failed.`
      )
    );
  }

  const nextSettingsData = mapSettingsDtoToDomain(clientResult.response.data);
  const nextState = mergeSettingsIntoState(fallbackState, nextSettingsData);

  return createRemoteSuccessResult(nextState, getPlaceholderSettingsData(nextState));
}

async function executeOutputConfigRequest(
  methodName: "getOutputConfig" | "saveOutputConfig",
  currentState: AppDataState,
  clientCall: ReturnType<
    typeof remoteAppDataClient.execute<unknown, RemoteOutputConfigDto>
  >
): Promise<RepositoryResult<OutputConfigState>> {
  const fallbackState = normalizeAppDataState(currentState);
  const clientResult = await clientCall;

  if (clientResult.error) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderOutputConfigData(fallbackState),
      clientResult.error
    );
  }

  if (!clientResult.response) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderOutputConfigData(fallbackState),
      {
        code: "remote_response_invalid",
        message: `Remote operation "${methodName}" returned an empty response.`,
        recoverable: true,
      }
    );
  }

  if (!clientResult.response.success || !clientResult.response.data) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderOutputConfigData(fallbackState),
      mapRemoteApiErrorToRepositoryError(
        clientResult.response.error,
        `Remote operation "${methodName}" failed.`
      )
    );
  }

  const nextOutputConfigData = mapOutputConfigDtoToDomain(
    clientResult.response.data
  );
  const nextState = mergeOutputConfigIntoState(
    fallbackState,
    nextOutputConfigData
  );

  return createRemoteSuccessResult(
    nextState,
    getPlaceholderOutputConfigData(nextState)
  );
}

async function executeRoleRequest(
  methodName: "getRole" | "setRole",
  currentState: AppDataState,
  clientCall: ReturnType<
    typeof remoteAppDataClient.execute<unknown, RemoteRoleDto>
  >
): Promise<RepositoryResult<RoleData>> {
  const fallbackState = normalizeAppDataState(currentState);
  const clientResult = await clientCall;

  if (clientResult.error) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderRoleData(fallbackState),
      clientResult.error
    );
  }

  if (!clientResult.response) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderRoleData(fallbackState),
      {
        code: "remote_response_invalid",
        message: `Remote operation "${methodName}" returned an empty response.`,
        recoverable: true,
      }
    );
  }

  if (!clientResult.response.success || !clientResult.response.data) {
    return createRemoteFailureResult(
      methodName,
      fallbackState,
      getPlaceholderRoleData(fallbackState),
      mapRemoteApiErrorToRepositoryError(
        clientResult.response.error,
        `Remote operation "${methodName}" failed.`
      )
    );
  }

  const nextRoleData = mapRoleDtoToDomain(clientResult.response.data);
  const nextState = mergeRoleIntoState(fallbackState, nextRoleData);

  return createRemoteSuccessResult(nextState, getPlaceholderRoleData(nextState));
}

async function executeAppDataRequest(
  methodName: "loadAppData" | "resetAppData",
  fallbackState: AppDataState,
  clientCall: ReturnType<
    typeof remoteAppDataClient.execute<unknown, RemoteAppDataDto>
  >
): Promise<RepositoryResult<AppDataState>> {
  const currentFallbackState = normalizeAppDataState(fallbackState);
  const clientResult = await clientCall;

  if (clientResult.error) {
    return createRemoteFailureResult(
      methodName,
      currentFallbackState,
      currentFallbackState,
      clientResult.error
    );
  }

  if (!clientResult.response) {
    return createRemoteFailureResult(
      methodName,
      currentFallbackState,
      currentFallbackState,
      {
        code: "remote_response_invalid",
        message: `Remote operation "${methodName}" returned an empty response.`,
        recoverable: true,
      }
    );
  }

  if (!clientResult.response.success || !clientResult.response.data) {
    return createRemoteFailureResult(
      methodName,
      currentFallbackState,
      currentFallbackState,
      mapRemoteApiErrorToRepositoryError(
        clientResult.response.error,
        `Remote operation "${methodName}" failed.`
      )
    );
  }

  const nextState = normalizeAppDataState(
    mapRemoteAppDataDtoToDomainState(clientResult.response.data)
  );

  return createRemoteSuccessResult(nextState, nextState);
}

export function createRemoteAppDataRepository(): AppDataRepository {
  return {
    async loadAppData(request) {
      const fallbackState = normalizeAppDataState(
        request?.fallbackState ?? createDefaultAppDataState()
      );
      return executeAppDataRequest(
        "loadAppData",
        fallbackState,
        remoteAppDataClient.execute<null, RemoteAppDataDto>({
          operation: "loadAppData",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.loadAppData,
          body: null,
        })
      );
    },
    saveAppData(request) {
      const nextState = normalizeAppDataState(request.state);
      return createNotImplementedResult("saveAppData", nextState, nextState);
    },
    async getSources(request) {
      const nextState = normalizeAppDataState(request.state);
      return executeSourcesRequest(
        "getSources",
        nextState,
        remoteAppDataClient.execute<null, RemoteSourceDto[]>({
          operation: "getSources",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.getSources,
          body: null,
        })
      );
    },
    async createSource(request: CreateSourceRequest) {
      return executeSourcesRequest(
        "createSource",
        request.state,
        remoteAppDataClient.execute({
          operation: "createSource",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.createSource,
          body: mapCreateSourceRequestToDto(request),
        })
      );
    },
    async updateSource(request: UpdateSourceRequest) {
      return executeSourcesRequest(
        "updateSource",
        request.state,
        remoteAppDataClient.execute({
          operation: "updateSource",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.updateSource,
          pathParams: {
            sourceId: request.sourceId,
          },
          body: mapUpdateSourceRequestToDto(request),
        })
      );
    },
    async removeSource(request: RemoveSourceRequest) {
      return executeSourcesRequest(
        "removeSource",
        request.state,
        remoteAppDataClient.execute<null, RemoteSourceDto[]>({
          operation: "removeSource",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.removeSource,
          pathParams: {
            sourceId: request.sourceId,
          },
          body: null,
        })
      );
    },
    async getOutputConfig(request) {
      const nextState = normalizeAppDataState(request.state);
      return executeOutputConfigRequest(
        "getOutputConfig",
        nextState,
        remoteAppDataClient.execute<null, RemoteOutputConfigDto>({
          operation: "getOutputConfig",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.getOutputConfig,
          body: null,
        })
      );
    },
    async saveOutputConfig(request: SaveOutputConfigRequest) {
      return executeOutputConfigRequest(
        "saveOutputConfig",
        request.state,
        remoteAppDataClient.execute({
          operation: "saveOutputConfig",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.saveOutputConfig,
          body: mapSaveOutputConfigRequestToDto(request),
        })
      );
    },
    async getSettings(request) {
      const nextState = normalizeAppDataState(request.state);
      return executeSettingsRequest(
        "getSettings",
        nextState,
        remoteAppDataClient.execute<null, RemoteSettingsDto>({
          operation: "getSettings",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.getSettings,
          body: null,
        })
      );
    },
    async saveSettings(request: SaveSettingsRequest) {
      return executeSettingsRequest(
        "saveSettings",
        request.state,
        remoteAppDataClient.execute({
          operation: "saveSettings",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.saveSettings,
          body: mapSaveSettingsRequestToDto(request),
        })
      );
    },
    async getRole(request) {
      const nextState = normalizeAppDataState(request.state);
      return executeRoleRequest(
        "getRole",
        nextState,
        remoteAppDataClient.execute<null, RemoteRoleDto>({
          operation: "getRole",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.getRole,
          body: null,
        })
      );
    },
    async setRole(request: SetRoleRequest) {
      return executeRoleRequest(
        "setRole",
        request.state,
        remoteAppDataClient.execute({
          operation: "setRole",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.setRole,
          body: mapSetRoleRequestToDto(request),
        })
      );
    },
    async resetSettings(request) {
      return executeSettingsRequest(
        "resetSettings",
        request.state,
        remoteAppDataClient.execute<null, RemoteSettingsDto>({
          operation: "resetSettings",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.resetSettings,
          body: null,
        })
      );
    },
    async resetAppData(request) {
      const fallbackState = normalizeAppDataState(
        request?.fallbackState ?? createDefaultAppDataState()
      );
      return executeAppDataRequest(
        "resetAppData",
        fallbackState,
        remoteAppDataClient.execute<null, RemoteAppDataDto>({
          operation: "resetAppData",
          endpoint: REMOTE_APP_DATA_ENDPOINTS.resetAppData,
          body: null,
        })
      );
    },
  };
}
