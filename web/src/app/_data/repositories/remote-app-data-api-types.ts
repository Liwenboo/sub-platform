"use client";

import type {
  OutputFormatId,
  ServiceCheckStatus,
  SourceProtocol,
  SourceStatus,
  SourceType,
  UserRole,
} from "../../_types/app-types";

export type RemoteSourceDto = {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceProtocol: SourceProtocol;
  url: string;
  content: string | null;
  tags: string[];
  status: SourceStatus;
  updatedAt: string;
};

export type RemoteOutputConfigDto = {
  defaultSourceId: string | null;
  defaultOutputFormat: OutputFormatId;
  urlTokenEnabled: boolean;
  publishedSourceIds: string[];
  publishedAt: string | null;
  publishedVersionId: number | null;
};

export type RemoteSettingsDto = {
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
