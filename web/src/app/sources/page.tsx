"use client";

import { FormEvent, useMemo, useState } from "react";
import { useAppData } from "../_state/app-data-context";
import type { SourceStatus } from "../_types/app-types";
import {
  canManageSources,
  maskSubscriptionUrl,
  shouldShowSourceInternalColumns,
} from "../_utils/access-control";
import {
  getSourceStatusClass,
  getSourceStatusLabel,
} from "../_utils/source-status";

type SourceFormValues = {
  name: string;
  url: string;
  tagsInput: string;
  status: SourceStatus;
};

const copy = {
  title: "\u8ba2\u9605\u6e90\u7ba1\u7406",
  subtitle:
    "\u7528\u4e8e\u7ba1\u7406\u8ba2\u9605\u5730\u5740\u3001\u6807\u7b7e\u548c\u57fa\u7840\u914d\u7f6e",
  addButton: "\u65b0\u589e\u8ba2\u9605\u6e90",
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

function createEmptyForm(): SourceFormValues {
  return {
    name: "",
    url: "",
    tagsInput: "",
    status: "online",
  };
}

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

export default function SourcesPage() {
  const { role, sources, addSource, updateSource, deleteSource } = useAppData();
  const canEditSources = canManageSources(role);
  const showInternalColumns = shouldShowSourceInternalColumns(role);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<SourceFormValues>(createEmptyForm);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const pendingDeleteSource = useMemo(
    () => sources.find((item) => item.id === pendingDeleteId) ?? null,
    [pendingDeleteId, sources]
  );

  const isEditing = formMode === "edit";

  const openCreateForm = () => {
    if (!canEditSources) {
      return;
    }

    setFormMode("create");
    setEditingId(null);
    setFormValues(createEmptyForm());
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
    setFormValues(createEmptyForm());
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
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
              >
                {copy.addButton}
              </button>
            )}
          </div>
        </section>

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
