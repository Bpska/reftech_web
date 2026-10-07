/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-001, 002 -- the Tolls panel of Trip details: the plazas expected on the lane, the FASTag crossings of the
// trip (fetched every 30 minutes while it runs, or with "Fetch tolls"), cash crossings typed in, what is missing or
// off the route, the total against the expected, and the Excel. A flag is closed with a reason.
// Backend: /api/gov/trips/{id}/tolls (GovTollController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { Banner, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { nowLocal, pill, providerNote, rupees, sourceText, when } from './gov';

export function TripTollsPanel({ tripId, refreshKey }: { tripId: number; refreshKey?: number }) {
  const [d, setD] = useState<any>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false), [closing, setClosing] = useState<any>(null);

  const load = () => api(`/api/gov/trips/${tripId}/tolls`).then(setD).catch(e => setErr(errorText(e, 'The tolls could not be read')));
  useEffect(() => { void load(); }, [tripId, refreshKey]);

  async function run(fn: () => Promise<any>, done?: string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setD(x); setMsg(x?.message && done === undefined ? x.message : done || 'Saved'); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; } finally { setBusy(false); }
  }
  async function addCrossing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b: any = Object.fromEntries(new FormData(e.currentTarget));
    if (b.crossedAt) b.crossedAt = new Date(b.crossedAt).toISOString();
    if (await run(() => api(`/api/gov/trips/${tripId}/tolls/crossings`, { method: 'POST', body: JSON.stringify(b) }), 'Crossing added')) setAdding(false);
  }
  async function closeFlag(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    if (await run(() => api(`/api/gov/toll/flags/${closing.id}/close`, { method: 'POST', body: JSON.stringify(b) }), 'Flag closed')) setClosing(null);
  }

  if (d && d.ready === false) return null;
  const flagCell = (f: any) => !f ? null : f.status === 'OPEN'
    ? <button className="text-xs font-bold text-red-700 hover:underline" onClick={() => setClosing(f)}>Close flag</button>
    : <span className="text-xs text-slate-500">Closed: {d?.reasons?.[f.reason] || f.reason}{f.note ? `, ${f.note}` : ''}</span>;

  return <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Receipt className="h-5 w-5" />Tolls</h2>
      <div className="flex flex-wrap gap-2">
        <button className={btnLight} disabled={busy} onClick={() => run(() => api(`/api/gov/trips/${tripId}/tolls/fetch`, { method: 'POST' }))}>Fetch tolls</button>
        <button className={btnLight} onClick={() => setAdding(!adding)}>Add a crossing</button>
        <button className={btnLight} onClick={() => apiDownload(`/api/gov/trips/${tripId}/tolls.xlsx`, `Tolls_${d?.tripNumber || tripId}.xlsx`).catch(e => setErr(errorText(e, 'Not downloaded')))}>Excel</button>
      </div>
    </div>
    <Banner msg={msg} error={err} />
    {!d ? <p className="text-sm text-slate-500">Loading...</p> : <>
      <div className="mt-2 grid gap-3 text-sm md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Expected</div><div className="text-lg font-bold">{rupees(d.expectedTotal)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Paid</div><div className="text-lg font-bold">{rupees(d.paidTotal)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Toll per km</div><div className="text-lg font-bold">{d.tollPerKm != null ? rupees(d.tollPerKm) : '-'}</div>{d.distanceKm != null && <div className="text-xs text-slate-500">{Number(d.distanceKm)} km</div>}</div>
        <div className={`rounded-xl p-3 ${Number(d.openFlags) > 0 ? 'bg-red-50 text-red-900' : 'bg-slate-50'}`}><div className="text-slate-500">Open flags</div><div className="text-lg font-bold">{Number(d.openFlags || 0)}</div></div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{d.routeName ? `Toll route ${d.routeName}. ` : ''}{d.lastFetchAt ? `Last fetched ${when(d.lastFetchAt)}. ` : ''}{providerNote(d.provider, 'FASTag')}</p>
      {d.message && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">{d.message} <Link to="/gov/tolls?tab=routes" className="font-bold underline">Toll routes</Link></p>}

      {adding && <form onSubmit={addCrossing} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-5">
        <div><span className={label}>Plaza *</span><input name="plaza" required className={input} list="trip-toll-plazas" />
          <datalist id="trip-toll-plazas">{(d.expected || []).map((p: any) => <option key={p.seq} value={p.plaza} />)}</datalist></div>
        <div><span className={label}>Crossed at *</span><input name="crossedAt" type="datetime-local" required defaultValue={nowLocal()} className={input} /></div>
        <div><span className={label}>Amount *</span><input name="amount" type="number" step="0.01" min="0" required className={input} /></div>
        <div><span className={label}>Receipt or ref</span><input name="ref" className={input} /></div>
        <div className="flex items-end gap-2"><button className={btn} disabled={busy}>Add</button><button type="button" className={btnLight} onClick={() => setAdding(false)}>Cancel</button></div>
      </form>}

      {closing && <form onSubmit={closeFlag} className="mt-3 grid gap-3 rounded-xl bg-red-50 p-3 md:grid-cols-4">
        <div className="md:col-span-4 text-sm font-semibold">Close the flag of {closing.plazaName} ({closing.kind === 'MISSING' ? 'toll missing' : 'off the route'})</div>
        <div><span className={label}>Reason *</span><select name="reason" required className={input}><option value="">Choose</option>
          {Object.entries(d.reasons || {}).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}</select></div>
        <div><span className={label}>Note *</span><input name="note" required minLength={5} className={input} /></div>
        <div><span className={label}>Receipt number</span><input name="receiptRef" className={input} /></div>
        <div className="flex items-end gap-2"><button className={btn} disabled={busy}>Close flag</button><button type="button" className={btnLight} onClick={() => setClosing(null)}>Cancel</button></div>
      </form>}

      {d.expected?.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
        <thead><tr className="bg-slate-50 text-left"><th className="p-2">#</th><th>Plaza</th><th>State</th><th>Expected</th><th>Crossed</th><th>Paid</th><th>From</th><th>Status</th><th /></tr></thead>
        <tbody>{d.expected.map((p: any) => <tr key={p.seq} className="border-t align-top">
          <td className="p-2">{p.seq}</td><td className="font-semibold">{p.plaza}</td><td>{p.state || '-'}</td><td>{rupees(p.expectedAmount)}</td>
          <td className="whitespace-nowrap">{p.crossedAt ? when(p.crossedAt) : '-'}</td><td>{rupees(p.amount)}</td><td className="text-xs">{p.source ? sourceText(p.source) : '-'}</td>
          <td><span className={pill(p.status)}>{p.statusLabel}</span>{p.note ? <div className="text-xs text-slate-500">{p.note}</div> : null}</td>
          <td className="p-2">{flagCell(p.flag)}</td>
        </tr>)}</tbody></table></div>}

      {d.otherCrossings?.length > 0 && <div className="mt-4"><h3 className="font-bold">{d.expected?.length ? 'Crossings off the route' : 'Crossings'}</h3>
        <table className="mt-1 w-full text-sm"><tbody>{d.otherCrossings.map((c: any) => <tr key={c.id} className="border-t align-top">
          <td className="p-2 font-semibold">{c.plazaName}</td><td className="whitespace-nowrap">{when(c.crossedAt)}</td><td>{rupees(c.amount)}</td><td className="text-xs">{sourceText(c.source)}</td>
          <td>{c.onRoute === false ? <span className={pill('DIFFERS')}>Off the route</span> : null}</td><td className="p-2">{flagCell(c.flag)}</td>
        </tr>)}</tbody></table></div>}
      {!d.expected?.length && !d.otherCrossings?.length && <p className="mt-3 text-sm text-slate-500">No toll crossing on this trip yet.</p>}
    </>}
  </section>;
}
