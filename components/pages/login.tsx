"use client";







import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/components/providers";
import { Icon } from "@/components/ui";

const POINTS = [
["Thermal detections, not “fires”", "Every figure says what kind of claim it supports — observed, verified, or a result of a rule."],
["One selection everywhere", "Dates, area and satellites carry across the whole interface."],
["Nothing invented", "Percentages only where the total is known; unknown stays unknown."]];


export function LoginPage() {
  const { signIn, user } = useAuth();
  const { toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextRaw = params.get("next") || "/dashboard";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";


  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password, keep);
      toast("Signed in.", "ok");
      router.replace(next);
    } catch (err: any) {
      setError(err?.message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

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
          <h2>The interface for your detection engine.</h2>
          <p>
            Satellite thermal detections, the candidate events built from them, the years behind them
            and the models in front of them — in one place, with the evidence attached to every number.
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
            <h1>Sign in</h1>
            <p>Use the account your administrator gave you for this installation.</p>
          </div>

          {error ?
          <div className="auth-error" role="alert">
              <Icon name="info" size={14} />
              <span>{error}</span>
            </div> :
          null}

          <label className="auth-field">
            <span>Email address</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              placeholder="you@example.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              autoFocus />
            
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-pass">
              <input
                className="input"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy} />
              
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"}>
                <Icon name={show ? "eye-off" : "eye"} size={15} />
              </button>
            </div>
          </label>

          <div className="auth-row">
            <label className="auth-check">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
              <span>Keep me signed in on this machine</span>
            </label>
            <button type="button" className="link-btn"
            onClick={() => toast("Password resets are handled by your administrator on this installation.", "info")}>
              Forgot password?
            </button>
          </div>

          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className="auth-alt">
            New to this installation? <Link href="/register" className="link-btn">Create an account</Link>
          </div>

          <div className="auth-legal">
            Access is logged. Detections shown must be verified before being called a fire.
          </div>
        </form>
      </main>
    </div>);

}
