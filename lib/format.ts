





export const fmt = (() => {
  const nf = (d) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const DASH = "–";
  return {
    DASH,
    n: (v) => isNum(v) ? new Intl.NumberFormat("en-US").format(Math.round(v)) : DASH,
    f: (v, d = 1) => isNum(v) ? nf(d).format(v) : DASH,
    pct: (v, d = 1) => isNum(v) ? `${nf(d).format(v)} %` : DASH,
    signed: (v, d = 1, suffix = "") => {
      if (!isNum(v)) return DASH;
      const s = v > 0 ? "+" : v < 0 ? "−" : "";
      return `${s}${nf(d).format(Math.abs(v))}${suffix}`;
    },
    bytes: (v) => {
      if (!isNum(v)) return DASH;
      const u = ["B", "KB", "MB", "GB", "TB"];
      let i = 0,x = v;
      while (x >= 1024 && i < u.length - 1) {x /= 1024;i++;}
      return `${nf(x < 10 ? 1 : 0).format(x)} ${u[i]}`;
    },
    dur: (s) => {
      if (!isNum(s)) return DASH;
      if (s < 1) return `${nf(2).format(s)} s`;
      if (s < 60) return `${nf(1).format(s)} s`;
      if (s < 3600) {
        const m = Math.floor(s / 60),r = Math.round(s % 60);
        return `${m} min ${String(r).padStart(2, "0")} s`;
      }
      const h = Math.floor(s / 3600),m = Math.round(s % 3600 / 60);
      return `${h} h ${m} min`;
    },
    t: (v) => {
      if (!v) return DASH;
      const d = new Date(v);
      if (isNaN(+d)) return String(v);
      const p = (x) => String(x).padStart(2, "0");
      return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
    },
    ts: (v) => {
      const d = new Date(v);
      if (isNaN(+d)) return DASH;
      const p = (x) => String(x).padStart(2, "0");
      return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
    },
    day: (v) => v ? String(v).slice(0, 10) : DASH,
    ago: (v) => {
      const d = new Date(v);
      if (isNaN(+d)) return DASH;
      const s = (Date.now() - d.getTime()) / 1000;
      if (s < 60) return "just now";
      if (s < 3600) return `${Math.floor(s / 60)} min ago`;
      if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
      return `${Math.floor(s / 86400)} d ago`;
    },
    coord: (lat, lon) => {
      if (!isNum(lat) || !isNum(lon)) return DASH;
      return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;
    },
    compact: (v) => {
      if (!isNum(v)) return DASH;
      const a = Math.abs(v);
      if (a >= 1e9) return `${nf(a >= 1e10 ? 0 : 1).format(v / 1e9)}B`.replace(".0B", "B");
      if (a >= 1e6) return `${nf(a >= 1e7 ? 0 : 1).format(v / 1e6)}M`.replace(".0M", "M");
      if (a >= 1e4) return `${nf(a % 1000 === 0 ? 0 : 1).format(v / 1e3)}k`;
      if (a >= 1e3) return `${nf(a % 1000 === 0 ? 0 : 1).format(v / 1e3)}k`.replace(".0k", "k");
      return nf(a < 10 && a % 1 !== 0 ? 1 : 0).format(v);
    },
    label: (code) => {
      if (!code) return DASH;
      const s = String(code).toLowerCase().replace(/_/g, " ");
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
  };
})();


export type Fmt = typeof fmt;


export const STATUS_COLOR = {
  CONFIRMED: "var(--ok)", SUPPORTED: "var(--teal)", CONFLICTING: "var(--bad)",
  UNVERIFIED: "var(--warn)", INSUFFICIENT_EVIDENCE: "var(--unknown)",
  COMPLETED: "var(--ok)", DONE: "var(--ok)", FAILED: "var(--bad)", RUNNING: "var(--accent)",
  QUEUED: "var(--info)", CANCELLED: "var(--unknown)", PENDING: "var(--unknown)", SKIPPED: "var(--unknown)",
  OBSERVED_WITH_DETECTION: "var(--accent)", OBSERVED_WITHOUT_DETECTION: "var(--teal)",
  CLOUD_OBSCURED: "var(--info)", NO_COVERAGE: "var(--violet)", UNKNOWN: "var(--unknown)", INVALID: "var(--bad)",
  CORROBORATED: "var(--ok)", REPEATED: "var(--teal)", SINGLE_LOOK: "var(--info)", CAUTION: "var(--warn)",
  reachable: "var(--ok)", local: "var(--ok)", unreachable: "var(--bad)",
  "needs credentials": "var(--warn)", "not checked": "var(--unknown)",
  ingested: "var(--ok)", pending: "var(--info)", failed: "var(--bad)", rejected: "var(--bad)",
  modified: "var(--bad)", missing: "var(--warn)",
  candidate: "var(--info)", production: "var(--ok)", archived: "var(--unknown)",
  ERROR: "var(--bad)", WARNING: "var(--warn)", INFO: "var(--info)", DEBUG: "var(--unknown)",
  COMPARABLE: "var(--ok)", "COMPARABLE AFTER AGGREGATION": "var(--info)", "NOT COMPARABLE": "var(--warn)"
};

export const TAG_COLOR = { OBS: "var(--info)", VD: "var(--ok)", REC: "var(--violet)", NV: "var(--warn)" };


export const MONTHS: string[] = Array.from({ length: 12 }, (_, i) =>
new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2000, i, 1)))
);


export const yearRange = (first: number, last = new Date().getUTCFullYear()): number[] => {
  const out: number[] = [];
  if (!Number.isFinite(first) || first <= 0) return out;
  for (let y = last; y >= first; y--) out.push(y);
  return out;
};
