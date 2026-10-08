/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-005 -- "Arrival" panel of the trip page: the promised time, the arrival time the application
// calculated last from the truck's latest position, how late the truck is, and the delay alert.
//
//   Everyone who may see the trip (staff, and a Partner for its own trips) sees the times and the state.
//   Employee, Manager, Admin: "Calculate now", and "Acknowledge" on an open delay alert.
//   Manager, Admin: "Change promised time" (a new time agreed with the customer, with a reason), and
//   "Store the town" when the arrival time cannot be estimated because the town has no coordinates.
//
// Backend: /api/operations/trips/{id}/eta, /eta/refresh, /promised-arrival, /api/operations/delays/{id}/acknowledge,
// /api/operations/places (EtaController).
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { api } from '@/shared/services/api';
import { fmtDateTime, fmtDistance } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Alert = { id: number; status: string; message?: string | null; note?: string | null; createdAt?: string | null; resolvedAt?: string | null };
type Eta = {
  ready: boolean; message?: string; tripNumber?: string; stage?: string; destination?: string | null;
  promisedAt?: string | null; etaAt?: string | null; delayMinutes?: number | null; marginMinutes?: number;
  distanceKm?: number | null; source?: string; sourceText?: string | null; calculatedAt?: string | null; positionAt?: string | null; note?: string | null;
  state?: string; stateText?: string; canRefresh?: boolean; canChangePromised?: boolean; googleConfigured?: boolean; alert?: Alert | null;
};

const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
export const delayText = (m?: number | null) => {
  if (m === null || m === undefined) return '';
  const a = Math.abs(m), h = Math.floor(a / 60), r = a % 60;
  return a < 60 ? `${a} min` : r ? `${h} h ${r} min` : `${h} h`;
};
const STATE: Record<string, string> = {
  ON_TIME: 'bg-emerald-100 text-emerald-800', LATE: 'bg-red-100 text-red-800', ARRIVED: 'bg-sky-100 text-sky-800', ARRIVED_LATE: 'bg-amber-100 text-amber-900',
  UNKNOWN: 'bg-slate-100 text-slate-700', NOT_STARTED: 'bg-slate-100 text-slate-700', NO_PROMISE: 'bg-slate-100 text-slate-700', CLOSED: 'bg-slate-100 text-slate-700',
};
const STATE_LABEL: Record<string, string> = {
  ON_TIME: 'On time', LATE: 'Late', ARRIVED: 'Arrived', ARRIVED_LATE: 'Arrived late', UNKNOWN: 'No arrival time', NOT_STARTED: 'Not started', NO_PROMISE: 'No promised time', CLOSED: 'Closed',
};
const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm';
const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600';
const errorText = (x: unknown, fallback: string) => (x instanceof Error && x.message ? x.message : fallback);

export function TripEtaPanel({ tripId, refreshKey, onChanged }: { tripId: number; refreshKey?: number; onChanged?: () => void }) {
  const [eta, setEta] = useState<Eta | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<'' | 'PROMISED' | 'ACK' | 'PLACE'>('');
  const sending = useRef(false);

  const load = useCallback(async () => {
    try { setEta(await api(`/api/operations/trips/${tripId}/eta`)); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the arrival time') }); }
  }, [tripId]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function run(work: () => Promise<Eta | void>, done: string) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setMsg(null);
    try {
      const r = await work();
      if (r) setEta(r); else await load();
      setForm('');
      setMsg({ ok: true, text: done });
      onChanged?.();
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'The change could not be saved') }); }
    finally { sending.current = false; setBusy(false); }
  }

  const calculate = () => run(() => api(`/api/operations/trips/${tripId}/eta/refresh`, { method: 'POST', body: '{}' }), 'The arrival time was calculated again.');
  function changePromised(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    // the field holds the time of this computer; it is sent as one moment (UTC), so the time zone of the computer does not matter
    void run(() => api(`/api/operations/trips/${tripId}/promised-arrival`, { method: 'POST', body: JSON.stringify({ expectedArrivalAt: new Date(String(f.get('expectedArrivalAt'))).toISOString(), reason: String(f.get('reason') || '').trim() }) }),
      'The promised arrival time is changed. The reason is in the status changes of the trip.');
  }
  function acknowledge(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = String(new FormData(e.currentTarget).get('note') || '').trim();
    void run(async () => { await api(`/api/operations/delays/${eta?.alert?.id}/acknowledge`, { method: 'POST', body: JSON.stringify({ note }) }); }, 'The delay is acknowledged.');
  }
  function storePlace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      await api('/api/operations/places', { method: 'POST', body: JSON.stringify({ name: f.get('name'), state: f.get('state'), latitude: f.get('latitude'), longitude: f.get('longitude') }) });
      return api(`/api/operations/trips/${tripId}/eta/refresh`, { method: 'POST', body: '{}' });
    }, 'The town is stored and the arrival time was calculated.');
  }

  if (!eta) return msg ? <div className="mt-4 rounded-xl bg-red-50 p-3 font-semibold text-red-800">{msg.text}</div> : null;
  if (!eta.ready) return <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Clock3 className="h-5 w-5 text-sky-700" />Arrival</h2><p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{eta.message}</p></section>;

  const state = eta.state || 'UNKNOWN';
  const late = state === 'LATE' || state === 'ARRIVED_LATE';
  const delay = eta.delayMinutes === null || eta.delayMinutes === undefined ? null : Number(eta.delayMinutes);
  const openAlert = eta.alert && (eta.alert.status === 'OPEN' || eta.alert.status === 'ACKNOWLEDGED') ? eta.alert : null;
  const noTown = state === 'UNKNOWN' && !!eta.note && /No coordinates/.test(eta.note);
  const localNow = () => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

  return <section data-testid="eta-panel" data-state={state} className={`mt-4 rounded-2xl bg-white p-5 shadow-sm ${state === 'LATE' ? 'ring-2 ring-red-300' : ''}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Clock3 className="h-5 w-5 text-sky-700" />Arrival
        <span data-testid="eta-state" className={`rounded-full px-3 py-1 text-xs font-bold ${STATE[state] || STATE.UNKNOWN}`}>{STATE_LABEL[state] || state}</span>
      </h2>
      <div className="flex flex-wrap gap-2">
        {eta.canRefresh && <button type="button" disabled={busy} onClick={() => { void calculate(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-sky-400 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Calculate now</button>}
        {eta.canChangePromised && <button type="button" disabled={busy} onClick={() => { setMsg(null); setForm(form === 'PROMISED' ? '' : 'PROMISED'); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-sky-400 disabled:opacity-50">Change promised time</button>}
      </div>
    </div>

    {msg && <div role="status" className={`mt-3 rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}

    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className={label}>Promised arrival</dt><dd className="text-base font-bold text-slate-900">{when(eta.promisedAt)}</dd></div>
      <div><dt className={label}>{state === 'ARRIVED' || state === 'ARRIVED_LATE' ? 'Arrived' : 'Expected arrival now'}</dt><dd data-testid="eta-time" className={`text-base font-bold ${late ? 'text-red-700' : 'text-slate-900'}`}>{eta.etaAt ? when(eta.etaAt) : '-'}</dd></div>
      <div><dt className={label}>{delay === null ? 'Against the promised time' : delay > 0 ? 'Late by' : delay < 0 ? 'Ahead by' : 'Against the promised time'}</dt><dd data-testid="eta-delay" className={`text-base font-bold ${late ? 'text-red-700' : 'text-slate-900'}`}>{delay === null ? '-' : delay === 0 ? 'On time' : delayText(delay)}</dd></div>
      <div><dt className={label}>Distance to go</dt><dd className="text-base font-bold text-slate-900">{eta.distanceKm === null || eta.distanceKm === undefined ? '-' : fmtDistance(eta.distanceKm)}</dd></div>
    </dl>
    <p data-testid="eta-text" className={`mt-3 text-sm font-semibold ${late ? 'text-red-800' : 'text-slate-700'}`}>{eta.stateText}</p>
    <p className="mt-1 text-xs text-slate-500">
      {eta.sourceText ? `${eta.sourceText}. ` : ''}{eta.calculatedAt ? `Calculated ${when(eta.calculatedAt)}` : ''}{eta.positionAt ? `, from the position of ${when(eta.positionAt)}` : ''}{eta.calculatedAt ? '. ' : ''}
      {/* how the alert works is shown to RefTech staff only: a Partner login gets no margin from the server */}
      {eta.promisedAt && eta.marginMinutes != null ? `A delay alert is raised when the truck will be more than ${eta.marginMinutes} minutes late.` : ''}
    </p>
    {eta.note && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{eta.note}</p>}

    {openAlert && <div data-testid="delay-alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <p className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Delay alert{openAlert.status === 'ACKNOWLEDGED' ? ' (acknowledged)' : ''}, raised {when(openAlert.createdAt)}. {openAlert.message}</span></p>
      {openAlert.note && <p className="mt-1 pl-6">Note: {openAlert.note}</p>}
      {openAlert.status === 'OPEN' && form !== 'ACK' && <button type="button" disabled={busy} onClick={() => { setMsg(null); setForm('ACK'); }} className="ml-6 mt-2 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50">Acknowledge</button>}
      {form === 'ACK' && <form onSubmit={acknowledge} className="mt-2 flex flex-wrap items-end gap-2 pl-6">
        <div className="min-w-[260px] flex-1"><label className={label} htmlFor="ack-note">Note (who was informed, why the truck is late) *</label><input id="ack-note" name="note" required minLength={5} maxLength={500} className={input} /></div>
        <button disabled={busy} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save</button>
        <button type="button" onClick={() => setForm('')} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Close</button>
      </form>}
    </div>}
    {!openAlert && eta.alert && eta.alert.status === 'RESOLVED' && <p className="mt-3 flex items-start gap-2 text-sm text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />The delay alert of this trip was closed {when(eta.alert.resolvedAt)}.</p>}

    {form === 'PROMISED' && <form onSubmit={changePromised} className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-3">
      <div><label className={label} htmlFor="promised-at">New promised arrival *</label><input id="promised-at" name="expectedArrivalAt" type="datetime-local" required defaultValue={localNow()} className={input} /></div>
      <div className="md:col-span-2"><label className={label} htmlFor="promised-reason">Reason (at least 10 characters) *</label><input id="promised-reason" name="reason" required minLength={10} maxLength={300} placeholder="For example: new time agreed with the customer by phone" className={input} /></div>
      <div className="flex gap-2 md:col-span-3"><button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save the new time</button><button type="button" onClick={() => setForm('')} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Close</button></div>
    </form>}

    {noTown && eta.canChangePromised && form !== 'PLACE' && <button type="button" onClick={() => { setMsg(null); setForm('PLACE'); }} className="mt-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-sky-400">Store the coordinates of {eta.destination}</button>}
    {form === 'PLACE' && <form onSubmit={storePlace} className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
      <div><label className={label} htmlFor="place-name">Town *</label><input id="place-name" name="name" required defaultValue={String(eta.destination || '').split(',')[0].trim()} maxLength={160} className={input} /></div>
      <div><label className={label} htmlFor="place-state">State</label><input id="place-state" name="state" maxLength={80} className={input} /></div>
      <div><label className={label} htmlFor="place-lat">Latitude *</label><input id="place-lat" name="latitude" required inputMode="decimal" placeholder="20.0570" className={input} /></div>
      <div><label className={label} htmlFor="place-lng">Longitude *</label><input id="place-lng" name="longitude" required inputMode="decimal" placeholder="86.0050" className={input} /></div>
      <p className="text-xs text-slate-500 md:col-span-4">In Google Maps, press and hold on the town: the two numbers shown are latitude and longitude.</p>
      <div className="flex gap-2 md:col-span-4"><button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Store and calculate</button><button type="button" onClick={() => setForm('')} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Close</button></div>
    </form>}
  </section>;
}
