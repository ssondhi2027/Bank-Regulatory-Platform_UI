import { useCallback, useEffect, useState } from "react";

const BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8787").replace(/\/+$/, "");

export async function get(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(",") : v);
  }

  const res = await fetch(url, { headers: { accept: "application/json" } });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`);
  return body;
}

/** Fetch on mount and whenever `deps` change, with a manual retry. */
export function useResource(path, params, deps) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  const key = JSON.stringify(params ?? {});

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, status: "loading" }));

    get(path, params)
      .then((data) => live && setState({ status: "ready", data, error: null }))
      .catch((error) => live && setState({ status: "error", data: null, error }));

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, attempt, ...(deps ?? [])]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
