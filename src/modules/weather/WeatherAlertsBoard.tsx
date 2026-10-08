/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRP-009 -- "Weather Alerts" board of the Dashboard.
//
// The warnings of the watch list: the home state, the most used trip cities of the last 90 days, the areas a
// Manager added, and every warning on the route of a planned or running trip. Each row says why it is watched and
// which trips it touches (REQ-TRP-010 checks those trips again every 30 minutes).
//
//   Employee, Manager, Admin: the board. An Employee sees the trips of the drivers who report to him.
//   Manager, Admin: "Check now", "Add warning" (a warning typed in from IMD), "Close" a warning, "Manage watch list".
//
// Backend: /api/operations/weather/alerts, /refresh, /warnings, /warnings/{id}/close, /watch-areas (WeatherController).
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CloudLightning, Plus, RefreshCw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/services/api';
import { LEVEL_LABEL, LEVEL_STYLE, WeatherWarning, errorText, shortWhen } from '@/modules/weather/weather';

type Row = WeatherWarning & { why: string; whyDetail?: string | null; trips: { id: number; tripNumber: string; running: boolean; route: string }[]; tripsRunning: number; tripsPlanned: number };
type Board = {
  ready: boolean; message?: string; count: number; highest: string; alerts: Row[]; outsideWatchList?: number; lastCheckedAt?: string | null; refreshMinutes?: number;
  provider?: string; canManage?: boolean;
  watched?: { homeState?: string | null; frequentCities: { name: string; trips: number }[]; areas: { id: number; name: string; state?: string | null; addedBy?: string | null }[] };
};

const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm';
const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600';
const iso = (v: FormDataEntryValue | null) => { const d = new Date(String(v || '')); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };

export function WeatherAlertsBoard({ refreshKey, onChanged }: { refreshKey?: number; onChanged?: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState<'' | 'WARNING' | 'WATCH'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const load = useCallback(async () => {
    try { setBoard(await api('/api/operations/weather/alerts')); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'The weather alerts could not be loaded') }); }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function run(work: () => Promise<unknown>, done: string, keepForm = false) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setMsg(null);
    try {
      const r = await work() as Partial<Board> | undefined;
      if (r && Array.isArray(r.alerts)) setBoard(r as Board); else await load();
      if (!keepForm) setForm('');
      setMsg({ ok: true, text: done });
      onChanged?.();
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'The change could not be saved') }); }
    finally { sending.current = false; setBusy(false); }
  }

  function addWarning(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { level: f.get('level'), hazard: f.get('hazard'), areaName: f.get('areaName'), state: f.get('state'), radiusKm: f.get('radiusKm'), validFrom: iso(f.get('validFrom')), validTo: iso(f.get('validTo')), message: f.get('message'), source: f.get('source') };
    void run(() => api('/api/operations/weather/warnings', { method: 'POST', body: JSON.stringify(body) }), 'The warning is saved. Planned and running trips were checked against it.');
  }
  function addWatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(() => api('/api/operations/weather/watch-areas', { method: 'POST', body: JSON.stringify({ name: f.get('name'), state: f.get('state'), latitude: f.get('latitude'), longitude: f.get('longitude'), radiusKm: f.get('radiusKm') }) }), 'Added to the watch list.', true);
  }
  function close(w: Row) {
    const reason = window.prompt(`Close the ${LEVEL_LABEL[w.level]} warning for ${w.area}? Say why (for example: withdrawn by IMD).`);
    if (reason === null) return;
    void run(() => api(`/api/operations/weather/warnings/${w.id}/close`, { method: 'POST', body: JSON.stringify({ reason }) }), 'The warning is closed.');
  }

  if (!board) return null;
  const highest = board.highest || 'NONE';
  const w = board.watched;
  return <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm" id="weather-alerts" data-testid="weather-board">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-sky-50/70 px-4 py-3">
      <button onClick={() => setOpen(o => !o)} className="flex flex-1 items-center gap-2 text-left">
        <CloudLightning className="h-5 w-5 text-sky-700" /><h2 className="text-lg font-black text-slate-900">Weather Alerts ({board.count || 0})</h2>
        {highest !== 'NONE' && <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LEVEL_STYLE[highest]}`}>Highest: {LEVEL_LABEL[highest]}</span>}
      </button>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {board.ready && <span className="text-slate-500">Last checked {shortWhen(board.lastCheckedAt)} · refreshes every {board.refreshMinutes || 30} minutes</span>}
        {board.ready && board.canManage && <button type="button" disabled={busy} onClick={() => void run(() => api('/api/operations/weather/refresh', { method: 'POST', body: '{}' }), 'Checked now.')} className="inline-flex items-center gap-1 font-bold text-sky-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Check now</button>}
        {board.ready && board.canManage && <button type="button" onClick={() => setForm(form === 'WARNING' ? '' : 'WARNING')} className="inline-flex items-center gap-1 font-bold text-sky-700"><Plus className="h-4 w-4" />Add warning</button>}
        <button onClick={() => setOpen(o => !o)} aria-label="Toggle weather alerts">{open ? <ChevronDown className="h-5 w-5 text-sky-700" /> : <ChevronRight className="h-5 w-5 text-sky-700" />}</button>
      </div>
    </div>
    {open && <div className="p-3">
      {msg && <div role="status" className={`mb-3 rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}
      {!board.ready && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{board.message}</p>}

      {form === 'WARNING' && <form onSubmit={addWarning} className="mb-4 grid gap-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3 md:grid-cols-4">
        <div><label className={label}>Level *</label><select name="level" required className={input}><option value="RED">Red</option><option value="ORANGE">Orange</option><option value="YELLOW">Yellow</option></select></div>
        <div><label className={label}>Hazard *</label><input name="hazard" required minLength={3} maxLength={120} className={input} placeholder="Heavy rain" /></div>
        <div className="md:col-span-2"><label className={label}>Districts * (comma separated)</label><input name="areaName" required maxLength={200} className={input} placeholder="Ganjam, Puri, Khordha" /></div>
        <div><label className={label}>State</label><input name="state" maxLength={80} className={input} placeholder="Odisha" /></div>
        <div><label className={label}>Valid from *</label><input name="validFrom" type="datetime-local" required className={input} /></div>
        <div><label className={label}>Valid to *</label><input name="validTo" type="datetime-local" required className={input} /></div>
        <div><label className={label}>Radius (km)</label><input name="radiusKm" type="number" min="1" max="500" step="1" defaultValue="60" className={input} /></div>
        <div className="md:col-span-3"><label className={label}>What it says</label><input name="message" maxLength={1000} className={input} placeholder="Very heavy rain and strong wind near the coast. Road travel not advised." /></div>
        <div><label className={label}>Source</label><input name="source" maxLength={40} defaultValue="IMD" className={input} /></div>
        <div className="md:col-span-4 flex gap-2"><button disabled={busy} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save warning</button><button type="button" onClick={() => setForm('')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button>
          <span className="self-center text-xs text-slate-500">The centre is the first district with stored coordinates; without one the warning is matched by the district names only.</span></div>
      </form>}

      {board.ready && <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Level</th><th>Area</th><th>Hazard</th><th>Valid</th><th>Why we watch it</th><th>Trips affected</th><th>Source</th>{board.canManage && <th />}</tr></thead>
        <tbody>{board.alerts.length === 0
          ? <tr><td colSpan={8} className="p-6 text-center text-slate-400">No Yellow, Orange or Red warning for the watched areas or the routes of planned and running trips.</td></tr>
          : board.alerts.map(a => <tr key={a.id} className="border-t align-top">
            <td className="p-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${LEVEL_STYLE[a.level]}`}>{LEVEL_LABEL[a.level]}</span></td>
            <td className="py-2"><b>{a.area}</b>{a.state && <div className="text-xs text-slate-500">{a.state}</div>}</td>
            <td className="py-2"><b>{a.hazard}</b>{a.message && <div className="text-xs text-slate-500">{a.message}</div>}</td>
            <td className="whitespace-nowrap py-2">{shortWhen(a.validFrom)}<br />to {shortWhen(a.validTo)}</td>
            <td className="py-2">{a.why}{a.whyDetail && <div className="text-xs text-slate-500">{a.whyDetail}</div>}</td>
            <td className="py-2">{a.trips.length === 0 ? 'None' : <>
              <div className="flex flex-wrap gap-1">{a.trips.slice(0, 4).map(t => <Link key={t.id} to={`/trips/${t.id}`} className="font-bold text-sky-700 hover:underline">{t.tripNumber}</Link>)}{a.trips.length > 4 && <span className="text-slate-500">+{a.trips.length - 4}</span>}</div>
              <div className="text-xs text-slate-500">{[a.tripsRunning ? `${a.tripsRunning} running` : '', a.tripsPlanned ? `${a.tripsPlanned} planned` : ''].filter(Boolean).join(', ')}</div></>}</td>
            <td className="py-2">{a.source || '-'}<div className="text-xs text-slate-500">{shortWhen(a.issuedAt)}</div></td>
            {board.canManage && <td className="py-2"><button type="button" title="Close this warning" onClick={() => close(a)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-600 hover:border-red-300 hover:text-red-700">Close</button></td>}
          </tr>)}</tbody>
      </table></div>}

      {board.ready && w && <div className="mt-3 border-t pt-3 text-sm text-slate-600">
        <b className="text-slate-800">Watched areas:</b>{' '}
        {[w.homeState ? `${w.homeState} (home state)` : '', w.frequentCities.length ? `${w.frequentCities.map(c => c.name).join(', ')} (frequent trip cities, last 90 days)` : '', ...w.areas.map(x => `${x.name}${x.addedBy ? ` (added by ${x.addedBy})` : ''}`)].filter(Boolean).join(' · ') || 'none yet'}
        {board.outsideWatchList ? <span className="text-slate-400"> · {board.outsideWatchList} more warning{board.outsideWatchList === 1 ? '' : 's'} outside the watch list</span> : null}
        {board.canManage && <button type="button" onClick={() => setForm(form === 'WATCH' ? '' : 'WATCH')} className="ml-2 font-bold text-sky-700 hover:underline">Manage watch list</button>}
      </div>}

      {form === 'WATCH' && board.canManage && w && <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3">
        <ul className="mb-3 flex flex-wrap gap-2">{w.areas.length === 0 ? <li className="text-sm text-slate-500">No area added by hand yet.</li> : w.areas.map(x => <li key={x.id} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm shadow-sm">{x.name}{x.state ? `, ${x.state}` : ''}
          <button type="button" aria-label={`Remove ${x.name}`} onClick={() => void run(() => api(`/api/operations/weather/watch-areas/${x.id}`, { method: 'DELETE' }), `${x.name} is no longer watched.`, true)} className="text-slate-400 hover:text-red-700"><X className="h-4 w-4" /></button></li>)}</ul>
        <form onSubmit={addWatch} className="grid gap-2 md:grid-cols-6">
          <div className="md:col-span-2"><label className={label}>Town or district *</label><input name="name" required minLength={2} maxLength={160} className={input} placeholder="Anand" /></div>
          <div><label className={label}>State</label><input name="state" maxLength={80} className={input} /></div>
          <div><label className={label}>Latitude</label><input name="latitude" className={input} placeholder="if not stored" /></div>
          <div><label className={label}>Longitude</label><input name="longitude" className={input} placeholder="if not stored" /></div>
          <div><label className={label}>Radius (km)</label><input name="radiusKm" type="number" min="1" max="500" defaultValue="60" className={input} /></div>
          <div className="md:col-span-6"><button disabled={busy} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Add to watch list</button></div>
        </form>
      </div>}
    </div>}
  </section>;
}
