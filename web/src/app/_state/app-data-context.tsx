"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createDefaultAppDataState, normalizeAppDataState } from "../_data/services/app-data-service";
import { createAppDataRepository } from "../_data/repositories/create-app-data-repository";
import type {
  AppDataState,
  OutputFormatId,
  ServiceCheckStatus,
  SourceItem,
  UserRole,
} from "../_types/app-types";
import type {
  OutputConfigPatch,
  RepositoryError,
  RepositoryMaybePromise,
  RepositoryResult,
  SystemSettingsPatch,
} from "../_types/repository-types";

export type {
  OutputFormatId,
  ServiceCheckStatus,
  SourceItem,
  SourceStatus,
  UserRole,
} from "../_types/app-types";

type AppDataContextValue = AppDataState & {
  saveSettingsPatch: (patch: SystemSettingsPatch) => Promise<AppDataMutationResult>;
  refreshAppData: () => Promise<UserRole>;
  setRole: (role: UserRole) => Promise<AppDataMutationResult>;
  addSource: (source: SourceItem) => Promise<AppDataMutationResult>;
  updateSource: (id: string, source: Omit<SourceItem, "id">) => Promise<AppDataMutationResult>;
  deleteSource: (id: string) => Promise<AppDataMutationResult>;
  setDefaultSourceId: (id: string | null) => Promise<AppDataMutationResult>;
  setDefaultOutputFormat: (format: OutputFormatId) => Promise<AppDataMutationResult>;
  setUrlTokenEnabled: (enabled: boolean) => Promise<AppDataMutationResult>;
  setServiceUrl: (serviceUrl: string) => Promise<AppDataMutationResult>;
  setApiPath: (apiPath: string) => Promise<AppDataMutationResult>;
  setServiceCheckStatus: (status: ServiceCheckStatus) => Promise<AppDataMutationResult>;
  setServiceLastCheckedAt: (checkedAt: string | null) => Promise<AppDataMutationResult>;
  setPublishDomain: (publishDomain: string) => Promise<AppDataMutationResult>;
  setHttpsEnabled: (httpsEnabled: boolean) => Promise<AppDataMutationResult>;
  resetSettingsDefaults: () => Promise<AppDataMutationResult>;
  resetLocalData: () => Promise<AppDataMutationResult>;
};

export type AppDataMutationResult = {
  ok: boolean;
  error: RepositoryError | null;
};

const appDataRepository = createAppDataRepository();
const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppDataState>(createDefaultAppDataState);
  const stateRef = useRef<AppDataState>(state);
  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const resolveRepositoryCall = useCallback(
    async <T,>(call: RepositoryMaybePromise<RepositoryResult<T>>) => Promise.resolve(call),
    []
  );

  const logRepositoryError = useCallback((error: RepositoryResult<unknown>["error"]) => {
    if (!error) {
      return;
    }

    console.warn(`[app-data] ${error.code}: ${error.message}`);
  }, []);

  const runStateReplacement = useCallback(
    <T,>(callFactory: () => RepositoryMaybePromise<RepositoryResult<T>>) => {
      const nextAction = actionQueueRef.current.then(async () => {
        const result = await resolveRepositoryCall(callFactory());
        logRepositoryError(result.error);
        const nextState = normalizeAppDataState(result.state);

        stateRef.current = nextState;
        setState(nextState);

        return result;
      });

      actionQueueRef.current = nextAction.then(
        () => undefined,
        () => undefined
      );

      return nextAction;
    },
    [logRepositoryError, resolveRepositoryCall]
  );

  const refreshAppData = useCallback(async (): Promise<UserRole> => {
    const result = await runStateReplacement(() =>
      appDataRepository.loadAppData({
        fallbackState: stateRef.current,
      })
    );

    return normalizeAppDataState(result.state).role;
  }, [runStateReplacement]);

  const extractMutationResult = useCallback(
    (result: RepositoryResult<unknown>): AppDataMutationResult => ({
      ok: result.ok,
      error: result.error,
    }),
    []
  );

  const runMutation = useCallback(
    async <T,>(
      callFactory: () => RepositoryMaybePromise<RepositoryResult<T>>,
      options?: { refreshAfterSuccess?: boolean }
    ): Promise<AppDataMutationResult> => {
      const result = await runStateReplacement(callFactory);

      if (result.ok && options?.refreshAfterSuccess) {
        await refreshAppData();
      }

      return extractMutationResult(result);
    },
    [extractMutationResult, refreshAppData, runStateReplacement]
  );

  useEffect(() => {
    void refreshAppData();
  }, [refreshAppData]);

  const setRole = useCallback((role: UserRole) => {
    return runMutation(
      () =>
        appDataRepository.setRole({
          state: stateRef.current,
          role,
        }),
      { refreshAfterSuccess: true }
    );
  }, [runMutation]);

  const updateOutputConfig = useCallback((patch: OutputConfigPatch) => {
    return runMutation(
      () =>
        appDataRepository.saveOutputConfig({
          state: stateRef.current,
          outputConfig: patch,
        })
    );
  }, [runMutation]);

  const saveSystemSettings = useCallback((patch: SystemSettingsPatch) => {
    return runMutation(
      () =>
        appDataRepository.saveSettings({
          state: stateRef.current,
          settings: patch,
        })
    );
  }, [runMutation]);

  const addSource = useCallback((source: SourceItem) => {
    return runMutation(
      () =>
        appDataRepository.createSource({
          state: stateRef.current,
          source,
        }),
      { refreshAfterSuccess: true }
    );
  }, [runMutation]);

  const updateSource = useCallback((id: string, source: Omit<SourceItem, "id">) => {
    return runMutation(
      () =>
        appDataRepository.updateSource({
          state: stateRef.current,
          sourceId: id,
          source,
        }),
      { refreshAfterSuccess: true }
    );
  }, [runMutation]);

  const deleteSource = useCallback((id: string) => {
    return runMutation(
      () =>
        appDataRepository.removeSource({
          state: stateRef.current,
          sourceId: id,
        }),
      { refreshAfterSuccess: true }
    );
  }, [runMutation]);

  const setDefaultSourceId = useCallback((id: string | null) => {
    return updateOutputConfig({ defaultSourceId: id });
  }, [updateOutputConfig]);

  const setDefaultOutputFormat = useCallback((format: OutputFormatId) => {
    return updateOutputConfig({ defaultOutputFormat: format });
  }, [updateOutputConfig]);

  const setUrlTokenEnabled = useCallback((enabled: boolean) => {
    return updateOutputConfig({ urlTokenEnabled: enabled });
  }, [updateOutputConfig]);

  const setServiceUrl = useCallback((serviceUrl: string) => {
    return saveSystemSettings({ serviceUrl });
  }, [saveSystemSettings]);

  const setApiPath = useCallback((apiPath: string) => {
    return saveSystemSettings({ apiPath });
  }, [saveSystemSettings]);

  const setServiceCheckStatus = useCallback((status: ServiceCheckStatus) => {
    return saveSystemSettings({ serviceCheckStatus: status });
  }, [saveSystemSettings]);

  const setServiceLastCheckedAt = useCallback((checkedAt: string | null) => {
    return saveSystemSettings({ serviceLastCheckedAt: checkedAt });
  }, [saveSystemSettings]);

  const setPublishDomain = useCallback((publishDomain: string) => {
    return saveSystemSettings({ publishDomain });
  }, [saveSystemSettings]);

  const setHttpsEnabled = useCallback((httpsEnabled: boolean) => {
    return saveSystemSettings({ httpsEnabled });
  }, [saveSystemSettings]);

  const resetSettingsDefaults = useCallback(() => {
    return runMutation(
      () =>
        appDataRepository.resetSettings({
          state: stateRef.current,
        }),
      { refreshAfterSuccess: true }
    );
  }, [runMutation]);

  const resetLocalData = useCallback(() => {
    return runMutation(
      () =>
        appDataRepository.resetAppData({
          fallbackState: createDefaultAppDataState(),
        })
    );
  }, [runMutation]);

  const normalizedState = normalizeAppDataState(state);

  const contextValue = useMemo<AppDataContextValue>(
    () => ({
      ...normalizedState,
      saveSettingsPatch: saveSystemSettings,
      refreshAppData,
      setRole,
      addSource,
      updateSource,
      deleteSource,
      setDefaultSourceId,
      setDefaultOutputFormat,
      setUrlTokenEnabled,
      setServiceUrl,
      setApiPath,
      setServiceCheckStatus,
      setServiceLastCheckedAt,
      setPublishDomain,
      setHttpsEnabled,
      resetSettingsDefaults,
      resetLocalData,
    }),
    [
      normalizedState,
      saveSystemSettings,
      refreshAppData,
      setRole,
      addSource,
      updateSource,
      deleteSource,
      setDefaultSourceId,
      setDefaultOutputFormat,
      setUrlTokenEnabled,
      setServiceUrl,
      setApiPath,
      setServiceCheckStatus,
      setServiceLastCheckedAt,
      setPublishDomain,
      setHttpsEnabled,
      resetSettingsDefaults,
      resetLocalData,
    ]
  );

  return (
    <AppDataContext.Provider value={contextValue}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }

  return context;
}
