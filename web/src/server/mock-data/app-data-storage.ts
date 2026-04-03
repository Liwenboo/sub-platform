import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AppDataState } from "../../app/_types/app-types";
import {
  createDefaultAppDataState,
  normalizeAppDataState,
} from "../../app/_data/services/app-data-service";

const APP_DATA_SQLITE_FILE_PATH = join(
  process.cwd(),
  "src",
  "server",
  "mock-data",
  "app-data.sqlite"
);
const LEGACY_APP_DATA_JSON_FILE_PATH = join(
  process.cwd(),
  "src",
  "server",
  "mock-data",
  "app-data.json"
);

type MockStorageGlobal = typeof globalThis & {
  __subPlatformMockStorageDatabase__?: DatabaseSync;
  __subPlatformMockStorageQueue__?: Promise<void>;
};

function getStorageGlobal(): MockStorageGlobal {
  return globalThis as MockStorageGlobal;
}

function createDefaultState(): AppDataState {
  return normalizeAppDataState(createDefaultAppDataState());
}

function ensureDatabaseDirectoryExists(): void {
  const directoryPath = dirname(APP_DATA_SQLITE_FILE_PATH);

  if (!existsSync(directoryPath)) {
    mkdirSync(directoryPath, { recursive: true });
  }
}

function getDatabase(): DatabaseSync {
  const globalStore = getStorageGlobal();

  if (!globalStore.__subPlatformMockStorageDatabase__) {
    ensureDatabaseDirectoryExists();
    const database = new DatabaseSync(APP_DATA_SQLITE_FILE_PATH);

    database.exec(`
      CREATE TABLE IF NOT EXISTS app_data_snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    globalStore.__subPlatformMockStorageDatabase__ = database;
  }

  return globalStore.__subPlatformMockStorageDatabase__;
}

function readStateFromDatabase(database: DatabaseSync): AppDataState | null {
  const row = database
    .prepare("SELECT payload FROM app_data_snapshot WHERE id = 1")
    .get() as { payload: string } | undefined;

  if (!row?.payload) {
    return null;
  }

  try {
    return normalizeAppDataState(JSON.parse(row.payload) as AppDataState);
  } catch {
    return null;
  }
}

function writeStateToDatabase(
  database: DatabaseSync,
  state: AppDataState
): AppDataState {
  const normalizedState = normalizeAppDataState(state);
  const payload = JSON.stringify(normalizedState);
  const updatedAt = new Date().toISOString();

  database
    .prepare(
      `
        INSERT INTO app_data_snapshot (id, payload, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `
    )
    .run(payload, updatedAt);

  return normalizedState;
}

async function readLegacyJsonSeedState(): Promise<AppDataState | null> {
  try {
    const raw = await readFile(LEGACY_APP_DATA_JSON_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AppDataState;
    return normalizeAppDataState(parsed);
  } catch {
    return null;
  }
}

async function seedDatabaseIfEmpty(database: DatabaseSync): Promise<AppDataState> {
  const existingState = readStateFromDatabase(database);

  if (existingState) {
    return existingState;
  }

  const seededState = (await readLegacyJsonSeedState()) ?? createDefaultState();
  return writeStateToDatabase(database, seededState);
}

async function waitForPendingWrites(): Promise<void> {
  const pendingQueue = getStorageGlobal().__subPlatformMockStorageQueue__;

  if (pendingQueue) {
    await pendingQueue;
  }
}

export async function readStoredAppDataState(): Promise<AppDataState> {
  await waitForPendingWrites();

  const database = getDatabase();
  const existingState = readStateFromDatabase(database);

  if (existingState) {
    return existingState;
  }

  return seedDatabaseIfEmpty(database);
}

export async function writeStoredAppDataState(
  state: AppDataState
): Promise<AppDataState> {
  const globalStore = getStorageGlobal();
  const previousQueue = globalStore.__subPlatformMockStorageQueue__ ?? Promise.resolve();
  let nextState = createDefaultState();

  const nextQueue = previousQueue.then(async () => {
    const database = getDatabase();
    nextState = writeStateToDatabase(database, state);
  });

  globalStore.__subPlatformMockStorageQueue__ = nextQueue.then(
    () => undefined,
    () => undefined
  );

  await nextQueue;
  return nextState;
}

export async function updateStoredAppDataState(
  updater: (currentState: AppDataState) => AppDataState | Promise<AppDataState>
): Promise<AppDataState> {
  const globalStore = getStorageGlobal();
  const previousQueue = globalStore.__subPlatformMockStorageQueue__ ?? Promise.resolve();
  let nextState = createDefaultState();

  const nextQueue = previousQueue.then(async () => {
    const database = getDatabase();
    const currentState =
      readStateFromDatabase(database) ?? (await seedDatabaseIfEmpty(database));
    const updatedState = await updater(currentState);
    nextState = writeStateToDatabase(database, updatedState);
  });

  globalStore.__subPlatformMockStorageQueue__ = nextQueue.then(
    () => undefined,
    () => undefined
  );

  await nextQueue;
  return nextState;
}

export async function resetStoredAppDataState(): Promise<AppDataState> {
  return writeStoredAppDataState(createDefaultState());
}

export { APP_DATA_SQLITE_FILE_PATH };
