/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-006 -- Challans: the traffic challans of every truck, read from e-Challan every morning (or typed in).
// Each new challan is matched to the trip and driver of that time and raised on the RTO board. Staff record what
// was done: paid (with the receipt), contested in court, charged to the driver or a company cost.
// Backend: /api/gov/challans (GovRecordsController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { SCRIPT, day, nowLocal, pill, providerNote, rupees, sourceText, when, words } from './gov';

const ACTIONS: [string, string][] = [['PAID', 'Paid'], ['CONTESTED', 'Contested in court'], ['DRIVER_COST', 'Charged to the driver'], ['COMPANY_COST', 'Company cost']];
const STYLE: Record<string, string> = { PENDING: 'bg-red-100 text-red-800', PAID: 'bg-emerald-100 text-emerald-800', COURT: 'bg-violet-100 text-violet-800', DISPOSED: 'bg-slate-200 text-slate-700', CANCELLED: 'bg-slate-200 text-slate-700' };

export function ChallansPage() {
  const [params] = useSearchParams();
  const [vehicleId, setVehicleId] = useState(params.get('vehicleId') || ''), [status, setStatus] = useState('PENDING');
  const [d, setD] = useState<any>(null), [trucks, setTrucks] = useState<any[]>([]), [adding, setAdding] = useState(false), [open, setOpen] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api(`/api/gov/challans?status=${status}${vehicleId ? `&vehicleId=${vehicleId}` : ''}`).then(setD).catch(e => setErr(errorText(e, 'The challans could not be read')));
  useEffect(() => { void load(); }, [vehicleId, status]);
  useEffect(() => { api('/api/gov/vehicles').then(x => setTrucks(x.vehicles || [])).catch(() => setTrucks([])); }, []);

  async function run(fn: () => Promise<any>, done: (x: any) => string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(done(x)); await load(); return x; }
    catch (e) { setErr(errorText(e, 'Not saved')); return null; } finally { setBusy(false); }
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b: any = Object.fromEntries(new FormData(e.currentTarget));
    if (b.offenceAt) b.offenceAt = new Date(b.offenceAt).toISOString();
    if (await run(() => api('/api/gov/challans', { method: 'POST', body: JSON.stringify(b) }), () => 'Challan added and raised on the RTO board')) setAdding(false);
  }
  async function act(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    const x = await run(() => api(`/api/gov/challans/${open.id}/action`, { method: 'POST', body: JSON.stringify(b) }), () => 'Saved');
    if (x) setOpen(x);
  }
  const fetchFor = (vid: string) => run(() => api(`/api/gov/vehicles/${vid}/challans/fetch`, { method: 'POST' }), x => x.message || 'Checked');

  if (d && d.ready === false) return <><h1 className="text-3xl font-bold">Challans</h1><NotReady script={SCRIPT} /></>;
  const tot = d?.totals || {};
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-3xl font-bold"><Ticket />Challans</h1>
        <p className="text-slate-600">Traffic challans of the trucks, matched to the trip and the driver of that time.</p></div>
      <button className={btn} onClick={() => setAdding(true)}>Add a challan</button>
    </div>
    <Banner msg={msg} error={err} />
    {d && providerNote(d.provider, 'e-Challan') && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">{providerNote(d.provider, 'e-Challan')}</p>}
    <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
      <div className="rounded-xl bg-white p-3 shadow-sm"><div className="text-slate-500">Unpaid</div><div className="text-lg font-bold">{Number(tot.pendingCount || 0)} · {rupees(tot.pending)}</div></div>
      <div className="rounded-xl bg-white p-3 shadow-sm"><div className="text-slate-500">Paid this year</div><div className="text-lg font-bold">{rupees(tot.paidThisYear)}</div></div>
    </div>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <div><span className={label}>Truck</span><select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className={input}><option value="">All trucks</option>
        {trucks.map(t => <option key={t.vehicleId} value={t.vehicleId}>{t.vehicleNumber}</option>)}</select></div>
      <div><span className={label}>Status</span><select value={status} onChange={e => setStatus(e.target.value)} className={input}><option value="">All</option>
        {['PENDING', 'PAID', 'COURT', 'DISPOSED', 'CANCELLED'].map(s => <option key={s} value={s}>{words(s)}</option>)}</select></div>
      {vehicleId && d?.connected && <button className={btnLight} disabled={busy} onClick={() => fetchFor(vehicleId)}>Check e-Challan now</button>}
    </div>

    {adding && <Section title="Add a challan">
      <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
        <div><span className={label}>Truck *</span><select name="vehicleId" required defaultValue={vehicleId} className={input}><option value="">Choose</option>{trucks.map(t => <option key={t.vehicleId} value={t.vehicleId}>{t.vehicleNumber}</option>)}</select></div>
        <div><span className={label}>Challan number *</span><input name="challanNo" required className={input} /></div>
        <div><span className={label}>Date and time *</span><input name="offenceAt" type="datetime-local" required defaultValue={nowLocal()} className={input} /></div>
        <div><span className={label}>Amount (₹) *</span><input name="amount" type="number" step="1" min="0" required className={input} /></div>
        <div className="md:col-span-2"><span className={label}>Offence</span><input name="offence" className={input} placeholder="Overloading" /></div>
        <div><span className={label}>Place</span><input name="place" className={input} /></div>
        <div><span className={label}>Licence number on the challan</span><input name="licenceNo" className={input} /></div>
        <div className="flex gap-2 md:col-span-4"><button className={btn} disabled={busy}>Add</button><button type="button" className={btnLight} onClick={() => setAdding(false)}>Cancel</button></div>
      </form>
    </Section>}

    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!d ? <p className="text-slate-500">Loading...</p> : !d.challans?.length ? <p className="text-slate-500">No challan here.</p> :
        <table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Challan</th><th>Truck</th><th>When and where</th><th>Offence</th><th>Amount</th><th>Driver and trip</th><th>Status</th><th /></tr></thead>
          <tbody>{d.challans.map((c: any) => <tr key={c.id} className={`border-t align-top ${open?.id === c.id ? 'bg-sky-50' : ''}`}>
            <td className="p-2 font-semibold">{c.challanNo}<div className="text-xs font-normal text-slate-500">{sourceText(c.source)}</div></td>
            <td>{c.vehicleNumber}</td><td className="whitespace-nowrap">{when(c.offenceAt)}<div className="text-xs text-slate-500">{c.place || ''}</div></td>
            <td className="max-w-xs">{c.offence || '-'}</td><td>{rupees(c.amount)}</td>
            <td>{c.driverName || '-'}{c.tripId ? <div><Link to={`/trips/${c.tripId}`} className="text-xs font-bold text-sky-700 hover:underline">{c.tripNumber}</Link></div> : null}</td>
            <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STYLE[c.status] || ''}`}>{words(c.status)}</span>
              {c.daysPending != null ? <div className="text-xs text-slate-500">{c.daysPending} days</div> : null}{c.actionLabel ? <div className="text-xs">{c.actionLabel}</div> : null}</td>
            <td className="p-2"><button className={btnLight} onClick={() => setOpen(c)}>Open</button></td>
          </tr>)}</tbody>
        </table>}
    </section>

    {open && <Section title={`Challan ${open.challanNo}`} right={<button className={btnLight} onClick={() => setOpen(null)}>Close</button>}>
      <p className="text-sm">{open.vehicleNumber}, {when(open.offenceAt)}{open.place ? ` at ${open.place}` : ''}: {open.offence || '-'}, {rupees(open.amount)}. <span className={pill(open.status === 'PENDING' ? 'MISSING' : 'OK')}>{words(open.status)}</span>
        {open.courtName ? ` Court: ${open.courtName}.` : ''}</p>
      {open.action && <p className="mt-1 text-sm">{open.actionLabel}{open.paidOn ? ` on ${day(open.paidOn)}` : ''}{open.receiptRef ? `, receipt ${open.receiptRef}` : ''}{open.actionNote ? `: ${open.actionNote}` : ''}. By {open.actionByName}, {when(open.actionAt)}.</p>}
      <form onSubmit={act} className="mt-3 grid gap-3 md:grid-cols-4">
        <div><span className={label}>What was done *</span><select name="action" required defaultValue={open.action || ''} className={input}><option value="">Choose</option>{ACTIONS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
        <div><span className={label}>Paid on</span><input name="paidOn" type="date" className={input} /></div>
        <div><span className={label}>Receipt number (needed when paid)</span><input name="receiptRef" defaultValue={open.receiptRef || ''} className={input} /></div>
        <div><span className={label}>Status</span><select name="status" defaultValue="" className={input}><option value="">As the action says</option>{['PENDING', 'PAID', 'COURT', 'DISPOSED', 'CANCELLED'].map(s => <option key={s} value={s}>{words(s)}</option>)}</select></div>
        <div className="md:col-span-3"><span className={label}>Note</span><input name="note" defaultValue={open.actionNote || ''} className={input} /></div>
        <div className="flex items-end"><button className={btn} disabled={busy}>Save</button></div>
      </form>
    </Section>}
  </>;
}
