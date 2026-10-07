/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-CC-005 -- Door and Reefer Events: the door alerts of all trips and the latest device events.
//
// Staff page (Employee, Manager, Admin). A door alert is raised when a door is opened on a running trip
// away from every planned stop. It stays open until someone closes it here, or on the trip, with a note
// that says what was found. The events of one trip are on its Trip details page.
//
// Backend: /api/operations/device-alerts, /api/operations/device-events (DeviceEventController).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen, RefreshCw } from 'lucide-react';
import { api } from '@/shared/services/api';
import { fmtDateTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Alert = { id: number; status: string; message: string; createdAt: string; resolvedAt?: string | null; closingNote?: string | null; tripId?: number | null; tripNumber?: string | null; tripStatus?: string | null; vehicleNumber?: string | null; partnerName?: string | null };
type Event = { id: number; eventType: string; doorId?: string | null; faultCode?: string | null; faultDescription?: string | null; reeferRunHours?: number | null; fuelLevelPct?: number | null; atPlannedStop?: boolean | null; distanceToStopM?: number | null; alertId?: number | null; note?: string | null; capturedAt: string; tripId?: number | null; tripNumber?: string | null; vehicleNumber?: string | null; stopName?: string | null };

const cell = 'px-2.5 py-3';
const input = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900';
const EVENT: Record<string, [string, string]> = {
  DOOR_OPEN: ['Door opened', 'bg-amber-100 text-amber-800'], DOOR_CLOSE: ['Door closed', 'bg-emerald-100 text-emerald-800'],
  REEFER_FAULT: ['Reefer fault', 'bg-red-100 text-red-800'], REEFER_FAULT_CLEARED: ['Fault cleared', 'bg-emerald-100 text-emerald-800'],
  REEFER_ON: ['Reefer on', 'bg-emerald-100 text-emerald-800'], REEFER_OFF: ['Reefer off', 'bg-red-100 text-red-800'], REEFER_STATUS: ['Reefer status', 'bg-slate-100 text-slate-700'],
};
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const errorText = (x: unknown, fallback: string) => (x instanceof Error ? x.message : fallback);
const details = (e: Event) => {
  const parts: string[] = [];
  if (e.eventType === 'REEFER_FAULT' || e.eventType === 'REEFER_FAULT_CLEARED') parts.push([e.faultCode, e.faultDescription].filter(Boolean).join(': '));
  if (e.note) parts.push(e.note);
  if (e.reeferRunHours != null) parts.push(`run hours ${Number(e.reeferRunHours)}`);
  if (e.fuelLevelPct != null) parts.push(`fuel ${Number(e.fuelLevelPct)} %`);
  return parts.filter(Boolean).join('. ') || '-';
};

export function DeviceEventsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<'OPEN' | 'ALL'>('OPEN');
  const [withStatus, setWithStatus] = useState(false);
  const [closing, setClosing] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, e] = await Promise.all([api(`/api/operations/device-alerts?status=${filter}`), api(`/api/operations/device-events?limit=100${withStatus ? '&all=true' : ''}`)]);
      setAlerts(Array.isArray(a.alerts) ? a.alerts : []); setOpen(Number(a.open) || 0); setEvents(Array.isArray(e) ? e : []);
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the events') }); }
    finally { setLoaded(true); }
  }, [filter, withStatus]);
  useEffect(() => { void load(); }, [load]);

  async function close(e: FormEvent<HTMLFormElement>, a: Alert) {
    e.preventDefault();
    const note = new FormData(e.currentTarget).get('note');
    setBusy(true); setMsg(null);
    try {
      await api(`/api/operations/device-alerts/${a.id}/close`, { method: 'POST', body: JSON.stringify({ note }) });
      setClosing(null); await load(); setMsg({ ok: true, text: `Door alert of ${a.tripNumber || 'the trip'} closed.` });
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not close the alert') }); }
    finally { setBusy(false); }
  }

  if (!localStorage.getItem('reftech_token')) return <div className="p-10">Please sign in.</div>;
  const tab = (f: 'OPEN' | 'ALL', text: string) => <button key={f} onClick={() => setFilter(f)} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === f ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{text}</button>;
  const trip = (id?: number | null, no?: string | null) => id ? <Link to={`/trips/${id}`} className="font-semibold text-sky-700 hover:underline">{no || `Trip ${id}`}</Link> : <span className="text-slate-500">Not on a trip</span>;

  return <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><DoorOpen className="h-8 w-8 text-sky-700" />Door and Reefer Events</h1>
        <p className="text-slate-600">What the devices on the trucks report. A door opened on a running trip away from every planned stop raises an alert.</p>
      </div>
      <button type="button" onClick={() => { void load(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400"><RefreshCw className="h-4 w-4" />Refresh</button>
    </div>
    {msg && <div role="status" className={`my-4 rounded-xl p-3 font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}

    <section id="door-alerts" className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Door alerts <span className={open > 0 ? 'text-red-700' : 'text-slate-500'}>({open} open)</span></h2>
        <div className="flex gap-2">{tab('OPEN', 'Open')}{tab('ALL', 'All')}</div>
      </div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[980px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className={cell}>When</th><th className={cell}>Trip</th><th className={cell}>Truck</th><th className={cell}>What happened</th><th className={cell}>Status</th><th className={cell}></th></tr></thead>
        <tbody>
          {alerts.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">{loaded ? (filter === 'OPEN' ? 'No door alert is open.' : 'No door alert has been raised.') : 'Loading...'}</td></tr>}
          {alerts.map(a => {
            const isOpen = a.status !== 'RESOLVED' && a.status !== 'CLOSED';
            return <tr key={a.id} className="border-t border-slate-200 align-top">
              <td className={`${cell} whitespace-nowrap`}>{when(a.createdAt)}</td>
              <td className={`${cell} whitespace-nowrap`}>{trip(a.tripId, a.tripNumber)}<div className="text-xs text-slate-500">{a.partnerName}</div></td>
              <td className={`${cell} whitespace-nowrap`}>{a.vehicleNumber || '-'}</td>
              <td className={cell}>{a.message}{!isOpen && a.closingNote ? <div className="mt-1 text-xs text-slate-600"><b>Closed {when(a.resolvedAt)}:</b> {a.closingNote}</div> : null}</td>
              <td className={cell}><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${isOpen ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{isOpen ? 'Open' : 'Closed'}</span></td>
              <td className={`${cell} text-right`}>{isOpen && (closing === a.id
                ? <form onSubmit={e => close(e, a)} className="flex flex-wrap items-center justify-end gap-2">
                  <input name="note" required minLength={5} maxLength={900} aria-label={`What was found for ${a.tripNumber}`} placeholder="What was found" className={`${input} min-w-[16rem]`} />
                  <button disabled={busy} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Close alert</button>
                  <button type="button" onClick={() => setClosing(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Back</button>
                </form>
                : <button type="button" onClick={() => { setClosing(a.id); setMsg(null); }} className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Close with a note...</button>)}</td>
            </tr>;
          })}
        </tbody>
      </table></div>
    </section>

    <section id="latest-events" className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Latest events</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={withStatus} onChange={e => setWithStatus(e.target.checked)} />Show regular reefer status reports</label>
      </div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className={cell}>When</th><th className={cell}>Truck</th><th className={cell}>Trip</th><th className={cell}>Event</th><th className={cell}>Planned stop</th><th className={cell}>Details</th></tr></thead>
        <tbody>
          {events.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">{loaded ? 'No device has sent an event yet.' : 'Loading...'}</td></tr>}
          {events.map(e => {
            const [text, tone] = EVENT[e.eventType] || [e.eventType, 'bg-slate-100 text-slate-700'];
            return <tr key={e.id} className="border-t border-slate-200 align-top">
              <td className={`${cell} whitespace-nowrap`}>{when(e.capturedAt)}</td>
              <td className={`${cell} whitespace-nowrap`}>{e.vehicleNumber || '-'}</td>
              <td className={`${cell} whitespace-nowrap`}>{trip(e.tripId, e.tripNumber)}</td>
              <td className={cell}><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{text}</span>{e.doorId ? <span className="ml-1 text-xs text-slate-500">{e.doorId}</span> : null}</td>
              <td className={`${cell} whitespace-nowrap`}>{e.eventType === 'DOOR_OPEN' && e.atPlannedStop != null
                ? (e.atPlannedStop ? <span className="text-emerald-700">At {e.stopName}</span> : <span className="font-semibold text-red-700">Not at a planned stop</span>) : '-'}</td>
              <td className={cell}>{details(e)}</td>
            </tr>;
          })}
        </tbody>
      </table></div>
    </section>
  </>;
}
