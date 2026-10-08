/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-010 -- change the truck of a running trip (breakdown, accident, reefer fault, driver problem) and move
// the goods on the road: ask with the new truck and driver, a Manager approves, then the handover is recorded with
// seals, temperatures of both trucks, packages and who handed over. The trip then runs on the new truck, the
// e-way bill gets the new vehicle and the history says what happened. Staff only.
//
// Backend: TransshipmentController (/api/dispatch/trips/{tripId}/transshipments, /api/dispatch/transshipments/**).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { rupees } from '@/modules/transporter/transporter';
import { when, iso } from '@/modules/allocation/allocation';
import { REASONS, TRANSSHIP_LABEL, call, pill } from '@/modules/tender/tender';
import { fmtTemp, fmtTempRange, fmtWeight, toBaseFields, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function TransshipmentPanel({ tripId, onChanged }: { tripId: number; onChanged: () => void }) {
  const [d, setD] = useState<any>(null);
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/api/dispatch/trips/${tripId}/transshipments`).then(setD).catch(() => setD(null)), [tripId]);
  useEffect(() => { void load(); }, [load]);
  if (!d || !d.ready) return null;
  const open = (d.transshipments || []).find((x: any) => x.status === 'REQUESTED' || x.status === 'APPROVED');
  if (!d.canRequest && d.transshipments.length === 0) return null;

  async function run(what: string, f: () => Promise<any>) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await f(); setMsg([r.message, ...(r.warnings || [])].filter(Boolean).join('\n') || 'Saved.'); setAsking(false); await load(); onChanged(); }
    catch (x) { setError(errorText(x, `Could not ${what}`)); } finally { setBusy(false); }
  }

  return <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-xl font-bold"><ArrowLeftRight className="h-5 w-5 text-sky-700" />Truck change on the road</h2>
      {d.canRequest && !open && !asking && <button onClick={() => setAsking(true)} className={btnLight}>Change truck</button>}
    </div>
    <Banner msg={msg} error={error} />
    {asking && <AskForm d={d} busy={busy} onCancel={() => setAsking(false)} onSave={b => void run('ask for the truck change', () => call('POST', `/api/dispatch/trips/${tripId}/transshipments`, b))} />}
    {d.transshipments.map((x: any) => <div key={x.id} className="mt-3 rounded-xl border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><b>{x.transshipNo}</b> <span className={pill(x.status)}>{TRANSSHIP_LABEL[x.status] || x.status}</span> · {REASONS.find(r => r[0] === x.reason)?.[1]}: {x.reasonNote}
          <div className="text-slate-600">{x.oldVehicleNumber} → <b>{x.newVehicleNumber}</b> ({x.newOwnership === 'OWN' ? 'own' : x.newTransporterName}), driver <b>{x.newTransporterDriverName || x.newDriverName || '-'}</b>{x.rescueFreight ? ` · rescue freight ${rupees(x.rescueFreight)}` : ''}</div>
          <div className="text-xs text-slate-500">Asked by {x.requestedByName} {when(x.requestedAt)}{x.decidedByName ? ` · ${x.status === 'REJECTED' ? 'rejected' : x.status === 'CANCELLED' ? 'cancelled' : 'approved'} by ${x.decidedByName} ${when(x.decidedAt)}` : ''}{x.decisionNote ? `: ${x.decisionNote}` : ''}{x.breakdownId ? ' · breakdown logged in Maintenance' : ''}</div>
          {x.status === 'DONE' && <div className="mt-1 text-xs">Handover {when(x.handoverAt)} at {x.place || '-'}: seal {x.oldSealNo || '-'} → {x.newSealNo}{x.sealIntact === false ? ' (old seal broken)' : ''}, {x.oldTruckTempC == null ? '-' : fmtTemp(x.oldTruckTempC)} → {x.newTruckTempC == null ? '-' : fmtTemp(x.newTruckTempC)}{x.tempInRange === false ? ' (out of range)' : ''}{x.packagesCount != null ? `, ${x.packagesCount} packages` : ''}, {x.handedOverBy} to {x.receivedBy}. E-way bill: {String(x.ewayStatus || '').replace(/_/g, ' ').toLowerCase()}{x.ewayNote ? ` (${x.ewayNote})` : ''}{x.goodsNote ? `. ${x.goodsNote}` : ''}</div>}
        </div>
        <div className="flex gap-2">
          {x.status === 'REQUESTED' && d.canApprove && <>
            <button disabled={busy} onClick={() => void run('approve', () => call('POST', `/api/dispatch/transshipments/${x.id}/approve`, { note: '' }))} className={btn}>Approve</button>
            <button disabled={busy} onClick={() => { const n = window.prompt('Why is it rejected?'); if (n) void run('reject', () => call('POST', `/api/dispatch/transshipments/${x.id}/reject`, { note: n })); }} className={btnRed}>Reject</button></>}
          {(x.status === 'REQUESTED' || x.status === 'APPROVED') && <button disabled={busy} onClick={() => { const n = window.prompt('Why is it cancelled?'); if (n) void run('cancel', () => call('POST', `/api/dispatch/transshipments/${x.id}/cancel`, { note: n })); }} className={btnLight}>Cancel</button>}
        </div>
      </div>
      {x.status === 'REQUESTED' && !d.canApprove && <p className="mt-1 text-xs text-amber-700">A Manager approves it before the handover.</p>}
      {x.status === 'APPROVED' && <Handover d={d} busy={busy} onSave={b => void run('record the handover', () => call('POST', `/api/dispatch/transshipments/${x.id}/handover`, b))} />}
    </div>)}
  </section>;
}

function AskForm({ d, busy, onSave, onCancel }: { d: any; busy: boolean; onSave: (b: any) => void; onCancel: () => void }) {
  const [trucks, setTrucks] = useState<any[]>([]), [drivers, setDrivers] = useState<any[]>([]), [tDrivers, setTDrivers] = useState<any[]>([]);
  const [vehicleId, setVehicleId] = useState(''), [reason, setReason] = useState('BREAKDOWN');
  useEffect(() => {
    api('/api/transporters/vehicles').then(r => setTrucks(Array.isArray(r) ? r : [])).catch(() => setTrucks([]));
    api('/api/operations/drivers').then(r => setDrivers(Array.isArray(r) ? r : [])).catch(() => setDrivers([]));
  }, []);
  const truck = trucks.find(t => String(t.id) === vehicleId);
  const hired = truck && truck.ownershipType !== 'OWN';
  useEffect(() => {
    setTDrivers([]);
    if (hired && truck.transporterId) api(`/api/transporters/verification/${truck.transporterId}`).then(r => setTDrivers((r.drivers || []).filter((x: any) => x.active))).catch(() => setTDrivers([]));
  }, [vehicleId]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); const b: any = Object.fromEntries(fd); b.logBreakdown = fd.get('logBreakdown') === 'on';
    for (const k of Object.keys(b)) if (b[k] === '') delete b[k];
    onSave(b);
  }
  return <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-3">
    <div><label className={label}>Reason *</label><select name="reason" value={reason} onChange={e => setReason(e.target.value)} className={input}>{REASONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    <div className="md:col-span-2"><label className={label}>What happened *</label><input name="reasonNote" required minLength={10} className={input} placeholder="Gearbox failed near Balasore toll plaza" /></div>
    <div><label className={label}>New truck *</label><select name="newVehicleId" required value={vehicleId} onChange={e => setVehicleId(e.target.value)} className={input}><option value="">Choose</option>
      {trucks.filter(t => t.status !== 'INACTIVE').map(t => <option key={t.id} value={t.id}>{t.vehicleNumber} ({t.ownershipType === 'OWN' ? 'own' : t.transporterName}){t.capacityTons ? `, ${fmtWeight(t.capacityTons)}` : ''}</option>)}</select></div>
    {hired
      ? <div><label className={label}>Transporter's driver *</label><select name="newTransporterDriverId" required className={input}><option value="">Choose</option>{tDrivers.map(x => <option key={x.id} value={x.id}>{x.name} ({x.verification?.result})</option>)}</select></div>
      : <div><label className={label}>Driver</label><select name="newDriverId" className={input}><option value="">The trip's driver stays</option>{drivers.map(x => <option key={x.id} value={x.id}>{x.name}{x.runningTripNumber ? ` (on ${x.runningTripNumber})` : ''}</option>)}</select></div>}
    {hired && <div><label className={label}>Rescue truck freight (₹)</label><input name="rescueFreight" type="number" min="0" className={input} /></div>}
    <div><label className={label}>Place</label><input name="place" className={input} /></div>
    {['BREAKDOWN', 'REEFER_FAULT', 'ACCIDENT'].includes(reason) && <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="logBreakdown" defaultChecked className="h-4 w-4" />Also log the breakdown of the old truck in Maintenance &amp; Fuel</label>}
    <div className="flex items-end gap-2 md:col-span-full"><button disabled={busy} className={btn}>Ask for approval</button><button type="button" onClick={onCancel} className={btnLight}>Cancel</button></div>
  </form>;
}

function Handover({ d, busy, onSave }: { d: any; busy: boolean; onSave: (b: any) => void }) {
  const range = d.tempMinC != null || d.tempMaxC != null ? fmtTempRange(d.tempMinC, d.tempMaxC) : d.targetC != null ? fmtTemp(d.targetC) : null;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); const b: any = toBaseFields(Object.fromEntries(fd), { oldTruckTempC: 'temp', newTruckTempC: 'temp' }); b.sealIntact = fd.get('sealIntact') === 'on'; // REQ-PLT-015
    b.handoverAt = iso(String(b.handoverAt || ''));
    for (const k of Object.keys(b)) if (b[k] === '') delete b[k];
    onSave(b);
  }
  return <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl bg-emerald-50 p-3 md:grid-cols-4">
    <div className="md:col-span-full font-semibold">Record the handover{range ? ` (trip range ${range})` : ''}</div>
    <div><label className={label}>Handover time</label><input name="handoverAt" type="datetime-local" className={input} /></div>
    <div><label className={label}>Old seal number</label><input name="oldSealNo" className={input} /></div>
    <div><label className={label}>New seal number *</label><input name="newSealNo" required className={input} /></div>
    <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" name="sealIntact" defaultChecked className="h-4 w-4" />Old seal was intact</label>
    <div><label className={label}>Old truck {unitNow('temp')}</label><input name="oldTruckTempC" type="number" step="any" className={input} /></div>
    <div><label className={label}>New truck {unitNow('temp')}{range && <span className="text-red-600"> *</span>}</label><input name="newTruckTempC" type="number" step="any" required={!!range} className={input} /></div>
    <div><label className={label}>Packages</label><input name="packagesCount" type="number" min="0" className={input} /></div>
    <div><label className={label}>New truck odometer (km)</label><input name="odometerNewKm" type="number" step="0.1" min="0" className={input} /></div>
    <div><label className={label}>Handed over by *</label><input name="handedOverBy" required className={input} /></div>
    <div><label className={label}>Received by *</label><input name="receivedBy" required className={input} /></div>
    <div><label className={label}>Place</label><input name="place" className={input} /></div>
    <div className="md:col-span-full"><label className={label}>Goods note (needed when out of range or the seal was broken)</label><input name="goodsNote" className={input} /></div>
    <div className="md:col-span-full"><button disabled={busy} className={btn}>Goods moved: put the trip on the new truck</button></div>
  </form>;
}
