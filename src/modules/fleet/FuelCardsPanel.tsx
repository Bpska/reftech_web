/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-012 fuel cards: the card of each truck, import of the card company's transactions (file, fetch through the
// FUEL_CARD connector, typed by hand), matching to truck and trip, booking as trip fuel and the mismatch flags.
// Shown on the Vehicle Expenses page (tab "Fuel cards"); the API is /api/vehicle-expenses/fuel-cards.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiDownload, apiUpload, currentUser } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, td, th } from '@/shared/components/FormKit';
import { PagerBar, usePagedList } from '@/shared/components/PagedList';

const BASE = '/api/vehicle-expenses/fuel-cards';
const FLAG_TEXT: Record<string, string> = {
  OVER_TANK: 'More than the tank', FAR_FROM_ROUTE: 'Far from the truck', OUTSIDE_TRIP: 'No trip at that time', NO_TRUCK: 'No truck', PRICE_ODD: 'Odd price',
};
const BOOKING_TEXT: Record<string, string> = { NOT_BOOKED: 'Waiting', BOOKED: 'Booked as trip fuel', LINKED: 'Same as a typed fill', IGNORED: 'Ignored' };
const TABS: [string, string, Record<string, string>][] = [
  ['review', 'To review', { 'f.booking': 'NOT_BOOKED' }],
  ['flagged', 'Flagged', { 'f.flagged': 'YES' }],
  ['booked', 'Booked', { 'f.booking': 'BOOKED' }],
  ['linked', 'Linked', { 'f.booking': 'LINKED' }],
  ['all', 'All', {}],
];

export function FuelCardsPanel() {
  const u = currentUser(), manager = u.role === 'MANAGER' || u.role === 'ADMIN';
  const [info, setInfo] = useState<any>(null), [vehicles, setVehicles] = useState<any[]>([]);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('review'), [editing, setEditing] = useState<any>(null), [file, setFile] = useState<File | null>(null);
  const list = usePagedList<any>(`${BASE}/transactions/page`, TABS.find(x => x[0] === tab)?.[2] || {}, 25);

  const load = () => api(BASE).then(setInfo).catch(e => setErr(errorText(e, 'Could not load the fuel cards')));
  useEffect(() => { void load(); api('/api/admin/vehicles').then(setVehicles).catch(() => setVehicles([])); }, []);

  async function run(work: () => Promise<any>, done?: (x: any) => string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await work(); setMsg(done ? done(x) : 'Saved'); await load(); list.reload(); }
    catch (e) { setErr(errorText(e, 'That did not work')); }
    finally { setBusy(false); }
  }

  function saveCard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, any>;
    body.active = body.active === 'on';
    const id = editing?.id;
    void run(() => api(id ? `${BASE}/cards/${id}` : `${BASE}/cards`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }), () => { setEditing(null); return 'Card saved'; });
  }

  function addTxn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const body = Object.fromEntries(new FormData(f));
    void run(() => api(`${BASE}/transactions`, { method: 'POST', body: JSON.stringify(body) }), x => { f.reset(); return x.message; });
  }

  if (!info) return <><Banner error={err} /><p className="mt-4 text-slate-500">Loading...</p></>;
  if (!info.ready) return <NotReady script="76_fuel_cards.sql" />;
  const counts = info.counts || {};

  return <>
    <Banner msg={msg} error={err} />
    {!info.tripFuelReady && <div className="my-3 rounded-xl bg-amber-50 p-3 text-amber-900">The trip fuel table is missing (script 27), so card transactions cannot be booked yet.</div>}

    <Section title="Fuel card transactions" right={<span className="text-sm text-slate-600">
      Waiting {counts.NOT_BOOKED || 0} ({counts.NOT_BOOKED_FLAGGED || 0} flagged) · Booked {counts.BOOKED || 0} · Linked {counts.LINKED || 0} · Ignored {counts.IGNORED || 0}</span>}>
      <p className="text-sm text-slate-600">
        A matched transaction with no flag is booked as trip fuel by itself (a fuel expense of the truck). When the driver or office already typed the same fill,
        the card transaction is linked to it and no second cost is made; when the driver types it later, the card entry is removed. Flags: litres over the tank
        ({info.defaultTankLitres ? `${info.defaultTankLitres} L unless the card says otherwise` : 'the tank of the card'}), the pump more than {info.farKm} km from the
        truck's GPS at that time, no trip of the truck at that time.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => <button key={k} type="button" onClick={() => setTab(k)} className={k === tab ? btn : btnLight}>{label}</button>)}
      </div>
      <div className="mt-3"><PagerBar list={list} placeholder="Search reference, card, truck, trip or station" exportName="fuel-card-transactions"
        sorts={[['txnAt', 'Time'], ['litres', 'Litres'], ['amount', 'Amount'], ['vehicleNumber', 'Truck']]} /></div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead><tr className="bg-slate-50">
            <th className={th}>Time</th><th className={th}>Reference</th><th className={th}>Card / truck</th><th className={th}>Trip</th><th className={th}>Litres</th>
            <th className={th}>Amount</th><th className={th}>Station</th><th className={th}>Status</th><th className={th}>Flags</th>{manager && <th className={th}></th>}
          </tr></thead>
          <tbody>
            {list.items.map(r => <tr key={r.id} className="border-t">
              <td className={td}>{r.txnAt ? new Date(r.txnAt).toLocaleString() : '-'}<div className="text-xs text-slate-500">{r.source}</div></td>
              <td className={`${td} font-mono`}>{r.txnRef}</td>
              <td className={td}>{r.vehicleNumber || '-'}<div className="text-xs text-slate-500">{r.cardNumber || ''}</div></td>
              <td className={td}>{r.tripId ? <Link to={`/trips/${r.tripId}`} className="font-semibold text-sky-700 hover:underline">{r.tripNumber}</Link> : '-'}</td>
              <td className={td}>{r.litres}</td>
              <td className={td}>₹{r.amount}<div className="text-xs text-slate-500">{r.pricePerLitre ? `₹${r.pricePerLitre}/L` : ''}</div></td>
              <td className={td}>{r.station || '-'}{r.gpsDistanceKm != null && <div className="text-xs text-slate-500">{r.gpsDistanceKm} km from GPS</div>}</td>
              <td className={td}>{BOOKING_TEXT[r.booking] || r.booking}{r.reviewedBy && <div className="text-xs text-slate-500">{r.reviewedBy}</div>}</td>
              <td className={td}>
                {(r.flags ? String(r.flags).split(',') : []).map((f: string) => <span key={f} className="mr-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{FLAG_TEXT[f] || f}</span>)}
                {r.flagNote && <div className="mt-1 max-w-xs text-xs text-slate-600">{r.flagNote}</div>}
              </td>
              {manager && <td className={`${td} whitespace-nowrap`}>
                {r.booking === 'NOT_BOOKED' && <>
                  <button type="button" disabled={busy || !r.vehicleId} className={btnLight}
                    onClick={() => { if (!r.flags || window.confirm(`Book this flagged transaction as trip fuel?\n${r.flagNote || ''}`)) void run(() => api(`${BASE}/transactions/${r.id}/book`, { method: 'POST' }), x => `Transaction ${r.txnRef}: ${BOOKING_TEXT[x.booking] || x.booking}`); }}>Book</button>{' '}
                  <button type="button" disabled={busy} className={btnLight} onClick={() => void run(() => api(`${BASE}/transactions/${r.id}/rematch`, { method: 'POST' }), () => 'Matched again')}>Match again</button>{' '}
                  <button type="button" disabled={busy} className={btnRed} onClick={() => { const reason = window.prompt('Why is this transaction ignored?'); if (reason !== null) void run(() => api(`${BASE}/transactions/${r.id}/ignore`, { method: 'POST', body: JSON.stringify({ reason }) }), () => 'Ignored'); }}>Ignore</button>
                </>}
                {r.booking !== 'NOT_BOOKED' && <button type="button" disabled={busy} className={btnLight}
                  onClick={() => { if (window.confirm(r.booking === 'BOOKED' ? 'Undo the booking? The fuel fill made from this card transaction is removed.' : 'Put this transaction back to waiting?')) void run(() => api(`${BASE}/transactions/${r.id}/unbook`, { method: 'POST' }), () => 'Back to waiting'); }}>Undo</button>}
              </td>}
            </tr>)}
            {!list.busy && list.items.length === 0 && <tr><td colSpan={10} className="p-4 text-slate-500">No transactions here.</td></tr>}
          </tbody>
        </table>
      </div>
      <PagerBar list={list} top={false} />
    </Section>

    {manager && <Section title="Import transactions">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <h3 className="font-semibold">Statement file</h3>
          <p className="text-sm text-slate-600">Excel (.xlsx) or CSV from the card company. The same reference is kept once.</p>
          <input type="file" accept=".xlsx,.csv" className="mt-2 text-sm" onChange={e => setFile(e.target.files?.[0] || null)} />
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={!file || busy} className={btn} onClick={() => file && void run(() => apiUpload(`${BASE}/import`, { file }), x => x.message)}>Import</button>
            <button type="button" className={btnLight} onClick={() => void apiDownload(`${BASE}/template`, 'fuel-card-transactions.csv')}>Template</button>
          </div>
        </div>
        <div>
          <h3 className="font-semibold">Fetch from the card company</h3>
          <p className="text-sm text-slate-600">Connector FUEL_CARD: <b>{info.connector?.provider}</b>{info.connector?.enabled ? '' : ' (switched off)'}. {info.connector?.note}</p>
          <button type="button" disabled={!info.connector?.canFetch || busy} className={`${btn} mt-2`} onClick={() => void run(() => api(`${BASE}/fetch`, { method: 'POST' }), x => x.message)}>Fetch now</button>
          {u.role === 'ADMIN' && <div className="mt-1 text-xs"><Link to="/platform/integrations" className="text-sky-700 hover:underline">Integrations</Link></div>}
        </div>
        <form onSubmit={addTxn} className="grid gap-2">
          <h3 className="font-semibold">Type one transaction</h3>
          <input name="txnRef" placeholder="Reference (empty = made up)" className={input} />
          <select name="cardNumber" className={input} defaultValue=""><option value="">Card *</option>{(info.cards || []).filter((c: any) => c.active).map((c: any) => <option key={c.id} value={c.cardNumber}>{c.cardNumber} {c.vehicleNumber ? `(${c.vehicleNumber})` : ''}</option>)}</select>
          <input name="txnAt" type="datetime-local" required className={input} />
          <div className="grid grid-cols-2 gap-2"><input name="litres" type="number" step="0.01" min="0.01" required placeholder="Litres *" className={input} /><input name="amount" type="number" step="0.01" min="0" required placeholder="Amount *" className={input} /></div>
          <input name="station" placeholder="Station" className={input} />
          <button disabled={busy} className={btn}>Add</button>
        </form>
      </div>
      {(info.imports || []).length > 0 && <table className="mt-4 w-full text-sm">
        <thead><tr className="bg-slate-50"><th className={th}>When</th><th className={th}>Source</th><th className={th}>Result</th><th className={th}>By</th></tr></thead>
        <tbody>{info.imports.map((i: any) => <tr key={i.id} className="border-t"><td className={td}>{new Date(i.createdAt).toLocaleString()}</td><td className={td}>{i.source}{i.fileName ? <div className="text-xs text-slate-500">{i.fileName}</div> : null}</td><td className={`${td} text-xs`}>{i.note}</td><td className={td}>{i.byName}</td></tr>)}</tbody>
      </table>}
    </Section>}

    <Section title="Fuel cards of the trucks" right={manager && <button type="button" className={btnLight} onClick={() => setEditing({ active: true })}>Add card</button>}>
      {editing && <form onSubmit={saveCard} className="mb-4 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
        <input name="cardNumber" required defaultValue={editing.cardNumber || ''} placeholder="Card number *" className={input} />
        <input name="issuer" defaultValue={editing.issuer || ''} placeholder="Card company (IOCL, BPCL, HPCL)" className={input} />
        <select name="vehicleId" defaultValue={editing.vehicleId || ''} className={input}><option value="">No truck yet</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select>
        <input name="tankLitres" type="number" step="0.1" min="1" defaultValue={editing.tankLitres || ''} placeholder={`Tank litres (default ${info.defaultTankLitres || '-'})`} className={input} />
        <input name="monthlyLimit" type="number" step="0.01" min="0" defaultValue={editing.monthlyLimit || ''} placeholder="Monthly limit (₹)" className={input} />
        <input name="notes" defaultValue={editing.notes || ''} placeholder="Notes" className={`${input} md:col-span-2`} />
        <label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={editing.active !== false} /> Active</label>
        <div className="flex gap-2 md:col-span-4"><button disabled={busy} className={btn}>Save card</button><button type="button" className={btnLight} onClick={() => setEditing(null)}>Cancel</button></div>
      </form>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50"><th className={th}>Card</th><th className={th}>Company</th><th className={th}>Truck</th><th className={th}>Tank</th><th className={th}>This month</th><th className={th}>Transactions</th><th className={th}>Active</th>{manager && <th className={th}></th>}</tr></thead>
          <tbody>
            {(info.cards || []).map((c: any) => <tr key={c.id} className="border-t">
              <td className={`${td} font-mono`}>{c.cardNumber}</td><td className={td}>{c.issuer}</td><td className={td}>{c.vehicleNumber || '-'}</td>
              <td className={td}>{c.tankLitres ? `${c.tankLitres} L` : '-'}</td>
              <td className={td}>₹{c.spentThisMonth}{c.monthlyLimit ? <span className={Number(c.spentThisMonth) > Number(c.monthlyLimit) ? 'ml-1 font-semibold text-red-700' : 'ml-1 text-slate-500'}>of ₹{c.monthlyLimit}</span> : null}</td>
              <td className={td}>{c.transactions}</td><td className={td}>{c.active ? 'Yes' : 'No'}</td>
              {manager && <td className={td}><button type="button" className={btnLight} onClick={() => setEditing(c)}>Change</button></td>}
            </tr>)}
            {(info.cards || []).length === 0 && <tr><td colSpan={8} className="p-4 text-slate-500">No fuel cards yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  </>;
}
