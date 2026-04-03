import type { ServiceCheckStatus } from "../_types/app-types";

type ServiceStatusView = {
  label: string;
  className: string;
};

export const SERVICE_STATUS_VIEW: Record<ServiceCheckStatus, ServiceStatusView> = {
  not_checked: {
    label: "\u672a\u68c0\u6d4b",
    className: "bg-slate-100 text-slate-700",
  },
  checking: {
    label: "\u68c0\u6d4b\u4e2d",
    className: "bg-amber-50 text-amber-700",
  },
  success: {
    label: "\u8fde\u63a5\u6210\u529f",
    className: "bg-emerald-50 text-emerald-700",
  },
  failed: {
    label: "\u8fde\u63a5\u5931\u8d25",
    className: "bg-rose-50 text-rose-700",
  },
};

export function getServiceStatusView(status: ServiceCheckStatus): ServiceStatusView {
  return SERVICE_STATUS_VIEW[status];
}
