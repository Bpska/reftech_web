/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-007 -- Supplier payables and reconciliation. Manager and Admin.
//
// A supplier's invoice is entered as a bill (Received), matched to expenses already entered, approved by a second
// person (Approved), then paid in one or more payments (Part paid, Paid). TDS comes off the bill. Ageing shows what
// is owed to suppliers and transporters; the ledger and the supplier's own statement are reconciled line by line.
//
// Backend: PayablesController (/api/billing/payables/**). Tab in ?tab=.
// Needs database_v2/45_finance_billing_reftech_billing.sql on reftech_billing (lists answer {ready:false,message}).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HandCoins } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, QuickForm, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const BASE = '/api/billing/payables';
const TABS: [string, string][] = [['bills', 'Bills'], ['pay', 'Pay'], ['ageing', 'Ageing'], ['suppliers', 'Suppliers'], ['ledger', 'Ledger'], ['statements', 'Statements']];
const STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Received', APPROVED: 'Approved', PART_PAID: 'Part paid', PAID: 'Paid', ON_HOLD: 'On hold', CANCELLED: 'Cancelled',
  MATCHED: 'Matched', AMOUNT_DIFF: 'Amount differs', UNMATCHED: 'Not matched', IGNORED: 'Ignored', DIFFERENCE: 'Difference', CLOSED: 'Closed',
};
const STATUS_STYLE: Record<string, string> = {
  RECEIVED: 'bg-amber-100 text-amber-800', APPROVED: 'bg-sky-100 text-sky-800', PART_PAID: 'bg-violet-100 text-violet-800', PAID: 'bg-emerald-100 text-emerald-800',
  ON_HOLD: 'bg-orange-100 text-orange-800', CANCELLED: 'bg-slate-200 text-slate-600',
  MATCHED: 'bg-emerald-100 text-emerald-800', AMOUNT_DIFF: 'bg-amber-100 text-amber-800', UNMATCHED: 'bg-red-100 text-red-800', IGNORED: 'bg-slate-200 text-slate-600',
  DIFFERENCE: 'bg-amber-100 text-amber-800', CLOSED: 'bg-slate-200 text-slate-600',
};
const FILTERS: [string, string][] = [['OPEN', 'Open'], ['OVERDUE', 'Overdue'], ['RECEIVED', 'Received'], ['APPROVED', 'Approved'], ['PART_PAID', 'Part paid'], ['PAID', 'Paid'],
  ['ON_HOLD', 'On hold'], ['CANCELLED', 'Cancelled'], ['', 'All']];
const KIND_LABEL: Record<string, string> = { FUEL: 'Fuel', WORKSHOP: 'Workshop', TYRE: 'Tyres', SPARES: 'Spares', RENT: 'Rent', UTILITIES: 'Utilities', SERVICES: 'Services', INSURANCE: 'Insurance', OTHER: 'Other' };
const MODE_LABEL: Record<string, string> = { NEFT: 'NEFT', RTGS: 'RTGS', IMPS: 'IMPS', UPI: 'UPI', CHEQUE: 'Cheque', CASH: 'Cash', CARD: 'Card' };
const LINE_STYLE: Record<string, string> = { MATCHED: 'bg-emerald-50', AMOUNT_DIFF: 'bg-amber-50', UNMATCHED: 'bg-red-50', IGNORED: 'bg-slate-50 text-slate-500' };
const TDS_SECTIONS = ['194C', '194J', '194I', '194Q', '194H'];
const sel = 'rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const rs = (v: unknown) => fmtMoney(v as any);
const day = (v: unknown) => (v ? String(v).slice(0, 10) : '-');
const tag = (s?: string | null) => `inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[String(s)] || 'bg-slate-100 text-slate-700'}`;
const words = (s: unknown) => String(s || '').toLowerCase().replace(/_/g, ' ');
const post = (path: string, body: unknown = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });
const put = (path: string, body: unknown) => api(path, { method: 'PUT', body: JSON.stringify(body) });
/** Asks for a reason; null when the user cancels. */
const ask = (q: string) => { const r = window.prompt(q); return r === null ? null : r.trim(); };

/** Multipart upload with the same base URL and sign-in token as api() (api.ts has no general FormData helper). */
async function upload(path: string, form: FormData) {
  const base = import.meta.env.VITE_API_URL;
  if (!base) throw new Error('VITE_API_URL is not configured');
  const token = localStorage.getItem('reftech_token');
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: form });
  const text = await response.text(); let body: any = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) throw new Error(body.message || `Upload failed (${response.status})`);
  return body;
}

type Ctx = {
  busy: boolean; stamp: number; suppliers: any[]; kinds: string[]; modes: string[]; vehicles: any[];
  run: (a: () => Promise<any>, done: string) => Promise<any>; fail: (x: unknown, f: string) => void; notReady: (m: string) => void;
};

export default function SupplierPayablesPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t[0] === params.get('tab')) ? String(params.get('tab')) : 'bills';
  const [missing, setMissing] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [sup, setSup] = useState<any>({ suppliers: [], kinds: Object.keys(KIND_LABEL), modes: Object.keys(MODE_LABEL) });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState(0);   // bumped after a change so the lists load again

  useEffect(() => { api('/api/admin/vehicles').then(r => setVehicles(Array.isArray(r) ? r : [])).catch(() => setVehicles([])); }, []);
  useEffect(() => {
    api(`${BASE}/summary`).then(r => { if (r?.ready === false) setMissing(r.message || 'The finance tables are not ready.'); else setSummary(r); }).catch(x => setError(errorText(x, 'Could not load the summary')));
    api(`${BASE}/suppliers`).then(r => { if (r?.ready !== false) setSup(r); }).catch(() => undefined);
  }, [stamp]);

  async function run(action: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await action(); setMsg(done); setStamp(s => s + 1); return r ?? true; }
    catch (x) { setError(errorText(x, 'Could not save')); return null; }
    finally { setBusy(false); }
  }
  const ctx: Ctx = {
    busy, stamp, run, suppliers: sup.suppliers || [], kinds: sup.kinds || [], modes: sup.modes || [], vehicles,
    fail: (x, f) => setError(errorText(x, f)), notReady: m => setMissing(m || 'The finance tables are not ready.'),
  };

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><HandCoins className="h-8 w-8 text-sky-700" />Supplier Payables</h1>
    <p className="text-slate-600">Bills from fuel pumps, workshops, tyre dealers, landlords and other suppliers: approval by a second person, payment, ageing and statement checks.</p>
    {missing ? <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">{missing}</div> : <>
      {summary && <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card l="Outstanding" v={rs(summary.outstanding)} />
        <Card l="Overdue" v={rs(summary.overdue)} red={num(summary.overdue) > 0} />
        <Card l="Waiting for approval" v={`${num(summary.awaitingApproval)} bill(s)`} />
        <Card l="On hold" v={`${num(summary.onHold)} bill(s)`} />
        <Card l="Paid this month" v={rs(summary.paidThisMonth)} />
      </div>}
      <div className="mt-3 flex flex-wrap gap-2">{TABS.map(([k, l]) => <button key={k} onClick={() => setParams({ tab: k })} className={k === tab ? btn : btnLight}>{l}</button>)}</div>
      <Banner msg={msg} error={error} />
      {tab === 'bills' && <Bills ctx={ctx} />}
      {tab === 'pay' && <Pay ctx={ctx} />}
      {tab === 'ageing' && <Ageing ctx={ctx} />}
      {tab === 'suppliers' && <Suppliers ctx={ctx} />}
      {tab === 'ledger' && <Ledger ctx={ctx} />}
      {tab === 'statements' && <Statements ctx={ctx} />}
    </>}
  </>;
}

function Card({ l, v, red }: { l: string; v: string; red?: boolean }) {
  return <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-xs text-slate-500">{l}</div><div className={`text-lg font-bold ${red ? 'text-red-700' : ''}`}>{v}</div></div>;
}

/** GET a list; ready=false from the backend shows the "run the script" notice. */
function useList(ctx: Ctx, path: string | null) {
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => {
    if (!path) { setData(null); return; }
    try { const r = await api(path); if (r && r.ready === false) ctx.notReady(r.message); setData(r); } catch (x) { ctx.fail(x, 'Could not load'); }
  }, [path]);
  useEffect(() => { void load(); }, [load, ctx.stamp]);
  return data;
}

function SupplierSelect({ ctx, value, onChange, all, required }: { ctx: Ctx; value: string; onChange: (v: string) => void; all?: string; required?: boolean }) {
  return <select value={value} required={required} onChange={x => onChange(x.target.value)} className={all ? sel : input}>
    <option value="">{all || 'Choose the supplier'}</option>
    {ctx.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}</select>;
}

// ---------------------------------------------------------------- bills

function Bills({ ctx }: { ctx: Ctx }) {
  const [status, setStatus] = useState('OPEN');
  const [supplierId, setSupplierId] = useState('');
  const [editing, setEditing] = useState<any>(null);   // {} = new bill, a bill = change it
  const [viewId, setViewId] = useState(0);
  const q = new URLSearchParams(); if (status) q.set('status', status); if (supplierId) q.set('supplierId', supplierId);
  const data = useList(ctx, `${BASE}/bills?${q}`);
  const rows: any[] = data?.bills || [];
  const path = (b: any) => `${BASE}/bills/${b.id}`;
  function hold(b: any) { const r = ask(`Why put bill ${b.billNo} on hold?`); if (r !== null) void ctx.run(() => post(`${path(b)}/hold`, { reason: r }), 'Put on hold.'); }
  function cancel(b: any) { const r = ask(`Reason for cancelling bill ${b.billNo}:`); if (r !== null) void ctx.run(() => post(`${path(b)}/cancel`, { reason: r }), 'Bill cancelled.'); }
  async function edit(b: any) {
    try { setEditing(await api(path(b))); setViewId(0); } catch (x) { ctx.fail(x, 'Could not open the bill'); }
  }
  return <>
    {editing && <BillForm key={editing.id || 'new'} ctx={ctx} bill={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    {viewId > 0 && <BillView key={viewId} ctx={ctx} id={viewId} onClose={() => setViewId(0)} />}
    <Section title="Supplier bills" right={<div className="flex flex-wrap gap-2">
      <SupplierSelect ctx={ctx} value={supplierId} onChange={setSupplierId} all="All suppliers" />
      <select value={status} onChange={x => setStatus(x.target.value)} className={sel}>{FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <button onClick={() => { setEditing({}); setViewId(0); }} className={btn}>New bill</button></div>}>
      <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Bill</th><th className={th}>Supplier / invoice</th><th className={th}>Due</th><th className={th}>Category</th>
          <th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>GST</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>TDS</th>
          <th className={`${th} text-right`}>Balance</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(b => {
          const s = b.status, gst = num(b.cgstAmount) + num(b.sgstAmount) + num(b.igstAmount);
          const overdue = ['APPROVED', 'PART_PAID'].includes(s) && b.dueDate && String(b.dueDate).slice(0, 10) < today();
          return <tr key={b.id} className={`border-t ${viewId === b.id ? 'bg-sky-50' : ''}`}>
            <td className={td}><div className="font-mono font-bold">{b.billNo}</div><div className="text-xs text-slate-500">Received {day(b.receivedOn)}</div></td>
            <td className={td}>{b.supplierName}<div className="text-xs text-slate-500">Invoice {b.supplierInvoiceNo} of {day(b.invoiceDate)}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ''}</div>
              {b.matchNote && <div className={`text-xs ${String(b.matchNote).startsWith('Matches') ? 'text-emerald-700' : 'text-amber-700'}`}>{b.matchNote}</div>}
              {b.statusReason && <div className="text-xs text-slate-600">Note: {b.statusReason}</div>}</td>
            <td className={`${td} ${overdue ? 'font-semibold text-red-700' : ''}`}>{day(b.dueDate)}</td>
            <td className={td}>{KIND_LABEL[b.category] || b.category}</td>
            <td className={`${td} text-right`}>{rs(b.taxableAmount)}</td><td className={`${td} text-right`}>{rs(gst)}</td><td className={`${td} text-right`}>{rs(b.totalAmount)}</td>
            <td className={`${td} text-right`}>{num(b.tdsAmount) ? rs(b.tdsAmount) : '-'}</td>
            <td className={`${td} text-right font-bold`}>{rs(b.balance)}{num(b.paidAmount) > 0 && <div className="text-xs font-normal text-slate-500">paid {rs(b.paidAmount)}</div>}</td>
            <td className={td}><span className={tag(s)}>{STATUS_LABEL[s] || s}</span></td>
            <td className={`${td} whitespace-nowrap`}><div className="flex flex-wrap gap-1.5">
              <button onClick={() => { setViewId(b.id); setEditing(null); }} className={btnLight}>View</button>
              {['RECEIVED', 'ON_HOLD'].includes(s) && <button disabled={ctx.busy} onClick={() => void edit(b)} className={btnLight}>Edit</button>}
              {s === 'RECEIVED' && (b.canApprove
                ? <button disabled={ctx.busy} onClick={() => void ctx.run(() => post(`${path(b)}/approve`), `Bill ${b.billNo} approved.`)} className={btnLight}>Approve</button>
                : <span className="self-center text-xs text-slate-500">Someone else must approve</span>)}
              {['RECEIVED', 'APPROVED', 'PART_PAID'].includes(s) && <button disabled={ctx.busy} onClick={() => hold(b)} className={btnLight}>Hold</button>}
              {s === 'ON_HOLD' && <button disabled={ctx.busy} onClick={() => void ctx.run(() => post(`${path(b)}/release`), 'Bill released.')} className={btnLight}>Release</button>}
              {!['PAID', 'CANCELLED'].includes(s) && num(b.paidAmount) === 0 && <button disabled={ctx.busy} onClick={() => cancel(b)} className={btnRed}>Cancel</button>}
            </div></td></tr>;
        })}
          {data && rows.length === 0 && <tr><td colSpan={11} className={`${td} text-slate-500`}>No bills.</td></tr>}</tbody></table></div>
    </Section>
  </>;
}

function BillView({ ctx, id, onClose }: { ctx: Ctx; id: number; onClose: () => void }) {
  const [b, setB] = useState<any>(null);
  useEffect(() => { api(`${BASE}/bills/${id}`).then(setB).catch(x => { ctx.fail(x, 'Could not load the bill'); onClose(); }); }, [id, ctx.stamp]);
  if (!b) return null;
  return <Section title={<>{b.billNo} <span className={tag(b.status)}>{STATUS_LABEL[b.status] || b.status}</span></>} right={<button onClick={onClose} className={btnLight}>Close</button>}>
    <div className="grid gap-2 text-sm md:grid-cols-3">
      <div><b>{b.supplierName}</b><div>Invoice <b>{b.supplierInvoiceNo}</b> of {day(b.invoiceDate)}, received {day(b.receivedOn)}, due {day(b.dueDate)}</div>
        <div>{KIND_LABEL[b.category] || b.category}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ''}{b.description ? ` · ${b.description}` : ''}</div></div>
      <div>Taxable {rs(b.taxableAmount)}{num(b.igstAmount) > 0 ? <> · IGST {rs(b.igstAmount)}</> : <> · CGST {rs(b.cgstAmount)} · SGST {rs(b.sgstAmount)}</>}
        <div>Total <b>{rs(b.totalAmount)}</b> · TDS {b.tdsSection || ''} {num(b.tdsRate)} % = {rs(b.tdsAmount)}</div>
        <div>To pay <b>{rs(b.netPayable)}</b> · paid {rs(b.paidAmount)} · balance <b>{rs(b.balance)}</b></div></div>
      <div>Entered by {b.receivedBy}{b.approvedBy && <div>Approved by {b.approvedBy} on {day(b.approvedAt)}</div>}
        {b.statusReason && <div className="text-slate-600">Note: {b.statusReason}</div>}
        {!b.canApprove && b.status === 'RECEIVED' && <div className="text-slate-500">You entered this bill, so someone else must approve it.</div>}</div>
    </div>
    {b.matchNote && <div className={`mt-3 rounded-xl p-2 text-sm ${String(b.matchNote).startsWith('Matches') ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>{b.matchNote}</div>}
    <div className="mt-4 font-semibold">Expenses linked</div>
    <ExpenseTable rows={b.expenses || []} />
    <div className="mt-4 font-semibold">Payments</div>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Payment</th><th className={th}>Paid on</th><th className={`${th} text-right`}>Amount on this bill</th><th className={th}>Paid by</th></tr></thead>
      <tbody>{(b.payments || []).map((p: any) => <tr key={p.id} className={`border-t ${p.reversed ? 'text-slate-400 line-through' : ''}`}>
        <td className={`${td} font-mono`}>{p.paymentNo}</td><td className={td}>{day(p.paidOn)}</td><td className={`${td} text-right`}>{rs(p.amount)}</td>
        <td className={td}>{MODE_LABEL[p.mode] || p.mode}{p.reference ? ` · ${p.reference}` : ''}</td></tr>)}
        {!(b.payments || []).length && <tr><td colSpan={4} className={`${td} text-slate-500`}>No payments.</td></tr>}</tbody></table></div>
    <div className="mt-4 font-semibold">History</div>
    <ul className="mt-1 text-sm">{(b.history || []).map((h: any, i: number) => <li key={i} className="border-t py-1">
      <span className="text-slate-500">{String(h.at || '').slice(0, 16).replace('T', ' ')}</span> · <b>{h.byName}</b> · {words(h.action)}
      {h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus ? ` (${STATUS_LABEL[h.fromStatus] || h.fromStatus} → ${STATUS_LABEL[h.toStatus] || h.toStatus})` : ''}{h.note ? `: ${h.note}` : ''}</li>)}</ul>
  </Section>;
}

function ExpenseTable({ rows, picked, onPick }: { rows: any[]; picked?: Set<number>; onPick?: (id: number, on: boolean) => void }) {
  return <div className="max-h-80 overflow-auto"><table className="w-full text-sm">
    <thead><tr className="bg-slate-50 text-slate-600">{onPick && <th className={th}></th>}<th className={th}>Date</th><th className={th}>Type</th><th className={th}>Vehicle</th>
      <th className={th}>Description</th><th className={th}>Reference</th><th className={`${th} text-right`}>Amount</th></tr></thead>
    <tbody>{rows.map(e => <tr key={e.id} className="border-t">
      {onPick && <td className={td}><input type="checkbox" className="h-4 w-4" checked={picked?.has(Number(e.id)) || false} onChange={x => onPick(Number(e.id), x.target.checked)} /></td>}
      <td className={td}>{day(e.expenseDate)}</td><td className={td}>{words(e.expenseType)}</td><td className={td}>{e.vehicleNumber || '-'}</td>
      <td className={td}>{e.description || ''}</td><td className={td}>{e.referenceNumber || ''}</td><td className={`${td} text-right`}>{rs(e.amount)}</td></tr>)}
      {rows.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No expenses.</td></tr>}</tbody></table></div>;
}

/** New bill, or change a Received / On hold bill. Amounts are worked out as the user types; the server checks them again. */
function BillForm({ ctx, bill, onClose }: { ctx: Ctx; bill: any; onClose: () => void }) {
  const [v, setV] = useState<Record<string, string>>((): Record<string, string> => bill ? {
    supplierId: str(bill.supplierId), supplierInvoiceNo: str(bill.supplierInvoiceNo), invoiceDate: day(bill.invoiceDate), receivedOn: day(bill.receivedOn), dueDate: day(bill.dueDate),
    category: str(bill.category), description: str(bill.description), vehicleId: str(bill.vehicleId), tripId: str(bill.tripId), taxableAmount: str(bill.taxableAmount),
    cgstAmount: str(bill.cgstAmount), sgstAmount: str(bill.sgstAmount), igstAmount: str(bill.igstAmount), totalAmount: str(bill.totalAmount),
    tdsSection: str(bill.tdsSection), tdsRate: str(bill.tdsRate), gstRate: '',
  } : { receivedOn: today(), gstRate: '18' });
  const [gstBy, setGstBy] = useState<'rate' | 'split'>(bill ? 'split' : 'rate');
  const [picked, setPicked] = useState<Set<number>>(() => new Set((bill?.expenses || []).map((e: any) => Number(e.id))));
  const [expFrom, setExpFrom] = useState('');
  const [expTo, setExpTo] = useState('');
  const [free, setFree] = useState<any[]>([]);
  const set = (k: string) => (e: { target: { value: string } }) => setV(o => ({ ...o, [k]: e.target.value }));

  useEffect(() => {
    const q = new URLSearchParams({ onlyFree: 'true' }); if (v.vehicleId) q.set('vehicleId', v.vehicleId); if (expFrom) q.set('from', expFrom); if (expTo) q.set('to', expTo);
    api(`${BASE}/expenses?${q}`).then(r => setFree(r.expenses || [])).catch(x => ctx.fail(x, 'Could not load the expenses'));
  }, [v.vehicleId, expFrom, expTo]);
  // the bill's own expenses are "linked", so the free list leaves them out: add them back
  const expenses = useMemo(() => {
    const own = (bill?.expenses || []) as any[];
    return [...own, ...free.filter(e => !own.some(o => Number(o.id) === Number(e.id)))];
  }, [free, bill]);

  function pickSupplier(id: string) {
    const s = ctx.suppliers.find(x => String(x.id) === id);
    setV(o => ({ ...o, supplierId: id, ...(s ? { tdsSection: str(s.tdsSection), tdsRate: str(s.tdsRate ?? ''), category: o.category || str(s.kind) } : {}) }));
  }
  const supplier = ctx.suppliers.find(x => String(x.id) === v.supplierId);
  const taxable = num(v.taxableAmount);
  const gst = gstBy === 'rate' ? r2(taxable * num(v.gstRate) / 100) : r2(num(v.cgstAmount) + num(v.sgstAmount) + num(v.igstAmount));
  const total = v.totalAmount !== '' && v.totalAmount !== undefined ? num(v.totalAmount) : Math.round(taxable + gst);
  const tds = Math.round(taxable * num(v.tdsRate) / 100);
  const expSum = r2(expenses.filter(e => picked.has(Number(e.id))).reduce((s, e) => s + num(e.amount), 0));
  const diff = r2(total - expSum);

  async function save() {
    const body: Record<string, unknown> = { ...v, expenseIds: [...picked] };
    if (gstBy === 'rate') { delete body.cgstAmount; delete body.sgstAmount; delete body.igstAmount; }
    else delete body.gstRate;
    for (const k of Object.keys(body)) if (body[k] === '') delete body[k];
    const r = await ctx.run(() => bill ? put(`${BASE}/bills/${bill.id}`, body) : post(`${BASE}/bills`, body), bill ? 'Bill changed.' : 'Bill entered.');
    if (r) onClose();
  }
  const box = (k: string, l: string, type = 'text', hint?: string) => <div key={k}><label className={label}>{l}</label>
    <input type={type} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? 0 : undefined} value={v[k] ?? ''} onChange={set(k)} className={input} />
    {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}</div>;

  return <Section title={bill ? `Change bill ${bill.billNo}` : 'New supplier bill'} right={<button onClick={onClose} className={btnLight}>Close</button>}>
    <div className="grid gap-3 md:grid-cols-4">
      <div><label className={label}>Supplier *</label><SupplierSelect ctx={ctx} value={v.supplierId || ''} onChange={pickSupplier} required />
        {supplier && <div className="mt-0.5 text-xs text-slate-500">{supplier.gstin || 'No GSTIN'} · pays in {supplier.paymentTermsDays} days</div>}</div>
      {box('supplierInvoiceNo', 'Supplier invoice no. *')}
      {box('invoiceDate', 'Invoice date *', 'date')}
      {box('receivedOn', 'Received on', 'date')}
      {box('dueDate', 'Due date', 'date', 'Blank = invoice date + payment terms')}
      <div><label className={label}>Category</label><select value={v.category || ''} onChange={set('category')} className={input}><option value="">Supplier's type</option>
        {ctx.kinds.map(k => <option key={k} value={k}>{KIND_LABEL[k] || k}</option>)}</select></div>
      <div><label className={label}>Vehicle</label>{ctx.vehicles.length
        ? <select value={v.vehicleId || ''} onChange={set('vehicleId')} className={input}><option value="">-</option>{ctx.vehicles.map(x => <option key={x.id} value={x.id}>{x.vehicleNumber}</option>)}</select>
        : <input type="number" value={v.vehicleId || ''} onChange={set('vehicleId')} placeholder="Vehicle id" className={input} />}</div>
      {box('description', 'Description')}
    </div>
    <div className="mt-4 font-semibold">Amounts</div>
    <div className="grid gap-3 md:grid-cols-4">
      {box('taxableAmount', 'Taxable amount Rs *', 'number')}
      <div><label className={label}>GST</label><div className="flex gap-3 py-2 text-sm">
        <label className="flex items-center gap-1"><input type="radio" checked={gstBy === 'rate'} onChange={() => setGstBy('rate')} />GST %</label>
        <label className="flex items-center gap-1"><input type="radio" checked={gstBy === 'split'} onChange={() => setGstBy('split')} />CGST / SGST / IGST</label></div></div>
      {gstBy === 'rate' ? box('gstRate', 'GST %', 'number', 'CGST+SGST or IGST is picked from the supplier state') : <>
        {box('cgstAmount', 'CGST Rs', 'number')}{box('sgstAmount', 'SGST Rs', 'number')}{box('igstAmount', 'IGST Rs', 'number')}</>}
      {box('totalAmount', 'Invoice total Rs', 'number', `Blank = taxable + GST, rounded (Rs ${Math.round(taxable + gst).toLocaleString('en-IN')})`)}
      <div><label className={label}>TDS section</label><input list="tds-sections" value={v.tdsSection || ''} onChange={set('tdsSection')} className={input} />
        <datalist id="tds-sections">{TDS_SECTIONS.map(s => <option key={s} value={s} />)}</datalist></div>
      {box('tdsRate', 'TDS %', 'number', supplier ? `Supplier: ${supplier.tdsSection || '-'} ${num(supplier.tdsRate)} %` : undefined)}
    </div>
    <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm md:grid-cols-5">
      <Amount l="Taxable" v={taxable} /><Amount l="GST" v={gst} /><Amount l="Total" v={total} strong /><Amount l="TDS (on taxable, to the rupee)" v={-tds} /><Amount l="To pay" v={total - tds} strong />
    </div>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
      <div className="font-semibold">Link expenses already entered</div>
      <div className="flex flex-wrap items-center gap-2 text-sm">From <input type="date" value={expFrom} onChange={x => setExpFrom(x.target.value)} className={sel} />
        to <input type="date" value={expTo} onChange={x => setExpTo(x.target.value)} className={sel} /><span className="text-xs text-slate-500">blank = last 60 days{v.vehicleId ? ', this vehicle' : ''}</span></div>
    </div>
    <ExpenseTable rows={expenses} picked={picked} onPick={(id, on) => setPicked(p => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; })} />
    {picked.size > 0 && <div className={`mt-2 rounded-xl p-2 text-sm ${Math.abs(diff) <= 1 ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
      {picked.size} expense(s) ticked: {rs(expSum)} · bill total {rs(total)} · {Math.abs(diff) <= 1 ? 'matches' : `bill is ${rs(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'}`}</div>}
    <div className="mt-4 flex gap-2"><button disabled={ctx.busy} onClick={() => void save()} className={btn}>{bill ? 'Save changes' : 'Enter bill'}</button><button onClick={onClose} className={btnLight}>Cancel</button></div>
  </Section>;
}

function Amount({ l, v, strong }: { l: string; v: unknown; strong?: boolean }) {
  return <div><div className="text-xs text-slate-500">{l}</div><div className={strong ? 'text-lg font-bold' : 'font-semibold'}>{rs(v)}</div></div>;
}

// ---------------------------------------------------------------- pay

function Pay({ ctx }: { ctx: Ctx }) {
  const [supplierId, setSupplierId] = useState('');
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [v, setV] = useState<Record<string, string>>({ paidOn: today(), mode: 'NEFT', amount: '', reference: '', note: '' });
  const open = useList(ctx, supplierId ? `${BASE}/bills?supplierId=${supplierId}&status=OPEN` : null);
  const bills: any[] = (open?.bills || []).filter((b: any) => ['APPROVED', 'PART_PAID'].includes(b.status) && num(b.balance) > 0);
  const waiting: any[] = (open?.bills || []).filter((b: any) => ['RECEIVED', 'ON_HOLD'].includes(b.status));
  const pq = new URLSearchParams(); if (supplierId) pq.set('supplierId', supplierId);
  const payments = useList(ctx, `${BASE}/payments?${pq}`);
  const allocated = r2(Object.values(alloc).reduce((s, x) => s + num(x), 0));
  const owed = r2(bills.reduce((s, b) => s + num(b.balance), 0));
  const set = (k: string) => (e: { target: { value: string } }) => setV(o => ({ ...o, [k]: e.target.value }));
  useEffect(() => setAlloc({}), [supplierId]);

  async function pay() {
    const allocations = Object.entries(alloc).filter(([, a]) => num(a) > 0).map(([billId, amount]) => ({ billId: Number(billId), amount }));
    const body: Record<string, unknown> = { ...v, supplierId, amount: v.amount || (allocated > 0 ? String(allocated) : '') };
    if (allocations.length) body.allocations = allocations;
    const r = await ctx.run(() => post(`${BASE}/payments`, body), 'Payment recorded.');
    if (r) { setAlloc({}); setV(o => ({ ...o, amount: '', reference: '', note: '' })); }
  }
  function reverse(p: any) {
    const r = ask(`Reverse payment ${p.paymentNo} of ${rs(p.amount)} to ${p.supplierName}? Reason:`);
    if (r !== null) void ctx.run(() => post(`${BASE}/payments/${p.id}/reverse`, { reason: r }), 'Payment reversed.');
  }
  const amount = v.amount ? num(v.amount) : allocated;
  return <>
    <Section title="Pay a supplier">
      <div className="grid gap-3 md:grid-cols-3"><div><label className={label}>Supplier *</label><SupplierSelect ctx={ctx} value={supplierId} onChange={setSupplierId} /></div></div>
      {supplierId && open && <>
        <p className="mt-3 text-sm text-slate-600">Approved bills not fully paid. Type an amount against a bill, or leave all blank: the payment then goes to the oldest due bills first, and what is left stays as an advance.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Bill</th><th className={th}>Invoice</th><th className={th}>Due</th><th className={`${th} text-right`}>Balance</th><th className={`${th} text-right`}>Pay now</th></tr></thead>
          <tbody>{bills.map(b => <tr key={b.id} className="border-t">
            <td className={`${td} font-mono`}>{b.billNo} <span className={tag(b.status)}>{STATUS_LABEL[b.status]}</span></td><td className={td}>{b.supplierInvoiceNo} of {day(b.invoiceDate)}</td>
            <td className={`${td} ${String(b.dueDate).slice(0, 10) < today() ? 'font-semibold text-red-700' : ''}`}>{day(b.dueDate)}</td>
            <td className={`${td} text-right`}>{rs(b.balance)}</td>
            <td className={`${td} text-right`}><input type="number" step="0.01" min={0} max={num(b.balance)} value={alloc[b.id] ?? ''} placeholder="auto" onChange={x => setAlloc(a => ({ ...a, [b.id]: x.target.value }))}
              className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-right" />
              <button type="button" onClick={() => setAlloc(a => ({ ...a, [b.id]: String(b.balance) }))} className="ml-1 text-xs font-semibold text-sky-700">full</button></td></tr>)}
            {bills.length === 0 && <tr><td colSpan={5} className={`${td} text-slate-500`}>No approved bills to pay. A payment now is kept as an advance.</td></tr>}
            {bills.length > 0 && <tr className="border-t-2 bg-slate-50 font-bold"><td className={td} colSpan={3}>Total</td><td className={`${td} text-right`}>{rs(owed)}</td><td className={`${td} text-right`}>{allocated ? rs(allocated) : 'auto'}</td></tr>}
          </tbody></table></div>
        {waiting.length > 0 && <p className="mt-1 text-xs text-slate-500">{waiting.length} more bill(s) of this supplier are received or on hold and can't be paid until approved.</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div><label className={label}>Amount paid Rs *</label><input type="number" step="0.01" min={0} value={v.amount} onChange={set('amount')} placeholder={allocated ? String(allocated) : ''} className={input} /></div>
          <div><label className={label}>Paid on *</label><input type="date" value={v.paidOn} onChange={set('paidOn')} className={input} /></div>
          <div><label className={label}>Paid by</label><select value={v.mode} onChange={set('mode')} className={input}>{ctx.modes.map(m => <option key={m} value={m}>{MODE_LABEL[m] || m}</option>)}</select></div>
          <div><label className={label}>UTR / cheque no.</label><input value={v.reference} onChange={set('reference')} className={input} /><div className="mt-0.5 text-xs text-slate-500">Needed unless cash</div></div>
          <div><label className={label}>Note</label><input value={v.note} onChange={set('note')} className={input} /></div>
        </div>
        {allocated > 0 && amount > allocated && <p className="mt-2 text-sm text-amber-800">{rs(amount - allocated)} is not against a bill and stays as an advance.</p>}
        {allocated > amount && <p className="mt-2 text-sm text-red-700">The bills add up to more than the amount paid.</p>}
        <button disabled={ctx.busy || amount <= 0} onClick={() => void pay()} className={`${btn} mt-3`}>Record payment of {rs(amount)}</button>
      </>}
    </Section>
    <Section title="Payments">
      <p className="mb-2 text-sm text-slate-600">Newest first{supplierId ? ', this supplier only' : ''}. A wrong payment is reversed with a reason, never deleted.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Payment</th><th className={th}>Paid on</th><th className={th}>Supplier</th><th className={`${th} text-right`}>Amount</th>
          <th className={`${th} text-right`}>On bills</th><th className={th}>Paid by</th><th className={th}>Note</th><th className={th}></th></tr></thead>
        <tbody>{(payments?.payments || []).map((p: any) => <tr key={p.id} className={`border-t ${p.reversed ? 'text-slate-400' : ''}`}>
          <td className={`${td} font-mono ${p.reversed ? 'line-through' : ''}`}>{p.paymentNo}</td><td className={td}>{day(p.paidOn)}</td><td className={td}>{p.supplierName}</td>
          <td className={`${td} text-right font-bold ${p.reversed ? 'line-through' : ''}`}>{rs(p.amount)}</td>
          <td className={`${td} text-right`}>{rs(p.allocated)}{num(p.amount) - num(p.allocated) > 0.005 && <div className="text-xs text-amber-700">advance {rs(num(p.amount) - num(p.allocated))}</div>}</td>
          <td className={td}>{MODE_LABEL[p.mode] || p.mode}{p.reference && <div className="text-xs">{p.reference}</div>}</td>
          <td className={td}>{p.note || ''}{p.reversed && <div className="text-xs text-red-700">Reversed: {p.reversedReason}</div>}<div className="text-xs text-slate-500">{p.paidBy}</div></td>
          <td className={td}>{!p.reversed && <button disabled={ctx.busy} onClick={() => reverse(p)} className={btnRed}>Reverse</button>}</td></tr>)}
          {payments && !(payments.payments || []).length && <tr><td colSpan={8} className={`${td} text-slate-500`}>No payments.</td></tr>}</tbody></table></div>
    </Section>
  </>;
}

// ---------------------------------------------------------------- ageing

const BUCKETS: [string, string][] = [['notDue', 'Not due'], ['d1_30', '1-30 days'], ['d31_60', '31-60'], ['d61_90', '61-90'], ['d90plus', '90+']];

function Ageing({ ctx }: { ctx: Ctx }) {
  const [asOf, setAsOf] = useState(today());
  const data = useList(ctx, `${BASE}/ageing?asOf=${asOf}`);
  const parties: any[] = data?.parties || [], bills: any[] = data?.bills || [], t = data?.totals || {};
  const cell = (x: unknown) => (num(x) ? rs(x) : '-');
  return <>
    <Section title="Ageing of what we owe" right={<div className="flex items-center gap-2 text-sm">As of <input type="date" value={asOf} onChange={x => setAsOf(x.target.value || today())} className={sel} /></div>}>
      <p className="mb-2 text-sm text-slate-600">Days past the due date. Transporter freight bills are included{data && !data.transportersIncluded ? ' once the freight script is run (not yet)' : ''}.
        {data && <> Due in the next 7 days: <b>{rs(data.dueThisWeek)}</b>.</>}</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Type</th><th className={th}>Name</th>{BUCKETS.map(([k, l]) => <th key={k} className={`${th} text-right`}>{l}</th>)}
          <th className={`${th} text-right`}>Opening</th><th className={`${th} text-right`}>Advance (less)</th><th className={`${th} text-right`}>Total</th></tr></thead>
        <tbody>{parties.map(p => <tr key={`${p.type}:${p.id}`} className="border-t">
          <td className={td}>{p.type === 'TRANSPORTER' ? 'Transporter' : 'Supplier'}</td><td className={`${td} font-semibold`}>{p.name}</td>
          {BUCKETS.map(([k]) => <td key={k} className={`${td} text-right ${k !== 'notDue' && num(p[k]) > 0 ? 'text-red-700' : ''}`}>{cell(p[k])}</td>)}
          <td className={`${td} text-right`}>{cell(p.opening)}</td><td className={`${td} text-right`}>{num(p.advance) ? `-${rs(p.advance)}` : '-'}</td><td className={`${td} text-right font-bold`}>{rs(p.total)}</td></tr>)}
          {parties.length > 0 && <tr className="border-t-2 bg-slate-50 font-bold"><td className={td} colSpan={2}>Total</td>{BUCKETS.map(([k]) => <td key={k} className={`${td} text-right`}>{cell(t[k])}</td>)}
            <td className={`${td} text-right`}>{cell(t.opening)}</td><td className={`${td} text-right`}>{num(t.advance) ? `-${rs(t.advance)}` : '-'}</td><td className={`${td} text-right`}>{rs(t.total)}</td></tr>}
          {data && parties.length === 0 && <tr><td colSpan={10} className={`${td} text-slate-500`}>Nothing is owed.</td></tr>}</tbody></table></div>
    </Section>
    <Section title="Open bills by due date">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Type</th><th className={th}>Party</th><th className={th}>Bill</th><th className={th}>Invoice</th><th className={th}>Due</th>
          <th className={`${th} text-right`}>Days overdue</th><th className={`${th} text-right`}>Balance</th><th className={th}>Status</th></tr></thead>
        <tbody>{bills.map(b => <tr key={`${b.type}:${b.id}`} className="border-t">
          <td className={td}>{b.type === 'TRANSPORTER' ? 'Transporter' : 'Supplier'}</td><td className={td}>{b.partyName}</td><td className={`${td} font-mono`}>{b.billNo}</td>
          <td className={td}>{b.invoiceNo} of {day(b.invoiceDate)}</td><td className={td}>{day(b.dueDate)}</td>
          <td className={`${td} text-right ${num(b.daysOverdue) > 0 ? 'font-semibold text-red-700' : 'text-slate-500'}`}>{num(b.daysOverdue) > 0 ? b.daysOverdue : 'not due'}</td>
          <td className={`${td} text-right font-bold`}>{rs(b.balance)}</td><td className={td}><span className={tag(b.status)}>{STATUS_LABEL[b.status] || words(b.status)}</span></td></tr>)}
          {data && bills.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>No open bills.</td></tr>}</tbody></table></div>
    </Section>
  </>;
}

// ---------------------------------------------------------------- suppliers

function Suppliers({ ctx }: { ctx: Ctx }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState('true');
  const [editing, setEditing] = useState<any>(null);   // {} = new
  const p = new URLSearchParams(); if (q.trim()) p.set('q', q.trim()); if (active) p.set('active', active);
  const data = useList(ctx, `${BASE}/suppliers?${p}`);
  const rows: any[] = data?.suppliers || [];
  const kinds: [string, string][] = ctx.kinds.map(k => [k, KIND_LABEL[k] || k]);
  return <Section title="Suppliers" right={<div className="flex flex-wrap gap-2">
    <input value={q} onChange={x => setQ(x.target.value)} placeholder="Search name, code, GSTIN" className={sel} />
    <select value={active} onChange={x => setActive(x.target.value)} className={sel}><option value="true">Active</option><option value="false">Inactive</option><option value="">All</option></select>
    <button onClick={() => setEditing({})} className={btn}>Add supplier</button></div>}>
    {editing && <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
      <div className="mb-2 font-semibold">{editing.id ? `Change ${editing.name}` : 'New supplier'}</div>
      <QuickForm key={editing.id || 'new'} cols={4} busy={ctx.busy} submitText={editing.id ? 'Save supplier' : 'Add supplier'} onCancel={() => setEditing(null)}
        initial={editing.id ? { ...editing, openingAsOf: day(editing.openingAsOf) === '-' ? '' : day(editing.openingAsOf) } : { kind: 'OTHER', paymentTermsDays: 30, tdsRate: 0, active: true }} fields={[
          { name: 'name', label: 'Name', required: true }, { name: 'code', label: 'Code', hint: 'Blank = next SUP number' },
          { name: 'kind', label: 'Type', type: 'select', options: kinds, required: true }, { name: 'gstin', label: 'GSTIN', hint: 'PAN and state are taken from it when blank' },
          { name: 'pan', label: 'PAN' }, { name: 'stateCode', label: 'GST state code', placeholder: 'e.g. 27' },
          { name: 'tdsSection', label: 'TDS section', placeholder: '194C, 194J, 194I ...' }, { name: 'tdsRate', label: 'TDS %', type: 'number', step: '0.01' },
          { name: 'paymentTermsDays', label: 'Pays in (days)', type: 'number', step: '1' }, { name: 'contactName', label: 'Contact person' },
          { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email' },
          { name: 'bankName', label: 'Bank' }, { name: 'bankAccountNumber', label: 'Account no.' }, { name: 'bankIfsc', label: 'IFSC' },
          { name: 'openingBalance', label: 'Opening balance Rs', type: 'number', step: '0.01', hint: 'What we owed before using RefTech' },
          { name: 'openingAsOf', label: 'Opening as of', type: 'date' }, { name: 'address', label: 'Address', type: 'textarea', wide: true },
          { name: 'active', label: 'Active', type: 'checkbox' }]}
        onSubmit={v => ctx.run(() => editing.id ? put(`${BASE}/suppliers/${editing.id}`, v) : post(`${BASE}/suppliers`, v), editing.id ? 'Supplier saved.' : 'Supplier added.').then(r => { if (r) setEditing(null); })} />
    </div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Code</th><th className={th}>Name</th><th className={th}>Type</th><th className={th}>GSTIN / PAN</th><th className={th}>TDS</th>
        <th className={th}>Terms</th><th className={th}>Contact</th><th className={`${th} text-right`}>Outstanding</th><th className={th}></th></tr></thead>
      <tbody>{rows.map(s => <tr key={s.id} className={`border-t ${s.active ? '' : 'text-slate-400'}`}>
        <td className={`${td} font-mono`}>{s.code}</td><td className={`${td} font-semibold`}>{s.name}{!s.active && <span className="ml-1 text-xs font-normal">(inactive)</span>}</td>
        <td className={td}>{KIND_LABEL[s.kind] || s.kind}</td><td className={td}>{s.gstin || '-'}<div className="text-xs text-slate-500">{s.pan || ''}</div></td>
        <td className={td}>{num(s.tdsRate) ? `${s.tdsSection || ''} ${num(s.tdsRate)} %` : '-'}</td><td className={td}>{s.paymentTermsDays} days</td>
        <td className={td}>{s.contactName || ''}<div className="text-xs text-slate-500">{[s.phone, s.email].filter(Boolean).join(' · ')}</div></td>
        <td className={`${td} text-right font-bold`}>{num(s.outstanding) ? rs(s.outstanding) : '-'}</td>
        <td className={td}><button onClick={() => setEditing(s)} className={btnLight}>Edit</button></td></tr>)}
        {data && rows.length === 0 && <tr><td colSpan={9} className={`${td} text-slate-500`}>No suppliers.</td></tr>}</tbody></table></div>
  </Section>;
}

// ---------------------------------------------------------------- ledger

function Ledger({ ctx }: { ctx: Ctx }) {
  const [supplierId, setSupplierId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = new URLSearchParams({ supplierId }); if (from) q.set('from', from); if (to) q.set('to', to);
  const data = useList(ctx, supplierId ? `${BASE}/ledger?${q}` : null);
  const lines: any[] = data?.lines || [];
  return <Section title="Supplier ledger" right={<div className="flex flex-wrap items-center gap-2 text-sm">
    <SupplierSelect ctx={ctx} value={supplierId} onChange={setSupplierId} all="Choose the supplier" />
    From <input type="date" value={from} onChange={x => setFrom(x.target.value)} className={sel} /> to <input type="date" value={to} onChange={x => setTo(x.target.value)} className={sel} /></div>}>
    {!supplierId ? <p className="text-slate-500">Choose a supplier to see the bills, TDS and payments with the running balance we owe.</p> : data && <>
      <p className="mb-2 text-sm text-slate-600">Credit = we owe more (bills); debit = we owe less (payments, TDS taken). A positive balance is owed to the supplier.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Date</th><th className={th}>Kind</th><th className={th}>Reference</th><th className={th}>Description</th>
          <th className={`${th} text-right`}>Debit</th><th className={`${th} text-right`}>Credit</th><th className={`${th} text-right`}>Balance</th></tr></thead>
        <tbody>
          <tr className="border-t bg-slate-50 font-semibold"><td className={td}>{data.from || ''}</td><td className={td} colSpan={5}>Opening balance</td><td className={`${td} text-right`}>{rs(data.opening)}</td></tr>
          {lines.map((l, i) => <tr key={i} className="border-t"><td className={td}>{day(l.date)}</td><td className={td}>{words(l.kind)}</td><td className={td}>{l.reference}</td><td className={td}>{l.description}</td>
            <td className={`${td} text-right`}>{num(l.debit) ? rs(l.debit) : ''}</td><td className={`${td} text-right`}>{num(l.credit) ? rs(l.credit) : ''}</td><td className={`${td} text-right`}>{rs(l.balance)}</td></tr>)}
          {lines.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>Nothing in this period.</td></tr>}
          <tr className="border-t-2 bg-slate-50 font-bold"><td className={td}>{data.to}</td><td className={td} colSpan={5}>Closing balance</td><td className={`${td} text-right`}>{rs(data.closing)}</td></tr>
        </tbody></table></div>
    </>}
  </Section>;
}

// ---------------------------------------------------------------- statements

function Statements({ ctx }: { ctx: Ctx }) {
  const [supplierId, setSupplierId] = useState('');
  const [openId, setOpenId] = useState(0);
  const [up, setUp] = useState<Record<string, string>>({ supplierId: '', from: '', to: '', theirClosing: '' });
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const q = new URLSearchParams(); if (supplierId) q.set('supplierId', supplierId);
  const data = useList(ctx, `${BASE}/statements?${q}`);
  const rows: any[] = data?.statements || [];
  const set = (k: string) => (e: { target: { value: string } }) => setUp(o => ({ ...o, [k]: e.target.value }));
  async function send() {
    if (!file) return;
    const f = new FormData();
    f.append('file', file); f.append('supplierId', up.supplierId); f.append('from', up.from); f.append('to', up.to);
    if (up.theirClosing) f.append('theirClosing', up.theirClosing);
    const r = await ctx.run(() => upload(`${BASE}/statements`, f), 'Statement uploaded and matched.');
    if (r?.id) { setOpenId(r.id); setFile(null); setFileKey(k => k + 1); }
  }
  return <>
    <Section title="Upload a supplier statement">
      <p className="mb-2 text-sm text-slate-600">CSV or Excel with columns Date, Reference, Description, Debit and Credit (their debit = their invoice to us, their credit = our payment). Lines are matched to our bills by invoice number and to our payments by UTR or amount and date.</p>
      <div className="grid gap-3 md:grid-cols-5">
        <div><label className={label}>Supplier *</label><SupplierSelect ctx={ctx} value={up.supplierId} onChange={x => setUp(o => ({ ...o, supplierId: x }))} /></div>
        <div><label className={label}>From *</label><input type="date" value={up.from} onChange={set('from')} className={input} /></div>
        <div><label className={label}>To *</label><input type="date" value={up.to} onChange={set('to')} className={input} /></div>
        <div><label className={label}>Their closing balance Rs</label><input type="number" step="0.01" value={up.theirClosing} onChange={set('theirClosing')} className={input} /></div>
        <div><label className={label}>File *</label><input key={fileKey} type="file" accept=".csv,.xlsx,.xls" onChange={x => setFile(x.target.files?.[0] || null)} className="w-full text-sm" /></div>
      </div>
      <button disabled={ctx.busy || !file || !up.supplierId || !up.from || !up.to} onClick={() => void send()} className={`${btn} mt-3`}>Upload and match</button>
    </Section>
    {openId > 0 && <StatementView key={openId} ctx={ctx} id={openId} onClose={() => setOpenId(0)} />}
    <Section title="Statements" right={<SupplierSelect ctx={ctx} value={supplierId} onChange={setSupplierId} all="All suppliers" />}>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Supplier</th><th className={th}>Period</th><th className={`${th} text-right`}>Their closing</th><th className={`${th} text-right`}>Our closing</th>
          <th className={`${th} text-right`}>Open lines</th><th className={th}>Status</th><th className={th}>File</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(s => <tr key={s.id} className={`border-t ${openId === s.id ? 'bg-sky-50' : ''}`}>
          <td className={`${td} font-semibold`}>{s.supplierName}</td><td className={td}>{day(s.from)} to {day(s.to)}</td>
          <td className={`${td} text-right`}>{rs(s.theirClosing)}</td><td className={`${td} text-right`}>{rs(s.ourClosing)}</td>
          <td className={`${td} text-right ${num(s.openLines) ? 'font-bold text-red-700' : ''}`}>{num(s.openLines) || '-'}</td>
          <td className={td}><span className={tag(s.status)}>{STATUS_LABEL[s.status] || s.status}</span></td>
          <td className={td}>{s.fileName}<div className="text-xs text-slate-500">{s.createdBy} · {day(s.createdAt)}</div></td>
          <td className={td}><button onClick={() => setOpenId(s.id)} className={btnLight}>Open</button></td></tr>)}
          {data && rows.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>No statements uploaded.</td></tr>}</tbody></table></div>
    </Section>
  </>;
}

function StatementView({ ctx, id, onClose }: { ctx: Ctx; id: number; onClose: () => void }) {
  const [st, setSt] = useState<any>(null);
  const [matching, setMatching] = useState(0);   // line being matched
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { api(`${BASE}/statements/${id}`).then(setSt).catch(x => { ctx.fail(x, 'Could not load the statement'); onClose(); }); }, [id]);
  if (!st) return null;
  const closed = st.status === 'CLOSED';
  const missing: any[] = st.missingOnTheirSide || [];
  const line = (lineId: number, body: Record<string, unknown>, done: string) => ctx.run(() => post(`${BASE}/statements/lines/${lineId}`, body), done).then(r => { if (r?.id) setSt(r); return r; });
  function ignore(l: any) { const r = ask('Why ignore this line?'); if (r !== null) void line(l.id, { action: 'IGNORE', note: r }, 'Line ignored.'); }
  function match(l: any) {
    const [kind, mid] = target.split(':');
    if (!kind) return;
    void line(l.id, { action: 'MATCH', kind, id: Number(mid) }, 'Line matched.').then(r => { if (r) { setMatching(0); setTarget(''); } });
  }
  async function close() {
    const r = await ctx.run(() => post(`${BASE}/statements/${id}/close`, { note }), 'Statement closed.');
    if (r?.id) setSt(r);
  }
  return <Section title={<>{st.supplierName}: {day(st.from)} to {day(st.to)} <span className={tag(st.status)}>{STATUS_LABEL[st.status] || st.status}</span></>} right={<button onClick={onClose} className={btnLight}>Close</button>}>
    <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm md:grid-cols-4">
      <Amount l="Their closing balance" v={st.theirClosing} /><Amount l="Our closing balance" v={st.ourClosing} />
      <div><div className="text-xs text-slate-500">Difference</div><div className={`text-lg font-bold ${st.difference != null && Math.abs(num(st.difference)) > 1 ? 'text-red-700' : ''}`}>{st.difference == null ? 'their closing not given' : rs(st.difference)}</div></div>
      <div><div className="text-xs text-slate-500">File</div><div>{st.fileName}</div>{closed && <div className="text-xs">Closed by {st.closedBy} on {day(st.closedAt)}</div>}</div>
    </div>
    {st.note && <p className="mt-2 text-sm">Note: {st.note}</p>}
    <div className="mt-4 font-semibold">Their lines</div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Date</th><th className={th}>Reference</th><th className={th}>Description</th><th className={`${th} text-right`}>Debit (their bill)</th>
        <th className={`${th} text-right`}>Credit (our payment)</th><th className={th}>Match</th><th className={th}></th></tr></thead>
      <tbody>{(st.lines || []).map((l: any) => {
        const wantKind = num(l.debit) > 0 ? 'BILL' : 'PAYMENT';
        return <tr key={l.id} className={`border-t ${LINE_STYLE[l.matchStatus] || ''}`}>
          <td className={td}>{day(l.date)}</td><td className={td}>{l.reference || ''}</td><td className={td}>{l.description || ''}</td>
          <td className={`${td} text-right`}>{num(l.debit) ? rs(l.debit) : ''}</td><td className={`${td} text-right`}>{num(l.credit) ? rs(l.credit) : ''}</td>
          <td className={td}><span className={tag(l.matchStatus)}>{STATUS_LABEL[l.matchStatus] || l.matchStatus}</span>
            {l.matchedKind && <div className="text-xs">our {words(l.matchedKind)} #{l.matchedId}: {rs(l.ourAmount)}</div>}{l.note && <div className="text-xs text-slate-600">{l.note}</div>}</td>
          <td className={`${td} whitespace-nowrap`}>{!closed && (matching === l.id
            ? <div className="flex flex-wrap gap-1.5"><select value={target} onChange={x => setTarget(x.target.value)} className={sel}><option value="">Pick ours ...</option>
              {missing.filter(m => m.kind === wantKind).concat(missing.filter(m => m.kind !== wantKind)).map(m => <option key={`${m.kind}:${m.id}`} value={`${m.kind}:${m.id}`}>
                {m.kind === 'BILL' ? 'Bill' : 'Payment'} {m.reference} · {day(m.date)} · {rs(m.kind === 'BILL' ? m.credit : m.debit)}</option>)}</select>
              <button disabled={ctx.busy || !target} onClick={() => match(l)} className={btnLight}>Match</button><button onClick={() => setMatching(0)} className={btnLight}>Cancel</button></div>
            : <div className="flex gap-1.5">
              {['UNMATCHED', 'AMOUNT_DIFF'].includes(l.matchStatus) && <button disabled={ctx.busy} onClick={() => { setMatching(l.id); setTarget(''); }} className={btnLight}>Match</button>}
              {l.matchStatus !== 'IGNORED' && <button disabled={ctx.busy} onClick={() => ignore(l)} className={btnLight}>Ignore</button>}
              {l.matchStatus !== 'UNMATCHED' && <button disabled={ctx.busy} onClick={() => void line(l.id, { action: 'UNMATCH' }, 'Line unmatched.')} className={btnLight}>Unmatch</button>}</div>)}</td></tr>;
      })}</tbody></table></div>
    <div className="mt-4 font-semibold">Missing on their side</div>
    <p className="text-sm text-slate-600">Our bills and payments in the period that no line of their statement matches.</p>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Date</th><th className={th}>Kind</th><th className={th}>Reference</th><th className={th}>Description</th><th className={`${th} text-right`}>Amount</th></tr></thead>
      <tbody>{missing.map(m => <tr key={`${m.kind}:${m.id}`} className="border-t"><td className={td}>{day(m.date)}</td><td className={td}>{m.kind === 'BILL' ? 'Our bill' : 'Our payment'}</td>
        <td className={td}>{m.reference}</td><td className={td}>{m.description}</td><td className={`${td} text-right`}>{rs(m.kind === 'BILL' ? m.credit : m.debit)}</td></tr>)}
        {missing.length === 0 && <tr><td colSpan={5} className={`${td} text-slate-500`}>Nothing missing.</td></tr>}</tbody></table></div>
    {!closed && <div className="mt-4 flex flex-wrap items-end gap-2">
      <div className="min-w-[300px] flex-1"><label className={label}>Note for closing {st.status === 'DIFFERENCE' && <span className="text-red-600">* (explain the differences)</span>}</label>
        <input value={note} onChange={x => setNote(x.target.value)} className={input} /></div>
      <button disabled={ctx.busy} onClick={() => void close()} className={btn}>Close statement</button></div>}
  </Section>;
}
