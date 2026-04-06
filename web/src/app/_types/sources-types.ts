import type {
  SourceProtocol,
  SourceStatus,
  SourceType,
} from "./app-types";

export type SourceFormValues = {
  name: string;
  url: string;
  tagsInput: string;
  status: SourceStatus;
};

export type SourceImportInputMode = "link" | "text";
export type SourcePreviewType = SourceType;

export type SourceImportPreviewItem = {
  id: string;
  name: string;
  sourceType: SourcePreviewType;
  sourceProtocol: SourceProtocol;
  summary: string;
  tags: string[];
  url: string;
  content: string | null;
};
