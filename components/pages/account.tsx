"use client";








import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { avatarHue, initials, PERMISSIONS, useAuth } from "@/lib/auth";
import { useApp, useMeta } from "@/components/providers";
import { fmt } from "@/lib/format";
import { Card, Chip, Field, Icon, Note, PageHead, Tabs, Tag } from "@/components/ui";


const TIMEZONES: string[] = (() => {
  try {
    const all = (Intl as any).supportedValuesOf("timeZone") as string[];
    return ["UTC", ...all.filter((z) => z !== "UTC")];
  } catch (e) {
    return ["UTC"];
  }
})();

const NOTIFS: {key: "job_finished" | "needs_verification" | "weekly" | "browser";label: string;text: string;}[] = [
{ key: "job_finished", label: "A pipeline or ML job finishes", text: "One message when a run completes or fails. No message per step." },
{ key: "needs_verification", label: "A candidate event needs verification", text: "Sent when an event with enough detections has no independent evidence yet." },
{ key: "weekly", label: "Weekly summary", text: "Detections held, events formed, and what remains unverified — every Monday." },
{ key: "browser", label: "Browser notification", text: "A desktop notice while this tab is open. Nothing is sent to a server." }];


export function ProfilePage() {
  const { user, started, sessions, updateProfile, changePassword, signOut, signOutEverywhere, revokeOthers } = useAuth();
  const { toast, theme, setTheme } = useApp();
  const meta = useMeta();
  const router = useRouter();
  const [tab, setTab] = useState("details");

  const [form, setForm] = useState({ name: "", email: "", phone: "", organisation: "", timezone: "UTC", units: "metric" });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      organisation: user.organisation,
      timezone: user.timezone || "UTC",
      units: user.units || "metric"
    });
  }, [user]);

  const dirty = useMemo(
    () =>
    !!user && (
    form.name !== user.name ||
    form.email !== user.email ||
    form.phone !== (user.phone || "") ||
    form.organisation !== user.organisation ||
    form.timezone !== user.timezone ||
    form.units !== user.units),
    [form, user]
  );

  if (!user) return null;

  const hue = avatarHue(user.email);

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast("A name is required.", "bad");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return toast("That email address does not look complete.", "bad");
    setSaving(true);
    try {
      await updateProfile(form);
      toast("Profile saved.", "ok");
    } catch (err: any) {
      toast(err?.message || "The profile could not be saved.", "bad");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotif = async (key: string) => {
    const notifications = { ...user.notifications, [key]: !(user.notifications as any)[key] };
    try {
      await updateProfile({ notifications } as any);
      toast("Notification setting saved.", "ok");
    } catch (err: any) {
      toast(err?.message || "The setting could not be saved.", "bad");
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pw.next !== pw.confirm) {
      setPwError("The two new passwords are not the same.");
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      toast("Password changed.", "ok");
    } catch (err: any) {
      setPwError(err?.message || "The password could not be changed.");
    } finally {
      setPwBusy(false);
    }
  };

  const doSignOut = () => {
    signOut();
    toast("Signed out.");
    router.replace("/login");
  };

  const tabs = [
  { id: "details", label: "Your details" },
  { id: "notifications", label: "Notifications" },
  { id: "password", label: "Password" },
  { id: "sessions", label: "Sessions", count: sessions.length },
  { id: "access", label: "What you can do" }];


  return (
    <div className="page stack gap-4">
      <PageHead
        title="Profile settings"
        subtitle="Your account on this installation: who you are, how you are reached, and which devices are signed in."
        right={
        <>
            <Chip code={user.roleCode === "ADMIN" ? "VD" : user.roleCode === "ANALYST" ? "OBS" : "NV"} label={user.role} />
            <button className="btn btn-sm" onClick={doSignOut}>
              <Icon name="logout" size={13} /> Sign out
            </button>
          </>
        } />
      

      <Card>
        <div className="profile-id">
          <span className="avatar" style={{ background: `hsl(${hue} 62% 92%)`, color: `hsl(${hue} 58% 30%)`, borderColor: `hsl(${hue} 52% 82%)` }}>
            {initials(user.name)}
          </span>
          <span className="profile-id-txt">
            <b>{user.name}</b>
            <i>{user.email}</i>
            <span className="profile-meta">
              <span>{user.role}</span>
              <span>·</span>
              <span>{user.organisation}</span>
              <span>·</span>
              <span>Account since {fmt.day(user.since)}</span>
            </span>
          </span>
          <span className="profile-session">
            <span className="label">Signed in</span>
            <b>{started ? fmt.t(started) : "–"}</b>
            <span className="hint-sm">This browser session</span>
          </span>
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} items={tabs} />

      {tab === "details" ?
      <form onSubmit={saveDetails} className="stack gap-4">
          <Card title="Your details" subtitle="Used on the interface and in any report you export." right={<Tag code="REC" />}>
            <div className="grid cols-2">
              <Field label="Full name" hint="Shown in the header menu and on exports.">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Email address" hint="Where job and verification messages go. Changing it does not change your sign-in here.">
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Phone" hint="Optional. Only used if your administrator sends verification messages by phone.">
                <input className="input" value={form.phone} placeholder="Not set" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Organisation" hint="Printed on exported reports.">
                <input className="input" value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} />
              </Field>
              <Field label="Time zone for messages" hint="Times inside the interface stay UTC; this only applies to email.">
                <select className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                  {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Units" hint="Distances and areas. Temperatures are always shown in kelvin for the sensor values.">
                <select className="input" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })}>
                  <option value="metric">Metric (km, km²)</option>
                  <option value="imperial">Imperial (mi, mi²)</option>
                </select>
              </Field>
            </div>
            <div className="row gap-2" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" type="submit" disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button className="btn" type="button" disabled={!dirty || saving} onClick={() =>
            setForm({ name: user.name, email: user.email, phone: user.phone || "", organisation: user.organisation, timezone: user.timezone, units: user.units })}>
                Discard
              </button>
              {dirty ? <span className="hint-sm">Unsaved changes</span> : null}
            </div>
          </Card>

          <Card title="Appearance" subtitle="Your choice is kept on this device only." right={<Tag code="OBS" />}>
            <div className="grid cols-2">
              <Field label="Theme" hint="Light is the default. Dark is kept for low-light rooms.">
                <div className="seg">
                  <button type="button" className={"seg-btn" + (theme === "light" ? " on" : "")} onClick={() => setTheme("light")}>Light</button>
                  <button type="button" className={"seg-btn" + (theme === "dark" ? " on" : "")} onClick={() => setTheme("dark")}>Dark</button>
                </div>
              </Field>
              <Field label="Start page" hint="Where the interface opens after signing in.">
                <select className="input" defaultValue="/overview" onChange={(e) => toast("Start page saved on this device.", "ok")}>
                  <option value="/overview">Overview</option>
                  <option value="/map">Live map</option>
                  <option value="/events">Fire events</option>
                  <option value="/lab">ML laboratory</option>
                </select>
              </Field>
            </div>
          </Card>
        </form> :
      null}

      {tab === "notifications" ?
      <Card title="What you are told about" subtitle="Messages are sent by the server, not by this browser." right={<Tag code="REC" />}>
          <div className="stack">
            {NOTIFS.map((n) =>
          <label key={n.key} className="switch-row">
                <span className="switch-txt">
                  <b>{n.label}</b>
                  <i>{n.text}</i>
                </span>
                <input type="checkbox" className="switch" checked={!!(user.notifications as any)[n.key]} onChange={() => toggleNotif(n.key)} />
              </label>
          )}
          </div>
          <Note>
            Turning these off never changes what is collected. Every job, verification and setting change
            stays in the log whether or not a message was sent about it.
          </Note>
        </Card> :
      null}

      {tab === "password" ?
      <div className="grid cols-2-flex440">
          <Card title="Change your password" subtitle="At least 8 characters, with letters and a number." right={<Tag code="REC" />}>
            <form onSubmit={savePassword} className="stack gap-3">
              {pwError ?
            <div className="auth-error" role="alert"><Icon name="info" size={14} /><span>{pwError}</span></div> :
            null}
              <Field label="Current password">
                <input className="input" type="password" autoComplete="current-password" value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </Field>
              <Field label="New password">
                <input className="input" type="password" autoComplete="new-password" value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </Field>
              <Field label="Repeat new password">
                <input className="input" type="password" autoComplete="new-password" value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </Field>
              <div>
                <button className="btn btn-primary" type="submit" disabled={pwBusy || !pw.current || !pw.next}>
                  {pwBusy ? "Changing…" : "Change password"}
                </button>
              </div>
            </form>
          </Card>
          <Card title="Good to know">
            <ul className="plain-list">
              <li>Changing your password signs out every other device; this browser stays signed in.</li>
              <li>If you have lost the current password, an administrator must reset it — nothing here can.</li>
              <li>Passwords are never written to the log or to a report.</li>
            </ul>
            <Note kind="warn">
              This installation is reachable from more than one machine if it was started that way. Use a password
              you do not use anywhere else.
            </Note>
          </Card>
        </div> :
      null}

      {tab === "sessions" ?
      <Card title="Devices signed in" subtitle="A session ends when you sign out, or when the browser is closed if you did not choose “keep me signed in”." right={<Tag code="OBS" />} pad={false}>
          <div className="scroll-x">
            <table className="grid-table">
              <thead>
                <tr><th>Device</th><th>Where</th><th>Last active</th><th></th></tr>
              </thead>
              <tbody>
                {sessions.map((s) =>
              <tr key={s.id}>
                    <td><b>{s.device}</b>{s.current ? <Chip code="CONFIRMED" label="This device" /> : null}</td>
                    <td className="muted">{s.where}</td>
                    <td>{fmt.t(s.last)}</td>
                    <td className="r">
                      {s.current ?
                  <span className="hint-sm">Signed in now</span> :

                  <button className="btn btn-sm" onClick={() => {revokeOthers();toast("Other devices signed out.", "ok");}}>
                          Sign out
                        </button>
                  }
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
          <div className="row gap-2" style={{ padding: 14, borderTop: "1px solid var(--line-soft)" }}>
            <button className="btn" onClick={() => {revokeOthers();toast("Other devices signed out.", "ok");}}>
              Sign out other devices
            </button>
            <button className="btn btn-danger" onClick={() => {signOutEverywhere();toast("Signed out everywhere.");router.replace("/login");}}>
              Sign out everywhere
            </button>
          </div>
        </Card> :
      null}

      {tab === "access" ?
      <Card title="What your role can do" subtitle={`You are signed in as ${user.role}.`} right={<Tag code="REC" />} pad={false}>
          <div className="scroll-x">
            <table className="grid-table">
              <thead>
                <tr><th>Action</th><th>Your role</th><th>Administrator</th><th>Analyst</th><th>Viewer</th></tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) =>
              <tr key={p.label}>
                    <td>{p.label}</td>
                    <td>{p.who.includes(user.roleCode) ? <Icon name="check" size={14} /> : <span className="faint">–</span>}</td>
                    {(["ADMIN", "ANALYST", "VIEWER"] as const).map((r) =>
                <td key={r} className="muted">{p.who.includes(r) ? "yes" : "no"}</td>
                )}
                  </tr>
              )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 14, borderTop: "1px solid var(--line-soft)" }}>
            <Note>
              These rules are enforced by the server, not by this page. The interface hides nothing that
              the server would refuse — you will get a plain refusal instead.
            </Note>
          </div>
        </Card> :
      null}

      <Card title="Session" subtitle="Signing out clears this device only.">
        <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={doSignOut}><Icon name="logout" size={13} /> Sign out</button>
          <span className="hint-sm">
            {meta.title} · version {meta.version}{meta.commit ? ` · commit ${meta.commit}` : ""}
          </span>
        </div>
      </Card>
    </div>);

}
