"use client";

import type { AppDataState, SourceItem } from "../../_types/app-types";
import type {
  CreateSourceRequest,
  OutputConfigState,
  RepositoryError,
  RoleData,
  SaveOutputConfigRequest,
  SaveSettingsRequest,
  SetRoleRequest,
  SourcesData,
  SystemSettingsState,
  UpdateSourceRequest,
} from "../../_types/repository-types";
import type {
  RemoteApiErrorDto,
  RemoteAppDataDto,
  RemoteCreateSourceRequestDto,
  RemoteOutputConfigDto,
  RemoteRoleDto,
  RemoteSaveOutputConfigRequestDto,
  RemoteSaveSettingsRequestDto,
  RemoteSetRoleRequestDto,
  RemoteSettingsDto,
  RemoteSourceDto,
  RemoteUpdateSourceRequestDto,
} from "./remote-app-data-api-types";
import { normalizeAppDataState } from "../services/app-data-service";

function mapSourceDtoToDomain(source: RemoteSourceDto): SourceItem {
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

export function mapRemoteAppDataDtoToDomainState(dto: RemoteAppDataDto): AppDataState {
  return normalizeAppDataState({
    role: dto.role,
    sources: dto.sources.map(mapSourceDtoToDomain),
    defaultSourceId: dto.outputConfig.defaultSourceId,
    defaultOutputFormat: dto.outputConfig.defaultOutputFormat,
    urlTokenEnabled: dto.outputConfig.urlTokenEnabled,
    publishedSourceIds: dto.outputConfig.publishedSourceIds,
    publishedAt: dto.outputConfig.publishedAt,
    publishedVersionId: dto.outputConfig.publishedVersionId,
    serviceUrl: dto.settings.serviceUrl,
    apiPath: dto.settings.apiPath,
    serviceCheckStatus: dto.settings.serviceCheckStatus,
    serviceLastCheckedAt: dto.settings.serviceLastCheckedAt,
    publishDomain: dto.settings.publishDomain,
    httpsEnabled: dto.settings.httpsEnabled,
  });
}

export function mapDomainStateToRemoteAppDataDto(state: AppDataState): RemoteAppDataDto {
  const normalizedState = normalizeAppDataState(state);

  return {
    role: normalizedState.role,
    sources: normalizedState.sources.map(mapSourceToDto),
    outputConfig: mapOutputConfigToDto({
      defaultSourceId: normalizedState.defaultSourceId,
      defaultOutputFormat: normalizedState.defaultOutputFormat,
      urlTokenEnabled: normalizedState.urlTokenEnabled,
      publishedSourceIds: normalizedState.publishedSourceIds,
      publishedAt: normalizedState.publishedAt,
      publishedVersionId: normalizedState.publishedVersionId,
    }),
    settings: mapSettingsToDto({
      serviceUrl: normalizedState.serviceUrl,
      apiPath: normalizedState.apiPath,
      serviceCheckStatus: normalizedState.serviceCheckStatus,
      serviceLastCheckedAt: normalizedState.serviceLastCheckedAt,
      publishDomain: normalizedState.publishDomain,
      httpsEnabled: normalizedState.httpsEnabled,
    }),
  };
}

export function mapOutputConfigDtoToDomain(dto: RemoteOutputConfigDto): OutputConfigState {
  return {
    defaultSourceId: dto.defaultSourceId,
    defaultOutputFormat: dto.defaultOutputFormat,
    urlTokenEnabled: dto.urlTokenEnabled,
    publishedSourceIds: dto.publishedSourceIds,
    publishedAt: dto.publishedAt,
    publishedVersionId: dto.publishedVersionId,
  };
}

export function mapOutputConfigToDto(
  outputConfig: OutputConfigState
): RemoteOutputConfigDto {
  return {
    defaultSourceId: outputConfig.defaultSourceId,
    defaultOutputFormat: outputConfig.defaultOutputFormat,
    urlTokenEnabled: outputConfig.urlTokenEnabled,
    publishedSourceIds: outputConfig.publishedSourceIds,
    publishedAt: outputConfig.publishedAt,
    publishedVersionId: outputConfig.publishedVersionId,
  };
}

export function mapSettingsDtoToDomain(dto: RemoteSettingsDto): SystemSettingsState {
  return {
    serviceUrl: dto.serviceUrl,
    apiPath: dto.apiPath,
    serviceCheckStatus: dto.serviceCheckStatus,
    serviceLastCheckedAt: dto.serviceLastCheckedAt,
    publishDomain: dto.publishDomain,
    httpsEnabled: dto.httpsEnabled,
  };
}

export function mapSettingsToDto(
  settings: SystemSettingsState
): RemoteSettingsDto {
  return {
    serviceUrl: settings.serviceUrl,
    apiPath: settings.apiPath,
    serviceCheckStatus: settings.serviceCheckStatus,
    serviceLastCheckedAt: settings.serviceLastCheckedAt,
    publishDomain: settings.publishDomain,
    httpsEnabled: settings.httpsEnabled,
  };
}

export function mapRoleDtoToDomain(dto: RemoteRoleDto): RoleData {
  return { role: dto.role };
}

export function mapRoleToDto(roleData: RoleData): RemoteRoleDto {
  return { role: roleData.role };
}

export function mapSourcesDtoToDomain(sources: RemoteSourceDto[]): SourcesData {
  return {
    items: sources.map(mapSourceDtoToDomain),
  };
}

export function mapCreateSourceRequestToDto(
  request: CreateSourceRequest
): RemoteCreateSourceRequestDto {
  return {
    source: {
      name: request.source.name,
      sourceType: request.source.sourceType,
      sourceProtocol: request.source.sourceProtocol,
      url: request.source.url,
      content: request.source.content,
      tags: [...request.source.tags],
      status: request.source.status,
      updatedAt: request.source.updatedAt,
      id: request.source.id,
    },
  };
}

export function mapUpdateSourceRequestToDto(
  request: UpdateSourceRequest
): RemoteUpdateSourceRequestDto {
  return {
    sourceId: request.sourceId,
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
  };
}

export function mapSaveOutputConfigRequestToDto(
  request: SaveOutputConfigRequest
): RemoteSaveOutputConfigRequestDto {
  return {
    outputConfig: {
      ...request.outputConfig,
    },
  };
}

export function mapSaveSettingsRequestToDto(
  request: SaveSettingsRequest
): RemoteSaveSettingsRequestDto {
  return {
    settings: {
      ...request.settings,
    },
  };
}

export function mapSetRoleRequestToDto(
  request: SetRoleRequest
): RemoteSetRoleRequestDto {
  return {
    role: request.role,
  };
}

export function mapRemoteApiErrorToRepositoryError(
  error: RemoteApiErrorDto | null,
  fallbackMessage: string
): RepositoryError {
  if (!error) {
    return {
      code: "remote_request_failed",
      message: fallbackMessage,
      recoverable: true,
    };
  }

  if (error.code === "source_not_found") {
    return {
      code: "source_not_found",
      message: error.message,
      recoverable: error.recoverable ?? true,
    };
  }

  if (
    error.code === "validation_failed" ||
    error.code === "invalid_output_format" ||
    error.code === "invalid_role"
  ) {
    return {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable ?? true,
    };
  }

  return {
    code: "remote_request_failed",
    message: error.message || fallbackMessage,
    recoverable: error.recoverable ?? true,
  };
}
