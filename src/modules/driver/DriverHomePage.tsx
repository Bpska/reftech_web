/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-006 -- Driver page. What a driver login sees in the portal: its own trips, nothing else.
//
// The page uses the driver mobile API only (/api/mobile/driver/...), the same addresses the phone app will
// use, so it is also the reference for that app:
//
//   my trips            the trips this driver is on; a finished trip moves to "Finished"
//   one trip            the step it is in, the next step with its button, the arrival time, the stops
//   position, temperature   "Send my position" (from the phone or the browser), "Send temperature"
//   loading checklist   the same panel as on the office trip page
//   deliveries          the same panel: proof of delivery with signature and photos
//   expenses, fuel      with the photo of the receipt; the list shows what this driver entered himself
//                       REQ-TRP-011: sent with their own reference (saved once) and kept on the phone without network
//   breakdown           report it to the office
//   My HR               REQ-HR-007, 009: leave, attendance, payslips, letters, documents, safety score (/driver/me)
//   consent             REQ-PLT-001: the company's text on location sharing, with "I agree" once per version of the text
//
// A driver login is sent here after sign-in; the office pages answer 403 for it.
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Fuel, Image as ImageIcon, LogOut, MapPin, Navigation, Receipt, ShieldCheck, Thermometer, Truck } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { TripChecklistPanel } from '@/modules/trip/TripChecklistPanel';
import { TripDeliveriesPanel } from '@/modules/trip/TripDeliveriesPanel';
import { EXPENSE_KINDS, openPicture, postForm, shrinkPhoto } from '@/modules/trip/TripCostsPanel';
import { fmtDateTime, fmtMoney, fmtTemp, fmtTempRange, fmtWeight, toBase, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { answerText, formFields, packFile, sendOrKeep, startDriverSync } from './driverOffline';
import { DriverOfflineQueue } from './DriverOfflineQueue';

const D = '/api/mobile/driver';
type TripRow = { id: number; tripNumber: string; partnerName?: string; vehicleNumber?: string; sourceCity?: string; destinationCity?: string; plannedStartAt?: string; promisedAt?: string; etaAt?: string | null; delayMinutes?: number | null; stage: string; stageLabel: string; minC?: number | null; maxC?: number | null; profileName?: string | null };
type Move = { code: string; label: string; allowed: boolean; blockedBy?: string | null; needs: string[]; where: string };
type Step = { code: string; label: string; state: string; at?: string | null };
type Detail = {
  tripId: number; tripNumber: string; stage: string; stageLabel: string; steps: Step[]; moves: Move[]; vehicleNumber?: string; sourceCity?: string; destinationCity?: string; plannedLoadTons?: number | null; maxSpeedKmph?: number | null;
  odometer?: { startKm?: number | null; endKm?: number | null; distanceKm?: number | null };
  tollsFromStatement?: boolean;   // REQ-GOV-004: tolls come from the FASTag bank statement; the driver does not type them
  deliveries?: { total?: number | null; delivered?: number | null };
  temperature?: { profileName?: string | null; targetC?: number | null; minC?: number | null; maxC?: number | null; commonMinC?: number | null; commonMaxC?: number | null };
  eta?: { stateText?: string; state?: string; etaAt?: string | null; promisedAt?: string | null } | null;
  stops?: { id: number; order: number; type: string; place: string; what: string }[];
  warnings?: string[];
};

const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const money = (v?: number | null) => fmtMoney(v);
const STAGE: Record<string, string> = { PLANNED: 'bg-amber-100 text-amber-800', LOADING: 'bg-violet-100 text-violet-800', IN_TRANSIT: 'bg-emerald-100 text-emerald-800', AT_DELIVERY: 'bg-teal-100 text-teal-800', COMPLETED: 'bg-sky-100 text-sky-800', CANCELLED: 'bg-red-100 text-red-800' };
const input = 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base';
const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600';
const card = 'mt-4 rounded-2xl bg-white p-4 shadow-sm';
const big = 'w-full rounded-xl bg-sky-700 px-4 py-3 text-base font-bold text-white hover:bg-sky-800 disabled:opacity-50';
const errorText = (x: unknown, fallback: string) => (x instanceof Error && x.message ? x.message : fallback);
type Consent = { text: string; version: string; accepted: boolean; acceptedAt?: string | null; canRecord: boolean; message?: string };

function signOut() {
  api('/api/auth/logout', { method: 'POST' }).catch(() => { }).finally(() => { localStorage.clear(); window.location.href = '/login'; });
}

export function DriverHomePage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const user = currentUser();
  const role = String(user.role || user.roleCode || '').replace('ROLE_', '').toUpperCase();
  const [me, setMe] = useState<any>(null);
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [history, setHistory] = useState(false);
  const [trip, setTrip] = useState<Detail | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState('');    // '', EXPENSE, FUEL, BREAKDOWN, POSITION
  const [busy, setBusy] = useState(false);
  const [panelKey, setPanelKey] = useState(0);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [consentErr, setConsentErr] = useState('');
  const sending = useRef(false);
  const messageBox = useRef<HTMLDivElement | null>(null);
  const id = tripId ? Number(tripId) : null;
  // the trip that is open now: an answer that comes late for a trip the driver has already left is not shown
  const shownId = useRef<number | null>(id);
  shownId.current = id;

  const loadTrips = useCallback(async () => {
    try { setTrips(await api(`${D}/trips${history ? '?history=true' : ''}`)); }
    catch (x) { setTrips([]); setMsg({ ok: false, text: errorText(x, 'Could not load your trips') }); }
  }, [history]);
  const loadTrip = useCallback(async () => {
    if (!id) { setTrip(null); return; }
    const mine = () => shownId.current === id;
    try {
      const d = await api(`${D}/trips/${id}`);
      if (!mine()) return;
      setTrip(d);
      api(`${D}/trips/${id}/expenses`).then(r => { if (mine()) setExpenses(r); }).catch(() => { if (mine()) setExpenses([]); });
      api(`${D}/trips/${id}/fuel`).then(r => { if (mine()) setFuel(r); }).catch(() => { if (mine()) setFuel([]); });
    } catch (x) { if (mine()) { setTrip(null); setMsg({ ok: false, text: errorText(x, 'Could not load the trip') }); } }
  }, [id]);
  useEffect(() => { if (role === 'DRIVER') api(`${D}/me`).then(setMe).catch(x => setMsg({ ok: false, text: errorText(x, 'Could not load your driver record') })); }, [role]);
  // REQ-PLT-001: the consent text on location sharing; asked again when the company changes the text
  useEffect(() => { if (role === 'DRIVER') api(`${D}/privacy/consent`).then(setConsent).catch(() => setConsent(null)); }, [role]);
  async function agree() {
    if (!consent) return;
    setConsentErr('');
    try { setConsent(await api(`${D}/privacy/consent`, { method: 'POST', body: JSON.stringify({ version: consent.version }) })); }
    catch (x) {
      setConsentErr(errorText(x, 'Your answer was not saved. Try again'));
      api(`${D}/privacy/consent`).then(setConsent).catch(() => { });   // the text may have changed meanwhile
    }
  }
  useEffect(() => { if (role === 'DRIVER' && !id) void loadTrips(); }, [role, id, loadTrips]);
  useEffect(() => { setMsg(null); setForm(''); setTrip(null); setExpenses([]); setFuel([]); if (role === 'DRIVER') void loadTrip(); }, [role, loadTrip]);
  // on a phone the message is above the form that was sent: bring it into view
  useEffect(() => { if (msg) messageBox.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [msg]);
  // the server signs a login out after 10 minutes without a request; an open trip is read again every 4 minutes
  useEffect(() => { if (role !== 'DRIVER') return; const t = window.setInterval(() => { if (id) void loadTrip(); else void loadTrips(); }, 240000); return () => window.clearInterval(t); }, [role, id, loadTrip, loadTrips]);

  useEffect(() => { if (role === 'DRIVER') startDriverSync(); }, [role]);

  /**
   * REQ-TRP-011: an expense or a fuel bill, with its own reference through the driver sync address. Without network it
   * is kept on the phone and sent later; the same reference sent twice is saved once.
   */
  async function saveCost(kind: 'EXPENSE' | 'FUEL', target: HTMLFormElement): Promise<{ queued: boolean; text: string }> {
    if (!id) throw new Error('Open a trip first');
    const fd = new FormData(target);
    const receipt = fd.get('receipt');
    const file = receipt instanceof File && receipt.size > 0 ? await packFile(await shrinkPhoto(receipt)) : null;
    const fields = formFields(fd, ['receipt']);
    const what = kind === 'EXPENSE' ? `Expense ${money(fields.amount ? Number(fields.amount) : null)}` : `Fuel ${fields.litres || ''} L, ${money(fields.amount ? Number(fields.amount) : null)}`;
    const r = await sendOrKeep({ kind, tripId: id, fields, file, label: what });
    if (r.queued) return { queued: true, text: `No network. ${what} is kept on this phone and sent as soon as the network is back.` };
    if (r.answer?.status !== 'APPLIED') throw new Error(answerText(r.answer, what));
    return { queued: false, text: `${what} saved${r.answer?.repeated ? ' (it was already saved before)' : ''}.` };
  }

  /** Runs one action. true = it worked (the caller may then empty its form); false = refused, or another action is still running. */
  async function act(work: () => Promise<any>, done: (r: any) => string, reload = true): Promise<boolean> {
    if (sending.current) return false;
    sending.current = true; setBusy(true); setMsg(null);
    const forTrip = id;
    try {
      const r = await work();
      if (shownId.current !== forTrip) return true;
      setForm('');
      setMsg({ ok: true, text: done(r) });
      if (reload) { await loadTrip(); setPanelKey(k => k + 1); }
      return true;
    } catch (x) { if (shownId.current === forTrip) setMsg({ ok: false, text: errorText(x, 'That did not work. Try again') }); return false; }
    finally { sending.current = false; setBusy(false); }
  }

  function doMove(e: FormEvent<HTMLFormElement>, m: Move) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { move: m.code };
    if (m.needs.includes('odometer')) body.odometerKm = String(f.get('odometerKm') || '').trim();
    const note = String(f.get('note') || '').trim();
    if (note) body.note = note;
    void act(async () => { const r: Detail = await api(`${D}/trips/${id}/status`, { method: 'POST', body: JSON.stringify(body) }); setTrip(r); return r; },
      r => `${m.label}: done. The trip is now ${String(r.stageLabel).toLowerCase()}.${(r.warnings || []).length ? ` Note: ${(r.warnings || []).join(' ')}` : ''}`);
  }
  function sendPosition(lat: number, lng: number, speedKmph?: number | null) {
    void act(() => api(`${D}/trips/${id}/location`, { method: 'POST', body: JSON.stringify({ latitude: lat, longitude: lng, speedKmph: speedKmph ?? undefined }) }),
      r => (r.stored ? `Position sent: ${lat.toFixed(4)}, ${lng.toFixed(4)}.` : 'This position was already stored.'), false);
  }
  function myPosition() {
    if (!navigator.geolocation) { setForm('POSITION'); return; }
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      p => sendPosition(p.coords.latitude, p.coords.longitude, p.coords.speed == null ? null : Math.round(p.coords.speed * 3.6)),
      () => { setForm('POSITION'); setMsg({ ok: false, text: 'The position of this device could not be read. Type latitude and longitude, or allow the location in the browser.' }); },
      { enableHighAccuracy: true, timeout: 10000 });
  }

  if (role !== 'DRIVER') return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm"><h1 className="text-xl font-bold">Driver page</h1><p className="mt-2 text-slate-600">This page is for a driver login. {role ? 'You are signed in as ' + role + '.' : 'Sign in with your driver login.'}</p><a href={role ? '/dashboard' : '/login'} className="mt-4 inline-block font-bold text-sky-700 underline">{role ? 'Go to the Dashboard' : 'Sign in'}</a></div></main>;

  const name = me?.driver?.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
  const shell = (children: any) => <main className="driver-app min-h-screen bg-slate-50">
    <header className="bg-frost-950 text-white"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
      <div><div className="flex items-center gap-2 text-lg font-black"><Truck className="h-5 w-5" />RefTech Driver</div><div data-testid="driver-name" className="text-sm text-sky-200">{name}{me?.driver?.licenceNumber ? ` · licence ${me.driver.licenceNumber}` : ''}</div></div>
      <div className="flex gap-2">
        {/* REQ-HR-007, 009: leave, payslips, documents and the driver's own safety score */}
        <button type="button" onClick={() => navigate('/driver/me')} className="rounded-xl border border-white/30 px-3 py-2 text-sm font-bold hover:bg-white/10">My HR</button>
        <button type="button" onClick={signOut} className="inline-flex items-center gap-1 rounded-xl border border-white/30 px-3 py-2 text-sm font-bold hover:bg-white/10"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </div></header>
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-4">{consentCard}{children}</div>
  </main>;
  const consentCard = consent && !consent.accepted && <section data-testid="driver-consent" className="mb-4 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
    <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><ShieldCheck className="h-5 w-5 text-sky-700" />Sharing your location</h2>
    <p className="mt-2 whitespace-pre-line text-slate-700">{consent.text}</p>
    {consent.canRecord
      ? <button type="button" onClick={() => { void agree(); }} className={`${big} mt-3`}>I have read this and I agree</button>
      : <p className="mt-2 text-xs text-slate-500">{consent.message || 'Your answer cannot be saved yet.'}</p>}
    {consentErr && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{consentErr}</p>}
  </section>;
  const note = msg && <div ref={messageBox} role="status" data-testid="driver-message" className={`mt-4 rounded-xl p-3 font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>;

  // ------------------------------------------------------------------ my trips
  if (!id) return shell(<>
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-slate-900">{history ? 'My finished trips' : 'My trips'}</h1>
      <button type="button" onClick={() => setHistory(!history)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">{history ? 'Show my open trips' : 'Show finished trips'}</button>
    </div>
    {me?.driver?.note && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{me.driver.note}</p>}
    {note}
    <div data-testid="driver-trips" className="mt-4 space-y-3">{trips === null ? <p className="text-slate-500">Loading...</p>
      : trips.length === 0 ? <p className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">{history ? 'No finished trip yet.' : 'No trip is planned for you. The office puts you on a trip.'}</p>
        : trips.map(t => <button key={t.id} type="button" data-trip={t.tripNumber} onClick={() => navigate(`/driver/${t.id}`)} className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm hover:ring-2 hover:ring-sky-300">
          <div className="flex items-center justify-between gap-2"><span className="text-lg font-black text-slate-900">{t.tripNumber}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${STAGE[t.stage] || ''}`}>{t.stageLabel}</span></div>
          <div className="mt-1 font-semibold text-slate-800">{t.sourceCity || '-'} → {t.destinationCity || '-'}</div>
          <div className="mt-1 text-sm text-slate-600">{t.vehicleNumber || 'No truck'} · {t.partnerName || '-'} · start {when(t.plannedStartAt)} · promised {when(t.promisedAt)}</div>
          {t.minC != null && t.maxC != null && <div className="mt-1 text-sm text-slate-600">{t.profileName ? `${t.profileName}, ` : ''}{fmtTempRange(t.minC, t.maxC)}</div>}
        </button>)}</div>
  </>);

  // ------------------------------------------------------------------ one trip
  const back = <button type="button" onClick={() => navigate('/driver')} className="inline-flex items-center gap-1 text-sm font-bold text-sky-700"><ArrowLeft className="h-4 w-4" />My trips</button>;
  if (!trip) return shell(<>{back}{note || <p className="mt-4 text-slate-500">Loading...</p>}</>);
  const open = trip.stage !== 'COMPLETED' && trip.stage !== 'CANCELLED';
  const onRoad = trip.stage === 'IN_TRANSIT' || trip.stage === 'AT_DELIVERY';
  const t = trip.temperature || {};
  const base = `${D}/trips/${trip.tripId}`;
  // with part loads on the truck the box is kept in the range that suits every load
  const keepMin = t.commonMinC ?? t.minC, keepMax = t.commonMaxC ?? t.maxC;
  const narrowed = keepMin != null && keepMax != null && (Number(keepMin) !== Number(t.minC) || Number(keepMax) !== Number(t.maxC));

  return shell(<>
    {back}
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <h1 className="text-2xl font-bold text-slate-900">{trip.tripNumber}</h1>
      <span data-testid="driver-stage" className={`rounded-full px-3 py-1 text-xs font-bold ${STAGE[trip.stage] || ''}`}>{trip.stageLabel.toUpperCase()}</span>
    </div>
    <p className="mt-1 text-slate-700">{trip.vehicleNumber || 'No truck'} · {trip.sourceCity || '-'} → {trip.destinationCity || '-'}{trip.plannedLoadTons != null ? ` · ${fmtWeight(trip.plannedLoadTons)}` : ''}</p>
    <p className="text-sm text-slate-600">{keepMin != null && keepMax != null ? `Keep ${fmtTempRange(keepMin, keepMax)}${narrowed ? ' (the range that suits every load on the truck)' : ''}${t.targetC != null ? `, reefer at ${fmtTemp(t.targetC)}` : ''}` : 'No temperature range on this trip'}{trip.maxSpeedKmph != null ? ` · speed limit ${Number(trip.maxSpeedKmph)} km/h` : ''}</p>
    {note}

    <section className={card}>
      <ol className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold">{trip.steps.map(s => <li key={s.code} className={`flex items-center gap-1 ${s.state === 'done' ? 'text-emerald-700' : s.state === 'current' ? 'text-sky-800' : 'text-slate-400'}`}>
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.state === 'done' ? 'bg-emerald-600' : s.state === 'current' ? 'bg-sky-600' : 'bg-slate-300'}`} />{s.label}{s.at ? <span className="font-normal text-slate-500">{when(s.at)}</span> : null}</li>)}</ol>
      {trip.eta?.stateText && onRoad && (trip.eta.etaAt || trip.eta.state === 'LATE') && <p data-testid="driver-eta" className={`mt-3 text-sm font-semibold ${trip.eta.state === 'LATE' ? 'text-red-700' : 'text-slate-700'}`}>{trip.eta.stateText}</p>}
      {trip.odometer?.startKm != null && <p className="mt-2 text-sm text-slate-600">Odometer at start {Number(trip.odometer.startKm).toLocaleString('en-IN')} km{trip.odometer.endKm != null ? `, at the end ${Number(trip.odometer.endKm).toLocaleString('en-IN')} km (${Number(trip.odometer.distanceKm)} km)` : ''}</p>}

      {trip.moves.map(m => <form key={m.code} onSubmit={e => doMove(e, m)} data-move={m.code} className="mt-4 border-t pt-4">
        <h2 className="text-lg font-black text-slate-900">Next step: {m.label}</h2>
        {m.where === 'CHECKLIST'
          ? <p className="mt-1 text-sm text-slate-600">Fill in the loading checklist below, add a photo, then press Start trip there (it asks for the odometer reading).</p>
          : <>
            {m.blockedBy && <p className="mt-1 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{m.blockedBy}</p>}
            {m.needs.includes('odometer') && <div className="mt-2"><label className={label} htmlFor={`odo-${m.code}`}>Odometer reading now (km) *</label><input id={`odo-${m.code}`} name="odometerKm" required inputMode="decimal" className={input} /></div>}
            <div className="mt-2"><label className={label} htmlFor={`note-${m.code}`}>Note</label><input id={`note-${m.code}`} name="note" maxLength={300} className={input} /></div>
            <button disabled={busy || !m.allowed} className={`${big} mt-3`}>{m.label}</button>
          </>}
      </form>)}
      {!open && <p className="mt-4 border-t pt-4 font-semibold text-slate-700">This trip is {trip.stageLabel.toLowerCase()}. Nothing more to do here.</p>}
    </section>

    {(trip.stops || []).length > 2 && <section className={card}>
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><MapPin className="h-5 w-5 text-sky-700" />Stops in order</h2>
      <ol data-testid="driver-stops" className="mt-2 space-y-1 text-sm">{(trip.stops || []).map(s => <li key={s.id}><b>{s.order}. {s.type === 'PICKUP' ? 'Pick up' : 'Deliver'} at {s.place}</b> <span className="text-slate-600">{s.what}</span></li>)}</ol>
    </section>}

    {onRoad && <section className={card}>
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Navigation className="h-5 w-5 text-sky-700" />Position and temperature</h2>
      <p className="mt-1 text-sm text-slate-600">The phone app sends the position by itself. Here it is sent by hand. A temperature by hand is taken when the sensor of the truck is silent.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <button type="button" disabled={busy} onClick={myPosition} className={big}>Send my position</button>
          {form === 'POSITION' && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); sendPosition(Number(f.get('latitude')), Number(f.get('longitude'))); }} className="mt-2 grid grid-cols-2 gap-2">
            <input name="latitude" required inputMode="decimal" aria-label="Latitude" placeholder="Latitude" className={input} /><input name="longitude" required inputMode="decimal" aria-label="Longitude" placeholder="Longitude" className={input} />
            <button disabled={busy} className="col-span-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Send this position</button>
          </form>}
          {form !== 'POSITION' && <button type="button" onClick={() => setForm('POSITION')} className="mt-2 text-sm font-bold text-sky-700 underline">Type the position instead</button>}
        </div>
        <form onSubmit={e => { e.preventDefault(); const target = e.currentTarget; const v = String(new FormData(target).get('temperatureC') || '').trim(); void act(() => api(`${base}/temperature`, { method: 'POST', body: JSON.stringify({ temperatureC: toBase('temp', v) }) }), r => `Temperature ${fmtTemp(toBase('temp', v))} sent${r.outOfRange ? ': it is OUTSIDE the range. Check the reefer and call the office.' : ': inside the range.'}`, false).then(ok => { if (ok) target.reset(); }); }} className="flex items-end gap-2">
          <div className="flex-1"><label className={label} htmlFor="temp-now"><Thermometer className="mr-1 inline h-3.5 w-3.5" />Box temperature now ({unitNow('temp')})</label><input id="temp-now" name="temperatureC" required inputMode="decimal" placeholder="2.5" className={input} /></div>
          <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Send</button>
        </form>
      </div>
    </section>}

    {/* the same panels as on the office trip page, through the driver API */}
    {(trip.stage === 'PLANNED' || trip.stage === 'LOADING') && <TripChecklistPanel tripId={trip.tripId} apiBase={base} refreshKey={panelKey}
      onChanged={() => { void loadTrip(); }} onStarted={text => { setMsg({ ok: true, text }); void loadTrip(); }} />}
    {(onRoad || trip.stage === 'COMPLETED') && <TripDeliveriesPanel tripId={trip.tripId} apiBase={base} refreshKey={panelKey} onChanged={() => { void loadTrip(); }} />}

    <section data-testid="driver-costs" className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Receipt className="h-5 w-5 text-sky-700" />My expenses and fuel</h2>
        {open && <div className="flex gap-2">
          <button type="button" onClick={() => { setMsg(null); setForm(form === 'EXPENSE' ? '' : 'EXPENSE'); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">Add expense</button>
          <button type="button" onClick={() => { setMsg(null); setForm(form === 'FUEL' ? '' : 'FUEL'); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"><Fuel className="h-4 w-4" />Add fuel</button>
        </div>}
      </div>
      {form === 'EXPENSE' && <form onSubmit={e => { e.preventDefault(); const target = e.currentTarget; void act(() => saveCost('EXPENSE', target), r => r.text); }} className="mt-3 grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
        <div><label className={label} htmlFor="d-exp-kind">Kind *</label><select id="d-exp-kind" name="expenseType" className={input}>{EXPENSE_KINDS.filter(([c]) => !(trip.tollsFromStatement && c === 'TOLL')).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></div>
        {trip.tollsFromStatement && <p className="text-sm text-slate-600 sm:col-span-2">FASTag tolls come from the bank statement. You do not need to type them. If you paid a toll in cash, give the receipt to the office.</p>}
        <div><label className={label} htmlFor="d-exp-amount">Amount *</label><input id="d-exp-amount" name="amount" required inputMode="decimal" className={input} /></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="d-exp-desc">What for</label><input id="d-exp-desc" name="description" maxLength={500} className={input} /></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="d-exp-receipt">Photo of the receipt *</label><input id="d-exp-receipt" name="receipt" type="file" required accept="image/jpeg,image/png,image/webp" className="w-full text-sm" /></div>
        <button disabled={busy} className={`${big} sm:col-span-2`}>Save expense</button>
      </form>}
      {form === 'FUEL' && <form onSubmit={e => { e.preventDefault(); const target = e.currentTarget; void act(() => saveCost('FUEL', target), r => r.text); }} className="mt-3 grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
        <div><label className={label} htmlFor="d-fuel-for">Fuel for</label><select id="d-fuel-for" name="fuelFor" className={input}><option value="TRUCK">Truck engine</option><option value="REEFER">Reefer unit</option></select></div>
        <div><label className={label} htmlFor="d-fuel-litres">Litres *</label><input id="d-fuel-litres" name="litres" required inputMode="decimal" className={input} /></div>
        <div><label className={label} htmlFor="d-fuel-amount">Amount of the bill *</label><input id="d-fuel-amount" name="amount" required inputMode="decimal" className={input} /></div>
        <div><label className={label} htmlFor="d-fuel-km">Odometer now (km)</label><input id="d-fuel-km" name="odometerKm" inputMode="decimal" className={input} /></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="d-fuel-station">Fuel station</label><input id="d-fuel-station" name="station" maxLength={200} className={input} /></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="d-fuel-receipt">Photo of the bill *</label><input id="d-fuel-receipt" name="receipt" type="file" required accept="image/jpeg,image/png,image/webp" className="w-full text-sm" /></div>
        <button disabled={busy} className={`${big} sm:col-span-2`}>Save fuel</button>
      </form>}
      <DriverOfflineQueue tripId={trip.tripId} kinds={['EXPENSE', 'FUEL']} onSent={() => { void loadTrip(); }} />
      {expenses.length + fuel.length === 0 ? <p className="mt-2 text-sm text-slate-500">You have recorded nothing on this trip yet.</p> : <ul data-testid="driver-cost-list" className="mt-3 divide-y text-sm">
        {fuel.map((f: any) => <li key={`f${f.id}`} className="flex items-center justify-between gap-2 py-2"><span><b>{f.fuelFor === 'REEFER' ? 'Reefer diesel' : 'Diesel'} {Number(f.litres)} L</b> <span className="text-slate-600">{when(f.filledAt)}{f.station ? `, ${f.station}` : ''}</span></span><span className="flex items-center gap-3 whitespace-nowrap font-bold">{money(f.amount)}{f.hasReceipt && <button type="button" onClick={() => { void openPicture(`${base}/fuel/${f.id}/receipt`); }} aria-label="Open the bill" className="text-sky-700"><ImageIcon className="h-4 w-4" /></button>}</span></li>)}
        {expenses.map((x: any) => <li key={`e${x.id}`} className="flex items-center justify-between gap-2 py-2"><span><b>{(EXPENSE_KINDS.find(k => k[0] === x.expenseType) || [x.expenseType, x.expenseType])[1]}</b> <span className="text-slate-600">{x.expenseDate}{x.description ? `, ${x.description}` : ''}</span></span><span className="flex items-center gap-3 whitespace-nowrap font-bold">{money(x.amount)}{x.hasReceipt && <button type="button" onClick={() => { void openPicture(`${base}/expenses/${x.id}/receipt`); }} aria-label="Open the receipt" className="text-sky-700"><ImageIcon className="h-4 w-4" /></button>}</span></li>)}
      </ul>}
    </section>

    {open && <section className={card}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><AlertTriangle className="h-5 w-5 text-rose-700" />Breakdown</h2>
        <button type="button" onClick={() => { setMsg(null); setForm(form === 'BREAKDOWN' ? '' : 'BREAKDOWN'); }} className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-bold text-rose-700">Report a breakdown</button>
      </div>
      {form === 'BREAKDOWN' && <form onSubmit={e => { e.preventDefault(); const f = Object.fromEntries(Array.from(new FormData(e.currentTarget).entries()).filter(([, v]) => String(v).trim() !== '')); void act(() => api(`${base}/breakdown`, { method: 'POST', body: JSON.stringify(f) }), () => 'The breakdown is reported. The office sees it now. Call them as well.', false); }} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><label className={label} htmlFor="d-bd-cat">What *</label><select id="d-bd-cat" name="category" className={input}><option value="TYRE">Tyre</option><option value="ENGINE">Engine</option><option value="REEFER_UNIT">Reefer unit</option><option value="ELECTRICAL">Electrical</option><option value="BRAKES">Brakes</option><option value="ACCIDENT">Accident</option><option value="OTHER">Other</option></select></div>
        <div><label className={label} htmlFor="d-bd-place">Where</label><input id="d-bd-place" name="place" maxLength={255} className={input} /></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="d-bd-desc">What happened *</label><input id="d-bd-desc" name="description" required minLength={5} maxLength={1000} className={input} /></div>
        <button disabled={busy} className="w-full rounded-xl bg-rose-700 px-4 py-3 text-base font-bold text-white disabled:opacity-50 sm:col-span-2">Report to the office</button>
      </form>}
    </section>}
  </>);
}
