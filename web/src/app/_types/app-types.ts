export type SourceStatus = "online" | "warning" | "paused";
export type SourceType = "remote" | "raw";
export type SourceProtocol =
  | "http"
  | "https"
  | "vmess"
  | "vless"
  | "trojan"
  | "ss"
  | "socks"
  | "mixed"
  | "unknown";

export type OutputFormatId = "clash" | "clash-meta" | "v2ray" | "sing-box";

export type UserRole = "admin" | "viewer";

export type ServiceCheckStatus =
  | "not_checked"
  | "checking"
  | "success"
  | "failed";

export type SourceItem = {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceProtocol: SourceProtocol;
  url: string;
  content: string | null;
  tags: string[];
  status: SourceStatus;
  updatedAt: string;
};

export type AppDataState = {
  role: UserRole;
  sources: SourceItem[];
  defaultSourceId: string | null;
  defaultOutputFormat: OutputFormatId;
  urlTokenEnabled: boolean;
  publishedSourceIds: string[];
  publishedAt: string | null;
  publishedVersionId: number | null;
  serviceUrl: string;
  apiPath: string;
  serviceCheckStatus: ServiceCheckStatus;
  serviceLastCheckedAt: string | null;
  publishDomain: string;
  httpsEnabled: boolean;
  userNoticeEnabled: boolean;
  userNoticeTitle: string;
  userNoticeMessage: string;
  userNoticeUpdatedAt: string | null;
};

export type PersistedAppDataSnapshot = {
  version?: unknown;
  role?: unknown;
  currentRole?: unknown;
  userRole?: unknown;
  sources?: unknown;
  sourceList?: unknown;
  subscriptions?: unknown;
  defaultSourceId?: unknown;
  selectedSourceId?: unknown;
  defaultOutputFormat?: unknown;
  outputFormat?: unknown;
  urlTokenEnabled?: unknown;
  publishedSourceIds?: unknown;
  publishedAt?: unknown;
  publishedVersionId?: unknown;
  enableUrlToken?: unknown;
  serviceUrl?: unknown;
  apiPath?: unknown;
  serviceCheckStatus?: unknown;
  serviceLastCheckedAt?: unknown;
  publishDomain?: unknown;
  httpsEnabled?: unknown;
  userNoticeEnabled?: unknown;
  userNoticeTitle?: unknown;
  userNoticeMessage?: unknown;
  userNoticeUpdatedAt?: unknown;
  service?: unknown;
  publish?: unknown;
  settings?: unknown;
  output?: unknown;
};
