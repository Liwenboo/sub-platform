"use client";

export type AppDataRepositoryMode = "local" | "remote";

export const APP_DATA_REPOSITORY_MODE: AppDataRepositoryMode = "remote";

export const REMOTE_APP_DATA_BASE_URL = "/api";
export const REMOTE_APP_DATA_TIMEOUT_MS = 8000;
