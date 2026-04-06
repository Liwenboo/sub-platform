"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "../_state/app-data-context";
import type {
  OutputFormatId,
} from "../_types/app-types";
import {
  canManageSettings as canManageSettingsRole,
} from "../_utils/access-control";
import { getServiceStatusView } from "../_utils/service-status";

type FeedbackStatus = "idle" | "saved" | "reset" | "local_reset";

const copy = {
  title: "\u7cfb\u7edf\u8bbe\u7f6e",
  subtitle:
    "\u7528\u4e8e\u914d\u7f6e subconverter \u670d\u52a1\u5730\u5740\u548c\u9ed8\u8ba4\u8f93\u51fa\u53c2\u6570",
  viewerSubtitle:
    "\u5f53\u524d\u4e3a viewer \u89c6\u89d2\uff0c\u8fd9\u91cc\u4ec5\u5c55\u793a\u53ef\u9605\u8bfb\u6982\u89c8\u4fe1\u606f\u3002",
  viewerOverviewTitle: "\u7cfb\u7edf\u53c2\u6570\u6982\u89c8",
  viewerOverviewHint:
    "\u8be6\u7ec6\u914d\u7f6e\u53ca\u7ba1\u7406\u64cd\u4f5c\u4ec5\u5bf9\u7ba1\u7406\u5458\u5f00\u653e\u3002",
  sections: {
    service: "subconverter \u670d\u52a1\u914d\u7f6e",
    defaults: "\u9ed8\u8ba4\u8f93\u51fa\u914d\u7f6e",
    publish: "\u53d1\u5e03\u57df\u540d\u914d\u7f6e",
  },
  fields: {
    serviceUrl: "\u670d\u52a1\u5730\u5740",
    apiPath: "API \u8def\u5f84\u6216\u57fa\u7840\u8def\u5f84",
    connectStatus: "\u8fde\u63a5\u72b6\u6001",
    defaultFormat: "\u9ed8\u8ba4\u8f93\u51fa\u683c\u5f0f",
    defaultSource: "\u9ed8\u8ba4\u8ba2\u9605\u6e90",
    urlToken: "URL Token \u5f00\u5173",
    publishDomain: "\u5bf9\u5916\u53d1\u5e03\u57df\u540d",
    httpsStatus: "HTTPS \u72b6\u6001",
  },
  actions: {
    testConnection: "\u68c0\u6d4b\u8fde\u63a5",
    save: "\u4fdd\u5b58\u8bbe\u7f6e",
    reset: "\u6062\u590d\u9ed8\u8ba4",
    resetLocal: "\u91cd\u7f6e\u672c\u5730\u6570\u636e",
    toggle: "\u5207\u6362",
  },
  statuses: {
    notChecked: "\u672a\u68c0\u6d4b",
    checking: "\u68c0\u6d4b\u4e2d",
    success: "\u8fde\u63a5\u6210\u529f",
    failed: "\u8fde\u63a5\u5931\u8d25",
    enabled: "\u5df2\u542f\u7528",
    disabled: "\u5df2\u5173\u95ed",
    noSource: "\u6682\u65e0\u53ef\u7528\u8ba2\u9605\u6e90",
  },
  feedback: {
    saved: "\u8bbe\u7f6e\u5df2\u4fdd\u5b58\uff08\u672c\u5730\u6a21\u62df\uff09",
    reset: "\u5df2\u6062\u590d\u9ed8\u8ba4\u8bbe\u7f6e",
    localReset:
      "\u5df2\u91cd\u7f6e\u672c\u5730\u6570\u636e\uff0c\u5f53\u524d\u72b6\u6001\u5df2\u56de\u5230\u521d\u59cb\u9ed8\u8ba4\u503c\u3002",
  },
};

const outputFormatOptions: Array<{ id: OutputFormatId; label: string }> = [
  { id: "clash", label: "Clash" },
  { id: "clash-meta", label: "Clash.Meta" },
  { id: "v2ray", label: "V2Ray" },
  { id: "sing-box", label: "Sing-box" },
];

function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

export default function SettingsPage() {
  const {
    role,
    sources,
    defaultSourceId,
    defaultOutputFormat,
    urlTokenEnabled,
    serviceUrl,
    apiPath,
    serviceCheckStatus,
    publishDomain,
    httpsEnabled,
    refreshAppData,
    saveSettingsPatch,
    setDefaultSourceId,
    setDefaultOutputFormat,
    setUrlTokenEnabled,
    setServiceUrl,
    setApiPath,
    setPublishDomain,
    setHttpsEnabled,
    resetSettingsDefaults,
    resetLocalData,
  } = useAppData();
  const canEditSettings = canManageSettingsRole(role);
  const router = useRouter();

  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (checkTimerRef.current) {
        window.clearTimeout(checkTimerRef.current);
      }
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canEditSettings) {
      router.replace("/");
    }
  }, [canEditSettings, router]);

  const handleTestConnection = () => {
    if (!canEditSettings) {
      return;
    }

    if (checkTimerRef.current) {
      window.clearTimeout(checkTimerRef.current);
    }

    setErrorMessage(null);
    void (async () => {
      const result = await saveSettingsPatch({
        serviceCheckStatus: "checking",
        serviceLastCheckedAt: null,
      });

      if (!result.ok) {
        setErrorMessage(result.error?.message ?? "检测连接失败，请稍后重试。");
      }
    })();

    checkTimerRef.current = window.setTimeout(() => {
      const maybeSuccess =
        serviceUrl.startsWith("http") && apiPath.length > 0 && Math.random() > 0.25;

      void (async () => {
        const result = await saveSettingsPatch({
          serviceCheckStatus: maybeSuccess ? "success" : "failed",
          serviceLastCheckedAt: formatDateTime(new Date()),
        });

        if (!result.ok) {
          setErrorMessage(result.error?.message ?? "更新连接检测结果失败，请稍后重试。");
        }
      })();
      checkTimerRef.current = null;
    }, 900);
  };

  const handleSave = async () => {
    if (!canEditSettings) {
      return;
    }

    setErrorMessage(null);
    await refreshAppData();
    setFeedbackStatus("saved");

    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackStatus("idle");
      feedbackTimerRef.current = null;
    }, 2000);
  };

  const handleReset = async () => {
    if (!canEditSettings) {
      return;
    }

    if (checkTimerRef.current) {
      window.clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    setErrorMessage(null);
    const result = await resetSettingsDefaults();
    if (!result.ok) {
      setErrorMessage(result.error?.message ?? "恢复默认设置失败，请稍后重试。");
      return;
    }

    setFeedbackStatus("reset");

    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackStatus("idle");
      feedbackTimerRef.current = null;
    }, 2000);
  };

  const handleResetLocalData = async () => {
    if (!canEditSettings) {
      return;
    }

    if (checkTimerRef.current) {
      window.clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    setErrorMessage(null);
    const result = await resetLocalData();
    if (!result.ok) {
      setErrorMessage(result.error?.message ?? "重置本地数据失败，请稍后重试。");
      return;
    }

    setFeedbackStatus("local_reset");

    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackStatus("idle");
      feedbackTimerRef.current = null;
    }, 2200);
  };

  const connectionStatusUI = getServiceStatusView(serviceCheckStatus);

  if (!canEditSettings) {
    return null;
  }

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
          <h2 className="text-lg font-semibold text-slate-900">
            {copy.sections.service}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.serviceUrl}
              </span>
              <input
                type="text"
                value={serviceUrl}
                onChange={(event) => setServiceUrl(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.apiPath}
              </span>
              <input
                type="text"
                value={apiPath}
                onChange={(event) => setApiPath(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-700">
              {copy.fields.connectStatus}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${connectionStatusUI.className}`}
            >
              {connectionStatusUI.label}
            </span>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={serviceCheckStatus === "checking"}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copy.actions.testConnection}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {copy.sections.defaults}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.defaultFormat}
              </span>
              <select
                value={defaultOutputFormat}
                onChange={(event) =>
                  setDefaultOutputFormat(event.target.value as OutputFormatId)
                }
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
              >
                {outputFormatOptions.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.defaultSource}
              </span>
              <select
                value={defaultSourceId ?? ""}
                onChange={(event) =>
                  setDefaultSourceId(
                    event.target.value.length > 0 ? event.target.value : null
                  )
                }
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
              >
                {sources.length === 0 && (
                  <option value="">{copy.statuses.noSource}</option>
                )}
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-sm font-medium text-slate-700">
              {copy.fields.urlToken}
            </span>
            <button
              type="button"
              aria-pressed={urlTokenEnabled}
              onClick={() => setUrlTokenEnabled(!urlTokenEnabled)}
              className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition-colors ${
                urlTokenEnabled ? "bg-slate-900" : "bg-slate-300"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  urlTokenEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {copy.sections.publish}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.publishDomain}
              </span>
              <input
                type="text"
                value={publishDomain}
                onChange={(event) => setPublishDomain(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
              />
            </label>
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.httpsStatus}
              </span>
              <div className="flex h-10 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    httpsEnabled
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {httpsEnabled ? copy.statuses.enabled : copy.statuses.disabled}
                </span>
                <button
                  type="button"
                  onClick={() => setHttpsEnabled(!httpsEnabled)}
                  className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  {copy.actions.toggle}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              {copy.actions.save}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {copy.actions.reset}
            </button>
            <button
              type="button"
              onClick={handleResetLocalData}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-200 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
            >
              {copy.actions.resetLocal}
            </button>
            {feedbackStatus === "saved" && (
              <span className="text-sm text-emerald-700">{copy.feedback.saved}</span>
            )}
            {feedbackStatus === "reset" && (
              <span className="text-sm text-slate-700">{copy.feedback.reset}</span>
            )}
            {feedbackStatus === "local_reset" && (
              <span className="text-sm text-rose-700">{copy.feedback.localReset}</span>
            )}
            {errorMessage && (
              <span className="text-sm text-rose-700">{errorMessage}</span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
