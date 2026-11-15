"use client";









import React, { useMemo, useState } from "react";
import api from "@/lib/api";
import { useApi, useAction } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/components/providers";
import { fmt } from "@/lib/format";
import { Card, Chip, Field, Icon, Loading, Note, Tag } from "@/components/ui";

const ROLE_NOTE: Record<string, string> = {
  ADMIN: "everything, including settings and accounts",
  ANALYST: "read, run jobs and experiments, verify events",
  VIEWER: "read every page and export a table"
};

const ROLE_TAG: Record<string, string> = {
  SUPER_ADMIN: "REC", ADMIN: "REC",
  REGIONAL_ADMIN: "OBS", ANALYST: "OBS",
  RESIDENT: "NV", VIEWER: "NV"
};


function suggestPassword() {
  const words = ["harbor", "granite", "lantern", "ember", "willow", "cobalt", "meadow", "tundra", "basalt", "orchid"];
  const w = words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
  const n = String(1000 + crypto.getRandomValues(new Uint32Array(1))[0] % 9000);
  return `${w}-${n}-fh`;
}

export function AccountsSection() {
  const { user } = useAuth();
  const { toast } = useApp();
  const act = useAction();
  const list = useApi("/api/users");
  const isAdmin = user?.roleCode === "ADMIN";

  const [form, setForm] = useState({ name: "", email: "", organisation: "", roleCode: "ANALYST", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [resetFor, setResetFor] = useState<any>(null);
  const [newPw, setNewPw] = useState("");

  const d = list.data;
  const rows = useMemo(() => {
    if (!d) return [];
    const q = filter.trim().toLowerCase();
    return d.users.
    slice().
    sort((a: any, b: any) => Number(b.pending) - Number(a.pending) || a.name.localeCompare(b.name)).
    filter((u: any) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q) || u.role.toLowerCase().includes(q));
  }, [d, filter]);

  if (!isAdmin) {
    return (
      <div id="accounts">
        <Card title="Accounts" right={<Tag code="REC" />}>
          <Note kind="warn">
            Only an administrator can create accounts or change roles. You are signed in as{" "}
            <b>{user?.role}</b> — ask an administrator if somebody needs access.
          </Note>
        </Card>
      </div>);

  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast("A name is required.", "bad");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return toast("That email address does not look complete.", "bad");
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password))
    return toast("Use at least 8 characters for the password, with letters and a number.", "bad");
    setBusy(true);
    try {
      await api.post("/api/users", { ...form, name: form.name.trim(), email: form.email.trim() });
      toast(`Account created for ${form.email.trim()}.`, "ok");
      setForm({ name: "", email: "", organisation: "", roleCode: "ANALYST", password: "" });
      list.reload();
    } catch (err: any) {
      toast(err?.message || "The account could not be created.", "bad");
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (u: any, roleCode: string) => {
    if (roleCode === u.roleCode) return;
    try {
      await api.post(`/api/users/${u.id}/role`, { roleCode });
      toast(`${u.name} is now ${roleCode === "ADMIN" ? "an administrator" : roleCode === "ANALYST" ? "an analyst" : "a viewer"}.`, "ok");
      list.reload();
    } catch (err: any) {
      toast(err?.message || "The role could not be changed.", "bad");
    }
  };

  const approve = async (u: any) => {
    try {
      await api.post(`/api/users/${u.id}/approve`, {});
      toast(`${u.name} approved as an analyst.`, "ok");
      list.reload();
    } catch (err: any) {
      toast(err?.message || "The request could not be approved.", "bad");
    }
  };

  const setDisabled = async (u: any, disabled: boolean) => {
    try {
      await api.post(`/api/users/${u.id}/disabled`, { disabled });
      toast(disabled ? `${u.name} can no longer sign in.` : `${u.name} can sign in again.`, "ok");
      list.reload();
    } catch (err: any) {
      toast(err?.message || "The account could not be changed.", "bad");
    }
  };

  const savePassword = async () => {
    if (!resetFor) return;
    setBusy(true);
    try {
      await api.post(`/api/users/${resetFor.id}/password`, { password: newPw });
      toast(`Password reset for ${resetFor.email}. Their other devices are signed out.`, "ok");
      setResetFor(null);
      setNewPw("");
    } catch (err: any) {
      toast(err?.message || "The password could not be reset.", "bad");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: any) => {
    if (!window.confirm(`Delete the account ${u.email}? The audit trail keeps the record of what it did.`)) return;
    try {
      await api.delete(`/api/users/${u.id}`);
      toast(`${u.email} deleted.`, "ok");
      list.reload();
    } catch (err: any) {
      toast(err?.message || "The account could not be deleted.", "bad");
    }
  };

  return (
    <div className="stack gap-4" id="accounts">
      {list.error ?
      <Card title="Accounts" right={<Tag code="REC" />}>
          <Note kind="warn">
            {list.error.includes("401") ?
          "The server did not accept this session for account management. Sign in again." :
          list.error}
          </Note>
        </Card> :
      null}

      {d?.counts ?
      <div className="acct-kpis">
          <div className="acct-kpi"><span className="label">Accounts</span><b>{fmt.n(d.counts.total)}</b></div>
          <div className="acct-kpi"><span className="label">Administrators</span><b>{fmt.n(d.counts.admins)}</b></div>
          <div className={"acct-kpi" + (d.counts.pending ? " hot" : "")}><span className="label">Waiting approval</span><b>{fmt.n(d.counts.pending)}</b></div>
          <div className="acct-kpi"><span className="label">Disabled</span><b>{fmt.n(d.counts.disabled)}</b></div>
        </div> :
      null}

      <div className="grid cols-2-flex440">
        {}
        <Card title="Create an account" subtitle="The person can sign in immediately with the password you set here." right={<Tag code="REC" />}>
          <form onSubmit={create} className="stack gap-3">
            <Field label="Full name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Who is this for" disabled={busy} />
            </Field>
            <Field label="Email address" hint="Also their sign-in name.">
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@organisation.org" disabled={busy} />
            </Field>
            <Field label="Organisation" hint="Optional. Printed on exported reports.">
              <input className="input" value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })}
              placeholder="Not set" disabled={busy} />
            </Field>
            <Field label="Role" hint={ROLE_NOTE[form.roleCode]}>
              <select className="input" value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })} disabled={busy}>
                <option value="VIEWER">Viewer — read only</option>
                <option value="ANALYST">Analyst — read, run and verify</option>
                <option value="ADMIN">Administrator — everything</option>
              </select>
            </Field>
            <Field label="Temporary password" hint="At least 8 characters, letters and a number. They can change it in their profile.">
              <div style={{ display: "flex", gap: 6 }}>
                <input className="input" type={showPw ? "text" : "password"} value={form.password} style={{ flex: 1 }}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Set one, or suggest" disabled={busy} />
                <button type="button" className="btn btn-sm" title="Show the password"
                onClick={() => setShowPw((s) => !s)}><Icon name={showPw ? "eye-off" : "eye"} size={13} /></button>
                <button type="button" className="btn btn-sm" title="Suggest a password"
                onClick={() => {setForm({ ...form, password: suggestPassword() });setShowPw(true);}}>
                  Suggest
                </button>
              </div>
            </Field>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </button>
              <button type="button" className="btn" disabled={busy}
              onClick={() => setForm({ name: "", email: "", organisation: "", roleCode: "ANALYST", password: "" })}>
                Clear
              </button>
            </div>
          </form>
          <Note>
            Creating an account here is the same record as a request that arrives through the public
            sign-up page — it just skips the wait. Either way it is logged with your name on it.
          </Note>
        </Card>

        {}
        <Card title="Who has access" subtitle="Roles decide what the server accepts, not what the page shows."
        right={<Tag code="OBS" />} pad={false}>
          <div className="acct-toolbar">
            <div className="search-wrap" style={{ flex: 1 }}>
              <span className="s-ico"><Icon name="search" size={13} /></span>
              <input className="input" placeholder="Find a name, email or role" value={filter}
              onChange={(e) => setFilter(e.target.value)} />
            </div>
            <button className="btn btn-sm" onClick={list.reload}><Icon name="refresh" size={12} />Reload</button>
          </div>

          {!d ? <Loading /> :
          <div className="scroll-x" style={{ maxHeight: 560, overflowY: "auto" }}>
              <table className="grid-table acct-table">
                <thead>
                  <tr><th>Account</th><th>Role</th><th>State</th><th>Last sign-in</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((u: any) =>
                <tr key={u.id} className={u.pending ? "acct-pending" : ""}>
                      <td>
                        <b>{u.name}</b>
                        {u.id === user?.id ? <span className="hint-sm" style={{ marginLeft: 6 }}>(you)</span> : null}
                        <div className="hint-sm">{u.email}{u.organisation && u.organisation !== "—" ? ` · ${u.organisation}` : ""}</div>
                      </td>
                      <td>
                        <Chip code={ROLE_TAG[u.roleCode]} label={u.role} />
                        <select className="acct-role" value={u.roleCode} disabled={u.id === user?.id}
                    onChange={(e) => changeRole(u, e.target.value)} title="Change the role">
                          <option value="VIEWER">Viewer</option>
                          <option value="ANALYST">Analyst</option>
                          <option value="ADMIN">Administrator</option>
                        </select>
                      </td>
                      <td>
                        {u.disabled ? <Chip code="FAILED" label="Disabled" /> :
                    u.pending ? <Chip code="PENDING" label="Awaiting approval" /> :
                    <Chip code="ACTIVE" label="Active" />}
                      </td>
                      <td className="muted">{u.last_sign_in ? fmt.t(u.last_sign_in) : "Never"}</td>
                      <td className="r" style={{ whiteSpace: "nowrap" }}>
                        {u.pending ?
                    <button className="btn btn-sm btn-primary" onClick={() => approve(u)}>Approve</button> :
                    null}
                        <button className="btn btn-sm" style={{ marginLeft: 4 }} title="Set a new password"
                    onClick={() => {setResetFor(u);setNewPw(suggestPassword());}}>Password</button>
                        <button className="btn btn-sm" style={{ marginLeft: 4 }}
                    disabled={u.id === user?.id}
                    onClick={() => setDisabled(u, !u.disabled)}>{u.disabled ? "Enable" : "Disable"}</button>
                        <button className="btn btn-sm btn-danger" style={{ marginLeft: 4 }}
                    disabled={u.id === user?.id} onClick={() => remove(u)}>Delete</button>
                      </td>
                    </tr>
                )}
                  {!rows.length ?
                <tr><td colSpan={5} className="muted" style={{ padding: 16 }}>No account matches “{filter}”.</td></tr> :
                null}
                </tbody>
              </table>
            </div>
          }

          <div style={{ padding: 12, borderTop: "1px solid var(--line-soft)" }}>
            <div className="hint-sm">
              Deleting an account removes access; the audit trail keeps the record of what it did.
              The last administrator cannot be removed or demoted.
            </div>
          </div>
        </Card>
      </div>

      {resetFor ?
      <div className="acct-modal" role="dialog" aria-modal="true">
          <div className="acct-modal-in">
            <div className="acct-modal-h">
              <b>Set a new password</b>
              <button className="btn btn-ghost btn-sm" aria-label="Close" onClick={() => setResetFor(null)}>
                <Icon name="close" size={13} />
              </button>
            </div>
            <p className="hint-sm" style={{ marginBottom: 10 }}>
              For <b>{resetFor.email}</b>. Their other devices will be signed out; this browser is not.
            </p>
            <Field label="New password" hint="At least 8 characters, letters and a number.">
              <div style={{ display: "flex", gap: 6 }}>
                <input className="input" style={{ flex: 1 }} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                <button className="btn btn-sm" onClick={() => setNewPw(suggestPassword())}>Suggest</button>
              </div>
            </Field>
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setResetFor(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePassword} disabled={busy}>Set password</button>
            </div>
          </div>
        </div> :
      null}
    </div>);

}
