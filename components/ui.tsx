"use client";






import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fmt, STATUS_COLOR, TAG_COLOR } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useApp, useMeta } from "@/components/providers";



const ICON_PATHS: Record<string, string> = {
  close: "M6 6l12 12M18 6L6 18",
  download: "M12 3v12M7 11l5 5 5-5M4 21h16",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  chevron: "M9 5l7 7-7 7",
  "chevron-down": "M6 9l6 6 6-6",
  table: "M3 4h18v16H3zM3 9h18M9 9v11",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5",
  lock: "M6 11h12v9H6zM9 11V7a3 3 0 0 1 6 0v4",
  check: "M5 13l4 4L19 7",
  menu: "M4 7h16M4 12h16M4 17h16",
  "log-out": "M15 4h4v16h-4M11 8l-4 4 4 4M7 12h9",
  logout: "M15 4h4v16h-4M11 8l-4 4 4 4M7 12h9",
  eye: "M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  "eye-off": "M4 4l16 16M9.9 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 6 10 6a17 17 0 0 1-3.1 3.7M6.5 7.6A16 16 0 0 0 2 11s3.6 6 10 6c1.2 0 2.3-.2 3.3-.5",
  user: "M12 4a3.6 3.6 0 1 0 0 7.2A3.6 3.6 0 0 0 12 4zM4.5 20a7.5 7.5 0 0 1 15 0",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13.6l1.6 1.2-1.7 3-1.9-.7a6.7 6.7 0 0 1-1.6 1l-.3 2h-3.4l-.3-2a6.7 6.7 0 0 1-1.6-1l-1.9.7-1.7-3 1.6-1.2a7 7 0 0 1 0-1.9L4.6 10l1.7-3 1.9.7a6.7 6.7 0 0 1 1.6-1l.3-2h3.4l.3 2a6.7 6.7 0 0 1 1.6 1l1.9-.7 1.7 3-1.6 1.2a7 7 0 0 1 0 1.9z",
  overview: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  map: "M9 4L3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4zM9 4v14M15 6.5v14",
  events: "M12 3c2.4 4.6 5.6 5.8 5.6 10a5.6 5.6 0 1 1-11.2 0c0-2.2 1.1-3.9 2.3-5 .5 1.9 1.4 2.5 2.3 2.8-.8-2.8-.4-5.8 1-7.8z",
  history: "M12 7v5l3.5 2M3.5 12a8.5 8.5 0 1 0 3-6.5M3 4v4h4",
  forecast: "M4 17l5-6 4 3 6-8M15 6h4v4",
  explorer: "M4 5h16M4 10h10M4 15h16M4 20h10",
  quality: "M12 3.5l7.5 3v5c0 4.3-3.1 7.6-7.5 9-4.4-1.4-7.5-4.7-7.5-9v-5l7.5-3zM9 12l2.2 2.2L15.5 10",
  harmonization: "M12 4v16M6 8h4M6 16h4M14 8h4M14 16h4M4 6h2v4H4zM18 14h2v4h-2z",
  sources: "M12 3c-4.4 0-8 1.3-8 3s3.6 3 8 3 8-1.3 8-3-3.6-3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  lab: "M9 3v6l-5 9a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3l-5-9V3M9 3h6M8 14h8",
  monitor: "M3 12h4l2.5-6 4 12 2.5-6h5",
  validation: "M12 3l7.5 3v5c0 4.3-3.1 7.6-7.5 9-4.4-1.4-7.5-4.7-7.5-9V6l7.5-3zM8.5 12l2.5 2.5 4.5-4.5",
  registry: "M4 7h16M4 12h16M4 17h16M7 4v6M17 11v6",
  pipeline: "M4 6h5v4H4zM15 14h5v4h-5zM9 8h3a2 2 0 0 1 2 2v6h1M6.5 10v4a2 2 0 0 0 2 2H13",
  logs: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h6M9 16h6",
  reports: "M6 3h8l4 4v14H6zM14 3v5h4M9 13h6M9 17h4",
  sun: "M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z",
  dashboard: "M4 4h7v5H4zM13 4h7v9h-7zM4 12h7v8H4zM13 16h7v4h-7z",
  report: "M12 3c2.2 4.4 5.4 5.6 5.4 9.8a5.4 5.4 0 1 1-10.8 0c0-2 1-3.6 2.2-4.7.5 1.8 1.3 2.4 2.2 2.7-.8-2.7-.3-5.5 1-7.8zM12 21h.01",
  incident: "M12 3l9.5 17H2.5L12 3zM12 10v4M12 17v.5",
  hospital: "M4 21V8l8-5 8 5v13zM10 13h4M12 11v4M8 21v-4h8v4",
  route: "M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 16h6a3 3 0 0 0 3-3V8",
  bell: "M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10.5 20a2 2 0 0 0 3 0",
  home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  plus: "M12 5v14M5 12h14",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.5 5.6 3.5 9s-1 6.4-3.5 9c-2.5-2.6-3.5-5.6-3.5-9S9.5 5.6 12 3z"
};

export function Icon({ name, size = 15 }: any) {
  const d = ICON_PATHS[name] || ICON_PATHS.info;
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>);

}

export function PageHead({ title, subtitle, right }: any): any {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <div className="subtitle">{subtitle}</div> : null}
      </div>
      {right ? <div className="right">{right}</div> : null}
    </div>);

}

export function Stamp({ items }: any): any {
  return <div className="stamp">{items.filter(Boolean).map((t, i) => <span key={i}>{t}</span>)}</div>;
}

export function Card({ title, subtitle, right, children, pad = true, className = "", style }: any): any {
  return (
    <section className={"card " + className} style={style}>
      {(title || right) &&
      <div className="card-h">
          <div style={{ minWidth: 0 }}>
            {title ? <h2 title={typeof title === "string" ? title : undefined}>{title}</h2> : null}
            {subtitle ? <div className="sub" title={typeof subtitle === "string" ? subtitle : undefined}>{subtitle}</div> : null}
          </div>
          {right ? <div className="right">{right}</div> : null}
        </div>
      }
      <div className={"card-b" + (pad ? "" : " tight")}>{children}</div>
    </section>);

}

export function Tag({ code }: any): any {
  const { tagExplain } = useMeta();
  return <span className="tag" style={{ "--c": TAG_COLOR[code] || "var(--unknown)" }} title={`[${code}] ${tagExplain[code] || ""}`}>{code}</span>;
}

export function Chip({ code, label, color, className = "", dot = true }: any): any {
  const c = color || STATUS_COLOR[code] || "var(--unknown)";
  if (code == null && label == null) return <span className="faint">–</span>;
  return (
    <span className={"chip " + className} style={{ "--c": c }}>
      {dot ? <i className="dot" /> : null}
      {label || fmt.label(code)}
    </span>);

}

export function Kpi({ label, tag, value, unit, note, onClick }: any): any {
  return (
    <div className={"card kpi" + (onClick ? " clickable" : "")} onClick={onClick} title={note || undefined}>
      <div className="top">
        <div className="label" style={{ whiteSpace: "normal" }}>{label}</div>
        {tag ? <Tag code={tag} /> : null}
      </div>
      <div className="v">{value}{unit ? <span className="unit">{unit}</span> : null}</div>
      {note ? <div className="n">{note}</div> : null}
    </div>);

}

export function Loading({ text = "Loading…" }: any): any {
  return <div className="loading pulse">{text}</div>;
}
export function ErrorBox({ error, onRetry }: any): any {
  return (
    <div className="note bad" role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span>{error}</span>
      {onRetry ? <button className="btn btn-sm" onClick={onRetry}>Try again</button> : null}
    </div>);

}
export function Empty({ title, text }: any): any {
  return (
    <div className="empty">
      <div className="t">{title}</div>
      {text ? <div className="d">{text}</div> : null}
    </div>);

}
export function Note({ children, kind = "" }: any): any {
  return <div className={"note " + kind}>{children}</div>;
}
export function Meter({ value, max = 100, color }: any): any {
  const pct = Math.max(0, Math.min(100, value / (max || 1) * 100));
  return <div className="meter" style={{ "--c": color }}><i style={{ width: pct + "%" }} /></div>;
}
export function KV({ rows, tight }: any): any {
  return (
    <dl className={"kv" + (tight ? " tight" : "")}>
      {rows.map(([k, v], i) =>
      <React.Fragment key={i}>
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === "" ? "–" : v}</dd>
        </React.Fragment>
      )}
    </dl>);

}
export function Field({ label, hint, children, style }: any): any {
  return (
    <label className="field" style={style}>
      <span className="label-10">{label}</span>
      {children}
      {hint ? <span className="hint-sm">{hint}</span> : null}
    </label>);

}
export function Collapsible({ title, children, open: openProp = false }: any): any {
  const [open, setOpen] = useState(openProp);
  return (
    <div className={"collapsible" + (open ? " open" : "")}>
      <div className="ch" role="button" tabIndex={0} aria-expanded={open}
      onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}>
        <span className="chev"><Icon name="chevron" size={13} /></span>
        <span>{title}</span>
      </div>
      {open ? <div className="cb">{children}</div> : null}
    </div>);

}
export function Tabs({ items, value, onChange }: any): any {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) =>
      <button key={t.id} role="tab" className="tab" aria-selected={value === t.id} tabIndex={0}
      onClick={() => onChange(t.id)} onKeyDown={(e) => e.key === "Enter" && onChange(t.id)}>
          {t.label}{t.count != null ? <span className="count">{t.count}</span> : null}
        </button>
      )}
    </div>);

}
export function Drawer({ title, width = 560, onClose, children }: any): any {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" style={{ width: `min(${width}px, 100vw)` }}>
        <div className="drawer-h">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" aria-label="Close" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div className="drawer-b">{children}</div>
      </div>
    </>);

}


export function DataTable({ table, params = {}, columns, onRow, exports: showExports = true, pageSize = 50, maxHeight = "62vh", startSort, emptyTitle, emptyText, useSelection = false }: any): any {
  const { selectionQuery } = useApp();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(startSort || null);
  const [dir, setDir] = useState("desc");
  const q = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));p.set("size", String(pageSize));
    if (sort) {p.set("sort", sort);p.set("dir", dir);}
    Object.entries(params).forEach(([k, v]) => {if (v !== "" && v != null) p.set(k, String(v));});
    return `/api/tables/${table}?${p.toString()}` + (useSelection ? selectionQuery ? "&" + selectionQuery.slice(1) : "" : "");
  }, [table, page, pageSize, sort, dir, JSON.stringify(params), useSelection, selectionQuery]);

  const { data, error, loading, reload } = useApi(q);
  useEffect(() => {setPage(1);}, [JSON.stringify(params)]);

  const head = (c) => {
    const active = sort === c.key;
    const onClick = () => {
      if (!c.sortable) return;
      if (active) setDir(dir === "desc" ? "asc" : "desc");else
      {setSort(c.key);setDir("desc");}
    };
    return (
      <th key={c.key} className={(c.sortable ? "sortable " : "") + (c.align === "right" ? "r" : "")}
      style={{ minWidth: c.minWidth, whiteSpace: c.wrap ? "normal" : undefined }} onClick={onClick}
      title={c.tip || undefined}>
        {c.label}
        {active ? <span style={{ color: "var(--accent)" }}> {dir === "desc" ? "↓" : "↑"}</span> : null}
      </th>);

  };

  const rows = data ? data.rows || [] : [];
  const total = data ? data.total || 0 : 0;
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div>
      <div className="scroll-x scroll-y" style={{ maxHeight }}>
        <table className="grid-table wrap-first">
          <thead><tr>{columns.map(head)}</tr></thead>
          <tbody>
            {loading && !data ? <tr><td colSpan={columns.length}><Loading /></td></tr> : null}
            {rows.map((r, i) =>
            <tr key={i} className={onRow ? "clickable" : ""} onClick={onRow ? () => onRow(r) : undefined}>
                {columns.map((c) =>
              <td key={c.key} className={(c.align === "right" ? "r " : "") + (c.wrap ? "wrap" : "")}>
                    {c.render ? c.render(r) : r[c.key] ?? "–"}
                  </td>
              )}
              </tr>
            )}
            {!loading && data && rows.length === 0 ?
            <tr><td colSpan={columns.length}><Empty title={emptyTitle || "No rows match the current selection"} text={emptyText || "Change the date range, area or satellites in the bar at the top."} /></td></tr> :
            null}
          </tbody>
        </table>
      </div>
      <div className="tbl-foot">
        <span>
          {data ? `${fmt.n(total)} ${total === 1 ? "row" : "rows"} · showing ${first}–${last}` : "…"}
          {loading && data ? <span className="pulse"> · updating</span> : null}
        </span>
        <span className="right">
          {showExports ? ["CSV", "GEOJSON", "PARQUET"].map((f) =>
          <button key={f} className="btn btn-ghost btn-sm" title={`Download the current selection as ${f} (up to 200,000 rows)`}
          onClick={() => router.push("/reports")}><Icon name="download" size={12} />{f}</button>
          ) : null}
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </span>
      </div>
    </div>);

}



export const SatDot = ({ id }) => {
  const { satellites } = useMeta();
  const s = satellites.find((x) => x.label === id);
  return <i style={{ width: 7, height: 7, borderRadius: "50%", background: s ? s.hex : "var(--unknown)", display: "inline-block", marginRight: 5 }} />;
};
export const SignPct = ({ v, d = 1 }) =>
<span style={{ color: v == null ? undefined : v > 0 ? "var(--ok)" : v < 0 ? "var(--bad)" : "var(--muted)" }} className="num">{fmt.signed(v, d, " %")}</span>;
