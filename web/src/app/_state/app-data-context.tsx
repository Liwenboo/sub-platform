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
  setRole: (role: UserRole) => void;
  addSource: (source: SourceItem) => void;
  updateSource: (id: string, source: Omit<SourceItem, "id">) => void;
  deleteSource: (id: string) => void;
  setDefaultSourceId: (id: string | null) => void;
  setDefaultOutputFormat: (format: OutputFormatId) => void;
  setUrlTokenEnabled: (enabled: boolean) => void;
  setServiceUrl: (serviceUrl: string) => void;
  setApiPath: (apiPath: string) => void;
  setServiceCheckStatus: (status: ServiceCheckStatus) => void;
  setServiceLastCheckedAt: (checkedAt: string | null) => void;
  setPublishDomain: (publishDomain: string) => void;
  setHttpsEnabled: (httpsEnabled: boolean) => void;
  resetSettingsDefaults: () => void;
  resetLocalData: () => void;
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

  useEffect(() => {
    let active = true;

    async function hydrateFromRepository() {
      const result = await resolveRepositoryCall(
        appDataRepository.loadAppData({
          fallbackState: createDefaultAppDataState(),
        })
      );

      if (!active) {
        return;
      }

      logRepositoryError(result.error);
      const nextState = normalizeAppDataState(result.state);

      stateRef.current = nextState;
      setState(nextState);
    }

    void hydrateFromRepository();

    return () => {
      active = false;
    };
  }, [logRepositoryError, resolveRepositoryCall]);

  const setRole = useCallback((role: UserRole) => {
    void runStateReplacement(
      () =>
        appDataRepository.setRole({
          state: stateRef.current,
          role,
        })
    );
  }, [runStateReplacement]);

  const updateOutputConfig = useCallback((patch: OutputConfigPatch) => {
    void runStateReplacement(
      () =>
        appDataRepository.saveOutputConfig({
          state: stateRef.current,
          outputConfig: patch,
        })
    );
  }, [runStateReplacement]);

  const saveSystemSettings = useCallback((patch: SystemSettingsPatch) => {
    void runStateReplacement(
      () =>
        appDataRepository.saveSettings({
          state: stateRef.current,
          settings: patch,
        })
    );
  }, [runStateReplacement]);

  const addSource = useCallback((source: SourceItem) => {
    void runStateReplacement(
      () =>
        appDataRepository.createSource({
          state: stateRef.current,
          source,
        })
    );
  }, [runStateReplacement]);

  const updateSource = useCallback((id: string, source: Omit<SourceItem, "id">) => {
    void runStateReplacement(
      () =>
        appDataRepository.updateSource({
          state: stateRef.current,
          sourceId: id,
          source,
        })
    );
  }, [runStateReplacement]);

  const deleteSource = useCallback((id: string) => {
    void runStateReplacement(
      () =>
        appDataRepository.removeSource({
          state: stateRef.current,
          sourceId: id,
        })
    );
  }, [runStateReplacement]);

  const setDefaultSourceId = useCallback((id: string | null) => {
    updateOutputConfig({ defaultSourceId: id });
  }, [updateOutputConfig]);

  const setDefaultOutputFormat = useCallback((format: OutputFormatId) => {
    updateOutputConfig({ defaultOutputFormat: format });
  }, [updateOutputConfig]);

  const setUrlTokenEnabled = useCallback((enabled: boolean) => {
    updateOutputConfig({ urlTokenEnabled: enabled });
  }, [updateOutputConfig]);

  const setServiceUrl = useCallback((serviceUrl: string) => {
    saveSystemSettings({ serviceUrl });
  }, [saveSystemSettings]);

  const setApiPath = useCallback((apiPath: string) => {
    saveSystemSettings({ apiPath });
  }, [saveSystemSettings]);

  const setServiceCheckStatus = useCallback((status: ServiceCheckStatus) => {
    saveSystemSettings({ serviceCheckStatus: status });
  }, [saveSystemSettings]);

  const setServiceLastCheckedAt = useCallback((checkedAt: string | null) => {
    saveSystemSettings({ serviceLastCheckedAt: checkedAt });
  }, [saveSystemSettings]);

  const setPublishDomain = useCallback((publishDomain: string) => {
    saveSystemSettings({ publishDomain });
  }, [saveSystemSettings]);

  const setHttpsEnabled = useCallback((httpsEnabled: boolean) => {
    saveSystemSettings({ httpsEnabled });
  }, [saveSystemSettings]);

  const resetSettingsDefaults = useCallback(() => {
    void runStateReplacement(
      () =>
        appDataRepository.resetSettings({
          state: stateRef.current,
        })
    );
  }, [runStateReplacement]);

  const resetLocalData = useCallback(() => {
    void runStateReplacement(
      () =>
        appDataRepository.resetAppData({
          fallbackState: createDefaultAppDataState(),
        })
    );
  }, [runStateReplacement]);

  const normalizedState = normalizeAppDataState(state);

  const contextValue = useMemo<AppDataContextValue>(
    () => ({
      ...normalizedState,
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
