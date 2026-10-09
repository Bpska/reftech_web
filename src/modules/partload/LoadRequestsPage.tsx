/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// Load Requests: goods a partner wants moved, waiting for a truck.
//
// REQ-CC-003-FIX1 (page split): this used to be the right half of the Operations page, so every Trip menu
// link showed "Create Load Request". It is now its own page (menu: Load Requests) with two views:
//   - Partner login: "Create Load Request" for its own company and the list of its own requests. A request
//     is saved as REQUESTED, without a rate, and can be cancelled while it waits.
//   - Staff: the requests waiting for acceptance (accept with a rate, or decline with a reason), the form
//     to enter a load on a partner's behalf (OPEN at once, as before), and the list of all loads.
// Backend: /api/operations/loads (OperationsController).
//
// REQ-DSP-010: a load has a delivery window (Deliver from / Deliver by). Staff can change an accepted load (weight,
// times, rate; the route and profile while it is not on a trip) with a reason, cancel it with a reason (a part load
// is taken off its trip first), and make a full-load trip from it on the Planning Board ("Make trip").
// Backend: PUT /api/dispatch/loads/{id}, POST /api/dispatch/loads/{id}/cancel.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackagePlus } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { PagerBar, usePagedList } from '@/shared/components/PagedList'; // REQ-PLT-004: the load list is paged by the server
import { fmtDateTime, fmtTemp, fmtTempRange, fmtWeight, toBase, toShown, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type LoadRow = {
  id: number; loadNumber?: string; partnerName?: string; pickupCity?: string; deliveryCity?: string; weightTons?: number; volumeM3?: number | null;
  requiredTemperatureC?: number | null; tempMinC?: number | null; tempMaxC?: number | null; temperatureProfileName?: string | null;
  ratePerTon?: number | null; actualFare?: number | null; status: string; tripId?: number | null;
  // REQ-TRP-004 / REQ-TRP-005: the trip a load is planned on, its truck, its stage, the promised and the calculated arrival
  tripNumber?: string | null; vehicleNumber?: string | null; tripStageLabel?: string | null; expectedArrivalAt?: string | null; etaAt?: string | null; etaDelayMinutes?: number | null; etaLate?: boolean;
  pickupFrom?: string | null; createdAt?: string | null; reviewNote?: string | null;
  podNumber?: string | null; deliveredAt?: string | null;   // REQ-TRP-004: the proof of delivery of a delivered load
  deliverFrom?: string | null; deliverBy?: string | null; cancelReason?: string | null; // REQ-DSP-010
};
/** A datetime-local value as one exact moment (UTC), or '' when empty. */
const isoOf = (v: unknown) => { if (!v) return ''; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
/** An exact moment as a datetime-local value of this computer. */
const localOf = (v?: string | null) => { if (!v) return ''; const d = new Date(v); if (Number.isNaN(d.getTime())) return ''; const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
type Profile = { id: number; name: string; effectiveTargetC: number; effectiveMinC: number; effectiveMaxC: number; agreedWithPartner?: boolean };
type Partner = { id: number; name: string };
type Filter = 'OPEN' | 'ALL';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900';
const small = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900';
const label = 'mb-1.5 block text-sm font-semibold text-slate-700';
const cell = 'px-2.5 py-3';
const num = (v: unknown) => Number(v);
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const temperature = (x: LoadRow) => (x.temperatureProfileName ? `${x.temperatureProfileName}, ` : '')
  + (x.tempMinC != null && x.tempMaxC != null ? fmtTempRange(x.tempMinC, x.tempMaxC) : x.requiredTemperatureC != null ? fmtTemp(x.requiredTemperatureC) : x.temperatureProfileName ? '' : '-');
const STATUS: Record<string, [string, string]> = {
  REQUESTED: ['Requested', 'bg-amber-100 text-amber-800'],
  OPEN: ['Open', 'bg-emerald-100 text-emerald-800'],
  DECLINED: ['Declined', 'bg-red-100 text-red-800'],
  CANCELLED: ['Cancelled', 'bg-slate-200 text-slate-600'],
  PLANNED: ['Planned on a trip', 'bg-indigo-100 text-indigo-800'],   // REQ-TRP-004: attached by the part-load planner
  DELIVERED: ['Delivered', 'bg-sky-100 text-sky-800'],               // REQ-TRP-004: its proof of delivery is recorded
  CLOSED: ['Closed, not delivered', 'bg-slate-200 text-slate-700'],  // REQ-TRP-004: its trip was closed without a proof of delivery for it
};
const errorText = (x: unknown, fallback: string) => (x instanceof Error ? x.message : fallback);

function StatusChip({ status }: { status: string }) {
  const [text, tone] = STATUS[status] || [status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '), 'bg-sky-100 text-sky-800'];
  return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{text}</span>;
}

export function LoadRequestsPage() {
  const user = currentUser();
  const isPartner = String(user.loginType || user.userType || user.role || '').toUpperCase() === 'PARTNER';

  const [waiting, setWaiting] = useState<LoadRow[]>([]);   // partner requests waiting for acceptance (staff)
  const [waitingMore, setWaitingMore] = useState(0);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [declineId, setDeclineId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editId, setEditId] = useState<number | null>(null); // REQ-DSP-010

  // REQ-PLT-004: the list shows one page from the server; the tab and the search are server filters.
  const list = usePagedList<LoadRow>('/api/operations/loads/page',
    isPartner ? {} : filter === 'OPEN' ? { 'f.status': 'OPEN' } : { 'f.status': 'OPEN,PLANNED,DELIVERED,CLOSED,CANCELLED,DECLINED' });
  const loads = list.items;
  const reloadList = list.reload;
  const load = useCallback(async () => {
    reloadList();
    if (isPartner) { setLoaded(true); return; }
    try {
      const w = await api('/api/operations/loads/page?f.status=REQUESTED&sort=createdAt&dir=asc&page=1&size=200');
      setWaiting(Array.isArray(w?.items) ? w.items : []);
      setWaitingMore(Math.max(0, (w?.total || 0) - 200));
    }
    catch (x) { setError(errorText(x, 'Could not load the load requests')); }
    finally { setLoaded(true); }
  }, [isPartner]);
  useEffect(() => {
    void load();
    if (!isPartner) api('/api/operations/partners').then((p: Partner[]) => setPartners(Array.isArray(p) ? p : [])).catch(() => setPartners([]));
  }, [load, isPartner]);
  // A partner gets its own agreed ranges from the server; staff get the ranges of the partner picked in the form.
  useEffect(() => {
    api(`/api/temperature-profiles${!isPartner && partnerId ? `?partnerId=${partnerId}` : ''}`).then((x: Profile[]) => setProfiles(Array.isArray(x) ? x : [])).catch(() => setProfiles([]));
  }, [partnerId, isPartner]);

  const rangeOf = (p: Profile) => fmtTempRange(p.effectiveMinC, p.effectiveMaxC);
  const chosen = profiles.find(p => String(p.id) === profileId);

  async function run(action: () => Promise<unknown>, done: (r: any) => string) {
    setBusy(true); setError(''); setMsg('');
    try { const r = await action(); setMsg(done(r)); await load(); return true; }
    catch (x) { setError(errorText(x, 'Could not save')); return false; }
    finally { setBusy(false); }
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body: Record<string, unknown> = Object.fromEntries(new FormData(form));
    if (body.temperatureProfileId === 'NONE') delete body.temperatureProfileId;
    body.weightTons = toBase('weight', body.weightTons); // REQ-PLT-015: typed in the login's unit
    for (const k of ['pickupFrom', 'deliverFrom', 'deliverBy']) if (body[k]) body[k] = isoOf(body[k]) || body[k];
    const ok = await run(() => api('/api/operations/loads', { method: 'POST', body: JSON.stringify(body) }), r => {
      const temp = r.temperatureProfileName ? ` (${r.temperatureProfileName}, ${fmtTempRange(r.tempMinC, r.tempMaxC)})` : '';
      return isPartner ? `Request ${r.loadNumber}${temp} sent. RefTech will confirm it and set the rate.` : `Load created: ${r.loadNumber}${temp}`;
    });
    if (ok) { form.reset(); setPartnerId(''); setProfileId(''); }
  }
  async function accept(e: FormEvent<HTMLFormElement>, x: LoadRow) {
    e.preventDefault();
    const rate = new FormData(e.currentTarget).get('ratePerTon');
    await run(() => api(`/api/operations/loads/${x.id}/accept`, { method: 'POST', body: JSON.stringify({ ratePerTon: rate }) }),
      r => `${x.loadNumber} accepted at ${num(r.ratePerTon)} per ton. It is now Open and can be planned on a trip.`);
  }
  async function decline(e: FormEvent<HTMLFormElement>, x: LoadRow) {
    e.preventDefault();
    const reason = new FormData(e.currentTarget).get('reason');
    const ok = await run(() => api(`/api/operations/loads/${x.id}/decline`, { method: 'POST', body: JSON.stringify({ reason }) }), () => `${x.loadNumber} declined. The partner sees the reason.`);
    if (ok) setDeclineId(null);
  }
  const cancel = (x: LoadRow) => run(() => api(`/api/operations/loads/${x.id}/cancel`, { method: 'POST' }), () => `${x.loadNumber} cancelled.`);
  // REQ-DSP-010: staff change or cancel an accepted load, with a reason
  async function saveEdit(e: FormEvent<HTMLFormElement>, x: LoadRow) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body: Record<string, unknown> = { reason: f.reason };
    if (f.weightTons !== undefined && f.weightTons !== toShown('weight', x.weightTons)) body.weightTons = toBase('weight', f.weightTons);
    if (f.ratePerTon !== (x.ratePerTon != null ? String(num(x.ratePerTon)) : '')) body.ratePerTon = f.ratePerTon;
    for (const [k, old] of [['pickupFrom', x.pickupFrom], ['deliverFrom', x.deliverFrom], ['deliverBy', x.deliverBy]] as const)
      if (f[k] !== localOf(old)) body[k] = isoOf(f[k]) || null;
    if (f.pickupCity !== undefined && f.pickupCity !== x.pickupCity) body.pickupCity = f.pickupCity;
    if (f.deliveryCity !== undefined && f.deliveryCity !== x.deliveryCity) body.deliveryCity = f.deliveryCity;
    const ok = await run(() => api(`/api/dispatch/loads/${x.id}`, { method: 'PUT', body: JSON.stringify(body) }), r => r?.message || `${x.loadNumber} changed.`);
    if (ok) setEditId(null);
  }
  function staffCancel(x: LoadRow) {
    const reason = window.prompt(`Why is ${x.loadNumber} cancelled?${x.tripNumber ? ` It is taken off trip ${x.tripNumber} first.` : ''}`);
    if (reason !== null) void run(() => api(`/api/dispatch/loads/${x.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }), r => r?.message || `${x.loadNumber} cancelled.`);
  }

  if (!localStorage.getItem('reftech_token')) return <div className="p-10">Please sign in.</div>;

  const shown = loads;
  const tab = (f: Filter, text: string) => (
    <button key={f} onClick={() => setFilter(f)} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === f ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{text}</button>
  );

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><PackagePlus className="h-8 w-8 text-sky-700" />Load Requests</h1>
    <p className="text-slate-600">{isPartner
      ? 'Tell RefTech what you want moved. Your request waits until RefTech accepts it and sets the rate.'
      : 'Goods a partner wants moved. A partner\'s own request waits here until you accept it with a rate; a load you enter yourself is Open at once.'}</p>
    {msg && <div className="my-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">{msg}</div>}
    {error && <div className="my-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</div>}

    {/* ------------------------------------------------------------ staff: requests waiting for acceptance */}
    {!isPartner && <section id="waiting" className="mt-5 scroll-mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-bold">Waiting for acceptance ({waiting.length + waitingMore})</h2>
      {waitingMore > 0 && <p className="mt-1 text-sm text-amber-700">Showing the oldest 200. Accept or decline these first to see the rest.</p>}
      {waiting.length === 0
        ? <p className="mt-2 text-slate-500">{loaded ? 'No partner request is waiting.' : 'Loading...'}</p>
        : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[980px] text-sm">
            <thead><tr className="bg-slate-50 text-left text-slate-600"><th className={cell}>Load</th><th className={cell}>Route</th><th className={cell}>Weight</th><th className={cell}>Temperature</th><th className={cell}>Pickup from</th><th className={cell}>Requested</th><th className={cell}>Decision</th></tr></thead>
            <tbody>{waiting.map(x => (
              <tr key={x.id} className="border-t border-slate-200 align-top">
                <td className={`${cell} whitespace-nowrap`}><div className="font-semibold">{x.loadNumber}</div><div className="text-xs text-slate-500">{x.partnerName}</div></td>
                <td className={`${cell} whitespace-nowrap`}>{x.pickupCity} → {x.deliveryCity}</td>
                <td className={`${cell} whitespace-nowrap`}>{fmtWeight(x.weightTons)}</td>
                <td className={cell}>{temperature(x)}</td>
                <td className={`${cell} whitespace-nowrap`}>{when(x.pickupFrom)}</td>
                <td className={`${cell} whitespace-nowrap`}>{when(x.createdAt)}</td>
                <td className={cell}>{declineId === x.id
                  ? <form onSubmit={e => decline(e, x)} className="flex flex-wrap items-center gap-2">
                      <input name="reason" required placeholder="Reason the partner will see" aria-label={`Reason for declining ${x.loadNumber}`} className={`${small} min-w-56 grow`} />
                      <button disabled={busy} className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Decline</button>
                      <button type="button" onClick={() => setDeclineId(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Back</button>
                    </form>
                  : <form onSubmit={e => accept(e, x)} className="flex flex-wrap items-center gap-2">
                      <input name="ratePerTon" required type="number" step="0.01" min="0.01" placeholder="Rate per ton" aria-label={`Rate per ton for ${x.loadNumber}`} className={`${small} w-32`} />
                      <button disabled={busy} className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Accept</button>
                      <button type="button" onClick={() => { setDeclineId(x.id); setMsg(''); setError(''); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Decline...</button>
                    </form>}</td>
              </tr>))}</tbody>
          </table></div>}
    </section>}

    {/* ------------------------------------------------------------ the form */}
    <form id="create-load" onSubmit={create} className="mt-4 max-w-4xl scroll-mt-6 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">Create Load Request</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {!isPartner && <div><label className={label}>Partner / Client *</label><select name="partnerId" required value={partnerId} onChange={e => { setPartnerId(e.target.value); setProfileId(''); }} className={input}><option value="">Select partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
        <div><label className={label}>Pickup City *</label><input name="pickupCity" required className={input} /></div>
        <div><label className={label}>Delivery City *</label><input name="deliveryCity" required className={input} /></div>
        <div><label className={label}>Weight ({unitNow('weight')}) *</label><input name="weightTons" required type="number" step="any" min="0.001" className={input} /></div>
        <div><label className={label}>Volume (m³)</label><input name="volumeM3" type="number" step="0.001" className={input} /></div>
        <div><label className={label}>Temperature Profile *</label>
          <select name="temperatureProfileId" required value={profileId} onChange={e => setProfileId(e.target.value)} className={input}>
            <option value="">Select profile</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({rangeOf(p)})</option>)}<option value="NONE">No temperature control</option>
          </select>
          {chosen && <p className="mt-1 text-xs text-slate-600">Target {fmtTemp(chosen.effectiveTargetC)}, allowed {rangeOf(chosen)}. {chosen.agreedWithPartner ? (isPartner ? 'Range agreed with you.' : 'Range agreed with this partner.') : 'Standard range.'}</p>}
        </div>
        {!isPartner && <div><label className={label}>Rate per Ton</label><input name="ratePerTon" type="number" step="0.01" className={input} /></div>}
        <div><label className={label}>Pickup From</label><input name="pickupFrom" type="datetime-local" className={input} /></div>
        {/* REQ-DSP-010: the delivery window */}
        <div><label className={label}>Deliver From</label><input name="deliverFrom" type="datetime-local" className={input} /></div>
        <div><label className={label}>Deliver By</label><input name="deliverBy" type="datetime-local" className={input} /></div>
      </div>
      <button disabled={busy} className="mt-5 rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{isPartner ? 'Send request' : 'Create Load'}</button>
    </form>

    {/* ------------------------------------------------------------ the list */}
    <section id="loads" className="mt-4 scroll-mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{isPartner ? 'My Load Requests' : 'All Loads'}</h2>
        {!isPartner && <div className="flex items-center gap-2">{tab('OPEN', 'Open, waiting for a trip')}{tab('ALL', 'All')}<Link to="/part-load" className="ml-2 text-sm font-bold text-sky-700 hover:underline">Part-Load Planner</Link></div>}
      </div>
      <div className="mt-3"><PagerBar list={list} placeholder="Search load number, partner, city, trip or truck" exportName="loads"
        sorts={[['loadNumber', 'Load'], ['createdAt', 'Created'], ['pickupFrom', 'Pickup from'], ['partnerName', 'Partner'], ['weightTons', 'Weight'], ['status', 'Status']]} /></div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className={cell}>Load</th>{!isPartner && <th className={cell}>Partner</th>}<th className={cell}>Route</th><th className={cell}>Weight</th><th className={cell}>Temperature</th><th className={cell}>{isPartner ? 'Rate per ton' : 'Fare'}</th><th className={cell}>Status</th><th className={cell}></th></tr></thead>
        <tbody>
          {shown.length === 0 && !list.busy && <tr><td colSpan={8} className="p-8 text-center text-slate-400">{loaded ? (isPartner ? 'You have not requested a load yet.' : 'No loads here.') : 'Loading...'}</td></tr>}
          {shown.map(x => [
            <tr key={x.id} className="border-t border-slate-200 align-top">
              <td className={`${cell} whitespace-nowrap font-semibold`}>{x.loadNumber}{isPartner && x.createdAt ? <div className="text-xs font-normal text-slate-500">{when(x.createdAt)}</div> : null}</td>
              {!isPartner && <td className={cell}>{x.partnerName}</td>}
              <td className={`${cell} whitespace-nowrap`}>{x.pickupCity} → {x.deliveryCity}
                {(x.pickupFrom || x.deliverBy) && <div className="text-xs text-slate-500">{x.pickupFrom ? `Pickup ${when(x.pickupFrom)}` : ''}{x.deliverBy ? `${x.pickupFrom ? ' · ' : ''}deliver ${x.deliverFrom ? `${when(x.deliverFrom)} to ` : 'by '}${when(x.deliverBy)}` : ''}</div>}</td>
              <td className={`${cell} whitespace-nowrap`}>{fmtWeight(x.weightTons)}</td>
              <td className={cell}>{temperature(x)}</td>
              <td className={`${cell} whitespace-nowrap`}>{isPartner ? (x.ratePerTon != null ? num(x.ratePerTon) : '-') : (x.actualFare != null ? num(x.actualFare) : '-')}</td>
              <td className={cell}><StatusChip status={x.status} />
                {x.status === 'REQUESTED' && <div className="mt-1 text-xs text-slate-500">Waiting for RefTech</div>}
                {(x.status === 'DECLINED' || x.status === 'CLOSED') && x.reviewNote ? <div className="mt-1 text-xs text-slate-600">{x.reviewNote}</div> : null}
                {x.status === 'CANCELLED' && x.cancelReason ? <div className="mt-1 text-xs text-slate-600">{x.cancelReason}</div> : null}
                {/* REQ-TRP-004 / REQ-TRP-005: the trip, the truck and the arrival time. Staff get a link to the planner. */}
                {x.tripNumber ? <div data-testid="load-trip" className="mt-1 text-xs text-slate-700">
                  {isPartner ? <b>{x.tripNumber}</b> : <Link to={`/part-load/${x.tripId}`} className="font-bold text-sky-700 hover:underline">{x.tripNumber}</Link>}{x.vehicleNumber ? `, truck ${x.vehicleNumber}` : ''}{x.tripStageLabel ? `, ${x.tripStageLabel.toLowerCase()}` : ''}
                  {x.status === 'DELIVERED' && x.podNumber ? <div data-testid="load-pod">Proof of delivery <b>{x.podNumber}</b>{x.deliveredAt ? `, ${when(x.deliveredAt)}` : ''}</div> : null}
                  {x.status === 'PLANNED' && (x.etaAt || x.expectedArrivalAt) ? <div>{x.etaAt ? 'Expected at the destination of the trip' : 'Promised at the destination of the trip'} {when(x.etaAt || x.expectedArrivalAt)}{x.etaLate ? <span className="ml-1 font-bold text-red-700">late</span> : null}</div> : null}
                </div> : null}</td>
              {isPartner && <td className={`${cell} text-right`}>{x.status === 'REQUESTED' && <button onClick={() => cancel(x)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>}</td>}
              {/* REQ-DSP-010: staff actions on an accepted load */}
              {!isPartner && <td className={`${cell} whitespace-nowrap text-right`}>{(x.status === 'OPEN' || x.status === 'PLANNED') && <div className="flex flex-col items-end gap-1">
                {x.status === 'OPEN' && !x.tripId && <Link to={`/dispatch?load=${x.id}`} className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white">Make trip</Link>} <Link to={`/dispatch/loads/${x.id}`} className="rounded-lg border border-cyan-700 px-3 py-1.5 text-xs font-bold text-cyan-800">Goods &amp; trucks</Link>
                <button onClick={() => { setEditId(editId === x.id ? null : x.id); setMsg(''); setError(''); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">{editId === x.id ? 'Close' : 'Edit'}</button>
                <button onClick={() => staffCancel(x)} disabled={busy} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Cancel</button>
              </div>}</td>}
            </tr>,
            !isPartner && editId === x.id && <tr key={`edit-${x.id}`} className="bg-slate-50"><td colSpan={8} className="p-3">
              <form onSubmit={e => saveEdit(e, x)} className="grid gap-2 md:grid-cols-4">
                {!x.tripId && <><div><label className={label}>Pickup City</label><input name="pickupCity" defaultValue={x.pickupCity} className={small} /></div>
                  <div><label className={label}>Delivery City</label><input name="deliveryCity" defaultValue={x.deliveryCity} className={small} /></div></>}
                <div><label className={label}>Weight ({unitNow('weight')})</label><input name="weightTons" type="number" step="any" min="0.001" defaultValue={toShown('weight', x.weightTons)} className={small} /></div>
                <div><label className={label}>Rate per Ton</label><input name="ratePerTon" type="number" step="0.01" min="0.01" defaultValue={x.ratePerTon != null ? num(x.ratePerTon) : ''} className={small} /></div>
                <div><label className={label}>Pickup From</label><input name="pickupFrom" type="datetime-local" defaultValue={localOf(x.pickupFrom)} className={small} /></div>
                <div><label className={label}>Deliver From</label><input name="deliverFrom" type="datetime-local" defaultValue={localOf(x.deliverFrom)} className={small} /></div>
                <div><label className={label}>Deliver By</label><input name="deliverBy" type="datetime-local" defaultValue={localOf(x.deliverBy)} className={small} /></div>
                <div className="md:col-span-2"><label className={label}>Reason for the change *</label><input name="reason" required minLength={5} className={`${small} w-full`} placeholder="Partner moved the delivery to Friday" /></div>
                <div className="flex items-end gap-2 md:col-span-4"><button disabled={busy} className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Save change</button>
                  {x.tripId ? <span className="text-xs text-slate-500">On trip {x.tripNumber}: the trip's load follows the change; the route stays as planned.</span> : null}</div>
              </form>
            </td></tr>])}
        </tbody>
      </table></div>
    </section>
  </>;
}
