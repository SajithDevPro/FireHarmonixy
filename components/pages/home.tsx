"use client";







import React from "react";
import Link from "next/link";
import { useApi } from "@/lib/hooks";
import { useApp, useMeta } from "@/components/providers";
import { useAuth } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { Chip, Icon } from "@/components/ui";
import { Lines } from "@/components/charts";

const PAGES: {group: string;items: [string, string, string][];}[] = [
{
  group: "Situation",
  items: [
  ["/dashboard", "Dashboard", "What is held for the current selection, and what is still unverified."],
  ["/map", "Live map", "Detections, candidate events, footprints and coverage on one canvas."],
  ["/events", "Fire events", "Candidate events with their evidence history, overpass by overpass."]]

},
{
  group: "Past and future",
  items: [
  ["/history", "Fire history", "Fourteen years of record, by year, month, country and block."],
  ["/forecast", "Forecast", "Expected detections scored against years the model never saw."]]

},
{
  group: "Data",
  items: [
  ["/explorer", "Data explorer", "Every stored detection record, filterable and exportable."],
  ["/quality", "Quality and coverage", "Rule flags, rejected rows and where the satellite looked."],
  ["/harmonization", "Hazard comparison", "MODIS and VIIRS side by side: bias, ratio and pairs."],
  ["/sources", "Data sources", "What each provider gives, and what it costs to get it."]]

},
{
  group: "Machine learning",
  items: [
  ["/lab", "ML laboratory", "Run an algorithm on a chosen slice and inspect the result."],
  ["/monitor", "Live monitor", "Every running and finished job, step by step."],
  ["/validation", "Validation", "What has been checked, what has not, and what cannot be."],
  ["/registry", "Model registry", "Named, versioned references to the runs behind a result."]]

},
{
  group: "Operations",
  items: [
  ["/pipeline", "Pipeline", "The eleven processing steps and their state."],
  ["/logs", "Logs", "System log and change history, with the actor on each change."],
  ["/reports", "Reports", "Files generated from the stored data, ready to hand over."],
  ["/settings", "Settings", "Association thresholds, access and machine paths."]]

}];


const RULES = [
["Never called a fire", "Until an item is verified, it is a detection or a candidate event. The wording is part of the data model."],
["Unverified is not false", "“Unverified” means nobody has checked yet. It does not mean the detection was wrong."],
["Unknown is not “no fire”", "A gap in coverage is shown as a gap. Absence of evidence is not evidence of absence."],
["Percentages only when known", "Where the total work is unknown, a striped indeterminate bar appears instead of a made-up share."]];


const EVIDENCE: [string, string, string, string][] = [
["OBS", "Observed", "Read directly from a satellite product. The strongest claim that needs no interpretation.", "var(--info)"],
["VD", "Verified", "Checked against ground, burned area, imagery or news. Only this tier can set CONFIRMED or SUPPORTED.", "var(--ok)"],
["REC", "Result of a rule", "The output of a documented method — a flag, a score, a choice of parameters.", "var(--violet)"],
["NV", "Not verified", "Kept and shown, with the reason it has not been checked.", "var(--warn)"]];


const STEPS = [
["Ingest", "Provider files land with their original rows kept, checksums recorded and rejections stored with the reason."],
["Associate", "Detections are grouped into candidate events across overpasses, with the parameters written down."],
["Verify", "Independent evidence is attached per event. Three tiers can confirm; one can only contradict."],
["Explain", "Every figure carries its tag, every job its settings, every change its actor."]];


export function HomePage() {
  const { theme, setTheme } = useApp();
  const { user } = useAuth();
  const health = useApi("/api/health", { poll: 15000 });
  const meta = useApi("/api/meta");
  const overview = useApi("/api/public-summary");

  const h = health.data;
  const m = useMeta();
  const SATS = m.satellites;
  const win = meta.data && meta.data.window || m.window;
  const days = !win.from || !win.to ? 0 : Math.max(
    0,
    Math.round((new Date(win.to + "T00:00:00Z").getTime() - new Date(win.from + "T00:00:00Z").getTime()) / 86400000) + 1
  );

  const daily = overview.data && overview.data.daily;
  const series = daily ?
  daily.series.slice(0, 3).map((s: any, i: number) => ({ name: s.name, color: SATS.find((sat: any) => sat.id === s.name)?.hex || ["var(--accent)", "var(--info)", "var(--warn)"][i], data: s.data })) :
  [];

  const stats: [string, string, string][] = [
  ["Thermal detections held", h ? fmt.n(h.detections) : "—", "Unique records after removing repeats between snapshots"],
  ["Candidate events formed", h ? fmt.n(h.events) : "—", "Clusters of detections across overpasses, not confirmed fires"],
  ["Satellites tracked", String(SATS.length), "VIIRS and MODIS platforms, each with its own bias"],
  ["Days in this window", String(days || 0), `${win.from} to ${win.to} · all times UTC`]];


  return (
    <div className="home">
      {}
      <header className="home-nav">
        <div className="home-wrap home-nav-in">
          <Link className="home-brand" href="/">
            <span className="home-mark"><Icon name="events" size={16} /></span>
            <span>
              <b>FireHarmonix</b>
              <i>Thermal detection · hazard monitoring</i>
            </span>
          </Link>
          <nav className="home-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#evidence">Evidence</a>
            <a href="#pages">Pages</a>
            <a href="#data">Data</a>
          </nav>
          <div className="home-nav-act">
            <button className="btn btn-ghost btn-sm" aria-label="Switch theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
            </button>
            {user ?
            <Link className="btn btn-primary btn-sm" href="/dashboard">Open dashboard</Link> :

            <>
                <Link className="btn btn-sm" href="/login">Sign in</Link>
                <Link className="btn btn-primary btn-sm" href="/register">Create an account</Link>
              </>
            }
          </div>
        </div>
      </header>

      {}
      <section className="home-hero">
        <div className="home-wrap home-hero-in">
          <div className="home-hero-txt">
            <span className="home-eyebrow">
              <i className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
              {h ? `Live from this installation · ${fmt.n(h.detections)} detections held` : "Connecting to this installation…"}
            </span>
            <h1>
              Every detection,<br />
              with its <span className="home-em">evidence attached</span>.
            </h1>
            <p>
              FireHarmonix holds satellite thermal detections, the candidate events built from them,
              the fourteen years behind them and the models in front of them — and refuses to call
              any of it a fire until somebody has checked.
            </p>
            <div className="home-cta">
              <Link className="btn btn-primary" href="/login">Sign in</Link>
              <Link className="btn" href="/register">Create an account</Link>
            </div>
            <div className="home-trust">
              <span><Icon name="check" size={12} /> Times in UTC</span>
              <span><Icon name="check" size={12} /> Every figure tagged</span>
              <span><Icon name="check" size={12} /> Processes locally on the VM</span>
            </div>
          </div>

          {}
          <div className="home-panel" aria-label="Live summary">
            <div className="home-panel-h">
              <span className="home-panel-t">Overview</span>
              <span className="home-panel-chip">
                <Chip code="OBS" label="Observed" />
              </span>
            </div>
            <div className="home-panel-kpis">
              <div>
                <span className="label">Detections</span>
                <b>{h ? fmt.n(h.detections) : "—"}</b>
              </div>
              <div>
                <span className="label">Candidate events</span>
                <b>{h ? fmt.n(h.events) : "—"}</b>
              </div>
            </div>
            <div className="home-panel-chart">
              {series.length ?
              <Lines height={128} cats={daily.days} series={series} legend={false} /> :

              <div className="home-panel-skeleton" />
              }
            </div>
            <div className="home-panel-f">
              <span className="dotlegend"><i style={{ background: "var(--warn)" }} />Unverified</span>
              <span className="dotlegend"><i style={{ background: "var(--info)" }} />Awaiting evidence</span>
              <span className="home-panel-note">Not confirmed fires</span>
            </div>
          </div>
        </div>
      </section>

      {}
      <section className="home-strip">
        <div className="home-wrap home-strip-in">
          {stats.map(([label, value, note]) =>
          <div className="home-stat" key={label}>
              <span className="label">{label}</span>
              <b>{value}</b>
              <i>{note}</i>
            </div>
          )}
        </div>
      </section>

      {}
      <section className="home-sec">
        <div className="home-wrap">
          <div className="home-sec-h">
            <span className="home-eyebrow">The rules the interface keeps</span>
            <h2>Honest by construction</h2>
            <p>
              A hazard tool is only worth what it refuses to claim. These four rules are enforced in the
              data model and printed next to the numbers they govern.
            </p>
          </div>
          <div className="home-rules">
            {RULES.map(([t, d]) =>
            <div className="home-rule" key={t}>
                <span className="home-rule-ic"><Icon name="check" size={13} /></span>
                <b>{t}</b>
                <i>{d}</i>
              </div>
            )}
          </div>
        </div>
      </section>

      {}
      <section className="home-sec home-sec-alt" id="how">
        <div className="home-wrap">
          <div className="home-sec-h">
            <span className="home-eyebrow">How it works</span>
            <h2>From a provider file to an explained number</h2>
          </div>
          <div className="home-steps">
            {STEPS.map(([t, d], i) =>
            <div className="home-step" key={t}>
                <span className="home-step-n">{i + 1}</span>
                <b>{t}</b>
                <i>{d}</i>
              </div>
            )}
          </div>
        </div>
      </section>

      {}
      <section className="home-sec" id="evidence">
        <div className="home-wrap">
          <div className="home-sec-h">
            <span className="home-eyebrow">Evidence tiers</span>
            <h2>What kind of claim a number supports</h2>
            <p>Four tags, printed beside every figure on every page.</p>
          </div>
          <div className="home-evidence">
            {EVIDENCE.map(([code, name, text, color]) =>
            <div className="home-ev" key={code}>
                <span className="home-ev-tag" style={{ color, borderColor: color }}>
                  <i style={{ background: color }} />
                  {code}
                </span>
                <b>{name}</b>
                <i>{text}</i>
              </div>
            )}
          </div>
        </div>
      </section>

      {}
      <section className="home-sec home-sec-alt" id="pages">
        <div className="home-wrap">
          <div className="home-sec-h">
            <span className="home-eyebrow">Seventeen pages, one selection</span>
            <h2>Pick a date range, an area and satellites once</h2>
            <p>
              The selection carries across the whole interface — and every view is a real URL you can
              send to somebody.
            </p>
          </div>
          <div className="home-pages">
            {PAGES.map((g) =>
            <div className="home-pgroup" key={g.group}>
                <div className="home-pgroup-cap">{g.group}</div>
                {g.items.map(([href, label, text]) =>
              <Link className="home-page" href={href} key={href}>
                    <span className="home-page-ic"><Icon name={href.slice(1)} size={14} /></span>
                    <span>
                      <b>{label}</b>
                      <i>{text}</i>
                    </span>
                    <Icon name="chevron" size={11} />
                  </Link>
              )}
              </div>
            )}
          </div>
        </div>
      </section>

      {}
      <section className="home-sec" id="data">
        <div className="home-wrap home-data">
          <div>
            <span className="home-eyebrow">The data underneath</span>
            <h2>{SATS.length ? `${SATS.length} platforms` : "Platforms"}, one harmonised record</h2>
            <p>
              {SATS.length ? SATS.map((s: any) => `${s.label} (${s.sensor})`).join(", ") + ". " : ""}Each sensor has its own
              detection bias, its own pixel size and its own idea of confidence — the harmonisation
              page exists because they do not agree, and says by how much.
            </p>
            <div className="home-sats">
              {(SATS || []).map((s: any) =>
              <span className="home-sat" key={s.id}>
                  <i style={{ background: s.hex }} />
                  <b>{s.id}</b>
                  <em>{s.sensor}</em>
                </span>
              )}
            </div>
          </div>
          <div className="home-data-card">
            <div className="home-data-row"><span>Interface</span><b>Next.js · App Router</b></div>
            <div className="home-data-row"><span>API</span><b>FireHarmonix service · REST</b></div>
            <div className="home-data-row"><span>Version</span><b>{m.version}{m.commit ? ` · ${m.commit}` : ""}</b></div>
            <div className="home-data-row"><span>Window held</span><b>{win.from} → {win.to}</b></div>
            <div className="home-data-row"><span>Times</span><b>UTC throughout</b></div>
          </div>
        </div>
      </section>

      {}
      <section className="home-end">
        <div className="home-wrap home-end-in">
          <div>
            <h2>Look at the evidence yourself</h2>
            <p>Sign in with the account your administrator gave you, or the seeded one on this installation.</p>
          </div>
          <div className="home-cta">
            <Link className="btn btn-primary" href="/login">Sign in</Link>
            <Link className="btn" href="/register">Create an account</Link>
          </div>
        </div>
      </section>

      {}
      <footer className="home-foot">
        <div className="home-wrap home-foot-in">
          <div className="home-foot-brand">
            <span className="home-mark"><Icon name="events" size={14} /></span>
            <span>
              <b>FireHarmonix</b>
              <i>{m.title} · version {m.version}</i>
            </span>
          </div>
          <nav className="home-foot-links">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/events">Fire events</Link>
            <Link href="/history">Fire history</Link>
            <Link href="/explorer">Data explorer</Link>
            <Link href="/settings">Settings</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/register">Create an account</Link>
          </nav>
          <div className="home-foot-note">
            All times are UTC. Unverified items are never called fires.
          </div>
        </div>
      </footer>
    </div>);

}
