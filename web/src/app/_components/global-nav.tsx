"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppData } from "../_state/app-data-context";
import type { UserRole } from "../_state/app-data-context";
import { isNavItemVisible } from "../_utils/access-control";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "\u9996\u9875" },
  { href: "/sources", label: "\u8ba2\u9605\u6e90\u7ba1\u7406" },
  { href: "/outputs", label: "\u8f93\u51fa\u7ba1\u7406" },
  { href: "/settings", label: "\u7cfb\u7edf\u8bbe\u7f6e" },
];

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "admin", label: "\u7ba1\u7406\u5458" },
  { value: "viewer", label: "\u8bbf\u5ba2" },
];

const roleLabel: Record<UserRole, string> = {
  admin: "\u7ba1\u7406\u5458",
  viewer: "\u8bbf\u5ba2",
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlobalNav() {
  const pathname = usePathname();
  const { role, setRole } = useAppData();
  const visibleNavItems = navItems.filter((item) => isNavItemVisible(role, item.href));

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100">
      <div className="mx-auto w-full max-w-7xl px-5 py-4 md:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-10 px-6 py-3 md:px-7">
            <div className="shrink-0 whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900">
              sub-platform
            </div>

            <div className="flex min-w-0 items-center justify-end gap-6">
              <nav className="flex min-w-0 items-center gap-3">
                {visibleNavItems.map((item) => {
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`min-w-[112px] whitespace-nowrap rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
                        active
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="h-8 w-px bg-slate-200" aria-hidden />

              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {roleOptions.map((option) => {
                  const active = role === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      aria-pressed={active}
                      title={`${roleLabel[option.value]}`}
                      className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
