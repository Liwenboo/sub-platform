export type SourceStatus = "online" | "warning" | "paused";

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
  url: string;
  tags: string[];
  status: SourceStatus;
  updatedAt: string;
};
