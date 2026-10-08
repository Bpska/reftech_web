/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-009 -- Quality hold and release after a temperature excursion. Staff only.
//
// A temperature alert on a trip puts the goods it touched on hold (one hold per load). Staff can also put a load
// or a trip on hold by hand. Goods on hold cannot be put on a truck, start a trip or be billed.
//   1. Record the check: what was checked and found, the product temperature.
//   2. A Manager or Admin decides: release, release with a note to the customer, or reject; with the reason and the
//      preventive action. Rejected goods cannot be billed as delivered in good order.
// Backend: /api/quality/holds (QualityHoldController). Needs database_v2/40_dispatch_and_quality_hold.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { role, when } from '@/modules/allocation/allocation';
import { fmtTemp, fmtTempNumber, fmtWeight, toBaseFields, toShown, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const SCRIPT = 'database_v2/40_dispatch_and_quality_hold.sql';
const STYLE: Record<string, string> = {
  ON_HOLD: 'bg-red-100 text-red-800', INVESTIGATING: 'bg-amber-100 text-amber-800', RELEASED: 'bg-emerald-100 text-emerald-800',
  RELEASED_WITH_NOTE: 'bg-sky-100 text-sky-800', REJECTED: 'bg-slate-300 text-slate-800',
};
const DECISIONS: [string, string][] = [['RELEASE', 'Release'], ['RELEASE_WITH_NOTE', 'Release with a note to the customer'], ['REJECT', 'Reject']];

export function QualityHoldsPage() {
  const r = role();
  const [filter, setFilter] = useState('ACTIVE'), [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<any>(null), [loads, setLoads] = useState<any[]>([]), [placing, setPlacing] = useState(false);

  const load = () => api(`/api/quality/holds?status=${filter}`).then(setData).catch(e => setErr(errorText(e, 'The holds could not be read')));
  useEffect(() => { void load(); }, [filter]);
  const openHold = (id: number) => api(`/api/quality/holds/${id}`).then(setOpen).catch(e => setErr(errorText(e, 'The hold could not be read')));

  async function run(fn: () => Promise<any>) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(x?.message || 'Saved'); await load(); if (x?.id) await openHold(x.id); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; } finally { setBusy(false); }
  }

  function startPlace() {
    setPlacing(true);
    api('/api/operations/loads').then(x => setLoads((Array.isArray(x) ? x : []).filter((l: any) => ['OPEN', 'PLANNED'].includes(String(l.status))))).catch(() => setLoads([]));
  }
  async function place(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    if (await run(() => api('/api/quality/holds', { method: 'POST', body: JSON.stringify(b) }))) setPlacing(false);
  }
  async function check(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = toBaseFields(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, any>, { productTempC: 'temp' }); // REQ-PLT-015
    await run(() => api(`/api/quality/holds/${open.id}/check`, { method: 'POST', body: JSON.stringify(b) }));
  }
  async function decide(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    await run(() => api(`/api/quality/holds/${open.id}/decide`, { method: 'POST', body: JSON.stringify(b) }));
  }

  if (data && data.ready === false) return <><h1 className="text-3xl font-bold">Quality Holds</h1><NotReady script={SCRIPT} /></>;
  const c = data?.counts || {};
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><ShieldAlert />Quality Holds</h1>
        <p className="text-slate-600">Goods held after a temperature excursion, or by hand. They cannot be dispatched or billed until a Manager releases them.</p>
      </div>
      <button className={btn} onClick={startPlace}>Put goods on hold</button>
    </div>
    <Banner msg={msg} error={err} />
    <div className="mt-3 flex flex-wrap gap-2">
      {[['ACTIVE', `Open (${Number(c.ON_HOLD || 0) + Number(c.INVESTIGATING || 0)})`], ['CLOSED', `Decided (${Number(c.RELEASED || 0) + Number(c.RELEASED_WITH_NOTE || 0) + Number(c.REJECTED || 0)})`], ['ALL', 'All']].map(([k, t]) =>
        <button key={k} onClick={() => setFilter(k)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${filter === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{t}</button>)}
    </div>

    {placing && <Section title="Put goods on hold">
      <form onSubmit={place} className="grid gap-3 md:grid-cols-3">
        <div><span className={label}>Load *</span><select name="loadRequestId" required className={input}><option value="">Choose the load</option>
          {loads.map(l => <option key={l.id} value={l.id}>{l.loadNumber} - {l.partnerName || ''} {l.pickupCity} → {l.deliveryCity} ({fmtWeight(l.weightTons)}){l.tripNumber ? `, trip ${l.tripNumber}` : ''}</option>)}</select></div>
        <div className="md:col-span-2"><span className={label}>Reason *</span><input name="reason" required minLength={5} className={input} placeholder="Cartons warm at loading" /></div>
        <div className="flex gap-2 md:col-span-3"><button className={btn} disabled={busy}>Place hold</button><button type="button" className={btnLight} onClick={() => setPlacing(false)}>Cancel</button></div>
      </form>
    </Section>}

    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!data ? <p className="text-slate-500">Loading...</p> : !data.holds?.length ? <p className="text-slate-500">No hold here.</p> :
        <table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Hold</th><th>Status</th><th>Goods</th><th>Partner</th><th>Truck</th><th>Why</th><th>Peak</th><th>Placed</th><th /></tr></thead>
          <tbody>{data.holds.map((h: any) => <tr key={h.id} className={`border-t align-top ${open?.id === h.id ? 'bg-sky-50' : ''}`}>
            <td className="p-2 font-semibold">{h.holdNo}<div className="text-xs font-normal text-slate-500">{h.source === 'EXCURSION' ? 'temperature alert' : 'by hand'}</div></td>
            <td><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${STYLE[h.status] || ''}`}>{h.statusLabel}</span></td>
            <td>{h.goods}{h.quantityTons != null ? <span className="text-slate-500"> · {fmtWeight(h.quantityTons)}</span> : null}
              {h.tripId ? <div><Link to={`/trips/${h.tripId}`} className="text-xs font-bold text-sky-700 hover:underline">{h.tripNumber}</Link></div> : null}</td>
            <td>{h.partnerName || '-'}</td><td>{h.vehicleNumber || '-'}</td>
            <td className="max-w-xs">{h.reason}</td>
            <td className="whitespace-nowrap">{h.peakC != null ? fmtTemp(h.peakC) : '-'}{h.limitC != null ? <span className="text-xs text-slate-500"> (limit {fmtTempNumber(h.limitC)})</span> : null}</td>
            <td className="whitespace-nowrap">{when(h.placedAt)}</td>
            <td className="p-2"><button className={btnLight} onClick={() => openHold(h.id)}>Open</button></td>
          </tr>)}</tbody>
        </table>}
    </section>

    {open && <Section title={<>{open.holdNo} <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-bold ${STYLE[open.status] || ''}`}>{open.statusLabel}</span></>}
      right={<button className={btnLight} onClick={() => setOpen(null)}>Close</button>}>
      <p className="text-sm text-slate-700">{open.goods} · {open.partnerName || '-'} · {open.reason}</p>
      {open.alertId && <p className="text-sm text-slate-600">Alert: {String(open.alertType || '').replace('_', ' ').toLowerCase()}, peak {open.peakC != null ? fmtTemp(open.peakC) : '-'}, limit {open.limitC != null ? fmtTemp(open.limitC) : '-'} ({String(open.alertStatus || '').toLowerCase()}). <Link to="/excursions" className="font-bold text-sky-700 hover:underline">Temperature Alerts</Link></p>}
      {open.investigation && <p className="mt-2 text-sm"><b>Check:</b> {open.investigation}{open.productTempC != null ? ` (product ${fmtTemp(open.productTempC)})` : ''} by {open.investigatedByName} on {when(open.investigatedAt)}</p>}
      {open.decision && <p className="mt-1 text-sm"><b>Decision:</b> {open.decisionNote}{open.customerNote ? `. To the customer: ${open.customerNote}` : ''}. Preventive action: {open.preventiveAction}. By {open.decidedByName} on {when(open.decidedAt)}</p>}

      {open.canInvestigate && <form onSubmit={check} className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2"><span className={label}>What was checked and found *</span><textarea name="investigation" required minLength={10} rows={2} className={input} defaultValue={open.investigation || ''} placeholder="Probe test of 5 cartons: core 6 °C, no thawing, packaging dry" /></div>
        <div><span className={label}>Product temperature ({unitNow('temp')})</span><input name="productTempC" type="number" step="any" className={input} defaultValue={toShown('temp', open.productTempC)} /></div>
        <div className="md:col-span-3"><button className={btn} disabled={busy}>{open.status === 'INVESTIGATING' ? 'Update the check' : 'Record the check'}</button></div>
      </form>}

      {open.status === 'INVESTIGATING' && (open.canDecide ? <form onSubmit={decide} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
        <div><span className={label}>Decision *</span><select name="decision" required className={input}><option value="">Choose</option>{DECISIONS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
        <div><span className={label}>Reason for the decision *</span><input name="decisionNote" required minLength={5} className={input} /></div>
        <div><span className={label}>Note to the customer (needed for a release with a note)</span><input name="customerNote" className={input} placeholder="Short excursion of 20 min, product checked and fit" /></div>
        <div><span className={label}>Preventive action *</span><input name="preventiveAction" required minLength={5} className={input} placeholder="Reefer door seal replaced" /></div>
        <div className="md:col-span-2"><button className={btnRed} disabled={busy}>Save decision</button></div>
      </form> : <p className="mt-3 text-sm text-slate-600">{r.manager ? '' : 'A Manager or Admin decides: release, release with a note, or reject.'}</p>)}

      {open.events?.length > 0 && <div className="mt-4"><h3 className="font-bold">History</h3>
        <ul className="mt-1 space-y-1 text-sm">{open.events.map((e: any, i: number) => <li key={i}><span className="text-slate-500">{when(e.at)}</span> · {e.byName || '-'} · {String(e.action).replace(/_/g, ' ').toLowerCase()}{e.note ? `: ${e.note}` : ''}</li>)}</ul></div>}
    </Section>}
  </>;
}
