"use client";

import type { AppDataRepository } from "../../_types/repository-types";
import { APP_DATA_REPOSITORY_MODE } from "./app-data-repository-config";
import { createLocalAppDataRepository } from "./local-app-data-repository";
import { createRemoteAppDataRepository } from "./remote-app-data-repository";

export function createAppDataRepository(): AppDataRepository {
  switch (APP_DATA_REPOSITORY_MODE) {
    case "remote":
      return createRemoteAppDataRepository();
    case "local":
    default:
      return createLocalAppDataRepository();
  }
}
