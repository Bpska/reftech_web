/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-CC-006 -- Compliance Register: one list of dated documents with reminders at 30, 15 and 7 days.
//
// Vehicle fitness, insurance, permit, pollution certificate, FSSAI licence and sensor calibration are
// recorded here. Driver licences are shown in the same list but come from the employee record in HR,
// so they are typed in one place only. A truck whose fitness certificate has expired is refused on
// Create Trip and on Start Trip; the server decides (ComplianceService).
// Everyone on staff can read the register; a Manager or an Admin can change it.
//
// Backend: /api/compliance (ComplianceController).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { fmtDate, fmtDateTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Doc = {
  id: number; source: 'REGISTER' | 'HR'; docType: string; docTypeLabel: string; subjectType: string; subjectLabel?: string | null;
  vehicleId?: number | null; warehouseId?: number | null; documentNumber?: string | null; issuedBy?: string | null; reference?: string | null;
  issueDate?: string | null; expiryDate: string; remarks?: string | null; active: boolean; daysLeft: number; state: string; blocksTrips: boolean; editable: boolean; recordedBy?: string | null;
};
type Summary = { expired: number; due7: number; due15: number; due30: number; valid: number; dueCount: number; blockedVehicles: number; today?: string };
type TypeOption = { code: string; label: string; subjects: string[]; blocksTrips: boolean };
type Options = { types: TypeOption[]; vehicles: { id: number; vehicleNumber: string }[]; warehouses: { id: number; name: string }[]; reminderDays: number[]; canEdit: boolean };
type Reminder = { id: number; subject: string; docType: string; expiryDate: string; stageDays: number; daysLeft: number; emailed: boolean; emailTo?: string | null; createdAt: string };
type Filter = 'DUE' | 'EXPIRED' | 'ALL';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900';
const small = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900';
const label = 'mb-1.5 block text-sm font-semibold text-slate-700';
const cell = 'px-2.5 py-3';
const SUBJECT: Record<string, string> = { VEHICLE: 'Truck', WAREHOUSE: 'Warehouse', COMPANY: 'Company', DRIVER: 'Driver' };
const STATE: Record<string, [string, string]> = {
  EXPIRED: ['Expired', 'bg-red-100 text-red-800'], DUE_7: ['Within 7 days', 'bg-orange-100 text-orange-800'], DUE_15: ['Within 15 days', 'bg-amber-100 text-amber-800'],
  DUE_30: ['Within 30 days', 'bg-yellow-100 text-yellow-800'], VALID: ['Valid', 'bg-emerald-100 text-emerald-800'], REPLACED: ['Replaced', 'bg-slate-200 text-slate-600'],
};
const day = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDate(String(v).slice(0, 10));
};
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const daysText = (d: Doc) => !d.active ? '-' : d.daysLeft < 0 ? `${-d.daysLeft} day${d.daysLeft === -1 ? '' : 's'} ago` : d.daysLeft === 0 ? 'today' : `in ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`;
const stageText = (r: Reminder) => r.stageDays === 0 ? (r.daysLeft < 0 ? 'Expired' : 'Expires today') : `${r.stageDays} days before expiry`;
const errorText = (x: unknown, fallback: string) => (x instanceof Error ? x.message : fallback);

export function ComplianceRegisterPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [kind, setKind] = useState('');
  const [replaced, setReplaced] = useState(false);
  const [newType, setNewType] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [renewId, setRenewId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, s, r] = await Promise.all([api(`/api/compliance/documents${replaced ? '?all=true' : ''}`), api('/api/compliance/summary'), api('/api/compliance/reminders?limit=50')]);
      setDocs(Array.isArray(d) ? d : []); setSummary(s); setReminders(Array.isArray(r) ? r : []);
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the compliance register') }); }
    finally { setLoaded(true); }
  }, [replaced]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { api('/api/compliance/options').then(setOptions).catch(() => setOptions(null)); }, []);

  async function run(action: () => Promise<unknown>, done: (r: any) => string) {
    setBusy(true); setMsg(null);
    try { const r = await action(); await load(); setMsg({ ok: true, text: done(r) }); return true; }   // the message appears once the list is up to date
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not save') }); return false; }
    finally { setBusy(false); }
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    if (await run(() => api('/api/compliance/documents', { method: 'POST', body: JSON.stringify(body) }), r => `${r.docTypeLabel} of ${r.subjectLabel} added, valid until ${day(r.expiryDate)}.`)) { form.reset(); setNewType(''); setNewSubject(''); }
  }
  async function renew(e: FormEvent<HTMLFormElement>, d: Doc) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (await run(() => api(`/api/compliance/documents/${d.id}/renew`, { method: 'POST', body: JSON.stringify(body) }), r => `${d.docTypeLabel} of ${d.subjectLabel} renewed, valid until ${day(r.expiryDate)}.`)) setRenewId(null);
  }
  async function edit(e: FormEvent<HTMLFormElement>, d: Doc) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (await run(() => api(`/api/compliance/documents/${d.id}`, { method: 'PUT', body: JSON.stringify(body) }), () => `${d.docTypeLabel} of ${d.subjectLabel} corrected.`)) setEditId(null);
  }
  const remove = (d: Doc) => run(() => api(`/api/compliance/documents/${d.id}`, { method: 'DELETE' }), () => `${d.docTypeLabel} of ${d.subjectLabel} removed from the register.`);
  const runReminders = () => run(() => api('/api/compliance/reminders/run', { method: 'POST', body: '{}' }),
    r => r.created === 0 ? 'No new reminder: every document is in the same stage as at the last run.' : `${r.created} new reminder${r.created === 1 ? '' : 's'} raised${r.emailedTo ? ` and emailed to ${r.emailedTo}` : ''}.`);

  if (!localStorage.getItem('reftech_token')) return <div className="p-10">Please sign in.</div>;

  const canEdit = Boolean(options?.canEdit);
  const type = options?.types.find(t => t.code === newType);
  const subjects = type?.subjects || [];
  const subject = subjects.length === 1 ? subjects[0] : newSubject;
  const shown = docs.filter(d => (!kind || d.docType === kind) && (filter === 'ALL' || (filter === 'EXPIRED' ? d.state === 'EXPIRED' : d.active && d.state !== 'VALID')));
  const tile = (name: string, n: number | undefined, tone: string) => <div className={`rounded-xl p-4 ${tone}`}><div className="text-2xl font-black">{n ?? '-'}</div><div className="font-bold">{name}</div></div>;
  const tab = (f: Filter, text: string) => <button key={f} onClick={() => setFilter(f)} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === f ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{text}</button>;
  const blockingKinds = (options?.types || []).filter(t => t.blocksTrips).map(t => t.label.toLowerCase()).join(', ');

  return <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><ShieldCheck className="h-8 w-8 text-sky-700" />Compliance Register</h1>
        <p className="text-slate-600">Dated documents of trucks, warehouses, the company and drivers, with reminders {(options?.reminderDays || [30, 15, 7]).join(', ')} days before expiry.</p>
      </div>
      <button type="button" onClick={() => { void load(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400"><RefreshCw className="h-4 w-4" />Refresh</button>
    </div>
    {msg && <div role="status" className={`my-4 rounded-xl p-3 font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}

    <div className="mt-4 grid gap-3 md:grid-cols-5">
      {tile('Expired', summary?.expired, 'bg-red-50 text-red-700')}
      {tile('Within 7 days', summary?.due7, 'bg-orange-50 text-orange-700')}
      {tile('Within 15 days', summary?.due15, 'bg-amber-50 text-amber-700')}
      {tile('Within 30 days', summary?.due30, 'bg-yellow-50 text-yellow-700')}
      {tile('Valid', summary?.valid, 'bg-emerald-50 text-emerald-700')}
    </div>
    {(summary?.blockedVehicles || 0) > 0 && <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{summary?.blockedVehicles} truck{summary?.blockedVehicles === 1 ? '' : 's'} cannot be put on a trip: the {blockingKinds || 'fitness certificate'} has expired. Renew it below.</p>}

    {/* ------------------------------------------------------------ add a document */}
    {canEdit && <form id="add-document" onSubmit={add} className="mt-4 scroll-mt-6 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">Add a document</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <div><label className={label} htmlFor="doc-type">Document *</label><select id="doc-type" name="docType" required value={newType} onChange={e => { setNewType(e.target.value); setNewSubject(''); }} className={input}><option value="">Select document</option>{(options?.types || []).filter(t => t.subjects.length > 0).map(t => <option key={t.code} value={t.code}>{t.label}</option>)}</select></div>
        {subjects.length > 1 && <div><label className={label} htmlFor="doc-subject">For *</label><select id="doc-subject" name="subjectType" required value={newSubject} onChange={e => setNewSubject(e.target.value)} className={input}><option value="">Select</option>{subjects.map(s => <option key={s} value={s}>{SUBJECT[s] || s}</option>)}</select></div>}
        {subject === 'VEHICLE' && <div><label className={label} htmlFor="doc-vehicle">Truck *</label><select id="doc-vehicle" name="vehicleId" required className={input}><option value="">Select truck</option>{(options?.vehicles || []).map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select></div>}
        {subject === 'WAREHOUSE' && <div><label className={label} htmlFor="doc-warehouse">Warehouse *</label><select id="doc-warehouse" name="warehouseId" required className={input}><option value="">Select warehouse</option>{(options?.warehouses || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>}
        {newType === 'CALIBRATION' && <div><label className={label} htmlFor="doc-reference">Sensor id *</label><input id="doc-reference" name="reference" required maxLength={120} className={input} placeholder="TEMP-SENSOR-01" /></div>}
        <div><label className={label} htmlFor="doc-number">Document number</label><input id="doc-number" name="documentNumber" maxLength={80} className={input} /></div>
        <div><label className={label} htmlFor="doc-issued-by">Issued by</label><input id="doc-issued-by" name="issuedBy" maxLength={160} className={input} placeholder="RTO Bhubaneswar" /></div>
        <div><label className={label} htmlFor="doc-issue">Issue date</label><input id="doc-issue" name="issueDate" type="date" className={input} /></div>
        <div><label className={label} htmlFor="doc-expiry">Expiry date *</label><input id="doc-expiry" name="expiryDate" type="date" required className={input} /></div>
        <div className="md:col-span-2"><label className={label} htmlFor="doc-remarks">Remarks</label><input id="doc-remarks" name="remarks" maxLength={500} className={input} /></div>
      </div>
      <button disabled={busy} className="mt-5 rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white disabled:opacity-50">Add document</button>
      <p className="mt-3 text-sm text-slate-500">A driver licence is not added here. It comes from the employee record: HR &gt; Add Employee / Driver.{type?.blocksTrips ? ` An expired ${type.label.toLowerCase()} stops the truck from being put on a trip.` : ''}</p>
    </form>}

    {/* ------------------------------------------------------------ the list */}
    <section id="documents" className="mt-4 scroll-mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Documents ({shown.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Kind of document" value={kind} onChange={e => setKind(e.target.value)} className={small}><option value="">All kinds</option>{(options?.types || []).map(t => <option key={t.code} value={t.code}>{t.label}</option>)}</select>
          {tab('ALL', 'All')}{tab('DUE', 'Due within 30 days')}{tab('EXPIRED', 'Expired')}
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={replaced} onChange={e => setReplaced(e.target.checked)} />Show replaced</label>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className={cell}>Document</th><th className={cell}>For</th><th className={cell}>Number</th><th className={cell}>Expiry date</th><th className={cell}>Expires</th><th className={cell}>Status</th><th className={cell}></th></tr></thead>
        <tbody>
          {shown.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">{loaded ? (docs.length === 0 ? 'No document is recorded yet.' : 'No document matches this filter.') : 'Loading...'}</td></tr>}
          {shown.map(d => {
            const [text, tone] = STATE[d.state] || [d.state, 'bg-slate-100 text-slate-700'];
            const key = `${d.source}-${d.id}`;
            return <tr key={key} className={`border-t border-slate-200 align-top ${d.active ? '' : 'text-slate-400'}`}>
              <td className={cell}><div className="font-semibold">{d.docTypeLabel}</div>{d.reference ? <div className="text-xs text-slate-500">{d.reference}</div> : null}</td>
              <td className={cell}><div className="font-semibold">{d.subjectLabel || '-'}</div><div className="text-xs text-slate-500">{SUBJECT[d.subjectType] || d.subjectType}{d.source === 'HR' ? ', from HR' : ''}</div></td>
              <td className={cell}>{d.documentNumber || '-'}{d.issuedBy ? <div className="text-xs text-slate-500">{d.issuedBy}</div> : null}</td>
              <td className={`${cell} whitespace-nowrap`}>{day(d.expiryDate)}</td>
              <td className={`${cell} whitespace-nowrap`}>{daysText(d)}</td>
              <td className={cell}><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{text}</span>{d.blocksTrips && <div className="mt-1 text-xs font-semibold text-red-700">Truck blocked for trips</div>}</td>
              <td className={`${cell} text-right`}>
                {d.source === 'HR' && <span className="text-xs text-slate-500">Change it in HR</span>}
                {canEdit && d.editable && renewId !== d.id && editId !== d.id && <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => { setRenewId(d.id); setEditId(null); setMsg(null); }} className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white">Renew...</button>
                  <button type="button" onClick={() => { setEditId(d.id); setRenewId(null); setMsg(null); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Correct...</button>
                  <button type="button" disabled={busy} onClick={() => { void remove(d); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Remove</button>
                </div>}
                {canEdit && renewId === d.id && <form onSubmit={e => renew(e, d)} className="flex flex-wrap items-end justify-end gap-2 text-left">
                  <label className="text-xs font-semibold text-slate-600">New number<input name="documentNumber" maxLength={80} placeholder={d.documentNumber || ''} className={`${small} mt-1 block w-36`} /></label>
                  <label className="text-xs font-semibold text-slate-600">Issue date<input name="issueDate" type="date" className={`${small} mt-1 block`} /></label>
                  <label className="text-xs font-semibold text-slate-600">New expiry date *<input name="expiryDate" type="date" required className={`${small} mt-1 block`} /></label>
                  <button disabled={busy} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save renewal</button>
                  <button type="button" onClick={() => setRenewId(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Back</button>
                </form>}
                {canEdit && editId === d.id && <form onSubmit={e => edit(e, d)} className="flex flex-wrap items-end justify-end gap-2 text-left">
                  <label className="text-xs font-semibold text-slate-600">Number<input name="documentNumber" maxLength={80} defaultValue={d.documentNumber || ''} className={`${small} mt-1 block w-36`} /></label>
                  <label className="text-xs font-semibold text-slate-600">Issued by<input name="issuedBy" maxLength={160} defaultValue={d.issuedBy || ''} className={`${small} mt-1 block w-36`} /></label>
                  <label className="text-xs font-semibold text-slate-600">Issue date<input name="issueDate" type="date" defaultValue={d.issueDate || ''} className={`${small} mt-1 block`} /></label>
                  <label className="text-xs font-semibold text-slate-600">Expiry date *<input name="expiryDate" type="date" required defaultValue={d.expiryDate} className={`${small} mt-1 block`} /></label>
                  <input type="hidden" name="remarks" value={d.remarks || ''} />
                  <button disabled={busy} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save</button>
                  <button type="button" onClick={() => setEditId(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Back</button>
                </form>}
              </td>
            </tr>;
          })}
        </tbody>
      </table></div>
    </section>

    {/* ------------------------------------------------------------ reminders */}
    <section id="reminders" className="mt-4 scroll-mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarClock className="h-5 w-5 text-sky-700" />Reminders ({reminders.length})</h2>
        {canEdit && <button type="button" disabled={busy} onClick={() => { void runReminders(); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-sky-400 disabled:opacity-50">Run reminders now</button>}
      </div>
      <p className="mt-1 text-sm text-slate-600">The system checks every document each morning. A document gets one reminder 30 days, 15 days and 7 days before it expires, and one on the day it expires.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className={cell}>Raised</th><th className={cell}>Document</th><th className={cell}>Expiry date</th><th className={cell}>Reminder</th><th className={cell}>Email</th></tr></thead>
        <tbody>
          {reminders.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">{loaded ? 'No reminder has been raised yet.' : 'Loading...'}</td></tr>}
          {reminders.map(r => <tr key={r.id} className="border-t border-slate-200">
            <td className={`${cell} whitespace-nowrap`}>{when(r.createdAt)}</td>
            <td className={cell}>{r.subject}</td>
            <td className={`${cell} whitespace-nowrap`}>{day(r.expiryDate)}</td>
            <td className={cell}><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${r.stageDays === 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{stageText(r)}</span></td>
            <td className={cell}>{r.emailed ? `Sent to ${r.emailTo}` : 'Not sent'}</td>
          </tr>)}
        </tbody>
      </table></div>
    </section>
  </>;
}
