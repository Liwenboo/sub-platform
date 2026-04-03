import type { SourceStatus } from "./app-types";

export type SourceFormValues = {
  name: string;
  url: string;
  tagsInput: string;
  status: SourceStatus;
};

export type SourceImportInputMode = "link" | "text";
export type SourcePreviewType = "link" | "text";

export type SourceImportPreviewItem = {
  id: string;
  name: string;
  sourceType: SourcePreviewType;
  summary: string;
  tags: string[];
  raw: string;
};
