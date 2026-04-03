import type {
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
} from "../../app/_data/repositories/remote-app-data-api-types";
import type { RemoteApiErrorDto } from "../../app/_data/repositories/remote-app-data-api-types";

export type AppDataStoreMutationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: number;
      error: RemoteApiErrorDto;
    };

export type AppDataStore = {
  loadAppData: () => Promise<RemoteAppDataDto>;
  saveAppData: (
    appData: RemoteAppDataDto
  ) => Promise<AppDataStoreMutationResult<RemoteAppDataDto>>;
  resetAppData: () => Promise<RemoteAppDataDto>;
  listSources: () => Promise<RemoteSourceDto[]>;
  createSource: (
    request: RemoteCreateSourceRequestDto
  ) => Promise<AppDataStoreMutationResult<RemoteSourceDto[]>>;
  updateSource: (
    sourceId: string,
    request: RemoteUpdateSourceRequestDto
  ) => Promise<AppDataStoreMutationResult<RemoteSourceDto[]>>;
  removeSource: (
    sourceId: string
  ) => Promise<AppDataStoreMutationResult<RemoteSourceDto[]>>;
  getSettings: () => Promise<RemoteSettingsDto>;
  saveSettings: (
    request: RemoteSaveSettingsRequestDto
  ) => Promise<AppDataStoreMutationResult<RemoteSettingsDto>>;
  resetSettings: () => Promise<RemoteSettingsDto>;
  getOutputConfig: () => Promise<RemoteOutputConfigDto>;
  saveOutputConfig: (
    request: RemoteSaveOutputConfigRequestDto
  ) => Promise<AppDataStoreMutationResult<RemoteOutputConfigDto>>;
  getRole: () => Promise<RemoteRoleDto>;
  setRole: (
    request: RemoteSetRoleRequestDto
  ) => Promise<AppDataStoreMutationResult<RemoteRoleDto>>;
};
