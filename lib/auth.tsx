"use client";













import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

export type RoleCode =
"SUPER_ADMIN" |
"REGIONAL_ADMIN" |
"RESIDENT" |


"ADMIN" |
"ANALYST" |
"VIEWER";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleCode: RoleCode;
  organisation: string;
  timezone: string;
  units: string;
  since: string;
  phone: string;
  notifications: {job_finished: boolean;needs_verification: boolean;weekly: boolean;browser: boolean;};
};

export type RegisterForm = {
  name: string;
  email: string;
  organisation: string;
  password: string;
  confirm: string;
  accept: boolean;
  country?: string;
  district?: string;
};

export type DeviceSession = {
  id: string;
  device: string;
  where: string;
  last: string;
  current: boolean;
};

type Stored = {user: User;started: string;token: string;};

type AuthState = {
  ready: boolean;
  user: User | null;
  started: string | null;
  sessions: DeviceSession[];
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (form: RegisterForm, remember: boolean) => Promise<void>;
  signOut: (reason?: string) => void;
  signOutEverywhere: () => void;
  revokeOthers: () => void;
  updateProfile: (patch: Partial<User>) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

const SESSION_KEY = "fireharmonix.session.v1";

export const ROLE_TAG: Record<RoleCode, string> = {
  SUPER_ADMIN: "REC", ADMIN: "REC",
  REGIONAL_ADMIN: "OBS", ANALYST: "OBS",
  RESIDENT: "NV", VIEWER: "NV"
};

export const PERMISSIONS: {label: string;who: RoleCode[];}[] = [
{ label: "See every country, incident and hospital on the platform", who: ["SUPER_ADMIN", "ADMIN"] },
{ label: "See one assigned country only", who: ["REGIONAL_ADMIN", "ANALYST"] },
{ label: "See the incidents, alerts and hospitals near your own district", who: ["RESIDENT", "VIEWER"] },
{ label: "Report a fire with photo, location and description", who: ["SUPER_ADMIN", "ADMIN", "REGIONAL_ADMIN", "ANALYST", "RESIDENT", "VIEWER"] },
{ label: "Verify, respond to or reject an incident", who: ["SUPER_ADMIN", "ADMIN", "REGIONAL_ADMIN", "ANALYST"] },
{ label: "Add and update hospitals and evacuation routes", who: ["SUPER_ADMIN", "ADMIN", "REGIONAL_ADMIN", "ANALYST"] },
{ label: "Publish a Stay Alert for a district", who: ["SUPER_ADMIN", "ADMIN", "REGIONAL_ADMIN", "ANALYST"] },
{ label: "Register private home and farm locations", who: ["SUPER_ADMIN", "ADMIN", "REGIONAL_ADMIN", "ANALYST", "RESIDENT", "VIEWER"] },
{ label: "See anyone else's property coordinates", who: [] },
{ label: "Manage accounts, countries and platform settings", who: ["SUPER_ADMIN", "ADMIN"] }];


const AuthCtx = createContext<AuthState | null>(null);

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

function readSession(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.user || !parsed.user.email) return null;
    return parsed as Stored;
  } catch (e) {
    return null;
  }
}

function writeSession(s: Stored | null, remember: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (s) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
    if (s) sessionStorage.setItem("fireharmonix.token", s.token);else
    sessionStorage.removeItem("fireharmonix.token");
  } catch (e) {}
}

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [started, setStarted] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);

  const loadSessions = useCallback(() => {
    api.get("/api/auth/sessions").
    then((r: any) => setSessions(Array.isArray(r?.sessions) ? r.sessions : [])).
    catch(() => setSessions([]));
  }, []);

  const clear = useCallback(() => {
    writeSession(null, true);
    setUser(null);
    setStarted(null);
    setSessions([]);
  }, []);



  useEffect(() => {
    const stored = readSession();
    if (!stored) {setReady(true);return;}
    setUser(stored.user);
    setStarted(stored.started);
    try {if (stored.token) sessionStorage.setItem("fireharmonix.token", stored.token);} catch (e) {}


    api.get("/api/auth/me").
    then((res: any) => {
      if (res && res.user) setUser((prev) => prev ? { ...prev, ...res.user } : prev);
      loadSessions();
    }).
    catch(() => clear()).
    finally(() => setReady(true));
  }, [clear, loadSessions]);

  const begin = useCallback((res: any, keep: boolean) => {
    if (!res || !res.user) throw new Error("The server did not return an account.");
    const now = new Date().toISOString();
    writeSession({ user: res.user, started: now, token: res.token || "" }, keep);
    setUser(res.user);
    setStarted(now);
    setRemember(keep);
    loadSessions();
  }, [loadSessions]);

  const signIn = useCallback(async (email: string, password: string, keep: boolean) => {
    const mail = email.trim().toLowerCase();
    if (!mail || !password) throw new Error("Enter your email address and your password.");
    begin(await api.post("/api/auth/login", { email: mail, password }), keep);
  }, [begin]);

  const register = useCallback(async (form: RegisterForm, keep: boolean) => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();



    if (name.length < 2) throw new Error("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("That email address does not look complete.");
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password))
    throw new Error("Use at least 8 characters for the password, with letters and a number.");
    if (form.password !== form.confirm) throw new Error("The two passwords are not the same.");
    if (!form.accept) throw new Error("Please accept the terms to continue.");

    begin(await api.post("/api/auth/register", {
      name, email, organisation: form.organisation.trim(), password: form.password,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      country: form.country, district: form.district
    }), keep);
  }, [begin]);

  const signOut = useCallback(() => {
    api.post("/api/auth/logout").catch(() => {});
    clear();
  }, [clear]);

  const signOutEverywhere = useCallback(() => {
    api.post("/api/auth/logout-all").catch(() => {});
    clear();
  }, [clear]);

  const revokeOthers = useCallback(() => {
    api.post("/api/auth/sessions/revoke-others").then(loadSessions).catch(loadSessions);
  }, [loadSessions]);

  const updateProfile = useCallback(
    async (patch: Partial<User>) => {
      if (!user) return;
      const res: any = await api.post("/api/auth/profile", patch);
      const next = res?.user || { ...user, ...patch, notifications: { ...user.notifications, ...(patch.notifications || {}) } };
      setUser(next);
      const stored = readSession();
      if (stored) writeSession({ ...stored, user: next }, remember);
    },
    [user, remember]
  );

  const changePassword = useCallback(
    async (current: string, next: string) => {
      if (!user) throw new Error("You are not signed in.");
      if (next.length < 8) throw new Error("Use at least 8 characters.");
      if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) throw new Error("Use letters and at least one number.");
      await api.post("/api/auth/password", { current, next });
    },
    [user]
  );

  const value: AuthState = {
    ready, user, started, sessions,
    signIn, register, signOut, signOutEverywhere, revokeOthers, updateProfile, changePassword
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}


export const initials = (name: string) =>
name.
split(/\s+/).
filter(Boolean).
slice(0, 2).
map((p) => p[0].toUpperCase()).
join("");

export const avatarHue = (email: string) => {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360;
  return h;
};
