import type { UserRole } from "../_types/app-types";

export type NavItem = {
  href: string;
  label: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "\u9996\u9875" },
  { href: "/sources", label: "\u8ba2\u9605\u6e90\u7ba1\u7406" },
  { href: "/outputs", label: "\u8f93\u51fa\u7ba1\u7406" },
  { href: "/settings", label: "\u7cfb\u7edf\u8bbe\u7f6e" },
];

export const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "admin", label: "admin" },
  { value: "guest", label: "guest" },
];

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "admin",
  guest: "guest",
};
