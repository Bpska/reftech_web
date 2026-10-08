/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-001, REQ-HR-002 -- Access Control (permission ACCESS_ADMIN, Admin by default).
//   Roles and permissions: which module each role may see (VIEW) or change (EDIT). Admin has everything. A new role
//   picks a base level (Employee, Manager, Admin) that decides its menu; the ticks narrow what it may open.
//   Logins: unlock, reset the password (the person must choose a new one), change the role, switch off.
//   Password policy, sign-in log and the log of every change made here.
// Backend: /api/access/** (AccessController). Needs database_v2/56_hr_and_access.sql on reftech_hr.
import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, HR_SCRIPT, NoAccess, Tabs, can, useMe, useRunner, when } from './hr';

export function AccessControlPage() {
  const me = useMe();
  const [tab, setTab] = useState('roles');
  const [data, setData] = useState<any>(null), [ticks, setTicks] = useState<Record<string, Set<string>>>({});
  const load = () => api('/api/access/roles').then((d: any) => {
    setData(d);
    const t: Record<string, Set<string>> = {};
    for (const r of d.roles || []) t[r.code] = new Set(d.matrix?.[r.code] || []);
    setTicks(t);
  });
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);

  if (me && me.ready === false) return <><h1 className="text-3xl font-bold">Access Control</h1><NotReady script={HR_SCRIPT} /></>;
  if (me && !can(me, 'ACCESS_ADMIN')) return <><h1 className="text-3xl font-bold">Access Control</h1><NoAccess what="change roles and logins" /></>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ShieldCheck />Access Control</h1>
    <p className="text-slate-600">Who may see and change what, the logins, and the password rules.</p>
    <Tabs value={tab} onChange={setTab} tabs={[['roles', 'Roles and permissions'], ['logins', 'Logins'], ['policy', 'Password policy'], ['events', 'Sign-in log'], ['log', 'Change log']]} />
    <Banner msg={r.msg} error={r.err} />
    {tab === 'roles' && data && <Roles data={data} ticks={ticks} setTicks={setTicks} r={r} />}
    {tab === 'logins' && data && <Logins roles={data.roles || []} />}
    {tab === 'policy' && <Policy />}
    {tab === 'events' && <Events />}
    {tab === 'log' && <ChangeLog />}
  </>;
}

function Roles({ data, ticks, setTicks, r }: { data: any; ticks: Record<string, Set<string>>; setTicks: (x: any) => void; r: ReturnType<typeof useRunner> }) {
  const roles = (data.roles || []) as any[];
  const perms = (data.permissions || []) as any[];
  const modules = useMemo(() => Array.from(new Set(perms.map(p => p.module))), [perms]);
  function flip(role: string, code: string) {
    const next = { ...ticks, [role]: new Set(ticks[role] || []) };
    const s = next[role];
    if (s.has(code)) { s.delete(code); if (code.endsWith('_VIEW')) s.delete(code.replace('_VIEW', '_EDIT')); }
    else { s.add(code); if (code.endsWith('_EDIT')) s.add(code.replace('_EDIT', '_VIEW')); }
    setTicks(next);
  }
  const save = (role: string) => r.run(() => api(`/api/access/roles/${role}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions: Array.from(ticks[role] || []) }) }),
    `Permissions of ${role} saved. People with this role see the change when they next open a page.`);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const ok = await r.run(() => api('/api/access/roles', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(f))) }), 'Role added. Tick its permissions below and save.');
    if (ok) f.reset();
  }
  const toggle = (x: any) => r.run(() => api(`/api/access/roles/${x.code}`, { method: 'PATCH', body: JSON.stringify({ active: !x.active }) }));
  return <>
    <Section title="Permissions by role" right={<span className="text-sm text-slate-500">Edit includes View. Admin always has everything.</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50"><th className={th}>Permission</th>
            {roles.map(x => <th key={x.code} className={`${th} text-center`}><div>{x.name}</div><div className="text-xs font-normal text-slate-500">{x.code} - base {x.baseRole}{x.logins !== undefined ? ` - ${x.logins} login(s)` : ''}</div>
              {!x.active && <Badge v="OFF" />}</th>)}</tr></thead>
          <tbody>
            {modules.map(m => <Fragment key={m}>
              <tr className="bg-slate-100"><td colSpan={roles.length + 1} className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">{m}</td></tr>
              {perms.filter(p => p.module === m).map(p => <tr key={p.code} className="border-t">
                <td className={td}><div className="font-semibold">{p.name}</div>{p.description && <div className="text-xs text-slate-500">{p.description}</div>}</td>
                {roles.map(x => <td key={x.code} className={`${td} text-center`}>
                  <input type="checkbox" className="h-4 w-4" disabled={x.code === 'ADMIN'} checked={x.code === 'ADMIN' || (ticks[x.code]?.has(p.code) ?? false)} onChange={() => flip(x.code, p.code)} />
                </td>)}
              </tr>)}
            </Fragment>)}
            <tr className="border-t bg-slate-50"><td className={td}></td>
              {roles.map(x => <td key={x.code} className={`${td} text-center`}>
                {x.code !== 'ADMIN' && <div className="flex flex-col items-center gap-1">
                  <button disabled={r.busy} onClick={() => save(x.code)} className={btnLight}>Save {x.code}</button>
                  {!x.builtIn && <button disabled={r.busy} onClick={() => toggle(x)} className={x.active ? btnRed : btnLight}>{x.active ? 'Switch off' : 'Switch on'}</button>}
                </div>}
              </td>)}</tr>
          </tbody>
        </table>
      </div>
    </Section>
    <Section title="Add a role">
      <form onSubmit={create} className="grid gap-3 md:grid-cols-4">
        <div><label className={label}>Code *</label><input name="code" required placeholder="DISPATCHER" className={input} /></div>
        <div><label className={label}>Name *</label><input name="name" required placeholder="Dispatcher" className={input} /></div>
        <div><label className={label}>Base level *</label><select name="baseRole" required className={input} defaultValue="EMPLOYEE">
          <option value="EMPLOYEE">Employee (staff menu)</option><option value="MANAGER">Manager (staff menu + masters)</option><option value="ADMIN">Admin (everything)</option></select></div>
        <div><label className={label}>What the role is for</label><input name="description" className={input} /></div>
        <div className="md:col-span-full"><button disabled={r.busy} className={btn}>Add role</button></div>
      </form>
    </Section>
  </>;
}

function Logins({ roles }: { roles: any[] }) {
  const [q, setQ] = useState(''), [rows, setRows] = useState<any[]>([]);
  const load = () => api('/api/access/users?q=' + encodeURIComponent(q)).then(x => setRows(Array.isArray(x) ? x : []));
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  const office = roles.filter(x => x.active).map(x => x.code);
  async function reset(u: any) {
    const pw = window.prompt(`New password for ${u.username}.\nLeave empty to make a temporary password.`, '');
    if (pw === null) return;
    const x = await r.run(() => api(`/api/access/users/${u.id}/reset-password`, { method: 'POST', body: JSON.stringify(pw ? { password: pw } : {}) }));
    if (x?.temporaryPassword) r.setMsg(`Temporary password of ${u.username}: ${x.temporaryPassword}\nGive it to the person. A new password must be chosen at sign-in.`);
  }
  return <Section title="Logins" right={<form onSubmit={e => { e.preventDefault(); void load(); }} className="flex gap-2">
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="User name or employee" className={input} /><button className={btnLight}>Search</button></form>}>
    <Banner msg={r.msg} error={r.err} />
    <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
      <thead><tr className="bg-slate-50"><th className={th}>User name</th><th className={th}>Employee</th><th className={th}>Role</th><th className={th}>State</th><th className={th}>Password changed</th><th className={th}>Last sign-in</th><th className={th}></th></tr></thead>
      <tbody>{rows.map(u => <tr key={u.id} className="border-t">
        <td className={`${td} font-semibold`}>{u.username}<div className="text-xs font-normal text-slate-500">{u.userType}</div></td>
        <td className={td}>{u.employeeName || '-'} {u.employeeCode && <span className="text-xs text-slate-500">({u.employeeCode})</span>}</td>
        <td className={td}>{u.userType === 'EMPLOYEE' && !['DRIVER', 'TRANSPORTER'].includes(u.role)
          ? <select value={u.role} disabled={r.busy} onChange={e => r.run(() => api(`/api/access/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ role: e.target.value }) }), `Role of ${u.username} changed; the person signs in again.`)} className={input}>
              {[...new Set([u.role, ...office.filter(c => c !== 'DRIVER')])].map(c => <option key={c} value={c}>{c}</option>)}</select>
          : u.role}</td>
        <td className={td}><div className="flex flex-wrap gap-1">{u.active ? <Badge v="ACTIVE" /> : <Badge v="OFF" />}{u.locked && <Badge v="LOCKED" />}{u.mustChangePassword && <Badge v="MUST CHANGE" />}</div>
          {u.failedLogins > 0 && <div className="text-xs text-slate-500">{u.failedLogins} wrong password(s)</div>}</td>
        <td className={td}>{when(u.passwordChangedAt)}</td>
        <td className={td}>{when(u.lastSignIn)}</td>
        <td className={td}><div className="flex flex-wrap gap-1">
          {u.locked && <button disabled={r.busy} onClick={() => r.run(() => api(`/api/access/users/${u.id}/unlock`, { method: 'POST' }), `${u.username} unlocked`)} className={btnLight}>Unlock</button>}
          <button disabled={r.busy} onClick={() => reset(u)} className={btnLight}>Reset password</button>
          <button disabled={r.busy} onClick={() => r.run(() => api(`/api/access/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ active: !u.active }) }))} className={u.active ? btnRed : btnLight}>{u.active ? 'Switch off' : 'Switch on'}</button>
        </div></td>
      </tr>)}</tbody>
    </table></div>
  </Section>;
}

function Policy() {
  const [p, setP] = useState<any>(null);
  const load = () => api('/api/access/policy').then(setP);
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b: any = Object.fromEntries(f);
    for (const k of ['needUpper', 'needLower', 'needDigit', 'needSymbol']) b[k] = f.get(k) === 'on';
    await r.run(() => api('/api/access/policy', { method: 'PUT', body: JSON.stringify(b) }), 'Password policy saved. It applies to the next password each person sets.');
  }
  if (!p) return <Banner error={r.err} />;
  const num = (n: string, l: string, hint: string) => <div><label className={label}>{l}</label><input name={n} type="number" defaultValue={p[n]} className={input} /><div className="text-xs text-slate-500">{hint}</div></div>;
  const box = (n: string, l: string) => <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name={n} defaultChecked={p[n]} className="h-4 w-4" />{l}</label>;
  return <Section title="Password policy">
    <Banner msg={r.msg} error={r.err} />
    <p className="mb-3 text-sm text-slate-600">{p.text}</p>
    <form key={JSON.stringify(p)} onSubmit={save} className="grid gap-3 md:grid-cols-3">
      {num('minLength', 'Shortest password', '6 to 64 characters')}
      {num('historyCount', 'Cannot reuse the last', 'passwords (0 = no check)')}
      {num('expiryDays', 'Change every', 'days (0 = never)')}
      {num('lockoutAttempts', 'Lock after', 'wrong passwords in a row (0 = never)')}
      {num('lockoutMinutes', 'Locked for', 'minutes')}
      <div className="flex flex-col gap-2 pt-6">{box('needUpper', 'A capital letter')}{box('needLower', 'A small letter')}{box('needDigit', 'A number')}{box('needSymbol', 'A symbol')}</div>
      <div className="md:col-span-full"><button disabled={r.busy} className={btn}>Save policy</button></div>
    </form>
  </Section>;
}

function Events() {
  const [rows, setRows] = useState<any[]>([]), [err, setErr] = useState('');
  useEffect(() => { api('/api/access/login-events?limit=300').then(setRows).catch(e => setErr(e.message)); }, []);
  return <Section title="Sign-in log (newest first)"><Banner error={err} />
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>When</th><th className={th}>User name</th><th className={th}>Result</th><th className={th}>From</th><th className={th}>Browser / by</th></tr></thead>
      <tbody>{rows.map(x => <tr key={x.id} className="border-t"><td className={td}>{when(x.at)}</td><td className={td}>{x.username}</td>
        <td className={td}><span className={x.result === 'OK' ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{String(x.result).replace(/_/g, ' ')}</span></td>
        <td className={td}>{x.ip || '-'}</td><td className={`${td} max-w-md truncate text-xs text-slate-500`}>{x.client || '-'}</td></tr>)}</tbody></table></div>
  </Section>;
}

function ChangeLog() {
  const [rows, setRows] = useState<any[]>([]), [err, setErr] = useState('');
  useEffect(() => { api('/api/access/change-log').then(setRows).catch(e => setErr(e.message)); }, []);
  return <Section title="Changes made in Access Control"><Banner error={err} />
    <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>When</th><th className={th}>By</th><th className={th}>What</th><th className={th}>Detail</th></tr></thead>
      <tbody>{rows.map(x => <tr key={x.id} className="border-t"><td className={td}>{when(x.changedAt)}</td><td className={td}>{x.changedBy}</td><td className={td}>{String(x.what).replace(/_/g, ' ')}</td><td className={td}>{x.detail}</td></tr>)}</tbody></table>
  </Section>;
}
