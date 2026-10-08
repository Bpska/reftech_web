/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-001 -- the list and the actions on the logins of one partner (customer) company. Used by Partner Users
// (staff: /api/platform/partner-users?partnerId=) and My Company Users (PARTNER_ADMIN: /api/partner-account/users).
import { FormEvent, useState } from 'react';
import { KeyRound, Lock, Plus, Power, Unlock, UserCog } from 'lucide-react';
import { api } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { Badge, useRunner, when } from '@/modules/hr/hr';

export const PARTNER_ROLES: [string, string][] = [
  ['PARTNER_ADMIN', 'Partner Admin - manages the logins of the company'],
  ['PARTNER_USER', 'Partner User - books loads, sees trips, stock and bills'],
  ['PARTNER_VIEWER', 'Partner Viewer - read only'],
];
const ROLE_NAME: Record<string, string> = { PARTNER_ADMIN: 'Partner Admin', PARTNER_USER: 'Partner User', PARTNER_VIEWER: 'Partner Viewer' };

/** base: the address of the list; query: '?partnerId=5' for staff, '' for the partner's own page; selfId: the own login (cannot lock or deactivate itself). */
export function PartnerLoginsManager({ base, query, selfId, exportName }: { base: string; query: string; selfId?: number; exportName?: string }) {
  const [reload, setReload] = useState(0), [adding, setAdding] = useState(false), [editing, setEditing] = useState<any>(null), [events, setEvents] = useState<any[] | null>(null);
  const r = useRunner(async () => { setReload(x => x + 1); });
  const path = (id: number, action = '') => `${base}/${id}${action ? '/' + action : ''}${query}`;
  const partnerId = new URLSearchParams(query.replace(/^\?/, '')).get('partnerId');

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), form = e.currentTarget;
    if (f.get('password') !== f.get('confirm')) { r.setErr('The two passwords are not the same.'); return; }
    const body: Record<string, unknown> = Object.fromEntries(['fullName', 'email', 'mobile', 'username', 'password', 'partnerRole'].map(k => [k, f.get(k)]));
    if (partnerId) body.partnerId = Number(partnerId);
    const ok = await r.run(() => api(base, { method: 'POST', body: JSON.stringify(body) }), 'Login added. It must choose its own password at the first sign-in.');
    if (ok) { form.reset(); setAdding(false); }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(['fullName', 'email', 'mobile', 'partnerRole'].map(k => [k, f.get(k)]));
    const x = await r.run(() => api(path(editing.id), { method: 'PUT', body: JSON.stringify(body) }), 'Saved');
    if (x) setEditing(x);
  }
  async function resetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), form = e.currentTarget;
    if (f.get('password') !== f.get('confirm')) { r.setErr('The two passwords are not the same.'); return; }
    const ok = await r.run(() => api(path(editing.id, 'reset-password'), { method: 'POST', body: JSON.stringify({ password: f.get('password') }) }));
    if (ok) form.reset();
  }
  async function act(row: any, action: string, ok: string) {
    if (action === 'deactivate' && !window.confirm(`Deactivate ${row.username}? It cannot sign in any more and is signed out now.`)) return;
    const x = await r.run(() => api(path(row.id, action), { method: 'POST' }), ok);
    if (x && editing?.id === row.id) setEditing(x);
  }
  async function showEvents() {
    try { setEvents(await api(`${base}/events${query}${query ? '&' : '?'}limit=100`)); } catch (e: any) { r.setErr(e.message); }
  }

  return <>
    <Banner msg={r.msg} />
    {r.err && <div role="alert" className="my-3 whitespace-pre-line rounded-xl bg-red-50 p-3 text-red-800">{r.err}</div>}
    <Section title="Logins" right={<div className="flex gap-2">
      <button type="button" className={btnLight} onClick={showEvents}>History</button>
      <button type="button" className={btn} onClick={() => setAdding(x => !x)}><Plus aria-hidden className="mr-1 inline h-4 w-4" />Add login</button>
    </div>}>
      {adding && <form onSubmit={add} className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-3">
        <label className={label}>Full name *<input name="fullName" required maxLength={160} className={input} /></label>
        <label className={label}>Email<input name="email" type="email" className={input} /></label>
        <label className={label}>Mobile<input name="mobile" inputMode="tel" className={input} /></label>
        <label className={label}>User name *<input name="username" required minLength={3} maxLength={60} autoComplete="off" className={input} /></label>
        <label className={label}>Password *<input name="password" type="password" required autoComplete="new-password" className={input} /></label>
        <label className={label}>Password again *<input name="confirm" type="password" required autoComplete="new-password" className={input} /></label>
        <label className={`${label} md:col-span-2`}>Partner role<select name="partnerRole" defaultValue="PARTNER_USER" className={input}>{PARTNER_ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <div className="flex items-end gap-2"><button disabled={r.busy} className={btn}>Add login</button><button type="button" className={btnLight} onClick={() => setAdding(false)}>Cancel</button></div>
        <p className="text-xs text-slate-500 md:col-span-3">The user name must be new in the whole of RefTech. The person must choose a new password at the first sign-in.</p>
      </form>}
      <DataTable path={base} params={partnerId ? { partnerId } : {}} reloadKey={`${reload}-${base}-${query}`} exportName={exportName}
        searchPlaceholder="Search name, user name, email, mobile"
        filters={[{ name: 'role', label: 'Role', options: PARTNER_ROLES.map(([v]) => [v, ROLE_NAME[v]]) }, { name: 'active', label: 'Active', options: [['true', 'Active'], ['false', 'Deactivated']] }]}
        columns={[
          { key: 'fullName', label: 'Name', sort: 'fullName', render: x => <><b>{x.fullName || '-'}</b>{selfId === x.id && <span className="ml-1 text-xs text-slate-500">(you)</span>}</> },
          { key: 'username', label: 'User name', sort: 'username', className: 'font-mono' },
          { key: 'email', label: 'Email / mobile', render: x => <>{x.email || '-'}<div className="text-xs text-slate-500">{x.mobile || ''}</div></> },
          { key: 'partnerRole', label: 'Role', render: x => ROLE_NAME[x.partnerRole] || x.partnerRole },
          { key: 'active', label: 'Status', render: x => <div className="flex flex-wrap gap-1"><Badge v={x.active ? 'ACTIVE' : 'DEACTIVATED'} />{x.locked && <Badge v="LOCKED" />}{x.mustChangePassword && <Badge v="NEW_PASSWORD_DUE" />}</div> },
          { key: 'lastLoginAt', label: 'Last sign-in', sort: 'lastLoginAt', render: x => when(x.lastLoginAt) },
          { key: 'id', label: 'Actions', render: x => <div className="flex flex-wrap gap-1">
            <button type="button" className={btnLight} onClick={() => setEditing(x)} aria-label={`Manage ${x.username}`}><UserCog aria-hidden className="mr-1 inline h-4 w-4" />Manage</button>
            {x.locked
              ? <button type="button" className={btnLight} disabled={r.busy} onClick={() => act(x, 'unlock', 'Unlocked')}><Unlock aria-hidden className="mr-1 inline h-4 w-4" />Unlock</button>
              : selfId !== x.id && x.active && <button type="button" className={btnLight} disabled={r.busy} onClick={() => act(x, 'lock', 'Locked. It cannot sign in until it is unlocked.')}><Lock aria-hidden className="mr-1 inline h-4 w-4" />Lock</button>}
            {x.active
              ? selfId !== x.id && <button type="button" className={btnRed} disabled={r.busy} onClick={() => act(x, 'deactivate', 'Deactivated and signed out')}><Power aria-hidden className="mr-1 inline h-4 w-4" />Deactivate</button>
              : <button type="button" className={btnLight} disabled={r.busy} onClick={() => act(x, 'reactivate', 'Reactivated')}><Power aria-hidden className="mr-1 inline h-4 w-4" />Reactivate</button>}
          </div> },
        ]} />
    </Section>

    {editing && <Section title={`Manage ${editing.username}`} right={<button type="button" className={btnLight} onClick={() => setEditing(null)}>Close</button>}>
      <form key={editing.id + '-' + editing.partnerRole} onSubmit={save} className="grid gap-3 md:grid-cols-4">
        <label className={label}>Full name *<input name="fullName" required defaultValue={editing.fullName || ''} className={input} /></label>
        <label className={label}>Email<input name="email" type="email" defaultValue={editing.email || ''} className={input} /></label>
        <label className={label}>Mobile<input name="mobile" defaultValue={editing.mobile || ''} className={input} /></label>
        <label className={label}>Partner role
          <select name="partnerRole" defaultValue={editing.partnerRole} disabled={selfId === editing.id} className={input}>{PARTNER_ROLES.map(([v]) => <option key={v} value={v}>{ROLE_NAME[v]}</option>)}</select>
          {selfId === editing.id && <input type="hidden" name="partnerRole" value={editing.partnerRole} />}
        </label>
        <div className="md:col-span-4"><button disabled={r.busy} className={btn}>Save details</button></div>
      </form>
      <form onSubmit={resetPassword} className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-4">
        <p className="flex items-center gap-1 font-semibold md:col-span-4"><KeyRound aria-hidden className="h-4 w-4" />Reset password</p>
        <label className={label}>New password<input name="password" type="password" required autoComplete="new-password" className={input} /></label>
        <label className={label}>New password again<input name="confirm" type="password" required autoComplete="new-password" className={input} /></label>
        <div className="flex items-end"><button disabled={r.busy} className={btnLight}>Reset password</button></div>
        <p className="text-xs text-slate-500 md:col-span-4">The login is signed out and must choose its own password at the next sign-in.</p>
      </form>
    </Section>}

    {events && <Section title="History" right={<button type="button" className={btnLight} onClick={() => setEvents(null)}>Close</button>}>
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th scope="col" className="px-2.5 py-2 text-left">When</th><th scope="col" className="px-2.5 py-2 text-left">Login</th>
        <th scope="col" className="px-2.5 py-2 text-left">What</th><th scope="col" className="px-2.5 py-2 text-left">By</th></tr></thead>
        <tbody>{events.map(e => <tr key={e.id} className="border-t"><td className="px-2.5 py-2">{when(e.doneAt)}</td><td className="px-2.5 py-2 font-mono">{e.username || '-'}</td>
          <td className="px-2.5 py-2"><Badge v={e.action} /> {e.detail}</td><td className="px-2.5 py-2">{e.doneBy}</td></tr>)}
          {events.length === 0 && <tr><td colSpan={4} className="px-2.5 py-2 text-slate-500">Nothing yet</td></tr>}</tbody></table>
    </Section>}
  </>;
}
