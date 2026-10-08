/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-007 -- Maintenance & Fuel. For Employee, Manager and Admin; opened by the Dashboard tile "Maintenance Due".
//
//   Services due   the services that are overdue or due soon, with "Record service"
//   Trucks         every truck with its odometer, reefer hours and state; a truck opens to its service plans
//                  (a Manager adds and changes them), its past services and readings; "Enter a reading"
//   Breakdowns     the open breakdowns and the log; "Report a breakdown", "Close" with the repair cost
//   Fuel           fuel fills of a truck, newest first, with the photo of the bill; "Add fuel"
//
// Backend: /api/maintenance/** (MaintenanceController).
import { FormEvent, Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Fuel, Gauge, Image as ImageIcon, Plus, Trash2, Wrench } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { openPicture, postForm } from '@/modules/trip/TripCostsPanel';
import { fmtDateTime, fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type PlanRow = {
  id: number; vehicleId: number; vehicleNumber: string; serviceType: string; name: string; everyKm?: number | null; everyDays?: number | null; everyReeferHours?: number | null;
  lastDoneOn?: string | null; lastDoneOdometerKm?: number | null; lastDoneReeferHours?: number | null; notes?: string | null; active: boolean;
  currentKm?: number | null; currentReeferHours?: number | null; dueKm?: number | null; dueOn?: string | null; dueReeferHours?: number | null; state: string; stateText: string;
};
type VehicleRow = { id: number; vehicleNumber: string; vehicleType?: string; status?: string; currentKm?: number | null; currentReeferHours?: number | null; plans: number; openBreakdowns: number; state: string };
type Breakdown = { id: number; vehicleId: number; vehicleNumber: string; tripId?: number | null; tripNumber?: string | null; category: string; description: string; place?: string | null; odometerKm?: number | null; reportedAt: string; reportedBy: string; reportedByName?: string | null; status: string; resolvedAt?: string | null; resolution?: string | null; repairCost?: number | null; resolvedByName?: string | null; downHours?: number | null };
type Summary = { ready: boolean; message?: string; canManage?: boolean; counts: { overdueVehicles: number; dueSoonVehicles: number; openBreakdowns: number; maintenanceDue: number }; due: PlanRow[]; vehicles: VehicleRow[]; openBreakdowns: Breakdown[]; serviceTypes: Record<string, string>; breakdownCategories: Record<string, string>; dueSoon: { km: number; days: number; reeferHours: number } };
type Detail = { id: number; vehicleNumber: string; currentKm?: number | null; currentReeferHours?: number | null; plans: PlanRow[]; services: any[]; breakdowns: Breakdown[]; readings: any[] };
type FuelRow = { id: number; vehicleNumber: string; tripId?: number | null; tripNumber?: string | null; fuelFor: string; filledAt: string; litres: number; pricePerLitre?: number | null; amount: number; odometerKm?: number | null; station?: string | null; hasReceipt: boolean; enteredBy: string; enteredByName?: string | null };

const km = (v?: number | null) => (v === null || v === undefined ? '-' : `${Number(v).toLocaleString('en-IN')} km`);
const hrs = (v?: number | null) => (v === null || v === undefined ? '-' : `${Number(v).toLocaleString('en-IN')} h`);
const money = (v?: number | null) => fmtMoney(v);
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const every = (p: PlanRow) => [p.everyKm ? `${Number(p.everyKm).toLocaleString('en-IN')} km` : '', p.everyDays ? `${p.everyDays} days` : '', p.everyReeferHours ? `${Number(p.everyReeferHours)} reefer hours` : ''].filter(Boolean).join(' or ');
const STATE: Record<string, string> = { OVERDUE: 'bg-red-100 text-red-800', DUE_SOON: 'bg-amber-100 text-amber-900', OK: 'bg-emerald-100 text-emerald-800', NO_PLAN: 'bg-slate-100 text-slate-600' };
const STATE_LABEL: Record<string, string> = { OVERDUE: 'Overdue', DUE_SOON: 'Due soon', OK: 'Not due', NO_PLAN: 'No plan' };
const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm';
const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600';
const card = 'rounded-2xl bg-white p-5 shadow-sm';
const primary = 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const plain = 'rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700';
/** Today in India as yyyy-mm-dd: the server compares dates with the India date, whatever the time zone of this computer. */
const indiaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const errorText = (x: unknown, fallback: string) => (x instanceof Error && x.message ? x.message : fallback);
const body = (f: HTMLFormElement) => JSON.stringify(Object.fromEntries(Array.from(new FormData(f).entries()).filter(([, v]) => String(v).trim() !== '')));

export function MaintenancePage() {
  const user = currentUser();
  const staff = ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(String(user.role || user.roleCode || '').replace('ROLE_', '').toUpperCase()) && String(user.loginType || user.userType || '').toUpperCase() !== 'PARTNER';
  const [tab, setTab] = useState<'DUE' | 'TRUCKS' | 'BREAKDOWNS' | 'FUEL'>('DUE');
  const [sum, setSum] = useState<Summary | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [log, setLog] = useState<Breakdown[] | null>(null);
  const [fuel, setFuel] = useState<FuelRow[] | null>(null);
  const [fuelTruck, setFuelTruck] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState<{ kind: string; id?: number } | null>(null);   // SERVICE (plan id), PLAN, EDIT_PLAN, READING, BREAKDOWN, RESOLVE, FUEL
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const loadSummary = useCallback(async () => {
    try { setSum(await api('/api/maintenance/summary')); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the maintenance summary') }); }
  }, []);
  const loadDetail = useCallback(async (id: number) => {
    try { setDetail(await api(`/api/maintenance/vehicles/${id}`)); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the truck') }); }
  }, []);
  const loadLog = useCallback(async () => {
    try { setLog(await api('/api/maintenance/breakdowns')); } catch (x) { setLog([]); setMsg({ ok: false, text: errorText(x, 'Could not load the breakdown log') }); }
  }, []);
  const loadFuel = useCallback(async (vehicleId: string) => {
    try { setFuel(await api(`/api/maintenance/fuel${vehicleId ? `?vehicleId=${vehicleId}` : ''}`)); } catch (x) { setFuel([]); setMsg({ ok: false, text: errorText(x, 'Could not load the fuel entries') }); }
  }, []);
  useEffect(() => { if (staff) void loadSummary(); }, [staff, loadSummary]);
  useEffect(() => { if (staff && tab === 'BREAKDOWNS') void loadLog(); if (staff && tab === 'FUEL') void loadFuel(fuelTruck); }, [staff, tab, fuelTruck, loadLog, loadFuel]);

  async function save(e: FormEvent<HTMLFormElement>, work: (f: HTMLFormElement) => Promise<unknown>, done: string) {
    e.preventDefault();
    if (sending.current) return;
    sending.current = true; setBusy(true); setMsg(null);
    try {
      await work(e.currentTarget);
      setForm(null); setMsg({ ok: true, text: done });
      await loadSummary();
      if (detail) await loadDetail(detail.id);
      if (tab === 'BREAKDOWNS') await loadLog();
      if (tab === 'FUEL') await loadFuel(fuelTruck);
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not be saved') }); }
    finally { sending.current = false; setBusy(false); }
  }
  const post = (path: string, method = 'POST') => (f: HTMLFormElement) => api(path, { method, body: body(f) });
  async function remove(question: string, path: string, done: string) {
    if (sending.current) return;
    if (!window.confirm(question)) return;
    sending.current = true; setBusy(true);
    try {
      await api(path, { method: 'DELETE' });
      setMsg({ ok: true, text: done });
      await loadSummary();
      if (detail) await loadDetail(detail.id);
      if (tab === 'FUEL') await loadFuel(fuelTruck);
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not be removed') }); }
    finally { sending.current = false; setBusy(false); }
  }
  const removeFuel = (f: FuelRow) => remove(`Remove the fuel entry of ${Number(f.litres)} L (${money(f.amount)}) of ${f.vehicleNumber}? Its expense row is removed too.`, `/api/maintenance/fuel/${f.id}`, 'The fuel entry is removed.');
  const removeReading = (r: any) => remove(`Remove the reading of ${when(r.readingAt)}?`, `/api/maintenance/readings/${r.id}`, 'The reading is removed.');
  const open = (kind: string, id?: number) => { setMsg(null); setForm(form && form.kind === kind && form.id === id ? null : { kind, id }); };

  if (!staff) return <div className="p-10">Maintenance and fuel are for RefTech staff.</div>;
  if (!sum) return msg ? <div className="rounded-xl bg-red-50 p-3 font-semibold text-red-800">{msg.text}</div> : <p className="text-slate-500">Loading...</p>;
  if (!sum.ready) return <><h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><Wrench className="h-8 w-8 text-violet-700" />Maintenance &amp; Fuel</h1><p className="mt-4 rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">{sum.message}</p></>;

  const types = Object.entries(sum.serviceTypes), cats = Object.entries(sum.breakdownCategories);
  const truckOptions = sum.vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>);
  const tabBtn = (code: typeof tab, text: string) => <button type="button" role="tab" aria-selected={tab === code} onClick={() => { setTab(code); setForm(null); setMsg(null); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === code ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>{text}</button>;
  const tile = (n: number, text: string, colour: string, id: string) => <div className={`rounded-xl p-4 ${colour}`}><div data-testid={id} className="text-3xl font-black">{n}</div><div className="font-bold">{text}</div></div>;

  const serviceForm = (p: PlanRow) => <form onSubmit={e => { void save(e, post('/api/maintenance/services'), `${p.name} of ${p.vehicleNumber} is recorded. The plan counts again from this service.`); }} className="mt-2 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
    <input type="hidden" name="planId" value={p.id} />
    <label className="block"><span className={label}>Done on *</span><input name="doneOn" type="date" required defaultValue={indiaToday()} className={input} /></label>
    <label className="block"><span className={label}>Odometer (km){p.everyKm ? ' *' : ''}</span><input name="odometerKm" required={!!p.everyKm} inputMode="decimal" defaultValue={p.currentKm ?? ''} className={input} /></label>
    <label className="block"><span className={label}>Reefer hours{p.everyReeferHours ? ' *' : ''}</span><input name="reeferHours" required={!!p.everyReeferHours} inputMode="decimal" defaultValue={p.everyReeferHours ? (p.currentReeferHours ?? '') : ''} className={input} /></label>
    <label className="block"><span className={label}>Cost</span><input name="cost" inputMode="decimal" className={input} /></label>
    <label className="block"><span className={label}>Workshop</span><input name="workshop" maxLength={200} className={input} /></label>
    <label className="block md:col-span-3"><span className={label}>Notes</span><input name="notes" maxLength={1000} className={input} /></label>
    <div className="flex gap-2 md:col-span-4"><button disabled={busy} className={primary}>Save the service</button><button type="button" onClick={() => setForm(null)} className={plain}>Close</button></div>
    <p className="text-xs text-slate-500 md:col-span-4">A cost is also written as a MAINTENANCE expense of the truck (Expenses page).</p>
  </form>;

  const planForm = (vehicleId: number, p?: PlanRow) => <form onSubmit={e => { void save(e, post(p ? `/api/maintenance/plans/${p.id}` : '/api/maintenance/plans', p ? 'PUT' : 'POST'), p ? 'The service plan is changed.' : 'The service plan is added.'); }} className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
    {!p && <input type="hidden" name="vehicleId" value={vehicleId} />}
    <label className="block"><span className={label}>Kind of service *</span><select name="serviceType" defaultValue={p?.serviceType || 'GENERAL_SERVICE'} className={input}>{types.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
    <label className="block"><span className={label}>Name</span><input name="name" maxLength={160} defaultValue={p?.name || ''} placeholder="as the kind, when empty" className={input} /></label>
    <label className="block"><span className={label}>Every (km)</span><input name="everyKm" inputMode="decimal" defaultValue={p?.everyKm ?? ''} className={input} /></label>
    <label className="block"><span className={label}>Every (days)</span><input name="everyDays" inputMode="numeric" defaultValue={p?.everyDays ?? ''} className={input} /></label>
    <label className="block"><span className={label}>Every (reefer hours)</span><input name="everyReeferHours" inputMode="decimal" defaultValue={p?.everyReeferHours ?? ''} className={input} /></label>
    <label className="block"><span className={label}>Last done on</span><input name="lastDoneOn" type="date" defaultValue={p?.lastDoneOn || ''} className={input} /></label>
    <label className="block"><span className={label}>Odometer then (km)</span><input name="lastDoneOdometerKm" inputMode="decimal" defaultValue={p?.lastDoneOdometerKm ?? ''} className={input} /></label>
    <label className="block"><span className={label}>Reefer hours then</span><input name="lastDoneReeferHours" inputMode="decimal" defaultValue={p?.lastDoneReeferHours ?? ''} className={input} /></label>
    {p && <label className="block"><span className={label}>Counted</span><select name="active" defaultValue={String(p.active)} className={input}><option value="true">Yes</option><option value="false">No, switched off</option></select></label>}
    <label className="block md:col-span-3"><span className={label}>Notes</span><input name="notes" maxLength={500} defaultValue={p?.notes || ''} className={input} /></label>
    <p className="text-xs text-slate-500 md:col-span-4">Give at least one of the three intervals. Without "last done" the count starts today, at the reading the truck has now; a truck without any reading needs the reading at the last service.</p>
    <div className="flex gap-2 md:col-span-4"><button disabled={busy} className={primary}>{p ? 'Save the plan' : 'Add the plan'}</button><button type="button" onClick={() => setForm(null)} className={plain}>Close</button></div>
  </form>;

  const breakdownRow = (b: Breakdown) => <tr key={b.id} data-breakdown={b.id} className="border-t align-top">
    <td className="p-2 font-semibold">{b.vehicleNumber}{b.tripId ? <div className="text-xs font-normal"><Link to={`/trips/${b.tripId}`} className="text-sky-700 hover:underline">{b.tripNumber}</Link></div> : null}</td>
    <td className="p-2">{sum.breakdownCategories[b.category] || b.category}</td>
    <td className="p-2 max-w-md">{b.description}{b.place ? <div className="text-xs text-slate-500">{b.place}{b.odometerKm != null ? `, ${km(b.odometerKm)}` : ''}</div> : null}</td>
    <td className="p-2 whitespace-nowrap">{when(b.reportedAt)}<div className="text-xs text-slate-500">{b.reportedBy === 'DRIVER' ? 'Driver' : 'Office'}: {b.reportedByName || '-'}</div></td>
    <td className="p-2 whitespace-nowrap">{b.downHours == null ? '-' : `${Number(b.downHours)} h`}</td>
    <td className="p-2">{b.status === 'OPEN' ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">Open</span>
      : <><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">Closed</span><div className="mt-1 text-xs text-slate-600">{b.resolution}{b.repairCost != null ? ` (${money(b.repairCost)})` : ''}</div></>}
      {form?.kind === 'RESOLVE' && form.id === b.id && <form onSubmit={e => { void save(e, post(`/api/maintenance/breakdowns/${b.id}/resolve`), `The breakdown of ${b.vehicleNumber} is closed.`); }} className="mt-2 grid gap-2">
        <input name="resolution" required minLength={5} maxLength={1000} aria-label="What was done" placeholder="What was done *" className={input} />
        <input name="repairCost" inputMode="decimal" aria-label="Repair cost" placeholder="Repair cost" className={input} />
        <div className="flex gap-2"><button disabled={busy} className={primary}>Close the breakdown</button><button type="button" onClick={() => setForm(null)} className={plain}>Cancel</button></div>
      </form>}</td>
    <td className="p-2">{b.status === 'OPEN' && !(form?.kind === 'RESOLVE' && form.id === b.id) && <button type="button" onClick={() => open('RESOLVE', b.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-sky-400">Close</button>}</td>
  </tr>;
  const breakdownHead = <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Truck</th><th className="p-2">What</th><th className="p-2">Description</th><th className="p-2">Reported</th><th className="p-2">Down</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><Wrench className="h-8 w-8 text-violet-700" />Maintenance &amp; Fuel</h1>
    <p className="mt-1 text-slate-600">A service is due soon within {Number(sum.dueSoon.km)} km, {sum.dueSoon.days} days or {Number(sum.dueSoon.reeferHours)} reefer hours of its next date. The Dashboard tile counts the trucks with a service that is overdue or due soon, or with an open breakdown.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tile(sum.counts.maintenanceDue, 'Trucks need attention', 'bg-violet-50 text-violet-800', 'tile-due')}
      {tile(sum.counts.overdueVehicles, 'Trucks with an overdue service', 'bg-red-50 text-red-800', 'tile-overdue')}
      {tile(sum.counts.dueSoonVehicles, 'Trucks with a service due soon', 'bg-amber-50 text-amber-900', 'tile-soon')}
      {tile(sum.counts.openBreakdowns, 'Open breakdowns', 'bg-rose-50 text-rose-800', 'tile-breakdowns')}
    </div>
    <div role="tablist" className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-2">
      {tabBtn('DUE', `Services due (${sum.due.length})`)}{tabBtn('TRUCKS', `Trucks (${sum.vehicles.length})`)}{tabBtn('BREAKDOWNS', `Breakdowns (${sum.counts.openBreakdowns} open)`)}{tabBtn('FUEL', 'Fuel')}
    </div>
    {msg && <div role="status" data-testid="maintenance-message" className={`mt-4 rounded-xl p-3 font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}

    {tab === 'DUE' && <section role="tabpanel" aria-label="Services due" className={`${card} mt-4 overflow-x-auto`}>
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Gauge className="h-5 w-5 text-sky-700" />Services that are overdue or due soon</h2>
      <table data-testid="due-table" className="mt-3 w-full min-w-[980px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Truck</th><th className="p-2">Service</th><th className="p-2">Every</th><th className="p-2">Last done</th><th className="p-2">Reading now</th><th className="p-2">Next at</th><th className="p-2">State</th><th className="p-2"></th></tr></thead>
        <tbody>{sum.due.length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-slate-400">No service is due.</td></tr> : sum.due.map(p => <Fragment key={p.id}>
          <tr data-truck={p.vehicleNumber} className="border-t align-top">
            <td className="p-2 font-semibold">{p.vehicleNumber}</td><td className="p-2">{p.name}</td><td className="p-2">{every(p)}</td>
            <td className="p-2">{p.lastDoneOn || '-'}{p.lastDoneOdometerKm != null ? <div className="text-xs text-slate-500">{km(p.lastDoneOdometerKm)}</div> : null}{p.lastDoneReeferHours != null ? <div className="text-xs text-slate-500">{hrs(p.lastDoneReeferHours)}</div> : null}</td>
            <td className="p-2">{p.everyKm ? km(p.currentKm) : ''}{p.everyReeferHours ? <div>{hrs(p.currentReeferHours)}</div> : null}{!p.everyKm && !p.everyReeferHours ? '-' : ''}</td>
            <td className="p-2">{p.dueKm != null ? km(p.dueKm) : ''}{p.dueOn ? <div>{p.dueOn}</div> : null}{p.dueReeferHours != null ? <div>{hrs(p.dueReeferHours)}</div> : null}</td>
            <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATE[p.state]}`}>{STATE_LABEL[p.state]}</span><div className={`mt-1 text-xs font-semibold ${p.state === 'OVERDUE' ? 'text-red-700' : 'text-amber-800'}`}>{p.stateText}</div></td>
            <td className="p-2"><button type="button" onClick={() => open('SERVICE', p.id)} className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-800">Record service</button></td>
          </tr>
          {form?.kind === 'SERVICE' && form.id === p.id && <tr><td colSpan={8} className="px-2 pb-3">{serviceForm(p)}</td></tr>}
        </Fragment>)}</tbody>
      </table>
    </section>}

    {tab === 'TRUCKS' && <div role="tabpanel" aria-label="Trucks" className="mt-4 grid gap-4 xl:grid-cols-5">
      <section className={`${card} overflow-x-auto xl:col-span-2`}>
        <h2 className="text-lg font-black text-slate-900">Trucks</h2>
        <table data-testid="truck-table" className="mt-3 w-full min-w-[420px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Truck</th><th className="p-2">Odometer</th><th className="p-2">Reefer hours</th><th className="p-2">State</th></tr></thead>
          <tbody>{sum.vehicles.map(v => <tr key={v.id} onClick={() => { setForm(null); void loadDetail(v.id); }} className={`cursor-pointer border-t hover:bg-sky-50 ${detail?.id === v.id ? 'bg-sky-50' : ''}`}>
            <td className="p-2 font-semibold"><button type="button" className="text-sky-700 hover:underline">{v.vehicleNumber}</button></td><td className="p-2">{km(v.currentKm)}</td><td className="p-2">{hrs(v.currentReeferHours)}</td>
            <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATE[v.state]}`}>{STATE_LABEL[v.state]}</span>{v.openBreakdowns > 0 && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">Breakdown</span>}</td>
          </tr>)}</tbody>
        </table>
      </section>
      <section data-testid="truck-detail" className={`${card} xl:col-span-3`}>
        {!detail ? <p className="text-slate-500">Choose a truck to see its service plans, its past services and its readings.</p> : <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-900">{detail.vehicleNumber}: {km(detail.currentKm)}{detail.currentReeferHours != null ? `, ${hrs(detail.currentReeferHours)} reefer` : ''}</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => open('READING', detail.id)} className={plain}>Enter a reading</button>
              {sum.canManage && <button type="button" onClick={() => open('PLAN', detail.id)} className="inline-flex items-center gap-1 rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800"><Plus className="h-4 w-4" />Add a service plan</button>}
            </div>
          </div>
          {form?.kind === 'READING' && <form onSubmit={e => { void save(e, post('/api/maintenance/readings'), `The reading of ${detail.vehicleNumber} is saved.`); }} className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
            <input type="hidden" name="vehicleId" value={detail.id} />
            <label className="block"><span className={label}>Odometer (km)</span><input name="odometerKm" inputMode="decimal" className={input} /></label>
            <label className="block"><span className={label}>Reefer hours</span><input name="reeferHours" inputMode="decimal" className={input} /></label>
            <label className="block md:col-span-2"><span className={label}>Note</span><input name="note" maxLength={300} className={input} /></label>
            {sum.canManage && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-4"><input type="checkbox" name="confirmLargeJump" value="true" />The large jump is right (tick only when the odometer really is far above the last reading)</label>}
            <div className="flex gap-2 md:col-span-4"><button disabled={busy} className={primary}>Save the reading</button><button type="button" onClick={() => setForm(null)} className={plain}>Close</button></div>
          </form>}
          {form?.kind === 'PLAN' && planForm(detail.id)}

          <h3 className="mt-4 font-bold text-slate-900">Service plans ({detail.plans.length})</h3>
          {detail.plans.length === 0 ? <p className="mt-1 text-sm text-slate-500">This truck has no service plan.{sum.canManage ? '' : ' A Manager or an Admin adds one.'}</p> : <div className="mt-2 space-y-2">{detail.plans.map(p => <div key={p.id} data-plan={p.id} className={`rounded-xl border p-3 text-sm ${p.active ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-slate-900">{p.name}</b><span className="text-slate-600">every {every(p)}</span>
              {p.active ? <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATE[p.state]}`}>{STATE_LABEL[p.state]}</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">Switched off</span>}
              <span className={`text-xs font-semibold ${p.state === 'OVERDUE' ? 'text-red-700' : 'text-slate-600'}`}>{p.active && p.state !== 'OK' ? p.stateText : ''}</span>
              <span className="ml-auto flex gap-2">
                {p.active && <button type="button" onClick={() => open('SERVICE', p.id)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:border-sky-400">Record service</button>}
                {sum.canManage && <button type="button" onClick={() => open('EDIT_PLAN', p.id)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:border-sky-400">Change</button>}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">Last done {p.lastDoneOn || '-'}{p.lastDoneOdometerKm != null ? ` at ${km(p.lastDoneOdometerKm)}` : ''}{p.lastDoneReeferHours != null ? ` at ${hrs(p.lastDoneReeferHours)}` : ''}. Next{p.dueKm != null ? ` at ${km(p.dueKm)}` : ''}{p.dueOn ? ` on ${p.dueOn}` : ''}{p.dueReeferHours != null ? ` at ${hrs(p.dueReeferHours)}` : ''}.</div>
            {form?.kind === 'SERVICE' && form.id === p.id && serviceForm(p)}
            {form?.kind === 'EDIT_PLAN' && form.id === p.id && planForm(detail.id, p)}
          </div>)}</div>}

          <h3 className="mt-4 font-bold text-slate-900">Services done ({detail.services.length})</h3>
          {detail.services.length === 0 ? <p className="mt-1 text-sm text-slate-500">No service is recorded.</p> : <div className="overflow-x-auto"><table className="mt-2 w-full min-w-[640px] text-sm"><thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Date</th><th className="p-2">Service</th><th className="p-2">Odometer</th><th className="p-2">Reefer hours</th><th className="p-2">Cost</th><th className="p-2">Workshop</th><th className="p-2">By</th></tr></thead>
            <tbody>{detail.services.map((s: any) => <tr key={s.id} className="border-t"><td className="whitespace-nowrap p-2">{s.doneOn}</td><td className="p-2">{s.name}</td><td className="whitespace-nowrap p-2">{km(s.odometerKm)}</td><td className="whitespace-nowrap p-2">{hrs(s.reeferHours)}</td><td className="whitespace-nowrap p-2">{money(s.cost)}</td><td className="p-2">{s.workshop || '-'}</td><td className="p-2">{s.recordedBy || '-'}</td></tr>)}</tbody></table></div>}
          {detail.readings.length > 0 && <><h3 className="mt-4 font-bold text-slate-900">Readings entered by hand</h3>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">{detail.readings.map((r: any) => <li key={r.id}>{when(r.readingAt)}: {r.odometerKm != null ? km(r.odometerKm) : ''}{r.odometerKm != null && r.reeferHours != null ? ', ' : ''}{r.reeferHours != null ? `${hrs(r.reeferHours)} reefer` : ''} <span className="text-slate-500">({r.recordedBy || '-'}{r.note ? `, ${r.note}` : ''})</span>{sum.canManage && <button type="button" disabled={busy} onClick={() => { void removeReading(r); }} className="ml-2 text-xs font-bold text-red-700 hover:underline">Remove</button>}</li>)}</ul></>}
        </>}
      </section>
    </div>}

    {tab === 'BREAKDOWNS' && <section role="tabpanel" aria-label="Breakdowns" className={`${card} mt-4 overflow-x-auto`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><AlertTriangle className="h-5 w-5 text-rose-700" />Breakdown log</h2>
        <button type="button" onClick={() => open('BREAKDOWN')} className="inline-flex items-center gap-1 rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800"><Plus className="h-4 w-4" />Report a breakdown</button>
      </div>
      {form?.kind === 'BREAKDOWN' && <form onSubmit={e => { void save(e, post('/api/maintenance/breakdowns'), 'The breakdown is reported.'); }} className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
        <label className="block"><span className={label}>Truck *</span><select name="vehicleId" required className={input}><option value="">Choose</option>{truckOptions}</select></label>
        <label className="block"><span className={label}>What *</span><select name="category" className={input}>{cats.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
        <label className="block"><span className={label}>Place</span><input name="place" maxLength={255} className={input} /></label>
        <label className="block"><span className={label}>Odometer (km)</span><input name="odometerKm" inputMode="decimal" className={input} /></label>
        <label className="block md:col-span-4"><span className={label}>What happened *</span><input name="description" required minLength={5} maxLength={1000} className={input} /></label>
        <div className="flex gap-2 md:col-span-4"><button disabled={busy} className={primary}>Report</button><button type="button" onClick={() => setForm(null)} className={plain}>Close</button></div>
      </form>}
      <table data-testid="breakdown-table" className="mt-3 w-full min-w-[980px] text-sm">{breakdownHead}
        <tbody>{log === null ? <tr><td colSpan={7} className="p-6 text-center text-slate-400">Loading...</td></tr> : log.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-slate-400">No breakdown is recorded.</td></tr> : log.map(breakdownRow)}</tbody>
      </table>
    </section>}

    {tab === 'FUEL' && <section role="tabpanel" aria-label="Fuel" className={`${card} mt-4 overflow-x-auto`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Fuel className="h-5 w-5 text-sky-700" />Fuel issued</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Truck" value={fuelTruck} onChange={e => setFuelTruck(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">All trucks</option>{truckOptions}</select>
          <button type="button" onClick={() => open('FUEL')} className="inline-flex items-center gap-1 rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800"><Plus className="h-4 w-4" />Add fuel</button>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">Fuel of a trip is best entered on the trip page (Fuel and trip costs): there it counts for the kilometres per litre of the trip. Here fuel can be entered for a truck without a trip.</p>
      {form?.kind === 'FUEL' && <form onSubmit={e => { void save(e, f => postForm('/api/maintenance/fuel', new FormData(f)), 'The fuel is saved.'); }} className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
        <label className="block"><span className={label}>Truck *</span><select name="vehicleId" required defaultValue={fuelTruck} className={input}><option value="">Choose</option>{truckOptions}</select></label>
        <label className="block"><span className={label}>Fuel for</span><select name="fuelFor" className={input}><option value="TRUCK">Truck engine</option><option value="REEFER">Reefer unit</option></select></label>
        <label className="block"><span className={label}>Litres *</span><input name="litres" required inputMode="decimal" className={input} /></label>
        <label className="block"><span className={label}>Price per litre</span><input name="pricePerLitre" inputMode="decimal" className={input} /></label>
        <label className="block"><span className={label}>Amount of the bill</span><input name="amount" inputMode="decimal" placeholder="worked out from the price" className={input} /></label>
        <label className="block"><span className={label}>Odometer (km)</span><input name="odometerKm" inputMode="decimal" className={input} /></label>
        <label className="block"><span className={label}>Fuel station</span><input name="station" maxLength={200} className={input} /></label>
        <label className="block"><span className={label}>Photo of the bill</span><input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" /></label>
        <div className="flex gap-2 md:col-span-4"><button disabled={busy} className={primary}>Save fuel</button><button type="button" onClick={() => setForm(null)} className={plain}>Close</button></div>
      </form>}
      <table data-testid="fuel-list" className="mt-3 w-full min-w-[980px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">When</th><th className="p-2">Truck</th><th className="p-2">Trip</th><th className="p-2">For</th><th className="p-2">Litres</th><th className="p-2">Price</th><th className="p-2">Amount</th><th className="p-2">Odometer</th><th className="p-2">Entered by</th><th className="p-2"></th></tr></thead>
        <tbody>{fuel === null ? <tr><td colSpan={10} className="p-6 text-center text-slate-400">Loading...</td></tr> : fuel.length === 0 ? <tr><td colSpan={10} className="p-6 text-center text-slate-400">No fuel is recorded.</td></tr> : fuel.map(f => <tr key={f.id} className="border-t align-top">
          <td className="whitespace-nowrap p-2">{when(f.filledAt)}<div className="text-xs text-slate-500">{f.station || ''}</div></td><td className="p-2 font-semibold">{f.vehicleNumber}</td>
          <td className="p-2">{f.tripId ? <Link to={`/trips/${f.tripId}`} className="text-sky-700 hover:underline">{f.tripNumber}</Link> : '-'}</td><td className="p-2">{f.fuelFor === 'REEFER' ? 'Reefer' : 'Engine'}</td>
          <td className="p-2">{Number(f.litres)}</td><td className="p-2">{f.pricePerLitre == null ? '-' : Number(f.pricePerLitre).toFixed(2)}</td><td className="p-2 font-semibold">{money(f.amount)}</td><td className="p-2">{km(f.odometerKm)}</td>
          <td className="p-2">{f.enteredBy === 'DRIVER' ? 'Driver' : 'Office'}<div className="text-xs text-slate-500">{f.enteredByName || ''}</div></td>
          <td className="p-2 whitespace-nowrap">{f.hasReceipt && <button type="button" onClick={() => { void openPicture(`/api/maintenance/fuel/${f.id}/receipt`); }} className="inline-flex items-center gap-1 text-sm font-bold text-sky-700 hover:underline"><ImageIcon className="h-4 w-4" />Bill</button>}
            {sum.canManage && <button type="button" onClick={() => { void removeFuel(f); }} title="Remove this fuel entry" aria-label="Remove this fuel entry" className="ml-2 rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>}</td>
        </tr>)}</tbody>
      </table>
    </section>}
  </>;
}
