/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-001 .. 009 -- what the HR screens share: who is signed in and what the role may do, the employee list,
// small formatters, tabs and a status badge.
import { ReactNode, useEffect, useState } from 'react';
import { api, currentUser } from '@/shared/services/api';
import { input } from '@/shared/components/FormKit';
import { fmtDate, fmtDateTime, fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export const HR_SCRIPT = 'database_v2/56_hr_and_access.sql (on reftech_hr)';
export const SAFETY_SCRIPT = 'database_v2/57_driver_safety.sql (on reftech_operational)';

export type Me = { userId?: number; username?: string; role?: string; baseRole?: string; employeeId?: number | null; ready?: boolean; safetyReady?: boolean;
  permissions?: string[]; mustChangePassword?: boolean };

let cached: Me | null = null;

/** The login's role and permissions from /api/access/me (cached for the page). */
export function useMe() {
  const [me, setMe] = useState<Me | null>(cached);
  useEffect(() => {
    if (cached) return;
    api('/api/access/me').then((m: Me) => { cached = m; setMe(m); }).catch(() => setMe({ permissions: [] }));
  }, []);
  return me;
}
export function forgetMe() { cached = null; }

/** True when the login may do this. Admin may do everything. */
export function can(me: Me | null, ...perms: string[]) {
  if (!me) return false;
  if (String(me.role || '').toUpperCase() === 'ADMIN' || String(me.baseRole || '').toUpperCase() === 'ADMIN') return true;
  return perms.some(p => (me.permissions || []).includes(p));
}

export function isAdminLogin() {
  const u = currentUser();
  return String(u.baseRole || u.role || '').replace('ROLE_', '').toUpperCase() === 'ADMIN';
}

/** Active employees for the pickers. */
export function useEmployees(all = false) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/api/hr/employees' + (all ? '?all=true' : '')).then(x => setRows(Array.isArray(x) ? x : [])).catch(() => setRows([])); }, [all]);
  return rows;
}

export function EmployeeSelect({ employees, name = 'employeeId', value, onChange, required = true, blank = 'Choose the employee' }: {
  employees: any[]; name?: string; value?: string | number; onChange?: (v: string) => void; required?: boolean; blank?: string;
}) {
  return <select name={name} required={required} className={input} {...(value !== undefined ? { value: String(value ?? '') } : {})} onChange={e => onChange?.(e.target.value)}>
    <option value="">{blank}</option>
    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employeeCode}){e.role ? ' - ' + e.role : ''}</option>)}
  </select>;
}

export const rupee = (v: any) => fmtMoney(v);
export const day = (v: any) => {
  if (!v) return '-';
  const d = new Date(String(v).length <= 10 ? String(v) + 'T00:00:00' : String(v));
  return isNaN(d.getTime()) ? String(v) : fmtDate(v);
};
export const when = (v: any) => {
  if (!v) return '-';
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
export const thisMonth = () => new Date().toISOString().slice(0, 7);
export const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };

const BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800', CANCELLED: 'bg-slate-200 text-slate-700',
  DRAFT: 'bg-amber-100 text-amber-800', PAID: 'bg-sky-100 text-sky-800', ISSUED: 'bg-emerald-100 text-emerald-800', REQUESTED: 'bg-amber-100 text-amber-800',
  DONE: 'bg-emerald-100 text-emerald-800', FAILED: 'bg-red-100 text-red-800', VERIFIED: 'bg-emerald-100 text-emerald-800', ON_FILE: 'bg-emerald-50 text-emerald-700',
  TO_CHECK: 'bg-amber-100 text-amber-800', MISSING: 'bg-red-100 text-red-800', EXPIRING: 'bg-amber-100 text-amber-800', EXPIRED: 'bg-red-200 text-red-900',
  REPLACED: 'bg-slate-200 text-slate-700', OPEN: 'bg-amber-100 text-amber-800', CLOSED: 'bg-slate-200 text-slate-700', OK: 'bg-emerald-100 text-emerald-800',
  DUE_SOON: 'bg-amber-100 text-amber-800', OVERDUE: 'bg-red-100 text-red-800', Good: 'bg-emerald-100 text-emerald-800', Watch: 'bg-amber-100 text-amber-800',
  'At risk': 'bg-red-100 text-red-800', LOW: 'bg-slate-100 text-slate-700', MEDIUM: 'bg-amber-100 text-amber-800', HIGH: 'bg-red-100 text-red-800',
};
export function Badge({ v }: { v: any }) {
  const s = String(v ?? '-');
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[s] || 'bg-slate-100 text-slate-700'}`}>{s.replace(/_/g, ' ')}</span>;
}

export function Tabs({ tabs, value, onChange }: { tabs: [string, ReactNode][]; value: string; onChange: (v: string) => void }) {
  return <div className="mt-4 flex flex-wrap gap-2">
    {tabs.map(([k, t]) => <button key={k} type="button" onClick={() => onChange(k)}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${value === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50'}`}>{t}</button>)}
  </div>;
}

/** Shown when the role may not open this screen. */
export function NoAccess({ what }: { what: string }) {
  return <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">Your role may not {what}. An Admin can give it in Access Control.</div>;
}

/** Runs an action with the busy flag and the message banner. */
export function useRunner(reload?: () => unknown) {
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<any>, ok?: string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(ok || x?.message || 'Saved'); if (reload) await reload(); return x ?? true; }
    catch (e: any) { setErr(e?.message || 'Not saved'); return null; }
    finally { setBusy(false); }
  }
  return { msg, err, busy, run, setMsg, setErr };
}
