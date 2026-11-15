"use client";






import React, { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/format";
import { useApp } from "@/components/providers";



const RAMPS = {
  HEAT: ["#3a1c0a", "#8a3a12", "#d9641c", "#f5a04a", "#ffe08a"],
  DIVERGE: ["#2f6fb5", "#6ea3d6", "#55606b", "#e08a5c", "#d43d2f"],
  PROB: ["#1c242d", "#3d4a5c", "#8a5a2a", "#e08a3c", "#ffe08a"],
  HEAT_LIGHT: ["#fdf6ee", "#f8dfc4", "#eda86a", "#d2691e", "#8a3a12"],
  DIVERGE_LIGHT: ["#2f6fb5", "#a9c6e4", "#eef0f2", "#f0b49c", "#c0392b"],
  PROB_LIGHT: ["#f4f6f8", "#cfe0ef", "#8fb7d8", "#e0a15c", "#c2600f"]
};

const hex2rgb = (h) => {const n = parseInt(h.slice(1), 16);return [n >> 16 & 255, n >> 8 & 255, n & 255];};
export function rampColor(ramp: any, t: any, light: any) {
  const key = light && RAMPS[ramp + "_LIGHT"] ? ramp + "_LIGHT" : ramp;
  const stops = RAMPS[key] || RAMPS.HEAT;
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex2rgb(stops[i]),b = hex2rgb(stops[i + 1]);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}





const cssVarCache = new Map();
function cssVar(name) {
  const themeKey = document.documentElement.getAttribute("data-theme") || "light";
  const key = name + "@" + themeKey;
  if (cssVarCache.has(key)) return cssVarCache.get(key);
  let v = "";
  try {v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();} catch (e) {}
  if (!v) v = "var-dummy";
  cssVarCache.set(key, v);
  return v;
}
export const rc = (c: any) => {
  if (!c) return c;
  const m = /^var\((--[\w-]+)\)$/.exec(String(c).trim());
  return m ? cssVar(m[1]) : c;
};

const useLight = () => {
  const { theme } = useApp();
  return theme !== "dark";
};

function niceScale(max, count = 4) {
  if (!isFinite(max) || max <= 0) return { top: 1, ticks: [0, 0.5, 1] };
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(+v.toFixed(10));
  return { top, ticks };
}

function useWidth(initial = 640) {
  const [w, setW] = useState(initial);
  const box = useRef<any>(null);
  useEffect(() => {
    if (!box.current) return;
    const set = (n) => {if (n > 0) setW(Math.round(n));};
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(([e]) => set(e.contentRect.width));
      ro.observe(box.current);
      return () => ro.disconnect();
    }
    set(box.current.getBoundingClientRect().width);
  }, []);
  return [w, box] as const;
}

function useTip() {
  const [tip, setTip] = useState(null);
  return { tip, setTip };
}
const tipHtml = (title, rows) =>
`<div style="font-weight:650;margin-bottom:4px">${title}</div>` +
rows.map((r) => `<div style="display:flex;align-items:center;gap:6px;justify-content:space-between">
      <span style="display:inline-flex;align-items:center;gap:5px;color:var(--muted)">
        ${r.color ? `<i style="width:7px;height:7px;border-radius:2px;background:${r.color};display:inline-block"></i>` : ""}${r.name}
      </span>
      <b style="margin-left:14px">${r.value}</b></div>`).join("");

function ChartTip({ tip }) {
  if (!tip) return null;
  const flipX = tip.x > (window.innerWidth || 1200) - 260;
  return (
    <div className="chart-tip" style={{ left: flipX ? tip.x - 234 : tip.x + 16, top: Math.max(8, tip.y - 12) }}
    dangerouslySetInnerHTML={{ __html: tip.html }} />);

}


function barPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  if (h <= 0) return "";
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

let gradSeq = 0;
const useGradId = () => {
  const ref = useRef<any>(null);
  if (!ref.current) ref.current = "g" + ++gradSeq;
  return ref.current;
};




export function Bars({ height = 200, cats = [], series = [], stacked = false, maxBarW = 34, legend = false,
  axisName, yFmt = fmt.n, catsFmt, rotateLabels = false, meanLine = null, meanLabel = "mean", minZero = true }: any): any {
  const { tip, setTip } = useTip();
  const [w, box] = useWidth();
  const gid = useGradId();
  const padL = 52,padR = 16,padT = 18,padB = rotateLabels ? 40 : 30;
  const iw = Math.max(60, w - padL - padR),ih = Math.max(40, height - padT - padB);
  const label = catsFmt || ((c) => c);

  const totals = cats.map((_, i) => stacked ? series.reduce((a, s) => a + (s.data[i] || 0), 0) : Math.max(0, ...series.map((s) => s.data[i] || 0)));
  const flat = series.flatMap((s) => s.data.map((v) => v || 0));
  const meanOk = meanLine != null && isFinite(meanLine);
  const rawMax = Math.max(1, ...(stacked ? totals : flat), meanOk ? meanLine : 0);
  const { top, ticks } = niceScale(rawMax, 4);
  const y = (v) => padT + ih - v / top * ih;
  const band = iw / Math.max(1, cats.length);
  const bw = Math.max(3, Math.min(maxBarW, band * (stacked ? 0.62 : series.length > 1 ? 0.74 : 0.58)));
  const step = Math.max(1, Math.ceil(cats.length / Math.max(4, Math.floor(iw / 54))));
  const tickFmt = yFmt === fmt.n && top >= 10000 ? fmt.compact : yFmt;

  return (
    <div ref={box} style={{ position: "relative" }}>
      <svg className="chart" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setTip(null)}>
        <defs>
          {series.map((s, k) =>
          <linearGradient key={k} id={`${gid}-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={rc(s.color)} stopOpacity="0.95" />
              <stop offset="100%" stopColor={rc(s.color)} stopOpacity="0.55" />
            </linearGradient>
          )}
        </defs>

        {ticks.map((v, i) =>
        <g key={i}>
            <line className="grid-line" x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} strokeDasharray={i === 0 ? "0" : "2 4"} />
            <text x={padL - 10} y={y(v) + 3.5} textAnchor="end">{tickFmt(v)}</text>
          </g>
        )}

        {cats.map((c, i) => {
          const cx = padL + band * i + band / 2;
          let acc = 0;
          const segs = series.map((s) => s.data[i] || 0);
          const lastNonZero = segs.reduce((acc2, v, k) => v ? k : acc2, -1);
          return (
            <g key={i}>
              <rect className="hover-band" x={padL + band * i} y={padT} width={band} height={ih} rx={6} style={{ opacity: 0 }} />
              {series.map((s, k) => {
                const v = s.data[i] || 0;
                if (!v) return null;
                if (stacked) {
                  const y0 = y(acc + v),h = Math.max(0.5, y(acc) - y(acc + v));
                  acc += v;
                  const isTop = k === lastNonZero;
                  return isTop ?
                  <path key={k} d={barPath(cx - bw / 2, y0, bw, h, 4)} fill={`url(#${gid}-${k})`} /> :
                  <rect key={k} x={cx - bw / 2} y={y0} width={bw} height={h} fill={`url(#${gid}-${k})`} />;
                }
                const grp = series.length;
                const bwid = Math.max(3, bw / grp * 0.86);
                const x = cx - bw / 2 + bw / grp * k + (bw / grp - bwid) / 2;
                return <path key={k} d={barPath(x, y(v), bwid, Math.max(0.5, padT + ih - y(v)), 4)} fill={`url(#${gid}-${k})`} />;
              })}
              {i % step === 0 || cats.length <= 12 ?
              <text x={cx} y={height - padB + 16} textAnchor="middle" fontSize="10.5">{label(c)}</text> :
              null}
              <rect className="visit-hover" x={padL + band * i} y={padT} width={band} height={ih}
              onMouseMove={(e) => setTip({
                x: e.clientX, y: e.clientY,
                html: tipHtml(label(c), series.map((s) => ({ name: s.name, value: yFmt(s.data[i] || 0), color: s.color })))
              })} />
            </g>);

        })}

        {meanOk ?
        <g>
            <line x1={padL} x2={w - padR} y1={y(meanLine)} y2={y(meanLine)} stroke={rc("var(--muted)")} strokeDasharray="5 4" strokeWidth="1.2" opacity="0.75" />
            <text x={w - padR} y={y(meanLine) - 6} textAnchor="end" fontSize="9.5" fill={rc("var(--muted)")}>{meanLabel}</text>
          </g> :
        null}

        <line className="axis-line" x1={padL} x2={w - padR} y1={padT + ih} y2={padT + ih} />
        {axisName ? <text x={padL + iw / 2} y={height - 3} textAnchor="middle" fontSize="10">{axisName}</text> : null}
      </svg>
      <ChartTip tip={tip} />
      {legend ?
      <div className="legend">
          {series.map((s) => <span key={s.name}><i className="sw" style={{ background: s.color }} />{s.name}</span>)}
        </div> :
      null}
    </div>);

}




export function HBars({ height = 180, items = [], maxBarW = 16, valueFmt = fmt.n, labelW = 110, axisName }: any): any {
  const { tip, setTip } = useTip();
  const [w, box] = useWidth();
  const padL = labelW,padR = 74,padT = 8,padB = axisName ? 24 : 8;
  const iw = Math.max(40, w - padL - padR);
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const vFmt = valueFmt === fmt.n && max >= 10000 ? fmt.compact : valueFmt;
  const rowH = Math.min(38, (height - padT - padB) / Math.max(1, items.length));
  const th = Math.min(maxBarW, Math.max(6, rowH * 0.5));

  return (
    <div ref={box} style={{ position: "relative" }}>
      <svg className="chart" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setTip(null)}>
        {items.map((it, i) => {
          const yy = padT + rowH * i + rowH / 2;
          const bw = Math.max(2, Math.abs(it.value) / max * iw);
          const negative = it.value < 0;
          return (
            <g key={i}>
              <rect x={padL} y={yy - th / 2} width={iw} height={th} rx={th / 2} fill={rc("var(--surface-3)")} opacity="0.7" />
              <rect x={padL} y={yy - th / 2} width={bw} height={th} rx={th / 2} fill={rc(it.color)} opacity="0.92"
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, html: tipHtml(it.label, [{ name: "Value", value: valueFmt(it.value), color: it.color }]) })} />
              <text x={padL - 10} y={yy + 3.5} textAnchor="end" fontSize="10.5" fill={rc("var(--text-soft)")}>
                {it.label.length > 26 ? it.label.slice(0, 25) + "…" : it.label}
              </text>
              <text x={padL + bw + 10} y={yy + 3.5} fontSize="10.5" fill={rc("var(--muted)")} style={{ fontWeight: 600 }}>
                {negative ? "−" : ""}{vFmt(Math.abs(it.value))}
              </text>
            </g>);

        })}
        <line className="axis-line" x1={padL} x2={padL} y1={padT} y2={height - padB} />
        {axisName ? <text x={padL + iw / 2} y={height - 4} textAnchor="middle" fontSize="10">{axisName}</text> : null}
      </svg>
      <ChartTip tip={tip} />
    </div>);

}




export function Lines({ height = 200, cats = [], series = [], band = null, legend = false, yFmt = fmt.n,
  xName, yName, yMin = null, yMax = null, dots = true, area = null }: any): any {
  const { tip, setTip } = useTip();
  const [w, box] = useWidth();
  const gid = useGradId();
  const padL = 50,padR = 18,padT = 16,padB = xName ? 40 : 30;
  const iw = Math.max(60, w - padL - padR),ih = Math.max(40, height - padT - padB);

  const vals = series.flatMap((s) => s.data.filter((v) => v != null));
  if (band) vals.push(...band.low.filter((v) => v != null), ...band.high.filter((v) => v != null));
  const auto = yMin == null && yMax == null;
  const ns = niceScale(Math.max(1, ...vals) * 1.02, 4);
  const lo = yMin != null ? yMin : Math.min(0, ...vals);
  const hi = yMax != null ? yMax : auto ? Math.max(ns.top, Math.max(1, ...vals)) : Math.max(1, ...vals);
  const sx = (i) => padL + (cats.length <= 1 ? iw / 2 : i / (cats.length - 1) * iw);
  const sy = (v) => padT + ih - (v - lo) / (hi - lo || 1) * ih;

  const path = (data) => {
    let d = "",open = false;
    data.forEach((v, i) => {
      if (v == null) {open = false;return;}
      d += `${open ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`;
      open = true;
    });
    return d;
  };
  const areaPath = (data) => {
    let d = "",open = false,started = -1,ended = -1;
    data.forEach((v, i) => {
      if (v == null) {open = false;return;}
      if (started < 0) started = i;
      ended = i;
      d += `${open ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`;
      open = true;
    });
    if (!d) return "";
    return d + `L${sx(ended)},${sy(lo)}L${sx(started)},${sy(lo)}Z`;
  };
  const bandPath = () => {
    if (!band) return "";
    let up = "",down = [];
    band.high.forEach((v, i) => {if (v != null) up += `${up ? "L" : "M"}${sx(i)},${sy(v)}`;});
    for (let i = band.low.length - 1; i >= 0; i--) {const v = band.low[i];if (v != null) down.push(`${sx(i)},${sy(v)}`);}
    return up + (down.length ? "L" + down.join("L") : "") + "Z";
  };
  const ticks = auto && lo === 0 ? ns.ticks : Array.from({ length: 5 }, (_, i) => lo + (hi - lo) * (i / 4));
  const step = Math.max(1, Math.ceil(cats.length / Math.max(4, Math.floor(iw / 62))));
  const tickFmt = yFmt === fmt.n && hi >= 10000 ? fmt.compact : yFmt;
  const fillArea = area === null ? series.length === 1 && !band : area !== false;

  return (
    <div ref={box} style={{ position: "relative" }}>
      <svg className="chart" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setTip(null)}>
        <defs>
          <linearGradient id={gid + "-area"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rc(series[0] && series[0].color)} stopOpacity="0.22" />
            <stop offset="100%" stopColor={rc(series[0] && series[0].color)} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {ticks.map((v, i) =>
        <g key={i}>
            <line className="grid-line" x1={padL} x2={w - padR} y1={sy(v)} y2={sy(v)} strokeDasharray={i === 0 ? "0" : "2 4"} />
            <text x={padL - 10} y={sy(v) + 3.5} textAnchor="end">{tickFmt(v)}</text>
          </g>
        )}

        {band ? <path d={bandPath()} fill={rc(band.color || "var(--accent)")} opacity="0.13" /> : null}
        {fillArea && series[0] ? <path d={areaPath(series[0].data)} fill={`url(#${gid}-area)`} /> : null}

        {series.map((s, k) =>
        <g key={k}>
            <path d={path(s.data)} fill="none" stroke={rc(s.color)} strokeWidth={s.width || 2}
          strokeDasharray={s.dash || undefined} strokeLinecap="round" strokeLinejoin="round" />
            {dots !== false && s.dots !== false ? s.data.map((v, i) => v != null ?
          <circle key={i} className="tick-dot" cx={sx(i)} cy={sy(v)} r={s.dotR || 3} fill={rc(s.color)} stroke={rc("var(--surface)")} /> :
          null) : null}
          </g>
        )}

        {cats.map((c, i) => i % step === 0 ? <text key={i} x={sx(i)} y={height - padB + 16} textAnchor="middle" fontSize="10.5">{c}</text> : null)}
        <line className="axis-line" x1={padL} x2={w - padR} y1={padT + ih} y2={padT + ih} />
        {xName ? <text x={padL + iw / 2} y={height - 3} textAnchor="middle" fontSize="10">{xName}</text> : null}

        {cats.map((c, i) =>
        <rect key={i} className="visit-hover" x={sx(i) - iw / Math.max(1, cats.length) / 2} y={padT} width={iw / Math.max(1, cats.length)} height={ih}
        onMouseMove={(e) => setTip({
          x: e.clientX, y: e.clientY,
          html: tipHtml(c, series.map((s) => ({
            name: s.name,
            value: s.data[i] == null ? "–" : yFmt === fmt.pct ? fmt.pct(s.data[i] * 100, 0) : fmt.n(s.data[i]),
            color: s.color
          })).concat(band ? [{ name: band.name, value: `${fmt.n(band.low[i])}–${fmt.n(band.high[i])}`, color: band.color || "var(--accent)" }] : []))
        })} />
        )}
      </svg>
      <ChartTip tip={tip} />
      {legend ?
      <div className="legend">
          {series.map((s) => <span key={s.name}><i className={"sw " + (s.width && s.width <= 1.5 && s.dots === false ? "line" : "")} style={{ background: s.color }} />{s.name}</span>)}
          {band ? <span><i className="sw" style={{ background: band.color || "var(--accent)", opacity: 0.3 }} />{band.name}</span> : null}
        </div> :
      null}
    </div>);

}




export function Heatmap({ rows = [], height = 260, months, onHover }: any): any {
  const { tip, setTip } = useTip();
  const light = useLight();
  const MB = months || ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [w, box] = useWidth();
  const padL = 44,padT = 20,padB = 12;
  const gap = 2;
  const cw = Math.max(9, (w - padL - 8) / 12);
  const chh = rows.length ? Math.max(9, (height - padT - padB) / rows.length) : 12;
  const all = rows.flatMap((r) => r.months.filter((v) => v != null));
  const max = Math.max(1, ...all);
  const min = all.length ? Math.min(...all) : 0;
  const lo = Math.log(1 + min),hi = Math.log(1 + max);
  const t = (v) => Math.max(0, Math.min(1, (Math.log(1 + v) - lo) / (hi - lo || 1)));
  const scale = (v) => rampColor("HEAT", t(v), light);
  return (
    <div>
      <div ref={box} style={{ position: "relative" }}>
        <svg className="chart" height={height} viewBox={`0 0 ${w} ${height}`} onMouseLeave={() => setTip(null)}>
          {MB.map((m, i) =>
          <text key={m} x={padL + cw * i + cw / 2} y={12} textAnchor="middle" fontSize="9.5">{m}</text>
          )}
          {rows.map((r, ri) =>
          <g key={r.year}>
              <text x={padL - 10} y={padT + chh * ri + chh / 2 + 3.5} textAnchor="end" fontSize="10">{r.year}</text>
              {r.months.map((v, ci) => {
              const x = padL + cw * ci + gap / 2,y2 = padT + chh * ri + gap / 2;
              const cwid = cw - gap,ch2 = chh - gap;
              return (
                <g key={ci}>
                    <rect x={x} y={y2} width={cwid} height={ch2} rx={3}
                  fill={v == null ? "transparent" : scale(v)}
                  stroke={v == null ? "var(--line)" : "none"} strokeDasharray={v == null ? "2 2" : undefined}
                  strokeWidth={v == null ? 1 : 0} />
                    <rect className="visit-hover" x={padL + cw * ci} y={padT + chh * ri} width={cw} height={chh}
                  onMouseMove={(e) => {
                    setTip({
                      x: e.clientX, y: e.clientY,
                      html: v == null ?
                      tipHtml(`${MB[ci]} ${r.year}`, [{ name: "State", value: "Not fully observed" }]) :
                      tipHtml(`${MB[ci]} ${r.year}`, [{ name: "Detections", value: fmt.n(v) }])
                    });
                    onHover && onHover(r, ci, v);
                  }} />
                  </g>);

            })}
            </g>
          )}
        </svg>
        <ChartTip tip={tip} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 10 }}>
        <span className="faint" style={{ fontSize: 10 }}>0</span>
        <div style={{ width: 130, height: 8, borderRadius: 999, border: "1px solid var(--line-soft)", background: `linear-gradient(90deg,${(light ? RAMPS.HEAT_LIGHT : RAMPS.HEAT).join(",")})` }} />
        <span className="faint" style={{ fontSize: 10 }}>{fmt.n(max)}</span>
      </div>
    </div>);

}




export function CellMap({ cells = [], height = 460, ramp = "HEAT", scale = "log", top = null, legendLeft, legendMid, legendRight,
  onCellClick = null, hoverFmt = null, idleText, signedBase = null, bounds = null, gridDeg = 0.25 }: any): any {
  const [hover, setHover] = useState(null);
  const light = useLight();
  const ink = light ? "#101828" : "#ffffff";
  const bgc = light ? "#eaeef3" : "#0b1016";
  const gridc = light ? "#dbe1e8" : "#18202b";
  const W = 1000;
  const b = bounds || (() => {
    if (!cells.length) return [60, 5, 98, 37.5];
    let w = 1e9,s = 1e9,e = -1e9,n = -1e9;
    cells.forEach((c) => {w = Math.min(w, c.lon);e = Math.max(e, c.lon + c.cellDeg);s = Math.min(s, c.lat);n = Math.max(n, c.lat + c.cellDeg);});
    if (e - w > 300) return [60, 5, 98, 37.5];
    const padX = (e - w) * 0.04,padY = (n - s) * 0.04;
    return [w - padX, s - padY, e + padX, n + padY];
  })();
  const [west, south, east, north] = b;
  const midLat = (south + north) / 2;
  const H = Math.max(120, Math.round(W * ((north - south) / ((east - west) * Math.cos(midLat * Math.PI / 180)))));
  const sx = (lon) => (lon - west) / (east - west) * W;
  const sy = (lat) => (north - lat) / (north - south) * H;

  const vals = cells.map((c) => c.value).filter((v) => v != null);
  const topV = top || (vals.length ? vals.slice().sort((a, b2) => a - b)[Math.floor(vals.length * 0.99)] : 1);
  const maxAbs = vals.length ? vals.reduce((a, v) => Math.max(a, Math.abs(v)), 0) : 1;

  const pos = vals.filter((v) => v > 0);
  const vMin = pos.length ? Math.min(...pos) : 0;
  const lo = Math.log(1 + vMin),hi = Math.log(1 + topV);
  const colorOf = (v) => {
    if (v == null) return "transparent";
    if (scale === "log") return rampColor(ramp, Math.max(0, Math.min(1, (Math.log(1 + Math.max(0, v)) - lo) / (hi - lo || 1))), light);
    if (scale === "prob") return rampColor(ramp, Math.max(0, Math.min(1, v)), light);
    if (scale === "ratio") return rampColor(ramp, 0.5 + Math.max(-1, Math.min(1, Math.log2(v || 1) / 2)) / 2, light);
    const a = signedBase || maxAbs || 1;
    return rampColor(ramp, 0.5 + Math.max(-1, Math.min(1, v / a)) / 2, light);
  };

  const onMove = (e) => {
    const svg = e.currentTarget.ownerSVGElement || e.currentTarget;
    const r = svg.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * W;
    const py = (e.clientY - r.top) / r.height * H;
    const lon = west + px / W * (east - west);
    const lat = north - py / H * (north - south);
    const hit = cells.find((c) => lon >= c.lon && lon < c.lon + c.cellDeg && lat >= c.lat && lat < c.lat + c.cellDeg);
    setHover(hit || { lat, lon, empty: true });
  };

  const gstep = east - west > 60 ? 20 : east - west > 20 ? 10 : 5;
  const gLat = north - south > 30 ? 10 : 5;

  return (
    <div>
      <div className="mapbox" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ height: "100%", width: "100%" }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <pattern id="cm-grid" width={W / (east - west) * gstep} height={H / (north - south) * gLat} patternUnits="userSpaceOnUse">
              <path d={`M ${W / (east - west) * gstep} 0 L 0 0 0 ${H / (north - south) * gLat}`} fill="none" stroke={gridc} strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={W} height={H} fill={bgc} />
          <rect x="0" y="0" width={W} height={H} fill="url(#cm-grid)" />
          {cells.map((c, i) =>
          <rect key={i} x={sx(c.lon)} y={sy(c.lat + c.cellDeg)} width={c.cellDeg / (east - west) * W + 0.4} height={c.cellDeg / (north - south) * H + 0.4}
          fill={colorOf(c.value)} opacity={0.94} shapeRendering="crispEdges"
          onClick={onCellClick ? () => onCellClick(c) : undefined}
          style={{ cursor: onCellClick ? "pointer" : "default" }} />
          )}
          {hover && !hover.empty ?
          <rect x={sx(hover.lon)} y={sy(hover.lat + (hover.cellDeg || gridDeg))} width={gridDeg / (east - west) * W} height={gridDeg / (north - south) * H}
          fill="none" stroke={ink} strokeWidth="2" pointerEvents="none" /> :
          null}
        </svg>
      </div>
      <div className="map-hover">
        {hover ?
        hover.empty ?
        fmt.coord(hover.lat, hover.lon) :
        hoverFmt ? hoverFmt(hover) : `${fmt.coord(hover.lat, hover.lon)} · ${fmt.n(hover.value)}` :
        idleText || "Point at a cell to read its value."}
      </div>
      <div className="map-legend">
        <span>{legendLeft || "0"}</span>
        <span className="strip" style={{ background: `linear-gradient(90deg,${(light && RAMPS[ramp + "_LIGHT"] || RAMPS[ramp] || RAMPS.HEAT).join(",")})` }} />
        {legendMid ? <span>{legendMid}</span> : null}
        <span>{legendRight || `${fmt.n(topV)} and more`}</span>
      </div>
    </div>);

}
