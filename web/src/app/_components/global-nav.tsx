"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppData } from "../_state/app-data-context";
import { NAV_ITEMS } from "../_config/navigation";
import { isNavItemVisible } from "../_utils/access-control";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlobalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, refreshAppData } = useAppData();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const visibleNavItems = NAV_ITEMS.filter((item) => isNavItemVisible(role, item.href));
  const loginHref = `/login?next=${encodeURIComponent(pathname || "/")}`;

  const handleLogout = async () => {
    setLogoutLoading(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      // Ignore network errors and continue with local refresh.
    } finally {
      try {
        await refreshAppData();
      } catch {
        // Ignore refresh failures and continue navigation fallback.
      }
      setLogoutLoading(false);
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100">
      <div className="mx-auto w-full max-w-7xl px-5 py-4 md:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-10 px-6 py-3.5 md:px-8">
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex w-12 flex-col items-center">
                <div
                  className="h-9 w-9 rounded-lg border border-slate-300 bg-slate-50"
                  aria-hidden
                />
                <span className="mt-1 text-[10px] leading-none text-slate-500">
                  NovaRabbit
                </span>
              </div>
              <div className="whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900">
                sub-platform
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-5">
              <nav className="flex min-w-0 items-center gap-2.5">
                {visibleNavItems.map((item) => {
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`min-w-[108px] whitespace-nowrap rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
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

              <div className="flex shrink-0 items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <span
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      role === "viewer"
                        ? "bg-slate-900 text-white"
                        : "text-slate-500"
                    }`}
                  >
                    viewer
                  </span>
                  <span
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      role === "admin"
                        ? "bg-slate-900 text-white"
                        : "text-slate-500"
                    }`}
                  >
                    admin
                  </span>
                </div>
                {role === "admin" ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={logoutLoading}
                    className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {logoutLoading ? "退出中..." : "退出登录"}
                  </button>
                ) : (
                  <Link
                    href={loginHref}
                    className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-slate-700"
                  >
                    管理员登录
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
