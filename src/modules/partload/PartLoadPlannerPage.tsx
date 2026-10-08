/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-004 -- Part-Load Planner. For Employee, Manager and Admin.
//
//   /part-load            the part-load trips that are not finished, with their free capacity
//   /part-load/:tripId    the planner of one trip:
//       capacity          truck, the trip's own goods, the loads on it, what is free (tons and cubic metres)
//       loads             each load with its fare and its share of the trip total; "Remove" while the trip is planned or loading
//       stops             the stops in driving order; the arrows change the order (a load is picked up before it is delivered)
//       open loads        every open load request, with "fits" or the reason why not; "Add" puts it on the trip
//
// Backend: /api/operations/part-load/trips, /api/operations/trips/{id}/part-load (+ /loads, /stops) (PartLoadController).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowLeft, Boxes, MapPin, PackagePlus, Thermometer, Trash2, Truck } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { fmtDateTime, fmtMoney, fmtTemp, fmtTempRange, fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type TripRow = { id: number; tripNumber: string; partnerName?: string; vehicleNumber?: string; sourceCity?: string; destinationCity?: string; plannedStartAt?: string; capacityTons?: number | null; usedTons: number; freeTons?: number | null; loads: number; stage: string; stageLabel: string; profileName?: string; minC?: number | null; maxC?: number | null; canEdit: boolean };
type Capacity = { capacityTons?: number | null; ownTons: number; attachedTons: number; usedTons: number; freeTons?: number | null; usedPercent?: number | null; capacityM3?: number | null; usedM3?: number | null; freeM3?: number | null };
type LoadRow = { tripLoadId: number; loadNumber: string; partnerName?: string; pickupCity?: string; deliveryCity?: string; weightTons: number; volumeM3?: number | null; ratePerTon?: number | null; fare?: number | null; sharePercent?: number | null; profileName?: string | null; tempMinC?: number | null; tempMaxC?: number | null; targetC?: number | null; status?: string };
type Stop = { id: number; order: number; type: string; place: string; own: boolean; fixed: boolean; loadNumber?: string | null; partnerName?: string | null; what: string; onBoardAfterTons: number };
type Candidate = { id: number; loadNumber: string; partnerName?: string; pickupCity?: string; deliveryCity?: string; weightTons?: number | null; volumeM3?: number | null; ratePerTon?: number | null; fare?: number | null; profileName?: string | null; tempMinC?: number | null; tempMaxC?: number | null; targetC?: number | null; pickupFrom?: string | null; fits: boolean; reasons: string[]; freeAfterTons?: number | null; needsRate: boolean };
type Plan = {
  ready: boolean; message?: string; tripId: number; tripNumber: string; tripType: string; stage: string; stageLabel: string; partnerName?: string; vehicleNumber?: string;
  sourceCity?: string; destinationCity?: string; plannedStartAt?: string; capacity: Capacity;
  temperature: { profileName?: string | null; targetC?: number | null; minC?: number | null; maxC?: number | null; commonText?: string | null; warning?: string | null };
  own: { partnerName?: string; pickupCity?: string; deliveryCity?: string; weightTons?: number | null; volumeM3?: number | null; ratePerTon?: number | null; fare?: number | null; sharePercent?: number | null };
  loads: LoadRow[]; revenue: { ownFare?: number | null; attachedFare: number; totalFare: number }; stops: Stop[]; canEdit: boolean; editNote?: string | null; candidates?: Candidate[]; warning?: string | null;
  approved?: boolean; manager?: boolean; reasonRequired?: boolean;
};

const n = (v?: number | null, unit = '') => (v === null || v === undefined ? '-' : `${Number(v)}${unit}`);
const money = (v?: number | null) => fmtMoney(v);
const range = (min?: number | null, max?: number | null, target?: number | null) => (min != null && max != null ? `${fmtTempRange(min, max)}` : target != null ? `${fmtTemp(target)}` : '-');
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const errorText = (x: unknown, fallback: string) => (x instanceof Error && x.message ? x.message : fallback);
const card = 'rounded-2xl bg-white p-5 shadow-sm';
const STAGE: Record<string, string> = { PLANNED: 'bg-amber-100 text-amber-800', LOADING: 'bg-violet-100 text-violet-800', IN_TRANSIT: 'bg-emerald-100 text-emerald-800', AT_DELIVERY: 'bg-teal-100 text-teal-800', COMPLETED: 'bg-sky-100 text-sky-800', CANCELLED: 'bg-red-100 text-red-800' };

/** Own goods, attached loads and free space as one bar. */
function CapacityBar({ c }: { c: Capacity }) {
  const cap = Number(c.capacityTons || 0);
  if (cap <= 0) return <p className="mt-2 text-sm font-semibold text-amber-800">The truck has no capacity in tons. Enter it on Manage Vehicles.</p>;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / cap) * 100))}%`;
  return <div className="mt-3">
    <div data-testid="capacity-bar" className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${c.usedTons} of ${cap} tons used`}>
      <div className="bg-sky-600" style={{ width: pct(Number(c.ownTons)) }} title={`The trip's own goods: ${fmtWeight(c.ownTons)}`} />
      <div className="bg-indigo-400" style={{ width: pct(Number(c.attachedTons)) }} title={`Loads added: ${fmtWeight(c.attachedTons)}`} />
    </div>
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-slate-600">
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-600" />Own goods {fmtWeight(c.ownTons)}</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-indigo-400" />Loads added {fmtWeight(c.attachedTons)}</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-slate-200" />Free {fmtWeight(c.freeTons)}</span>
    </div>
  </div>;
}

export function PartLoadPlannerPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const user = currentUser();
  const staff = ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(String(user.role || user.roleCode || '').replace('ROLE_', '').toUpperCase()) && String(user.loginType || user.userType || '').toUpperCase() !== 'PARTNER';
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rateFor, setRateFor] = useState<number | null>(null);
  const [rate, setRate] = useState('');
  const [showAll, setShowAll] = useState(false);
  const sending = useRef(false);

  const loadTrips = useCallback(async () => {
    try { setTrips(await api('/api/operations/part-load/trips')); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the part-load trips') }); setTrips([]); }
  }, []);
  const loadPlan = useCallback(async () => {
    if (!tripId) { setPlan(null); return; }
    try { setPlan(await api(`/api/operations/trips/${tripId}/part-load`)); }
    catch (x) { setPlan(null); setMsg({ ok: false, text: errorText(x, 'Could not load the planner of this trip') }); }
  }, [tripId]);
  useEffect(() => { if (staff) void loadTrips(); }, [staff, loadTrips]);
  useEffect(() => { setMsg(null); setRateFor(null); if (staff) void loadPlan(); }, [staff, loadPlan]);
  // the list of open loads is long: the answer of Add / Remove is brought into view
  const messageBox = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (msg) messageBox.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [msg]);

  async function change(work: () => Promise<Plan>, fallback: string) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setMsg(null);
    try {
      const p = await work();
      setPlan(p); setRateFor(null); setRate('');
      if (p.message) setMsg({ ok: true, text: p.message });
      void loadTrips();
    } catch (x) { setMsg({ ok: false, text: errorText(x, fallback) }); }
    finally { sending.current = false; setBusy(false); }
  }
  // REQ-DSP-002: an approved trip is frozen. A Manager or an Admin may still change it, with a reason that is logged.
  // Returns null when the user cancels, undefined when no reason is needed.
  const reasonFor = (what: string): string | null | undefined => {
    if (!plan?.approved) return undefined;
    const r = window.prompt(`Trip ${plan.tripNumber} is approved. Reason for ${what} (at least 5 letters):`);
    return r === null ? null : r.trim();
  };
  const add = (c: Candidate) => {
    if (c.needsRate && rateFor !== c.id) { setMsg(null); setRateFor(c.id); setRate(''); return; }
    const reason = reasonFor(`adding ${c.loadNumber}`);
    if (reason === null) return;
    void change(() => api(`/api/operations/trips/${tripId}/part-load/loads`, { method: 'POST', body: JSON.stringify({ loadRequestId: c.id, ratePerTon: c.needsRate ? rate.trim() : undefined, reason }) }), 'The load could not be added');
  };
  const remove = (l: LoadRow) => {
    if (!window.confirm(`Take ${l.loadNumber} (${fmtWeight(l.weightTons)}) off the trip? The load request becomes open again.`)) return;
    const reason = reasonFor(`removing ${l.loadNumber}`);
    if (reason === null) return;
    const q = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    void change(() => api(`/api/operations/trips/${tripId}/part-load/loads/${l.tripLoadId}${q}`, { method: 'DELETE' }), 'The load could not be removed');
  };
  const move = (index: number, by: number) => {
    if (!plan) return;
    const ids = plan.stops.map(s => s.id);
    const to = index + by;
    if (to < 1 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const reason = reasonFor('changing the order of the stops');
    if (reason === null) return;
    void change(() => api(`/api/operations/trips/${tripId}/part-load/stops`, { method: 'PUT', body: JSON.stringify({ stopIds: ids, reason }) }), 'The order could not be changed');
  };

  if (!staff) return <div className="p-10">The part-load planner is for RefTech staff.</div>;

  // ------------------------------------------------------------------ the list of trips
  if (!tripId) return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><Boxes className="h-8 w-8 text-sky-700" />Part-Load Planner</h1>
    <p className="mt-1 text-slate-600">Part-load trips that are not finished. Open a trip to put open load requests on it. A trip is created as a part-load trip on Create Trip (Trip type: Part load).</p>
    {msg && <div role="status" className={`mt-4 rounded-xl p-3 font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}
    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
      <table data-testid="partload-trips" className="w-full min-w-[980px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Trip</th><th className="p-2">Partner</th><th className="p-2">Truck</th><th className="p-2">Route</th><th className="p-2">Planned start</th><th className="p-2">Temperature</th><th className="p-2">Loads</th><th className="p-2">Used</th><th className="p-2">Free</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead>
        <tbody>{trips === null ? <tr><td colSpan={11} className="p-6 text-center text-slate-400">Loading...</td></tr>
          : trips.length === 0 ? <tr><td colSpan={11} className="p-6 text-center text-slate-400">No part-load trip is planned or on the road.</td></tr>
            : trips.map(t => <tr key={t.id} className="border-t">
              <td className="p-2 font-semibold">{t.tripNumber}</td><td className="p-2">{t.partnerName || '-'}</td><td className="p-2">{t.vehicleNumber || '-'}</td><td className="p-2">{t.sourceCity || '-'} → {t.destinationCity || '-'}</td><td className="p-2">{when(t.plannedStartAt)}</td>
              <td className="p-2">{t.profileName || ''} {range(t.minC, t.maxC)}</td><td className="p-2">{t.loads}</td><td className="p-2">{Number(t.usedTons)} of {fmtWeight(t.capacityTons)}</td>
              <td className={`p-2 font-bold ${Number(t.freeTons || 0) > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{fmtWeight(t.freeTons)}</td>
              <td className="p-2"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${STAGE[t.stage] || ''}`}>{t.stageLabel}</span></td>
              <td className="p-2"><Link to={`/part-load/${t.id}`} className="rounded-lg border border-sky-500 px-3 py-1.5 text-xs font-bold text-sky-700">{t.canEdit ? 'Plan' : 'View'}</Link></td>
            </tr>)}</tbody>
      </table>
    </section>
  </>;

  // ------------------------------------------------------------------ the planner of one trip
  const back = <button type="button" onClick={() => navigate('/part-load')} className="inline-flex items-center gap-1 text-sm font-bold text-sky-700 hover:underline"><ArrowLeft className="h-4 w-4" />All part-load trips</button>;
  if (!plan) return <>{back}{msg ? <div className="mt-4 rounded-xl bg-red-50 p-3 font-semibold text-red-800">{msg.text}</div> : <p className="mt-4 text-slate-500">Loading...</p>}</>;
  if (!plan.ready) return <>{back}<p className="mt-4 rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">{plan.message}</p></>;

  const c = plan.capacity, t = plan.temperature;
  const candidates = plan.candidates || [];
  const fitting = candidates.filter(x => x.fits);
  const shown = showAll ? candidates : fitting;

  return <>
    {back}
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <h1 className="text-3xl font-bold text-slate-900">Plan {plan.tripNumber}</h1>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${STAGE[plan.stage] || ''}`}>{plan.stageLabel.toUpperCase()}</span>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{plan.tripType === 'PART_LOAD' ? 'PART LOAD' : 'FULL TRIP'}</span>
      <Link to={`/trips/${plan.tripId}`} className="text-sm font-bold text-sky-700 hover:underline">Open the trip page</Link>
    </div>
    <p className="mt-1 text-slate-600">{plan.partnerName || '-'} · {plan.vehicleNumber || 'No truck'} · {plan.sourceCity || '-'} → {plan.destinationCity || '-'} · planned start {when(plan.plannedStartAt)}</p>
    {plan.warning && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{plan.warning}</div>}
    {msg && <div ref={messageBox} role="status" data-testid="planner-message" className={`mt-4 rounded-xl p-3 font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}
    {!plan.canEdit && plan.editNote && <div data-testid="planner-locked" className="mt-4 rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">{plan.editNote}</div>}
    {plan.canEdit && plan.approved && <div data-testid="planner-frozen" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">This trip is approved and frozen. Each change asks for a reason and is logged as a change after approval.</div>}

    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      <section className={`${card} xl:col-span-2`}>
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Truck className="h-5 w-5 text-sky-700" />Capacity of {plan.vehicleNumber}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Truck</dt><dd className="text-xl font-black">{fmtWeight(c.capacityTons)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Used</dt><dd data-testid="used-tons" className="text-xl font-black">{fmtWeight(c.usedTons)}{c.usedPercent != null ? <span className="ml-1 text-sm font-semibold text-slate-500">({c.usedPercent}%)</span> : null}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Free</dt><dd data-testid="free-tons" className={`text-xl font-black ${Number(c.freeTons || 0) > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{fmtWeight(c.freeTons)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">Cubic metres</dt><dd className="text-xl font-black">{c.freeM3 == null ? <span className="text-sm font-semibold text-slate-500">not checked (a volume is missing)</span> : <>{Number(c.freeM3)} <span className="text-sm font-semibold text-slate-500">free of {Number(c.capacityM3)} m³</span></>}</dd></div>
        </dl>
        <CapacityBar c={c} />
      </section>
      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Thermometer className="h-5 w-5 text-sky-700" />Temperature</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-slate-500">The trip's own goods</dt><dd className="font-bold">{t.profileName ? `${t.profileName}, ` : ''}{range(t.minC, t.maxC, t.targetC)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Reefer target</dt><dd className="font-bold">{(t.targetC == null ? '-' : fmtTemp(t.targetC))}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Range that suits every load on the truck</dt><dd data-testid="common-range" className="font-bold text-sky-800">{t.commonText || '-'}</dd></div>
        </dl>
        {t.warning && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{t.warning}</p>}
      </section>
    </div>

    <section className={`${card} mt-4 overflow-x-auto`}>
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Boxes className="h-5 w-5 text-sky-700" />On this truck ({plan.loads.length + 1})</h2>
      <table data-testid="loads-on-trip" className="mt-3 w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Load</th><th className="p-2">Partner</th><th className="p-2">From → To</th><th className="p-2">Tons</th><th className="p-2">m³</th><th className="p-2">Temperature</th><th className="p-2">Rate per ton</th><th className="p-2">Fare</th><th className="p-2">Share of the trip</th><th className="p-2"></th></tr></thead>
        <tbody>
          <tr className="border-t"><td className="p-2 font-semibold">Own goods of the trip</td><td className="p-2">{plan.own.partnerName || '-'}</td><td className="p-2">{plan.own.pickupCity || '-'} → {plan.own.deliveryCity || '-'}</td><td className="p-2">{n(plan.own.weightTons)}</td><td className="p-2">{n(plan.own.volumeM3)}</td><td className="p-2">{range(t.minC, t.maxC, t.targetC)}</td><td className="p-2">{money(plan.own.ratePerTon)}</td><td className="p-2 font-semibold">{money(plan.own.fare)}</td><td className="p-2">{n(plan.own.sharePercent, ' %')}</td><td className="p-2"></td></tr>
          {plan.loads.map(l => <tr key={l.tripLoadId} data-load={l.loadNumber} className="border-t">
            <td className="p-2 font-semibold">{l.loadNumber}{l.status === 'DELIVERED' && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Delivered</span>}</td><td className="p-2">{l.partnerName || '-'}</td><td className="p-2">{l.pickupCity || '-'} → {l.deliveryCity || '-'}</td><td className="p-2">{n(l.weightTons)}</td><td className="p-2">{n(l.volumeM3)}</td>
            <td className="p-2">{l.profileName ? `${l.profileName}, ` : ''}{range(l.tempMinC, l.tempMaxC, l.targetC)}</td><td className="p-2">{money(l.ratePerTon)}</td><td className="p-2 font-semibold">{money(l.fare)}</td><td className="p-2">{n(l.sharePercent, ' %')}</td>
            <td className="p-2">{plan.canEdit && <button type="button" disabled={busy} onClick={() => remove(l)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:border-red-400 hover:text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Remove</button>}</td>
          </tr>)}
          <tr className="border-t bg-slate-50 font-bold"><td className="p-2" colSpan={3}>Trip total</td><td className="p-2">{Number(c.usedTons)}</td><td className="p-2">{c.usedM3 == null ? '-' : Number(c.usedM3)}</td><td className="p-2"></td><td className="p-2"></td><td data-testid="total-fare">{money(plan.revenue.totalFare)}</td><td className="p-2">100 %</td><td className="p-2"></td></tr>
        </tbody>
      </table>
    </section>

    <section className={`${card} mt-4`}>
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><MapPin className="h-5 w-5 text-sky-700" />Stops in driving order ({plan.stops.length})</h2>
      <p className="mt-1 text-sm text-slate-600">The arrows move a stop up or down. The start of the trip stays first, and a load is picked up before it is delivered. The deliveries of the trip page follow this order.</p>
      <ol data-testid="stops" className="mt-3 space-y-2">{plan.stops.map((s, i) => <li key={s.id} data-stop={s.type} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{s.order}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.type === 'PICKUP' ? 'bg-violet-100 text-violet-800' : 'bg-teal-100 text-teal-800'}`}>{s.type === 'PICKUP' ? 'Pick up' : 'Deliver'}</span>
        <span className="min-w-[140px] font-bold text-slate-900">{s.place}</span>
        <span className="flex-1 text-slate-600">{s.what}{s.partnerName ? `, ${s.partnerName}` : ''}</span>
        <span className="whitespace-nowrap text-xs font-semibold text-slate-500">on board after: {fmtWeight(s.onBoardAfterTons)}</span>
        {plan.stage !== 'COMPLETED' && plan.stage !== 'CANCELLED' && !s.fixed && (!plan.approved || plan.manager) && <span className="flex gap-1">
          <button type="button" disabled={busy || i <= 1} onClick={() => move(i, -1)} aria-label={`Move stop ${s.order} up`} title="Move up" className="rounded border border-slate-300 p-1 text-slate-600 hover:border-sky-400 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" disabled={busy || i >= plan.stops.length - 1} onClick={() => move(i, 1)} aria-label={`Move stop ${s.order} down`} title="Move down" className="rounded border border-slate-300 p-1 text-slate-600 hover:border-sky-400 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
        </span>}
      </li>)}</ol>
    </section>

    {plan.canEdit && <section className={`${card} mt-4 overflow-x-auto`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><PackagePlus className="h-5 w-5 text-sky-700" />Open loads: {fitting.length} fit, {candidates.length - fitting.length} do not</h2>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />Also show the loads that do not fit, with the reason</label>
      </div>
      <table data-testid="candidates" className="mt-3 w-full min-w-[980px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Load</th><th className="p-2">Partner</th><th className="p-2">From → To</th><th className="p-2">Tons</th><th className="p-2">m³</th><th className="p-2">Temperature</th><th className="p-2">Rate</th><th className="p-2">Fare</th><th className="p-2">Fits?</th><th className="p-2"></th></tr></thead>
        <tbody>{shown.length === 0 ? <tr><td colSpan={10} className="p-6 text-center text-slate-400">{candidates.length === 0 ? 'There is no open load request.' : 'No open load fits this trip. Tick the box above to see why.'}</td></tr>
          : shown.map(x => <tr key={x.id} data-candidate={x.loadNumber} className="border-t align-top">
            <td className="p-2 font-semibold">{x.loadNumber}</td><td className="p-2">{x.partnerName || '-'}</td><td className="p-2">{x.pickupCity || '-'} → {x.deliveryCity || '-'}</td><td className="p-2">{n(x.weightTons)}</td><td className="p-2">{n(x.volumeM3)}</td>
            <td className="p-2">{x.profileName ? `${x.profileName}, ` : ''}{range(x.tempMinC, x.tempMaxC, x.targetC)}</td><td className="p-2">{x.needsRate ? <span className="font-semibold text-amber-700">no rate yet</span> : money(x.ratePerTon)}</td><td className="p-2">{money(x.fare)}</td>
            <td className="p-2">{x.fits ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Fits, {fmtWeight(x.freeAfterTons)} free after</span>
              : <span className="text-xs font-semibold text-red-700">{x.reasons.join('. ')}</span>}</td>
            <td className="p-2 whitespace-nowrap">{x.fits && <>
              {rateFor === x.id && <input aria-label={`Rate per ton for ${x.loadNumber}`} value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" placeholder="Rate per ton" className="mr-2 w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm" />}
              <button type="button" disabled={busy || (rateFor === x.id && !rate.trim())} onClick={() => add(x)} className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50">{rateFor === x.id ? 'Add with this rate' : 'Add'}</button>
            </>}</td>
          </tr>)}</tbody>
      </table>
    </section>}
  </>;
}
