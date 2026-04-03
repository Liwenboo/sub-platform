import type { SourceFormValues } from "../../_types/sources-types";

export const DEFAULT_SOURCE_FORM_VALUES: SourceFormValues = {
  name: "",
  url: "",
  tagsInput: "",
  status: "online",
};

export function createEmptySourceFormValues(): SourceFormValues {
  return { ...DEFAULT_SOURCE_FORM_VALUES };
}
