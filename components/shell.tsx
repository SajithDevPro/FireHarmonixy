"use client";





import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { useApp, useMeta } from "@/components/providers";
import { useAuth, initials, avatarHue } from "@/lib/auth";
import { useCaps } from "@/lib/civic";
import { Chip, Icon } from "@/components/ui";

type Role = "SUPER_ADMIN" | "REGIONAL_ADMIN" | "RESIDENT";
const EVERYONE: Role[] = ["SUPER_ADMIN", "REGIONAL_ADMIN", "RESIDENT"];
const ADMINS: Role[] = ["SUPER_ADMIN", "REGIONAL_ADMIN"];
const CENTRAL: Role[] = ["SUPER_ADMIN"];



const NAV: {group: string;items: [string, string, string, Role[]][];}[] = [
{ group: "Situation", items: [
  ["dashboard", "Dashboard", "dashboard", EVERYONE],
  ["incidents", "Incidents", "incident", EVERYONE],
  ["hospitals", "Hospitals", "hospital", EVERYONE],
  ["routes", "Evacuation routes", "route", EVERYONE],
  ["alerts", "Stay Alert", "bell", EVERYONE],
  ["properties", "My properties", "home", EVERYONE]]
},
{ group: "Response", items: [
  ["report", "Report a fire", "report", EVERYONE],
  ["regions", "Countries and regions", "globe", CENTRAL],
  ["settings", "Settings", "settings", CENTRAL],
  ["map", "Live map", "map", EVERYONE],
  ["events", "Fire events", "events", CENTRAL]]
},
{ group: "Past and future", items: [
  ["history", "Fire history", "history", CENTRAL],
  ["calendar", "Burning calendar", "history", CENTRAL],
  ["spread", "Hotspot spread map", "map", CENTRAL],
  ["forecast", "Forecast", "forecast", CENTRAL]]
},
{ group: "Data", items: [
  ["explorer", "Data explorer", "explorer", CENTRAL],
  ["quality", "Quality and coverage", "quality", CENTRAL],
  ["harmonization", "Hazard comparison", "info", CENTRAL],
  ["sources", "Data sources", "sources", CENTRAL]]
},
{ group: "Machine learning", items: [
  ["lab", "ML laboratory", "lab", CENTRAL],
  ["monitor", "Live monitor", "monitor", CENTRAL],
  ["validation", "Validation", "validation", CENTRAL],
  ["registry", "Model registry", "registry", CENTRAL]]
},
{ group: "Operations", items: [
  ["pipeline", "Pipeline", "pipeline", CENTRAL],
  ["logs", "Logs", "logs", CENTRAL],
  ["reports", "Reports", "reports", CENTRAL]]
}];


const SELECTION_PAGES: string[] = [];


function SideMenu({ onNavigate }: {onNavigate?: () => void;}) {
  const { meta, health } = useApp();
  const pathname = usePathname();
  const running = health?.active_job;
  const caps = useCaps();
  const { user } = useAuth();
  const role: Role = (caps?.role || user?.roleCode || "RESIDENT") as Role;
  const visible = NAV.map((g) => ({ ...g, items: g.items.filter((it) => it[3].includes(role)) })).
  filter((g) => g.items.length);

  return (
    <aside className="side">
      <Link className="logo-row" href="/dashboard" onClick={onNavigate}>
        <span className="logo-mark"><Icon name="events" size={15} /></span>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span className="logo-name">FireHarmonix</span>
          <span className="logo-sub">Thermal detection</span>
        </span>
      </Link>
      <nav className="nav" aria-label="Pages">
        {visible.map((g) =>
        <div className="nav-group" key={g.group}>
            <div className="nav-cap">{g.group}</div>
            {g.items.map(([route, label, icon]) => {
            const active = pathname === "/" + route;
            return (
              <Link key={route} href={"/" + route} className={"nav-item" + (active ? " active" : "")}
              aria-current={active ? "page" : undefined} onClick={onNavigate}>
                  <Icon name={icon} />
                  <span className="nav-label">{label}</span>
                  {route === "monitor" && running ?
                <i className="pulse" title="A job is running"
                style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} /> :
                null}
                </Link>);

          })}
          </div>
        )}
      </nav>
      <SideAccount onNavigate={onNavigate} />
      <div className="side-foot">
        Version {meta ? meta.version : "…"} · code {meta ? meta.commit : "…"}<br />
        All times are UTC
      </div>
    </aside>);

}


function SideAccount({ onNavigate }: {onNavigate?: () => void;}) {
  const { user, signOut } = useAuth();
  const { toast } = useApp();
  const router = useRouter();
  if (!user) return null;
  const hue = avatarHue(user.email);
  return (
    <div className="side-acct">
      <Link href="/profile" className="side-acct-btn" onClick={onNavigate} title="Profile settings">
        <span className="avatar avatar-sm" style={{ background: `hsl(${hue} 62% 92%)`, color: `hsl(${hue} 58% 30%)`, borderColor: `hsl(${hue} 52% 82%)` }}>
          {initials(user.name)}
        </span>
        <span className="acct-name"><b>{user.name}</b><i>{user.role}</i></span>
        <Icon name="settings" size={13} />
      </Link>
      <button className="btn btn-ghost btn-sm side-out" title="Sign out" aria-label="Sign out"
      onClick={() => {signOut();toast("Signed out.");router.replace("/login");}}>
        <Icon name="log-out" size={14} />
      </button>
    </div>);

}


function Search() {
  const router = useRouter();
  const { setFilters, meta } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<any>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {setRes(null);return;}
    const id = setTimeout(() => {
      api.get("/api/search?q=" + encodeURIComponent(q)).then(setRes).catch(() => setRes(null));
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);};
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const close = () => {setOpen(false);setQ("");};
  const has = res && (res.countries?.length || res.events?.length || res.detections?.length);

  return (
    <div className="search-wrap" ref={wrap}>
      <span className="s-ico"><Icon name="search" size={14} /></span>
      <input className="input" aria-label="Search" placeholder="Find a detection id, event id or country"
      value={q} onChange={(e) => {setQ(e.target.value);setOpen(true);}} onFocus={() => setOpen(true)} />
      {open && q.length >= 2 ?
      <div className="search-results" role="listbox">
          {res?.countries?.length ? <div className="search-cap">Country</div> : null}
          {res?.countries?.map((c: any) =>
        <div key={c.name} className="search-row" onClick={() => {
          const bbox = meta && meta.country_bbox && meta.country_bbox[c.name] || null;
          if (bbox) setFilters({ region: "custom", bbox });
          router.push("/overview");
          close();
        }}>
              <b>{c.name}</b><span className="search-hit">set as area</span>
            </div>
        )}
          {res?.events?.length ? <div className="search-cap">Event</div> : null}
          {res?.events?.map((e: any) =>
        <div key={e.id} className="search-row" onClick={() => {router.push("/events?event=" + e.id);close();}}>
              <span className="mono">{e.id}</span>
              <span className="search-hit">{fmt.n(e.n)} detections · {fmt.label(e.status)}</span>
            </div>
        )}
          {res?.detections?.length ? <div className="search-cap">Detection</div> : null}
          {res?.detections?.map((d: any) =>
        <div key={d.id} className="search-row" onClick={() => {router.push("/explorer?det=" + d.id);close();}}>
              <span className="mono">{d.id}</span>
              <span className="search-hit">{d.satellite} · {fmt.t(d.time)}</span>
            </div>
        )}
          {res && !has ? <div className="search-empty">Nothing found for “{q}”.</div> : null}
        </div> :
      null}
    </div>);

}


function SelectionBar() {
  const { filters, setFilters, clearFilters, meta } = useApp();
  const m = useMeta();
  const regions = m.regions;
  const sats = m.satellites;
  const win = meta && meta.window || m.window;
  const anySet = !!(filters.from || filters.to || filters.bbox || filters.sats && filters.sats.length);

  return (
    <div className="selbar">
      <span className="label">Selection</span>
      <select className="input" aria-label="Area" value={filters.region || "global"} onChange={(e) => {
        const r = regions.find((x: any) => x.id === e.target.value);
        setFilters({ region: e.target.value, bbox: r && r.bbox ? r.bbox : null });
      }}>
        {regions.map((r: any) => <option key={r.id} value={r.id}>{r.label}</option>)}
        {filters.region === "custom" ? <option value="custom">Custom area</option> : null}
      </select>
      <input className="input" type="date" aria-label="From date (UTC)" value={filters.from}
      min={win.from} max={filters.to || win.to} onChange={(e) => setFilters({ from: e.target.value })} />
      <span className="muted">to</span>
      <input className="input" type="date" aria-label="To date (UTC)" value={filters.to}
      min={filters.from || win.from} max={win.to} onChange={(e) => setFilters({ to: e.target.value })} />
      <div className="sat-group" role="group" aria-label="Satellites">
        {sats.map((s: any) =>
        <button key={s.id} className="sat-toggle" aria-pressed={(filters.sats || []).includes(s.id)}
        onClick={() => {
          const cur = filters.sats || [];
          setFilters({ sats: cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id] });
        }}>
            <i className="dot" style={{ background: s.hex }} />{s.label}
          </button>
        )}
      </div>
      {anySet ?
      <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear selection</button> :
      <span className="hint-sm">All data</span>}
      <span className="range-note">Data held: {win.from || "–"} to {win.to || "–"} · UTC</span>
    </div>);

}



function AccountMenu() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, toast } = useApp();
  const m = useMeta();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrap = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);};
    const onKey = (e: KeyboardEvent) => {if (e.key === "Escape") setOpen(false);};
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {document.removeEventListener("mousedown", onDoc);document.removeEventListener("keydown", onKey);};
  }, [open]);

  if (!user) return null;
  const hue = avatarHue(user.email);

  const doSignOut = () => {
    setOpen(false);
    signOut();
    toast("Signed out.");
    router.replace("/login");
  };

  return (
    <div className="acct" ref={wrap}>
      <button className="acct-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
      title={`${user.name} · ${user.role}`}>
        <span className="avatar avatar-sm" style={{ background: `hsl(${hue} 62% 92%)`, color: `hsl(${hue} 58% 30%)`, borderColor: `hsl(${hue} 52% 82%)` }}>
          {initials(user.name)}
        </span>
        <span className="acct-name"><b>{user.name}</b><i>{user.role}</i></span>
        <Icon name="chevron-down" size={12} />
      </button>

      {open ?
      <div className="acct-menu" role="menu">
          <div className="acct-head">
            <span className="avatar" style={{ background: `hsl(${hue} 62% 92%)`, color: `hsl(${hue} 58% 30%)`, borderColor: `hsl(${hue} 52% 82%)` }}>
              {initials(user.name)}
            </span>
            <span className="acct-head-txt">
              <b>{user.name}</b>
              <i>{user.email}</i>
              <span className="acct-role"><Chip code={user.roleCode === "ADMIN" ? "VD" : user.roleCode === "ANALYST" ? "OBS" : "NV"} label={user.role} /></span>
            </span>
          </div>

          <Link className="acct-item" href="/profile" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="user" size={14} /><span>Profile settings</span>
          </Link>
          <Link className="acct-item" href="/settings" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="settings" size={14} /><span>Installation settings</span>
          </Link>
          {user.roleCode === "ADMIN" ?
        <Link className="acct-item" href="/settings#accounts" role="menuitem" onClick={() => setOpen(false)}>
              <Icon name="user" size={14} /><span>Manage accounts</span>
            </Link> :
        null}
          <button className="acct-item" role="menuitem" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
            <span>Appearance</span>
            <em>{theme === "dark" ? "Dark" : "Light"}</em>
          </button>
          <div className="acct-sep" />
          <button className="acct-item danger" role="menuitem" onClick={doSignOut}>
            <Icon name="log-out" size={14} /><span>Sign out</span>
          </button>
          <div className="acct-foot">{m.title} {m.version} · all times UTC</div>
        </div> :
      null}
    </div>);

}


function Boot({ text = "Opening your session…" }: {text?: string;}) {
  return (
    <div className="boot">
      <span className="boot-mark"><Icon name="events" size={20} /></span>
      <div className="boot-name">FireHarmonix</div>
      <div className="boot-text">{text}</div>
    </div>);

}


function Header({ onMenu }: {onMenu: () => void;}) {
  const { theme, setTheme, health, go } = useApp();
  const running = health?.active_job;
  return (
    <header className="header">
      <button className="btn btn-ghost btn-sm mobile-only" aria-label="Open menu" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <Search />
      <div className="spacer" />
      {health?.state === "unreachable" ? <Chip code="FAILED" label="Server not answering" /> : null}
      {running ?
      <button className="btn btn-sm" title="Open the live monitor" onClick={() => go("/monitor?id=" + running.id)} style={{ maxWidth: 240 }}>
          <i className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Job {running.id}: {fmt.label(running.state)}
          </span>
        </button> :

      <span className="header-counts">
          {health?.state === "ok" ? `${fmt.n(health.detections)} detections · ${fmt.n(health.events)} candidate events` : "connecting…"}
        </span>
      }
      <button className="btn btn-ghost" aria-label="Switch theme" title="Switch between light and dark"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
      </button>
      <AccountMenu />
    </header>);

}


export function Shell({ children }: {children: React.ReactNode;}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toasts, dismissToast } = useApp();
  const { ready, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const flush = pathname === "/map";
  const isPublic = pathname === "/" || pathname === "/login" || pathname === "/register";

  useEffect(() => {setMenuOpen(false);}, [pathname]);


  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublic) {
      const next = pathname && pathname !== "/" ? "?next=" + encodeURIComponent(pathname) : "";
      router.replace("/login" + next);
    }
    if (user && (pathname === "/login" || pathname === "/register")) router.replace("/overview");
  }, [ready, user, isPublic, pathname, router]);

  if (isPublic) return <>{children}</>;
  if (!ready) return <Boot />;
  if (!user) return <Boot text="Taking you to sign-in…" />;

  return (
    <div className="shell">
      <div className="side-wrap"><SideMenu /></div>
      {menuOpen ?
      <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,0.34)", zIndex: 65 }} onClick={() => setMenuOpen(false)} />
          <SideMenu onNavigate={() => setMenuOpen(false)} />
        </> :
      null}
      <div className="main">
        <Header onMenu={() => setMenuOpen(true)} />
        {SELECTION_PAGES.includes(pathname) ? <SelectionBar /> : null}
        <main className={"content" + (flush ? " flush" : "")}>
          <div className="page">{children}</div>
        </main>
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) =>
        <div key={t.id} className={"toast " + (t.kind === "ok" ? "ok" : t.kind === "bad" ? "bad" : "")}
        role={t.kind === "bad" ? "alert" : "status"}>
            <span>{t.text}</span>
            <button className="btn btn-ghost btn-sm" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
              <Icon name="close" size={12} />
            </button>
          </div>
        )}
      </div>
    </div>);

}
