"use client";






import { useEffect, useRef, useState } from "react";
import api from "./api";

export type Role = "SUPER_ADMIN" | "REGIONAL_ADMIN" | "RESIDENT";

export const INCIDENT_STATUS = ["PENDING", "UNDER_REVIEW", "VERIFIED", "RESPONDING", "RESOLVED", "REJECTED"];

export const STATUS_TONE: Record<string, string> = {
  PENDING: "var(--warn)",
  UNDER_REVIEW: "var(--info)",
  VERIFIED: "var(--bad)",
  RESPONDING: "var(--accent)",
  RESOLVED: "var(--ok)",
  REJECTED: "var(--unknown)"
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  RESPONDING: "Responding",
  RESOLVED: "Resolved",
  REJECTED: "Rejected"
};

export const ROUTE_TONE: Record<string, string> = {
  SAFE: "var(--ok)",
  BLOCKED: "var(--bad)",
  UNVERIFIED: "var(--warn)"
};

export const ROUTE_LABEL: Record<string, string> = {
  SAFE: "Safe to use",
  BLOCKED: "Blocked — do not use",
  UNVERIFIED: "Not verified"
};

export const ALERT_TONE: Record<string, string> = {
  HIGH: "var(--bad)",
  MEDIUM: "var(--warn)",
  INFO: "var(--info)"
};

export const PROPERTY_LABEL: Record<string, string> = {
  HOME: "Residential home",
  FARM: "Farm",
  OTHER: "Other property"
};

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  REGIONAL_ADMIN: "Regional Admin",
  RESIDENT: "Resident"
};

export const ago = (iso?: string | null) => {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  if (s < 86400 * 7) return Math.floor(s / 86400) + " d ago";
  return new Date(iso).toISOString().slice(0, 10);
};


export type Caps = {
  role: Role;
  role_label: string;
  scope: {all: boolean;country: string | null;district: string | null;};
  can: Record<string, boolean>;
  places: {country: string;districts: string[];}[];
  country_bbox: Record<string, [number, number, number, number]>;
};

export function useCaps() {
  const [caps, setCaps] = useState<Caps | null>(null);
  useEffect(() => {
    let live = true;
    api.get<Caps>("/api/me/capabilities").then((c) => live && setCaps(c)).catch(() => {});
    return () => {live = false;};
  }, []);
  return caps;
}


let source: EventSource | null = null;
const listeners = new Set<(msg: any) => void>();

function ensureStream() {
  if (typeof window === "undefined" || source) return;
  const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
  try {
    source = new EventSource(base + "/api/stream");
    source.onmessage = (e) => {
      let msg: any = null;
      try {msg = JSON.parse(e.data);} catch (err) {return;}
      listeners.forEach((fn) => fn(msg));
    };
    source.onerror = () => {};
  } catch (err) {
    source = null;
  }
}






export function useLive(onEvent?: (msg: any) => void, topics?: string[]) {
  const [last, setLast] = useState<any>(null);
  const cb = useRef(onEvent);
  cb.current = onEvent;
  const keys = (topics || []).join(",");

  useEffect(() => {
    ensureStream();
    const fn = (msg: any) => {
      if (keys && msg.type && !keys.split(",").includes(msg.type)) return;
      setLast(msg);
      cb.current?.(msg);
    };
    listeners.add(fn);
    return () => {listeners.delete(fn);};
  }, [keys]);

  return last;
}

export const exportRows = (name: string, rows: Record<string, any>[], columns: [string, string][]) => {
  const head = columns.map(([, label]) => `"${label}"`).join(",");
  const body = rows.
  map((r) => columns.map(([k]) => {
    const v = r[k] ?? "";
    return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  }).join(",")).
  join("\n");
  const blob = new Blob([head + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  URL.revokeObjectURL(url);
};
