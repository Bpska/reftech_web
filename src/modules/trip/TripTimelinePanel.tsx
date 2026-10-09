/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-CC-005 -- Door and reefer unit events, shown on the Trip details page.
//
// Three parts:
//   1. what the reefer unit said last: door, fault, run hours, fuel level;
//   2. the planned stops of the trip (where the door may be opened) and open door alerts;
//   3. the trip timeline: status changes, loading checklist, door and reefer events, alerts and (staff only,
//      REQ-GOV-001) the FASTag toll crossings, newest first.
// A door opened on a running trip away from every planned stop raises an alert; the server decides
// (DeviceEventService). Staff close a door alert with a note that says what was found.
//
// Backend: /api/operations/trips/{id}/timeline, /stops, /api/operations/device-alerts/{id}/close.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, DoorOpen, ExternalLink, ListOrdered, MapPin, Snowflake, Trash2 } from 'lucide-react';
import { api } from '@/shared/services/api';
import { fmtDateTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Item = { at: string; kind: string; level: 'info' | 'ok' | 'warn' | 'danger'; title: string; detail?: string | null; by?: string | null; latitude?: number | null; longitude?: number | null; alertId?: number | null; alertStatus?: string };
type Stop = { id: number; stopOrder: number; name: string; stopType: string; latitude: number; longitude: number; radiusM: number };
type DoorAlert = { id: number; message: string; createdAt: string };
type Reefer = { door?: string | null; doorSince?: string | null; fault?: { code?: string; description?: string; at?: string } | null; runHours?: number; runHoursAt?: string; fuelLevelPct?: number; fuelLevelAt?: string; unit?: string; eventCount?: number };
type Timeline = { tripId: number; tripStatus: string; eventsReady: boolean; message?: string; items: Item[]; reefer: Reefer; stops: Stop[]; openDoorAlerts: DoorAlert[]; canEdit: boolean; canCloseAlerts: boolean };

const STOP_TYPES: [string, string][] = [['PICKUP', 'Pickup'], ['DELIVERY', 'Delivery'], ['REST', 'Rest halt'], ['FUEL', 'Fuel'], ['OTHER', 'Other']];
const stopLabel = (t: string) => (STOP_TYPES.find(x => x[0] === t) || ['', t])[1];
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900';
const label = 'mb-1.5 block text-sm font-semibold text-slate-700';
const DOT: Record<Item['level'], string> = { info: 'bg-sky-500', ok: 'bg-emerald-500', warn: 'bg-amber-500', danger: 'bg-red-600' };
const KIND: Record<string, string> = { STATUS: 'Status', CHECKLIST: 'Checklist', DOOR: 'Door', REEFER: 'Reefer', ALERT: 'Alert', TOLL: 'Toll' };
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const mapLink = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lng)}`;
const errorText = (x: unknown, fallback: string) => (x instanceof Error ? x.message : fallback);

export function TripTimelinePanel({ tripId, refreshKey, onChanged }: { tripId: number; refreshKey?: number; onChanged?: () => void }) {
  const [data, setData] = useState<Timeline | null>(null);
  const [all, setAll] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setData(await api(`/api/operations/trips/${tripId}/timeline${all ? '?all=true' : ''}`)); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the trip timeline') }); }
  }, [tripId, all]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  // A running trip gets new events from the device: look again every minute.
  const running = data ? !['COMPLETED', 'CANCELLED', 'PLANNED', 'SCHEDULED'].includes(data.tripStatus) : false;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => { void load(); }, 60000);
    return () => window.clearInterval(timer);
  }, [running, load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true); setMsg(null);
    try { await action(); await load(); setMsg({ ok: true, text: done }); onChanged?.(); return true; }   // the message appears once the list is up to date
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not save') }); return false; }
    finally { setBusy(false); }
  }
  async function addStop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    if (await run(() => api(`/api/operations/trips/${tripId}/stops`, { method: 'POST', body: JSON.stringify(body) }), `Planned stop "${body.name}" added.`)) form.reset();
  }
  const removeStop = (s: Stop) => run(() => api(`/api/operations/trips/${tripId}/stops/${s.id}`, { method: 'DELETE' }), `Planned stop "${s.name}" removed.`);
  async function closeAlert(e: FormEvent<HTMLFormElement>, a: DoorAlert) {
    e.preventDefault();
    const note = new FormData(e.currentTarget).get('note');
    if (await run(() => api(`/api/operations/device-alerts/${a.id}/close`, { method: 'POST', body: JSON.stringify({ note }) }), 'Door alert closed.')) setClosing(null);
  }

  const card = 'mt-4 rounded-2xl bg-white p-5 shadow-sm';
  const heading = <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><ListOrdered className="h-5 w-5 text-sky-700" />Door, reefer unit and trip timeline</h2>;
  if (!data) return <section className={card}>{heading}{msg ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{msg.text}</p> : <p className="mt-3 text-sm text-slate-500">Loading...</p>}</section>;

  const r = data.reefer || {};
  const tile = (name: string, value: string, sub: string, tone: string) => <div className={`rounded-xl p-3 ${tone}`}><div className="text-xs font-semibold uppercase tracking-wide opacity-80">{name}</div><div className="mt-0.5 text-lg font-black">{value}</div><div className="text-xs opacity-80">{sub}</div></div>;

  return <section id="trip-timeline" className={`${card} scroll-mt-6`}>
    {heading}
    {msg && <div role="status" className={`mt-3 rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}
    {!data.eventsReady && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{data.message}</p>}

    {/* ---------------------------------------------------------------- what the unit said last */}
    {data.eventsReady && <div className="mt-3 grid gap-3 md:grid-cols-4">
      {tile('Door', r.door === 'OPEN' ? 'Open' : r.door === 'CLOSED' ? 'Closed' : 'No report', r.doorSince ? `since ${when(r.doorSince)}` : 'The device has not sent a door event', r.door === 'OPEN' ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-800')}
      {tile('Reefer fault', r.fault ? String(r.fault.code || 'Fault') : 'None reported', r.fault ? `${r.fault.description || ''} ${when(r.fault.at)}`.trim() : r.unit === 'OFF' ? 'The unit is switched off' : 'No open fault code', r.fault || r.unit === 'OFF' ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-800')}
      {tile('Reefer run hours', r.runHours != null ? `${Number(r.runHours)} h` : 'No report', r.runHoursAt ? `at ${when(r.runHoursAt)}` : '', 'bg-slate-50 text-slate-800')}
      {tile('Fuel level', r.fuelLevelPct != null ? `${Number(r.fuelLevelPct)} %` : 'No report', r.fuelLevelAt ? `at ${when(r.fuelLevelAt)}` : '', r.fuelLevelPct != null && Number(r.fuelLevelPct) < 15 ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-800')}
    </div>}

    {/* ---------------------------------------------------------------- open door alerts */}
    {data.openDoorAlerts.map(a => <div key={a.id} className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="flex items-start gap-2 text-sm font-semibold text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{when(a.createdAt)}: {a.message}</span></p>
      {data.canCloseAlerts && (closing === a.id
        ? <form onSubmit={e => closeAlert(e, a)} className="mt-2 flex flex-wrap items-center gap-2">
          <input name="note" required minLength={5} maxLength={900} aria-label="What was found" placeholder="What was found, for example: police check at Khurda toll, seal replaced with S-7781" className={`${input} min-w-[18rem] grow`} />
          <button disabled={busy} className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Close alert</button>
          <button type="button" onClick={() => setClosing(null)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Back</button>
        </form>
        : <button type="button" onClick={() => { setClosing(a.id); setMsg(null); }} className="mt-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100">Close with a note...</button>)}
    </div>)}

    <div className="mt-5 grid gap-5 xl:grid-cols-3">
      {/* ---------------------------------------------------------------- timeline */}
      <div className="xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-bold text-slate-900"><DoorOpen className="h-4 w-4 text-sky-700" />Timeline ({data.items.length})</h3>
          {data.eventsReady && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />Show regular reefer status reports</label>}
        </div>
        {data.items.length === 0
          ? <p className="mt-2 text-sm text-slate-500">Nothing has happened on this trip yet. Status changes, the loading checklist, door and reefer events, alerts and toll crossings appear here.</p>
          : <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">{data.items.map((it, i) => <li key={`${it.at}-${it.kind}-${i}`} className="relative">
            <span className={`absolute left-[-23px] top-1.5 h-3 w-3 rounded-full ring-2 ring-white ${DOT[it.level] || DOT.info}`} />
            <div className="flex flex-wrap items-baseline gap-x-3"><span className="whitespace-nowrap text-xs font-semibold text-slate-500">{when(it.at)}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">{KIND[it.kind] || it.kind}</span><span className={`font-semibold ${it.level === 'danger' ? 'text-red-800' : 'text-slate-900'}`}>{it.title}</span></div>
            {(it.detail || it.by || it.latitude != null) && <p className="mt-0.5 text-sm text-slate-600">{it.detail}{it.by ? `${it.detail ? ' ' : ''}By ${it.by}.` : ''}{it.latitude != null && it.longitude != null && <> <a href={mapLink(it.latitude, it.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline">Position<ExternalLink className="h-3 w-3" /></a></>}</p>}
          </li>)}</ol>}
      </div>

      {/* ---------------------------------------------------------------- planned stops */}
      {data.eventsReady && <div>
        <h3 className="flex items-center gap-2 font-bold text-slate-900"><MapPin className="h-4 w-4 text-sky-700" />Planned stops ({data.stops.length})</h3>
        <p className="mt-1 text-xs text-slate-600">The door may be opened only inside the circle of a planned stop. Anywhere else on a running trip raises a door alert.</p>
        {data.stops.length === 0 && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">No planned stop is recorded. Every door opening on this trip will raise an alert.</p>}
        <ul className="mt-2 space-y-2">{data.stops.map(s => <li key={s.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
          <span><b className="text-slate-900">{s.name}</b> <span className="text-slate-500">({stopLabel(s.stopType)})</span><br />
            <a href={mapLink(s.latitude, s.longitude)} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:underline">{Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}</a>, within {s.radiusM} m</span>
          {data.canEdit && <button type="button" disabled={busy} onClick={() => { void removeStop(s); }} title="Remove this stop" aria-label={`Remove stop ${s.name}`} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>}
        </li>)}</ul>
        {data.canEdit && <form onSubmit={addStop} className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <div><label className={label} htmlFor="stop-name">Stop name *</label><input id="stop-name" name="name" required maxLength={160} className={input} placeholder="Cuttack dairy depot" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label} htmlFor="stop-type">Kind</label><select id="stop-type" name="stopType" defaultValue="DELIVERY" className={input}>{STOP_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
            <div><label className={label} htmlFor="stop-radius">Radius (m)</label><input id="stop-radius" name="radiusM" type="number" min={50} max={5000} step={50} defaultValue={500} className={input} /></div>
          </div>
          <div><label className={label} htmlFor="stop-coordinates">Position (latitude, longitude) *</label><input id="stop-coordinates" name="coordinates" required className={input} placeholder="20.46250, 85.88300" />
            <p className="mt-1 text-xs text-slate-500">In Google Maps, right-click the place and click the two numbers to copy them.</p></div>
          <button disabled={busy} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Add planned stop</button>
        </form>}
      </div>}
    </div>
    {data.eventsReady && (r.eventCount || 0) === 0 && <p className="mt-4 flex items-start gap-2 text-sm text-slate-500"><Snowflake className="mt-0.5 h-4 w-4 shrink-0" />The device on this truck has not sent a door or reefer event for this trip.</p>}
  </section>;
}
