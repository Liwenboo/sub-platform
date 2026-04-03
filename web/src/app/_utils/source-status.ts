import type { SourceStatus } from "../_types/app-types";

type SourceStatusMeta = {
  label: string;
  className: string;
};

export const SOURCE_STATUS_META: Record<SourceStatus, SourceStatusMeta> = {
  online: {
    label: "\u6b63\u5e38",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  warning: {
    label: "\u5f02\u5e38",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  paused: {
    label: "\u6682\u505c",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
};

export function getSourceStatusLabel(status: SourceStatus): string {
  return SOURCE_STATUS_META[status].label;
}

export function getSourceStatusClass(status: SourceStatus): string {
  return SOURCE_STATUS_META[status].className;
}
