

import reference from "../config/reference.json";
import { VERSION } from "./runtime.mjs";

const SAT_LABEL = Object.fromEntries(reference.satellites.map((s) => [s.id, s.label]));
const SAT_HEX = Object.fromEntries(reference.satellites.map((s) => [s.label, s.hex]));

const rowTime = (r) => r.acquired || r.time || r.first || r.last || null;
const rowSat = (r) => r.satellite || r.sat || "";
const num = (v) => v === undefined || v === "" || v === null ? null : Number(v);

function selectionFilter(q) {
  const from = q.from ? new Date(q.from + "T00:00:00Z") : null;
  const to = q.to ? new Date(q.to + "T23:59:59Z") : null;
  const bbox = q.bbox ? q.bbox.split(",").map(Number) : null;
  const wanted = q.sats ? q.sats.split(",").filter(Boolean).map((id) => SAT_LABEL[id] || id) : null;
  return (row) => {
    if (from || to) {
      const stamp = rowTime(row);
      const t = stamp ? new Date(stamp) : null;
      if (!t || isNaN(t)) return false;
      if (from && t < from) return false;
      if (to && t > to) return false;
    }
    if (bbox) {
      const [w, s, e, n] = bbox;
      if (!(row.lon >= w && row.lon <= e && row.lat >= s && row.lat <= n)) return false;
    }
    if (wanted && wanted.length && !wanted.includes(rowSat(row))) return false;
    return true;
  };
}

function tableFilter(q) {
  const sel = selectionFilter(q);
  const frpMin = num(q.frp_min);
  const prefix = q.id_prefix || "";
  return (row) => {
    if (!sel(row)) return false;
    if (q.satellite && rowSat(row) !== q.satellite) return false;
    if (q.sensor && row.sensor !== q.sensor) return false;
    if (q.band && row.band !== q.band) return false;
    if (q.daynight && row.daynight !== q.daynight) return false;
    if (q.country && row.country !== q.country) return false;
    if (q.status && row.status !== q.status) return false;
    if (q.flag && !(row.flags || []).includes(q.flag)) return false;
    if (frpMin != null && !isNaN(frpMin) && (row.frp || 0) < frpMin) return false;
    if (prefix && !String(row.id).startsWith(prefix)) return false;
    return true;
  };
}

export function pageOf(rows, q) {
  const page = Math.max(1, Number(q.page || 1));
  const size = Math.min(500, Math.max(1, Number(q.size || 50)));
  const key = q.sort || null;
  const dir = q.dir === "asc" ? 1 : -1;
  const sorted = key ?
  rows.slice().sort((a, b) => {
    const x = a[key],y = b[key];
    if (x === y) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x > y ? 1 : -1) * dir;
  }) :
  rows.slice();
  return {
    total: sorted.length, page, size,
    pages: Math.max(1, Math.ceil(sorted.length / size)),
    rows: sorted.slice((page - 1) * size, page * size)
  };
}

export function table(rt, name, q) {
  const source = name === "observations" ? rt.db.observations : name === "events" ? rt.db.events : [];
  const out = pageOf(source.filter(tableFilter(q)), q);
  out.table = name;
  out.filtered_from = source.length;
  return out;
}

export function search(rt, q) {
  const term = String(q || "").trim().toLowerCase();
  if (term.length < 2) return { countries: [], events: [], detections: [] };
  const countries = [...new Set(rt.db.observations.map((o) => o.country).filter(Boolean))];
  return {
    countries: countries.filter((c) => c.toLowerCase().includes(term)).slice(0, 4).map((name) => ({ name })),
    events: rt.db.events.filter((e) => String(e.id).toLowerCase().includes(term)).slice(0, 6).
    map((e) => ({ id: e.id, n: e.detections, status: e.status })),
    detections: rt.db.observations.filter((o) => String(o.id).toLowerCase().includes(term)).slice(0, 8).
    map((o) => ({ id: o.id, satellite: rowSat(o), time: rowTime(o) }))
  };
}

const day = (stamp) => String(stamp).slice(0, 10);

function dataWindow(rt) {
  const days = rt.db.observations.map((o) => rowTime(o)).filter(Boolean).map(day).sort();
  return days.length ? { from: days[0], to: days[days.length - 1] } : { from: "", to: "" };
}

export function meta(rt) {
  return {
    version: VERSION,
    title: reference.title,
    window: dataWindow(rt),
    regions: reference.regions,
    satellites: reference.satellites,
    countries: [...new Set(rt.db.observations.map((o) => o.country).filter(Boolean))].sort(),
    places: reference.places.map((p) => ({ country: p.country, districts: p.districts })),
    upload: reference.upload,
    commit: process.env.FH_COMMIT || "",
    needs_setup: rt.state.users.length === 0,
    country_bbox: reference.country_bbox,
    tagExplain: reference.tag_explain,
    vocab: reference.vocab
  };
}

export function health(rt) {
  const running = rt.state.jobs.find((j) => j.state === "RUNNING") || null;
  return {
    state: "ok",
    detections: rt.db.observations.length,
    events: rt.db.events.length,
    generation: rt.db.generated ? Date.parse(rt.db.generated) : 0,
    active_job: running,
    version: VERSION,
    uptime_s: Math.round((Date.now() - rt.started) / 1000),
    data_generated: rt.db.generated
  };
}

const count = (rows, key) => {
  const m = {};
  rows.forEach((r) => {const k = typeof key === "function" ? key(r) : r[key];if (k != null && k !== "") m[k] = (m[k] || 0) + 1;});
  return m;
};

export function overview(rt, q) {
  const rows = rt.db.observations.filter(selectionFilter(q));
  const evs = rt.db.events;
  const win = dataWindow(rt);
  const flagged = rows.filter((r) => (r.flags || []).length).length;
  const frp = rows.reduce((s, r) => s + (Number(r.frp) || 0), 0);
  const backed = evs.filter((e) => e.status === "CONFIRMED" || e.status === "SUPPORTED").length;
  const days = [...new Set(rows.map((r) => rowTime(r)).filter(Boolean).map(day))].sort();
  const sats = [...new Set(rows.map(rowSat).filter(Boolean))];
  const confidence = count(rows.filter((r) => r.sensor === "VIIRS"), "confidence");
  const modisBins = Array(10).fill(0);
  rows.filter((r) => r.sensor === "MODIS").forEach((r) => {
    const c = Number(r.confidence);
    if (Number.isFinite(c)) modisBins[Math.min(9, Math.max(0, Math.floor(c / 10)))]++;
  });
  const dn = (s, v) => rows.filter((r) => rowSat(r) === s && r.daynight === v).length;

  return {
    computed: new Date().toISOString(),
    window: { from: win.from ? win.from + " 00:00 UTC" : "", to: win.to ? win.to + " 23:59 UTC" : "" },
    kpis: [
    { label: "Thermal detections", tag: "OBS", value: rows.length, unit: "", note: "Detection records stored on this installation for the current selection.", route: "explorer" },
    { label: "Candidate fire events", tag: "REC", value: evs.length, unit: "", note: "Groups of detections. Candidates, not confirmed fires.", route: "events" },
    { label: "Events with independent evidence", tag: "VD", value: backed, unit: "", note: "CONFIRMED or SUPPORTED by tier 3 evidence. Thermal agreement alone never counts.", route: "events" },
    { label: "Quality-flagged detections", tag: "REC", value: rows.length ? +(flagged / rows.length * 100).toFixed(1) : 0, unit: "%", note: `${flagged.toLocaleString("en")} records carry at least one quality flag.` },
    { label: "Summed fire radiative power", tag: "OBS", value: Math.round(frp), unit: "MW", note: "Sum of the provider FRP values. Not comparable between sensors; FRP 0 means the retrieval failed." }],

    daily: {
      days,
      series: sats.map((s) => ({
        name: s, color: SAT_HEX[s] || "#888",
        data: days.map((d) => rows.filter((r) => rowSat(r) === s && day(rowTime(r)) === d).length)
      }))
    },
    statuses: Object.entries(count(evs, "status")).map(([code, n]) => ({ code, count: n })),
    run: { id: rt.state.jobs.filter((j) => j.state === "COMPLETED").length, region: rt.state.settings.region || "" },
    bands: Object.entries(count(rows, "band")).map(([code, n]) => ({ code, count: n })),
    countries: Object.entries(count(rows, "country")).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, n]) => ({ name, count: n })),
    outside: rows.filter((r) => !r.country).length,
    confidence: { viirs: Object.entries(confidence).map(([label, n]) => ({ label, count: n })), modis_bins: modisBins },
    daynight: { sats, day: sats.map((s) => dn(s, "Day")), night: sats.map((s) => dn(s, "Night")) },
    coverage: { units: 0, definition: "", known_pct: 0 }
  };
}

export function mapObservations(rt, q) {
  const deg = 0.5;
  const cells = new Map();
  rt.db.observations.filter(selectionFilter(q)).forEach((r) => {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return;
    const lat = Math.floor(r.lat / deg) * deg,lon = Math.floor(r.lon / deg) * deg;
    const k = lat + "," + lon;
    const c = cells.get(k) || { lat, lon, cellDeg: deg, value: 0, country: r.country || null };
    c.value++;
    cells.set(k, c);
  });
  const list = [...cells.values()];
  return { cells: list, points: [], max: list.reduce((m, c) => Math.max(m, c.value), 0) };
}

export function mapEvents(rt) {
  return { points: rt.db.events.slice(0, 2000).map((e) => ({ id: e.id, lat: e.lat, lon: e.lon, status: e.status, n: e.detections })) };
}

export function eventDetail(rt, id) {
  const e = rt.eventById.get(id);
  if (!e) return null;
  const ids = new Set((e.observation_ids || []).map(String));
  const detections = rt.db.observations.filter((o) => ids.has(String(o.id))).slice(0, 200).
  map((o) => ({ id: o.id, acquired: o.acquired, satellite: rowSat(o), frp: o.frp, confidence: o.confidence, band: o.band, lat: o.lat, lon: o.lon }));
  const evidence = rt.state.evidence.filter((x) => String(x.event) === String(id));
  return {
    ...e,
    explanations: { status: "" },
    reasons: [],
    rule_version: "",
    algorithm: "",
    overpass_series: [],
    evidence,
    limits: ["A candidate event is a group of detections, not a confirmed fire."],
    detections
  };
}

export function observationDetail(rt, id) {
  const o = rt.obsById.get(id);
  if (!o) return null;
  return { ...o, flags: o.flags || [], raw_line: o.raw_line || "", raw_fields: o.raw_fields || [], file: o.file || null };
}
