"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useAppData } from "../_state/app-data-context";
import { NAV_ITEMS } from "../_config/navigation";
import { isNavItemVisible } from "../_utils/access-control";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NovaRabbitLogoMark() {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className="h-11 w-11 text-slate-950"
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M240 374L389 187L512 350L640 187L789 374"
        stroke="currentColor"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M512 352L318 628L512 904L706 628L512 352Z"
        stroke="currentColor"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlobalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, refreshAppData } = useAppData();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const visibleNavItems = NAV_ITEMS.filter((item) => isNavItemVisible(role, item.href));
  const loginHref = `/login?next=${encodeURIComponent(pathname || "/")}`;

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      return (await response.json()) as {
        success: boolean;
        data: {
          authenticated: boolean;
          role: "admin" | "viewer";
        } | null;
      };
    } catch {
      return null;
    }
  }, []);

  const syncViewerSessionState = useCallback(async (): Promise<void> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const sessionPayload = await fetchSession();
      const roleAfterRefresh = await refreshAppData();

      if (
        sessionPayload?.success &&
        sessionPayload.data?.authenticated === false &&
        sessionPayload.data.role === "viewer" &&
        roleAfterRefresh === "viewer"
      ) {
        return;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 120);
      });
    }
  }, [fetchSession, refreshAppData]);

  const handleLogout = async () => {
    setLogoutLoading(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch {
      // Ignore network errors and continue with local refresh.
    } finally {
      try {
        await syncViewerSessionState();
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
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between md:gap-10 md:px-8 md:py-3.5">
            <div className="flex min-w-0 shrink-0 items-center gap-3">
              <div className="flex shrink-0 items-center gap-2 md:w-12 md:flex-col md:items-center md:gap-0">
                <NovaRabbitLogoMark />
                <span className="text-[10px] leading-none text-slate-500 md:mt-1">
                  NovaRabbit
                </span>
              </div>
              <div className="min-w-0 text-lg font-semibold tracking-tight text-slate-900">
                sub-platform
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-end md:gap-5">
              <nav className="grid min-w-0 grid-cols-2 gap-2 md:flex md:flex-nowrap md:items-center md:gap-2.5">
                {visibleNavItems.map((item) => {
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`min-w-0 rounded-lg px-3 py-2 text-center text-sm font-medium leading-tight whitespace-normal transition-colors sm:px-4 md:min-w-[108px] md:whitespace-nowrap ${
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

              <div className="hidden h-8 w-px bg-slate-200 md:block" aria-hidden />

              <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 ${
                      role === "viewer"
                        ? "bg-slate-900 text-white"
                        : "text-slate-500"
                    }`}
                  >
                    viewer
                  </span>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 ${
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-medium whitespace-nowrap text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:py-1"
                  >
                    {logoutLoading ? "退出中..." : "退出登录"}
                  </button>
                ) : (
                  <Link
                    href={loginHref}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-medium whitespace-nowrap text-white transition-colors hover:bg-slate-700 sm:w-auto sm:py-1"
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
