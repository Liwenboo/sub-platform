"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import type { ReactNode } from "react";
import type {
  OutputFormatId,
  ServiceCheckStatus,
  SourceItem,
  UserRole,
} from "../_types/app-types";

export type {
  OutputFormatId,
  ServiceCheckStatus,
  SourceItem,
  SourceStatus,
  UserRole,
} from "../_types/app-types";

type AppDataState = {
  role: UserRole;
  sources: SourceItem[];
  defaultSourceId: string | null;
  defaultOutputFormat: OutputFormatId;
  urlTokenEnabled: boolean;
  serviceUrl: string;
  apiPath: string;
  serviceCheckStatus: ServiceCheckStatus;
  serviceLastCheckedAt: string | null;
  publishDomain: string;
  httpsEnabled: boolean;
};

type AppDataAction =
  | { type: "set_role"; role: UserRole }
  | { type: "add_source"; source: SourceItem }
  | { type: "update_source"; id: string; source: Omit<SourceItem, "id"> }
  | { type: "delete_source"; id: string }
  | { type: "set_default_source"; id: string | null }
  | { type: "set_default_output_format"; format: OutputFormatId }
  | { type: "set_url_token_enabled"; enabled: boolean }
  | { type: "set_service_url"; serviceUrl: string }
  | { type: "set_api_path"; apiPath: string }
  | { type: "set_service_check_status"; status: ServiceCheckStatus }
  | { type: "set_service_last_checked_at"; checkedAt: string | null }
  | { type: "set_publish_domain"; publishDomain: string }
  | { type: "set_https_enabled"; httpsEnabled: boolean }
  | { type: "reset_settings_defaults" };

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
};

const settingsDefaults = {
  defaultOutputFormat: "clash" as OutputFormatId,
  urlTokenEnabled: true,
  serviceUrl: "http://127.0.0.1:25500",
  apiPath: "/sub",
  serviceCheckStatus: "not_checked" as ServiceCheckStatus,
  serviceLastCheckedAt: null,
  publishDomain: "sub.example.com",
  httpsEnabled: true,
};

const initialSources: SourceItem[] = [
  {
    id: "src-001",
    name: "\u4e3b\u529b\u673a\u573a\u805a\u5408",
    url: "https://example.com/sub/main",
    tags: ["\u9ed8\u8ba4", "\u9ad8\u901f"],
    status: "online",
    updatedAt: "2026-04-02 14:20",
  },
  {
    id: "src-002",
    name: "\u5907\u7528\u7ebf\u8def A",
    url: "https://example.com/sub/backup-a",
    tags: ["\u5907\u7528"],
    status: "online",
    updatedAt: "2026-04-02 09:35",
  },
  {
    id: "src-003",
    name: "\u90e8\u7f72\u6d4b\u8bd5\u96c6",
    url: "https://example.com/sub/staging",
    tags: ["\u6d4b\u8bd5", "\u5f00\u53d1"],
    status: "warning",
    updatedAt: "2026-04-01 22:11",
  },
  {
    id: "src-004",
    name: "\u5386\u53f2\u5f52\u6863\u96c6",
    url: "https://example.com/sub/archive",
    tags: ["\u5f52\u6863"],
    status: "paused",
    updatedAt: "2026-03-30 18:42",
  },
  {
    id: "src-005",
    name: "\u5bf9\u5916\u53d1\u5e03\u96c6",
    url: "https://example.com/sub/public",
    tags: ["\u53d1\u5e03", "\u7a33\u5b9a"],
    status: "online",
    updatedAt: "2026-04-02 12:08",
  },
];

const initialState: AppDataState = {
  role: "admin",
  sources: initialSources,
  defaultSourceId: initialSources[0]?.id ?? null,
  ...settingsDefaults,
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function getFallbackDefaultSourceId(sources: SourceItem[]): string | null {
  if (sources.length === 0) {
    return null;
  }

  const originalDefaultExists = sources.some(
    (source) => source.id === initialState.defaultSourceId
  );

  return originalDefaultExists ? initialState.defaultSourceId : sources[0].id;
}

function appDataReducer(state: AppDataState, action: AppDataAction): AppDataState {
  if (action.type === "set_role") {
    return { ...state, role: action.role };
  }

  if (action.type === "add_source") {
    const nextSources = [action.source, ...state.sources];
    return {
      ...state,
      sources: nextSources,
      defaultSourceId: state.defaultSourceId ?? action.source.id,
    };
  }

  if (action.type === "update_source") {
    return {
      ...state,
      sources: state.sources.map((source) =>
        source.id === action.id ? { id: action.id, ...action.source } : source
      ),
    };
  }

  if (action.type === "delete_source") {
    const nextSources = state.sources.filter((source) => source.id !== action.id);
    const defaultSourceStillValid =
      state.defaultSourceId !== null &&
      nextSources.some((source) => source.id === state.defaultSourceId);

    return {
      ...state,
      sources: nextSources,
      defaultSourceId: defaultSourceStillValid
        ? state.defaultSourceId
        : nextSources[0]?.id ?? null,
    };
  }

  if (action.type === "set_default_source") {
    const isValidSelection =
      action.id !== null && state.sources.some((source) => source.id === action.id);

    return {
      ...state,
      defaultSourceId: isValidSelection ? action.id : state.sources[0]?.id ?? null,
    };
  }

  if (action.type === "set_default_output_format") {
    return { ...state, defaultOutputFormat: action.format };
  }

  if (action.type === "set_url_token_enabled") {
    return { ...state, urlTokenEnabled: action.enabled };
  }

  if (action.type === "set_service_url") {
    return {
      ...state,
      serviceUrl: action.serviceUrl,
      serviceCheckStatus: "not_checked",
      serviceLastCheckedAt: null,
    };
  }

  if (action.type === "set_api_path") {
    return {
      ...state,
      apiPath: action.apiPath,
      serviceCheckStatus: "not_checked",
      serviceLastCheckedAt: null,
    };
  }

  if (action.type === "set_service_check_status") {
    return { ...state, serviceCheckStatus: action.status };
  }

  if (action.type === "set_service_last_checked_at") {
    return { ...state, serviceLastCheckedAt: action.checkedAt };
  }

  if (action.type === "set_publish_domain") {
    return { ...state, publishDomain: action.publishDomain };
  }

  if (action.type === "set_https_enabled") {
    return { ...state, httpsEnabled: action.httpsEnabled };
  }

  if (action.type === "reset_settings_defaults") {
    return {
      ...state,
      ...settingsDefaults,
      defaultSourceId: getFallbackDefaultSourceId(state.sources),
    };
  }

  return state;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appDataReducer, initialState);

  const setRole = useCallback((role: UserRole) => {
    dispatch({ type: "set_role", role });
  }, []);

  const addSource = useCallback((source: SourceItem) => {
    dispatch({ type: "add_source", source });
  }, []);

  const updateSource = useCallback((id: string, source: Omit<SourceItem, "id">) => {
    dispatch({ type: "update_source", id, source });
  }, []);

  const deleteSource = useCallback((id: string) => {
    dispatch({ type: "delete_source", id });
  }, []);

  const setDefaultSourceId = useCallback((id: string | null) => {
    dispatch({ type: "set_default_source", id });
  }, []);

  const setDefaultOutputFormat = useCallback((format: OutputFormatId) => {
    dispatch({ type: "set_default_output_format", format });
  }, []);

  const setUrlTokenEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: "set_url_token_enabled", enabled });
  }, []);

  const setServiceUrl = useCallback((serviceUrl: string) => {
    dispatch({ type: "set_service_url", serviceUrl });
  }, []);

  const setApiPath = useCallback((apiPath: string) => {
    dispatch({ type: "set_api_path", apiPath });
  }, []);

  const setServiceCheckStatus = useCallback((status: ServiceCheckStatus) => {
    dispatch({ type: "set_service_check_status", status });
  }, []);

  const setServiceLastCheckedAt = useCallback((checkedAt: string | null) => {
    dispatch({ type: "set_service_last_checked_at", checkedAt });
  }, []);

  const setPublishDomain = useCallback((publishDomain: string) => {
    dispatch({ type: "set_publish_domain", publishDomain });
  }, []);

  const setHttpsEnabled = useCallback((httpsEnabled: boolean) => {
    dispatch({ type: "set_https_enabled", httpsEnabled });
  }, []);

  const resetSettingsDefaults = useCallback(() => {
    dispatch({ type: "reset_settings_defaults" });
  }, []);

  const contextValue = useMemo<AppDataContextValue>(
    () => ({
      ...state,
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
    }),
    [
      state,
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
