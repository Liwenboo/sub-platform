"use client";

export type RemoteEndpointDefinition = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  purpose: string;
};

export const REMOTE_APP_DATA_ENDPOINTS = {
  loadAppData: {
    method: "GET",
    path: "/app-data",
    purpose: "Load the full app data snapshot for initial hydration.",
  },
  saveAppData: {
    method: "PUT",
    path: "/app-data",
    purpose: "Persist the full app data snapshot when a full-state sync is needed.",
  },
  getSources: {
    method: "GET",
    path: "/sources",
    purpose: "Read the normalized source list.",
  },
  createSource: {
    method: "POST",
    path: "/sources",
    purpose: "Create a new source item.",
  },
  updateSource: {
    method: "PATCH",
    path: "/sources/:sourceId",
    purpose: "Update an existing source item.",
  },
  removeSource: {
    method: "DELETE",
    path: "/sources/:sourceId",
    purpose: "Delete an existing source item.",
  },
  getOutputConfig: {
    method: "GET",
    path: "/outputs/config",
    purpose: "Read output configuration defaults.",
  },
  saveOutputConfig: {
    method: "PATCH",
    path: "/outputs/config",
    purpose: "Save output configuration defaults.",
  },
  getSettings: {
    method: "GET",
    path: "/settings",
    purpose: "Read system settings.",
  },
  saveSettings: {
    method: "PATCH",
    path: "/settings",
    purpose: "Save system settings.",
  },
  getRole: {
    method: "GET",
    path: "/role",
    purpose: "Read the current role.",
  },
  setRole: {
    method: "PATCH",
    path: "/role",
    purpose: "Switch the current role.",
  },
  resetSettings: {
    method: "POST",
    path: "/settings/reset",
    purpose: "Reset settings to backend defaults.",
  },
  resetAppData: {
    method: "POST",
    path: "/app-data/reset",
    purpose: "Reset the entire app data snapshot.",
  },
} as const satisfies Record<string, RemoteEndpointDefinition>;
