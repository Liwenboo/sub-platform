"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAppData } from "../_state/app-data-context";

type LoginResponse = {
  success: boolean;
  data: {
    role: "admin";
  } | null;
  error: {
    code: string;
    message: string;
    recoverable?: boolean;
  } | null;
};

type SessionResponse = {
  success: boolean;
  data: {
    authenticated: boolean;
    role: "admin" | "viewer";
    authConfigReady: boolean;
    authConfigIssues: string[];
  } | null;
};

const ADMIN_HOME_PATH = "/sources";
const LOGIN_SYNC_RETRY_COUNT = 3;
const LOGIN_SYNC_RETRY_DELAY_MS = 120;

function normalizeNextPath(input: string | null): string {
  if (!input || !input.startsWith("/") || input.startsWith("//")) {
    return ADMIN_HOME_PATH;
  }

  return input;
}

function getLoginErrorMessage(
  payload: LoginResponse | null,
  responseOk: boolean
): string {
  if (payload?.error?.code === "invalid_credentials") {
    return "用户名或密码错误。";
  }

  if (payload?.error?.code === "too_many_attempts") {
    return "登录尝试次数过多，请稍后再试。";
  }

  if (payload?.error?.code === "auth_config_invalid") {
    return "服务端鉴权配置不完整，请联系管理员处理。";
  }

  if (!responseOk) {
    return "登录失败，请稍后重试。";
  }

  return payload?.error?.message ?? "登录失败，请稍后重试。";
}

export default function LoginPage() {
  const router = useRouter();
  const { refreshAppData } = useAppData();
  const [nextPath, setNextPath] = useState(ADMIN_HOME_PATH);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [configWarning, setConfigWarning] = useState<string | null>(null);

  const fetchSession = useCallback(async (): Promise<SessionResponse | null> => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      return (await response.json()) as SessionResponse;
    } catch {
      return null;
    }
  }, []);

  const syncAdminSessionState = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < LOGIN_SYNC_RETRY_COUNT; attempt += 1) {
      const sessionPayload = await fetchSession();
      const roleAfterRefresh = await refreshAppData();

      if (
        sessionPayload?.success &&
        sessionPayload.data?.authenticated &&
        sessionPayload.data.role === "admin" &&
        roleAfterRefresh === "admin"
      ) {
        return true;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, LOGIN_SYNC_RETRY_DELAY_MS);
      });
    }

    return false;
  }, [fetchSession, refreshAppData]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setNextPath(normalizeNextPath(searchParams.get("next")));
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const payload = await fetchSession();

        if (!active) {
          return;
        }

        if (!payload) {
          return;
        }

        if (
          payload.success &&
          payload.data &&
          !payload.data.authConfigReady &&
          payload.data.authConfigIssues.length > 0
        ) {
          setConfigWarning(
            `服务端鉴权配置不完整：${payload.data.authConfigIssues.join(", ")}`
          );
        }

        if (payload.success && payload.data?.role === "admin") {
          const synced = await syncAdminSessionState();
          if (!synced) {
            return;
          }

          router.replace(nextPath);
          router.refresh();
        }
      } catch {
        // Keep login form usable even when session bootstrap fails.
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [fetchSession, nextPath, router, syncAdminSessionState]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const payload = (await response.json()) as LoginResponse;

      if (!response.ok || !payload.success) {
        setErrorMessage(getLoginErrorMessage(payload, response.ok));
        return;
      }

      const synced = await syncAdminSessionState();
      if (!synced) {
        setErrorMessage("登录状态同步失败，请重试。");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setErrorMessage("网络异常，无法完成登录。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto flex w-full max-w-md flex-col px-6 py-14">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">管理员登录</h1>
          <p className="mt-2 text-sm text-slate-600">
            登录后可访问管理功能与写操作接口。
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">用户名</span>
              <input
                type="text"
                value={username}
                disabled={submitting}
                onChange={(event) => setUsername(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
                autoComplete="username"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">密码</span>
              <input
                type="password"
                value={password}
                disabled={submitting}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none ring-slate-200 transition focus:ring-2"
                autoComplete="current-password"
                required
              />
            </label>

            {errorMessage && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {errorMessage}
              </p>
            )}
            {configWarning && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {configWarning}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "登录中..." : "登录"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>匿名 viewer 访问是否允许由服务端策略控制。</span>
            <Link href="/" className="font-medium text-slate-700 hover:text-slate-900">
              返回首页
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
