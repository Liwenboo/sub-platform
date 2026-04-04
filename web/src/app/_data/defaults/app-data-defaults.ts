import type {
  OutputFormatId,
  ServiceCheckStatus,
  SourceItem,
  UserRole,
} from "../../_types/app-types";

export const APP_DEFAULT_ROLE: UserRole = "viewer";
export const APP_DEFAULT_SOURCE_STATUS = "online" as const;
export const APP_DEFAULT_SOURCE_UPDATED_AT = "2026-04-02 00:00";

export const APP_SETTINGS_DEFAULTS = {
  defaultOutputFormat: "clash" as OutputFormatId,
  urlTokenEnabled: true,
  serviceUrl: "http://127.0.0.1:25500",
  apiPath: "/sub",
  serviceCheckStatus: "not_checked" as ServiceCheckStatus,
  serviceLastCheckedAt: null as string | null,
  publishDomain: "sub.example.com",
  httpsEnabled: true,
};

export const APP_INITIAL_SOURCES: SourceItem[] = [
  {
    id: "src-001",
    name: "主力机场聚合",
    url: "https://example.com/sub/main",
    tags: ["默认", "高速"],
    status: "online",
    updatedAt: "2026-04-02 14:20",
  },
  {
    id: "src-002",
    name: "备用线路 A",
    url: "https://example.com/sub/backup-a",
    tags: ["备用"],
    status: "online",
    updatedAt: "2026-04-02 09:35",
  },
  {
    id: "src-003",
    name: "部署测试集",
    url: "https://example.com/sub/staging",
    tags: ["测试", "开发"],
    status: "warning",
    updatedAt: "2026-04-01 22:11",
  },
  {
    id: "src-004",
    name: "历史归档集",
    url: "https://example.com/sub/archive",
    tags: ["归档"],
    status: "paused",
    updatedAt: "2026-03-30 18:42",
  },
  {
    id: "src-005",
    name: "对外发布集",
    url: "https://example.com/sub/public",
    tags: ["发布", "稳定"],
    status: "online",
    updatedAt: "2026-04-02 12:08",
  },
];

export function cloneDefaultSources(): SourceItem[] {
  return APP_INITIAL_SOURCES.map((source) => ({
    ...source,
    tags: [...source.tags],
  }));
}
