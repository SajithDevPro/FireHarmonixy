












import reference from "../config/reference.json";
import boundaryData from "../config/administrative_boundaries.json";
import { ROLES } from "./runtime.mjs";
import { pointInGeometry } from "./geo.mjs";

export { ROLES };

export const INCIDENT_STATUS = ["PENDING", "UNDER_REVIEW", "VERIFIED", "RESPONDING", "RESOLVED", "REJECTED"];
export const PROPERTY_TYPES = ["HOME", "FARM", "OTHER"];

export const PLACES = reference.places;

export const DISTRICTS = PLACES.flatMap((p) => p.districts.map((d) => ({ country: p.country, district: d })));
const ADMIN_BOUNDARIES = new Map(boundaryData.features.map((feature) => [
  `${feature.properties.country}\u0000${feature.properties.district}`,
  feature.geometry
]));
const mapPlaces = PLACES.flatMap((place) => place.districts.map((district) => {
  const geometry = ADMIN_BOUNDARIES.get(`${place.country}\u0000${district}`);
  if (!geometry) throw new Error(`No boundary geometry is configured for ${place.country} / ${district}.`);
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (coordinates) => {
    if (typeof coordinates[0] === "number") {
      bounds[0] = Math.min(bounds[0], coordinates[0]);
      bounds[1] = Math.min(bounds[1], coordinates[1]);
      bounds[2] = Math.max(bounds[2], coordinates[0]);
      bounds[3] = Math.max(bounds[3], coordinates[1]);
      return;
    }
    coordinates.forEach(visit);
  };
  visit(geometry.coordinates);
  return {
    country: place.country,
    district,
    bounds,
    center: { lat: (bounds[1] + bounds[3]) / 2, lon: (bounds[0] + bounds[2]) / 2 }
  };
}));

export function placeOf(lat, lon, country, district) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { country: null, district: null, region: null };
  }
  const p = PLACES.find((p) => p.country === country && p.districts.includes(district));
  if (!p) return { country: null, district: null, region: null };
  const [w, s, e, n] = p.bbox;
  if (lon < w || lon > e || lat < s || lat > n) return { country: null, district: null, region: null };
  const geometry = ADMIN_BOUNDARIES.get(`${p.country}\u0000${district}`);
  if (!geometry) throw new Error(`No boundary geometry is configured for ${p.country} / ${district}.`);
  if (!pointInGeometry(lon, lat, geometry)) return { country: null, district: null, region: null };
  return { country: p.country, district, region: p.country, location_basis: "point-in-polygon; geoBoundaries administrative area" };
}

const distanceKm = (a, b, c, d) => {
  const R = 6371;
  const dLat = (c - a) * Math.PI / 180;
  const dLon = (d - b) * Math.PI / 180;
  const x =
  Math.sin(dLat / 2) ** 2 +
  Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};




export function scoped(user) {
  const role = ROLES[user.roleCode] ? user.roleCode : "RESIDENT";
  return {
    role,
    all: role === "SUPER_ADMIN",
    country: user.country || null,
    district: user.district || null,

    sees(rec) {
      if (role === "SUPER_ADMIN") return true;
      if (role === "REGIONAL_ADMIN") return !!this.country && rec.country === this.country;
      return !!this.country && !!this.district && rec.country === this.country && rec.district === this.district;
    },

    filter(rows) {
      return rows.filter((r) => this.sees(r));
    }
  };
}

const fail = (status, message, code) => {
  const e = new Error(message);
  e.status = status;
  e.code = code || (status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "ERROR");
  throw e;
};




export function registerDomain(ctx) {
  const { route, state, save, audit, broadcast, newId, nextCounter, writeUpload } = ctx;
  const D = () => state.domain;

  const me = (ctx) => {
    if (!ctx || !ctx.user) {
      const e = new Error("This needs a signed-in account.");
      e.status = 401;
      e.code = "UNAUTHENTICATED";
      throw e;
    }
    return scoped(ctx.user);
  };
  const iso = () => new Date().toISOString();

  const push = (type, title, body, rec, level) => {
    const ev = {
      id: "EV-" + nextCounter("event"),
      type, title, body, level: level || "info",
      country: rec?.country ?? null,
      district: rec?.district ?? null,
      at: iso()
    };
    D().events.unshift(ev);
    D().events = D().events.slice(0, 400);
    broadcast({ type: "event", data: ev });
    return ev;
  };


  route("GET", "/api/dashboard", ({ ctx }) => {
    const s = me(ctx);
    const inc = s.filter(D().incidents);
    const hos = s.filter(D().hospitals);
    const rts = s.filter(D().routes);
    const alr = s.filter(D().alerts).filter((a) => a.active);
    const byStatus = INCIDENT_STATUS.map((code) => ({ code, count: inc.filter((i) => i.status === code).length }));
    const byDistrict = {};
    inc.forEach((i) => {byDistrict[i.district] = (byDistrict[i.district] || 0) + 1;});

    const base = {
      role: s.role,
      scope: { country: s.country, district: s.district, all: s.all },
      incidents: inc.length,
      by_status: byStatus,
      active_alerts: alr.length,
      hospitals: hos.length,
      routes: rts.length,
      routes_blocked: rts.filter((r) => r.status === "BLOCKED").length,
      incidents_by_district: Object.entries(byDistrict).map(([district, count]) => ({ district, count })).sort((a, b) => b.count - a.count),
      recent: inc.slice().sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, 8).map((i) => ({
        id: i.id, title: i.title, status: i.status, district: i.district, lat: i.lat, lon: i.lon, at: i.created_at
      })),
      alerts: alr.slice(0, 5)
    };

    if (s.role === "SUPER_ADMIN") {
      const users = state.users;
      return {
        ...base,
        users: users.length,
        admins: users.filter((u) => u.roleCode !== "RESIDENT").length,
        residents: users.filter((u) => u.roleCode === "RESIDENT").length,
        pending_users: users.filter((u) => u.pending).length,
        countries: PLACES.map((p) => ({
          country: p.country,
          incidents: D().incidents.filter((i) => i.country === p.country).length,
          hospitals: D().hospitals.filter((h) => h.country === p.country).length,
          users: users.filter((u) => u.country === p.country).length
        })),
        properties: D().properties.length
      };
    }

    if (s.role === "REGIONAL_ADMIN") {
      const users = state.users.filter((u) => u.country === s.country);
      return {
        ...base,
        users: users.length,
        residents: users.filter((u) => u.roleCode === "RESIDENT").length,
        pending_users: users.filter((u) => u.pending).length,
        properties: D().properties.filter((p) => p.country === s.country).length
      };
    }


    const myProps = D().properties.filter((p) => p.owner === ctx.user.id);
    const nearbyHospitals = hos.
    filter((h) => h.district === s.district).
    slice(0, 6).
    map((h) => ({ ...h, km: myProps[0] ? +distanceKm(myProps[0].lat, myProps[0].lon, h.lat, h.lon).toFixed(1) : null }));
    return {
      ...base,
      properties: myProps.length,
      nearby_hospitals: nearbyHospitals,
      my_properties: myProps.map((p) => ({
        id: p.id, name: p.name, type: p.type,
        incidents_near: D().incidents.filter((i) => distanceKm(p.lat, p.lon, i.lat, i.lon) <= 25 && i.status !== "REJECTED").length
      }))
    };
  });


  route("GET", "/api/incidents", ({ ctx, query }) => {
    const s = me(ctx);
    let rows = s.filter(D().incidents);
    if (query.status) rows = rows.filter((r) => r.status === query.status);
    if (query.district) rows = rows.filter((r) => r.district === query.district);
    if (query.near) {
      const [lat, lon, km] = query.near.split(",").map(Number);
      if ([lat, lon].every((n) => Number.isFinite(n))) {
        rows = rows.filter((r) => distanceKm(lat, lon, r.lat, r.lon) <= (Number.isFinite(km) ? km : 25));
      }
    }
    rows = rows.slice().sort((a, b) => a.created_at < b.created_at ? 1 : -1);
    return { incidents: rows, scope: { role: s.role, country: s.country, district: s.district }, statuses: INCIDENT_STATUS };
  });

  route("POST", "/api/incidents", ({ ctx, body }) => {
    const s = me(ctx);
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      fail(400, "The fire location is not a valid coordinate.");
    }
    const title = String(body.title || "").trim();
    if (title.length < 4) fail(400, "Give the report a short title (at least 4 characters).");
    const description = String(body.description || "").slice(0, 1200);



    let photo = null;
    if (body.photo) {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.photo));
      if (!m) fail(400, "The photo must be a JPEG, PNG or WebP image.");
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 3 * 1024 * 1024) fail(400, "The photo is larger than 3 MB.");
      const magicOk =
      m[1] === "jpeg" && buf[0] === 0xff && buf[1] === 0xd8 ||
      m[1] === "png" && buf[0] === 0x89 && buf[1] === 0x50 ||
      m[1] === "webp" && buf.slice(8, 12).toString() === "WEBP";
      if (!magicOk) fail(400, "That file is not really an image.");
      const name = newId(12) + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
      writeUpload(name, buf);
      photo = "/uploads/" + name;
    }

    const place = placeOf(lat, lon, body.country || ctx.user.country, body.district || ctx.user.district);
    if (!place.district) {
      fail(400, "The pin is outside the selected area. Move it inside the selected boundary.");
    }

    if (s.role === "RESIDENT" && ctx.user.district && place.district && (place.district !== ctx.user.district || place.country !== ctx.user.country)) {
      fail(403, "A report must be inside your own district. Move the pin closer.");
    }

    const inc = {
      id: "INC-" + nextCounter("incident"),
      title, description, lat, lon,
      country: place.country, district: place.district,
      status: "PENDING",
      photo,
      reporter_id: ctx.user.id,
      reporter_name: ctx.user.name,
      created_at: iso(), updated_at: iso(),
      verified_by: null,
      severity: "medium",
      timeline: [{ at: iso(), status: "PENDING", by: ctx.user.email }]
    };
    D().incidents.unshift(inc);
    audit(ctx.user.email, "incident.report", `${inc.id} · ${inc.district}`);
    push("incident", "New fire report", `${inc.title} — ${inc.district || "unassigned area"}`, inc, "high");
    save();
    broadcast({ type: "incidents", data: { action: "created", incident: inc } });
    return { ok: true, incident: inc };
  });

  route("GET", "/api/incidents/:id", ({ ctx, params }) => {
    const s = me(ctx);
    const inc = D().incidents.find((i) => i.id === params.id);
    if (!inc) fail(404, "No such incident.");
    if (!s.sees(inc)) fail(403, "That incident is outside your area.");
    return { incident: inc };
  });

  route("POST", "/api/incidents/:id/status", ({ ctx, params, body }) => {
    const s = me(ctx);
    if (s.role === "RESIDENT") fail(403, "Only administrators can change an incident's status.");
    const inc = D().incidents.find((i) => i.id === params.id);
    if (!inc) fail(404, "No such incident.");
    if (!s.sees(inc)) fail(403, "That incident is outside your area.");
    const status = String(body.status || "").toUpperCase();
    if (!INCIDENT_STATUS.includes(status)) fail(400, "Unknown status.");
    const note = String(body.note || "").slice(0, 400);
    inc.status = status;
    inc.updated_at = iso();
    inc.timeline.unshift({ at: iso(), status, by: ctx.user.email, note });
    if (["VERIFIED", "RESPONDING", "RESOLVED"].includes(status)) inc.verified_by = ctx.user.email;
    audit(ctx.user.email, "incident.status", `${inc.id} -> ${status}`);
    push("incident", `Incident ${status.toLowerCase().replace("_", " ")}`, `${inc.title} — ${inc.district}`, inc, status === "RESOLVED" ? "info" : "high");
    save();
    broadcast({ type: "incidents", data: { action: "status", incident: inc } });
    return { ok: true, incident: inc };
  });


  route("GET", "/api/hospitals", ({ ctx, query }) => {
    const s = me(ctx);
    let rows = s.filter(D().hospitals);
    if (query.district) rows = rows.filter((h) => h.district === query.district);
    if (query.near) {
      const [lat, lon] = query.near.split(",").map(Number);
      rows = rows.
      map((h) => ({ ...h, km: +distanceKm(lat, lon, h.lat, h.lon).toFixed(1) })).
      sort((a, b) => a.km - b.km);
    }
    return { hospitals: rows, can_edit: s.role !== "RESIDENT", scope: { country: s.country, district: s.district } };
  });

  const hospitalWrite = (ctx, body, existing) => {
    const s = me(ctx);
    if (s.role === "RESIDENT") fail(403, "Residents cannot change hospital records.");
    const name = String(body.name || existing?.name || "").trim();
    if (name.length < 3) fail(400, "A hospital needs a name.");
    const phone = String(body.phone ?? existing?.phone ?? "").trim();
    if (phone && !/^[+0-9 ()\-]{6,20}$/.test(phone)) fail(400, "That contact number does not look right.");
    const lat = Number(body.lat ?? existing?.lat);
    const lon = Number(body.lon ?? existing?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) fail(400, "A hospital needs a location on the map.");
    const place = placeOf(lat, lon, body.country || existing?.country || ctx.user.country, body.district || existing?.district || ctx.user.district);
    if (!place.district) {
      fail(400, "The pin is outside the selected area. Move it inside the selected boundary.");
    }
    const district = String(body.district || existing?.district || place.district || "").trim();
    const country = String(body.country || existing?.country || place.country || "").trim();
    if (s.role === "REGIONAL_ADMIN" && country && country !== s.country) {
      fail(403, "You can only add hospitals inside your own country.");
    }
    if (existing && !s.sees(existing)) fail(403, "That hospital is outside your area.");
    return {
      name, phone, lat, lon, district, country,
      address: String(body.address ?? existing?.address ?? "").slice(0, 200),
      services: Array.isArray(body.services) ? body.services.slice(0, 8).map(String) : existing?.services || ["Emergency"],
      notes: String(body.notes ?? existing?.notes ?? "").slice(0, 400),
      updated_at: iso()
    };
  };

  route("POST", "/api/hospitals", ({ ctx, body }) => {
    const rec = hospitalWrite(ctx, body, null);
    const h = { id: "HSP-" + nextCounter("hospital"), ...rec };
    D().hospitals.push(h);
    audit(ctx.user.email, "hospital.create", h.name);
    push("hospital", "Hospital added", `${h.name} — ${h.district || "unassigned area"}`, h, "info");
    save();
    broadcast({ type: "hospitals", data: { action: "created", hospital: h } });
    return { ok: true, hospital: h };
  });

  route("POST", "/api/hospitals/:id", ({ ctx, params, body }) => {
    const h = D().hospitals.find((x) => x.id === params.id);
    if (!h) fail(404, "No such hospital.");
    Object.assign(h, hospitalWrite(ctx, body, h));
    audit(ctx.user.email, "hospital.update", h.name);
    save();
    broadcast({ type: "hospitals", data: { action: "updated", hospital: h } });
    return { ok: true, hospital: h };
  });

  route("DELETE", "/api/hospitals/:id", ({ ctx, params }) => {
    const s = me(ctx);
    if (s.role !== "SUPER_ADMIN") fail(403, "Only a super administrator can remove a hospital.");
    const h = D().hospitals.find((x) => x.id === params.id);
    if (!h) fail(404, "No such hospital.");
    D().hospitals = D().hospitals.filter((x) => x.id !== params.id);
    audit(ctx.user.email, "hospital.delete", h.name);
    save();
    broadcast({ type: "hospitals", data: { action: "deleted", id: params.id } });
    return { ok: true };
  });


  route("GET", "/api/routes", ({ ctx, query }) => {
    const s = me(ctx);
    let rows = s.filter(D().routes);
    if (query.audience) rows = rows.filter((r) => r.audience === "BOTH" || r.audience === query.audience);
    return { routes: rows, can_edit: s.role !== "RESIDENT" };
  });

  route("POST", "/api/routes", ({ ctx, body }) => {
    const s = me(ctx);
    if (s.role === "RESIDENT") fail(403, "Only administrators manage evacuation routes.");
    const title = String(body.title || "").trim();
    if (title.length < 4) fail(400, "Give the route a title.");
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) fail(400, "A route needs a starting point on the map.");
    const place = placeOf(lat, lon, body.country || ctx.user.country, body.district || ctx.user.district);
    if (!place.district) fail(400, "The pin is outside the selected area. Move it inside the selected boundary.");
    const country = String(body.country || place.country || "").trim();
    if (s.role === "REGIONAL_ADMIN" && country !== s.country) fail(403, "Routes can only be added inside your own country.");
    const rec = {
      id: "RTE-" + nextCounter("route"),
      title,
      district: String(body.district || place.district || ""),
      country,
      status: ["SAFE", "BLOCKED", "UNVERIFIED"].includes(body.status) ? body.status : "UNVERIFIED",
      lat, lon,
      notes: String(body.notes || "").slice(0, 400),
      audience: ["BOTH", "RESIDENTS", "FIREFIGHTERS"].includes(body.audience) ? body.audience : "BOTH",
      updated_at: iso()
    };
    D().routes.push(rec);
    audit(ctx.user.email, "route.create", title);
    push("route", "Evacuation route published", `${title} — ${rec.district || "unassigned area"}`, rec, "info");
    save();
    broadcast({ type: "routes", data: { action: "created", route: rec } });
    return { ok: true, route: rec };
  });

  route("POST", "/api/routes/:id/status", ({ ctx, params, body }) => {
    const s = me(ctx);
    if (s.role === "RESIDENT") fail(403, "Only administrators can change a route.");
    const r = D().routes.find((x) => x.id === params.id);
    if (!r) fail(404, "No such route.");
    if (!s.sees(r)) fail(403, "That route is outside your area.");
    const status = String(body.status || "").toUpperCase();
    if (!["SAFE", "BLOCKED", "UNVERIFIED"].includes(status)) fail(400, "Unknown route status.");
    r.status = status;
    if (body.notes !== undefined) r.notes = String(body.notes).slice(0, 400);
    r.updated_at = iso();
    audit(ctx.user.email, "route.status", `${r.id} -> ${status}`);
    push("route", `Route marked ${status.toLowerCase()}`, `${r.title} — ${r.district || "unassigned area"}`, r, status === "BLOCKED" ? "high" : "info");
    save();
    broadcast({ type: "routes", data: { action: "status", route: r } });
    return { ok: true, route: r };
  });


  route("GET", "/api/alerts", ({ ctx, query }) => {
    const s = me(ctx);
    let rows = s.filter(D().alerts);
    if (query.active === "1") rows = rows.filter((a) => a.active);
    return { alerts: rows, can_publish: s.role !== "RESIDENT" };
  });

  route("POST", "/api/alerts", ({ ctx, body }) => {
    const s = me(ctx);
    if (s.role === "RESIDENT") fail(403, "Only administrators can publish an alert.");
    const title = String(body.title || "").trim();
    const text = String(body.body || "").trim();
    if (title.length < 4) fail(400, "Give the alert a title.");
    if (text.length < 8) fail(400, "Write what people should do.");
    const district = String(body.district || (s.role === "REGIONAL_ADMIN" ? s.district : "") || "").trim();
    const place = DISTRICTS.find((d) => d.district === district);
    if (!place) fail(400, "Choose a district for the alert.");
    if (s.role === "REGIONAL_ADMIN" && place.country !== s.country) fail(403, "Alerts can only be published inside your own country.");
    const a = {
      id: "ALR-" + nextCounter("alert"),
      title,
      body: text.slice(0, 600),
      level: ["HIGH", "MEDIUM", "INFO"].includes(body.level) ? body.level : "MEDIUM",
      district,
      country: place.country,
      active: true,
      created_at: iso(),
      created_by: ctx.user.email
    };
    D().alerts.unshift(a);
    audit(ctx.user.email, "alert.publish", `${a.id} · ${district}`);
    push("alert", a.title, a.body, a, a.level === "HIGH" ? "high" : "info");
    save();
    broadcast({ type: "alerts", data: { action: "created", alert: a } });
    return { ok: true, alert: a };
  });

  route("POST", "/api/alerts/:id/active", ({ ctx, params, body }) => {
    const s = me(ctx);
    if (s.role === "RESIDENT") fail(403, "Only administrators can change an alert.");
    const a = D().alerts.find((x) => x.id === params.id);
    if (!a) fail(404, "No such alert.");
    if (!s.sees(a)) fail(403, "That alert is outside your area.");
    a.active = !!body.active;
    audit(ctx.user.email, "alert.active", `${a.id} -> ${a.active}`);
    save();
    broadcast({ type: "alerts", data: { action: "active", alert: a } });
    return { ok: true, alert: a };
  });


  route("GET", "/api/properties", ({ ctx }) => {


    const s = me(ctx);
    const mine = D().properties.filter((p) => p.owner === ctx.user.id);
    const counts = {};
    if (s.role !== "RESIDENT") {
      s.filter(D().properties).forEach((p) => {counts[p.district] = (counts[p.district] || 0) + 1;});
    }
    return {
      properties: mine,
      summary_by_district: Object.entries(counts).map(([district, count]) => ({ district, count })),
      note: "Exact coordinates are visible to the owner only."
    };
  });

  const propertyWrite = (ctx, body, existing) => {
    const name = String(body.name || "").trim();
    if (name.length < 2) fail(400, "Give the property a name.");
    const type = String(body.type || "HOME").toUpperCase();
    if (!PROPERTY_TYPES.includes(type)) fail(400, "Unknown property type.");
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) fail(400, "Choose the property location on the map.");
    const place = placeOf(lat, lon, body.country || existing?.country || ctx.user.country, body.district || existing?.district || ctx.user.district);
    if (!place.district) {
      fail(400, "The pin is outside the selected area. Move it inside the selected boundary.");
    }
    return {
      name, type, lat, lon,
      district: String(body.district || place.district || existing?.district || ""),
      country: String(body.country || place.country || existing?.country || ""),
      address: String(body.address || "").slice(0, 200),
      notes: String(body.notes || "").slice(0, 300)
    };
  };

  route("POST", "/api/properties", ({ ctx, body }) => {
    me(ctx);
    const rec = propertyWrite(ctx, body, null);
    const p = { id: "PRP-" + nextCounter("property"), owner: ctx.user.id, ...rec, created_at: iso() };
    D().properties.push(p);
    audit(ctx.user.email, "property.create", p.name);
    save();
    broadcast({ type: "properties", data: {} });
    return { ok: true, property: p };
  });

  route("POST", "/api/properties/:id", ({ ctx, params, body }) => {
    me(ctx);
    const p = D().properties.find((x) => x.id === params.id);
    if (!p) fail(404, "No such property.");
    if (p.owner !== ctx.user.id) fail(403, "That property belongs to somebody else.");
    Object.assign(p, propertyWrite(ctx, body, p));
    audit(ctx.user.email, "property.update", p.name);
    save();
    return { ok: true, property: p };
  });

  route("DELETE", "/api/properties/:id", ({ ctx, params }) => {
    me(ctx);
    const p = D().properties.find((x) => x.id === params.id);
    if (!p) fail(404, "No such property.");
    if (p.owner !== ctx.user.id) fail(403, "That property belongs to somebody else.");
    D().properties = D().properties.filter((x) => x.id !== params.id);
    audit(ctx.user.email, "property.delete", p.name);
    save();
    return { ok: true };
  });


  route("GET", "/api/notifications", ({ ctx }) => {
    const s = me(ctx);
    const read = D().read[ctx.user.id] || [];
    const rows = D().events.
    filter((e) => {
      if (s.role === "SUPER_ADMIN") return true;
      if (s.role === "REGIONAL_ADMIN") return e.country === s.country;
      return e.district === s.district;
    }).
    slice(0, 60).
    map((e) => ({ ...e, read: read.includes(e.id) }));
    return { notifications: rows, unread: rows.filter((r) => !r.read).length };
  });

  route("POST", "/api/notifications/read", ({ ctx, body }) => {
    me(ctx);
    const list = D().read[ctx.user.id] || [];
    if (body.all) {
      const s = me(ctx);
      D().events.forEach((e) => {
        const ok = s.role === "SUPER_ADMIN" || (s.role === "REGIONAL_ADMIN" ? e.country === s.country : e.district === s.district);
        if (ok && !list.includes(e.id)) list.push(e.id);
      });
    } else if (Array.isArray(body.ids)) {
      body.ids.forEach((id) => {if (!list.includes(id)) list.push(id);});
    }
    D().read[ctx.user.id] = list.slice(-500);
    save();
    return { ok: true };
  });


  route("GET", "/api/me/capabilities", ({ ctx }) => {
    const s = me(ctx);
    return {
      role: s.role,
      role_label: ROLES[s.role],
      scope: { all: s.all, country: s.country, district: s.district },
      can: {
        view_all_regions: s.role === "SUPER_ADMIN",
        manage_users: s.role === "SUPER_ADMIN",
        manage_admins: s.role === "SUPER_ADMIN",
        manage_hospitals: s.role !== "RESIDENT",
        manage_routes: s.role !== "RESIDENT",
        publish_alerts: s.role !== "RESIDENT",
        review_incidents: s.role !== "RESIDENT",
        report_fire: true,
        register_property: true,
        view_analytics: s.role === "SUPER_ADMIN"
      },
      places: PLACES.map((p) => ({ country: p.country, districts: p.districts })),
      map_places: mapPlaces,
      country_bbox: reference.country_bbox
    };
  });

  route("POST", "/api/me/place-check", ({ ctx, body }) => {
    const s = me(ctx);
    const country = String(body.country || ctx.user.country || "");
    const district = String(body.district || ctx.user.district || "");
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    if (!country || !district) {
      return { valid: false, message: "Choose a covered country and district before placing the pin." };
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { valid: false, message: "Choose a valid point on the map." };
    }
    const place = placeOf(lat, lon, country, district);
    if (!place.district) {
      return { valid: false, message: `That point is outside the selected ${district} boundary. Move the pin inside the district.` };
    }
    if (s.role === "RESIDENT" && (place.country !== s.country || place.district !== s.district)) {
      return { valid: false, message: "A pin must be inside your own district." };
    }
    if (s.role === "REGIONAL_ADMIN" && place.country !== s.country) {
      return { valid: false, message: "You can only place pins inside your own country." };
    }
    return { valid: true };
  }, { auth: true });
}
