/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-011 -- Transporter freight bill and settlement: freight booked on trips of hired trucks, advances,
// the transporter's bill checked against trip, contract and proof of delivery (Received -> Checked -> Approved by
// another Admin -> Paid, or On hold / Sent back / Cancelled), payments and the settlement per transporter.
//
// Backend: FreightController (/api/transporters/freight/**). Tab in ?tab=, open bill in ?bill=, new bill in ?newBill=<tripId>
// (&tr=<transporterId> when the trip had a rescue truck of another transporter, REQ-TAL-010).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { BILL_LABEL, FREIGHT_SCRIPT, PAY_MODES, day, role, rupees, scriptMissing, tag } from './transporter';

const BASE = '/api/transporters/freight';
const TABS: [string, string][] = [['bookings', 'Trips of hired trucks'], ['bills', 'Bills'], ['payments', 'Payments'], ['settlement', 'Settlement']];
const CHARGES: [string, string][] = [['freightAmount', 'Freight'], ['detentionAmount', 'Detention'], ['loadingAmount', 'Loading'], ['unloadingAmount', 'Unloading'], ['extraDropAmount', 'Extra drop'], ['otherCharges', 'Other charges']];
const DEDUCTIONS: [string, string][] = [['shortageDeduction', 'Shortage'], ['damageDeduction', 'Damage'], ['temperaturePenalty', 'Temperature penalty'], ['lateDeliveryPenalty', 'Late delivery penalty'], ['otherDeduction', 'Other deduction']];
const CHECK_STYLE: Record<string, string> = { PASS: 'border-emerald-200 bg-emerald-50 text-emerald-900', WARN: 'border-amber-200 bg-amber-50 text-amber-900', FAIL: 'border-red-200 bg-red-50 text-red-900' };
const sel = 'rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm';
const today = () => new Date().toLocaleDateString('en-CA');
const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const modeLabel = (m?: string) => PAY_MODES.find(x => x[0] === m)?.[1] || m || '-';

/** The bill amounts the way FreightService.amounts() works them out: TDS rounded to the rupee. */
function billTotals(v: Record<string, string>, defaultRate: number, advance: number) {
  const charges = CHARGES.reduce((s, [k]) => s + r2(num(v[k])), 0), deductions = DEDUCTIONS.reduce((s, [k]) => s + r2(num(v[k])), 0);
  const bill = r2(charges - deductions);
  const rate = v.tdsRate === '' || v.tdsRate === undefined ? defaultRate : num(v.tdsRate);
  const tds = Math.round(Number((bill * rate / 100).toFixed(6)));
  return { charges, deductions, bill, rate, tds, advance, balance: r2(bill - tds - advance) };
}

export function FreightBillsPage() {
  const me = role();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t[0] === params.get('tab')) ? String(params.get('tab')) : 'bookings';
  const billId = Number(params.get('bill') || 0), newTrip = Number(params.get('newBill') || 0), newTr = Number(params.get('tr') || 0);
  const go = (p: Record<string, string>) => setParams({ tab, ...p });
  const [missing, setMissing] = useState(false);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState(0);   // bumped after a change so the lists load again

  useEffect(() => { if (me.staff) api('/api/transporters').then(r => setTransporters(r.transporters || [])).catch(() => setTransporters([])); }, []);
  const fail = (x: unknown, fallback: string) => { if (scriptMissing(x)) setMissing(true); else setError(errorText(x, fallback)); };
  async function run(action: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await action(); setMsg(r?.message || done); setStamp(s => s + 1); return r ?? true; }
    catch (x) { fail(x, 'Could not save'); return null; }
    finally { setBusy(false); }
  }
  const ctx: Ctx = { me, busy, run, fail, stamp, transporters, setMissing, go, tab };

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Freight Bills</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Receipt className="h-8 w-8 text-sky-700" />Freight Bills</h1>
    <p className="text-slate-600">Freight of hired trucks: advances, the transporter's bill, checks, approval and payment. <Link to="/transporters" className="font-semibold text-sky-700">Transporters</Link> · <Link to="/transporters/contracts" className="font-semibold text-sky-700">Rate contracts</Link></p>
    <div className="mt-3 flex flex-wrap gap-2">{TABS.map(([k, l]) => <button key={k} onClick={() => setParams({ tab: k })} className={k === tab ? btn : btnLight}>{l}</button>)}</div>
    <Banner msg={msg} error={error} />
    {missing ? <NotReady script={FREIGHT_SCRIPT} /> : <>
      {newTrip > 0 && <BillEditor key={`new-${newTrip}-${newTr}`} ctx={ctx} tripId={newTrip} transporterId={newTr || undefined} onClose={() => go({})} onSaved={b => go({ bill: String(b.id) })} />}
      {billId > 0 && <BillDetail key={billId} ctx={ctx} id={billId} />}
      {tab === 'bookings' && <Bookings ctx={ctx} />}
      {tab === 'bills' && <Bills ctx={ctx} />}
      {tab === 'payments' && <Payments ctx={ctx} />}
      {tab === 'settlement' && <Settlement ctx={ctx} />}
    </>}
  </>;
}

type Ctx = {
  me: ReturnType<typeof role>; busy: boolean; run: (a: () => Promise<any>, done: string) => Promise<any>; fail: (x: unknown, f: string) => void;
  stamp: number; transporters: any[]; setMissing: (b: boolean) => void; go: (p: Record<string, string>) => void; tab: string;
};
const post = (path: string, body: unknown = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });

/** GET a list; ready=false from the backend shows the "run script 34" notice. */
function useList(ctx: Ctx, path: string | null) {
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => {
    if (!path) return;
    try { const r = await api(path); if (r && r.ready === false) ctx.setMissing(true); setData(r); } catch (x) { ctx.fail(x, 'Could not load'); }
  }, [path]);
  useEffect(() => { void load(); }, [load, ctx.stamp]);
  return data;
}

function TransporterFilter({ ctx, value, onChange }: { ctx: Ctx; value: string; onChange: (v: string) => void }) {
  return <select value={value} onChange={x => onChange(x.target.value)} className={sel}><option value="">All transporters</option>
    {ctx.transporters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>;
}

// ---------------------------------------------------------------- bookings and advances

function Bookings({ ctx }: { ctx: Ctx }) {
  const [status, setStatus] = useState('BOOKED');
  const [transporterId, setTransporterId] = useState('');
  const [advanceFor, setAdvanceFor] = useState<any>(null);
  const q = new URLSearchParams(); if (status) q.set('status', status); if (transporterId) q.set('transporterId', transporterId);
  const data = useList(ctx, `${BASE}/bookings?${q}`);
  const rows: any[] = data?.bookings || [];
  return <Section title="Trips of hired trucks" right={<div className="flex flex-wrap gap-2">
    <TransporterFilter ctx={ctx} value={transporterId} onChange={setTransporterId} />
    <select value={status} onChange={x => setStatus(x.target.value)} className={sel}><option value="BOOKED">Waiting for bill</option><option value="BILLED">Billed</option><option value="CANCELLED">Cancelled</option><option value="">All</option></select></div>}>
    <p className="mb-2 text-sm text-slate-600">The freight booked when a trip was given to an attached or market truck. Pay advances here; enter the bill when the transporter's invoice comes.</p>
    {advanceFor && <AdvanceForm ctx={ctx} booking={advanceFor} onClose={() => setAdvanceFor(null)} />}
    <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Trip</th><th className={th}>Truck</th><th className={th}>Transporter</th><th className={th}>Rate from</th>
        <th className={`${th} text-right`}>Agreed freight</th><th className={`${th} text-right`}>Advances</th><th className={th}>Bill</th><th className={th}></th></tr></thead>
      <tbody>{rows.map(b => {
        const open = b.status !== 'CANCELLED';
        return <tr key={b.bookingId} className={`border-t ${advanceFor?.tripId === b.tripId ? 'bg-sky-50' : ''}`}>
          <td className={td}><div className="font-mono font-bold">{b.tripNumber}</div>{b.sourceCity} → {b.destinationCity}
            <div className="text-xs text-slate-500">{b.completedAt ? `Completed ${day(b.completedAt)}` : `${b.tripStatus.toLowerCase().replace(/_/g, ' ')} · start ${day(b.plannedStartAt)}`}</div></td>
          <td className={td}>{b.vehicleNumber || '-'}</td><td className={td}>{b.transporterName}</td>
          <td className={td}>{b.source === 'CONTRACT' ? <>Contract <span className="font-mono">{b.contractNo}</span>{b.rate != null && <div className="text-xs text-slate-500">{rupees(b.rate)} {String(b.rateBasis || '').toLowerCase().replace(/_/g, ' ')}</div>}</>
            : <>Agreed by hand{b.note && <div className="text-xs text-slate-500">{b.note}</div>}</>}</td>
          <td className={`${td} text-right font-bold`}>{rupees(b.agreedFreight)}</td><td className={`${td} text-right`}>{num(b.advancePaid) ? rupees(b.advancePaid) : '-'}</td>
          <td className={td}>{b.billId ? <button onClick={() => ctx.go({ bill: String(b.billId) })} className="font-mono font-semibold text-sky-700">{b.billNo}</button> : <span className={tag(b.status)}>{BILL_LABEL[b.status] || b.status}</span>}</td>
          <td className={`${td} whitespace-nowrap`}>{open && <div className="flex gap-2">
            {ctx.me.manager && <button onClick={() => setAdvanceFor(b)} className={btnLight}>Pay advance</button>}
            {!b.billId && b.status === 'BOOKED' && <button onClick={() => ctx.go({ newBill: String(b.tripId), tr: String(b.transporterId) })} className={btnLight}>Enter bill</button>}</div>}</td></tr>;
      })}
        {data && rows.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>No trips.</td></tr>}</tbody></table></div>
  </Section>;
}

function AdvanceForm({ ctx, booking: b, onClose }: { ctx: Ctx; booking: any; onClose: () => void }) {
  const left = num(b.agreedFreight) - num(b.advancePaid);
  return <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
    <div className="mb-2 font-semibold">Advance on trip {b.tripNumber} to {b.transporterName}: agreed {rupees(b.agreedFreight)}, advances so far {rupees(b.advancePaid)}, up to {rupees(left)} more</div>
    <QuickForm cols={4} busy={ctx.busy} submitText="Record advance" onCancel={onClose} initial={{ paidOn: today(), mode: 'NEFT' }} fields={[
      { name: 'amount', label: 'Amount ₹', type: 'number', step: '0.01', required: true }, { name: 'paidOn', label: 'Paid on', type: 'date', required: true },
      { name: 'mode', label: 'Paid by', type: 'select', options: PAY_MODES, required: true }, { name: 'reference', label: 'UTR / cheque / card no.' },
      { name: 'note', label: 'Note (diesel, loading advance ...)', wide: true }]}
      onSubmit={v => ctx.run(() => post(`${BASE}/advances`, { ...v, tripId: b.tripId, transporterId: b.transporterId }), 'Advance recorded.').then(r => { if (r) onClose(); })} />
  </div>;
}

// ---------------------------------------------------------------- bills

function Bills({ ctx }: { ctx: Ctx }) {
  const [status, setStatus] = useState('');
  const [transporterId, setTransporterId] = useState('');
  const q = new URLSearchParams(); if (status) q.set('status', status); if (transporterId) q.set('transporterId', transporterId);
  const data = useList(ctx, `${BASE}/bills?${q}`);
  const unbilled = useList(ctx, `${BASE}/bookings?status=BOOKED`);
  const rows: any[] = data?.bills || [];
  const [trip, setTrip] = useState('');
  return <Section title="Bills" right={<div className="flex flex-wrap gap-2">
    <TransporterFilter ctx={ctx} value={transporterId} onChange={setTransporterId} />
    <select value={status} onChange={x => setStatus(x.target.value)} className={sel}><option value="">All</option>
      {['RECEIVED', 'CHECKED', 'ON_HOLD', 'APPROVED', 'PAID', 'SENT_BACK', 'CANCELLED'].map(s => <option key={s} value={s}>{BILL_LABEL[s]}</option>)}</select>
    <select value={trip} onChange={x => setTrip(x.target.value)} className={sel}><option value="">New bill for trip ...</option>
      {(unbilled?.bookings || []).filter((b: any) => !b.billId).map((b: any) => <option key={b.bookingId} value={`${b.tripId}:${b.transporterId}`}>{b.tripNumber} · {b.transporterName}</option>)}</select>
    <button disabled={!trip} onClick={() => { const [tripId, tr] = trip.split(':'); ctx.go({ newBill: tripId, tr }); }} className={btn}>New bill</button></div>}>
    {data?.counts?.length > 0 && <div className="mb-3 flex flex-wrap gap-2 text-sm">{data.counts.map((c: any) =>
      <button key={c.status} onClick={() => setStatus(c.status)} className="rounded-xl border bg-slate-50 px-3 py-1.5 hover:bg-sky-50"><span className={tag(c.status)}>{BILL_LABEL[c.status] || c.status}</span> <b>{c.n}</b> · {rupees(c.amount)}</button>)}</div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Bill</th><th className={th}>Transporter / invoice</th><th className={th}>Trip</th>
        <th className={`${th} text-right`}>Bill amount</th><th className={`${th} text-right`}>TDS</th><th className={`${th} text-right`}>Advance</th><th className={`${th} text-right`}>Balance to pay</th><th className={th}>Status</th></tr></thead>
      <tbody>{rows.map(b => <tr key={b.id} onClick={() => ctx.go({ bill: String(b.id) })} className="cursor-pointer border-t hover:bg-sky-50">
        <td className={`${td} font-mono font-bold text-sky-800`}>{b.billNo}<div className="font-sans text-xs font-normal text-slate-500">Received {day(b.receivedOn)}</div></td>
        <td className={td}>{b.transporterName}<div className="text-xs text-slate-500">Invoice {b.transporterInvoiceNo} of {day(b.transporterInvoiceDate)}</div></td>
        <td className={td}><span className="font-mono">{b.tripNumber}</span><div className="text-xs text-slate-500">{b.sourceCity} → {b.destinationCity} · {b.vehicleNumber || '-'}</div></td>
        <td className={`${td} text-right`}>{rupees(b.billAmount)}</td><td className={`${td} text-right`}>{rupees(b.tdsAmount)}</td><td className={`${td} text-right`}>{rupees(b.advancePaid)}</td>
        <td className={`${td} text-right font-bold`}>{rupees(b.balancePayable)}</td><td className={td}><span className={tag(b.status)}>{BILL_LABEL[b.status] || b.status}</span></td></tr>)}
        {data && rows.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>No bills.</td></tr>}</tbody></table></div>
  </Section>;
}

/** New bill (tripId) or change a received / on-hold bill (bill). Totals are worked out as the user types. */
function BillEditor({ ctx, tripId, transporterId, bill, onClose, onSaved }: { ctx: Ctx; tripId: number; transporterId?: number; bill?: any; onClose: () => void; onSaved: (b: any) => void }) {
  const tr = transporterId || bill?.transporterId;
  const [form, setForm] = useState<any>(null);
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => {
    api(`${BASE}/bill-form?tripId=${tripId}${tr ? `&transporterId=${tr}` : ''}`).then(f => {
      setForm(f);
      const keys = [...CHARGES, ...DEDUCTIONS].map(x => x[0]).concat(['transporterInvoiceNo', 'transporterInvoiceDate', 'receivedOn', 'otherChargesNote', 'deductionNote', 'tdsRate', 'tdsNote']);
      if (bill) setV(Object.fromEntries(keys.map(k => [k, k.endsWith('Date') || k === 'receivedOn' ? str(bill[k]).slice(0, 10) : str(bill[k])])));
      else setV({ receivedOn: today(), freightAmount: str(f.booking?.agreedFreight), tdsRate: str(f.tds?.rate) });
    }).catch(x => { ctx.fail(x, 'Could not open the bill form'); onClose(); });
  }, [tripId, tr]);
  const defaultRate = num(form?.tds?.rate);
  const advance = num(form?.booking ? form.booking.advancePaid : bill?.advancePaid);   // the backend counts the advances again on save
  const t = useMemo(() => billTotals(v, defaultRate, advance), [v, defaultRate, advance]);
  if (!form) return null;
  const bk = form.booking, lane = form.lane, det = form.detention;
  const set = (k: string) => (e: { target: { value: string } }) => setV(o => ({ ...o, [k]: e.target.value }));
  const rateChanged = v.tdsRate !== '' && num(v.tdsRate) !== defaultRate;
  const hint: Record<string, string | undefined> = {
    freightAmount: bk ? `Agreed ${rupees(bk.agreedFreight)}${bk.contractNo ? ` (contract ${bk.contractNo})` : ' (agreed by hand)'}` : 'No freight was booked for this trip',
    detentionAmount: det?.known ? `Truck waited ${det.hoursAtDelivery} h at delivery${det.allowed != null ? `; contract allows ${rupees(det.allowed)} (${det.freeHours} h free)` : ''}` : undefined,
    loadingAmount: lane?.loading_charge != null ? `Contract: ${rupees(lane.loading_charge)}` : undefined,
    unloadingAmount: lane?.unloading_charge != null ? `Contract: ${rupees(lane.unloading_charge)}` : undefined,
    extraDropAmount: lane?.extra_drop_charge != null ? `Contract: ${rupees(lane.extra_drop_charge)} per drop` : undefined,
  };
  const box = (k: string, l: string, type = 'number') => <div key={k}><label className={label}>{l}</label>
    <input type={type} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? 0 : undefined} value={v[k] ?? ''} onChange={set(k)} className={input} />
    {hint[k] && <div className="mt-0.5 text-xs text-slate-500">{hint[k]}</div>}</div>;
  async function save() {
    const body: Record<string, unknown> = { ...v, tripId, transporterId: form?.transporterId ?? tr };
    if (!rateChanged) delete body.tdsNote;
    const r = await ctx.run(() => bill ? api(`${BASE}/bills/${bill.id}`, { method: 'PUT', body: JSON.stringify(body) }) : post(`${BASE}/bills`, body),
      bill ? 'Bill changed.' : 'Bill entered.');
    if (r) onSaved(r);
  }
  return <Section title={bill ? `Change bill ${bill.billNo}` : `New bill for trip ${bk?.tripNumber || tripId}`} right={<button onClick={onClose} className={btnLight}>Close</button>}>
    {bk && <div className="mb-3 text-sm text-slate-600">{bk.transporterName} · {bk.vehicleNumber} · {bk.sourceCity} → {bk.destinationCity} · agreed freight <b>{rupees(bk.agreedFreight)}</b> · advances paid <b>{rupees(advance)}</b></div>}
    <div className="grid gap-3 md:grid-cols-3">
      {box('transporterInvoiceNo', "Transporter's invoice no. *", 'text')}{box('transporterInvoiceDate', 'Invoice date *', 'date')}
      {bill ? <div><label className={label}>Received on</label><div className="py-2">{day(bill.receivedOn)}</div></div> : box('receivedOn', 'Received on', 'date')}
    </div>
    <div className="mt-4 font-semibold">Charges billed</div>
    <div className="grid gap-3 md:grid-cols-3">{CHARGES.map(([k, l]) => box(k, `${l} ₹${k === 'freightAmount' ? ' *' : ''}`))}
      {num(v.otherCharges) > 0 && box('otherChargesNote', 'What are the other charges for? *', 'text')}</div>
    <div className="mt-4 font-semibold">Deductions by RefTech</div>
    <div className="grid gap-3 md:grid-cols-3">{DEDUCTIONS.map(([k, l]) => box(k, `${l} ₹`))}
      {box('deductionNote', `Why the deductions${num(v.otherDeduction) > 0 ? ' *' : ''}`, 'text')}</div>
    <div className="mt-4 font-semibold">TDS</div>
    <div className="grid gap-3 md:grid-cols-3">
      <div><label className={label}>TDS rate %</label><input type="number" step="0.01" min={0} max={30} value={v.tdsRate ?? ''} onChange={set('tdsRate')} className={input} />
        <div className="mt-0.5 text-xs text-slate-500">Usual: {defaultRate} % · {form.tds?.why}</div></div>
      {rateChanged && <div className="md:col-span-2"><label className={label}>Why another rate? * (e.g. 194C(6) declaration)</label><input value={v.tdsNote ?? ''} onChange={set('tdsNote')} className={input} /></div>}
    </div>
    <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm md:grid-cols-6">
      <Amount l="Charges" v={t.charges} /><Amount l="Deductions" v={-t.deductions} /><Amount l="Bill amount" v={t.bill} strong />
      <Amount l={`TDS ${t.rate} %`} v={-t.tds} /><Amount l="Advances paid" v={-t.advance} /><Amount l="Balance to pay" v={t.balance} strong />
    </div>
    {t.bill < 0 && <Banner error="The deductions are more than the charges." />}
    {t.balance < 0 && t.bill >= 0 && <Banner error={`The advances are more than the bill after TDS: ${rupees(-t.balance)} is to be recovered from the transporter.`} />}
    <div className="mt-4 flex gap-2"><button disabled={ctx.busy} onClick={() => void save()} className={btn}>{bill ? 'Save changes' : 'Enter bill'}</button><button onClick={onClose} className={btnLight}>Cancel</button></div>
  </Section>;
}

function Amount({ l, v, strong }: { l: string; v: unknown; strong?: boolean }) {
  return <div><div className="text-xs text-slate-500">{l}</div><div className={strong ? 'text-lg font-bold' : 'font-semibold'}>{rupees(v)}</div></div>;
}

function BillDetail({ ctx, id }: { ctx: Ctx; id: number }) {
  const { me, busy, run } = ctx;
  const [b, setB] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const load = useCallback(() => api(`${BASE}/bills/${id}`).then(setB).catch(x => ctx.fail(x, 'Could not load the bill')), [id]);
  useEffect(() => { void load(); }, [load, ctx.stamp]);
  if (!b) return null;
  const path = `${BASE}/bills/${id}`;
  const act = (a: () => Promise<any>, done: string) => run(a, done).then(r => { if (r?.id) setB(r); return r; });
  const step = (s: string, q: string, done: string) => { const r = window.prompt(q); if (r !== null) void act(() => post(`${path}/${s}`, { reason: r.trim() }), done); };
  const fails = (b.checks || []).filter((c: any) => c.result === 'FAIL');
  function check() {
    if (fails.length && me.manager) {
      const note = window.prompt(`This bill fails ${fails.length} check(s):\n${fails.map((c: any) => '- ' + c.text).join('\n')}\n\nReason for passing it anyway:`);
      if (note === null) return;
      void act(() => post(`${path}/check`, { overrideNote: note.trim() }), 'Checked.');
    } else void act(() => post(`${path}/check`, {}), 'Checked.');
  }
  if (editing) return <BillEditor ctx={ctx} tripId={b.tripId} bill={b} onClose={() => setEditing(false)} onSaved={r => { setB(r); setEditing(false); }} />;
  const s = b.status;
  return <Section id="bill" title={<>{b.billNo} <span className={tag(s)}>{BILL_LABEL[s] || s}</span></>} right={<div className="flex flex-wrap gap-2">
    {b.canEdit && <button onClick={() => setEditing(true)} className={btnLight}>Change amounts</button>}
    {['RECEIVED', 'ON_HOLD'].includes(s) && <button disabled={busy} onClick={check} className={btn}>{fails.length && me.manager ? 'Check (pass with reason)' : 'Mark checked'}</button>}
    {me.admin && s === 'CHECKED' && <button disabled={busy} onClick={() => void act(() => post(`${path}/approve`), 'Approved for payment.')} className={btn}>Approve</button>}
    {me.admin && s === 'APPROVED' && <button disabled={busy} onClick={() => setPaying(true)} className={btn}>Pay balance</button>}
    {['RECEIVED', 'CHECKED', 'APPROVED'].includes(s) && <button disabled={busy} onClick={() => step('hold', 'Why put the bill on hold?', 'Put on hold.')} className={btnLight}>Hold</button>}
    {s === 'ON_HOLD' && <button disabled={busy} onClick={() => step('release', 'Note for releasing the bill:', 'Released.')} className={btnLight}>Release</button>}
    {['RECEIVED', 'CHECKED', 'ON_HOLD'].includes(s) && <button disabled={busy} onClick={() => step('send-back', 'What must the transporter correct?', 'Sent back to the transporter.')} className={btnRed}>Send back</button>}
    {me.manager && !['PAID', 'CANCELLED'].includes(s) && <button disabled={busy} onClick={() => step('cancel', 'Reason for cancelling the bill:', 'Cancelled.')} className={btnRed}>Cancel bill</button>}
    <button onClick={() => ctx.go({})} className={btnLight}>Close</button></div>}>
    {fails.length > 0 && ['RECEIVED', 'ON_HOLD'].includes(s) && !me.manager && <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This bill fails a check. Correct the amounts, hold it or send it back; only a Manager can pass it with a reason.</div>}
    <div className="grid gap-2 text-sm md:grid-cols-3">
      <div><b>{b.transporterName}</b>{b.transporterPan && <> · PAN {b.transporterPan}</>}<div>Invoice <b>{b.transporterInvoiceNo}</b> of {day(b.transporterInvoiceDate)}, received {day(b.receivedOn)}</div></div>
      <div>Trip <span className="font-mono font-semibold">{b.tripNumber}</span> · {b.sourceCity} → {b.destinationCity} · {b.vehicleNumber || '-'}
        <div>Agreed {rupees(b.agreedFreight)}{b.contractNo ? ` (contract ${b.contractNo})` : b.agreedFreight != null ? ' (agreed by hand)' : ''}</div></div>
      <div>Entered by {b.receivedByName}{b.checkedByName && <div>Checked by {b.checkedByName} on {day(b.checkedAt)}</div>}
        {b.approvedByName && <div>Approved by {b.approvedByName} on {day(b.approvedAt)}</div>}{b.paidAt && <div>Paid on {day(b.paidAt)}</div>}
        {b.statusReason && <div className="text-slate-600">Note: {b.statusReason}</div>}</div>
    </div>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><tbody>
      {CHARGES.map(([k, l]) => num(b[k]) > 0 && <tr key={k} className="border-t"><td className={td}>{l}{k === 'otherCharges' && b.otherChargesNote ? ` (${b.otherChargesNote})` : ''}</td><td className={`${td} text-right`}>{rupees(b[k])}</td></tr>)}
      {DEDUCTIONS.map(([k, l]) => num(b[k]) > 0 && <tr key={k} className="border-t text-red-800"><td className={td}>less {l}</td><td className={`${td} text-right`}>-{rupees(b[k])}</td></tr>)}
      {b.deductionNote && <tr><td colSpan={2} className={`${td} text-xs text-slate-500`}>Deductions: {b.deductionNote}</td></tr>}
      <tr className="border-t font-bold"><td className={td}>Bill amount</td><td className={`${td} text-right`}>{rupees(b.billAmount)}</td></tr>
      <tr className="border-t"><td className={td}>less TDS {num(b.tdsRate)} %<div className="text-xs text-slate-500">{b.tdsNote}</div></td><td className={`${td} text-right`}>-{rupees(b.tdsAmount)}</td></tr>
      <tr className="border-t"><td className={td}>less advances paid</td><td className={`${td} text-right`}>-{rupees(b.advancePaid)}</td></tr>
      <tr className="border-t-2 text-lg font-bold"><td className={td}>Balance to pay</td><td className={`${td} text-right`}>{rupees(b.balancePayable)}</td></tr>
    </tbody></table></div>
    {paying && <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
      <div className="mb-2 font-semibold">Pay the balance of {rupees(b.balancePayable)} to {b.transporterName}</div>
      <QuickForm cols={4} busy={busy} submitText="Record payment" onCancel={() => setPaying(false)} initial={{ paidOn: today(), mode: 'NEFT' }} fields={[
        { name: 'paidOn', label: 'Paid on', type: 'date', required: true }, { name: 'mode', label: 'Paid by', type: 'select', options: PAY_MODES, required: true },
        { name: 'reference', label: 'UTR / cheque no.', hint: 'Needed unless paid in cash' }, { name: 'note', label: 'Note' }]}
        onSubmit={v => act(() => post(`${path}/pay`, v), 'Payment recorded.').then(r => { if (r) setPaying(false); })} />
    </div>}
    <div className="mt-4 font-semibold">Checks {b.checksLive ? <span className="text-xs font-normal text-slate-500">(as of now)</span> : <span className="text-xs font-normal text-slate-500">(as at checking)</span>}</div>
    <div className="mt-1 grid gap-1.5">{(b.checks || []).map((c: any, i: number) => <div key={i} className={`flex gap-2 rounded-lg border px-3 py-1.5 text-sm ${CHECK_STYLE[c.result] || ''}`}>
      <span className={tag(c.result)}>{c.result === 'PASS' ? 'OK' : c.result === 'WARN' ? 'Look' : 'Fails'}</span><span>{c.text}</span></div>)}</div>
    {b.payments?.length > 0 && <><div className="mt-4 font-semibold">Payments</div><PaymentTable ctx={ctx} rows={b.payments} onChanged={() => void load()} /></>}
    <div className="mt-4 font-semibold">History</div>
    <ul className="mt-1 text-sm">{(b.history || []).map((h: any, i: number) => <li key={i} className="border-t py-1">
      <span className="text-slate-500">{day(h.at)}</span> · <b>{h.byName}</b> · {String(h.action).toLowerCase().replace(/_/g, ' ')}{h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus ? ` (${BILL_LABEL[h.fromStatus] || h.fromStatus} → ${BILL_LABEL[h.toStatus] || h.toStatus})` : ''}{h.note ? `: ${h.note}` : ''}</li>)}</ul>
  </Section>;
}

// ---------------------------------------------------------------- payments, settlement

function PaymentTable({ ctx, rows, onChanged }: { ctx: Ctx; rows: any[]; onChanged?: () => void }) {
  function reverse(p: any) {
    const r = window.prompt(`Reverse the ${p.kind === 'ADVANCE' ? 'advance' : 'payment'} of ${rupees(p.amount)} on trip ${p.tripNumber}? Reason:`);
    if (r !== null) void ctx.run(() => post(`${BASE}/payments/${p.id}/reverse`, { reason: r.trim() }), 'Payment reversed.').then(x => { if (x) onChanged?.(); });
  }
  return <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
    <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Paid on</th><th className={th}>Kind</th><th className={th}>Trip</th><th className={th}>Transporter</th>
      <th className={`${th} text-right`}>Amount</th><th className={th}>Paid by</th><th className={th}>Note</th><th className={th}>Entered by</th><th className={th}></th></tr></thead>
    <tbody>{rows.map(p => <tr key={p.id} className={`border-t ${p.reversed ? 'text-slate-400 line-through' : ''}`}>
      <td className={td}>{day(p.paidOn)}</td><td className={td}>{p.kind === 'ADVANCE' ? 'Advance' : 'Bill balance'}{p.billId && <button onClick={() => ctx.go({ bill: String(p.billId) })} className="ml-1 text-xs font-semibold text-sky-700 no-underline">open bill</button>}</td>
      <td className={`${td} font-mono`}>{p.tripNumber}</td><td className={td}>{p.transporterName}</td><td className={`${td} text-right font-bold`}>{rupees(p.amount)}</td>
      <td className={td}>{modeLabel(p.mode)}{p.reference && <div className="text-xs">{p.reference}</div>}</td>
      <td className={td}>{p.note || ''}{p.reversed && <div className="text-xs text-red-700 no-underline">Reversed: {p.reversedReason}</div>}</td><td className={td}>{p.paidByName}</td>
      <td className={td}>{ctx.me.admin && !p.reversed && <button disabled={ctx.busy} onClick={() => reverse(p)} className={btnRed}>Reverse</button>}</td></tr>)}
      {rows.length === 0 && <tr><td colSpan={9} className={`${td} text-slate-500`}>No payments.</td></tr>}</tbody></table></div>;
}

function Payments({ ctx }: { ctx: Ctx }) {
  const rows = useList(ctx, `${BASE}/payments`);
  return <Section title="Payments to transporters"><p className="mb-2 text-sm text-slate-600">Advances and bill balances, newest first. A wrong entry is reversed by an Admin, never deleted.</p>
    {Array.isArray(rows) && <PaymentTable ctx={ctx} rows={rows} />}</Section>;
}

const SETTLE_COLS: [string, string, boolean?][] = [['tripsNotBilled', 'Trips not billed', true], ['freightNotBilled', 'Freight not billed'], ['billsWaiting', 'Bills waiting', true], ['amountWaiting', 'Waiting to pay'],
  ['approvedUnpaid', 'Approved, not paid'], ['paidInPeriod', 'Paid in period'], ['tdsInPeriod', 'TDS in period'], ['advancesNotBilled', 'Advances not yet billed']];

function Settlement({ ctx }: { ctx: Ctx }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = new URLSearchParams(); if (from) q.set('from', from); if (to) q.set('to', to);
  const data = useList(ctx, `${BASE}/settlement?${q}`);
  const rows: any[] = data?.transporters || [];
  const total = (k: string) => rows.reduce((s, r) => s + num(r[k]), 0);
  const cell = (v: unknown, count?: boolean) => count ? (num(v) || '-') : (num(v) ? rupees(v) : '-');
  return <Section title="Settlement by transporter" right={<div className="flex flex-wrap items-center gap-2 text-sm">
    From <input type="date" value={from || data?.from || ''} onChange={x => setFrom(x.target.value)} className={sel} /> to <input type="date" value={to || data?.to || ''} onChange={x => setTo(x.target.value)} className={sel} /></div>}>
    <p className="mb-2 text-sm text-slate-600">"Paid" and "TDS" are for the period ({day(data?.from)} to {day(data?.to)}; TDS by approval date); the other columns are as of today. Paid includes advances.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Transporter</th>{SETTLE_COLS.map(([k, l]) => <th key={k} className={`${th} text-right`}>{l}</th>)}</tr></thead>
      <tbody>{rows.map(r => <tr key={r.transporterId} className="border-t"><td className={`${td} font-semibold`}>{r.transporterName}<div className="text-xs font-normal text-slate-500">PAN {r.pan || 'not recorded'}</div></td>
        {SETTLE_COLS.map(([k, , c]) => <td key={k} className={`${td} text-right`}>{cell(r[k], c)}</td>)}</tr>)}
        {rows.length > 0 && <tr className="border-t-2 bg-slate-50 font-bold"><td className={td}>Total</td>{SETTLE_COLS.map(([k, , c]) => <td key={k} className={`${td} text-right`}>{cell(total(k), c)}</td>)}</tr>}
        {data && rows.length === 0 && <tr><td colSpan={9} className={`${td} text-slate-500`}>No freight booked yet.</td></tr>}</tbody></table></div>
  </Section>;
}
