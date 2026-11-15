import { writeFileSync } from "node:fs";







import { runtime, VERSION, SESSION_HOURS, ROLES, newToken, newId, newUser, hashPassword, verifyPassword, PASSWORD_OK } from "./runtime.mjs";
import { registerDomain, PLACES, DISTRICTS } from "./domain.mjs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const fail = (status, message, code) => {
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  throw e;
};

const ADMIN = ["SUPER_ADMIN"];
const STAFF = ["SUPER_ADMIN", "REGIONAL_ADMIN"];

function build() {
  const rt = runtime();
  const { state, save, audit, broadcast } = rt;
  const ROUTES = [];
  const route = (method, pattern, handler, opts = {}) => {
    const keys = [];
    const rx = pattern === "*" ? /^.*$/ : new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => {keys.push(k);return "([^/]+)";}) + "$");
    ROUTES.push({ method, rx, keys, handler, opts });
  };

  const publicUser = (u) => {const { password, ...rest } = u;return rest;};
  const accountRow = (u) => {
    const stamps = Object.values(state.sessions).filter((x) => x.user === u.id).map((x) => x.started).sort();
    return { ...publicUser(u), disabled: !!u.disabled, pending: !!u.pending, last_sign_in: stamps.length ? stamps[stamps.length - 1] : null };
  };
  const deviceOf = (ua = "") => {
    const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
    const o = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
    return o ? `${b} · ${o}` : b;
  };
  const startSession = (user, headers = {}) => {
    const token = newToken();
    const expires = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
    state.sessions[token] = { user: user.id, started: new Date().toISOString(), expires, device: deviceOf(headers["user-agent"]) };
    return { token, expires };
  };
  const sessionId = (token) => createHash("sha256").update(token).digest("hex").slice(0, 10);
  const isAdmin = (u) => u.roleCode === "SUPER_ADMIN";
  const activeAdmins = () => state.users.filter((u) => isAdmin(u) && !u.disabled).length;

  const needsScope = (roleCode, country, district) => {
    if (roleCode === "REGIONAL_ADMIN" && !PLACES.some((p) => p.country === country)) fail(400, "Choose the country this account administers.");
    if (roleCode === "RESIDENT" && !DISTRICTS.some((d) => d.country === country && d.district === district)) fail(400, "Choose the country and district for this account.");
  };
  const find = (id) => state.users.find((u) => u.id === id) || fail(404, "No such account.");

  function sessionFor(headers) {
    const raw = headers["x-admin-token"] || headers["authorization"] || "";
    const token = String(raw).replace(/^Bearer\s+/i, "").trim();
    const s = token && state.sessions[token];
    if (!s) return null;
    if (new Date(s.expires).getTime() < Date.now()) {delete state.sessions[token];save();return null;}
    const user = state.users.find((u) => u.id === s.user);
    return !user || user.disabled ? null : { token, user, session: s };
  }


  route("POST", "/api/auth/login", ({ body, headers }) => {
    const email = String(body.email || "").trim().toLowerCase();
    const user = state.users.find((u) => u.email === email);
    if (user && user.disabled) fail(403, "This account has been disabled by an administrator.");
    if (!user || !verifyPassword(String(body.password || ""), user.password)) fail(401, "Those details do not match an account on this installation.");
    const s = startSession(user, headers);
    audit(user.email, "sign-in", "password accepted");
    save();
    return { user: publicUser(user), ...s };
  });

  route("POST", "/api/auth/register", ({ body, headers }) => {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (name.length < 2) fail(400, "A name is required.");
    if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, "That email address does not look complete.");
    if (!PASSWORD_OK(password)) fail(400, "Use at least 8 characters for the password, with letters and a number.");
    if (state.users.some((u) => u.email === email)) fail(409, "An account with that email address already exists on this installation.");


    const first = state.users.length === 0;
    if (first) fail(503, "An operator must configure FH_ADMIN_EMAIL and FH_ADMIN_PASSWORD before registration opens.");
    const place = DISTRICTS.find((d) => d.country === body.country && d.district === body.district);
    if (!first && !place) fail(400, "Choose your country and district.");
    const user = newUser(rt, {
      name, email, password, organisation: String(body.organisation || "").trim(),
      roleCode: "RESIDENT",
      country: first ? null : place.country, district: first ? null : place.district,
      timezone: body.timezone
    });
    state.users.push(user);
    const s = startSession(user, headers);
    audit(email, "register", "resident sign-up");
    save();
    return { user: publicUser(user), ...s, pending: !first };
  });

  route("GET", "/api/auth/me", ({ ctx }) => ({ user: publicUser(ctx.user), session: ctx.session }), { auth: true });

  route("POST", "/api/auth/profile", ({ body, ctx }) => {
    const allowed = ["name", "email", "phone", "organisation", "timezone", "units", "notifications"];
    if (body.email !== undefined) {
      const mail = String(body.email).trim().toLowerCase();
      if (state.users.some((u) => u.email === mail && u.id !== ctx.user.id)) fail(409, "That email address is already used by another account.");
      body.email = mail;
    }
    allowed.forEach((k) => {if (body[k] !== undefined) ctx.user[k] = body[k];});
    audit(ctx.user.email, "profile", allowed.filter((k) => body[k] !== undefined).join(", "));
    save();
    return { user: publicUser(ctx.user) };
  }, { auth: true });

  route("POST", "/api/auth/password", ({ body, ctx }) => {
    if (!verifyPassword(String(body.current || ""), ctx.user.password)) fail(400, "The current password is not correct.");
    if (!PASSWORD_OK(body.next)) fail(400, "Use at least 8 characters, with letters and a number.");
    ctx.user.password = hashPassword(String(body.next));
    Object.keys(state.sessions).forEach((t) => {if (state.sessions[t].user === ctx.user.id && t !== ctx.token) delete state.sessions[t];});
    audit(ctx.user.email, "password", "changed; other devices signed out");
    save();
    return { ok: true };
  }, { auth: true });

  route("POST", "/api/auth/logout", ({ ctx }) => {
    delete state.sessions[ctx.token];
    audit(ctx.user.email, "sign-out", "");
    save();
    return { ok: true };
  }, { auth: true });

  route("GET", "/api/auth/sessions", ({ ctx }) => ({
    sessions: Object.entries(state.sessions).
    filter(([, x]) => x.user === ctx.user.id).
    map(([token, x]) => ({ id: sessionId(token), device: x.device || "Browser", where: "", last: x.started, current: token === ctx.token }))
  }), { auth: true });

  route("POST", "/api/auth/sessions/revoke-others", ({ ctx }) => {
    Object.keys(state.sessions).forEach((t) => {if (state.sessions[t].user === ctx.user.id && t !== ctx.token) delete state.sessions[t];});
    audit(ctx.user.email, "sessions", "other devices signed out");
    save();
    return { ok: true };
  }, { auth: true });

  route("POST", "/api/auth/logout-all", ({ ctx }) => {
    Object.keys(state.sessions).forEach((t) => {if (state.sessions[t].user === ctx.user.id) delete state.sessions[t];});
    audit(ctx.user.email, "sign-out", "everywhere");
    save();
    return { ok: true };
  }, { auth: true });

  route("POST", "/api/auth/check", ({ body, ctx }) => {
    const token = String(body.token || ctx?.token || "");
    const s = state.sessions[token];
    return { ok: !!s, user: s ? state.users.find((u) => u.id === s.user)?.email : null };
  });


  route("GET", "/api/users", () => ({
    users: state.users.map(accountRow),
    roles: Object.keys(ROLES).map((code) => ({ code, label: ROLES[code] })),
    counts: {
      total: state.users.length,
      admins: state.users.filter(isAdmin).length,
      pending: state.users.filter((u) => u.pending).length,
      disabled: state.users.filter((u) => u.disabled).length
    }
  }), { auth: true, role: ADMIN });

  route("POST", "/api/users", ({ body, ctx }) => {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const roleCode = String(body.roleCode || "RESIDENT").toUpperCase();
    if (name.length < 2) fail(400, "A name is required.");
    if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, "That email address does not look complete.");
    if (!PASSWORD_OK(body.password)) fail(400, "Use at least 8 characters for the password, with letters and a number.");
    if (!ROLES[roleCode]) fail(400, "Unknown role.");
    needsScope(roleCode, body.country, body.district);
    if (state.users.some((u) => u.email === email)) fail(409, "An account with that email address already exists.");
    const user = newUser(rt, {
      name, email, password: String(body.password), roleCode, organisation: String(body.organisation || "").trim(),
      country: body.country || null, district: body.district || null, timezone: body.timezone, created_by: ctx.user.email
    });
    state.users.push(user);
    audit(ctx.user.email, "account.create", `${email} as ${ROLES[roleCode]}`);
    save();
    return { ok: true, user: accountRow(user), password_was_set: true };
  }, { auth: true, role: ADMIN });

  route("POST", "/api/users/:id/role", ({ params, body, ctx }) => {
    const user = find(params.id);
    const roleCode = String(body.roleCode || "").toUpperCase();
    if (!ROLES[roleCode]) fail(400, "Unknown role.");
    if (user.id === ctx.user.id && roleCode !== "SUPER_ADMIN") fail(400, "You cannot remove your own administrator role.");
    needsScope(roleCode, user.country, user.district);
    if (isAdmin(user) && roleCode !== "SUPER_ADMIN" && activeAdmins() <= 1) fail(400, "This is the only administrator. Give another account the role first.");
    user.roleCode = roleCode;
    user.role = ROLES[roleCode];
    audit(ctx.user.email, "account.role", `${user.email} -> ${ROLES[roleCode]}`);
    save();
    return { ok: true, user: accountRow(user) };
  }, { auth: true, role: ADMIN });

  route("POST", "/api/users/:id/approve", ({ params, ctx }) => {
    const user = find(params.id);
    needsScope("REGIONAL_ADMIN", user.country, user.district);
    user.pending = false;
    user.roleCode = "REGIONAL_ADMIN";
    user.role = ROLES.REGIONAL_ADMIN;
    user.notifications = { ...user.notifications, job_finished: true, needs_verification: true };
    audit(ctx.user.email, "account.approve", `${user.email} as ${user.role}`);
    save();
    return { ok: true, user: accountRow(user) };
  }, { auth: true, role: ADMIN });

  route("POST", "/api/users/:id/disabled", ({ params, body, ctx }) => {
    const user = find(params.id);
    if (user.id === ctx.user.id) fail(400, "You cannot disable your own account.");
    if (body.disabled && isAdmin(user) && activeAdmins() <= 1) fail(400, "This is the only administrator.");
    user.disabled = !!body.disabled;
    if (user.disabled) Object.keys(state.sessions).forEach((t) => {if (state.sessions[t].user === user.id) delete state.sessions[t];});
    audit(ctx.user.email, user.disabled ? "account.disable" : "account.enable", user.email);
    save();
    return { ok: true, user: accountRow(user) };
  }, { auth: true, role: ADMIN });

  route("POST", "/api/users/:id/password", ({ params, body, ctx }) => {
    const user = find(params.id);
    if (!PASSWORD_OK(body.password)) fail(400, "Use at least 8 characters, with letters and a number.");
    user.password = hashPassword(String(body.password));
    Object.keys(state.sessions).forEach((t) => {if (state.sessions[t].user === user.id && t !== ctx.token) delete state.sessions[t];});
    audit(ctx.user.email, "account.password", `reset for ${user.email}`);
    save();
    return { ok: true, user: accountRow(user) };
  }, { auth: true, role: ADMIN });

  route("DELETE", "/api/users/:id", ({ params, ctx }) => {
    const user = find(params.id);
    if (user.id === ctx.user.id) fail(400, "You cannot delete your own account.");
    if (isAdmin(user) && activeAdmins() <= 1) fail(400, "This is the only administrator.");
    state.users = state.users.filter((u) => u.id !== user.id);
    Object.keys(state.sessions).forEach((t) => {if (state.sessions[t].user === user.id) delete state.sessions[t];});
    audit(ctx.user.email, "account.delete", user.email);
    save();
    return { ok: true, deleted: user.email };
  }, { auth: true, role: ADMIN });


  registerDomain({
    route, state, save, audit, broadcast, newId,
    nextCounter: (name) => state.domain.counters[name] = (state.domain.counters[name] || 0) + 1,
    writeUpload: (name, buf) => writeFileSync(join(rt.uploads, name), buf)
  });

  function match(method, pathname) {
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = pathname.match(r.rx);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => {params[k] = decodeURIComponent(m[i + 1]);});
        return { route: r, params };
      }
    }
    return null;
  }

  return async function handle({ method, pathname, query, body, headers }) {
    const hit = match(method, pathname);
    if (!hit) return { status: 404, body: { detail: `No endpoint ${method} ${pathname}`, code: "NOT_FOUND" } };
    const ctx = sessionFor(headers);
    const { route: r, params } = hit;
    if (r.opts.auth && !ctx) {
      return { status: 401, body: { detail: "This action needs a signed-in account. Sign in first.", code: "UNAUTHENTICATED" } };
    }
    if (r.opts.role && !r.opts.role.includes(ctx.user.roleCode)) {
      return { status: 403, body: { detail: `Your role (${ctx.user.role}) cannot do this.`, code: "FORBIDDEN" } };
    }
    try {
      const out = await r.handler({ params, query, body, ctx, path: pathname, headers });
      return { status: 200, body: out ?? {} };
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error("[fireharmonix]", err);
      return { status, body: { detail: err.message || "The server failed.", code: err.code || "ERROR" } };
    }
  };
}

export function handler() {
  const g = globalThis;
  if (!g.__fireharmonixApi) g.__fireharmonixApi = build();
  return g.__fireharmonixApi;
}
