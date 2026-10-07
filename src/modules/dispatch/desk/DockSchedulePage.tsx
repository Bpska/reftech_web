/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-006 -- Dock schedule of a warehouse for one day. Staff only.
//
// One row per outbound dock (OUTBOUND or BOTH), the day from 00:00 to 24:00 India time. Trip loading slots and, on a
// BOTH dock, the inbound deliveries are bars on the row. Below: every slot with its team and the buttons Start loading,
// Loaded, Did not come and Cancel; then the trips leaving from the warehouse town that day without a slot, each with
// a small Book form.
// Backend: GET /api/dispatch/docks/warehouses, GET /api/dispatch/docks?warehouseId=&day=,
// POST /api/dispatch/dock-slots/{id}/{CANCEL|NO_SHOW|START_LOADING|LOADED} { reason },
// POST /api/dispatch/trips/{id}/dock-slot { dockId, slotStart, slotMinutes, loadingTeam, teamLead, notes }.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, Warehouse } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { indiaDay, iso, localInput, when } from '../dispatch';
import { SCRIPT64, SLOT_STYLE, SLOT_TEXT, addDays, hhmm, notReady, pickWarehouse, saveWarehouse } from './desk';

const DAY_MS = 86400000;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DockSchedulePage() {
  const [warehouses, setWarehouses] = useState<any[]>([]), [wh, setWh] = useState(''), [day, setDay] = useState(indiaDay());
  const [data, setData] = useState<any>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false), [booking, setBooking] = useState<number | null>(null);

  useEffect(() => {
    api('/api/dispatch/docks/warehouses')
      .then(x => { const list = Array.isArray(x) ? x : []; setWarehouses(list); setWh(pickWarehouse(list)); })
      .catch(e => { const m = errorText(e, 'The warehouses could not be read'); if (notReady(m)) setMissing(true); else setErr(m); });
  }, []);

  const load = () => {
    if (!wh) return Promise.resolve();
    setErr('');
    return api(`/api/dispatch/docks?warehouseId=${wh}&day=${day}`)
      .then(x => { if (notReady(x)) setMissing(true); else setData(x); })
      .catch(e => setErr(errorText(e, 'The dock schedule could not be read')));
  };
  useEffect(() => { void load(); }, [wh, day]);

  async function act(fn: () => Promise<any>) {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await fn(); setMsg(r?.message || 'Saved'); await load(); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; }
    finally { setBusy(false); }
  }

  function slotAction(s: any, action: string) {
    let reason = '';
    if (action === 'CANCEL') {
      const r = window.prompt(`Reason for cancelling slot ${s.slotNo} (trip ${s.tripNumber}):`);
      if (r === null) return;
      reason = r.trim();
    }
    void act(() => api(`/api/dispatch/dock-slots/${s.id}/${action}`, { method: 'POST', body: JSON.stringify({ reason }) }));
  }

  if (missing) return <><Title /><NotReady script={SCRIPT64} /></>;

  const start = new Date(`${day}T00:00:00+05:30`).getTime();
  const pos = (from: string, to: string) => {
    const s = Math.max(new Date(from).getTime(), start), e = Math.min(new Date(to).getTime(), start + DAY_MS);
    return { left: `${((s - start) / DAY_MS) * 100}%`, width: `${Math.max(((e - s) / DAY_MS) * 100, 1.2)}%` };
  };
  const docks: any[] = data?.docks || [];
  const slots: any[] = docks.flatMap(d => d.slots || []).sort((a, b) => String(a.slotStart).localeCompare(String(b.slotStart)));
  const unslotted: any[] = data?.unslotted || [];

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Title />
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${input} w-auto`} value={wh} onChange={e => { setWh(e.target.value); saveWarehouse(e.target.value); }}>
          {!warehouses.length && <option value="">No warehouse</option>}
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}{w.city ? `, ${w.city}` : ''} ({w.outboundDocks} docks)</option>)}
        </select>
        <button className={btnLight} onClick={() => setDay(addDays(day, -1))} title="Day before"><ChevronLeft className="h-4 w-4" /></button>
        <input type="date" className={`${input} w-auto`} value={day} onChange={e => e.target.value && setDay(e.target.value)} />
        <button className={btnLight} onClick={() => setDay(addDays(day, 1))} title="Next day"><ChevronRight className="h-4 w-4" /></button>
        <button className={btnLight} onClick={() => setDay(indiaDay())}>Today</button>
        <button className={btnLight} onClick={() => void load()} title="Refresh"><RefreshCw className="h-4 w-4" /></button>
      </div>
    </div>
    <Banner msg={msg} error={err} />

    {data && !docks.length && <div className="my-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This warehouse has no active outbound dock. Add one under Warehouse &gt; Docks.</div>}

    {docks.length > 0 && <Section title="Docks" right={<span className="text-sm text-slate-500">Times are India time. Blue: trip slots, grey: inbound deliveries.</span>}>
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="ml-28 flex text-[10px] text-slate-500">{HOURS.map(h => <div key={h} className="flex-1 border-l border-slate-200 pl-0.5">{String(h).padStart(2, '0')}</div>)}</div>
          {docks.map(d => <div key={d.id} className="flex items-stretch border-t border-slate-100">
            <div className="w-28 shrink-0 py-2 pr-2 text-sm"><div className="font-bold">{d.dockCode}</div><div className="truncate text-xs text-slate-500">{d.name || (d.dockType === 'BOTH' ? 'In and out' : 'Outbound')}</div></div>
            <div className="relative h-14 flex-1 bg-slate-50">
              {HOURS.map(h => <div key={h} className="absolute top-0 h-full border-l border-slate-200" style={{ left: `${(h / 24) * 100}%` }} />)}
              {(d.inbound || []).map((n: any) => <div key={`in${n.id}`} style={pos(n.slotStart, n.slotEnd)} title={`Inbound ${n.noticeNo}: ${n.partnerName}${n.vehicleNumber ? `, ${n.vehicleNumber}` : ''}\n${hhmm(n.slotStart)} to ${hhmm(n.slotEnd)} (${n.status})`}
                className="absolute top-1 h-5 truncate rounded border border-slate-300 bg-slate-200 px-1 text-[10px] leading-5 text-slate-700">In {n.noticeNo}</div>)}
              {(d.slots || []).map((s: any) => <Link key={s.id} to={`/dispatch/trips/${s.tripId}`} style={pos(s.slotStart, s.slotEnd)}
                title={`${s.tripNumber} ${s.vehicleNumber || ''}\n${hhmm(s.slotStart)} to ${hhmm(s.slotEnd)}: ${SLOT_TEXT[s.status] || s.status}${s.loadingTeam ? `\nTeam: ${s.loadingTeam}` : ''}`}
                className={`absolute bottom-1 h-7 truncate rounded-md border px-1 text-xs font-semibold leading-7 hover:ring-2 hover:ring-sky-500 ${SLOT_STYLE[s.status] || SLOT_STYLE.BOOKED}`}>
                {s.tripNumber} {s.vehicleNumber || ''}</Link>)}
            </div>
          </div>)}
        </div>
      </div>
    </Section>}

    {docks.length > 0 && <Section title={`Loading slots (${slots.length})`}>
      {!slots.length ? <p className="text-sm text-slate-500">No trip has a slot on this day.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className={th}>Time</th><th className={th}>Dock</th><th className={th}>Trip</th><th className={th}>Truck</th><th className={th}>Status</th><th className={th}>Team</th><th className={th}>Yard</th><th className={th}></th></tr></thead>
          <tbody>{slots.map(s => <tr key={s.id} className="border-t border-slate-100">
            <td className={td}>{hhmm(s.slotStart)}-{hhmm(s.slotEnd)}<div className="text-xs text-slate-500">{s.slotNo}</div></td>
            <td className={`${td} font-semibold`}>{s.dockCode}</td>
            <td className={td}><Link to={`/dispatch/trips/${s.tripId}`} className="font-semibold text-sky-700 hover:underline">{s.tripNumber}</Link><div className="text-xs text-slate-500">{s.partnerName}</div></td>
            <td className={td}>{s.vehicleNumber || '-'}{s.gateInVehicle && s.gateInVehicle !== s.vehicleNumber && <div className="text-xs text-slate-500">at gate: {s.gateInVehicle}</div>}</td>
            <td className={td}><span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${SLOT_STYLE[s.status] || ''}`}>{SLOT_TEXT[s.status] || s.status}</span>
              {Number(s.lateInMinutes) > 0 && <div className="text-xs text-red-700">in {s.lateInMinutes} min late</div>}</td>
            <td className={td}>{s.loadingTeam || '-'}{s.teamLead && <div className="text-xs text-slate-500">Lead: {s.teamLead}</div>}{s.notes && <div className="text-xs text-slate-500">{s.notes}</div>}</td>
            <td className={td}>{s.yardMinutes != null ? `${s.yardMinutes} min` : '-'}{s.gateInAt && <div className="text-xs text-slate-500">in {hhmm(s.gateInAt)}</div>}</td>
            <td className={`${td} whitespace-nowrap`}><div className="flex flex-wrap gap-1">
              {['BOOKED', 'IN_YARD'].includes(s.status) && <button disabled={busy} className={btnLight} onClick={() => slotAction(s, 'START_LOADING')}>Start loading</button>}
              {['IN_YARD', 'LOADING'].includes(s.status) && <button disabled={busy} className={btnLight} onClick={() => slotAction(s, 'LOADED')}>Loaded</button>}
              {s.status === 'BOOKED' && <button disabled={busy} className={btnLight} onClick={() => slotAction(s, 'NO_SHOW')}>Did not come</button>}
              {['BOOKED', 'IN_YARD', 'LOADING', 'LOADED'].includes(s.status) && <button disabled={busy} className={btnRed} onClick={() => slotAction(s, 'CANCEL')}>Cancel</button>}
            </div></td>
          </tr>)}</tbody>
        </table></div>}
    </Section>}

    {data && <Section title={`Trips without a slot (${unslotted.length})`} right={<span className="text-sm text-slate-500">Planned trips leaving from this warehouse's town on this day</span>}>
      {!unslotted.length ? <p className="text-sm text-slate-500">Every trip of the day has a slot.</p> :
        <div className="space-y-2">{unslotted.map(t => <div key={t.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm"><Link to={`/dispatch/trips/${t.id}`} className="font-bold text-sky-700 hover:underline">{t.tripNumber}</Link>
              <span className="ml-2">{t.vehicleNumber || 'no truck'}</span><span className="ml-2 text-slate-500">{t.partnerName}{t.destinationCity ? ` to ${t.destinationCity}` : ''}, start {when(t.plannedStartAt)}</span></div>
            <button className={btnLight} onClick={() => setBooking(booking === t.id ? null : t.id)} disabled={!docks.length}>{booking === t.id ? 'Close' : 'Book'}</button>
          </div>
          {booking === t.id && <BookForm trip={t} docks={docks} slotMinutes={data.slotMinutes} busy={busy}
            onBook={body => act(() => api(`/api/dispatch/trips/${t.id}/dock-slot`, { method: 'POST', body: JSON.stringify(body) })).then(ok => { if (ok) setBooking(null); })} />}
        </div>)}</div>}
    </Section>}
  </>;
}

function Title() {
  return <div>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Warehouse />Dock Schedule</h1>
    <p className="text-slate-600">Loading slots and teams of each dock. Click a slot to open its trip.</p>
  </div>;
}

/** Book a dock for a trip; the slot starts by default one slot length before the trip's planned start. */
function BookForm({ trip, docks, slotMinutes, busy, onBook }: { trip: any; docks: any[]; slotMinutes?: number; busy: boolean; onBook: (body: any) => void }) {
  const len = Number(slotMinutes) || 60;
  const startAt = trip.plannedStartAt ? new Date(new Date(trip.plannedStartAt).getTime() - len * 60000).toISOString() : '';
  const [f, setF] = useState<any>({ dockId: String(docks[0]?.id ?? ''), slotStart: localInput(startAt), slotMinutes: String(len), loadingTeam: '', teamLead: '', notes: '' });
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  function submit(e: FormEvent) {
    e.preventDefault();
    onBook({ ...f, slotStart: iso(f.slotStart), slotMinutes: f.slotMinutes || null });
  }
  return <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
    <div><label className={label}>Dock *</label><select required className={input} value={f.dockId} onChange={set('dockId')}>{docks.map(d => <option key={d.id} value={d.id}>{d.dockCode}</option>)}</select></div>
    <div className="lg:col-span-2"><label className={label}>Slot start *</label><input required type="datetime-local" className={input} value={f.slotStart} onChange={set('slotStart')} /></div>
    <div><label className={label}>Minutes</label><input type="number" min={15} max={720} className={input} value={f.slotMinutes} onChange={set('slotMinutes')} /></div>
    <div><label className={label}>Loading team</label><input className={input} value={f.loadingTeam} onChange={set('loadingTeam')} /></div>
    <div><label className={label}>Team lead</label><input className={input} value={f.teamLead} onChange={set('teamLead')} /></div>
    <div className="sm:col-span-2 lg:col-span-5"><label className={label}>Notes</label><input className={input} value={f.notes} onChange={set('notes')} /></div>
    <div className="flex items-end"><button disabled={busy} className={btn}>Book slot</button></div>
  </form>;
}
