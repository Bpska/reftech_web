/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-014 -- free trucks and return loads. Transporters post free trucks and empty return lanes (on the portal,
// or staff post for them here). A load on a matching lane and date is offered first to a truck that would otherwise
// go back empty. The offer goes out as a tender offer (REQ-TAL-004) with a WhatsApp alert; the transporter accepts or
// quotes on the portal or by quick reply (YES / NO / QUOTE <offer> <amount>).
//
// Backend: FreeTruckController (/api/transporters/free-trucks/**).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { VEHICLE_TYPES, role, rupees } from './transporter';
import { when } from '@/modules/allocation/allocation';
import { FREE_TRUCK_STATE, SCRIPT_92, badge, localInput } from './talMarket';

const post = (path: string, body?: unknown) => api(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const B = '/api/transporters/free-trucks';

export function FreeTrucksPage() {
  const me = role();
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [req, setReq] = useState<any>(null);
  const [truck, setTruck] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const l = await api(`${B}?status=${status}`);
      setList(l);
      if (l.ready) setRequests((await api(`${B}/requests`)).requests || []);
    } catch (x) { setError(errorText(x, 'Could not load the free trucks')); }
  }, [status]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  useEffect(() => { if (me.staff) api('/api/transporters').then(r => setTransporters((r.transporters || []).filter((t: any) => t.onboardingStatus === 'APPROVED'))).catch(() => setTransporters([])); }, []);
  const openRequest = (id: number) => { setTruck(null); api(`${B}/requests/${id}`).then(setReq).catch(x => setError(errorText(x, 'Could not load the request'))); };
  const openTruck = (id: number) => { setReq(null); api(`${B}/${id}`).then(setTruck).catch(x => setError(errorText(x, 'Could not load the truck'))); };

  async function run(action: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setError('');
    try {
      const r = await action(); setMsg(r?.message || done); await load();
      if (req) openRequest(req.request.requestId);
      if (truck) openTruck(truck.id);
      return r ?? true;
    } catch (x) { setError(errorText(x, 'Could not save')); return null; } finally { setBusy(false); }
  }

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Free Trucks</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Truck className="h-8 w-8 text-sky-700" />Free Trucks & Return Loads</h1>
    <p className="text-slate-600">Trucks transporters have free, and trucks that would go back empty. A load on a matching lane and date is offered to a returning truck first. <Link to="/vehicle-requests" className="font-semibold text-sky-700">Vehicle Requests</Link></p>
    <Banner msg={msg} error={error} />
    {list && !list.ready && <NotReady script={SCRIPT_92} />}
    {list?.ready && <>
      <Section title={`Open loads (${requests.length})`}>
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Request</th><th className={th}>Lane</th><th className={th}>Pickup</th><th className={th}>Trucks that fit</th><th className={th}>Would go back empty</th><th className={th}>Offered</th></tr></thead>
          <tbody>{requests.map(r => <tr key={r.requestId} onClick={() => openRequest(r.requestId)} className={`cursor-pointer border-t hover:bg-sky-50 ${req?.request?.requestId === r.requestId ? 'bg-sky-50' : ''}`}>
            <td className={td}><b>{r.requestNo}</b>{r.liveTender && <div className="text-xs text-slate-500">tender {r.liveTender}</div>}</td>
            <td className={td}>{r.originCity} → {r.destinationCity}, {Number(r.loadTons)} t, {r.temperature}</td><td className={td}>{when(r.pickupAt)}</td>
            <td className={td}>{r.matches}</td><td className={td}>{r.returnEmptyMatches > 0 ? <span className={badge('MATCHED')}>{r.returnEmptyMatches}</span> : '0'}</td><td className={td}>{r.offered}</td></tr>)}
            {requests.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>No open vehicle request.</td></tr>}</tbody></table></div>
      </Section>

      {req && <Section title={<>{req.request.requestNo}: {req.request.originCity} → {req.request.destinationCity}</>} right={<div className="flex gap-2">
        {req.matches.length > 0 && <button disabled={busy} className={btn} onClick={() => void run(() => post(`${B}/requests/${req.request.requestId}/offer-best`), 'Offered.')}>Offer to the best match</button>}
        <button className={btnLight} onClick={() => setReq(null)}>Close</button></div>}>
        <p className="text-sm text-slate-600">{Number(req.request.loadTons)} t · {req.request.temperature} · pickup {when(req.request.pickupAt)} · deliver by {when(req.request.deliverBy)}</p>
        <Matches rows={req.matches} busy={busy} onOffer={(id, amount) => void run(() => post(`${B}/requests/${req.request.requestId}/offer`, { freeTruckId: id, amount: amount || undefined }), 'Offered.')} />
        {req.leftOut.length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer">Trucks at {req.request.originCity} that do not fit ({req.leftOut.length})</summary>
          <ul className="ml-5 list-disc">{req.leftOut.map((f: any) => <li key={f.id}>{f.postNo} {f.transporterName} {f.vehicleNumber || ''}: {f.why}</li>)}</ul></details>}
        <Offers rows={req.offers} />
      </Section>}

      {truck && <Section title={<>{truck.postNo} <span className={badge(truck.status)}>{FREE_TRUCK_STATE[truck.status] || truck.status}</span></>} right={<button className={btnLight} onClick={() => setTruck(null)}>Close</button>}>
        <p className="text-sm">{truck.transporterName} · {truck.kind === 'RETURN' ? `returning empty ${truck.availableCity} → ${truck.destinationCity}` : `free at ${truck.availableCity}`} · {truck.vehicleNumber || 'truck not named'} · {Number(truck.capacityTons)} t
          · {when(truck.availableFrom)} to {when(truck.availableTo)}{truck.expectedRate ? ` · asks ${rupees(truck.expectedRate)}` : ''}</p>
        <h3 className="mt-3 font-bold">Open loads it fits</h3>
        <ul className="ml-5 list-disc text-sm">{truck.loads.map((l: any) => <li key={l.requestId}><button className="font-semibold text-sky-700" onClick={() => openRequest(l.requestId)}>{l.requestNo}</button> {l.originCity} → {l.destinationCity}, pickup {when(l.pickupAt)}: {l.why}</li>)}
          {truck.loads.length === 0 && <li className="text-slate-500">None right now.</li>}</ul>
        <OfferTable rows={truck.offers} busy={busy} onReply={(id, body) => void run(() => post(`${B}/offers/${id}/reply`, body), 'Saved.')} />
      </Section>}

      <Section title="Free and returning trucks" right={<div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)} className={`${input} w-40`}><option value="ALL">All</option>
          {Object.entries(FREE_TRUCK_STATE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className={btn} onClick={() => setAdding(!adding)}>Post a truck for a transporter</button></div>}>
        {adding && <PostForm transporters={transporters} busy={busy} onSave={body => run(() => post(B, body), 'Posted.').then(r => { if (r) setAdding(false); })} />}
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Post</th><th className={th}>Transporter / truck</th><th className={th}>Where</th><th className={th}>When</th><th className={th}>Loads that fit</th><th className={th}>Offers</th><th className={th}>Status</th><th className={th}></th></tr></thead>
          <tbody>{list.trucks.map((f: any) => <tr key={f.id} className="border-t">
            <td className={td}><button className="font-semibold text-sky-700" onClick={() => openTruck(f.id)}>{f.postNo}</button><div className="text-xs text-slate-500">{f.kind === 'RETURN' ? 'Return lane' : 'Free truck'} · {f.postedVia === 'PORTAL' ? 'portal' : f.postedByName}</div></td>
            <td className={td}>{f.transporterName}<div className="text-xs text-slate-500">{f.vehicleNumber || '-'} · {Number(f.capacityTons)} t{f.tempMinC != null ? ` · ${Number(f.tempMinC)} to ${Number(f.tempMaxC)} °C` : ''}</div></td>
            <td className={td}>{f.availableCity}{f.destinationCity ? ` → ${f.destinationCity}` : ''}</td><td className={td}>{when(f.availableFrom)}<div className="text-xs text-slate-500">till {when(f.availableTo)}</div></td>
            <td className={td}>{f.matchingLoads ?? '-'}</td><td className={td}>{f.offers?.length || 0}</td><td className={td}><span className={badge(f.status)}>{FREE_TRUCK_STATE[f.status] || f.status}</span></td>
            <td className={td}>{f.status === 'OPEN' && <button disabled={busy} className={btnRed} onClick={() => { const r = window.prompt('Why is the post withdrawn?'); if (r !== null) void run(() => post(`${B}/${f.id}/withdraw`, { reason: r }), 'Withdrawn.'); }}>Withdraw</button>}</td></tr>)}
            {list.trucks.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>No trucks posted.</td></tr>}</tbody></table></div>
        <p className="mt-2 text-xs text-slate-500">A truck fits a load when it is at the pickup city within {list.slackHours} hours of the pickup time, carries the weight and keeps the temperature.</p>
      </Section>
    </>}
  </>;
}

function Matches({ rows, busy, onOffer }: { rows: any[]; busy: boolean; onOffer: (id: number, amount: string) => void }) {
  const [amount, setAmount] = useState<Record<number, string>>({});
  return <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Truck</th><th className={th}>Why it fits</th><th className={`${th} text-right`}>Asks</th><th className={th}>Offer ₹</th><th className={th}></th></tr></thead>
    <tbody>{rows.map(f => <tr key={f.id} className="border-t"><td className={td}><b>{f.postNo}</b> {f.transporterName}{f.wouldReturnEmpty && <span className={`${badge('MATCHED')} ml-1`}>would go back empty</span>}
      <div className="text-xs text-slate-500">{f.vehicleNumber || '-'} · {Number(f.capacityTons)} t</div></td><td className={td}>{f.why}</td><td className={`${td} text-right`}>{f.expectedRate ? rupees(f.expectedRate) : '-'}</td>
      <td className={td}><input type="number" step="any" placeholder="from contract" value={amount[f.id] || ''} onChange={e => setAmount({ ...amount, [f.id]: e.target.value })} className={`${input} w-32`} /></td>
      <td className={td}><button disabled={busy} className={btn} onClick={() => onOffer(f.id, amount[f.id] || '')}>Offer</button></td></tr>)}
      {rows.length === 0 && <tr><td colSpan={5} className={`${td} text-slate-500`}>No posted truck fits this load.</td></tr>}</tbody></table>;
}

function Offers({ rows }: { rows: any[] }) {
  if (!rows?.length) return null;
  return <div className="mt-3 text-sm"><b>Offers made</b><ul className="ml-5 list-disc">{rows.map((o: any) => <li key={o.id}>{o.postNo} {o.transporterName}: {rupees(o.offeredAmount)} · {o.reply ? o.reply.toLowerCase() : o.offerStatus?.toLowerCase() || 'waiting'}
    {o.quotedAmount ? ` at ${rupees(o.quotedAmount)}` : ''} · WhatsApp {o.alertStatus?.toLowerCase() || '-'} · {when(o.createdAt)}</li>)}</ul></div>;
}

function OfferTable({ rows, busy, onReply }: { rows: any[]; busy: boolean; onReply: (id: number, body: any) => void }) {
  if (!rows?.length) return <p className="mt-3 text-sm text-slate-500">No load offered to this truck yet.</p>;
  return <table className="mt-3 w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Offer</th><th className={th}>Load</th><th className={`${th} text-right`}>Freight</th><th className={th}>Answer</th><th className={th}>WhatsApp</th><th className={th}></th></tr></thead>
    <tbody>{rows.map(o => <tr key={o.id} className="border-t"><td className={td}>{o.offerRef}{o.tenderNo && <div className="text-xs text-slate-500">tender {o.tenderNo}</div>}</td>
      <td className={td}>{o.requestNo}: {o.originCity} → {o.destinationCity}, pickup {when(o.pickupAt)}</td><td className={`${td} text-right`}>{rupees(o.offeredAmount)}</td>
      <td className={td}>{o.reply ? `${o.reply.toLowerCase()}${o.quotedAmount ? ` ${rupees(o.quotedAmount)}` : ''} (${String(o.replyVia || '').toLowerCase()})` : o.offerStatus?.toLowerCase() || 'waiting'}</td>
      <td className={td}>{o.alertStatus || '-'}{o.alertNote ? <div className="text-xs text-slate-500">{o.alertNote}</div> : null}</td>
      <td className={td}>{!o.reply && ['SENT', 'INVITED'].includes(o.offerStatus) && <div className="flex flex-wrap gap-1">
        <button disabled={busy} className={btnLight} onClick={() => onReply(o.id, { action: 'ACCEPT', note: 'Phoned in' })}>Accepted (phone)</button>
        <button disabled={busy} className={btnLight} onClick={() => { const a = window.prompt('Amount the transporter quoted (₹):'); if (a) onReply(o.id, { action: 'QUOTE', amount: a, note: 'Phoned in' }); }}>Quoted</button>
        <button disabled={busy} className={btnRed} onClick={() => onReply(o.id, { action: 'DECLINE', note: 'Phoned in' })}>Declined</button></div>}</td></tr>)}</tbody></table>;
}

function PostForm({ transporters, busy, onSave }: { transporters: any[]; busy: boolean; onSave: (b: any) => void }) {
  const [f, setF] = useState<Record<string, string>>({ kind: 'RETURN', vehicleType: 'REEFER_TRUCK', availableFrom: localInput(new Date()), availableTo: localInput(new Date(Date.now() + 2 * 86400000)) });
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const fields: [string, string, string?][] = [['vehicleNumber', 'Truck number'], ['capacityTons', 'Capacity (t)', 'number'], ['tempMinC', 'Lowest °C', 'number'], ['tempMaxC', 'Highest °C', 'number'],
    ['availableCity', 'Free at (city)'], ['destinationCity', f.kind === 'RETURN' ? 'Going back to' : 'Wants to go to (optional)'], ['availableFrom', 'Free from', 'datetime-local'], ['availableTo', 'Free till', 'datetime-local'],
    ['expectedRate', 'Asks ₹ (optional)', 'number'], ['note', 'Note']];
  return <div className="mb-4 grid gap-3 rounded-xl bg-sky-50 p-3 md:grid-cols-4">
    <div><label className={label}>Transporter</label><select value={f.transporterId || ''} onChange={e => set('transporterId', e.target.value)} className={input}><option value="">-</option>{transporters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
    <div><label className={label}>Kind</label><select value={f.kind} onChange={e => set('kind', e.target.value)} className={input}><option value="RETURN">Empty return lane</option><option value="FREE">Free truck</option></select></div>
    <div><label className={label}>Truck type</label><select value={f.vehicleType} onChange={e => set('vehicleType', e.target.value)} className={input}>{VEHICLE_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
    {fields.map(([k, l, ty]) => <div key={k}><label className={label}>{l}</label><input type={ty || 'text'} step="any" value={f[k] || ''} onChange={e => set(k, e.target.value)} className={input} /></div>)}
    <div className="flex items-end"><button disabled={busy} className={btn} onClick={() => onSave(Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')))}>Post</button></div>
  </div>;
}
