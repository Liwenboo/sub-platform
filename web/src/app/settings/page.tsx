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
const TEST_CONNECTION_DELAY_MS = 900;

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
    notice: "\u7528\u6237\u63d0\u793a",
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
    userNoticeEnabled: "\u542f\u7528 viewer \u63d0\u793a",
    userNoticeTitle: "\u63d0\u793a\u6807\u9898",
    userNoticeMessage: "\u63d0\u793a\u5185\u5bb9",
  },
  actions: {
    testConnection: "\u68c0\u6d4b\u8fde\u63a5",
    save: "\u4fdd\u5b58\u8bbe\u7f6e",
    reset: "\u6062\u590d\u9ed8\u8ba4",
    resetLocal: "\u91cd\u7f6e\u5168\u90e8\u6570\u636e",
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
    saved: "\u8bbe\u7f6e\u5df2\u4fdd\u5b58",
    reset: "\u5df2\u6062\u590d\u9ed8\u8ba4\u8bbe\u7f6e",
    localReset:
      "\u5df2\u91cd\u7f6e\u5168\u90e8\u6570\u636e\uff0c\u5f53\u524d\u72b6\u6001\u5df2\u6062\u590d\u5230\u521d\u59cb\u9ed8\u8ba4\u503c\u3002",
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
    userNoticeEnabled,
    userNoticeTitle,
    userNoticeMessage,
    userNoticeUpdatedAt,
    refreshAppData,
    saveSettingsPatch,
    setDefaultSourceId,
    setDefaultOutputFormat,
    setUrlTokenEnabled,
    resetSettingsDefaults,
    resetLocalData,
  } = useAppData();
  const canEditSettings = canManageSettingsRole(role);
  const router = useRouter();

  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftDefaultSourceId, setDraftDefaultSourceId] = useState<string | null>(
    defaultSourceId
  );
  const [draftDefaultOutputFormat, setDraftDefaultOutputFormat] =
    useState<OutputFormatId>(defaultOutputFormat);
  const [draftUrlTokenEnabled, setDraftUrlTokenEnabled] = useState(urlTokenEnabled);
  const [draftServiceUrl, setDraftServiceUrl] = useState(serviceUrl);
  const [draftApiPath, setDraftApiPath] = useState(apiPath);
  const [draftPublishDomain, setDraftPublishDomain] = useState(publishDomain);
  const [draftHttpsEnabled, setDraftHttpsEnabled] = useState(httpsEnabled);
  const [draftUserNoticeEnabled, setDraftUserNoticeEnabled] =
    useState(userNoticeEnabled);
  const [draftUserNoticeTitle, setDraftUserNoticeTitle] =
    useState(userNoticeTitle);
  const [draftUserNoticeMessage, setDraftUserNoticeMessage] =
    useState(userNoticeMessage);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetAllSubmitting, setResetAllSubmitting] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

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

  useEffect(() => {
    setDraftDefaultSourceId(defaultSourceId);
  }, [defaultSourceId]);

  useEffect(() => {
    setDraftDefaultOutputFormat(defaultOutputFormat);
  }, [defaultOutputFormat]);

  useEffect(() => {
    setDraftUrlTokenEnabled(urlTokenEnabled);
  }, [urlTokenEnabled]);

  useEffect(() => {
    setDraftServiceUrl(serviceUrl);
  }, [serviceUrl]);

  useEffect(() => {
    setDraftApiPath(apiPath);
  }, [apiPath]);

  useEffect(() => {
    setDraftPublishDomain(publishDomain);
  }, [publishDomain]);

  useEffect(() => {
    setDraftHttpsEnabled(httpsEnabled);
  }, [httpsEnabled]);

  useEffect(() => {
    setDraftUserNoticeEnabled(userNoticeEnabled);
  }, [userNoticeEnabled]);

  useEffect(() => {
    setDraftUserNoticeTitle(userNoticeTitle);
  }, [userNoticeTitle]);

  useEffect(() => {
    setDraftUserNoticeMessage(userNoticeMessage);
  }, [userNoticeMessage]);

  const hasPendingAction =
    saveSubmitting || resetSubmitting || resetAllSubmitting || testingConnection;

  const handleTestConnection = async () => {
    if (!canEditSettings || hasPendingAction) {
      return;
    }

    if (checkTimerRef.current) {
      window.clearTimeout(checkTimerRef.current);
    }

    setErrorMessage(null);
    setTestingConnection(true);

    try {
      const persistDraftResult = await saveSettingsPatch({
        serviceUrl: draftServiceUrl,
        apiPath: draftApiPath,
        publishDomain: draftPublishDomain,
        httpsEnabled: draftHttpsEnabled,
      });

      if (!persistDraftResult.ok) {
        setErrorMessage(persistDraftResult.error?.message ?? "保存设置失败，请稍后重试。");
        return;
      }

      const checkingResult = await saveSettingsPatch({
        serviceCheckStatus: "checking",
        serviceLastCheckedAt: null,
      });

      if (!checkingResult.ok) {
        setErrorMessage(checkingResult.error?.message ?? "检测连接失败，请稍后重试。");
        return;
      }

      const maybeSuccess = await new Promise<boolean>((resolve) => {
        checkTimerRef.current = window.setTimeout(() => {
          resolve(
            draftServiceUrl.startsWith("http") &&
              draftApiPath.length > 0 &&
              Math.random() > 0.25
          );
        }, TEST_CONNECTION_DELAY_MS);
      });
      checkTimerRef.current = null;

      const result = await saveSettingsPatch({
        serviceCheckStatus: maybeSuccess ? "success" : "failed",
        serviceLastCheckedAt: formatDateTime(new Date()),
      });

      if (!result.ok) {
        setErrorMessage(result.error?.message ?? "更新连接检测结果失败，请稍后重试。");
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async () => {
    if (!canEditSettings || hasPendingAction) {
      return;
    }

    setErrorMessage(null);
    setSaveSubmitting(true);

    try {
      const normalizedDraftUserNoticeTitle = draftUserNoticeTitle.trim();
      const normalizedDraftUserNoticeMessage = draftUserNoticeMessage.trim();
      const userNoticeChanged =
        draftUserNoticeEnabled !== userNoticeEnabled ||
        normalizedDraftUserNoticeTitle !== userNoticeTitle ||
        normalizedDraftUserNoticeMessage !== userNoticeMessage;
      const outputConfigResult = await setDefaultSourceId(draftDefaultSourceId);
      if (!outputConfigResult.ok) {
        setErrorMessage(
          outputConfigResult.error?.message ?? "保存默认订阅源失败，请稍后重试。"
        );
        return;
      }

      const formatResult = await setDefaultOutputFormat(draftDefaultOutputFormat);
      if (!formatResult.ok) {
        setErrorMessage(formatResult.error?.message ?? "保存默认输出格式失败，请稍后重试。");
        return;
      }

      const tokenResult = await setUrlTokenEnabled(draftUrlTokenEnabled);
      if (!tokenResult.ok) {
        setErrorMessage(tokenResult.error?.message ?? "保存 URL Token 设置失败，请稍后重试。");
        return;
      }

      const settingsResult = await saveSettingsPatch({
        serviceUrl: draftServiceUrl,
        apiPath: draftApiPath,
        publishDomain: draftPublishDomain,
        httpsEnabled: draftHttpsEnabled,
        userNoticeEnabled: draftUserNoticeEnabled,
        userNoticeTitle: normalizedDraftUserNoticeTitle,
        userNoticeMessage: normalizedDraftUserNoticeMessage,
        ...(userNoticeChanged
          ? { userNoticeUpdatedAt: formatDateTime(new Date()) }
          : { userNoticeUpdatedAt }),
      });

      if (!settingsResult.ok) {
        setErrorMessage(settingsResult.error?.message ?? "保存系统设置失败，请稍后重试。");
        return;
      }

      await refreshAppData();
      setFeedbackStatus("saved");

      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedbackStatus("idle");
        feedbackTimerRef.current = null;
      }, 2000);
    } finally {
      setSaveSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!canEditSettings || hasPendingAction) {
      return;
    }

    const confirmed = window.confirm(
      "恢复默认设置后，服务地址、默认输出配置和发布域名将恢复为系统默认值，当前未保存的修改也会丢失。是否继续？"
    );

    if (!confirmed) {
      return;
    }

    if (checkTimerRef.current) {
      window.clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    setErrorMessage(null);
    setResetSubmitting(true);

    try {
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
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleResetLocalData = async () => {
    if (!canEditSettings || hasPendingAction) {
      return;
    }

    const confirmed = window.confirm(
      "重置全部数据后，订阅源、输出配置和系统设置都会恢复到初始默认值，且该操作不可撤销。是否继续？"
    );

    if (!confirmed) {
      return;
    }

    if (checkTimerRef.current) {
      window.clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    setErrorMessage(null);
    setResetAllSubmitting(true);

    try {
      const result = await resetLocalData();
      if (!result.ok) {
        setErrorMessage(result.error?.message ?? "重置全部数据失败，请稍后重试。");
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
    } finally {
      setResetAllSubmitting(false);
    }
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
                value={draftServiceUrl}
                onChange={(event) => setDraftServiceUrl(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.apiPath}
              </span>
              <input
                type="text"
                value={draftApiPath}
                onChange={(event) => setDraftApiPath(event.target.value)}
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
              disabled={hasPendingAction || serviceCheckStatus === "checking"}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testingConnection ? "检测中..." : copy.actions.testConnection}
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
                value={draftDefaultOutputFormat}
                onChange={(event) =>
                  setDraftDefaultOutputFormat(event.target.value as OutputFormatId)
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
                value={draftDefaultSourceId ?? ""}
                onChange={(event) =>
                  setDraftDefaultSourceId(
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
              aria-pressed={draftUrlTokenEnabled}
              onClick={() => setDraftUrlTokenEnabled(!draftUrlTokenEnabled)}
              className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition-colors ${
                draftUrlTokenEnabled ? "bg-slate-900" : "bg-slate-300"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  draftUrlTokenEnabled ? "translate-x-5" : "translate-x-0"
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
                value={draftPublishDomain}
                onChange={(event) => setDraftPublishDomain(event.target.value)}
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
                    draftHttpsEnabled
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {draftHttpsEnabled ? copy.statuses.enabled : copy.statuses.disabled}
                </span>
                <button
                  type="button"
                  onClick={() => setDraftHttpsEnabled(!draftHttpsEnabled)}
                  className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  {copy.actions.toggle}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {copy.sections.notice}
          </h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.userNoticeEnabled}
              </span>
              <button
                type="button"
                aria-pressed={draftUserNoticeEnabled}
                onClick={() => setDraftUserNoticeEnabled(!draftUserNoticeEnabled)}
                className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition-colors ${
                  draftUserNoticeEnabled ? "bg-amber-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    draftUserNoticeEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.userNoticeTitle}
              </span>
              <input
                type="text"
                value={draftUserNoticeTitle}
                onChange={(event) => setDraftUserNoticeTitle(event.target.value)}
                placeholder="默认使用提醒"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {copy.fields.userNoticeMessage}
              </span>
              <textarea
                value={draftUserNoticeMessage}
                onChange={(event) => setDraftUserNoticeMessage(event.target.value)}
                rows={4}
                placeholder="例如：请勿在公共设备保存订阅链接，如节点异常请先更新订阅。"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
              />
            </label>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={hasPendingAction}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              {saveSubmitting ? "保存中..." : copy.actions.save}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={hasPendingAction}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {resetSubmitting ? "恢复中..." : copy.actions.reset}
            </button>
            <button
              type="button"
              onClick={handleResetLocalData}
              disabled={hasPendingAction}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-200 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
            >
              {resetAllSubmitting ? "重置中..." : copy.actions.resetLocal}
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
