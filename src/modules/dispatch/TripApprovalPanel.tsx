/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-002 -- edit, approve and freeze a planned trip. Shown on the trip page for staff.
//
// A new trip waits for a Manager or Admin. Before approval staff may change the truck, driver, route, load or
// times, with a reason; after approval the trip is frozen and only a Manager or Admin may change it (each change
// is logged as "after approval") or send it back for approval. Every change is in the change log below.
// Backend: GET/PUT /api/dispatch/trips/{id}, POST /api/dispatch/trips/{id}/approve and /reopen.
import { FormEvent, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { APPROVAL_STYLE, APPROVAL_TEXT, iso, localInput, needsReadinessTick, plain, when } from './dispatch';
import { ReadinessNote } from './ReadinessNote';
import { fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function TripApprovalPanel({ tripId, refreshKey, onChanged }: { tripId: number; refreshKey?: number; onChanged?: () => void }) {
  const [v, setV] = useState<any>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false), [vehicles, setVehicles] = useState<any[]>([]), [drivers, setDrivers] = useState<any[]>([]);
  const [f, setF] = useState<any>({}), [override, setOverride] = useState(false), [overrideReason, setOverrideReason] = useState('');
  const [note, setNote] = useState(''), [showLog, setShowLog] = useState(false);

  const load = () => api(`/api/dispatch/trips/${tripId}`).then(setV).catch(e => setErr(errorText(e, 'The approval could not be read')));
  useEffect(() => { void load(); }, [tripId, refreshKey]);

  function startEdit() {
    setF({ vehicleId: String(v.vehicleId ?? ''), driverId: String(v.driverId ?? ''), sourceCity: v.sourceCity || '', destinationCity: v.destinationCity || '',
      plannedLoadTons: v.plannedLoadTons ?? '', plannedStartAt: localInput(v.plannedStartAt), expectedArrivalAt: localInput(v.expectedArrivalAt), reason: '' });
    setOverride(false); setOverrideReason(''); setMsg(''); setErr(''); setEditing(true);
    if (!vehicles.length) api('/api/operations/vehicles').then(x => setVehicles(Array.isArray(x) ? x : [])).catch(() => setVehicles([]));
    if (!drivers.length) api('/api/operations/drivers').then(x => setDrivers(Array.isArray(x) ? x : [])).catch(() => setDrivers([]));
  }

  async function act(fn: () => Promise<any>) {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await fn(); setMsg(r?.message || 'Saved'); await load(); onChanged?.(); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; }
    finally { setBusy(false); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    // only what changed is sent, so an unchanged truck is not checked again
    const body: any = { reason: f.reason };
    if (f.vehicleId !== String(v.vehicleId ?? '')) body.vehicleId = f.vehicleId;
    if (f.driverId !== String(v.driverId ?? '')) body.driverId = f.driverId;
    if (f.sourceCity !== (v.sourceCity || '')) body.sourceCity = f.sourceCity;
    if (f.destinationCity !== (v.destinationCity || '')) body.destinationCity = f.destinationCity;
    if (String(f.plannedLoadTons) !== String(v.plannedLoadTons ?? '')) body.plannedLoadTons = f.plannedLoadTons;
    if (f.plannedStartAt !== localInput(v.plannedStartAt)) body.plannedStartAt = iso(f.plannedStartAt);
    if (f.expectedArrivalAt !== localInput(v.expectedArrivalAt)) body.expectedArrivalAt = iso(f.expectedArrivalAt) || null;
    if (override) { body.readinessOverride = true; body.readinessReason = overrideReason; }
    if (await act(() => api(`/api/dispatch/trips/${tripId}`, { method: 'PUT', body: JSON.stringify(body) }))) setEditing(false);
  }

  if (!v) return err ? <div className="mt-4"><Banner error={err} /></div> : null;
  if (!v.ready) return <section className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{v.message}</section>;
  const set = (k: string) => (e: any) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const truck = vehicles.find(x => String(x.id) === f.vehicleId);

  return <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><ClipboardCheck className="h-5 w-5 text-sky-700" />Approval</h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${APPROVAL_STYLE[v.approvalStatus] || 'bg-slate-100 text-slate-700'}`}>{APPROVAL_TEXT[v.approvalStatus] || v.approvalStatus || '-'}</span>
        {v.canEdit && !editing && <button className={btnLight} onClick={startEdit}>{v.approvalStatus === 'APPROVED' ? 'Change (after approval)' : 'Change trip'}</button>}
        <button className={btnLight} onClick={() => setShowLog(x => !x)}>{showLog ? 'Hide' : 'Show'} change log ({v.changes?.length || 0})</button>
      </div>
    </div>
    {v.approvalStatus === 'APPROVED' && <p className="mt-1 text-sm text-slate-600">Approved by {v.approvedByName || '-'}{v.approvedAt ? ` on ${when(v.approvedAt)}` : ''}{v.approvalNote ? `: ${v.approvalNote}` : ''}. The trip is frozen; only a Manager or Admin can change it.</p>}
    {v.approvalStatus === 'PENDING' && <p className="mt-1 text-sm text-amber-800">{v.approvalRequired ? 'The trip cannot start until a Manager or Admin approves it.' : 'Approval is switched off; the trip can start without it.'}</p>}
    {v.onHold?.length > 0 && <p className="mt-1 text-sm font-semibold text-red-700">Goods on quality hold: {v.onHold.join(', ')}. The trip cannot be approved or started until they are released.</p>}
    <Banner msg={msg} error={err} />

    {v.canApprove && !editing && <div className="mt-2 flex flex-wrap items-end gap-2">
      <div className="min-w-[260px] flex-1"><span className={label}>Note (optional)</span><input className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="Checked the route and the truck" /></div>
      <button className={btn} disabled={busy} onClick={() => act(() => api(`/api/dispatch/trips/${tripId}/approve`, { method: 'POST', body: JSON.stringify({ note }) })).then(ok => ok && setNote(''))}>Approve trip</button>
    </div>}
    {v.canReopen && !editing && <button className={`${btnRed} mt-2`} disabled={busy} onClick={() => {
      const reason = window.prompt('Why does this trip go back for approval?');
      if (reason !== null) void act(() => api(`/api/dispatch/trips/${tripId}/reopen`, { method: 'POST', body: JSON.stringify({ reason }) }));
    }}>Send back for approval</button>}

    {editing && <form onSubmit={save} className="mt-3 grid gap-3 md:grid-cols-3">
      <div><span className={label}>Truck</span><select className={input} value={f.vehicleId} onChange={set('vehicleId')}>
        {vehicles.length === 0 && <option value={f.vehicleId}>{v.vehicleNumber}</option>}
        {vehicles.map(x => <option key={x.id} value={x.id}>{x.vehicleNumber} ({fmtWeight(x.capacityTons)})</option>)}</select></div>
      <div><span className={label}>Driver</span><select className={input} value={f.driverId} onChange={set('driverId')}>
        {drivers.length === 0 && <option value={f.driverId}>{v.driverName || 'Not assigned'}</option>}
        {drivers.map(d => <option key={d.id} value={d.id} disabled={!d.assignable && String(d.id) !== String(v.driverId)}>{d.name}{d.note ? ` - ${String(d.note).toLowerCase()}` : ''}</option>)}</select></div>
      <div><span className={label}>Planned load (tons)</span><input className={input} type="number" step="0.001" value={f.plannedLoadTons} onChange={set('plannedLoadTons')} /></div>
      <div><span className={label}>From</span><input className={input} value={f.sourceCity} onChange={set('sourceCity')} /></div>
      <div><span className={label}>To</span><input className={input} value={f.destinationCity} onChange={set('destinationCity')} /></div>
      <div />
      <div><span className={label}>Planned start</span><input className={input} type="datetime-local" value={f.plannedStartAt} onChange={set('plannedStartAt')} /></div>
      <div><span className={label}>Expected arrival</span><input className={input} type="datetime-local" value={f.expectedArrivalAt} onChange={set('expectedArrivalAt')} /></div>
      <div><span className={label}>Reason for the change *</span><input className={input} required minLength={5} value={f.reason} onChange={set('reason')} placeholder="Truck changed: the first one broke down" /></div>
      <div className="md:col-span-3">
        {f.vehicleId && f.vehicleId !== String(v.vehicleId ?? '') && <ReadinessNote vehicleId={f.vehicleId} start={iso(f.plannedStartAt)} end={iso(f.expectedArrivalAt)} truckName={truck?.vehicleNumber}
          override={override} onOverride={setOverride} reason={overrideReason} onReason={setOverrideReason} />}
        {needsReadinessTick(err) && f.vehicleId === String(v.vehicleId ?? '') && <label className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} />Use this truck anyway, because
          <input className={`${input} max-w-md`} value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
        </label>}
      </div>
      <div className="flex gap-2 md:col-span-3"><button className={btn} disabled={busy}>Save change</button><button type="button" className={btnLight} onClick={() => setEditing(false)}>Cancel</button></div>
    </form>}

    {showLog && <div className="mt-3 overflow-x-auto">
      {!v.changes?.length ? <p className="text-sm text-slate-500">No changes yet.</p> : <table className="w-full min-w-[700px] text-sm">
        <thead><tr className="bg-slate-50 text-left"><th className="p-2">When</th><th>Who</th><th>What</th><th>Changes</th><th>Reason</th></tr></thead>
        <tbody>{v.changes.map((c: any) => <tr key={c.id} className="border-t align-top">
          <td className="whitespace-nowrap p-2">{when(c.changedAt)}</td><td>{c.changedByName || '-'}</td>
          <td className="whitespace-nowrap">{String(c.action).replace(/_/g, ' ').toLowerCase()}{c.afterApproval ? <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs font-bold text-amber-800">after approval</span> : null}</td>
          <td className="whitespace-pre-line">{c.changes || '-'}</td><td>{c.reason || '-'}</td>
        </tr>)}</tbody>
      </table>}
    </div>}
    <p className="mt-2 text-xs text-slate-400">Planned load {fmtWeight(v.plannedLoadTons)} · start {when(v.plannedStartAt)} · arrival {when(v.expectedArrivalAt)}</p>
  </section>;
}
