/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-002, 003, 004, 006, 008, 009 -- the "Tracking" panel of Trip details: where the positions came from,
// the customer's tracking links, the stops with arrival, departure and waiting time, the reference route, the
// e-way bills, the reefer unit, the hired-truck tracking and a link to Route Playback.
// A Partner login sees the sources and its tracking links; the rest is for staff.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radar } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { Banner, btn, btnLight, errorText, input, td, th } from '@/shared/components/FormKit';
import { copy, isStaff, minutesText, num, origin, pill, sourceText, when } from './telematics';
import { fmtDistance, fmtTemp } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const STOP_STATE: Record<string, ['green' | 'amber' | 'grey', string]> = { NOT_REACHED: ['grey', 'Not reached'], AT_STOP: ['amber', 'At the stop'], LEFT: ['green', 'Left'] };
const EWAY_TONE: Record<string, 'green' | 'amber' | 'red' | 'grey'> = { OK: 'green', EXPIRING: 'amber', URGENT: 'red', EXPIRED: 'red', NO_VALIDITY: 'grey' };

export function TripTrackingPanel({ tripId, refreshKey }: { tripId: number; refreshKey?: number }) {
  const staff = isStaff(currentUser());
  const [sources, setSources] = useState<any[]>([]), [links, setLinks] = useState<any[]>([]);
  const [geo, setGeo] = useState<any>(null), [eway, setEway] = useState<any>(null), [reefer, setReefer] = useState<any>(null), [hired, setHired] = useState<any>(null), [places, setPlaces] = useState<any[]>([]);
  const [made, setMade] = useState<any>(null), [making, setMaking] = useState(false), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [notReady, setNotReady] = useState(false);

  const load = useCallback(() => {
    api(`/api/tracking/trips/${tripId}/sources`).then(x => setSources(Array.isArray(x) ? x : [])).catch(() => setSources([]));
    api(`/api/tracking/trips/${tripId}/share-links`).then(x => setLinks(Array.isArray(x) ? x : [])).catch(() => setLinks([]));
    if (!staff) return;
    api(`/api/tracking/trips/${tripId}/geofence`).then(x => { setGeo(x); setNotReady(x?.ready === false); }).catch(() => setGeo(null));
    api(`/api/tracking/trips/${tripId}/eway`).then(setEway).catch(() => setEway(null));
    api(`/api/tracking/trips/${tripId}/reefer`).then(setReefer).catch(() => setReefer(null));
    api(`/api/tracking/trips/${tripId}/hired-tracking`).then(setHired).catch(() => setHired(null));
    api('/api/tracking/geofences').then(x => setPlaces((x?.places || []).filter((p: any) => p.active))).catch(() => setPlaces([]));
  }, [tripId, staff]);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function run(fn: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await fn(); setMsg(r?.message || done); load(); return r; }
    catch (e) { setErr(errorText(e, 'Not done')); return null; } finally { setBusy(false); }
  }
  async function makeLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await run(() => api(`/api/tracking/trips/${tripId}/share-links`, { method: 'POST', body: JSON.stringify({
      recipient: f.get('recipient') || undefined, mobile: f.get('mobile') || undefined, showTemperature: f.get('showTemperature') === 'on', showDriver: f.get('showDriver') === 'on',
      afterDeliveryHours: f.get('afterDeliveryHours') || undefined, origin: origin() }) }), 'Link made');
    if (r) { setMade(r); setMaking(false); }
  }
  async function addStop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (await run(() => api(`/api/tracking/trips/${tripId}/stops/from-place`, { method: 'POST', body: JSON.stringify(f) }), 'Stop added')) e.currentTarget?.reset?.();
  }
  async function setRef(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f: any = Object.fromEntries(new FormData(e.currentTarget));
    const body = f.ref === 'STOPS' ? { source: 'STOPS' } : { source: 'PAST_TRIP', pastTripId: f.ref || undefined };
    await run(() => api(`/api/tracking/trips/${tripId}/route-reference`, { method: 'POST', body: JSON.stringify(body) }), 'Route set');
  }

  if (notReady) return null;
  const active = links.filter(l => l.active);
  return <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Radar className="h-5 w-5" />Tracking</h2>
      <div className="flex flex-wrap gap-2">
        <Link className={btnLight} to={`/tracking/playback?trip=${tripId}`}>Route playback</Link>
        {!making && <button className={btnLight} onClick={() => { setMaking(true); setMade(null); }}>Customer tracking link</button>}
      </div>
    </div>
    <Banner msg={msg} error={err} />

    {making && <form onSubmit={makeLink} className="mt-3 grid gap-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3 text-sm md:grid-cols-4">
      <label>For (name)<input name="recipient" className={`${input} block`} placeholder="Store manager" /></label>
      <label>Mobile (for WhatsApp)<input name="mobile" inputMode="tel" className={`${input} block`} /></label>
      <label>Stops after delivery (hours)<input name="afterDeliveryHours" type="number" min={0} max={168} defaultValue={6} className={`${input} block`} /></label>
      <div className="flex flex-col justify-end gap-1"><label className="flex items-center gap-2"><input type="checkbox" name="showTemperature" defaultChecked />Show temperature</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="showDriver" />Show driver's name and mobile</label></div>
      <div className="flex gap-2 md:col-span-4"><button disabled={busy} className={btn}>Make the link</button><button type="button" className={btnLight} onClick={() => setMaking(false)}>Cancel</button></div>
    </form>}
    {made && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <p className="font-semibold text-emerald-900">{made.message}</p>
      <p className="mt-1 break-all font-mono text-xs">{made.url}</p>
      <div className="mt-2 flex flex-wrap gap-2"><a className={btn} href={made.whatsappUrl} target="_blank" rel="noreferrer">Send on WhatsApp</a>
        <button className={btnLight} onClick={async () => setMsg(await copy(made.url) ? 'Link copied' : 'Copy did not work; select the link')}>Copy link</button>
        <button className={btnLight} onClick={() => setMade(null)}>Done</button></div>
    </div>}

    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="font-bold">Where the positions came from</h3>
        {sources.length === 0 ? <p className="text-sm text-slate-500">No position yet.</p> : <table className="mt-1 w-full text-sm"><tbody>
          {sources.map(s => <tr key={s.source} className="border-t border-slate-100"><td className={td}>{sourceText(s.source)}</td><td className={td}>{num(s.positions)}</td><td className={td}>last {when(s.lastAt)}</td></tr>)}
        </tbody></table>}
        {staff && hired && hired.ready !== false && <p className="mt-2 text-sm">{hired.tracking?.active
          ? <>Hired truck: driver {hired.tracking.driverName}, consent {String(hired.tracking.consentStatus).toLowerCase()}, SIM {String(hired.tracking.simStatus).toLowerCase()}. <Link to="/tracking/hired" className="text-sky-700 hover:underline">Hired Trucks</Link></>
          : <>No tracker? <Link to={`/tracking/hired?trip=${tripId}`} className="text-sky-700 hover:underline">Track from the driver's phone or SIM</Link></>}</p>}
      </div>
      <div>
        <h3 className="font-bold">Customer tracking links</h3>
        {links.length === 0 ? <p className="text-sm text-slate-500">None made. The customer sees one shipment without a login; the link stops after delivery.</p> : <table className="mt-1 w-full text-sm"><tbody>
          {links.map(l => <tr key={l.id} className="border-t border-slate-100">
            <td className={td}>{l.recipient || 'Customer'}<div className="text-xs text-slate-500">by {l.createdByName} {when(l.createdAt)}</div></td>
            <td className={td}>{l.active ? pill('green', 'Working') : pill('grey', l.revokedAt ? 'Stopped' : 'Expired')}<div className="text-xs text-slate-500">opened {l.openedCount}x{l.lastOpenedAt ? `, last ${when(l.lastOpenedAt)}` : ''}</div></td>
            <td className={`${td} text-right`}>{l.active && <button className="text-xs font-bold text-red-700 hover:underline" disabled={busy} onClick={() => run(() => api(`/api/tracking/trips/${tripId}/share-links/${l.id}/stop`, { method: 'POST' }), 'Link stopped')}>Stop</button>}</td>
          </tr>)}
        </tbody></table>}
        {active.length > 0 && <p className="mt-1 text-xs text-slate-500">{active.length} link{active.length === 1 ? '' : 's'} working.</p>}
      </div>
    </div>

    {staff && geo && geo.ready !== false && <div className="mt-5">
      <h3 className="font-bold">Stops, waiting and route</h3>
      <div className="overflow-x-auto"><table className="mt-1 w-full min-w-[800px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Stop</th><th className={th}>State</th><th className={th}>Arrived</th><th className={th}>Left</th><th className={th}>Waiting</th><th className={th}>Free</th><th className={th}>Detention</th></tr></thead>
        <tbody>
          {(geo.stops || []).length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">No planned stop. Add the delivery point from a place so arrival and waiting are recorded.</td></tr>}
          {(geo.stops || []).map((s: any) => { const [tone, text] = STOP_STATE[s.state] || ['grey', s.state]; const v = s.visit; return <tr key={s.id} className="border-t border-slate-200">
            <td className={td}><b>{s.name}</b><div className="text-xs text-slate-500">{s.stopType}{s.placeName ? `, place ${s.placeName}` : ''}, circle {s.radiusM} m</div></td>
            <td className={td}>{pill(tone, text)}</td>
            <td className={td}>{v ? when(v.arrivedAt) : '-'}</td>
            <td className={td}>{v?.departedAt ? when(v.departedAt) : '-'}</td>
            <td className={td}>{v ? minutesText(v.dwellMinutes) : '-'}</td>
            <td className={td}>{minutesText(s.freeMinutes)}</td>
            <td className={td}>{v && Number(v.detentionMinutes) > 0 ? <b className="text-red-700">{minutesText(v.detentionMinutes)}</b> : '-'}</td>
          </tr>; })}
        </tbody>
      </table></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {places.length > 0 && <form onSubmit={addStop} className="flex flex-wrap items-end gap-2 text-sm">
          <label>Add a stop from a place<select name="geofenceId" required className={`${input} block`}>{places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>As<select name="stopType" className={`${input} block`}><option value="DELIVERY">Delivery</option><option value="PICKUP">Pickup</option><option value="REST">Rest</option><option value="FUEL">Fuel</option><option value="OTHER">Other</option></select></label>
          <button disabled={busy} className={btnLight}>Add stop</button>
        </form>}
        <form onSubmit={setRef} className="flex flex-wrap items-end gap-2 text-sm">
          <label>Route to watch<select name="ref" className={`${input} block`} defaultValue="">
            <option value="">Best past trip of this lane</option>
            {(geo.pastTrips || []).map((p: any) => <option key={p.id} value={p.id}>{p.tripNumber} ({p.positions} positions)</option>)}
            <option value="STOPS">Straight line between the stops</option>
          </select></label>
          <button disabled={busy} className={btnLight}>Set route</button>
        </form>
      </div>
      <p className="mt-2 text-sm text-slate-600">{geo.reference
        ? <>Watching the route {geo.reference.source === 'PAST_TRIP' ? `driven on ${geo.reference.sourceTripNumber}` : 'between the stops'} with a {fmtDistance(geo.reference.corridorKm)} corridor.{geo.watch?.offRouteSince ? <b className="text-red-700"> Off the route since {when(geo.watch.offRouteSince)} ({fmtDistance(geo.watch.offRouteKm)} away).</b> : ''}</>
        : 'No route is watched yet; it is set from a past trip of this lane when the trip starts, if one has enough positions.'}
        {geo.watch?.stoppedSince ? <b className="text-amber-800"> Standing since {when(geo.watch.stoppedSince)}.</b> : ''}</p>
    </div>}

    {staff && eway?.ready && (eway.bills || []).length > 0 && <div className="mt-5">
      <h3 className="font-bold">E-way bills</h3>
      <ul className="mt-1 text-sm">{eway.bills.map((b: any) => <li key={b.id} className="py-1">
        {b.ewayBillNo} {pill(EWAY_TONE[b.state] || 'grey', b.state === 'OK' ? 'Valid' : String(b.state).replace('_', ' ').toLowerCase())} till {when(b.validUntil)}
        {!b.truckMatches && <span className="ml-2 font-semibold text-red-700">names {b.vehicleNumber}</span>}
        {b.endsBeforeArrival && <span className="ml-2 font-semibold text-red-700">ends before arrival</span>}
        {(b.state !== 'OK' || !b.truckMatches) && <Link to="/tracking/eway-watch" className="ml-2 text-sky-700 hover:underline">E-way Bill Watch</Link>}
      </li>)}</ul>
    </div>}

    {staff && reefer?.ready && reefer.unit && <div className="mt-5">
      <h3 className="font-bold">Reefer unit</h3>
      {(reefer.readings || []).length === 0 ? <p className="text-sm text-slate-500">No reading on this trip yet.</p> : (() => { const r = reefer.readings[0]; return <p className="text-sm">
        Set-point <b className={reefer.targetC != null && r.setPointC != null && Math.abs(Number(r.setPointC) - Number(reefer.targetC)) > Number(reefer.tolerance) ? 'text-red-700' : ''}>{fmtTemp(r.setPointC)}</b> (load needs {fmtTemp(reefer.targetC)}),
        return air {fmtTemp(r.returnAirC)}, {r.unitOn === false ? 'unit off' : r.mode || 'running'}{r.alarmActive ? <b className="text-red-700">, alarm {r.alarms}</b> : ''}, fuel {num(r.fuelPct)} %, read {when(r.at)}.
        {' '}<Link to="/tracking/reefers" className="text-sky-700 hover:underline">Reefer Units</Link></p>; })()}
    </div>}
  </section>;
}
