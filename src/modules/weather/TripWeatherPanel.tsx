/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRP-010 -- "Weather" panel of the trip page.
//
// The warnings on the route now (a running trip: from its latest position to the destination), the level of the
// last check, and the checks of the trip (Create Trip, the timer every 30 minutes, "Check again", confirmations).
// When a new Orange or Red warning reaches the route of a booked trip, a weather alert is opened; a person confirms
// it here with a reason (a Red warning: as the server's red rule says, possibly a Manager only).
//
//   Everyone who may see the trip (staff, and a Partner for its own trips) sees the level and the warnings.
//   Employee, Manager, Admin: "Check again", "Confirm the warning", the history of the checks.
//
// Backend: /api/operations/trips/{id}/weather, /weather/recheck, /weather/acknowledge (WeatherController).
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { CloudLightning, RefreshCw } from 'lucide-react';
import { api } from '@/shared/services/api';
import { LEVEL_LABEL, LEVEL_STYLE, WeatherWarning, errorText, shortWhen } from '@/modules/weather/weather';

type Check = { id: number; kind: string; level: string; previousLevel?: string | null; warningCount: number; acknowledged: boolean; reason?: string | null; by?: string | null; checkedAt: string };
type View = {
  ready: boolean; message?: string; ended?: boolean; level?: string | null; summary?: string | null; checkedAt?: string | null; refreshMinutes?: number; route?: string;
  warnings?: WeatherWarning[]; unknownPlaces?: string[]; needsConfirmation?: boolean; ackLevel?: string | null; ackReason?: string | null; ackBy?: string | null; ackAt?: string | null;
  canRecheck?: boolean; canAcknowledge?: boolean; redRule?: string; history?: Check[]; alert?: { id: number; status: string; message: string } | null;
};
const KIND: Record<string, string> = { BOOKING: 'Create Trip', RECHECK: 'Timer re-check', MANUAL: 'Checked by hand', ACK: 'Confirmed' };

export function TripWeatherPanel({ tripId, refreshKey, onChanged }: { tripId: number; refreshKey?: number; onChanged?: () => void }) {
  const [v, setV] = useState<View | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const sending = useRef(false);

  const load = useCallback(async () => {
    try { setV(await api(`/api/operations/trips/${tripId}/weather`)); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'The weather of the trip could not be loaded') }); }
  }, [tripId]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function run(work: () => Promise<View>, done: string) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setMsg(null);
    try { setV(await work()); setConfirming(false); setMsg({ ok: true, text: done }); onChanged?.(); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'The change could not be saved') }); }
    finally { sending.current = false; setBusy(false); }
  }
  function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason') || '').trim();
    void run(() => api(`/api/operations/trips/${tripId}/weather/acknowledge`, { method: 'POST', body: JSON.stringify({ reason }) }), 'The warning is confirmed. A higher level opens the alert again.');
  }

  if (!v) return msg ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{msg.text}</p> : null;
  const level = v.level || 'NONE';
  return <section className={`mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ${v.needsConfirmation ? 'ring-2 ring-orange-300' : ''}`} data-testid="trip-weather">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-sky-50/70 px-4 py-3">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><CloudLightning className="h-5 w-5 text-sky-700" />Weather on the route
        {v.ready && v.level && <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LEVEL_STYLE[level]}`}>{level === 'NONE' ? 'No warning' : LEVEL_LABEL[level]}</span>}</h2>
      <div className="flex items-center gap-3 text-sm">
        {v.ready && <span className="text-slate-500">{v.checkedAt ? `Last check ${shortWhen(v.checkedAt)}` : 'Not checked yet'}{!v.ended ? ` · every ${v.refreshMinutes || 30} min` : ''}</span>}
        {v.canRecheck && <button type="button" disabled={busy} onClick={() => void run(() => api(`/api/operations/trips/${tripId}/weather/recheck`, { method: 'POST', body: '{}' }), 'The weather was checked again.')} className="inline-flex items-center gap-1 font-bold text-sky-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Check again</button>}
      </div>
    </div>
    <div className="p-4">
      {msg && <div role="status" className={`mb-3 rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}
      {!v.ready && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{v.message}</p>}
      {v.ready && v.ended && <p className="text-sm text-slate-600">This trip has ended; its weather is no longer checked.{v.summary ? ` Last result: ${v.summary}.` : ''}</p>}
      {v.ready && !v.ended && <>
        {v.route && <p className="text-xs text-slate-500">Route checked: {v.route}</p>}
        {(v.warnings || []).length === 0
          ? <p className="mt-1 text-sm font-semibold text-emerald-800">No Yellow, Orange or Red warning on the route now.</p>
          : <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
            <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Level</th><th>Hazard</th><th>Where</th><th>Valid</th><th>What it says</th></tr></thead>
            <tbody>{(v.warnings || []).map(w => <tr key={w.id} className="border-t align-top">
              <td className="p-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LEVEL_STYLE[w.level]}`}>{LEVEL_LABEL[w.level]}</span></td>
              <td className="py-2 font-bold">{w.hazard}</td>
              <td className="py-2">{w.area}{w.state ? ` · ${w.state}` : ''}{w.where && <div className="text-xs text-slate-500">{w.where}</div>}</td>
              <td className="whitespace-nowrap py-2">{shortWhen(w.validFrom)} to {shortWhen(w.validTo)}</td>
              <td className="py-2">{w.message || '-'}</td>
            </tr>)}</tbody></table></div>}
        {(v.unknownPlaces || []).length > 0 && <p className="mt-1 text-xs text-amber-700">Not on the map: {(v.unknownPlaces || []).join(', ')}. Store the town with its coordinates (Arrival panel) to check the whole route.</p>}
        {v.alert && <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${v.alert.status === 'OPEN' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>{v.alert.status === 'OPEN' ? 'Open weather alert: ' : 'Weather alert, confirmed: '}{v.alert.message}</p>}
        {v.ackLevel && v.ackLevel !== 'NONE' && <p className="mt-2 text-sm text-slate-700"><b>{LEVEL_LABEL[v.ackLevel]}</b> warning confirmed by {v.ackBy || '-'} on {shortWhen(v.ackAt)}: “{v.ackReason}”</p>}
        {v.needsConfirmation && v.canAcknowledge && !confirming && <button type="button" onClick={() => setConfirming(true)} className="mt-3 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white">Confirm the warning</button>}
        {v.needsConfirmation && v.canAcknowledge === false && v.canRecheck && <p className="mt-3 text-sm font-semibold text-red-800">Only a Manager or Admin can confirm a Red warning on a trip.</p>}
        {confirming && <form onSubmit={confirm} className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <label className="block text-sm font-bold text-slate-900" htmlFor="wx-reason">I have seen these warnings. Why does the trip go ahead?</label>
          <textarea id="wx-reason" name="reason" required minLength={10} maxLength={500} rows={2} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="For example: driver halts at Visakhapatnam until the warning ends" />
          <div className="mt-2 flex gap-2"><button disabled={busy} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirm</button><button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button></div>
        </form>}
      </>}
      {v.ready && (v.history || []).length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold text-slate-700">Weather checks of this trip ({(v.history || []).length})</summary>
        <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">When</th><th>Check</th><th>Level</th><th>Warnings</th><th>Confirmed</th></tr></thead>
          <tbody>{(v.history || []).map(h => <tr key={h.id} className="border-t align-top"><td className="whitespace-nowrap p-2">{shortWhen(h.checkedAt)}</td><td>{KIND[h.kind] || h.kind}</td>
            <td>{h.previousLevel && h.previousLevel !== h.level ? `${LEVEL_LABEL[h.previousLevel]} → ` : ''}<span className={`rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_STYLE[h.level]}`}>{LEVEL_LABEL[h.level]}</span></td>
            <td>{h.warningCount}</td><td>{h.acknowledged ? `${h.by || ''}: ${h.reason || ''}` : '-'}</td></tr>)}</tbody></table>
      </details>}
    </div>
  </section>;
}
