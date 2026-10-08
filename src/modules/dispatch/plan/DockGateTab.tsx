/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-006 -- the Dock & Gate tab of the Dispatch Plan: the trip's dock slot (dock, time, status, loading team),
// booking or moving it, and the slot steps (start loading, loaded, no-show, cancel); the loading manifest; the gate
// pass with what still stops it, its PDF for the driver, and cancelling it.
// Backend: POST /api/dispatch/trips/{id}/dock-slot { dockId, slotStart, slotMinutes, loadingTeam, teamLead, notes },
// GET /api/dispatch/docks?warehouseId=&day= (the docks and their slots that day),
// POST /api/dispatch/dock-slots/{slotId}/{CANCEL|NO_SHOW|START_LOADING|LOADED} { reason },
// POST /api/dispatch/trips/{id}/manifest, GET /api/dispatch/manifests/{id}/pdf,
// POST /api/dispatch/trips/{id}/gate-pass, GET /api/dispatch/gate-passes/{id}/pdf, POST /api/dispatch/gate-passes/{id}/cancel { reason }.
import { FormEvent, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { api, apiOpen } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { Problems, TabProps, askFor, indiaDay, iso, localInput, minutes, open, plain, send, useAction, when, words } from './planning';

const SLOT_STYLE: Record<string, string> = {
  BOOKED: 'bg-sky-100 text-sky-800', IN_YARD: 'bg-amber-100 text-amber-800', LOADING: 'bg-violet-100 text-violet-800', LOADED: 'bg-emerald-100 text-emerald-800',
};

export function DockGateTab({ tripId, plan, reload }: TabProps) {
  const d = plan.dock || {};
  const slot = d.slot;
  const editable = open(plan);
  const { busy, msg, err, setErr, run } = useAction(reload);
  const [f, setF] = useState<any>(null), [day, setDay] = useState<any>(null);

  function startBook() {
    const whs = (d.warehouses || []).filter((w: any) => Number(w.outboundDocks) > 0);
    const start = slot?.slotStart || plan.route?.plannedStartAt;
    const len = slot?.slotStart && slot?.slotEnd ? Math.round((new Date(slot.slotEnd).getTime() - new Date(slot.slotStart).getTime()) / 60000) : d.slotMinutes || 60;
    setF({ warehouseId: String(slot?.warehouseId ?? (whs.length === 1 ? whs[0].id : '')), dockId: String(slot?.dockId ?? ''), slotStart: localInput(start),
      slotMinutes: String(len), loadingTeam: slot?.loadingTeam || '', teamLead: slot?.teamLead || '', notes: slot?.notes || '' });
  }

  // the docks of the chosen warehouse on the day of the slot (and what is booked on them)
  const dayOf = f?.slotStart ? indiaDay(new Date(f.slotStart)) : '';
  useEffect(() => {
    if (!f?.warehouseId) { setDay(null); return; }
    api(`/api/dispatch/docks?warehouseId=${f.warehouseId}${dayOf ? `&day=${dayOf}` : ''}`).then(setDay).catch(e => { setDay(null); setErr(errorText(e, 'The docks could not be read')); });
  }, [f?.warehouseId, dayOf]);

  async function book(e: FormEvent) {
    e.preventDefault();
    const body = { dockId: Number(f.dockId), slotStart: iso(f.slotStart), slotMinutes: f.slotMinutes ? Number(f.slotMinutes) : null,
      loadingTeam: f.loadingTeam || null, teamLead: f.teamLead || null, notes: f.notes || null };
    if (await run(() => api(`/api/dispatch/trips/${tripId}/dock-slot`, send('POST', body)), 'Slot not booked')) setF(null);
  }

  function slotAction(action: string) {
    let body: any = {};
    if (action === 'CANCEL') { const reason = askFor(`cancelling slot ${slot.slotNo}`); if (reason === null) return; body = { reason }; }
    if (action === 'NO_SHOW' && !window.confirm('Mark that the truck did not come?')) return;
    void run(() => api(`/api/dispatch/dock-slots/${slot.id}/${action}`, send('POST', body)));
  }

  const pdf = (path: string) => apiOpen(path).catch(e => setErr(errorText(e, 'The PDF could not be opened')));
  const cancelPass = (p: any) => {
    const reason = askFor(`cancelling gate pass ${p.passNo}`);
    if (reason !== null) void run(() => api(`/api/dispatch/gate-passes/${p.id}/cancel`, send('POST', { reason })));
  };
  const set = (k: string) => (e: any) => setF((x: any) => ({ ...x, [k]: e.target.value, ...(k === 'warehouseId' ? { dockId: '' } : {}) }));
  const docks: any[] = day?.docks || [];
  const chosenDock = docks.find(x => String(x.id) === f?.dockId);
  const st = slot?.status;

  return <>
    <Section title="Dock slot" right={editable && !f && <button className={btnLight} onClick={startBook}>{slot ? 'Move slot' : 'Book a slot'}</button>}>
      <Banner msg={msg} error={err} />
      {!slot ? <p className="text-sm text-slate-500">No dock slot is booked for this trip.</p>
        : <div className="rounded-xl border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <b>{slot.slotNo}</b><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SLOT_STYLE[st] || 'bg-slate-100'}`}>{words(st)}</span>
            <span>Dock <b>{slot.dockCode}</b>, {slot.warehouseName}</span>
          </div>
          <div className="mt-1 text-slate-700">{when(slot.slotStart)} to {when(slot.slotEnd)}</div>
          <div className="text-slate-600">Team: {slot.loadingTeam || '-'}{slot.teamLead ? ` (lead ${slot.teamLead})` : ''}{slot.notes ? ` · ${slot.notes}` : ''}</div>
          <div className="text-xs text-slate-500">
            {slot.gateInAt ? `In the yard since ${when(slot.gateInAt)}${slot.lateInMinutes > 0 ? `, ${minutes(slot.lateInMinutes)} late` : ''} · ${minutes(slot.yardMinutes)} in the yard` : 'Not at the gate yet'}
            {slot.loadingStartedAt ? ` · loading from ${when(slot.loadingStartedAt)}` : ''}{slot.loadingDoneAt ? ` · loaded ${when(slot.loadingDoneAt)}` : ''} · booked by {slot.bookedBy || '-'}
          </div>
          {editable && <div className="mt-2 flex flex-wrap gap-2">
            {['BOOKED', 'IN_YARD'].includes(st) && <button className={btn} disabled={busy} onClick={() => slotAction('START_LOADING')}>Start loading</button>}
            {['IN_YARD', 'LOADING'].includes(st) && <button className={btn} disabled={busy} onClick={() => slotAction('LOADED')}>Loading done</button>}
            {st === 'BOOKED' && <button className={btnLight} disabled={busy} onClick={() => slotAction('NO_SHOW')}>Truck did not come</button>}
            <button className={btnRed} disabled={busy} onClick={() => slotAction('CANCEL')}>Cancel slot</button>
          </div>}
        </div>}

      {f && <form onSubmit={book} className="mt-3 grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 md:grid-cols-3">
        <div><span className={label}>Warehouse *</span><select className={input} required value={f.warehouseId} onChange={set('warehouseId')}>
          <option value="">Choose</option>{(d.warehouses || []).map((w: any) => <option key={w.id} value={w.id} disabled={!Number(w.outboundDocks)}>{w.name}{w.city ? `, ${w.city}` : ''} ({w.outboundDocks} docks)</option>)}</select></div>
        <div><span className={label}>Slot start *</span><input className={input} type="datetime-local" required value={f.slotStart} onChange={set('slotStart')} /></div>
        <div><span className={label}>Minutes</span><input className={input} type="number" min={15} max={720} step={15} value={f.slotMinutes} onChange={set('slotMinutes')} /></div>
        <div><span className={label}>Dock *</span><select className={input} required value={f.dockId} onChange={set('dockId')}>
          <option value="">{f.warehouseId ? (docks.length ? 'Choose' : 'No outbound dock') : 'Choose the warehouse first'}</option>
          {docks.map(x => <option key={x.id} value={x.id}>{x.dockCode}{x.name ? ` - ${x.name}` : ''} ({(x.slots?.length || 0) + (x.inbound?.length || 0)} booked that day)</option>)}</select></div>
        <div><span className={label}>Loading team</span><input className={input} value={f.loadingTeam} onChange={set('loadingTeam')} placeholder="Ravi, Suresh, Imran" /></div>
        <div><span className={label}>Team lead</span><input className={input} value={f.teamLead} onChange={set('teamLead')} /></div>
        <div className="md:col-span-3"><span className={label}>Notes</span><input className={input} value={f.notes} onChange={set('notes')} /></div>
        {chosenDock && (chosenDock.slots?.length > 0 || chosenDock.inbound?.length > 0) && <div className="text-xs text-slate-600 md:col-span-3">
          Dock {chosenDock.dockCode} on {dayOf}: {[...(chosenDock.slots || []).map((s: any) => `${s.tripNumber} ${when(s.slotStart)} to ${when(s.slotEnd)}`),
            ...(chosenDock.inbound || []).map((s: any) => `inbound ${s.noticeNo} ${when(s.slotStart)} to ${when(s.slotEnd)}`)].join(' · ')}</div>}
        <div className="flex gap-2 md:col-span-3"><button className={btn} disabled={busy}>{slot ? 'Move slot' : 'Book slot'}</button><button type="button" className={btnLight} onClick={() => setF(null)}>Cancel</button></div>
      </form>}

      {d.pastSlots?.length > 0 && <p className="mt-2 text-xs text-slate-500">Earlier slots: {d.pastSlots.map((s: any) => `${s.slotNo} ${words(s.status)}${s.cancelReason ? ` (${s.cancelReason})` : ''}`).join(' · ')}</p>}
    </Section>

    <Section title="Manifest" right={editable && <button className={btnLight} disabled={busy} onClick={() => void run(() => api(`/api/dispatch/trips/${tripId}/manifest`, send('POST')))}>Issue manifest</button>}>
      {!d.manifests?.length ? <p className="text-sm text-slate-500">No manifest yet. One is also made when the gate pass is issued.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead><tr className="bg-slate-50"><th className={th}>Manifest</th><th className={th}>Status</th><th className={th}>Pallets</th><th className={th}>Tons</th><th className={th}>Issued</th><th className={th} /></tr></thead>
          <tbody>{d.manifests.map((m: any) => <tr key={m.id} className="border-t">
            <td className={td}>{m.manifestNo} <span className="text-xs text-slate-500">v{m.version}</span></td><td className={td}>{words(m.status)}</td>
            <td className={td}>{m.pallets ?? '-'}</td><td className={td}>{plain(m.weightTons)}</td><td className={td}>{when(m.issuedAt)} · {m.issuedBy || '-'}</td>
            <td className={td}><button className={btnLight} onClick={() => void pdf(`/api/dispatch/manifests/${m.id}/pdf`)}><FileText className="mr-1 inline h-4 w-4" />PDF</button></td>
          </tr>)}</tbody>
        </table></div>}
    </Section>

    <Section title="Gate pass" right={editable && <button className={btn} disabled={busy || d.gatePassBlockers?.length > 0} onClick={() => void run(() => api(`/api/dispatch/trips/${tripId}/gate-pass`, send('POST')), 'Gate pass not issued')}>Issue gate pass</button>}>
      {d.gatePassRequired === false && <p className="mb-2 text-sm text-slate-500">A gate pass is not required to start trips (Dispatch setup).</p>}
      <Problems items={d.gatePassBlockers} title="The gate pass cannot be issued yet" tone="amber" />
      {!d.gatePasses?.length ? <p className="text-sm text-slate-500">No gate pass yet.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead><tr className="bg-slate-50"><th className={th}>Pass</th><th className={th}>Status</th><th className={th}>Truck / seal</th><th className={th}>Valid until</th><th className={th}>Issued</th><th className={th}>Used</th><th className={th} /></tr></thead>
          <tbody>{d.gatePasses.map((p: any) => <tr key={p.id} className="border-t">
            <td className={`${td} font-semibold`}>{p.passNo}</td>
            <td className={td}>{words(p.status)}{p.cancelReason && <div className="text-xs text-slate-500">{p.cancelReason}</div>}</td>
            <td className={td}>{p.vehicleNumber || '-'}{p.sealNumber ? ` · seal ${p.sealNumber}` : ''}</td>
            <td className={td}>{when(p.validUntil)}</td><td className={td}>{when(p.issuedAt)} · {p.issuedBy || '-'}</td>
            <td className={td}>{p.usedAt ? `${when(p.usedAt)} · ${p.usedBy || '-'}` : '-'}</td>
            <td className={`${td} whitespace-nowrap`}><button className={btnLight} onClick={() => void pdf(`/api/dispatch/gate-passes/${p.id}/pdf`)}>PDF</button>
              {p.status === 'ISSUED' && <button className={`${btnRed} ml-1`} disabled={busy} onClick={() => cancelPass(p)}>Cancel</button>}</td>
          </tr>)}</tbody>
        </table></div>}
    </Section>
  </>;
}
