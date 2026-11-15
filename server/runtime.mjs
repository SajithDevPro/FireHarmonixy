











import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import pkg from "../package.json";

export const VERSION = pkg.version;
export const SESSION_HOURS = Number(process.env.FH_SESSION_HOURS || 12);

const emptyState = () => ({
  created: new Date().toISOString(),
  users: [],
  sessions: {},
  settings: {},
  jobs: [],
  experiments: [],
  models: [],
  uploads: [],
  evidence: [],
  audit: [],
  counters: { job: 0, experiment: 0, model: 0 },
  domain: {
    incidents: [], hospitals: [], routes: [], alerts: [], properties: [],
    events: [], read: {},
    counters: { incident: 0, hospital: 0, route: 0, alert: 0, property: 0, event: 0 }
  }
});

const emptyDb = () => ({ generated: null, observations: [], events: [] });

export const hashPassword = (password, salt = randomBytes(16).toString("hex")) => ({
  salt,
  hash: scryptSync(password, salt, 32).toString("hex")
});

export const verifyPassword = (password, rec) => {
  const a = Buffer.from(hashPassword(password, rec.salt).hash, "hex");
  const b = Buffer.from(rec.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

export const PASSWORD_OK = (pw) => String(pw || "").length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);

function load(file, fallback) {
  if (!existsSync(file)) return fallback();
  try {return { ...fallback(), ...JSON.parse(readFileSync(file, "utf8")) };}
  catch (e) {throw new Error(`Cannot read ${file}: ${e.message}. Fix or remove it.`);}
}

function atomicWrite(file, text) {
  const tmp = file + ".tmp";
  writeFileSync(tmp, text, { mode: 0o600 });
  renameSync(tmp, file);
}

function init() {
  const dir = process.env.FH_DATA_DIR || join(process.cwd(), "data");
  const uploads = join(dir, "uploads");
  mkdirSync(uploads, { recursive: true });
  const stateFile = join(dir, "state.json");
  const dbFile = join(dir, "db.json");

  const rt = {
    dir, uploads, stateFile, dbFile,
    state: load(stateFile, emptyState),
    db: load(dbFile, emptyDb),
    streams: new Set(),
    started: Date.now(),
    obsById: new Map(),
    eventById: new Map()
  };

  const blank = emptyState();
  for (const k of Object.keys(blank)) if (rt.state[k] === undefined) rt.state[k] = blank[k];
  for (const k of Object.keys(blank.domain)) if (rt.state.domain[k] === undefined) rt.state.domain[k] = blank.domain[k];

  rt.save = () => atomicWrite(stateFile, JSON.stringify(rt.state));
  rt.saveDb = () => {rt.db.generated = new Date().toISOString();atomicWrite(dbFile, JSON.stringify(rt.db));rt.reindex();};
  rt.reindex = () => {
    rt.obsById = new Map(rt.db.observations.map((o) => [String(o.id), o]));
    rt.eventById = new Map(rt.db.events.map((e) => [String(e.id), e]));
  };
  rt.reindex();

  rt.audit = (actor, action, detail = "") => {
    rt.state.audit.unshift({ at: new Date().toISOString(), actor, action, detail });
    rt.state.audit = rt.state.audit.slice(0, 500);
  };
  rt.broadcast = (payload) => {
    const line = new TextEncoder().encode("data: " + JSON.stringify({ type: payload.type, at: new Date().toISOString() }) + "\n\n");
    rt.streams.forEach((c) => {try {c.enqueue(line);} catch (e) {rt.streams.delete(c);}});
  };

  bootstrapAdmin(rt);
  return rt;
}



function bootstrapAdmin(rt) {
  if (rt.state.users.length) return;
  const email = String(process.env.FH_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.FH_ADMIN_PASSWORD || "");
  if (!email || !password) return;
  if (!PASSWORD_OK(password)) {
    console.warn("[fireharmonix] FH_ADMIN_PASSWORD needs 8+ characters with letters and a number; no admin created.");
    return;
  }
  rt.state.users.push(newUser(rt, {
    name: process.env.FH_ADMIN_NAME || "Administrator",
    email, password, roleCode: "SUPER_ADMIN", organisation: process.env.FH_ORGANISATION || ""
  }));
  rt.audit("system", "bootstrap", `administrator ${email} created from the environment`);
  rt.save();
}

export const newToken = () => randomBytes(24).toString("hex");
export const newId = (n) => randomBytes(Math.ceil(n / 2)).toString("hex").slice(0, n);

export const ROLES = {
  SUPER_ADMIN: "Super Admin", REGIONAL_ADMIN: "Regional Admin", RESIDENT: "Resident"
};

export function newUser(rt, f) {
  const roleCode = f.roleCode || "RESIDENT";
  return {
    id: "u-" + newId(10),
    name: f.name,
    email: f.email,
    role: ROLES[roleCode],
    roleCode,
    pending: !!f.pending,
    disabled: false,
    since: new Date().toISOString().slice(0, 10),
    organisation: f.organisation || "",
    country: f.country || null,
    district: f.district || null,
    timezone: f.timezone || "UTC",
    units: "metric",
    phone: "",
    notifications: { job_finished: roleCode !== "RESIDENT", needs_verification: roleCode !== "RESIDENT", weekly: roleCode === "SUPER_ADMIN", browser: false },
    password: hashPassword(f.password),
    ...(f.created_by ? { created_by: f.created_by } : {})
  };
}

export function runtime() {
  const g = globalThis;
  if (!g.__fireharmonix) g.__fireharmonix = init();
  return g.__fireharmonix;
}
