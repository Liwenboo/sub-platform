"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "../_state/app-data-context";
import type { SourceStatus } from "../_types/app-types";
import type {
  SourceFormValues,
  SourceImportInputMode,
  SourceImportPreviewItem,
  SourcePreviewType,
} from "../_types/sources-types";
import { createEmptySourceFormValues } from "../_data/defaults/sources-defaults";
import {
  canManageSources,
  maskSubscriptionUrl,
  shouldShowSourceInternalColumns,
} from "../_utils/access-control";
import {
  getSourceStatusClass,
  getSourceStatusLabel,
} from "../_utils/source-status";

const copy = {
  title: "\u8ba2\u9605\u6e90\u7ba1\u7406",
  subtitle:
    "\u7528\u4e8e\u7ba1\u7406\u8ba2\u9605\u5730\u5740\u3001\u6807\u7b7e\u548c\u57fa\u7840\u914d\u7f6e",
  addButton: "\u65b0\u589e\u8ba2\u9605\u6e90",
  importButton: "\u5bfc\u5165\u8ba2\u9605",
  import: {
    title: "\u5bfc\u5165\u8ba2\u9605\u6e90",
    subtitle:
      "\u652f\u6301\u7c98\u8d34\u8ba2\u9605\u94fe\u63a5\u6216\u539f\u59cb\u8ba2\u9605\u6587\u672c\uff0c\u751f\u6210\u9884\u89c8\u540e\u518d\u786e\u8ba4\u5bfc\u5165\u3002",
    linkMode: "\u8ba2\u9605\u94fe\u63a5",
    textMode: "\u539f\u59cb\u6587\u672c",
    inputLabelLink: "\u7c98\u8d34\u8ba2\u9605\u94fe\u63a5\uff08\u53ef\u591a\u884c\uff09",
    inputLabelText:
      "\u7c98\u8d34 vmess / vless / \u6df7\u5408\u8ba2\u9605\u539f\u59cb\u6587\u672c",
    inputPlaceholderLink:
      "https://example.com/sub/a\nhttps://example.com/sub/b",
    inputPlaceholderText:
      "vmess://...\nvless://...\n# \u6216\u8005\u6df7\u5408\u6587\u672c\u5185\u5bb9",
    generatePreview: "\u751f\u6210\u9884\u89c8",
    confirmImport: "\u786e\u8ba4\u5bfc\u5165",
    clearPreview: "\u6e05\u7a7a\u9884\u89c8",
    close: "\u5173\u95ed",
    previewTitle: "\u5bfc\u5165\u9884\u89c8",
    previewCount: "\u9884\u89c8\u6761\u6570",
    sourceType: "\u6765\u6e90\u7c7b\u578b",
    summary: "\u539f\u59cb\u5185\u5bb9\u6458\u8981",
    tags: "\u6807\u7b7e\u5360\u4f4d",
    name: "\u540d\u79f0\u5360\u4f4d",
    typeLink: "\u94fe\u63a5",
    typeText: "\u6587\u672c",
    invalidInput:
      "\u672a\u8bc6\u522b\u5230\u6709\u6548\u8f93\u5165\uff0c\u8bf7\u68c0\u67e5\u5185\u5bb9\u540e\u91cd\u8bd5\u3002",
    invalidLink:
      "\u94fe\u63a5\u8f93\u5165\u5305\u542b\u65e0\u6548\u9879\uff0c\u8bf7\u786e\u8ba4\u6bcf\u884c\u90fd\u662f\u5408\u6cd5\u94fe\u63a5\u3002",
    imported: "\u5df2\u5bfc\u5165",
    importedSuffix: "\u6761\u8ba2\u9605\u6e90",
  },
  form: {
    createTitle: "\u65b0\u589e\u8ba2\u9605\u6e90",
    editTitle: "\u7f16\u8f91\u8ba2\u9605\u6e90",
    name: "\u540d\u79f0",
    url: "\u8ba2\u9605\u5730\u5740",
    tags: "\u6807\u7b7e\uff08\u9017\u53f7\u5206\u9694\uff09",
    tagsPlaceholder: "\u9ed8\u8ba4, \u9ad8\u901f",
    status: "\u72b6\u6001",
    save: "\u4fdd\u5b58",
    cancel: "\u53d6\u6d88",
  },
  tableHeaders: {
    name: "\u540d\u79f0",
    url: "\u8ba2\u9605\u5730\u5740",
    tags: "\u6807\u7b7e",
    status: "\u72b6\u6001",
    updatedAt: "\u6700\u8fd1\u66f4\u65b0\u65f6\u95f4",
    actions: "\u64cd\u4f5c",
  },
  actions: {
    edit: "\u7f16\u8f91",
    remove: "\u5220\u9664",
    confirmDelete: "\u786e\u8ba4\u5220\u9664",
    cancelDelete: "\u53d6\u6d88",
  },
  deletePrompt: "\u786e\u8ba4\u5220\u9664\u8ba2\u9605\u6e90",
};

function parseTags(tagsInput: string): string[] {
  return tagsInput
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatNow(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function getSummary(text: string, maxLength = 78): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function splitLines(input: string): string[] {
  return input
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isLikelyLink(input: string): boolean {
  if (!input) {
    return false;
  }

  try {
    const parsed = new URL(input);
    return parsed.protocol.length > 1;
  } catch {
    return /^(vmess|vless|trojan|ss|ssr|hysteria2?|tuic):\/\//i.test(input);
  }
}

function getLinkName(link: string, index: number): string {
  try {
    const parsed = new URL(link);
    return `\u5bfc\u5165\u94fe\u63a5 ${index + 1} - ${parsed.host}`;
  } catch {
    const matched = link.match(/^([a-zA-Z][\w+.-]*):\/\//);
    if (matched?.[1]) {
      return `\u5bfc\u5165\u94fe\u63a5 ${index + 1} - ${matched[1]}`;
    }
  }

  return `\u5bfc\u5165\u94fe\u63a5 ${index + 1}`;
}

function getTextName(type: SourcePreviewType, index: number): string {
  return type === "link"
    ? `\u5bfc\u5165\u884c ${index + 1} - \u94fe\u63a5`
    : `\u5bfc\u5165\u884c ${index + 1} - \u6587\u672c`;
}

function buildImportPreviews(
  mode: SourceImportInputMode,
  rawInput: string
): { items: SourceImportPreviewItem[]; error: string | null } {
  if (!rawInput.trim()) {
    return { items: [], error: copy.import.invalidInput };
  }

  const lines = splitLines(rawInput);
  if (lines.length === 0) {
    return { items: [], error: copy.import.invalidInput };
  }

  if (mode === "link") {
    const hasInvalid = lines.some((line) => !isLikelyLink(line));
    if (hasInvalid) {
      return { items: [], error: copy.import.invalidLink };
    }

    return {
      items: lines.map((line, index) => ({
        id: `preview-link-${index}-${Date.now()}`,
        name: getLinkName(line, index),
        sourceType: "link",
        summary: getSummary(line),
        tags: ["\u5bfc\u5165", "\u94fe\u63a5"],
        raw: line,
      })),
      error: null,
    };
  }

  return {
    items: lines.slice(0, 80).map((line, index) => {
      const sourceType: SourcePreviewType = isLikelyLink(line) ? "link" : "text";

      return {
        id: `preview-text-${index}-${Date.now()}`,
        name: getTextName(sourceType, index),
        sourceType,
        summary: getSummary(line),
        tags:
          sourceType === "link"
            ? ["\u5bfc\u5165", "\u94fe\u63a5"]
            : ["\u5bfc\u5165", "\u6587\u672c"],
        raw: line,
      };
    }),
    error: null,
  };
}

export default function SourcesPage() {
  const { role, sources, addSource, updateSource, deleteSource } = useAppData();
  const router = useRouter();
  const canEditSources = canManageSources(role);
  const showInternalColumns = shouldShowSourceInternalColumns(role);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<SourceFormValues>(
    createEmptySourceFormValues
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<SourceImportInputMode>("link");
  const [importInput, setImportInput] = useState({ link: "", text: "" });
  const [importPreviews, setImportPreviews] = useState<SourceImportPreviewItem[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const pendingDeleteSource = useMemo(
    () => sources.find((item) => item.id === pendingDeleteId) ?? null,
    [pendingDeleteId, sources]
  );

  useEffect(() => {
    if (!canEditSources) {
      router.replace("/");
    }
  }, [canEditSources, router]);

  const isEditing = formMode === "edit";

  if (!canEditSources) {
    return null;
  }

  const openCreateForm = () => {
    if (!canEditSources) {
      return;
    }

    setImportOpen(false);
    setImportError(null);
    setImportSuccess(null);
    setFormMode("create");
    setEditingId(null);
    setFormValues(createEmptySourceFormValues());
  };

  const openImportPanel = () => {
    if (!canEditSources) {
      return;
    }

    setFormMode(null);
    setEditingId(null);
    setImportOpen(true);
    setImportError(null);
    setImportSuccess(null);
  };

  const closeImportPanel = () => {
    setImportOpen(false);
    setImportPreviews([]);
    setImportError(null);
    setImportSuccess(null);
  };

  const openEditForm = (source: {
    id: string;
    name: string;
    url: string;
    tags: string[];
    status: SourceStatus;
  }) => {
    if (!canEditSources) {
      return;
    }

    setImportOpen(false);
    setImportError(null);
    setImportSuccess(null);
    setFormMode("edit");
    setEditingId(source.id);
    setFormValues({
      name: source.name,
      url: source.url,
      tagsInput: source.tags.join(", "),
      status: source.status,
    });
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormValues(createEmptySourceFormValues());
  };

  const onSubmitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditSources) {
      return;
    }

    const nextItem = {
      name: formValues.name.trim(),
      url: formValues.url.trim(),
      tags: parseTags(formValues.tagsInput),
      status: formValues.status,
      updatedAt: formatNow(),
    };

    if (!nextItem.name || !nextItem.url) {
      return;
    }

    if (isEditing && editingId) {
      updateSource(editingId, nextItem);
    } else {
      addSource({
        id: `src-${Date.now()}`,
        ...nextItem,
      });
    }

    closeForm();
  };

  const handleGenerateImportPreview = () => {
    if (!canEditSources) {
      return;
    }

    const rawInput = importMode === "link" ? importInput.link : importInput.text;
    const result = buildImportPreviews(importMode, rawInput);

    if (result.error) {
      setImportPreviews([]);
      setImportError(result.error);
      setImportSuccess(null);
      return;
    }

    setImportPreviews(result.items);
    setImportError(null);
    setImportSuccess(null);
  };

  const handleConfirmImport = () => {
    if (!canEditSources) {
      return;
    }

    if (importPreviews.length === 0) {
      setImportError(copy.import.invalidInput);
      setImportSuccess(null);
      return;
    }

    const now = formatNow();
    const nowSeed = Date.now();

    importPreviews.forEach((item, index) => {
      addSource({
        id: `src-import-${nowSeed}-${index}`,
        name: item.name,
        url: item.raw,
        tags: item.tags,
        status: "online",
        updatedAt: now,
      });
    });

    setImportInput({ link: "", text: "" });
    setImportPreviews([]);
    setImportError(null);
    setImportSuccess(
      `${copy.import.imported} ${importPreviews.length} ${copy.import.importedSuffix}`
    );
  };

  const requestDelete = (id: string) => {
    if (!canEditSources) {
      return;
    }

    setPendingDeleteId(id);
  };

  const cancelDelete = () => {
    setPendingDeleteId(null);
  };

  const confirmDelete = () => {
    if (!canEditSources || !pendingDeleteId) {
      return;
    }

    deleteSource(pendingDeleteId);
    if (editingId === pendingDeleteId) {
      closeForm();
    }
    setPendingDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {copy.title}
              </h1>
              <p className="mt-3 text-base text-slate-600 md:text-lg">
                {copy.subtitle}
              </p>
            </div>
            {canEditSources && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openImportPanel}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {copy.importButton}
                </button>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                >
                  {copy.addButton}
                </button>
              </div>
            )}
          </div>
        </section>

        {canEditSources && importOpen && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {copy.import.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600">{copy.import.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={closeImportPanel}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {copy.import.close}
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setImportMode("link")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    importMode === "link"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {copy.import.linkMode}
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("text")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    importMode === "text"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {copy.import.textMode}
                </button>
              </div>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {importMode === "link"
                    ? copy.import.inputLabelLink
                    : copy.import.inputLabelText}
                </span>
                <textarea
                  rows={importMode === "link" ? 4 : 7}
                  value={importMode === "link" ? importInput.link : importInput.text}
                  onChange={(event) => {
                    const value = event.target.value;
                    setImportInput((prev) =>
                      importMode === "link"
                        ? { ...prev, link: value }
                        : { ...prev, text: value }
                    );
                  }}
                  placeholder={
                    importMode === "link"
                      ? copy.import.inputPlaceholderLink
                      : copy.import.inputPlaceholderText
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleGenerateImportPreview}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                  >
                    {copy.import.generatePreview}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportPreviews([]);
                      setImportError(null);
                      setImportSuccess(null);
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    {copy.import.clearPreview}
                  </button>
                </div>
                <div className="text-sm">
                  {importError && <span className="text-rose-700">{importError}</span>}
                  {importSuccess && (
                    <span className="text-emerald-700">{importSuccess}</span>
                  )}
                </div>
              </div>
            </div>

            {importPreviews.length > 0 && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-semibold text-slate-900">
                    {copy.import.previewTitle}
                  </h3>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    {copy.import.previewCount}: {importPreviews.length}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {importPreviews.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-500">{copy.import.name}</p>
                          <p className="mt-1 font-medium text-slate-900">{item.name}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {item.sourceType === "link"
                            ? copy.import.typeLink
                            : copy.import.typeText}
                        </span>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs text-slate-500">{copy.import.sourceType}</p>
                        <p className="mt-1 text-slate-700">
                          {item.sourceType === "link"
                            ? copy.import.typeLink
                            : copy.import.typeText}
                        </p>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs text-slate-500">{copy.import.summary}</p>
                        <p className="mt-1 break-all text-slate-700">{item.summary}</p>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs text-slate-500">{copy.import.tags}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <span
                              key={`${item.id}-${tag}`}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-end border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                  >
                    {copy.import.confirmImport}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {canEditSources && formMode && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              {isEditing ? copy.form.editTitle : copy.form.createTitle}
            </h2>
            <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onSubmitForm}>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {copy.form.name}
                </span>
                <input
                  required
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {copy.form.url}
                </span>
                <input
                  required
                  value={formValues.url}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, url: event.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  {copy.form.tags}
                </span>
                <input
                  value={formValues.tagsInput}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      tagsInput: event.target.value,
                    }))
                  }
                  placeholder={copy.form.tagsPlaceholder}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {copy.form.status}
                </span>
                <select
                  value={formValues.status}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      status: event.target.value as SourceStatus,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
                >
                  <option value="online">{getSourceStatusLabel("online")}</option>
                  <option value="warning">{getSourceStatusLabel("warning")}</option>
                  <option value="paused">{getSourceStatusLabel("paused")}</option>
                </select>
              </label>
              <div className="flex items-end gap-3">
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                >
                  {copy.form.save}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {copy.form.cancel}
                </button>
              </div>
            </form>
          </section>
        )}

        {canEditSources && pendingDeleteSource && (
          <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-rose-700">
                {copy.deletePrompt}{" "}
                <span className="font-medium">
                  &quot;{pendingDeleteSource.name}&quot;
                </span>
                ?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white transition-colors hover:bg-rose-700"
                >
                  {copy.actions.confirmDelete}
                </button>
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="inline-flex h-8 items-center rounded-lg border border-rose-300 px-3 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
                >
                  {copy.actions.cancelDelete}
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    {copy.tableHeaders.name}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {copy.tableHeaders.url}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {copy.tableHeaders.tags}
                  </th>
                  {showInternalColumns && (
                    <th className="px-4 py-3 text-left font-semibold">
                      {copy.tableHeaders.status}
                    </th>
                  )}
                  {showInternalColumns && (
                    <th className="px-4 py-3 text-left font-semibold">
                      {copy.tableHeaders.updatedAt}
                    </th>
                  )}
                  {canEditSources && (
                    <th className="px-4 py-3 text-left font-semibold">
                      {copy.tableHeaders.actions}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sources.map((source) => (
                  <tr key={source.id} className="align-top">
                    <td className="px-4 py-4 font-medium text-slate-900">
                      {source.name}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <span className="inline-block max-w-[320px] truncate align-middle">
                        {maskSubscriptionUrl(source.url, role)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {source.tags.length > 0 ? (
                          source.tags.map((tag) => (
                            <span
                              key={`${source.id}-${tag}`}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    {showInternalColumns && (
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getSourceStatusClass(source.status)}`}
                        >
                          {getSourceStatusLabel(source.status)}
                        </span>
                      </td>
                    )}
                    {showInternalColumns && (
                      <td className="px-4 py-4 text-slate-600">{source.updatedAt}</td>
                    )}
                    {canEditSources && (
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(source)}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            {copy.actions.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(source.id)}
                            className="inline-flex h-8 items-center rounded-lg border border-rose-200 px-3 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                          >
                            {copy.actions.remove}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
