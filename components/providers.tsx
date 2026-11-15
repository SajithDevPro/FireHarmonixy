"use client";









import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export type Filters = {
  from: string;
  to: string;
  bbox: number[] | null;
  region: string;
  sats: string[];
  [key: string]: any;
};

export type Toast = {id: number;text: string;kind: "ok" | "bad" | "info";};

type AppState = {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  selectionQuery: string;
  meta: any;
  health: any;
  generation: number;
  token: string;
  setToken: (t: string) => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
  go: (path: string) => void;
};

const DEFAULT_FILTERS: Filters = { from: "", to: "", bbox: null, region: "global", sats: [] };
const AppCtx = createContext<AppState | null>(null);

export const useApp = (): AppState => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
};

export function AppProvider({ children }: {children: React.ReactNode;}) {
  const router = useRouter();
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [meta, setMeta] = useState<any>(null);
  const [health, setHealth] = useState<any>({ state: "loading" });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [token, setTokenState] = useState("");
  const toastId = useRef(0);


  useEffect(() => {
    const savedTheme = localStorage.getItem("fireharmonix.theme");
    if (savedTheme === "dark" || savedTheme === "light") setThemeState(savedTheme);
    try {
      const saved = JSON.parse(localStorage.getItem("fireharmonix.filters.v1") || "{}");
      setFiltersState({ ...DEFAULT_FILTERS, ...saved });
    } catch (e) {}
    setTokenState(sessionStorage.getItem("fireharmonix.token") || "");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fireharmonix.theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("fireharmonix.filters.v1", JSON.stringify(filters));
  }, [filters]);


  useEffect(() => {
    let live = true;
    api.get("/api/meta").then((m) => {if (live) setMeta(m);}).catch(() => {});
    return () => {live = false;};
  }, []);



  useEffect(() => {
    let live = true;
    const tick = () =>
    api.get("/api/health").
    then((h) => {if (live) setHealth({ state: "ok", ...h });}).
    catch(() => {if (live) setHealth({ state: "unreachable" });});
    tick();
    const id = setInterval(tick, 4000);
    return () => {live = false;clearInterval(id);};
  }, []);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "bad" ? 9000 : 4500);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const setTheme = useCallback((t: "light" | "dark") => setThemeState(t), []);
  const setFilters = useCallback((patch: Partial<Filters>) => setFiltersState((f) => ({ ...f, ...patch })), []);
  const clearFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), []);
  const setToken = useCallback((t: string) => {
    setTokenState(t);
    if (t) sessionStorage.setItem("fireharmonix.token", t);else
    sessionStorage.removeItem("fireharmonix.token");
  }, []);
  const go = useCallback((path: string) => router.push(path.startsWith("/") ? path : "/" + path), [router]);

  const selectionQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (filters.bbox) p.set("bbox", filters.bbox.join(","));
    if (filters.sats && filters.sats.length) p.set("sats", filters.sats.join(","));
    const s = p.toString();
    return s ? "?" + s : "";
  }, [filters]);

  const value: AppState = {
    theme, setTheme, filters, setFilters, clearFilters, selectionQuery,
    meta, health, generation: health?.generation ?? 0, token, setToken,
    toasts, toast, dismissToast, go
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}



export type Meta = {
  version: string;commit: string;title: string;
  window: {from: string;to: string;};
  regions: {id: string;label: string;bbox: number[] | null;}[];
  satellites: {id: string;label: string;sensor: string;color: string;hex: string;}[];
  countries: string[];
  places: {country: string;districts: string[];}[];
  upload: {accept: string[];max_mb: number;};
  tagExplain: Record<string, string>;
  vocab: {
    event_statuses: string[];bands: string[];
    flags: {code: string;label: string;}[];
    evidence_kinds: {code: string;label: string;tier: number;desc: string;}[];
  };
  needs_setup: boolean;
};

const EMPTY_META: Meta = {
  version: "", commit: "", title: "FireHarmonix",
  window: { from: "", to: "" }, regions: [], satellites: [], countries: [], places: [],
  upload: { accept: [], max_mb: 0 }, tagExplain: {},
  vocab: { event_statuses: [], bands: [], flags: [], evidence_kinds: [] }, needs_setup: false
};

export function useMeta(): Meta {
  const { meta } = useApp();
  return useMemo(() => ({ ...EMPTY_META, ...(meta || {}), vocab: { ...EMPTY_META.vocab, ...(meta && meta.vocab || {}) } }), [meta]);
}

export const regionsOf = (meta: any) => meta && meta.regions || [];
