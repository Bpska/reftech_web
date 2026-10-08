/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-013, REQ-TAL-014, REQ-TAL-015 -- three tabs of the transporter portal (own transporter only):
// * Lane tenders: the rates asked for per lane; the transporter bids, sees only its own rank (L1, L2 ...) and its award.
// * Free trucks: post a free truck or an empty return lane; answer the loads RefTech offers (also by WhatsApp quick reply).
// * Invoices: upload an invoice (PDF / photo) or an e-invoice JSON, follow its check, and accept or dispute debit notes.
//
// Backend: LaneTenderPortalController, FreeTruckPortalController, InvoicePortalController (/api/transporter-portal/...).
import { useCallback, useEffect, useState } from 'react';
import { api, apiUpload } from '@/shared/services/api';
import { btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { VEHICLE_TYPES, day, rupees } from '@/modules/transporter/transporter';
import { when } from '@/modules/allocation/allocation';
import { FREE_TRUCK_STATE, INVOICE_STATE, LANE_TENDER_STATE, badge, localInput, quickReply, rankLabel } from '@/modules/transporter/talMarket';
import { Notes } from '@/modules/transporter/InvoiceIntakePage';

const P = '/api/transporter-portal';
type Run = (what: string, f: () => Promise<any>, ok?: string) => Promise<void>;
const post = (path: string, body?: unknown) => api(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const Card = ({ title, children }: { title: string; children: any }) => <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm"><h2 className="text-xl font-bold">{title}</h2><div className="mt-3">{children}</div></section>;

function useLoad<T>(path: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [err, setErr] = useState('');
  const reload = useCallback(() => api(path).then(x => { setData(x); setErr(''); }).catch(x => setErr(x instanceof Error ? x.message : 'Could not load')), [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, err, reload };
}

// ---------------------------------------------------------------- REQ-TAL-013

export function PortalLaneTenders({ busy, run }: { busy: boolean; run: Run }) {
  const { data: rows, err, reload } = useLoad<any[]>(`${P}/lane-tenders`, []);
  const [open, setOpen] = useState<any>(null);
  const show = (id: number) => api(`${P}/lane-tenders/${id}`).then(setOpen).catch(() => setOpen(null));
  const act = async (what: string, f: () => Promise<any>) => { await run(what, f); await reload(); if (open) await show(open.id); };
  return <>
    <Card title="Lane tenders">
      {err && <p className="text-sm text-red-700">{err}</p>}
      <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Tender</th><th className={th}>Contract period</th><th className={th}>Round</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(t => <tr key={t.id} className="border-t"><td className={td}><b>{t.tenderNo}</b><div className="text-xs text-slate-500">{t.title}</div></td><td className={td}>{day(t.contractFrom)} to {day(t.contractTo)}</td>
          <td className={td}>{t.currentRound} of {t.maxRounds}{t.state === 'OPEN' && t.roundClosesAt ? <div className="text-xs text-slate-500">closes {when(t.roundClosesAt)}</div> : null}</td>
          <td className={td}><span className={badge(t.state)}>{LANE_TENDER_STATE[t.state] || t.state}</span>{t.inviteStatus === 'DECLINED' && <div className="text-xs text-slate-500">you declined</div>}</td>
          <td className={td}><button className={t.canBid ? btn : btnLight} onClick={() => void show(t.id)}>{t.canBid ? 'Give rates' : 'Open'}</button></td></tr>)}
          {rows.length === 0 && <tr><td colSpan={5} className={`${td} text-slate-500`}>No lane tender for you right now.</td></tr>}</tbody></table>
    </Card>
    {open && <Card title={`${open.tenderNo}: ${open.title}`}>
      <p className="text-sm text-slate-600">Contracts {day(open.contractFrom)} to {day(open.contractTo)} · round {open.currentRound} of {open.maxRounds}{open.roundClosesAt ? ` · ${open.state === 'OPEN' ? 'closes' : 'closed'} ${when(open.roundClosesAt)}` : ''}
        {open.notes ? ` · ${open.notes}` : ''}</p>
      <p className="mt-1 text-sm text-slate-600">You see only your own rate and your rank on each lane (L1 is the lowest rate). {open.currentRound > 1 ? 'In this round you may keep or lower your rate.' : ''}
        {!open.onShortlist && open.currentRound > 1 ? ' You are not on the shortlist of this round.' : ''}</p>
      <div className="mt-2 space-y-2">{open.lanes.map((l: any) => <BidLane key={l.id} l={l} canBid={open.canBid} busy={busy} onBid={body => void act('save the rate', () => post(`${P}/lane-tenders/${open.id}/bids`, { laneId: l.id, ...body }))} />)}</div>
      <div className="mt-3 flex gap-2">
        {open.canBid && <button disabled={busy} className={btnRed} onClick={() => { const r = window.prompt('Why do you not take part?'); if (r !== null) void act('decline', () => post(`${P}/lane-tenders/${open.id}/decline`, { reason: r })); }}>Do not take part</button>}
        <button className={btnLight} onClick={() => setOpen(null)}>Close</button></div>
    </Card>}
  </>;
}

function BidLane({ l, canBid, busy, onBid }: { l: any; canBid: boolean; busy: boolean; onBid: (b: any) => void }) {
  const [b, setB] = useState<Record<string, string>>({ rate: l.myRate ? String(l.myRate) : '', transitHours: l.myTransitHours ? String(l.myTransitHours) : '',
    detentionFreeHours: l.myDetentionFreeHours != null ? String(l.myDetentionFreeHours) : '', detentionPerDay: l.myDetentionPerDay ? String(l.myDetentionPerDay) : '',
    loadingCharge: l.myLoadingCharge ? String(l.myLoadingCharge) : '', unloadingCharge: l.myUnloadingCharge ? String(l.myUnloadingCharge) : '', maxLoadsPerMonth: l.myMaxLoadsPerMonth ? String(l.myMaxLoadsPerMonth) : '' });
  const fields: [string, string][] = [['rate', 'Rate ₹'], ['transitHours', 'Transit h'], ['detentionFreeHours', 'Free h'], ['detentionPerDay', 'Detention ₹/day'], ['loadingCharge', 'Loading ₹'], ['unloadingCharge', 'Unloading ₹'], ['maxLoadsPerMonth', 'Loads / month']];
  return <div className="rounded-xl border border-slate-200 p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{l.lineNo}. {l.originCity} → {l.destinationCity}</b> · {VEHICLE_TYPES.find(v => v[0] === l.vehicleType)?.[1] || l.vehicleType}
      {l.capacityTons ? ` · ${Number(l.capacityTons)} t` : ''} · {l.temperatureProfileName || 'any temperature'}{l.loadsPerMonth ? ` · about ${l.loadsPerMonth} loads a month` : ''}{l.ceilingRate ? ` · at most ${rupees(l.ceilingRate)}` : ''}</div>
      <div>{l.myRate ? <>Your rate {rupees(l.myRate)} · <span className="text-lg font-bold text-sky-700">{rankLabel(l.myRank)}</span></> : 'No rate given'}
        {l.myAward && <span className={`${badge('AWARDED')} ml-2`}>Awarded {Number(l.myAward.sharePercent)} % at {rupees(l.myAward.rate)}</span>}</div></div>
    {canBid && <div className="mt-2 flex flex-wrap items-end gap-2">{fields.map(([k, t]) => <div key={k}><label className="block text-xs text-slate-600">{t}</label>
      <input type="number" step="any" value={b[k]} onChange={e => setB({ ...b, [k]: e.target.value })} className={`${input} w-28`} /></div>)}
      <button disabled={busy || !b.rate} className={btn} onClick={() => onBid(Object.fromEntries(Object.entries(b).filter(([, v]) => v !== '')))}>{l.myRate ? 'Change rate' : 'Save rate'}</button></div>}
  </div>;
}

// ---------------------------------------------------------------- REQ-TAL-014

export function PortalFreeTrucks({ busy, run }: { busy: boolean; run: Run }) {
  const posts = useLoad<any[]>(`${P}/free-trucks`, []);
  const offers = useLoad<any[]>(`${P}/free-truck-offers`, []);
  const [f, setF] = useState<Record<string, string>>({ kind: 'RETURN', vehicleType: 'REEFER_TRUCK', availableFrom: localInput(new Date()), availableTo: localInput(new Date(Date.now() + 2 * 86400000)) });
  const act = async (what: string, fn: () => Promise<any>) => { await run(what, fn); await Promise.all([posts.reload(), offers.reload()]); };
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const fields: [string, string, string?][] = [['vehicleNumber', 'Truck number'], ['capacityTons', 'Capacity (t)', 'number'], ['tempMinC', 'Lowest °C', 'number'], ['tempMaxC', 'Highest °C', 'number'],
    ['availableCity', 'Free at (city)'], ['destinationCity', f.kind === 'RETURN' ? 'Going back to' : 'Wants to go to (optional)'], ['availableFrom', 'Free from', 'datetime-local'], ['availableTo', 'Free till', 'datetime-local'],
    ['expectedRate', 'Your rate ₹ (optional)', 'number'], ['note', 'Note']];
  return <>
    <Card title="Loads offered to your free trucks">
      {offers.err && <p className="text-sm text-red-700">{offers.err}</p>}
      <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Offer</th><th className={th}>Load</th><th className={`${th} text-right`}>Freight</th><th className={th}>Your answer</th><th className={th}></th></tr></thead>
        <tbody>{offers.data.map(o => <tr key={o.id} className="border-t"><td className={td}><b>{o.offerRef}</b><div className="text-xs text-slate-500">{o.matchReason}</div></td>
          <td className={td}><b>{o.originCity} → {o.destinationCity}</b>, {Number(o.loadTons)} t{o.temperature ? `, ${o.temperature}` : ''}<div className="text-xs text-slate-500">Pickup {when(o.pickupAt)} · deliver by {when(o.deliverBy)} · {o.requestNo}</div></td>
          <td className={`${td} text-right font-semibold`}>{rupees(o.offeredAmount)}</td>
          <td className={td}>{o.reply ? `${o.reply.toLowerCase()}${o.quotedAmount ? ` ${rupees(o.quotedAmount)}` : ''}` : String(o.offerStatus || '').toLowerCase()}{o.expiresAt && !o.reply ? <div className="text-xs text-slate-500">answer by {when(o.expiresAt)}</div> : null}</td>
          <td className={td}>{!o.reply && ['SENT', 'INVITED'].includes(o.offerStatus) && <div className="flex flex-wrap gap-1">
            <button disabled={busy} className={btn} onClick={() => void act('accept', () => post(`${P}/free-truck-offers/${o.id}/reply`, { action: 'ACCEPT' }))}>Accept</button>
            <button disabled={busy} className={btnLight} onClick={() => { const a = window.prompt('Your freight for this load (₹):'); if (a) void act('quote', () => post(`${P}/free-truck-offers/${o.id}/reply`, { action: 'QUOTE', amount: a })); }}>Quote</button>
            <button disabled={busy} className={btnRed} onClick={() => void act('decline', () => post(`${P}/free-truck-offers/${o.id}/reply`, { action: 'DECLINE' }))}>Decline</button>
            <div className="w-full text-xs text-slate-500">WhatsApp: {quickReply(o.id)}</div></div>}</td></tr>)}
          {offers.data.length === 0 && <tr><td colSpan={5} className={`${td} text-slate-500`}>No load offered right now.</td></tr>}</tbody></table>
    </Card>
    <Card title="Post a free truck or an empty return">
      <div className="grid gap-3 md:grid-cols-4">
        <div><label className={label}>Kind</label><select value={f.kind} onChange={e => set('kind', e.target.value)} className={input}><option value="RETURN">Going back empty</option><option value="FREE">Free truck</option></select></div>
        <div><label className={label}>Truck type</label><select value={f.vehicleType} onChange={e => set('vehicleType', e.target.value)} className={input}>{VEHICLE_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
        {fields.map(([k, l, ty]) => <div key={k}><label className={label}>{l}</label><input type={ty || 'text'} step="any" value={f[k] || ''} onChange={e => set(k, e.target.value)} className={input} /></div>)}
        <div className="flex items-end"><button disabled={busy} className={btn} onClick={() => void act('post the truck', () => post(`${P}/free-trucks`, Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''))))}>Post</button></div>
      </div>
      <table className="mt-4 w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Post</th><th className={th}>Truck</th><th className={th}>Where</th><th className={th}>When</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>{posts.data.map(p => <tr key={p.id} className="border-t"><td className={td}><b>{p.postNo}</b><div className="text-xs text-slate-500">{p.kind === 'RETURN' ? 'Return' : 'Free'}{p.offers?.length ? ` · ${p.offers.length} offer(s)` : ''}</div></td>
          <td className={td}>{p.vehicleNumber || '-'} · {Number(p.capacityTons)} t</td><td className={td}>{p.availableCity}{p.destinationCity ? ` → ${p.destinationCity}` : ''}</td>
          <td className={td}>{when(p.availableFrom)} to {when(p.availableTo)}</td><td className={td}><span className={badge(p.status)}>{FREE_TRUCK_STATE[p.status] || p.status}</span></td>
          <td className={td}>{p.status === 'OPEN' && <button disabled={busy} className={btnRed} onClick={() => void act('withdraw', () => post(`${P}/free-trucks/${p.id}/withdraw`, { reason: 'Truck no longer free' }))}>Withdraw</button>}</td></tr>)}
          {posts.data.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>Nothing posted.</td></tr>}</tbody></table>
    </Card>
  </>;
}

// ---------------------------------------------------------------- REQ-TAL-015

export function PortalInvoices({ busy, run }: { busy: boolean; run: Run }) {
  const inv = useLoad<any[]>(`${P}/invoices`, []);
  const notes = useLoad<any[]>(`${P}/debit-notes`, []);
  const [file, setFile] = useState<File | null>(null);
  const [eInvoice, setEInvoice] = useState(false);
  const [tripId, setTripId] = useState('');
  const act = async (what: string, fn: () => Promise<any>) => { await run(what, fn); await Promise.all([inv.reload(), notes.reload()]); };
  return <>
    <Card title="Send an invoice">
      <div className="grid gap-3 md:grid-cols-4">
        <div><label className={label}>Kind</label><select value={eInvoice ? 'E' : 'F'} onChange={e => setEInvoice(e.target.value === 'E')} className={input}><option value="F">PDF or photo of the invoice</option><option value="E">E-invoice (JSON from the IRP)</option></select></div>
        <div><label className={label}>File</label><input type="file" accept={eInvoice ? '.json,application/json' : 'application/pdf,image/*'} onChange={e => setFile(e.target.files?.[0] || null)} className={input} /></div>
        <div><label className={label}>Trip id (optional: found from the trip number on the invoice)</label><input type="number" value={tripId} onChange={e => setTripId(e.target.value)} className={input} /></div>
        <div className="flex items-end"><button disabled={busy || !file} className={btn} onClick={() => file && void act('send the invoice', () => apiUpload(`${P}/invoices${eInvoice ? '/e-invoice' : ''}`, { file, tripId }))}>Send</button></div>
      </div>
      <p className="mt-2 text-xs text-slate-500">One invoice per trip. An invoice already sent (same file, same IRN or same invoice number) is marked as a duplicate.</p>
    </Card>
    <Card title="Your invoices">
      {inv.err && <p className="text-sm text-red-700">{inv.err}</p>}
      <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Received</th><th className={th}>Invoice</th><th className={th}>Trip</th><th className={`${th} text-right`}>Total</th><th className={th}>Status</th><th className={th}>Bill</th></tr></thead>
        <tbody>{inv.data.map(i => <tr key={i.id} className="border-t"><td className={td}><b>{i.intakeNo}</b><div className="text-xs text-slate-500">{when(i.createdAt)}</div></td><td className={td}>{i.invoiceNo || '-'}<div className="text-xs text-slate-500">{day(i.invoiceDate)}</div></td>
          <td className={td}>{i.tripNumber || '-'}</td><td className={`${td} text-right`}>{i.totalAmount != null ? rupees(i.totalAmount) : '-'}</td>
          <td className={td}><span className={badge(i.status)}>{INVOICE_STATE[i.status] || i.status}</span>{i.statusReason && <div className="text-xs text-slate-500">{i.statusReason}</div>}</td>
          <td className={td}>{i.billNo || '-'}{i.billStatus ? <div className="text-xs text-slate-500">{i.billStatus}</div> : null}</td></tr>)}
          {inv.data.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>No invoices sent yet.</td></tr>}</tbody></table>
    </Card>
    <Notes rows={notes.data} staff={false} canReview={false} busy={busy} onAction={(id, action, note) => void act(action, () => post(`${P}/debit-notes/${id}/${action}`, { note }))} />
  </>;
}
