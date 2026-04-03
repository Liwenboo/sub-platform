"use client";

import type { PersistedAppDataSnapshot } from "../../_types/app-types";

export const APP_DATA_STORAGE_KEY = "sub-platform.app-data.v1";

export type AppDataStorageAdapterErrorCode =
  | "storage_unavailable"
  | "storage_parse_failed"
  | "storage_write_failed"
  | "storage_clear_failed";

export type AppDataStorageAdapterError = {
  code: AppDataStorageAdapterErrorCode;
  message: string;
};

export type AppDataStorageLoadResult = {
  snapshot: PersistedAppDataSnapshot | null;
  error: AppDataStorageAdapterError | null;
};

export type AppDataStorageMutationResult = {
  ok: boolean;
  error: AppDataStorageAdapterError | null;
};

export type AppDataStorageAdapter = {
  loadSnapshot: () => AppDataStorageLoadResult;
  saveSnapshot: (snapshot: PersistedAppDataSnapshot) => AppDataStorageMutationResult;
  clearSnapshot: () => AppDataStorageMutationResult;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createStorageError(
  code: AppDataStorageAdapterErrorCode,
  message: string
): AppDataStorageAdapterError {
  return { code, message };
}

export function createLocalStorageAppDataAdapter(
  storageKey = APP_DATA_STORAGE_KEY
): AppDataStorageAdapter {
  return {
    loadSnapshot() {
      if (typeof window === "undefined") {
        return {
          snapshot: null,
          error: createStorageError(
            "storage_unavailable",
            "localStorage is not available in the current environment."
          ),
        };
      }

      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          return { snapshot: null, error: null };
        }

        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
          return {
            snapshot: null,
            error: createStorageError(
              "storage_parse_failed",
              "Persisted app data is not a valid object."
            ),
          };
        }

        return {
          snapshot: parsed as PersistedAppDataSnapshot,
          error: null,
        };
      } catch {
        return {
          snapshot: null,
          error: createStorageError(
            "storage_parse_failed",
            "Persisted app data could not be parsed."
          ),
        };
      }
    },
    saveSnapshot(snapshot) {
      if (typeof window === "undefined") {
        return {
          ok: false,
          error: createStorageError(
            "storage_unavailable",
            "localStorage is not available in the current environment."
          ),
        };
      }

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));

        return {
          ok: true,
          error: null,
        };
      } catch {
        return {
          ok: false,
          error: createStorageError(
            "storage_write_failed",
            "Persisted app data could not be written to localStorage."
          ),
        };
      }
    },
    clearSnapshot() {
      if (typeof window === "undefined") {
        return {
          ok: false,
          error: createStorageError(
            "storage_unavailable",
            "localStorage is not available in the current environment."
          ),
        };
      }

      try {
        window.localStorage.removeItem(storageKey);

        return {
          ok: true,
          error: null,
        };
      } catch {
        return {
          ok: false,
          error: createStorageError(
            "storage_clear_failed",
            "Persisted app data could not be cleared from localStorage."
          ),
        };
      }
    },
  };
}
