import type { OutputFormatId, SourceItem } from "../../_types/app-types";

export type OutputLinkBuildParams = {
  selectedFormat: OutputFormatId;
  selectedSourceIds: string[];
  includeAllSources?: boolean;
  publishDomain: string;
  httpsEnabled: boolean;
  urlTokenEnabled: boolean;
  token?: string;
  generationVersion?: number;
  emojiEnabled?: boolean;
  udpEnabled?: boolean;
  tfoEnabled?: boolean;
  sortMode?: string;
  outputName?: string;
};

export function normalizePublishDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "sub-platform.example.com";
  }

  return trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export function buildInitialSelectedSourceIds(
  sources: SourceItem[],
  defaultSourceId: string | null
): string[] {
  if (sources.length === 0) {
    return [];
  }

  const base = sources.slice(0, 3).map((source) => source.id);
  if (defaultSourceId && !base.includes(defaultSourceId)) {
    base.unshift(defaultSourceId);
  }

  return Array.from(new Set(base)).filter((id) =>
    sources.some((source) => source.id === id)
  );
}

export function buildOutputLink(params: OutputLinkBuildParams): string {
  const normalizedDomain = normalizePublishDomain(params.publishDomain);
  const protocol = params.httpsEnabled ? "https" : "http";
  const query = new URLSearchParams();
  query.set("format", params.selectedFormat);

  if (!params.includeAllSources) {
    query.set(
      "source",
      params.selectedSourceIds.length > 0 ? params.selectedSourceIds.join(",") : "none"
    );
  }

  if (typeof params.generationVersion === "number") {
    query.set("v", String(params.generationVersion));
  }

  if (params.urlTokenEnabled && params.token) {
    query.set("token", params.token);
  }

  if (typeof params.emojiEnabled === "boolean") {
    query.set("emoji", params.emojiEnabled ? "true" : "false");
  }

  if (typeof params.udpEnabled === "boolean") {
    query.set("udp", params.udpEnabled ? "true" : "false");
  }

  if (typeof params.tfoEnabled === "boolean") {
    query.set("tfo", params.tfoEnabled ? "true" : "false");
  }

  return `${protocol}://${normalizedDomain}/output?${query.toString()}`;
}
