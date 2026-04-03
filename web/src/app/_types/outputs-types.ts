import type { OutputFormatId } from "./app-types";

export type OutputCopyState = "idle" | "success" | "error";
export type OutputPublishStatus = "unpublished" | "pending" | "confirmed";
export type OutputPublishNotice = "none" | "confirmed" | "invalidated" | "reset";
export type OutputNodeSortMode = "default" | "name" | "type";

export type OutputFormatOption = {
  id: OutputFormatId;
  label: string;
};

export type OutputSortOption = {
  id: OutputNodeSortMode;
  label: string;
};
