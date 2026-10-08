/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRP-008 -- "Weather on this route" of Create Trip.
//
// When the source city, the destination city and the dates are filled in, the official warnings on the route for
// the trip dates are shown. A Yellow warning is only shown. An Orange or Red warning needs the tick "I have seen
// these warnings" and a reason of at least 10 characters; both go with the form (weatherAcknowledged, weatherReason)
// and are saved on the trip with the name and the time. The server checks again on Create Trip, so a stale screen
// cannot book a trip into a warning nobody confirmed. What a Red warning needs is set on the server
// (app.weather.red-rule): the tick and reason, a Manager, or a change of dates.
//
// Backend: POST /api/operations/weather/route-check (WeatherController).
import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudLightning, RefreshCw } from 'lucide-react';
import { api } from '@/shared/services/api';
import { LEVEL_LABEL, LEVEL_STYLE, WeatherWarning, errorText, shortWhen } from '@/modules/weather/weather';

type Result = {
  ready: boolean; message?: string; level?: string; warnings?: WeatherWarning[]; unknownPlaces?: string[]; checkedAt?: string;
  provider?: string; needsConfirmation?: boolean; blocked?: boolean; managerOnly?: boolean; minReasonLength?: number; text?: string;
};

const toIso = (v: string) => { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };

export function WeatherRouteCheck({ sourceCity, destinationCity, plannedStartAt, expectedArrivalAt, onChangeDates }:
  { sourceCity: string; destinationCity: string; plannedStartAt: string; expectedArrivalAt: string; onChangeDates?: () => void }) {
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const asked = useRef(0);

  const ready = sourceCity.trim().length > 1 && destinationCity.trim().length > 1;
  const check = useCallback(async () => {
    if (!ready) { setRes(null); return; }
    const n = ++asked.current;
    setBusy(true); setErr('');
    try {
      const r = await api('/api/operations/weather/route-check', { method: 'POST', body: JSON.stringify({ sourceCity, destinationCity, plannedStartAt: toIso(plannedStartAt), expectedArrivalAt: toIso(expectedArrivalAt) }) });
      if (n === asked.current) { setRes(r); setAck(false); }
    } catch (x) { if (n === asked.current) { setRes(null); setErr(errorText(x, 'The weather could not be checked')); } }
    finally { if (n === asked.current) setBusy(false); }
  }, [ready, sourceCity, destinationCity, plannedStartAt, expectedArrivalAt]);

  // checked again a moment after the route or the dates stop changing
  useEffect(() => { const t = window.setTimeout(() => { void check(); }, 600); return () => window.clearTimeout(t); }, [check]);

  if (!ready) return <section className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500"><b className="text-slate-700">Weather on this route</b> · enter the source and destination city to check the official warnings for the trip dates.</section>;
  if (res && res.ready === false) return <section className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">{res.message}</section>;

  const warnings = res?.warnings || [];
  const level = res?.level || 'NONE';
  const confirm = !!res?.needsConfirmation;
  const frame = level === 'RED' ? 'border-red-300 bg-red-50/40' : level === 'ORANGE' ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200 bg-white';
  return <section className={`mt-5 overflow-hidden rounded-2xl border-2 ${frame}`} data-testid="weather-route-check">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
      <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><CloudLightning className="h-5 w-5 text-sky-700" />Weather on this route
        {res && <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LEVEL_STYLE[level]}`}>{level === 'NONE' ? 'No warning' : LEVEL_LABEL[level]}</span>}</h3>
      <span className="text-xs text-slate-500">{busy ? 'Checking…' : res?.checkedAt ? `Checked ${shortWhen(res.checkedAt)} · Source: ${res.provider === 'OPEN_METEO' ? 'IMD warnings and forecast' : 'IMD district warnings'}` : ''}</span>
    </div>
    {err && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{err}</p>}
    {res && <div className="p-4">
      {warnings.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Level</th><th>Hazard</th><th>Where on the route</th><th>Valid</th><th>What it says</th></tr></thead>
        <tbody>{warnings.map(w => <tr key={w.id} className="border-t align-top">
          <td className="p-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LEVEL_STYLE[w.level]}`}>{LEVEL_LABEL[w.level]}</span></td>
          <td className="py-2 font-bold">{w.hazard}</td>
          <td className="py-2">{w.area}{w.state ? ` · ${w.state}` : ''}{w.where && <div className="text-xs text-slate-500">{w.where}</div>}</td>
          <td className="whitespace-nowrap py-2">{shortWhen(w.validFrom)} to<br />{shortWhen(w.validTo)}</td>
          <td className="py-2">{w.message || '-'}</td>
        </tr>)}</tbody>
      </table></div>}
      <p className={`mt-2 text-sm font-semibold ${level === 'RED' ? 'text-red-800' : level === 'ORANGE' ? 'text-orange-800' : 'text-slate-700'}`}>{res.text}</p>
      {(res.unknownPlaces || []).length > 0 && <p className="mt-1 text-xs text-amber-700">Not on the map: {(res.unknownPlaces || []).join(', ')}. Only warnings that name {(res.unknownPlaces || []).length === 1 ? 'this town' : 'these towns'} are found. Store the town with its coordinates (trip page &gt; Arrival) to check the whole route.</p>}
      {confirm && res.blocked && <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-bold text-red-900">A trip into a Red warning cannot be booked. Change the dates.</p>}
      {confirm && !res.blocked && <div className={`mt-3 rounded-xl border p-3 ${level === 'RED' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
        <p className="text-sm text-slate-700">Change the dates, or confirm that you have seen the warning and say why the trip must run.{res.managerOnly ? ' Only a Manager or Admin can confirm a Red warning.' : ''}</p>
        <label className="mt-2 flex items-center gap-2 font-bold text-slate-900"><input type="checkbox" name="weatherAcknowledged" value="true" checked={ack} onChange={e => setAck(e.target.checked)} className="h-4 w-4" disabled={res.managerOnly} />I have seen these warnings</label>
        {ack && <><textarea name="weatherReason" required minLength={res.minReasonLength || 10} maxLength={500} rows={2} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Why the trip must run, and what the driver will do if the warning stays" />
          <p className="text-xs text-slate-500">Reason, at least {res.minReasonLength || 10} characters. Saved on the trip with your name and the time.</p></>}
      </div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {confirm && onChangeDates && <button type="button" onClick={onChangeDates} className="rounded-xl border border-sky-600 px-4 py-2 text-sm font-bold text-sky-700">Change dates</button>}
        <button type="button" onClick={() => void check()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-sky-600 px-4 py-2 text-sm font-bold text-sky-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Check weather again</button>
      </div>
    </div>}
  </section>;
}
