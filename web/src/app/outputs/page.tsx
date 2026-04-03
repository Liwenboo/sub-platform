"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "../_state/app-data-context";
import type { OutputFormatId, SourceItem } from "../_types/app-types";
import {
  canManageOutputsPublish,
  maskSensitiveParamsInUrl,
} from "../_utils/access-control";
import { getSourceStatusLabel } from "../_utils/source-status";

type CopyState = "idle" | "success" | "error";
type PublishStatus = "unpublished" | "pending" | "confirmed";
type PublishNotice = "none" | "confirmed" | "invalidated" | "reset";

type FormatOption = {
  id: OutputFormatId;
  label: string;
};

const copy = {
  title: "\u8f93\u51fa\u7ba1\u7406",
  subtitle:
    "\u7528\u4e8e\u9009\u62e9\u76ee\u6807\u683c\u5f0f\u3001\u751f\u6210\u8f6c\u6362\u94fe\u63a5\u548c\u53d1\u5e03\u8ba2\u9605\u8f93\u51fa",
  sections: {
    sources: "\u8ba2\u9605\u6e90\u9009\u62e9\u533a",
    formats: "\u76ee\u6807\u683c\u5f0f\u9009\u62e9\u533a",
    preview: "\u8f93\u51fa\u9884\u89c8 / \u914d\u7f6e\u6458\u8981",
    result: "\u751f\u6210\u7ed3\u679c\u533a",
    publish: "\u53d1\u5e03\u786e\u8ba4",
  },
  labels: {
    selectedCount: "\u5df2\u9009\u8ba2\u9605\u6e90",
    currentFormat: "\u5f53\u524d\u683c\u5f0f",
    currentSources: "\u5f53\u524d\u8ba2\u9605\u6e90",
    generatedAt: "\u6700\u8fd1\u751f\u6210\u65f6\u95f4",
    httpsUrl: "HTTPS URL",
    noneSource: "\u672a\u9009\u62e9",
    defaultSource: "\u9ed8\u8ba4\u6e90",
    defaultSourceName: "\u5f53\u524d\u9ed8\u8ba4\u8ba2\u9605\u6e90",
    tokenEnabled: "URL Token \u5f00\u5173",
    publishDomain: "\u5f53\u524d\u53d1\u5e03\u57df\u540d",
    enabled: "\u5df2\u542f\u7528",
    disabled: "\u5df2\u5173\u95ed",
    notSet: "\u672a\u8bbe\u7f6e",
  },
  actions: {
    copy: "\u590d\u5236\u94fe\u63a5",
    copySuccess: "\u590d\u5236\u6210\u529f",
    copyError: "\u590d\u5236\u5931\u8d25",
    regenerate: "\u91cd\u65b0\u751f\u6210",
    confirmPublish: "\u786e\u8ba4\u53d1\u5e03",
    resetPublish: "\u91cd\u7f6e\u53d1\u5e03\u72b6\u6001",
  },
  publishStatus: {
    unpublished: "\u672a\u53d1\u5e03",
    pending: "\u5df2\u751f\u6210\u5f85\u53d1\u5e03",
    confirmed: "\u5df2\u786e\u8ba4\u53d1\u5e03",
  },
  publishNotice: {
    confirmed: "\u5df2\u786e\u8ba4\u53d1\u5e03\uff0c\u53ef\u7528\u4e8e\u5206\u53d1\u3002",
    invalidated:
      "\u914d\u7f6e\u5df2\u53d8\u66f4\uff0c\u53d1\u5e03\u786e\u8ba4\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u786e\u8ba4\u53d1\u5e03\u3002",
    reset: "\u53d1\u5e03\u72b6\u6001\u5df2\u91cd\u7f6e\u4e3a\u672a\u53d1\u5e03\u3002",
    pending: "\u5f53\u524d\u914d\u7f6e\u5df2\u751f\u6210\uff0c\u7b49\u5f85\u786e\u8ba4\u53d1\u5e03\u3002",
    unpublished: "\u5f53\u524d\u5c1a\u672a\u53d1\u5e03\uff0c\u8bf7\u786e\u8ba4\u540e\u518d\u53d1\u5e03\u3002",
  },
};

const formatOptions: FormatOption[] = [
  { id: "clash", label: "Clash" },
  { id: "clash-meta", label: "Clash.Meta" },
  { id: "v2ray", label: "V2Ray" },
  { id: "sing-box", label: "Sing-box" },
];

const publishStatusClass: Record<PublishStatus, string> = {
  unpublished: "bg-slate-100 text-slate-700",
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
};

function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

function generateToken(): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `demo_${Date.now().toString(36)}_${randomPart}`;
}

function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "sub-platform.example.com";
  }

  return trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function buildInitialSelectedSourceIds(
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

async function copyToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

export default function OutputsPage() {
  const {
    role,
    sources,
    defaultSourceId,
    defaultOutputFormat,
    urlTokenEnabled,
    publishDomain,
  } = useAppData();
  const showPublishControls = canManageOutputsPublish(role);

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    buildInitialSelectedSourceIds(sources, defaultSourceId)
  );
  const [selectedFormat, setSelectedFormat] =
    useState<OutputFormatId>(defaultOutputFormat);
  const [token, setToken] = useState<string>(generateToken());
  const [generationVersion, setGenerationVersion] = useState<number>(1);
  const [generatedAt, setGeneratedAt] = useState<string>(formatDateTime(new Date()));
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("pending");
  const [publishNotice, setPublishNotice] = useState<PublishNotice>("none");

  const publishStatusRef = useRef<PublishStatus>(publishStatus);
  const configSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    publishStatusRef.current = publishStatus;
  }, [publishStatus]);

  useEffect(() => {
    setSelectedFormat(defaultOutputFormat);
  }, [defaultOutputFormat]);

  useEffect(() => {
    setSelectedSourceIds((prev) => {
      const validIds = prev.filter((id) =>
        sources.some((source) => source.id === id)
      );

      if (validIds.length > 0) {
        return validIds;
      }

      return buildInitialSelectedSourceIds(sources, defaultSourceId);
    });
  }, [sources, defaultSourceId]);

  const selectedSourceNames = useMemo(
    () =>
      sources
        .filter((source) => selectedSourceIds.includes(source.id))
        .map((source) => source.name),
    [selectedSourceIds, sources]
  );

  const selectedFormatLabel = useMemo(
    () =>
      formatOptions.find((format) => format.id === selectedFormat)?.label ??
      selectedFormat,
    [selectedFormat]
  );

  const defaultSourceName =
    sources.find((source) => source.id === defaultSourceId)?.name ?? copy.labels.notSet;

  const normalizedDomain = useMemo(() => normalizeDomain(publishDomain), [publishDomain]);

  const configSignature = useMemo(
    () =>
      JSON.stringify({
        selectedFormat,
        selectedSourceIds: [...selectedSourceIds].sort(),
        defaultSourceId,
        defaultOutputFormat,
        urlTokenEnabled,
        publishDomain: normalizedDomain,
      }),
    [
      selectedFormat,
      selectedSourceIds,
      defaultSourceId,
      defaultOutputFormat,
      urlTokenEnabled,
      normalizedDomain,
    ]
  );

  useEffect(() => {
    if (configSignatureRef.current === null) {
      configSignatureRef.current = configSignature;
      return;
    }

    if (configSignatureRef.current !== configSignature) {
      setPublishStatus("pending");
      if (publishStatusRef.current === "confirmed") {
        setPublishNotice("invalidated");
      } else {
        setPublishNotice("none");
      }
      configSignatureRef.current = configSignature;
    }
  }, [configSignature]);

  const outputUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("format", selectedFormat);
    params.set(
      "source",
      selectedSourceIds.length > 0 ? selectedSourceIds.join(",") : "none"
    );
    params.set("v", String(generationVersion));
    if (urlTokenEnabled) {
      params.set("token", token);
    }

    return `https://${normalizedDomain}/output?${params.toString()}`;
  }, [
    selectedFormat,
    selectedSourceIds,
    generationVersion,
    urlTokenEnabled,
    token,
    normalizedDomain,
  ]);

  const displayedOutputUrl = useMemo(
    () => maskSensitiveParamsInUrl(outputUrl, role),
    [outputUrl, role]
  );

  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleCopyLink = async () => {
    const copied = await copyToClipboard(displayedOutputUrl);
    setCopyState(copied ? "success" : "error");

    window.setTimeout(() => {
      setCopyState("idle");
    }, 1600);
  };

  const handleRegenerate = () => {
    setToken(generateToken());
    setGenerationVersion((prev) => prev + 1);
    setGeneratedAt(formatDateTime(new Date()));
    setCopyState("idle");

    setPublishStatus("pending");
    if (publishStatusRef.current === "confirmed") {
      setPublishNotice("invalidated");
    } else {
      setPublishNotice("none");
    }
  };

  const handleConfirmPublish = () => {
    setPublishStatus("confirmed");
    setPublishNotice("confirmed");
  };

  const handleResetPublish = () => {
    setPublishStatus("unpublished");
    setPublishNotice("reset");
  };

  const publishNoticeText =
    publishNotice === "confirmed"
      ? copy.publishNotice.confirmed
      : publishNotice === "invalidated"
      ? copy.publishNotice.invalidated
      : publishNotice === "reset"
      ? copy.publishNotice.reset
      : publishStatus === "pending"
      ? copy.publishNotice.pending
      : copy.publishNotice.unpublished;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-3 text-base text-slate-600 md:text-lg">
            {copy.subtitle}
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {copy.sections.sources}
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {copy.labels.selectedCount}: {selectedSourceIds.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sources.map((source) => {
              const selected = selectedSourceIds.includes(source.id);

              return (
                <label
                  key={source.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    selected
                      ? "border-slate-900 bg-slate-100"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSourceSelection(source.id)}
                    className="mt-0.5 h-4 w-4 accent-slate-900"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="block text-sm font-medium text-slate-900">
                        {source.name}
                      </span>
                      {defaultSourceId === source.id && (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">
                          {copy.labels.defaultSource}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">
                      {source.tags.length > 0 ? source.tags.join(" / ") : "-"} |{" "}
                      {getSourceStatusLabel(source.status)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {copy.sections.formats}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {formatOptions.map((format) => {
              const selected = selectedFormat === format.id;

              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => setSelectedFormat(format.id)}
                  className={`rounded-xl border p-4 text-left text-sm font-medium transition-colors ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {format.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {copy.sections.preview}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-slate-500">{copy.labels.currentFormat}</p>
              <p className="mt-1 font-medium text-slate-900">{selectedFormatLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-slate-500">{copy.labels.selectedCount}</p>
              <p className="mt-1 font-medium text-slate-900">{selectedSourceIds.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-slate-500">{copy.labels.defaultSourceName}</p>
              <p className="mt-1 font-medium text-slate-900">{defaultSourceName}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-slate-500">{copy.labels.tokenEnabled}</p>
              <p className="mt-1 font-medium text-slate-900">
                {urlTokenEnabled ? copy.labels.enabled : copy.labels.disabled}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:col-span-2 xl:col-span-2">
              <p className="text-slate-500">{copy.labels.publishDomain}</p>
              <p className="mt-1 break-all font-medium text-slate-900">{normalizedDomain}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="text-slate-500">{copy.labels.currentSources}</p>
            <p className="mt-1 text-slate-900">
              {selectedSourceNames.length > 0
                ? selectedSourceNames.join(", ")
                : copy.labels.noneSource}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {copy.sections.result}
          </h2>
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
            <p>
              <span className="text-slate-500">{copy.labels.currentFormat}: </span>
              <span className="font-medium text-slate-900">{selectedFormatLabel}</span>
            </p>
            <p>
              <span className="text-slate-500">{copy.labels.generatedAt}: </span>
              <span className="font-medium text-slate-900">{generatedAt}</span>
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {copy.labels.httpsUrl}
            </p>
            <p className="mt-2 break-all text-sm text-slate-700">
              {displayedOutputUrl}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              {copy.actions.copy}
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {copy.actions.regenerate}
            </button>
            {copyState === "success" && (
              <span className="text-sm text-emerald-700">{copy.actions.copySuccess}</span>
            )}
            {copyState === "error" && (
              <span className="text-sm text-rose-700">{copy.actions.copyError}</span>
            )}
          </div>

          {showPublishControls && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {copy.sections.publish}
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${publishStatusClass[publishStatus]}`}
                >
                  {copy.publishStatus[publishStatus]}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{publishNoticeText}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmPublish}
                  disabled={publishStatus === "confirmed" || selectedSourceIds.length === 0}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copy.actions.confirmPublish}
                </button>
                <button
                  type="button"
                  onClick={handleResetPublish}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  {copy.actions.resetPublish}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
