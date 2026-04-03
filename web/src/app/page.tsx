"use client";

import Link from "next/link";
import { useAppData } from "./_state/app-data-context";
import {
  isAdminRole,
  maskApiPath,
  maskServiceUrl,
  shouldShowSettingsNav,
} from "./_utils/access-control";
import { getServiceStatusView } from "./_utils/service-status";

const copy = {
  title: "sub-platform",
  description:
    "\u8fd9\u662f\u4e00\u4e2a\u57fa\u4e8e subconverter \u7684\u8f7b\u91cf\u8ba2\u9605\u7ba1\u7406\u5e73\u53f0",
  sourcesTitle: "\u8ba2\u9605\u6e90\u7ba1\u7406",
  sourcesDesc:
    "\u7ba1\u7406\u8ba2\u9605\u5730\u5740\u3001\u6807\u7b7e\u548c\u57fa\u7840\u914d\u7f6e\u3002",
  outputsTitle: "\u8f93\u51fa\u7ba1\u7406",
  outputsDesc:
    "\u7ba1\u7406\u8f93\u51fa\u6a21\u677f\u3001\u683c\u5f0f\u4e0e\u53d1\u5e03\u7b56\u7565\u3002",
  settingsTitle: "\u7cfb\u7edf\u8bbe\u7f6e",
  settingsDesc:
    "\u914d\u7f6e subconverter \u670d\u52a1\u5730\u5740\u4e0e\u9ed8\u8ba4\u8f93\u51fa\u53c2\u6570\u3002",
  serviceTitle: "subconverter \u670d\u52a1\u72b6\u6001",
  serviceAddress: "\u5f53\u524d\u670d\u52a1\u5730\u5740",
  servicePath: "\u5f53\u524d\u57fa\u7840\u8def\u5f84 / API \u8def\u5f84",
  lastCheckedAt: "\u6700\u8fd1\u4e00\u6b21\u68c0\u6d4b\u65f6\u95f4",
  noCheckRecord: "\u6682\u65e0",
  serviceDesc:
    "\u8be5\u72b6\u6001\u7531\u7cfb\u7edf\u8bbe\u7f6e\u9875\u7684\u201c\u68c0\u6d4b\u8fde\u63a5\u201d\u7ed3\u679c\u5b9e\u65f6\u540c\u6b65\u3002",
  serviceDescGuest:
    "\u6765\u5ba2\u89c6\u89d2\u4ec5\u5c55\u793a\u8fde\u63a5\u72b6\u6001\uff0c\u8be6\u7ec6\u53c2\u6570\u7531\u7ba1\u7406\u5458\u53ef\u89c1\u3002",
};

export default function Home() {
  const { role, serviceUrl, apiPath, serviceCheckStatus, serviceLastCheckedAt } =
    useAppData();
  const isAdmin = isAdminRole(role);
  const showSettingsEntry = shouldShowSettingsNav(role);
  const statusView = getServiceStatusView(serviceCheckStatus);
  const displayedServiceUrl = maskServiceUrl(serviceUrl, role);
  const displayedApiPath = maskApiPath(apiPath, role);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-3 text-base text-slate-600 md:text-lg">
            {copy.description}
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/sources"
            className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-lg font-semibold text-slate-900">
              {copy.sourcesTitle}
            </p>
            <p className="mt-2 text-sm text-slate-600">{copy.sourcesDesc}</p>
          </Link>
          <Link
            href="/outputs"
            className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <p className="text-lg font-semibold text-slate-900">
              {copy.outputsTitle}
            </p>
            <p className="mt-2 text-sm text-slate-600">{copy.outputsDesc}</p>
          </Link>
          {showSettingsEntry && (
            <Link
              href="/settings"
              className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <p className="text-lg font-semibold text-slate-900">
                {copy.settingsTitle}
              </p>
              <p className="mt-2 text-sm text-slate-600">{copy.settingsDesc}</p>
            </Link>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{copy.serviceTitle}</h2>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${statusView.className}`}
            >
              {statusView.label}
            </span>
          </div>
          {isAdmin ? (
            <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-3">
              <div>
                <p className="text-slate-500">{copy.serviceAddress}</p>
                <p className="mt-1 break-all font-medium text-slate-900">
                  {displayedServiceUrl}
                </p>
              </div>
              <div>
                <p className="text-slate-500">{copy.servicePath}</p>
                <p className="mt-1 break-all font-medium text-slate-900">
                  {displayedApiPath}
                </p>
              </div>
              <div>
                <p className="text-slate-500">{copy.lastCheckedAt}</p>
                <p className="mt-1 font-medium text-slate-900">
                  {serviceLastCheckedAt ?? copy.noCheckRecord}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-slate-500">{copy.lastCheckedAt}</p>
              <p className="mt-1 font-medium text-slate-900">
                {serviceLastCheckedAt ?? copy.noCheckRecord}
              </p>
            </div>
          )}
          <p className="mt-3 text-sm text-slate-600">
            {isAdmin ? copy.serviceDesc : copy.serviceDescGuest}
          </p>
        </section>
      </main>
    </div>
  );
}
