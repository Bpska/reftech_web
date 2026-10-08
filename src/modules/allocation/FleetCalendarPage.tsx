/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-007 -- Truck and driver calendar, no double booking.
//   One row per truck or driver, one column per day (India time): trips (planned blue, running green), service
//   days, breakdowns and leave. A Manager or Admin blocks a truck or a driver for a time, or removes a block;
//   the backend refuses a block over a planned or running trip.
//
// Backend: AllocationController (/api/allocation/calendar, /api/allocation/blocks).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { DRIVER_BLOCKS, TRUCK_BLOCKS, indiaDay, iso, role } from './allocation';

const DAY = 86400000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const colour = (w: any) => w.kind === 'TRIP'
  ? (w.state === 'RUNNING' ? 'bg-emerald-500 text-white' : w.state === 'COMPLETED' ? 'bg-slate-300 text-slate-700' : 'bg-sky-600 text-white')
  : w.kind === 'BREAKDOWN' ? 'bg-red-400 text-white' : ['LEAVE', 'TRAINING'].includes(w.kind) ? 'bg-slate-400 text-white' : 'bg-amber-400 text-amber-950';
/** Blocks put on by a manager can be removed here. A BREAKDOWN window can be a block or a breakdown report, so it is left alone. */
// Only a calendar block can be removed here (a breakdown report is closed in Maintenance & Fuel).
const removable = (w: any) => w.source ? w.source === 'BLOCK' : ['SERVICE', 'OFF_ROAD', 'OTHER', 'LEAVE', 'TRAINING'].includes(w.kind);

export function FleetCalendarPage() {
  const me = role();
  const [kind, setKind] = useState<'VEHICLE' | 'DRIVER'>('VEHICLE');
  const [from, setFrom] = useState(indiaDay());
  const [days, setDays] = useState(7);
  const [data, setData] = useState<any>(null);
  const [picked, setPicked] = useState<any>(null);
  const [blocking, setBlocking] = useState(false);
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api(`/api/allocation/calendar?kind=${kind}&from=${from}&days=${days}`)); }
    catch (x) { setError(errorText(x, 'Could not load the calendar')); }
  }, [kind, from, days]);
  useEffect(() => { if (me.staff) void load(); }, [load]);

  async function run(path: string, body: unknown) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await api(path, { method: 'POST', body: JSON.stringify(body) }); setMsg(r.message || 'Saved.'); await load(); return true; }
    catch (x) { setError(errorText(x, 'Could not save')); return false; }
    finally { setBusy(false); }
  }

  async function addBlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body = { resource: kind, [kind === 'VEHICLE' ? 'vehicleId' : 'driverId']: Number(f.who), blockType: f.blockType, startsAt: iso(f.startsAt), endsAt: iso(f.endsAt), reason: f.reason };
    if (await run('/api/allocation/blocks', body)) setBlocking(false);
  }
  async function removeBlock(w: any) {
    const reason = window.prompt(`Reason for removing "${w.title}" from the calendar:`);
    if (reason === null) return;
    if (await run(`/api/allocation/blocks/${w.id}/cancel`, { reason })) setPicked(null);
  }

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Truck calendar</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  const start = Date.parse(`${from}T00:00:00+05:30`), total = days * DAY;
  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));
  const today = indiaDay();
  const pill = (on: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold ${on ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`;
  const truck = kind === 'VEHICLE';

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><CalendarDays className="h-8 w-8 text-sky-700" />Truck and driver calendar</h1>
    <p className="text-slate-600">Who is busy when. A truck or driver cannot be put on two trips at the same time, or on a trip during a service day or leave. <Link to="/vehicle-requests" className="font-semibold text-sky-700 hover:underline">Vehicle requests</Link></p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button onClick={() => { setKind('VEHICLE'); setPicked(null); setBlocking(false); }} className={pill(truck)}>Trucks</button>
      <button onClick={() => { setKind('DRIVER'); setPicked(null); setBlocking(false); }} className={pill(!truck)}>Drivers</button>
      <span className="mx-2" />
      <button onClick={() => setFrom(addDays(from, -7))} className={btnLight} title="Previous week"><ChevronLeft className="inline h-4 w-4" />Previous</button>
      <button onClick={() => setFrom(today)} className={btnLight}>Today</button>
      <button onClick={() => setFrom(addDays(from, 7))} className={btnLight} title="Next week">Next<ChevronRight className="inline h-4 w-4" /></button>
      <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm" />
      <select value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm"><option value={7}>7 days</option><option value={14}>14 days</option></select>
      {me.manager && data?.blocksReady && <button onClick={() => setBlocking(!blocking)} className={btn}>{truck ? 'Block truck' : 'Block driver'}</button>}
    </div>
    <Banner msg={msg} error={error} />
    {data?.message && <div className="my-3 rounded-xl bg-amber-50 p-3 text-amber-900">{data.message}</div>}

    {blocking && data && <Section title={truck ? 'Block a truck (service day, breakdown, off road)' : 'Block a driver (leave, training)'}>
      <form onSubmit={addBlock} className="grid gap-3 md:grid-cols-3">
        <div><label className={label}>{truck ? 'Truck' : 'Driver'} <span className="text-red-600">*</span></label><select name="who" required className={input}><option value="">Select</option>
          {data.rows.map((r: any) => <option key={r.id} value={r.id}>{r.name}{r.detail ? ` (${r.detail})` : ''}</option>)}</select></div>
        <div><label className={label}>Type <span className="text-red-600">*</span></label><select name="blockType" required className={input}>
          {(truck ? TRUCK_BLOCKS : DRIVER_BLOCKS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
        <div />
        <div><label className={label}>From <span className="text-red-600">*</span></label><input name="startsAt" type="datetime-local" required className={input} /></div>
        <div><label className={label}>To <span className="text-red-600">*</span></label><input name="endsAt" type="datetime-local" required className={input} /></div>
        <div><label className={label}>Reason <span className="text-red-600">*</span></label><input name="reason" required className={input} placeholder={truck ? '20,000 km service at workshop' : 'Family function'} /></div>
        <div className="flex gap-2 md:col-span-full"><button disabled={busy} className={btn}>Put on calendar</button><button type="button" onClick={() => setBlocking(false)} className={btnLight}>Cancel</button></div>
      </form>
    </Section>}

    {picked && <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><b className="text-base">{picked.title}</b> <span className="text-slate-500">· {picked.row}</span>
          <div>{picked.detail}</div>
          <div className="text-slate-600">{picked.startText} to {picked.endText}{picked.kind === 'TRIP' ? ` · ${String(picked.state).toLowerCase()}` : ''}</div></div>
        <div className="flex gap-2">
          {picked.kind === 'TRIP' && <Link to={`/trips/${picked.id}`} className={btnLight}>Open trip</Link>}
          {me.manager && removable(picked) && <button disabled={busy} onClick={() => void removeBlock(picked)} className={btnRed}>Remove block</button>}
          <button onClick={() => setPicked(null)} className={btnLight}>Close</button>
        </div>
      </div>
    </div>}

    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      <div className="min-w-[900px]">
        <div className="flex border-b text-xs font-semibold text-slate-600">
          <div className="w-48 shrink-0 p-2">{truck ? 'Truck' : 'Driver'}</div>
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
            {dayList.map(d => <div key={d} className={`border-l p-2 text-center ${d === today ? 'bg-sky-50 text-sky-800' : ''}`}>
              {new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</div>)}
          </div>
        </div>
        {!data && <p className="p-3 text-slate-500">Loading...</p>}
        {data?.rows.map((r: any) => {
          // Overlapping windows go on separate lines, so none hides another.
          const lanes: number[] = [];
          const bars = [...r.windows].sort((a: any, b: any) => Date.parse(a.start) - Date.parse(b.start)).map((w: any) => {
            const s = Math.max(Date.parse(w.start), start), e = Math.min(w.end ? Date.parse(w.end) : start + total, start + total);
            let lane = lanes.findIndex(end => end <= s); if (lane < 0) { lane = lanes.length; lanes.push(e); } else lanes[lane] = e;
            return { w, lane, left: ((s - start) / total) * 100, width: Math.max(((e - s) / total) * 100, 0.6) };
          }).filter(b => b.width > 0 && b.left < 100);
          return <div key={r.id} className="flex border-b last:border-b-0">
            <div className="w-48 shrink-0 p-2 text-sm"><b>{r.name}</b><div className="text-xs text-slate-500">{r.detail || ''}</div>{r.note && <div className="text-xs font-semibold text-amber-700">{r.note}</div>}</div>
            <div className="relative flex-1" style={{ height: Math.max(lanes.length, 1) * 24 + 16 }}>
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
                {dayList.map(d => <div key={d} className={`border-l ${d === today ? 'bg-sky-50/60' : ''}`} />)}</div>
              {bars.map(({ w, lane, left, width }) => <button key={`${w.source || w.kind}-${w.kind}-${w.id}`} onClick={() => setPicked({ ...w, row: r.name })}
                title={`${w.title}: ${w.detail || ''} (${w.startText} to ${w.endText})`}
                className={`absolute h-5 overflow-hidden truncate whitespace-nowrap rounded px-1 text-left text-[11px] font-semibold ${colour(w)} ${w.open ? 'border-r-4 border-dashed border-red-700' : ''}`}
                style={{ top: 8 + lane * 24, left: `${left}%`, width: `${width}%` }}>{w.title}</button>)}
            </div>
          </div>;
        })}
        {data?.rows.length === 0 && <p className="p-3 text-slate-500">No {truck ? 'trucks' : 'drivers'}.</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-sky-600 align-middle" />Planned trip</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-500 align-middle" />Running trip</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-slate-300 align-middle" />Completed trip</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-amber-400 align-middle" />Service day / off road</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-red-400 align-middle" />Breakdown</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-slate-400 align-middle" />Leave / training</span>
        {data?.turnaroundMinutes ? <span>A truck needs {data.turnaroundMinutes} minutes between two trips.</span> : null}
      </div>
    </section>
  </>;
}
