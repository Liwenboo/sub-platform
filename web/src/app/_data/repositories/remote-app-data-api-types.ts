"use client";

import type {
  OutputFormatId,
  ServiceCheckStatus,
  SourceStatus,
  UserRole,
} from "../../_types/app-types";

export type RemoteSourceDto = {
  id: string;
  name: string;
  url: string;
  tags: string[];
  status: SourceStatus;
  updatedAt: string;
};

export type RemoteOutputConfigDto = {
  defaultSourceId: string | null;
  defaultOutputFormat: OutputFormatId;
  urlTokenEnabled: boolean;
};

export type RemoteSettingsDto = {
  serviceUrl: string;
  apiPath: string;
  serviceCheckStatus: ServiceCheckStatus;
  serviceLastCheckedAt: string | null;
  publishDomain: string;
  httpsEnabled: boolean;
};

export type RemoteRoleDto = {
  role: UserRole;
};

export type RemoteAppDataDto = {
  role: UserRole;
  sources: RemoteSourceDto[];
  outputConfig: RemoteOutputConfigDto;
  settings: RemoteSettingsDto;
};

export type RemoteApiErrorDto = {
  code: string;
  message: string;
  recoverable?: boolean;
};

export type RemoteApiResponseDto<T> = {
  success: boolean;
  data: T | null;
  error: RemoteApiErrorDto | null;
};

export type RemoteCreateSourceRequestDto = {
  source: Omit<RemoteSourceDto, "id"> & { id?: string };
};

export type RemoteUpdateSourceRequestDto = {
  sourceId: string;
  source: Omit<RemoteSourceDto, "id">;
};

export type RemoteSaveOutputConfigRequestDto = {
  outputConfig: Partial<RemoteOutputConfigDto>;
};

export type RemoteSaveSettingsRequestDto = {
  settings: Partial<RemoteSettingsDto>;
};

export type RemoteSetRoleRequestDto = {
  role: UserRole;
};
