"use client";








import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/components/providers";
import { Icon, Note } from "@/components/ui";
import { useApi } from "@/lib/hooks";

const POINTS = [
["Read-only to begin with", "A new account can read every page and export a table. Uploading, running a job or verifying an event needs an administrator to raise the role."],
["Your email is your identity", "It is what an administrator recognises, and where job and verification messages go."],
["Nothing is shared between accounts", "Your selections, theme and notifications are yours; the data is the installation's."]];



function strengthOf(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw) || /^(?:123|abc|qwerty|password)/i.test(pw)) score = 0;
  const checks: [string, boolean][] = [
  ["At least 8 characters", pw.length >= 8],
  ["Letters and a number", /[A-Za-z]/.test(pw) && /[0-9]/.test(pw)],
  ["Mix of cases or a symbol", pw.length >= 12 || /[A-Z]/.test(pw) && /[a-z]/.test(pw) || /[^A-Za-z0-9]/.test(pw)],
  ["Not a repeated or common pattern", pw.length > 0 && !/^(.)\1+$/.test(pw) && !/^(?:123|abc|qwerty|password)/i.test(pw)]];

  const passed = checks.filter((c) => c[1]).length;
  const level = passed <= 2 ? 0 : passed === 3 ? 1 : score >= 5 ? 3 : 2;
  return {
    score,
    level,
    label: ["Too weak", "Weak", "Fair", "Strong"][level],
    tone: ["var(--bad)", "var(--warn)", "var(--info)", "var(--ok)"][level],
    checks
  };
}

export function RegisterPage() {
  const { register, user } = useAuth();
  const { toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();

  const [form, setForm] = useState({
    name: "",
    email: "",
    organisation: "",
    password: "",
    confirm: "",
    accept: false,
    country: "",
    district: ""
  });

  const meta = useApi("/api/meta");
  const places: {country: string;districts: string[];}[] = meta.data && meta.data.places || [];
  const firstAccount = !!(meta.data && meta.data.needs_setup);
  const districts = (places.find((p) => p.country === form.country) || { districts: [] }).districts;
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextRaw = params.get("next") || "/dashboard";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";
  const strength = useMemo(() => strengthOf(form.password), [form.password]);

  React.useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
  setForm({ ...form, [k]: e.target.type === "checkbox" ? (e.target as any).checked : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form, true);
      toast(firstAccount ? "Administrator account created." : "Account created.", "ok");
      router.replace(next);
    } catch (err: any) {
      setError(err?.message || "The account could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const ready =
  form.name.trim().length >= 2 &&
  /^\S+@\S+\.\S+$/.test(form.email.trim()) &&
  form.password.length >= 8 &&
  form.password === form.confirm &&
  form.accept && (
  firstAccount || !!form.country && !!form.district);

  return (
    <div className="auth">
      <aside className="auth-side">
      <div className="auth-space" aria-hidden="true">
        <div className="auth-starfield" />
        <div className="auth-starfield b" />
        <div className="auth-orbit" />
        <div className="auth-globe" />
      </div>
        <div className="auth-brand">
          <span className="auth-mark">
            <Icon name="events" size={19} />
          </span>
          <span>
            <b>FireHarmonix</b>
            <i>Thermal detection · hazard monitoring</i>
          </span>
        </div>

        <div className="auth-pitch">
          <h2>Ask for an account.</h2>
          <p>
            Accounts on this installation are read-only until an administrator raises them.
            That keeps the record trustworthy: the person who changes a threshold, starts a
            run or marks an event verified is always known.
          </p>
          <ul>
            {POINTS.map(([t, d]) =>
            <li key={t}>
                <span className="auth-tick"><Icon name="check" size={12} /></span>
                <span><b>{t}</b><i>{d}</i></span>
              </li>
            )}
          </ul>
        </div>

        <div className="auth-foot">
          <span>All times are UTC</span>
          <span>·</span>
          <span>Version 0.3.4</span>
        </div>
      </aside>

      <main className="auth-main">
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-card-h">
            <h1>Create an account</h1>
            <p>Four fields, then an administrator can raise your role. You can sign in immediately.</p>
          </div>

          {error ?
          <div className="auth-error" role="alert">
              <Icon name="info" size={14} />
              <span>{error}</span>
            </div> :
          null}

          <div className="auth-two">
            <label className="auth-field">
              <span>Full name</span>
              <input className="input" value={form.name} onChange={set("name")} placeholder="Your full name"
              autoComplete="name" disabled={busy} autoFocus />
            </label>
            <label className="auth-field">
              <span>Organisation <em className="auth-opt">optional</em></span>
              <input className="input" value={form.organisation} onChange={set("organisation")} placeholder="Where you work"
              autoComplete="organization" disabled={busy} />
            </label>
          </div>

          <label className="auth-field">
            <span>Email address</span>
            <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="you@example.org"
            autoComplete="email" disabled={busy} />
          </label>

          {firstAccount ? null :
          <div className="auth-two">
              <label className="auth-field">
                <span>Country</span>
                <select className="input" value={form.country} disabled={busy}
              onChange={(e) => setForm({ ...form, country: e.target.value, district: "" })}>
                  <option value="">Choose…</option>
                  {places.map((p) => <option key={p.country} value={p.country}>{p.country}</option>)}
                </select>
              </label>
              <label className="auth-field">
                <span>District</span>
                <select className="input" value={form.district} onChange={set("district")} disabled={busy || !form.country}>
                  <option value="">Choose…</option>
                  {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            </div>
          }

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-pass">
              <input className="input" type={show ? "text" : "password"} value={form.password} onChange={set("password")}
              placeholder="At least 8 characters" autoComplete="new-password" disabled={busy} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"}>
                <Icon name={show ? "eye-off" : "eye"} size={15} />
              </button>
            </div>
          </label>

          {form.password ?
          <div className="auth-strength">
              <div className="auth-bars">
                {[0, 1, 2, 3].map((i) =>
              <span key={i} style={{ background: i <= strength.level ? strength.tone : "var(--surface-3)" }} />
              )}
                <em style={{ color: strength.tone }}>{strength.label}</em>
              </div>
              <ul className="auth-checks">
                {strength.checks.map(([label, ok]) =>
              <li key={label} className={ok ? "ok" : ""}>
                    <Icon name={ok ? "check" : "close"} size={10} />{label}
                  </li>
              )}
              </ul>
            </div> :
          null}

          <label className="auth-field">
            <span>Repeat password</span>
            <input className="input" type={show ? "text" : "password"} value={form.confirm} onChange={set("confirm")}
            placeholder="The same again" autoComplete="new-password" disabled={busy} />
            {form.confirm && form.confirm !== form.password ?
            <em className="auth-mismatch">The two passwords are not the same.</em> :
            null}
          </label>

          <label className="auth-check auth-terms">
            <input type="checkbox" checked={form.accept} onChange={set("accept")} />
            <span>
              I understand this account starts read-only, that access is logged, and that
              detections must be verified before being called a fire.
            </span>
          </label>

          <button className="btn btn-primary auth-submit" type="submit" disabled={busy || !ready}>
            {busy ? "Creating the account…" : "Create account"}
          </button>

          <div className="auth-alt">
            Already have an account? <Link href="/login" className="link-btn">Sign in</Link>
          </div>

          <Note>
            {firstAccount ?
            "This installation needs operator setup. Configure the initial administrator on the server before registration opens." :
            "The request is recorded on the installation. An administrator sees it in Settings and raises the role."}
          </Note>

          <div className="auth-legal">
            Access is logged with the account that made each change. Passwords are stored as
            salted hashes, never as text.
          </div>
        </form>
      </main>
    </div>);

}
