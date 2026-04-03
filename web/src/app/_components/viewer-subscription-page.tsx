"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "../_state/app-data-context";
import type { OutputFormatId } from "../_types/app-types";
import {
  buildInitialSelectedSourceIds,
  buildOutputLink,
} from "../_data/services/output-link-service";
import { maskSensitiveParamsInUrl } from "../_utils/access-control";
import { ViewerPageHero } from "./viewer-page-hero";

type ViewerSubscriptionPageProps = {
  title: string;
  subtitle: string;
};

type CopyState = "idle" | "success" | "error";

type FormatOption = {
  id: OutputFormatId;
  label: string;
  description: string;
};

const formatOptions: FormatOption[] = [
  { id: "clash", label: "Clash", description: "适用于 Clash 客户端" },
  {
    id: "clash-meta",
    label: "Clash.Meta",
    description: "适用于 Clash Meta 内核客户端",
  },
  { id: "v2ray", label: "V2Ray", description: "适用于 V2Ray 生态客户端" },
  { id: "sing-box", label: "Sing-box", description: "适用于 Sing-box 客户端" },
];

const copy = {
  sections: {
    sources: "可用订阅源",
    formats: "客户端格式",
    result: "你的订阅链接",
    usage: "客户端导入说明",
  },
  labels: {
    selectedCount: "已选线路",
    httpsUrl: "订阅链接",
    emptySourceHint: "请先至少选择 1 条线路后再复制。",
  },
  actions: {
    copy: "一键复制链接",
    copySuccess: "复制成功，可直接粘贴到客户端",
    copyError: "复制失败，请手动复制下方链接",
  },
  hints: {
    result: "已根据当前选择生成订阅链接。",
  },
  usageSteps: [
    "选择你正在使用的客户端格式。",
    "复制上方订阅链接。",
    "在客户端中选择“从 URL 导入”或“订阅导入”。",
    "粘贴链接并执行更新订阅。",
  ],
};

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

export function ViewerSubscriptionPage({
  title,
  subtitle,
}: ViewerSubscriptionPageProps) {
  const {
    role,
    sources,
    defaultSourceId,
    defaultOutputFormat,
    urlTokenEnabled,
    publishDomain,
  } = useAppData();

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() =>
    buildInitialSelectedSourceIds(sources, defaultSourceId)
  );
  const [selectedFormat, setSelectedFormat] =
    useState<OutputFormatId>(defaultOutputFormat);
  const [copyState, setCopyState] = useState<CopyState>("idle");

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

  const outputUrl = useMemo(() => {
    return buildOutputLink({
      selectedFormat,
      selectedSourceIds,
      publishDomain,
      urlTokenEnabled,
      token: "viewer_demo_token",
    });
  }, [selectedFormat, selectedSourceIds, publishDomain, urlTokenEnabled]);

  const displayedOutputUrl = useMemo(
    () => maskSensitiveParamsInUrl(outputUrl, role),
    [outputUrl, role]
  );

  const canCopy = selectedSourceIds.length > 0;

  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleCopyLink = async () => {
    if (!canCopy) {
      return;
    }

    const copied = await copyToClipboard(displayedOutputUrl);
    setCopyState(copied ? "success" : "error");

    window.setTimeout(() => {
      setCopyState("idle");
    }, 1800);
  };

  const sectionCardClassName =
    "rounded-2xl border border-slate-200 bg-white p-7 shadow-sm md:p-8";
  const sectionTitleClassName = "text-lg font-semibold text-slate-900";
  const sectionSpacingClassName = "mt-8";
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto w-full max-w-5xl px-6 py-12 md:py-16">
        <ViewerPageHero title={title} subtitle={subtitle} />

        <section className={`${sectionSpacingClassName} ${sectionCardClassName}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={sectionTitleClassName}>{copy.sections.sources}</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {copy.labels.selectedCount}: {selectedSourceIds.length}
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {sources.map((source) => {
              const selected = selectedSourceIds.includes(source.id);

              return (
                <label
                  key={source.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                    selected
                      ? "border-slate-900 bg-slate-100 ring-1 ring-slate-900/10"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSourceSelection(source.id)}
                    className="mt-0.5 h-4 w-4 accent-slate-900"
                  />
                  <span className="block text-sm font-medium text-slate-900">
                    {source.name}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className={`${sectionSpacingClassName} ${sectionCardClassName}`}>
          <h2 className={sectionTitleClassName}>{copy.sections.formats}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {formatOptions.map((format) => {
              const selected = selectedFormat === format.id;

              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => setSelectedFormat(format.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selected
                      ? "border-2 border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold">{format.label}</p>
                  <p
                    className={`mt-1 text-xs ${
                      selected ? "text-slate-200" : "text-slate-500"
                    }`}
                  >
                    {format.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className={`${sectionSpacingClassName} ${sectionCardClassName}`}>
          <h2 className={sectionTitleClassName}>{copy.sections.result}</h2>
          <p className="mt-4 text-sm text-slate-600">{copy.hints.result}</p>

          <div className="mt-5 rounded-2xl border-2 border-slate-900 bg-slate-50 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {copy.labels.httpsUrl}
            </p>
            <p className="mt-2 break-all text-sm font-medium text-slate-900">
              {displayedOutputUrl}
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!canCopy}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-slate-900 px-7 text-base font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {copy.actions.copy}
            </button>
            {!canCopy && (
              <p className="text-sm text-amber-700">{copy.labels.emptySourceHint}</p>
            )}
          </div>

          {copyState !== "idle" && (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                copyState === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {copyState === "success" ? copy.actions.copySuccess : copy.actions.copyError}
            </div>
          )}
        </section>

        <section className={`${sectionSpacingClassName} ${sectionCardClassName}`}>
          <h2 className={sectionTitleClassName}>{copy.sections.usage}</h2>
          <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-sm text-slate-700">
            {copy.usageSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
