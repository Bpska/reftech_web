/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-001 -- Trip lifecycle with driver, shown at the top of the Trip details page.
//
// The trip moves Planned -> Loading -> In transit -> At delivery -> Completed, or is Cancelled.
// Each move is a button here; the server decides whether the move is allowed (TripLifecycleService)
// and writes it to the trip history with the time, the user and the reason. Start Trip is the one
// move that lives in the loading checklist below, because it depends on the checklist rules.
//
// Also here: the driver of the trip (mandatory; can be changed before the trip starts) and the
// odometer readings at start and end.
//
// Backend: /api/operations/trips/{id}/lifecycle, /moves, /driver, and /api/operations/drivers.
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Flag, Gauge, MapPin, PackageOpen, Truck, UserRound, XCircle } from 'lucide-react';
import { api } from '@/shared/services/api';
import { fmtDateTime, fmtDistance } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Step = { code: string; label: string; state: 'done' | 'current' | 'todo' | 'skipped'; at?: string | null; by?: string | null };
type Move = { code: string; label: string; allowed: boolean; blockedBy?: string | null; needs: string[]; where: string };
type Driver = { id: number; name: string; mobile?: string | null; licenceNumber?: string | null; licenceExpiryDate?: string | null; status?: string; reportsTo?: string | null; runningTripNumber?: string | null; assignable?: boolean; note?: string | null };
type HistoryRow = { id: number; action: string; reason?: string | null; actionBy?: string | null; createdAt: string };
type Lifecycle = {
  tripId: number; tripNumber?: string; ready: boolean; message?: string; status: string; stage: string; stageLabel: string; cancelled: boolean;
  steps: Step[]; driver: Driver | null;
  odometer: { startKm?: number | null; endKm?: number | null; distanceKm?: number | null; lastKnownKm?: number | null; lastKnownTrip?: string | null };
  deliveries: { total?: number | null; delivered?: number | null };
  moves: Move[]; canAssignDriver: boolean; history: HistoryRow[];
};
type Form = '' | 'COMPLETE' | 'FORCE_COMPLETE' | 'CANCEL' | 'DRIVER';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900';
const label = 'mb-1.5 block text-sm font-semibold text-slate-700';
const REASON_MIN = 10;
const when = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const km = (v?: number | null) => (v === null || v === undefined ? '-' : `${Number(v).toLocaleString('en-IN')} km`);
const errorText = (x: unknown, fallback: string) => (x instanceof Error ? x.message : fallback);
/** Now, in the shape a datetime-local field wants (the user's own clock, no zone). */
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const STEP_ICON: Record<string, typeof Flag> = { PLANNED: Flag, LOADING: PackageOpen, IN_TRANSIT: Truck, AT_DELIVERY: MapPin, COMPLETED: CheckCircle2 };
export const STAGE_STYLE: Record<string, string> = {
  PLANNED: 'bg-amber-100 text-amber-800', LOADING: 'bg-violet-100 text-violet-800', IN_TRANSIT: 'bg-emerald-100 text-emerald-800',
  AT_DELIVERY: 'bg-teal-100 text-teal-800', COMPLETED: 'bg-sky-100 text-sky-800', CANCELLED: 'bg-red-100 text-red-800',
};

export function TripStatusPanel({ tripId, refreshKey, onChanged, openAlerts = 0, invoiceNumbers = [] }: {
  tripId: number; refreshKey?: number; onChanged?: (message?: string) => void;
  /** Shown as a reminder in the Complete, Close and Cancel forms. */
  openAlerts?: number; invoiceNumbers?: string[];
}) {
  const [data, setData] = useState<Lifecycle | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState<Form>('');
  const [note, setNote] = useState(''), [odometer, setOdometer] = useState(''), [at, setAt] = useState(''), [driverId, setDriverId] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The time the form opened with. When the user leaves it as it is, no time is sent and the server takes the exact moment.
  const atShown = useRef('');
  const sending = useRef(false);      // a second click while the first request is on its way does nothing

  const load = useCallback(async () => {
    try { setData(await api(`/api/operations/trips/${tripId}/lifecycle`)); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the trip status') }); }
  }, [tripId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { setForm(''); setMsg(null); }, [tripId]);

  function open(next: Form) {
    atShown.current = next === 'COMPLETE' || next === 'FORCE_COMPLETE' ? localNow() : '';
    setMsg(null); setNote(''); setOdometer(''); setDriverId(''); setAt(atShown.current);
    setForm(next);
    if (next === 'DRIVER') api('/api/operations/drivers').then((d: Driver[]) => setDrivers(Array.isArray(d) ? d : [])).catch(x => setMsg({ ok: false, text: errorText(x, 'Could not load the drivers') }));
  }

  async function move(code: string, body: Record<string, unknown>, done: (r: { tripNumber?: string; warnings?: string[]; distanceKm?: number | null }) => string) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true); setMsg(null);
    try {
      const r = await api(`/api/operations/trips/${tripId}/moves`, { method: 'POST', body: JSON.stringify({ move: code, ...body }) });
      await load();
      const warn = (r.warnings || []).length ? ` Note: ${(r.warnings as string[]).join(' ')}` : '';
      setMsg({ ok: true, text: done(r) + warn });
      setForm('');
      onChanged?.();
    } catch (x) { await load(); setMsg({ ok: false, text: errorText(x, 'The status could not be changed') }); }   // the moves are read again: the trip may have moved meanwhile
    finally { sending.current = false; setBusy(false); }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const tn = data?.tripNumber || 'Trip';
    if (form === 'COMPLETE' || form === 'FORCE_COMPLETE') {
      void move(form, { odometerKm: odometer.trim(), at: at && at !== atShown.current ? new Date(at).toISOString() : undefined, note: note.trim() },
        r => `${tn} is completed.${r.distanceKm != null ? ` Distance ${fmtDistance(r.distanceKm)}.` : ''}`);
    } else if (form === 'CANCEL') {
      void move('CANCEL', { reason: note.trim() }, () => `${tn} is cancelled.`);
    } else if (form === 'DRIVER') {
      void assignDriver();
    }
  }

  async function assignDriver() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true); setMsg(null);
    try {
      const r = await api(`/api/operations/trips/${tripId}/driver`, { method: 'POST', body: JSON.stringify({ driverId, reason: note.trim() }) });
      await load();
      setMsg({ ok: true, text: `${r.message}.` });
      setForm('');
      onChanged?.();
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'The driver could not be saved') }); }
    finally { sending.current = false; setBusy(false); }
  }

  const card = 'mt-4 rounded-2xl bg-white p-5 shadow-sm';
  const heading = <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Flag className="h-5 w-5 text-sky-700" />Trip status</h2>;
  if (!data) return <section className={card}>{heading}{msg ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{msg.text}</p> : <p className="mt-3 text-sm text-slate-500">Loading...</p>}</section>;

  const d = data.driver, o = data.odometer || {};
  const onRoad = data.stage === 'IN_TRANSIT' || data.stage === 'AT_DELIVERY';
  const cancelRow = data.cancelled ? data.history.find(h => h.action === 'CANCELLED') : undefined;
  const moves = data.moves || [];
  const primary = moves.filter(m => !['CANCEL', 'FORCE_COMPLETE'].includes(m.code));
  const cancel = moves.find(m => m.code === 'CANCEL'), force = moves.find(m => m.code === 'FORCE_COMPLETE');
  const completing = form === 'COMPLETE' || form === 'FORCE_COMPLETE';
  const reasonLeft = REASON_MIN - note.trim().length;
  const needReason = form === 'CANCEL' || form === 'FORCE_COMPLETE' || (form === 'DRIVER' && onRoad);
  const btn = 'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600';

  return <section className={card} id="trip-status">
    <div className="flex flex-wrap items-center justify-between gap-3">
      {heading}
      <span data-testid="trip-stage" className={`rounded-full px-3 py-1 text-xs font-bold ${STAGE_STYLE[data.stage] || 'bg-slate-100 text-slate-700'}`}>{data.stageLabel}</span>
    </div>
    {!data.ready && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{data.message}</p>}
    {msg && <p role="status" className={`mt-3 rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</p>}

    {/* ---------------------------------------------------------------- the steps */}
    <ol className="mt-4 grid gap-2 sm:grid-cols-5" aria-label="Steps of the trip">
      {data.steps.map((s, i) => {
        const Icon = STEP_ICON[s.code] || Flag;
        const tone = s.state === 'done' ? 'border-emerald-300 bg-emerald-50' : s.state === 'current' ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-200' : 'border-slate-200 bg-slate-50';
        const dot = s.state === 'done' ? 'bg-emerald-600 text-white' : s.state === 'current' ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-500';
        return <li key={s.code} data-step={s.code} data-state={s.state} className={`rounded-xl border p-3 ${tone}`}>
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${dot}`}><Icon className="h-4 w-4" /></span>
            <span className={`font-bold ${s.state === 'todo' || s.state === 'skipped' ? 'text-slate-500' : 'text-slate-900'}`}>{i + 1}. {s.label}</span>
          </div>
          <div className="mt-1 min-h-9 text-xs text-slate-600">{s.state === 'skipped' ? 'Not reached' : s.at ? <>{when(s.at)}{s.by ? <><br />{s.by}</> : null}</> : s.state === 'current' ? 'Now' : ''}</div>
        </li>;
      })}
    </ol>
    {data.cancelled && <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Cancelled{cancelRow ? ` on ${when(cancelRow.createdAt)} by ${cancelRow.actionBy || '-'}: ${cancelRow.reason || ''}` : ''}</span></p>}

    {/* ---------------------------------------------------------------- driver and odometer */}
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold text-slate-900"><UserRound className="h-4 w-4 text-sky-700" />Driver</h3>
          {data.canAssignDriver && form !== 'DRIVER' && <button type="button" onClick={() => open('DRIVER')} className="text-sm font-bold text-sky-700 hover:underline">{d ? 'Change driver' : 'Assign driver'}</button>}
        </div>
        {d
          ? <div className="mt-2 text-sm"><div className="font-semibold text-slate-900" data-testid="trip-driver">{d.name}{d.mobile ? `, ${d.mobile}` : ''}</div>
            {d.licenceNumber && <div className="text-slate-600">Licence {d.licenceNumber}{d.licenceExpiryDate ? `, valid until ${d.licenceExpiryDate}` : ''}</div>}
            {d.reportsTo && <div className="text-slate-600">Reports to {d.reportsTo}</div>}
            {d.note && <div className="mt-1 font-semibold text-amber-700">{d.note}</div>}</div>
          : <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />No driver assigned. A trip cannot start without a driver.</p>}
      </div>
      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><Gauge className="h-4 w-4 text-sky-700" />Odometer</h3>
        <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">At start</dt><dd className="font-semibold text-slate-900" data-testid="odometer-start">{km(o.startKm)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">At end</dt><dd className="font-semibold text-slate-900" data-testid="odometer-end">{km(o.endKm)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Distance</dt><dd className="font-semibold text-slate-900" data-testid="odometer-distance">{o.distanceKm == null ? '-' : fmtDistance(o.distanceKm)}</dd></div>
        </dl>
        {o.lastKnownKm != null && o.startKm == null && <p className="mt-2 text-xs text-slate-600">Last reading of this truck: {km(o.lastKnownKm)} ({o.lastKnownTrip}).</p>}
      </div>
    </div>

    {/* ---------------------------------------------------------------- the moves */}
    {moves.length > 0 && !form && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-bold text-slate-900">Next step</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {primary.map(m => m.where === 'CHECKLIST'
          ? <p key={m.code} className="text-sm font-semibold text-slate-700">Fill the loading checklist below. When every line is green, type the odometer reading and press <b>Start Trip</b> there.</p>
          : m.code === 'COMPLETE'
            ? <button key={m.code} type="button" disabled={busy || !m.allowed} onClick={() => open('COMPLETE')} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}><CheckCircle2 className="h-4 w-4" />{m.label}</button>
            : <button key={m.code} type="button" disabled={busy || !m.allowed}
              onClick={() => { void move(m.code, {}, r => `${r.tripNumber || 'Trip'}: ${m.code === 'START_LOADING' ? 'loading has started' : m.code === 'ARRIVE' ? 'arrival at the delivery is recorded' : 'left for the next delivery'}.`); }}
              className={`${btn} ${m.code === 'DEPART' ? 'border border-slate-300 bg-white text-slate-700 hover:border-sky-400' : 'bg-sky-700 text-white hover:bg-sky-800'}`}>{m.label}</button>)}
        {force && <button type="button" disabled={busy} onClick={() => open('FORCE_COMPLETE')} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400">{force.label}</button>}
        {cancel && <button type="button" disabled={busy} onClick={() => open('CANCEL')} className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"><XCircle className="h-4 w-4" />{cancel.label}</button>}
      </div>
      {primary.filter(m => !m.allowed && m.blockedBy).map(m => <p key={m.code} className="mt-2 flex items-start gap-2 text-sm font-semibold text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{m.label}: {m.blockedBy}.</p>)}
    </div>}

    {/* ---------------------------------------------------------------- forms: complete, close, cancel, driver */}
    {form && <form onSubmit={submit} className={`mt-4 rounded-2xl border-2 p-4 ${form === 'CANCEL' ? 'border-red-300' : form === 'DRIVER' ? 'border-sky-300' : 'border-emerald-300'}`}>
      <h3 className="text-lg font-bold text-slate-900">{form === 'COMPLETE' ? `Complete ${data.tripNumber}` : form === 'FORCE_COMPLETE' ? `Close ${data.tripNumber} without the normal steps` : form === 'CANCEL' ? `Cancel ${data.tripNumber}` : d ? 'Change the driver' : 'Assign a driver'}</h3>
      <p className="mt-1 text-sm text-slate-600">{form === 'COMPLETE' ? 'The truck has delivered and the trip ends. This is recorded with your name and cannot be undone from the portal.'
        : form === 'FORCE_COMPLETE' ? 'For a trip whose steps were not recorded, for example the proof of delivery is on paper. The reason is kept in the trip history.'
          : form === 'CANCEL' ? 'Use this when the trip will not run. It leaves the Running and Upcoming lists. This cannot be undone from the portal.'
            : onRoad ? 'The trip is on the road. The change and the reason are kept in the trip history.' : 'Drivers are the employees with the role Driver in HR.'}</p>
      {form !== 'DRIVER' && openAlerts > 0 && <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{openAlerts} alert{openAlerts === 1 ? ' is' : 's are'} still open for this trip. {form === 'CANCEL' ? 'Cancelling' : 'Completing'} the trip does not close {openAlerts === 1 ? 'it' : 'them'}; a temperature alert still needs its cause and corrective action on the Temperature Alerts page.</p>}
      {form === 'CANCEL' && invoiceNumbers.length > 0 && <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />This trip is on bill {invoiceNumbers.join(', ')}. Cancelling the trip does not change the bill.</p>}
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {completing && <div>
          <label className={label} htmlFor="end-odometer">Odometer at end (km){form === 'COMPLETE' || o.startKm != null ? ' *' : ''}</label>
          <input id="end-odometer" type="number" min="0" step="0.1" inputMode="decimal" required={form === 'COMPLETE' || o.startKm != null} value={odometer} onChange={e => setOdometer(e.target.value)} className={input} placeholder={o.startKm != null ? `more than ${Number(o.startKm)}` : ''} />
          {o.startKm != null && <p className="mt-1 text-xs text-slate-500">At start: {km(o.startKm)}{odometer && Number(odometer) >= Number(o.startKm) ? `. Distance ${fmtDistance(Number(odometer) - Number(o.startKm))}` : ''}</p>}
        </div>}
        {completing && <div>
          <label className={label} htmlFor="completed-at">Completed at *</label>
          <input id="completed-at" type="datetime-local" required value={at} max={localNow()} onChange={e => setAt(e.target.value)} className={input} />
        </div>}
        {form === 'DRIVER' && <div className="lg:col-span-2">
          <label className={label} htmlFor="trip-driver-select">Driver *</label>
          <select id="trip-driver-select" required value={driverId} onChange={e => setDriverId(e.target.value)} className={input}>
            <option value="">Select driver</option>
            {drivers.map(x => <option key={x.id} value={x.id} disabled={!x.assignable || x.id === d?.id}>{x.name}{x.mobile ? ` (${x.mobile})` : ''}{x.id === d?.id ? ' - driver of this trip' : x.note ? ` - ${x.note.toLowerCase()}` : ''}</option>)}
          </select>
          {drivers.length === 0 && <p className="mt-1 text-xs text-amber-700">No driver found. Add one in HR &gt; Add Employee / Driver with the role Driver.</p>}
        </div>}
        <div className={completing ? '' : form === 'DRIVER' ? '' : 'lg:col-span-3'}>
          <label className={label} htmlFor="status-note">{needReason ? 'Reason *' : form === 'DRIVER' ? 'Reason' : 'Note'}</label>
          <textarea id="status-note" rows={2} required={needReason} minLength={needReason ? REASON_MIN : undefined} maxLength={500} value={note} onChange={e => setNote(e.target.value)} className={input}
            placeholder={form === 'CANCEL' ? 'For example: partner cancelled the order before loading' : form === 'FORCE_COMPLETE' ? 'For example: delivery note signed on paper, driver confirmed on the phone' : ''} />
          {needReason && <p className="mt-1 text-xs text-slate-500">{reasonLeft > 0 ? `${reasonLeft} more character${reasonLeft === 1 ? '' : 's'} needed` : `${note.trim().length} of 500 characters`}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button disabled={busy} className={`rounded-xl px-5 py-2.5 font-bold text-white disabled:opacity-60 ${form === 'CANCEL' ? 'bg-red-700 hover:bg-red-800' : form === 'DRIVER' ? 'bg-sky-700 hover:bg-sky-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}>
          {busy ? 'Saving...' : form === 'COMPLETE' ? 'Confirm: Complete trip' : form === 'FORCE_COMPLETE' ? 'Confirm: Close trip' : form === 'CANCEL' ? 'Confirm: Cancel trip' : 'Save driver'}</button>
        <button type="button" disabled={busy} onClick={() => setForm('')} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-700">{form === 'DRIVER' ? 'Keep the driver' : 'Keep the trip as it is'}</button>
      </div>
    </form>}
  </section>;
}
