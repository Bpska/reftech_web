/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-001 -- Planning board by day and week. Staff only.
//
// One row per truck (or per warehouse), one column per day. Trips, service days, breakdowns and other blocks are
// bars on the row. The accepted loads that wait for a truck are on the left: drag one onto a truck (or press Plan)
// to make a full-load trip, or to put it on a planned part-load trip of that truck (REQ-DSP-010).
// The truck's readiness is checked before it is booked (REQ-DSP-011), and trips that wait for a Manager's approval
// are listed with an Approve button (REQ-DSP-002). Overlapping bookings of a truck are listed as clashes.
// REQ-DSP-003..009: each trip waiting for approval links to its Dispatch plan (/dispatch/trips/:id).
// Backend: GET /api/dispatch/board, POST /api/dispatch/board/assign, POST /api/dispatch/trips/{id}/approve.
import { DragEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarRange, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { needsWeatherTick } from '@/modules/allocation/allocation';
import { APPROVAL_STYLE, APPROVAL_TEXT, LEVEL_STYLE, indiaDay, iso, localInput, plain, role, when } from './dispatch';
import { ReadinessNote } from './ReadinessNote';
import { fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { usePrefsFormat } from '@/shared/i18n/Units';

const DAY_MS = 86400000;
const BAR: Record<string, string> = {
  PLANNED: 'bg-sky-200 text-sky-900 border-sky-400', RUNNING: 'bg-emerald-200 text-emerald-900 border-emerald-500',
  COMPLETED: 'bg-slate-200 text-slate-600 border-slate-300', BLOCK: 'bg-red-200 text-red-900 border-red-400',
};
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00+05:30`); d.setTime(d.getTime() + n * DAY_MS); return indiaDay(d); };
const dayLabel = (day: string) => new Date(`${day}T12:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short' });

type Load = any; type Row = any;

export function DispatchBoardPage() {
  usePrefsFormat(); // REQ-PLT-015: show again at once when the login changes a unit, date format or time zone
  const r = role();
  const [from, setFrom] = useState(indiaDay()), [days, setDays] = useState(7), [view, setView] = useState<'TRUCK' | 'WAREHOUSE'>('TRUCK');
  const [data, setData] = useState<any>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [onlyPeriod, setOnlyPeriod] = useState(true);
  const [plan, setPlan] = useState<{ load: Load; row?: Row; day?: string } | null>(null);
  // "Make trip" on Load Requests opens the board with ?load=<id>: plan that load at once
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = params.get('load');
    if (!id || !data) return;
    const l = (data.openLoads || []).find((x: Load) => String(x.id) === id);
    if (l && !l.onHold) setPlan({ load: l });
    else setErr(l ? `Load ${l.loadNumber} is on quality hold: ${l.onHold}` : 'That load is not waiting for a truck any more');
    params.delete('load'); setParams(params, { replace: true });
  }, [data]);

  const load = () => {
    setErr('');
    return api(`/api/dispatch/board?from=${from}&days=${days}&view=${view}`).then(setData).catch(e => setErr(errorText(e, 'The board could not be read')));
  };
  useEffect(() => { void load(); }, [from, days, view]);

  const start = useMemo(() => new Date(`${from}T00:00:00+05:30`).getTime(), [from]);
  const span = days * DAY_MS;
  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));
  const loads: Load[] = (data?.openLoads || []).filter((l: Load) => !onlyPeriod || l.inPeriod);

  async function approve(id: number) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await api(`/api/dispatch/trips/${id}/approve`, { method: 'POST', body: JSON.stringify({}) }); setMsg(x.message || 'Approved'); await load(); }
    catch (e) { setErr(errorText(e, 'Not approved')); } finally { setBusy(false); }
  }

  function drop(e: DragEvent, row: Row, day?: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/load');
    const l = (data?.openLoads || []).find((x: Load) => String(x.id) === id);
    if (l) setPlan({ load: l, row, day });
  }

  const bar = (w: any) => {
    const s = Math.max(new Date(w.start).getTime(), start), e = Math.min(w.end ? new Date(w.end).getTime() : start + span, start + span);
    const left = ((s - start) / span) * 100, width = Math.max(((e - s) / span) * 100, 1.5);
    const kind = w.kind === 'TRIP' ? (w.state || 'PLANNED') : 'BLOCK';
    const tip = `${w.title}: ${w.startText} to ${w.endText}${w.detail ? `\n${w.detail}` : ''}${w.driverName ? `\nDriver ${w.driverName}` : ''}${w.partnerName ? `\n${w.partnerName}` : ''}${w.loadTons != null ? `\nLoad ${fmtWeight(w.loadTons)}${w.freeTons != null ? `, free ${fmtWeight(w.freeTons)}` : ''}` : ''}${w.approvalStatus ? `\n${APPROVAL_TEXT[w.approvalStatus] || w.approvalStatus}` : ''}`;
    const inner = <>
      <span className="font-bold">{w.title}</span>
      {w.approvalStatus === 'PENDING' && <span className="ml-1 rounded bg-amber-300 px-1 text-[10px] font-bold text-amber-900">approve</span>}
      {w.tripType === 'PART_LOAD' && <span className="ml-1 text-[10px]">part {w.freeTons != null ? `${fmtWeight(w.freeTons)} free` : ''}</span>}
      {w.weatherLevel && w.weatherLevel !== 'NONE' && w.weatherLevel !== 'GREEN' && <span className="ml-1 text-[10px] font-bold">{w.weatherLevel.toLowerCase()} wx</span>}
    </>;
    const cls = `absolute top-1 h-8 overflow-hidden truncate whitespace-nowrap rounded-md border px-1 text-xs leading-8 ${BAR[kind] || BAR.PLANNED}`;
    return w.kind === 'TRIP'
      ? <Link key={`${w.kind}${w.id}`} to={`/trips/${w.id}`} title={tip} className={`${cls} hover:ring-2 hover:ring-sky-500`} style={{ left: `${left}%`, width: `${width}%` }}>{inner}</Link>
      : <div key={`${w.kind}${w.source}${w.id}`} title={tip} className={cls} style={{ left: `${left}%`, width: `${width}%` }}>{w.title}</div>;
  };

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><CalendarRange />Planning Board</h1>
        <p className="text-slate-600">Drag a load onto a truck to plan it. Bars open the trip. Times are India time.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={btnLight} onClick={() => setFrom(addDays(from, -days))} title="Earlier"><ChevronLeft className="h-4 w-4" /></button>
        <input type="date" className={`${input} w-auto`} value={from} onChange={e => e.target.value && setFrom(e.target.value)} />
        <button className={btnLight} onClick={() => setFrom(addDays(from, days))} title="Later"><ChevronRight className="h-4 w-4" /></button>
        <button className={btnLight} onClick={() => setFrom(indiaDay())}>Today</button>
        <div className="flex overflow-hidden rounded-xl border border-slate-300">
          {[[1, 'Day'], [7, 'Week']].map(([n, t]) => <button key={t} onClick={() => setDays(Number(n))} className={`px-3 py-1.5 text-sm font-semibold ${days === n ? 'bg-sky-700 text-white' : 'bg-white text-slate-700'}`}>{t}</button>)}
        </div>
        <div className="flex overflow-hidden rounded-xl border border-slate-300">
          {(['TRUCK', 'WAREHOUSE'] as const).map(x => <button key={x} onClick={() => setView(x)} className={`px-3 py-1.5 text-sm font-semibold ${view === x ? 'bg-sky-700 text-white' : 'bg-white text-slate-700'}`}>{x === 'TRUCK' ? 'Trucks' : 'Warehouses'}</button>)}
        </div>
        <button className={btnLight} onClick={() => void load()} title="Refresh"><RefreshCw className="h-4 w-4" /></button>
      </div>
    </div>
    {data?.message && <div className="my-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{data.message}</div>}
    <Banner msg={msg} error={err} />

    {data && <div className="mt-3 flex flex-wrap gap-2 text-sm">
      {[['Free trucks', data.counts.freeTrucks], ['Loads waiting', data.counts.openLoads], ['In this period', data.counts.openLoadsInPeriod], ['Waiting approval', data.counts.waitingApproval], ['Clashes', data.counts.clashes]].map(([t, n]) =>
        <span key={String(t)} className={`rounded-xl px-3 py-1.5 font-semibold ${t === 'Clashes' && Number(n) > 0 ? 'bg-red-100 text-red-800' : 'bg-white text-slate-700 shadow-sm'}`}>{t}: {String(n)}</span>)}
    </div>}

    <div className="mt-4 grid gap-4 xl:grid-cols-[300px_1fr]">
      {/* open loads */}
      <section className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="font-bold">Loads waiting for a truck</h2>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={onlyPeriod} onChange={e => setOnlyPeriod(e.target.checked)} />this period</label></div>
        {!data ? <p className="mt-2 text-sm text-slate-500">Loading...</p> : loads.length === 0 ? <p className="mt-2 text-sm text-slate-500">No accepted load waits for a truck{onlyPeriod ? ' in this period' : ''}.</p> :
          <div className="mt-2 max-h-[70vh] space-y-2 overflow-y-auto">{loads.map(l => <div key={l.id} draggable={!l.onHold && view === 'TRUCK'}
            onDragStart={e => e.dataTransfer.setData('text/load', String(l.id))}
            className={`rounded-xl border p-2 text-xs ${l.onHold ? 'border-red-300 bg-red-50' : l.late ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'} ${!l.onHold && view === 'TRUCK' ? 'cursor-grab' : ''}`}>
            <div className="flex items-center justify-between gap-1"><b className="text-sm">{l.loadNumber}</b><span>{fmtWeight(l.weightTons)}</span></div>
            <div>{l.partnerName || '-'}</div>
            <div>{l.pickupCity} → {l.deliveryCity}</div>
            {l.temperatureProfileName && <div className="text-slate-500">{l.temperatureProfileName}</div>}
            <div className="text-slate-600">Pickup {when(l.pickupFrom)}{l.deliverBy ? <> · deliver {l.deliverFrom ? `${when(l.deliverFrom)} to ` : 'by '}{when(l.deliverBy)}</> : null}</div>
            {l.late && <div className="font-bold text-amber-800">The delivery time has passed</div>}
            {l.onHold && <div className="font-bold text-red-700">On quality hold: {l.onHold}</div>}
            {!l.onHold && <button className={`${btnLight} mt-1`} onClick={() => setPlan({ load: l })}>Plan</button>}
          </div>)}</div>}
      </section>

      {/* the board */}
      <section className="overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[200px_1fr] border-b text-xs font-semibold text-slate-600">
            <div className="p-2">{view === 'TRUCK' ? 'Truck' : 'Warehouse'}</div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${days === 1 ? 6 : days}, 1fr)` }}>
              {days === 1 ? ['00', '04', '08', '12', '16', '20'].map(h => <div key={h} className="border-l p-2">{h}:00</div>)
                : dayList.map(d => <div key={d} className={`border-l p-2 ${d === indiaDay() ? 'bg-sky-50 text-sky-800' : ''}`}>{dayLabel(d)}</div>)}
            </div>
          </div>
          {(data?.rows || []).map((row: Row) => <div key={row.id} className={`grid grid-cols-[200px_1fr] border-b ${row.blocked ? 'bg-red-50/40' : ''}`}>
            <div className="p-2 text-xs">
              <div className="flex items-center gap-1 text-sm font-bold">{row.name}{row.free && <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] text-emerald-800">free</span>}</div>
              <div className="text-slate-500">{row.detail}</div>
              {row.readiness?.length > 0 && <div className="mt-0.5 space-y-0.5">{row.readiness.slice(0, 2).map((i: any, n: number) =>
                <div key={n} title={i.text} className={`truncate rounded px-1 text-[10px] font-semibold ${LEVEL_STYLE[i.level] || ''}`}>{i.text}</div>)}
                {row.readiness.length > 2 && <div className="text-[10px] text-slate-500" title={row.readiness.map((i: any) => i.text).join('\n')}>+{row.readiness.length - 2} more</div>}</div>}
            </div>
            <div className="relative min-h-[44px]" onDragOver={e => { if (view === 'TRUCK' && !row.blocked) e.preventDefault(); }}
              onDrop={e => { const box = (e.currentTarget as HTMLElement).getBoundingClientRect(); const i = Math.floor(((e.clientX - box.left) / box.width) * days); drop(e, row, days === 1 ? from : dayList[Math.max(0, Math.min(days - 1, i))]); }}>
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days === 1 ? 6 : days}, 1fr)` }}>
                {Array.from({ length: days === 1 ? 6 : days }, (_, i) => <div key={i} className="border-l border-slate-100" />)}
              </div>
              {(row.windows || []).map(bar)}
            </div>
          </div>)}
          {data && !data.rows?.length && <p className="p-3 text-sm text-slate-500">Nothing to show.</p>}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
          {[['PLANNED', 'Planned trip'], ['RUNNING', 'Running'], ['COMPLETED', 'Completed'], ['BLOCK', 'Service, breakdown, off road']].map(([k, t]) => <span key={k} className="flex items-center gap-1"><span className={`inline-block h-3 w-5 rounded border ${BAR[k]}`} />{t}</span>)}
          {data && <span>Turnaround between trips: {data.turnaroundMinutes} min</span>}
        </div>
      </section>
    </div>

    {/* trips waiting for approval (REQ-DSP-002) */}
    {data?.waitingApproval?.length > 0 && <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">Trips waiting for approval</h2>
      {!r.manager && <p className="text-sm text-slate-500">A Manager or Admin approves them.</p>}
      <table className="mt-2 w-full min-w-[800px] text-sm">
        <thead><tr className="bg-slate-50 text-left"><th className="p-2">Trip</th><th>Partner</th><th>Truck</th><th>Driver</th><th>Route</th><th>Load</th><th>Start</th><th /></tr></thead>
        <tbody>{data.waitingApproval.map((t: any) => <tr key={t.id} className="border-t">
          <td className="p-2 font-semibold"><Link to={`/trips/${t.id}`} className="text-sky-700 hover:underline">{t.tripNumber}</Link> <span className={`rounded-full px-2 text-xs font-bold ${APPROVAL_STYLE.PENDING}`}>{t.tripType === 'PART_LOAD' ? 'part load' : 'full'}</span></td>
          <td>{t.partnerName || '-'}</td><td>{t.vehicleNumber || '-'}</td><td>{t.driverName || <span className="text-red-700">no driver</span>}</td>
          <td>{t.sourceCity} → {t.destinationCity}</td><td>{fmtWeight(t.plannedLoadTons)}</td><td className="whitespace-nowrap">{when(t.plannedStartAt)}</td>
          <td className="whitespace-nowrap p-2">{r.manager ? <button className={btnLight} disabled={busy} onClick={() => approve(t.id)}>Approve</button> : null} <Link to={`/trips/${t.id}`} className="text-sm font-bold text-sky-700 hover:underline">Open</Link> <Link to={`/dispatch/trips/${t.id}`} className="text-sm font-bold text-sky-700 hover:underline">Dispatch plan</Link></td>
        </tr>)}</tbody>
      </table>
    </section>}

    {data?.clashes?.length > 0 && <section className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-900">
      <h2 className="font-bold">Clashes</h2>
      <ul className="mt-1 list-disc pl-5">{data.clashes.map((c: any, i: number) => <li key={i}>{c.text}</li>)}</ul>
    </section>}

    {plan && <AssignDialog plan={plan} rows={data?.rows || []} onClose={() => setPlan(null)} onDone={m => { setPlan(null); setMsg(m); void load(); }} />}
  </>;
}

/** The load dropped on a truck: driver, times, readiness, then a full-load trip or a place on a part-load trip. */
function AssignDialog({ plan, rows, onClose, onDone }: { plan: { load: Load; row?: Row; day?: string }; rows: Row[]; onClose: () => void; onDone: (msg: string) => void }) {
  const l = plan.load;
  const defStart = l.pickupFrom ? localInput(l.pickupFrom) : plan.day ? `${plan.day}T08:00` : '';
  const [vehicleId, setVehicleId] = useState(plan.row ? String(plan.row.id) : ''), [tripId, setTripId] = useState('');
  const [driverId, setDriverId] = useState(''), [drivers, setDrivers] = useState<any[]>([]);
  const [startAt, setStartAt] = useState(defStart), [arriveAt, setArriveAt] = useState(l.deliverBy ? localInput(l.deliverBy) : '');
  const [override, setOverride] = useState(false), [overrideReason, setOverrideReason] = useState('');
  const [wxAck, setWxAck] = useState(false), [wxReason, setWxReason] = useState('');
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  useEffect(() => { api('/api/operations/drivers').then(x => setDrivers(Array.isArray(x) ? x : [])).catch(() => setDrivers([])); }, []);
  const row = rows.find(x => String(x.id) === vehicleId);
  const partTrips: any[] = row?.partLoadTrips || [];
  // REQ-DSP-002: an approved trip is frozen; a Manager or an Admin may still add a load, with a reason that is logged
  const frozen = !!tripId && !!partTrips.find(t => String(t.id) === tripId)?.approved;

  async function save() {
    setBusy(true); setErr('');
    try {
      const body: any = { loadRequestId: l.id, vehicleId };
      if (tripId) { body.tripId = tripId; if (frozen) body.reason = changeReason.trim(); }
      else {
        Object.assign(body, { driverId, plannedStartAt: iso(startAt), expectedArrivalAt: iso(arriveAt) || null });
        if (override) { body.readinessOverride = true; body.readinessReason = overrideReason; }
        if (wxAck) { body.weatherAcknowledged = true; body.weatherReason = wxReason; }
      }
      const r = await api('/api/dispatch/board/assign', { method: 'POST', body: JSON.stringify(body) });
      onDone(`${r.message || 'Planned'}${r.windowWarnings?.length ? ` Note: ${r.windowWarnings.join('. ')}` : ''}`);
    } catch (e) { setErr(errorText(e, 'Not planned')); } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
    <div className="mt-10 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
      <h2 className="text-xl font-bold">Plan load {l.loadNumber}</h2>
      <p className="text-sm text-slate-600">{l.partnerName} · {l.pickupCity} → {l.deliveryCity} · {fmtWeight(l.weightTons)}{l.temperatureProfileName ? ` · ${l.temperatureProfileName}` : ''}
        {l.deliverBy ? ` · deliver ${l.deliverFrom ? `${when(l.deliverFrom)} to ` : 'by '}${when(l.deliverBy)}` : ''}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div><span className={label}>Truck *</span><select className={input} value={vehicleId} onChange={e => { setVehicleId(e.target.value); setTripId(''); }}>
          <option value="">Choose the truck</option>
          {rows.map(x => <option key={x.id} value={x.id} disabled={x.blocked}>{x.name} ({x.detail}){x.blocked ? ' - not ready' : x.free ? ' - free' : ''}</option>)}</select></div>
        <div><span className={label}>How</span><select className={input} value={tripId} onChange={e => setTripId(e.target.value)}>
          <option value="">New full-load trip</option>
          {partTrips.map(t => <option key={t.id} value={t.id}>On part-load trip {t.tripNumber}{t.freeTons !== '' ? ` (${fmtWeight(t.freeTons)} free)` : ''}{t.approved ? ' - approved' : ''}</option>)}</select></div>
        {frozen && <div className="md:col-span-2 rounded-xl bg-amber-50 p-2 text-sm">
          <p className="font-semibold text-amber-900">This trip is approved and frozen. Only a Manager or an Admin can add a load now, and the change is logged.</p>
          <span className={label}>Reason for the change *</span><input className={input} value={changeReason} onChange={e => setChangeReason(e.target.value)} placeholder="At least 5 letters" />
        </div>}
        {!tripId && <>
          <div className="md:col-span-2"><span className={label}>Driver *</span><select className={input} value={driverId} onChange={e => setDriverId(e.target.value)}>
            <option value="">Choose the driver</option>
            {drivers.map(d => <option key={d.id} value={d.id} disabled={!d.assignable}>{d.name}{d.note ? ` - ${String(d.note).toLowerCase()}` : ''}</option>)}</select></div>
          <div><span className={label}>Planned start *</span><input type="datetime-local" className={input} value={startAt} onChange={e => setStartAt(e.target.value)} /></div>
          <div><span className={label}>Expected arrival</span><input type="datetime-local" className={input} value={arriveAt} onChange={e => setArriveAt(e.target.value)} /></div>
        </>}
      </div>
      {vehicleId && !tripId && <ReadinessNote vehicleId={vehicleId} start={iso(startAt)} end={iso(arriveAt)} truckName={row?.name}
        override={override} onOverride={setOverride} reason={overrideReason} onReason={setOverrideReason} />}
      {needsWeatherTick(err) && <div className="mt-2 grid gap-2 rounded-xl bg-orange-50 p-2 text-sm md:grid-cols-2">
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={wxAck} onChange={e => setWxAck(e.target.checked)} />I have seen these warnings</label>
        <input className={input} placeholder="Reason" value={wxReason} onChange={e => setWxReason(e.target.value)} />
      </div>}
      <Banner error={err} />
      <div className="mt-4 flex gap-2">
        <button className={btn} disabled={busy || !vehicleId || (!tripId && (!driverId || !startAt)) || (frozen && changeReason.trim().length < 5)} onClick={save}>{tripId ? 'Put the load on the trip' : 'Make the trip'}</button>
        <button className={btnLight} onClick={onClose}>Cancel</button>
      </div>
      {!tripId && <p className="mt-2 text-xs text-slate-500">The new trip waits for a Manager's approval before it can start.</p>}
    </div>
  </div>;
}
