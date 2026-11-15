"use client";










import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useApi, useAction } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { Card, Chip, Drawer, ErrorBox, Empty, Field, Kpi, Loading, Note, PageHead, KV } from "@/components/ui";
import CivicMap, { MapPoint, scopeCenterFor } from "@/components/civic-map";
import {
  ALERT_TONE, INCIDENT_STATUS, PROPERTY_LABEL, ROLE_LABEL, ROUTE_LABEL, ROUTE_TONE,
  STATUS_LABEL, STATUS_TONE, ago, useCaps, useLive } from
"@/lib/civic";

const km = (v?: number | null) => v === null || v === undefined ? "—" : v.toFixed(1) + " km";
const place = (r: any) => [r?.district, r?.country].filter(Boolean).join(" · ") || "—";

const statusChip = (s: string) => <Chip code={STATUS_LABEL[s] || s} color={STATUS_TONE[s] || "var(--muted)"} />;

type PlaceCheck = {valid: boolean;message?: string;};

const checkPlace = (lat: number, lon: number, country: string, district: string) =>
  api.post<PlaceCheck>("/api/me/place-check", { lat, lon, country, district });

function ScopeNote({ caps }: {caps: ReturnType<typeof useCaps>;}) {
  if (!caps) return null;
  const where = caps.scope.all ?
  "every country on the platform" :
  caps.scope.district ?
  `${caps.scope.district} district, ${caps.scope.country}` :
  caps.scope.country || "—";
  return (
    <Note kind="info">
      You are signed in as <strong>{ROLE_LABEL[caps.role] ?? caps.role_label}</strong>. Every list on this
      page is filtered by the server to <strong>{where}</strong>.
    </Note>);

}




export function CivicDashboard() {
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = useApi<any>("/api/dashboard");
  const caps = useCaps();
  useLive(() => setNonce((n) => n + 1), ["incidents", "alerts", "hospitals", "routes"]);
  useEffect(() => {if (nonce) setNonce((n) => n);}, [nonce]);

  if (loading && !data) return <Loading text="Loading your dashboard…" />;
  if (error) return <ErrorBox error={error} onRetry={() => setNonce((n) => n + 1)} />;
  if (!data) return null;

  const role = data.role;
  const points: MapPoint[] = (data.recent || []).map((i: any) => ({
    id: i.id, lat: i.lat, lon: i.lon, label: i.title, tone: STATUS_TONE[i.status], kind: "incident",
    sub: STATUS_LABEL[i.status]
  }));

  return (
    <div>
      <PageHead
        title={role === "SUPER_ADMIN" ? "Platform overview" : role === "REGIONAL_ADMIN" ? `${data.scope.country} overview` : `${data.scope.district} — your area`}
        subtitle="Live counts from the server, scoped to exactly the area your account is responsible for."
        right={
        <>
            <Link className="btn btn-primary" href="/report">Report a fire</Link>
            <Link className="btn" href="/alerts">Stay Alert</Link>
          </>
        } />
      

      <div className="grid" style={{ gap: 16 }}>
        <ScopeNote caps={caps} />

        <div className="kpi-grid civic-kpis">
          <Kpi label="Incidents in scope" value={data.incidents} tag="OBS"
          note={`${data.by_status.find((s: any) => s.code === "PENDING")?.count ?? 0} pending review`} />
          <Kpi label="Active alerts" value={data.active_alerts} tag="OBS" note="Published and still in force" />
          <Kpi label="Hospitals" value={data.hospitals} tag="OBS" note="With emergency cover in this area" />
          <Kpi label="Evacuation routes" value={data.routes} tag="OBS"
          note={`${data.routes_blocked} marked blocked`} />
          {role !== "RESIDENT" ?
          <Kpi label="Accounts in scope" value={data.users} tag="REC"
          note={`${data.residents} residents · ${data.pending_users ?? 0} waiting approval`} /> :

          <Kpi label="My properties" value={data.properties} tag="REC" note="Private to your account" />
          }
          {role === "SUPER_ADMIN" ?
          <Kpi label="Registered properties" value={data.properties} tag="REC"
          note="Across all regions — locations never leave the owner's account" /> :
          null}
        </div>

        <div className="civic-two">
          <Card title="Recent incidents" subtitle="Newest first, inside your area">
            {data.recent?.length ?
            <ul className="civic-list">
                {data.recent.map((i: any) =>
              <li key={i.id}>
                    <div className="civic-list-main">
                      <Link href={"/incidents?focus=" + i.id} className="civic-link">{i.title}</Link>
                      <span className="civic-sub">{i.id} · {place(i)} · {ago(i.at)}</span>
                    </div>
                    {statusChip(i.status)}
                  </li>
              )}
              </ul> :
            <Empty title="Nothing reported here" text="No incidents have been filed in your area yet." />}
          </Card>

          <Card title="Map" subtitle="Coordinate plot of the incidents above">
            <CivicMap points={points} height={260} caption="Recent incidents in your scope" />
          </Card>
        </div>

        {role === "RESIDENT" ?
        <div className="civic-two">
            <Card title="Hospitals nearest your property" subtitle="Distance measured from your registered home">
              {data.nearby_hospitals?.length ?
            <ul className="civic-list">
                  {data.nearby_hospitals.map((h: any) =>
              <li key={h.id}>
                      <div className="civic-list-main">
                        <span className="civic-link">{h.name}</span>
                        <span className="civic-sub">{h.address || h.district} · {h.phone || "no number listed"}</span>
                      </div>
                      <span className="civic-km">{km(h.km)}</span>
                    </li>
              )}
                </ul> :
            <Empty title="No hospital listed here" text="Ask your regional administrator to add one." />}
            </Card>
            <Card title="Incidents near your properties" subtitle="Within 25 km of each registered location">
              {data.my_properties?.length ?
            <ul className="civic-list">
                  {data.my_properties.map((p: any) =>
              <li key={p.id}>
                      <div className="civic-list-main">
                        <span className="civic-link">{p.name}</span>
                        <span className="civic-sub">{PROPERTY_LABEL[p.type] || p.type}</span>
                      </div>
                      <span className="civic-km">{p.incidents_near} nearby</span>
                    </li>
              )}
                </ul> :
            <Empty title="No property registered" text="Register your home or farm to get local counts." />}
              <div style={{ marginTop: 12 }}><Link className="btn btn-sm" href="/properties">Manage properties</Link></div>
            </Card>
          </div> :
        null}

        {role === "SUPER_ADMIN" ?
        <Card title="By country" subtitle="Incidents, hospitals and accounts on the platform">
            <div className="civic-table-wrap">
              <table className="civic-table">
                <thead><tr><th>Country</th><th>Incidents</th><th>Hospitals</th><th>Accounts</th></tr></thead>
                <tbody>
                  {(data.countries || []).map((c: any) =>
                <tr key={c.country}>
                      <td><strong>{c.country}</strong></td>
                      <td>{c.incidents}</td><td>{c.hospitals}</td><td>{c.users}</td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </Card> :
        null}

        <Card title="Status breakdown" subtitle="Every incident in scope, by review state">
          <div className="civic-bars">
            {data.by_status.map((s: any) => {
              const pct = data.incidents ? s.count / data.incidents * 100 : 0;
              return (
                <div className="civic-bar-row" key={s.code}>
                  <span className="civic-bar-label">{STATUS_LABEL[s.code]}</span>
                  <span className="civic-bar-track">
                    <span className="civic-bar-fill" style={{ width: pct + "%", background: STATUS_TONE[s.code] }} />
                  </span>
                  <span className="civic-bar-num">{s.count}</span>
                </div>);

            })}
          </div>
          <Note>Shares are only shown when the total is known — here <strong>{data.incidents}</strong> incidents are in scope.</Note>
        </Card>
      </div>
    </div>);

}




export function ReportFirePage() {
  const caps = useCaps();
  const { run, busy } = useAction();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pin, setPin] = useState<{lat: number;lon: number;} | null>(null);
  const [coordinateDraft, setCoordinateDraft] = useState({ lat: "", lon: "" });
  const [gps, setGps] = useState<string>("");
  const [done, setDone] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [checkingPin, setCheckingPin] = useState(false);
  const [chosenPlace, setChosenPlace] = useState({ country: "", district: "" });
  const [locationError, setLocationError] = useState<string | null>(null);
  const pinRequest = useRef(0);
  const gpsRequest = useRef(0);
  const reportCountry = chosenPlace.country || caps?.scope.country || "";
  const reportDistrict = chosenPlace.district || caps?.scope.district || "";
  const countryIsCovered = !!caps?.places.some((place) => place.country === reportCountry);
  const mapCenter = countryIsCovered ?
    scopeCenterFor(reportCountry, reportDistrict) :
    scopeCenterFor("Sri Lanka");
  const countryBounds = caps?.country_bbox?.[reportCountry];
  const supportedPlace = !!countryBounds && !!reportDistrict &&
    !!caps?.places.some((place) => place.country === reportCountry && place.districts.includes(reportDistrict));

  const selectLocation = async (lat: number, lon: number, fromGps = false) => {
    if (!fromGps) {
      gpsRequest.current += 1;
      setChecking(false);
    }
    if (!supportedPlace) {
      setLocationError("Choose a covered country and district before placing the pin.");
      return false;
    }
    setCoordinateDraft({ lat: lat.toFixed(5), lon: lon.toFixed(5) });
    setPin(null);
    const request = ++pinRequest.current;
    setCheckingPin(true);
    setLocationError(null);
    try {
      const result = await checkPlace(lat, lon, reportCountry, reportDistrict);
      if (request !== pinRequest.current) return false;
      if (!result.valid) {
        setPin(null);
        setLocationError(result.message || `That point is outside the selected ${reportDistrict} boundary.`);
        return false;
      }
      setPin({ lat, lon });
      return true;
    } catch (error) {
      if (request === pinRequest.current) {
        setPin(null);
        setLocationError(error instanceof Error ? `Could not verify this point: ${error.message}` : "Could not verify this point. Try again.");
      }
      return false;
    } finally {
      if (request === pinRequest.current) setCheckingPin(false);
    }
  };

  const changePlace = (place: {country: string;district: string;}) => {
    pinRequest.current += 1;
    gpsRequest.current += 1;
    setChecking(false);
    setCheckingPin(false);
    setChosenPlace(place);
    setPin(null);
    setCoordinateDraft({ lat: "", lon: "" });
    setGps("");
    setLocationError(null);
  };

  const updateCoordinateDraft = (axis: "lat" | "lon", value: string) => {
    pinRequest.current += 1;
    gpsRequest.current += 1;
    setChecking(false);
    setCheckingPin(false);
    setPin(null);
    setLocationError(null);
    setCoordinateDraft((current) => ({ ...current, [axis]: value }));
  };

  const checkCoordinateDraft = () => {
    if (!coordinateDraft.lat.trim() || !coordinateDraft.lon.trim()) {
      setLocationError("Enter both coordinates before checking the location.");
      return;
    }
    const lat = Number(coordinateDraft.lat);
    const lon = Number(coordinateDraft.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setLocationError("Enter a valid latitude and longitude.");
      return;
    }
    void selectLocation(lat, lon);
  };

  const readFile = (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return run(async () => {throw new Error("Choose a JPEG, PNG or WebP photo.");});
    if (file.size > 3 * 1024 * 1024) return run(async () => {throw new Error("That photo is larger than 3 MB.");});
    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setPhotoError("The selected photo could not be read. Choose it again or try another image.");
        return;
      }
      setPhoto(reader.result);
    };
    reader.onerror = () => setPhotoError("The selected photo could not be read. Choose it again or try another image.");
    reader.readAsDataURL(file);
  };

  const locate = () => {
    if (!supportedPlace) {
      setLocationError("Choose a covered country and district before using your location.");
      return;
    }
    if (!navigator.geolocation) {setGps("This browser has no location service.");return;}
    const request = ++gpsRequest.current;
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (request !== gpsRequest.current) return;
        const p = { lat: +pos.coords.latitude.toFixed(5), lon: +pos.coords.longitude.toFixed(5) };
        const selected = await selectLocation(p.lat, p.lon, true);
        if (request !== gpsRequest.current) return;
        setGps(selected ? `Device position ±${Math.round(pos.coords.accuracy)} m` : "Device position could not be verified inside the selected district.");
        setChecking(false);
      },
      (err) => {
        if (request === gpsRequest.current) {
          setGps(err.message || "Location was refused — place the pin by hand.");
          setChecking(false);
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pinReady = !!pin && supportedPlace && Number.isFinite(pin.lat) && Number.isFinite(pin.lon) &&
    Math.abs(pin.lat) <= 90 && Math.abs(pin.lon) <= 180;

  const submit = () =>
  run(
    () => api.post("/api/incidents", {
      title, description, photo, lat: pin?.lat, lon: pin?.lon, country: chosenPlace.country || caps?.scope.country, district: chosenPlace.district || caps?.scope.district
    }),
    {
      success: "Report filed — it is waiting for review.",
      then: (r: any) => {setDone(r.incident);setTitle("");setDescription("");setPhoto(null);}
    }
  );

  return (
    <div>
      <PageHead
        title="Report a fire"
        subtitle="Photo, location and a short description. Your report is filed as pending — a duty officer verifies it before anyone is told it is a fire."
        right={<Link className="btn" href="/incidents">Track my reports</Link>} />
      
      <div className="grid" style={{ gap: 16 }}>
        <ScopeNote caps={caps} />
        {done ?
        <Card title={"Report " + done.id + " received"} subtitle="Track it from the incidents page">
            <Note kind="ok">
              Filed as <strong>{STATUS_LABEL[done.status]}</strong> in {place(done)}. Nothing is described as a
              confirmed fire until a duty officer verifies it.
            </Note>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Link className="btn btn-sm" href="/incidents">See my reports</Link>
              <button className="btn btn-sm btn-ghost" onClick={() => setDone(null)}>Report another</button>
            </div>
          </Card> :
        null}

        <div className="civic-two">
          <Card title="What you saw" subtitle="Plain description — no need to judge whether it is a fire">
            <div className="grid" style={{ gap: 12 }}>
              <DistrictPicker caps={caps} value={chosenPlace} onChange={changePlace} />
                  <Field label="Title">
                <input className="input" value={title} maxLength={80}
                onChange={(e) => setTitle(e.target.value)} placeholder="Smoke above the shops on Galle Road" />
              </Field>
              <Field label="Description" hint="What is burning, how big, which direction the smoke is moving.">
                <textarea className="input civic-textarea" value={description} maxLength={1200}
                onChange={(e) => setDescription(e.target.value)} rows={4} />
              </Field>
              <Field label="Photo" hint="JPEG, PNG or WebP · up to 3 MB. Taken on a phone is fine.">
                <div className="civic-photo-row">
                  <label className="btn btn-sm civic-file">
                    Choose photo
                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
                    onChange={(e) => {const f = e.target.files?.[0];if (f) readFile(f);e.target.value = "";}} hidden />
                  </label>
                  {photo ?
                  <>
                      {}
                      <img src={photo} alt="Selected report photo" className="civic-thumb" />
                      <button className="btn btn-sm btn-ghost" onClick={() => setPhoto(null)}>Remove</button>
                    </> :
                  <span className="civic-sub">No photo attached</span>}
                </div>
                {photoError ? <Note kind="bad">{photoError}</Note> : null}
              </Field>
            </div>
          </Card>

          <Card title="Where it is" subtitle="Use the device position, then fine-tune on the map"
          right={<button className="btn btn-sm" onClick={locate} disabled={!supportedPlace || checking || checkingPin}>{checking ? "Locating…" : checkingPin ? "Checking…" : "Use my location"}</button>}>
            <CivicMap
              points={[]}
              picked={pinReady ? pin : null}
              center={pinReady ? pin : mapCenter}
              spanKm={60}
              height={280}
              onPick={supportedPlace ? (lat, lon) => {void selectLocation(lat, lon);} : undefined}
              caption={checkingPin ? "Checking selected district boundary…" : pinReady ? `Pin at ${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}` :
                supportedPlace ? `${reportDistrict} · click the map to place the pin` : "Choose a covered district first"} />
            
            <div className="civic-coord-row">
              <Field label="Latitude"><input className="input" value={coordinateDraft.lat} onChange={(e) => updateCoordinateDraft("lat", e.target.value)} /></Field>
              <Field label="Longitude"><input className="input" value={coordinateDraft.lon} onChange={(e) => updateCoordinateDraft("lon", e.target.value)} /></Field>
            </div>
            <button type="button" className="btn btn-sm" onClick={checkCoordinateDraft}
              disabled={!supportedPlace || checkingPin || !coordinateDraft.lat || !coordinateDraft.lon}>Check coordinates</button>
            {!supportedPlace ?
              <Note kind="info">Select a supported district first. The pin must be inside that district's boundary.</Note> :
              checkingPin ?
                <Note kind="info">Checking the point against the selected district boundary…</Note> :
                locationError ?
                  <Note kind="bad">{locationError}</Note> :
                  pinReady ?
                    <Note kind="ok">The point is inside {reportDistrict}. Boundary data: GeoBoundaries.</Note> :
                    <Note kind="info">Click inside {reportDistrict} to place a pin. The point is checked against its boundary.</Note>}
            {gps ? <Note kind={pin ? "ok" : "warn"}>{gps}</Note> : null}
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy || !pinReady || title.trim().length < 4}
              onClick={submit}>{busy ? "Filing…" : "File the report"}</button>
              {!pinReady ? <span className="civic-sub" style={{ display: "block", marginTop: 8 }}>
                {supportedPlace ? "Place and verify a pin inside the selected district using the map, coordinates, or device location." : "Choose a supported country and district before placing a pin."}
              </span> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>);

}




export function IncidentsPage() {
  const caps = useCaps();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<any>(null);
  const [nonce, setNonce] = useState(0);
  const { data, error, loading, reload } = useApi<any>("/api/incidents");
  const { run, busy } = useAction();
  useLive(() => reload(), ["incidents"]);

  const rows = useMemo(() => {
    const list = (data?.incidents || []) as any[];
    return list.filter((i) =>
    (!status || i.status === status) && (
    !q || [i.title, i.id, i.district, i.reporter_name].join(" ").toLowerCase().includes(q.toLowerCase()))
    );
  }, [data, status, q]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    (data?.incidents || []).forEach((i: any) => {out[i.status] = (out[i.status] || 0) + 1;});
    return out;
  }, [data]);

  const setStatusOf = (inc: any, next: string) =>
  run(() => api.post(`/api/incidents/${inc.id}/status`, { status: next }), {
    success: `${inc.id} is now ${STATUS_LABEL[next].toLowerCase()}.`,
    then: (r: any) => {setOpen(r.incident);reload();}
  });

  const canReview = caps?.can.review_incidents;

  return (
    <div>
      <PageHead
        title="Incidents"
        subtitle="Every report inside your area, with the review state it has actually reached. Unverified reports are described as candidate events, never as confirmed fires."
        right={<Link className="btn btn-primary" href="/report">Report a fire</Link>} />
      
      <div className="grid" style={{ gap: 16 }}>
        <ScopeNote caps={caps} />

        <div className="civic-filters">
          <button className={"civic-pill" + (status === "" ? " on" : "")} onClick={() => setStatus("")}>
            All <span>{data?.incidents?.length ?? 0}</span>
          </button>
          {INCIDENT_STATUS.map((s) =>
          <button key={s} className={"civic-pill" + (status === s ? " on" : "")} onClick={() => setStatus(s)}>
              <i style={{ background: STATUS_TONE[s] }} />{STATUS_LABEL[s]} <span>{counts[s] || 0}</span>
            </button>
          )}
          <input className="input civic-search" placeholder="Search title, id, district…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={() => setNonce((n) => n + 1)} /> :
        <Card pad={false}>
            <div className="civic-table-wrap">
              <table className="civic-table">
                <thead>
                  <tr><th>Report</th><th>Area</th><th>Status</th><th>Reported by</th><th>When</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((i) =>
                <tr key={i.id}>
                      <td>
                        <button className="civic-link" onClick={() => setOpen(i)}>{i.title}</button>
                        <div className="civic-sub">{i.id}</div>
                      </td>
                      <td>{place(i)}</td>
                      <td>{statusChip(i.status)}</td>
                      <td>{i.reporter_name || "—"}</td>
                      <td>{ago(i.created_at)}</td>
                      <td><button className="btn btn-sm" onClick={() => setOpen(i)}>Open</button></td>
                    </tr>
                )}
                  {!rows.length ?
                <tr><td colSpan={6}><Empty title="No incidents match" text="Change the filter, or file the first report in this area." /></td></tr> :
                null}
                </tbody>
              </table>
            </div>
          </Card>
        }
      </div>

      {open ?
      <Drawer title={open.title} onClose={() => setOpen(null)} width={580}>
          <div className="civic-drawer-note">{open.id} · {place(open)} · filed {ago(open.created_at)}</div>
          <div className="civic-detail-chips">
            {statusChip(open.status)}
            <Chip code={"Reported by " + (open.reporter_name || "—")} color="var(--muted)" />
            {open.verified_by ? <Chip code={"Verified by " + open.verified_by} color="var(--ok)" /> : <Chip code="Unverified" color="var(--warn)" />}
          </div>
          <CivicMap
          points={[{ id: open.id, lat: open.lat, lon: open.lon, label: open.title, tone: STATUS_TONE[open.status], kind: "incident" }]}
          center={{ lat: open.lat, lon: open.lon }} spanKm={12} height={240} />
        
          {open.photo ?
        <div>
              <div className="civic-label">Photo</div>
              {}
              <img src={open.photo} alt={"Photo attached to " + open.id} className="civic-photo" />
            </div> :
        <Note>No photo was attached to this report.</Note>}
          <div>
            <div className="civic-label">Description</div>
            <p className="civic-body">{open.description || "No description was given."}</p>
          </div>
          <KV rows={[
        ["Coordinates", `${open.lat.toFixed(4)}, ${open.lon.toFixed(4)}`],
        ["Last update", ago(open.updated_at)],
        ["Severity", open.severity || "—"]]
        } />
          <div>
            <div className="civic-label">Review trail</div>
            <ul className="civic-trail">
              {(open.timeline || []).map((t: any, n: number) =>
            <li key={n}><i style={{ background: STATUS_TONE[t.status] || "var(--muted)" }} />
                  <span>{STATUS_LABEL[t.status] || t.status}</span>
                  <span className="civic-sub">{t.by} · {ago(t.at)}</span>
                </li>
            )}
            </ul>
          </div>
          {canReview ?
        <div>
              <div className="civic-label">Move this report to</div>
              <div className="civic-actions">
                {INCIDENT_STATUS.filter((s) => s !== open.status).map((s) =>
            <button key={s} className="btn btn-sm" disabled={busy} onClick={() => setStatusOf(open, s)}>
                    {STATUS_LABEL[s]}
                  </button>
            )}
              </div>
              <Note kind="warn">
                Marking a report <strong>Verified</strong> is a judgement that a fire is present. If the
                evidence is thin, leave it under review — unverified is not the same as false.
              </Note>
            </div> :

        <Note kind="info">Only administrators can change the review state. You can track this report here.</Note>
        }
        </Drawer> :
      null}
    </div>);

}




export function HospitalsPage() {
  const caps = useCaps();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>(null);
  const { data, error, loading, reload } = useApi<any>("/api/hospitals");
  const { run, busy } = useAction();
  useLive(() => reload(), ["hospitals"]);

  const rows = ((data?.hospitals || []) as any[]).filter((h) =>
  !q || [h.name, h.district, h.address, h.phone].join(" ").toLowerCase().includes(q.toLowerCase()));
  const formArea = form ? mapAreaFor(caps, form) : null;

  const save = () => run(
    () => form.id ? api.post(`/api/hospitals/${form.id}`, form) : api.post("/api/hospitals", form),
    { success: form.id ? "Hospital updated." : "Hospital added.", then: () => {setForm(null);reload();} }
  );
  const remove = (h: any) => run(() => api.delete(`/api/hospitals/${h.id}`), { success: h.name + " removed.", then: () => reload() });

  const points: MapPoint[] = rows.map((h) => ({
    id: h.id, lat: h.lat, lon: h.lon, label: h.name, tone: "var(--info)", kind: "hospital" as const,
    sub: h.phone
  }));

  return (
    <div>
      <PageHead
        title="Hospitals and emergency cover"
        subtitle="Facilities able to receive fire casualties. Residents see nearby names and numbers; administrators can add and update them inside their own area."
        right={data?.can_edit ? <button className="btn btn-primary" onClick={() => setForm({ name: "", phone: "", address: "", services: "", lat: null, lon: null })}>Add hospital</button> : null} />
      
      <div className="grid" style={{ gap: 16 }}>
        <ScopeNote caps={caps} />
        <div className="civic-filters">
          <input className="input civic-search" placeholder="Search name, district, service…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="civic-sub">{rows.length} in scope</span>
        </div>
        {loading && !data ? <Loading /> : error ? <ErrorBox error={error} /> :
        <div className="civic-two">
            <Card pad={false}>
              <div className="civic-table-wrap">
                <table className="civic-table">
                  <thead><tr><th>Hospital</th><th>Area</th><th>Contact</th>{data?.can_edit ? <th /> : null}</tr></thead>
                  <tbody>
                    {rows.map((h) =>
                  <tr key={h.id}>
                        <td><strong>{h.name}</strong><div className="civic-sub">{h.services?.join(" · ")}</div></td>
                        <td>{place(h)}<div className="civic-sub">{h.address}</div></td>
                        <td className="civic-mono">{h.phone || "—"}{h.km !== undefined ? <div className="civic-sub">{km(h.km)} away</div> : null}</td>
                        {data?.can_edit ?
                    <td>
                            <div className="civic-actions">
                              <button className="btn btn-sm" onClick={() => setForm({ ...h, services: (h.services || []).join(", ") })}>Edit</button>
                              {caps?.role === "SUPER_ADMIN" ? <button className="btn btn-sm btn-danger" onClick={() => remove(h)}>Delete</button> : null}
                            </div>
                          </td> :
                    null}
                      </tr>
                  )}
                    {!rows.length ? <tr><td colSpan={4}><Empty title="No hospital listed" text="Nothing matches this area or search." /></td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="Where they are" subtitle="Coordinate plot of the list">
              <CivicMap points={points} height={320} caption="Hospitals in your scope" />
            </Card>
          </div>
        }
      </div>

      {form ?
      <Drawer title={form.id ? "Edit " + form.name : "Add a hospital"} onClose={() => setForm(null)} width={520}>
          <div className="grid" style={{ gap: 12 }}>
            <DistrictPicker caps={caps} value={form} onChange={setForm} />
            <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Contact number" hint="Public emergency line for this facility."><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+94 11 234 5678" /></Field>
            <Field label="Address"><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Services" hint="Comma separated — burns unit, ICU, ambulance…"><input className="input" value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} /></Field>
            <Field label="Location" hint="Click the map to set the position.">
              <AreaLocationPicker caps={caps} value={form} onChange={setForm} spanKm={20} height={220}
                caption="Click to place the hospital" />
            </Field>
            <button className="btn btn-primary" disabled={busy || !form.name || !formArea?.supported || !formArea.withinCoverage} onClick={save}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add hospital"}
            </button>
          </div>
        </Drawer> :
      null}
    </div>);

}




export function RoutesPage() {
  const caps = useCaps();
  const [audience, setAudience] = useState("");
  const [form, setForm] = useState<any>(null);
  const { data, error, loading, reload } = useApi<any>("/api/routes");
  const { run, busy } = useAction();
  useLive(() => reload(), ["routes"]);
  const formArea = form ? mapAreaFor(caps, form) : null;

  const rows = ((data?.routes || []) as any[]).filter((r) => !audience || r.audience === "BOTH" || r.audience === audience);
  const points: MapPoint[] = rows.map((r) => ({
    id: r.id, lat: r.lat, lon: r.lon, label: r.title, tone: ROUTE_TONE[r.status], kind: "route" as const, sub: ROUTE_LABEL[r.status]
  }));

  const mark = (r: any, status: string) =>
  run(() => api.post(`/api/routes/${r.id}/status`, { status }), { success: `${r.title} marked ${ROUTE_LABEL[status].toLowerCase()}.`, then: () => reload() });

  const save = () => run(() => api.post("/api/routes", form), {
    success: "Route published.", then: () => {setForm(null);reload();}
  });

  return (
    <div>
      <PageHead
        title="Evacuation routes"
        subtitle="Which ways out are usable right now. A route is only called safe once an administrator says so — anything else is unverified."
        right={data?.can_edit ? <button className="btn btn-primary" onClick={() => setForm({ title: "", notes: "", audience: "BOTH", status: "UNVERIFIED", lat: null, lon: null })}>Add route</button> : null} />
      
      <div className="grid" style={{ gap: 16 }}>
        <ScopeNote caps={caps} />
        <div className="civic-filters">
          {["", "RESIDENTS", "FIREFIGHTERS"].map((a) =>
          <button key={a} className={"civic-pill" + (audience === a ? " on" : "")} onClick={() => setAudience(a)}>
              {a === "" ? "Everyone" : a === "RESIDENTS" ? "Residents" : "Firefighters"}
            </button>
          )}
        </div>
        {loading && !data ? <Loading /> : error ? <ErrorBox error={error} /> :
        <div className="civic-two">
            <Card title="Routes in scope" subtitle="Blocked routes are called out first">
              <ul className="civic-list">
                {rows.slice().sort((a, b) => a.status === "BLOCKED" ? -1 : 1).map((r) =>
              <li key={r.id}>
                    <div className="civic-list-main">
                      <span className="civic-link">{r.title}</span>
                      <span className="civic-sub">{place(r)} · for {r.audience === "BOTH" ? "everyone" : r.audience.toLowerCase()} · {ago(r.updated_at)}</span>
                      {r.notes ? <span className="civic-sub">{r.notes}</span> : null}
                    </div>
                    <div className="civic-route-side">
                      <Chip code={ROUTE_LABEL[r.status]} color={ROUTE_TONE[r.status]} />
                      {data?.can_edit ?
                  <div className="civic-actions">
                          {["SAFE", "BLOCKED", "UNVERIFIED"].filter((s) => s !== r.status).map((s) =>
                    <button key={s} className="btn btn-sm" disabled={busy} onClick={() => mark(r, s)}>{ROUTE_LABEL[s]}</button>
                    )}
                        </div> :
                  null}
                    </div>
                  </li>
              )}
                {!rows.length ? <Empty title="No routes published" text="Nothing is listed for this audience in your area." /> : null}
              </ul>
            </Card>
            <Card title="Route map" subtitle="Starting points of the routes above">
              <CivicMap points={points} height={320} caption="Evacuation routes in your scope" />
            </Card>
          </div>
        }
      </div>

      {form ?
      <Drawer title="Publish an evacuation route" onClose={() => setForm(null)} width={520}>
          <div className="grid" style={{ gap: 12 }}>
            <DistrictPicker caps={caps} value={form} onChange={setForm} />
            <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Via Kelani bridge to the north" /></Field>
            <Field label="Guidance" hint="Landmarks, where it leads, what to avoid."><textarea className="input civic-textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <Field label="Who is it for?">
              <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option value="BOTH">Everyone</option><option value="RESIDENTS">Residents</option><option value="FIREFIGHTERS">Firefighters</option>
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="UNVERIFIED">Not verified</option><option value="SAFE">Safe to use</option><option value="BLOCKED">Blocked</option>
              </select>
            </Field>
            <Field label="Starting point">
              <AreaLocationPicker caps={caps} value={form} onChange={setForm} spanKm={20} height={220}
                caption="Click to place the route start" />
            </Field>
            <button className="btn btn-primary" disabled={busy || !form.title || !formArea?.supported || !formArea.withinCoverage} onClick={save}>Publish route</button>
          </div>
        </Drawer> :
      null}
    </div>);

}




export function AlertsPage() {
  const caps = useCaps();
  const [form, setForm] = useState<any>(null);
  const alerts = useApi<any>("/api/alerts");
  const notes = useApi<any>("/api/notifications");
  const { run, busy } = useAction();
  useLive(() => {alerts.reload();notes.reload();}, ["alerts", "incidents", "hospitals", "routes"]);

  const rows = (alerts.data?.alerts || []) as any[];
  const feed = (notes.data?.notifications || []) as any[];

  const toggle = (a: any) =>
  run(() => api.post(`/api/alerts/${a.id}/active`, { active: !a.active }), {
    success: a.active ? "Alert withdrawn." : "Alert re-activated.", then: () => alerts.reload()
  });

  const publish = () => run(() => api.post("/api/alerts", form), {
    success: "Alert published to the residents of that district.",
    then: () => {setForm(null);alerts.reload();}
  });

  const markRead = () => run(() => api.post("/api/notifications/read", { all: true }), { success: "All caught up.", then: () => notes.reload() });

  return (
    <div>
      <PageHead
        title="Stay Alert"
        subtitle="Official notices for your area only. These are issued by regional administrators — nothing here is generated automatically."
        right={alerts.data?.can_publish ?
        <button className="btn btn-primary" onClick={() => setForm({ title: "", body: "", level: "MEDIUM", district: "" })}>Publish alert</button> :
        null} />
      
      <div className="grid" style={{ gap: 16 }}>
        <ScopeNote caps={caps} />

        {alerts.error ? <ErrorBox error={alerts.error} /> : alerts.loading && !alerts.data ? <Loading /> :
        <div className="civic-alert-grid">
            {rows.map((a) =>
          <article key={a.id} className={"civic-alert" + (a.active ? "" : " inactive")} style={{ ["--tone" as any]: ALERT_TONE[a.level] }}>
                <header>
                  <span className="civic-alert-level" style={{ color: ALERT_TONE[a.level] }}>{a.level}</span>
                  <span className="civic-sub">{place(a)} · {ago(a.created_at)}</span>
                </header>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
                <footer>
                  <span className="civic-sub">{a.active ? "In force" : "Withdrawn"} · {a.id}</span>
                  {alerts.data?.can_publish ?
              <button className="btn btn-sm" disabled={busy} onClick={() => toggle(a)}>{a.active ? "Withdraw" : "Re-activate"}</button> :
              null}
                </footer>
              </article>
          )}
            {!rows.length ? <Empty title="No alerts in force" text="Nothing has been published for your area." /> : null}
          </div>
        }

        <Card title="Your notifications" subtitle="Scoped to your district, or your country if you administer one"
        right={<button className="btn btn-sm" onClick={markRead} disabled={!notes.data?.unread}>Mark all read</button>}>
          {notes.loading && !notes.data ? <Loading /> :
          <ul className="civic-list">
              {feed.map((n) =>
            <li key={n.id} className={n.read ? "read" : ""}>
                  <div className="civic-list-main">
                    <span className="civic-link">{n.title}</span>
                    <span className="civic-sub">{n.body}</span>
                  </div>
                  <span className="civic-sub">{ago(n.created_at)}</span>
                </li>
            )}
              {!feed.length ? <Empty title="Nothing yet" text="Reports, route changes and alerts in your area will appear here." /> : null}
            </ul>
          }
        </Card>
      </div>

      {form ?
      <Drawer title="Publish a Stay Alert" onClose={() => setForm(null)} width={520}>
          <div className="grid" style={{ gap: 12 }}>
            <DistrictPicker caps={caps} value={form} onChange={setForm} />
            <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Evacuate the lane behind the market" /></Field>
            <Field label="What people should do"><textarea className="input civic-textarea" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <Field label="Level">
              <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                <option value="HIGH">High — act now</option><option value="MEDIUM">Medium — be ready</option><option value="INFO">Information only</option>
              </select>
            </Field>
            <Field label="District" hint={caps?.role === "REGIONAL_ADMIN" ? "Your own country only." : "Any district on the platform."}>
              <select className="input" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
                <option value="">Choose a district…</option>
                {(caps?.places || []).flatMap((p) => p.districts.map((d) =>
              <option key={p.country + d} value={d}>{d} — {p.country}</option>
              ))}
              </select>
            </Field>
            <button className="btn btn-primary" disabled={busy || !form.title || !form.district} onClick={publish}>Publish alert</button>
          </div>
        </Drawer> :
      null}
    </div>);

}




export function PropertiesPage() {
  const caps = useCaps();
  const { data, error, loading, reload } = useApi<any>("/api/properties");
  const [form, setForm] = useState<any>(null);
  const { run, busy } = useAction();
  useLive(() => reload(), ["properties"]);
  const formArea = form ? mapAreaFor(caps, form) : null;

  const rows = (data?.properties || []) as any[];
  const points: MapPoint[] = rows.map((p) => ({
    id: p.id, lat: p.lat, lon: p.lon, label: p.name, tone: "var(--violet)", kind: "property" as const, sub: PROPERTY_LABEL[p.type]
  }));

  const save = () => run(
    () => form.id ? api.post(`/api/properties/${form.id}`, form) : api.post("/api/properties", form),
    { success: form.id ? "Property updated." : "Property registered.", then: () => {setForm(null);reload();} }
  );
  const remove = (p: any) => run(() => api.delete(`/api/properties/${p.id}`), { success: p.name + " deleted.", then: () => reload() });

  return (
    <div>
      <PageHead
        title="My properties"
        subtitle="Homes and farms you want watched. The exact position is stored against your account and is never shown to other residents or to regional administrators."
        right={<button className="btn btn-primary" onClick={() => setForm({ name: "", type: "HOME", address: "", notes: "", lat: null, lon: null })}>Register a property</button>} />
      
      <div className="grid" style={{ gap: 16 }}>
        <Note kind="info">
          {data?.note || "Exact coordinates are visible to the owner only."} Administrators see a count per
          district — never a location, an address or a name.
        </Note>

        {loading && !data ? <Loading /> : error ? <ErrorBox error={error} /> :
        <div className="civic-two">
            <Card title="Registered" subtitle="Yours alone">
              <ul className="civic-list">
                {rows.map((p) =>
              <li key={p.id}>
                    <div className="civic-list-main">
                      <span className="civic-link">{p.name}</span>
                      <span className="civic-sub">{PROPERTY_LABEL[p.type]} · {place(p)} · <span className="civic-mono">{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</span></span>
                      {p.address ? <span className="civic-sub">{p.address}</span> : null}
                    </div>
                    <div className="civic-actions">
                      <button className="btn btn-sm" onClick={() => setForm({ ...p })}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Delete</button>
                    </div>
                  </li>
              )}
                {!rows.length ? <Empty title="No property yet" text="Register your home or farm to get incidents and hospitals counted against it." /> : null}
              </ul>
            </Card>
            <Card title="Private map" subtitle="Only you can see these pins">
              <CivicMap points={points} height={300} caption="Your properties" />
            </Card>
          </div>
        }

        {caps && caps.role !== "RESIDENT" && data?.summary_by_district?.length ?
        <Card title="What administrators can see" subtitle="Counts only — this is the entire disclosure">
            <div className="civic-table-wrap">
              <table className="civic-table">
                <thead><tr><th>District</th><th>Registered properties</th></tr></thead>
                <tbody>
                  {data.summary_by_district.map((s: any) =>
                <tr key={s.district}><td>{s.district}</td><td>{s.count}</td></tr>
                )}
                </tbody>
              </table>
            </div>
          </Card> :
        null}
      </div>

      {form ?
      <Drawer title={form.id ? "Edit " + form.name : "Register a property"} onClose={() => setForm(null)} width={520}>
          <div className="grid" style={{ gap: 12 }}>
            <DistrictPicker caps={caps} value={form} onChange={setForm} />
            <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Home — Colombo 05" /></Field>
            <Field label="Type">
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="HOME">Residential home</option><option value="FARM">Farm</option><option value="OTHER">Other property</option>
              </select>
            </Field>
            <Field label="Address" hint="Shown to you only."><input className="input" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Notes"><textarea className="input civic-textarea" rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <Field label="Location" hint="Click the map. This position never leaves your account.">
              <AreaLocationPicker caps={caps} value={form} onChange={setForm} spanKm={6} height={240}
                caption="Click to place your property" />
            </Field>
            <button className="btn btn-primary" disabled={busy || !form.name || !formArea?.supported || !formArea.withinCoverage} onClick={save}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Register property"}
            </button>
          </div>
        </Drawer> :
      null}
    </div>);

}




export function RegionsPage() {
  const caps = useCaps();
  const { data, error } = useApi<any>("/api/dashboard");
  if (!caps) return <Loading />;
  if (!caps.can.view_all_regions) {
    return (
      <div>
        <PageHead title="Countries and regions" subtitle="Platform-wide geography." />
        <Card><Empty title="Not available for your role"
          text={"Regions are managed centrally. You administer " + (caps.scope.country || "one country") + ", and the server will refuse anything outside it."} /></Card>
      </div>);

  }
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  return (
    <div>
      <PageHead title="Countries and regions" subtitle="Every region on the platform, with the load it is carrying. Adding a country is a platform-setting change." />
      <Card pad={false}>
        <div className="civic-table-wrap">
          <table className="civic-table">
            <thead><tr><th>Country</th><th>Incidents</th><th>Hospitals</th><th>Accounts</th><th>Coverage</th></tr></thead>
            <tbody>
              {(data.countries || []).map((c: any) =>
              <tr key={c.country}>
                  <td><strong>{c.country}</strong><div className="civic-sub">{(caps.places.find((p) => p.country === c.country)?.districts || []).join(", ")}</div></td>
                  <td>{c.incidents}</td><td>{c.hospitals}</td><td>{c.users}</td>
                  <td><div className="civic-bar-track" style={{ minWidth: 90 }}>
                    <div className="civic-bar-fill" style={{ width: Math.min(100, c.incidents * 12) + "%", background: "var(--accent)" }} />
                  </div></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>);

}

function mapAreaFor(caps: ReturnType<typeof useCaps>, value: any) {
  const country = value?.country || caps?.scope.country || "";
  const district = value?.district || caps?.scope.district || "";
  const supported = !!district &&
    !!caps?.places.some((place) => place.country === country && place.districts.includes(district));
  const lat = Number(value?.lat);
  const lon = Number(value?.lon);
  const hasLocation = value?.lat !== null && value?.lat !== undefined && value?.lat !== "" &&
    value?.lon !== null && value?.lon !== undefined && value?.lon !== "" &&
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const withinCoverage = !!supported && hasLocation && value?.boundary_verified === true;
  return {
    country,
    district,
    lat,
    lon,
    center: scopeCenterFor(country, district) ||
      scopeCenterFor(caps?.scope.country, caps?.scope.district) ||
      scopeCenterFor("Sri Lanka"),
    supported,
    hasLocation,
    withinCoverage
  };
}

function AreaLocationPicker({ caps, value, onChange, spanKm, height, caption }: {
  caps: ReturnType<typeof useCaps>;
  value: any;
  onChange: (value: any) => void;
  spanKm: number;
  height: number;
  caption: string;
}) {
  const area = mapAreaFor(caps, value);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const requestSequence = useRef(0);
  const boundaryVerified = value.boundary_verified === true;

  useEffect(() => {
    const request = ++requestSequence.current;
    setLocationError(null);
    if (!area.supported || !area.hasLocation || boundaryVerified) {
      setChecking(false);
      return;
    }

    setChecking(true);
    checkPlace(area.lat, area.lon, area.country, area.district).then((result) => {
      if (request !== requestSequence.current) return;
      if (result.valid) {
        onChange((current: any) => ({ ...current, boundary_verified: true }));
      } else {
        setLocationError(result.message || `This point is outside ${area.district}. Move the pin inside the boundary.`);
      }
    }).catch((error) => {
      if (request === requestSequence.current) {
        setLocationError(error instanceof Error ? `Could not verify this point: ${error.message}` : "Could not verify this point. Try again.");
      }
    }).finally(() => {
      if (request === requestSequence.current) setChecking(false);
    });

    return () => {
      if (request === requestSequence.current) requestSequence.current += 1;
    };
  }, [area.country, area.district, area.hasLocation, area.lat, area.lon, area.supported, boundaryVerified, onChange]);

  const pick = (lat: number, lon: number) => {
    requestSequence.current += 1;
    setLocationError(null);
    setChecking(true);
    onChange((current: any) => ({ ...current, lat, lon, boundary_verified: false }));
  };

  return <>
    <CivicMap points={[]} center={area.center}
      picked={area.hasLocation ? { lat: Number(value.lat), lon: Number(value.lon) } : null}
      spanKm={spanKm} height={height} onPick={area.supported ? pick : undefined}
      caption={checking ? "Checking selected district boundary…" : area.supported ? caption : "Choose a covered district first"} />
    {!area.supported ?
      <Note kind="info">Choose a supported country and district before placing a pin.</Note> :
      checking ?
        <Note kind="info">Checking the point against the selected district boundary…</Note> :
      locationError ?
        <Note kind="bad">{locationError}</Note> :
        area.withinCoverage ?
          <Note kind="ok">The point is inside {area.district}. Boundary data: GeoBoundaries.</Note> :
          <Note kind="info">Click inside {area.district} to place a pin. The point is checked against its boundary.</Note>}
  </>;
}

function DistrictPicker({ caps, value, onChange }: {caps: any;value: any;onChange: (v: any) => void;}) {
  const country = value.country || caps?.scope.country || "";
  const district = value.district || caps?.scope.district || "";
  const places = (caps?.places || []).filter((p: any) => caps?.role !== "REGIONAL_ADMIN" || p.country === caps?.scope.country);
  const districts = places.find((p: any) => p.country === country)?.districts || [];
  return <><Field label="Country"><select className="input" value={country} disabled={caps?.role === "RESIDENT"} onChange={(e) => onChange({ ...value, country: e.target.value, district: "", lat: null, lon: null, boundary_verified: false })}><option value="">Choose country</option>{places.map((p: any) => <option key={p.country}>{p.country}</option>)}</select></Field><Field label="District" hint="Pin locations are checked against the selected area's boundary."><select className="input" value={district} disabled={caps?.role === "RESIDENT"} onChange={(e) => onChange({ ...value, country, district: e.target.value, lat: null, lon: null, boundary_verified: false })}><option value="">Choose district</option>{districts.map((d: string) => <option key={d}>{d}</option>)}</select></Field></>;
}
