/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-007 -- returns when the principal issues the invoice itself (contract invoice_issuer = PRINCIPAL): the
// request names the principal's invoice (number, date, value) and its lines are picked from a dispatched challan or
// typed. Approval, receipt, grading (Warehouse > Returns) and the claim are as for RefTech's invoices; the credit note
// is the principal's own, recorded here with its number (or "issued by the principal", number to follow).
import { useEffect, useState } from 'react';
import { api } from '@/shared/services/api';
import { btn, btnLight, input, label } from '@/shared/components/FormKit';
import { day, inr, post, principalReturnLines, principalReturnValue, qty, useRunner } from './cnf';
import type { PrincipalLine } from './cnf';
import type { CnfCtx } from './CnfPage';
import { pq } from './CnfPage';

type Runner = ReturnType<typeof useRunner>;

export function NewPrincipalReturn({ ctx, r, sources, done }: { ctx: CnfCtx; r: Runner; sources: any; done: (d?: any) => void }) {
  const [distributors, setDistributors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [distributorId, setDistributorId] = useState('');
  const [challanId, setChallanId] = useState('');
  const [challanLines, setChallanLines] = useState<any[]>([]);
  const [take, setTake] = useState<Record<number, string>>({});
  const [typed, setTyped] = useState<PrincipalLine[]>([]);
  const [head, setHead] = useState({ principalInvoiceNo: '', principalInvoiceDate: '', principalInvoiceValue: '', interState: '' });
  const [reason, setReason] = useState('DAMAGE');
  const [note, setNote] = useState('');
  useEffect(() => {
    api(`/api/cnf/distributors${pq(ctx)}`).then(d => setDistributors(d.distributors || [])).catch(() => {});
    api(`/api/cnf/products${pq(ctx)}`).then(d => setProducts(d.products || [])).catch(() => {});
  }, []);
  const challans = (sources.challans || []).filter((c: any) => !distributorId || String(c.distributorId) === distributorId);
  useEffect(() => {
    setTake({});
    if (!challanId) { setChallanLines([]); return; }
    const c = challans.find((x: any) => String(x.id) === challanId);
    if (c) {
      setDistributorId(String(c.distributorId));
      if (c.principalInvoiceNo && !head.principalInvoiceNo) setHead(h => ({ ...h, principalInvoiceNo: c.principalInvoiceNo }));
    }
    api(`/api/cnf/challans/${challanId}/returnable`).then(d => setChallanLines(d.lines || [])).catch(x => r.setError(String((x as Error).message)));
  }, [challanId]);
  const picked: PrincipalLine[] = challanLines.filter(l => Number(take[l.challanLineId]) > 0)
    .map(l => ({ challanLineId: l.challanLineId, quantity: take[l.challanLineId], unitPrice: String(l.unitPrice ?? ''), gstRate: String(l.gstRate ?? '') }));
  const all = [...picked, ...typed];
  const value = principalReturnValue(all);
  const setLine = (i: number, k: keyof PrincipalLine, v: string) => setTyped(typed.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const send = async () => {
    const body = {
      principalId: ctx.principalId, distributorId: distributorId || null, challanId: challanId || null, ...head,
      interState: head.interState === '' ? null : head.interState === 'true', reason, reasonNote: note,
      // challan lines carry their own price and GST; only the challan line and quantity are sent for them
      lines: principalReturnLines([...picked.map(l => ({ challanLineId: l.challanLineId, quantity: l.quantity })), ...typed]),
    };
    const d = await r.run(() => post('/api/cnf/returns', body));
    if (d) done(d);
  };
  return <div className="mb-4 rounded-xl border p-3">
    <div className="mb-2 text-sm text-slate-600">Contract {sources.contractNo}: the principal issues the invoices. Name the principal's invoice the goods were sold on, then pick the lines from the challan or type them.</div>
    <div className="grid gap-3 md:grid-cols-4">
      <div><label className={label}>Distributor *</label><select className={input} value={distributorId} onChange={e => { setDistributorId(e.target.value); setChallanId(''); }}><option value="">Choose…</option>
        {distributors.map(d => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}</select></div>
      <div><label className={label}>Challan (optional)</label><select className={input} value={challanId} onChange={e => setChallanId(e.target.value)}><option value="">None: type the lines</option>
        {challans.map((c: any) => <option key={c.id} value={c.id}>{c.challanNo} {day(c.challanDate)} {c.distributorName} {c.principalInvoiceNo ? `(inv ${c.principalInvoiceNo})` : ''}</option>)}</select></div>
      <div><label className={label}>Principal's invoice no. *</label><input className={input} maxLength={60} value={head.principalInvoiceNo} onChange={e => setHead({ ...head, principalInvoiceNo: e.target.value })} /></div>
      <div><label className={label}>Invoice date *</label><input className={input} type="date" value={head.principalInvoiceDate} onChange={e => setHead({ ...head, principalInvoiceDate: e.target.value })} /></div>
      <div><label className={label}>Invoice value with GST *</label><input className={input} type="number" step="any" min={0} value={head.principalInvoiceValue} onChange={e => setHead({ ...head, principalInvoiceValue: e.target.value })} /></div>
      <div><label className={label}>GST</label><select className={input} value={head.interState} onChange={e => setHead({ ...head, interState: e.target.value })}>
        <option value="">From the states</option><option value="false">CGST + SGST (same state)</option><option value="true">IGST (another state)</option></select></div>
      <div><label className={label}>Reason *</label><select className={input} value={reason} onChange={e => setReason(e.target.value)}>
        <option value="DAMAGE">Damaged</option><option value="EXPIRY">Expired / short life</option><option value="SHORTAGE">Short received (nothing comes back)</option><option value="OTHER">Other</option></select></div>
      <div><label className={label}>What happened *</label><input className={input} value={note} onChange={e => setNote(e.target.value)} /></div>
    </div>
    {challanLines.length > 0 && <table className="mt-3 w-full text-sm"><thead className="text-left text-slate-600"><tr><th>Product</th><th>Batch</th><th>Sent</th><th>Can return</th><th>Price</th><th>Return now</th></tr></thead>
      <tbody>{challanLines.map(l => <tr key={l.challanLineId} className="border-t"><td>{l.description}</td><td>{l.batchNo}</td><td>{qty(l.quantity)}</td><td>{qty(l.returnable)}</td><td>{inr(l.unitPrice)}</td>
        <td><input className={`${input} w-28`} type="number" step="any" min={0} max={l.returnable} value={take[l.challanLineId] || ''} onChange={e => setTake({ ...take, [l.challanLineId]: e.target.value })} /></td></tr>)}</tbody></table>}
    {typed.length > 0 && <table className="mt-3 w-full text-sm"><thead className="text-left text-slate-600"><tr><th>Product *</th><th>Batch</th><th>Expiry</th><th>Qty *</th><th>Price *</th><th>GST %</th><th /></tr></thead>
      <tbody>{typed.map((l, i) => <tr key={i} className="border-t">
        <td><select className={input} value={l.productId || ''} onChange={e => setLine(i, 'productId', e.target.value)}><option value="">Product…</option>{products.map(p => <option key={p.id} value={p.id}>{p.productCode} {p.name}</option>)}</select></td>
        <td><input className={`${input} w-28`} value={l.batchNo || ''} onChange={e => setLine(i, 'batchNo', e.target.value)} /></td>
        <td><input className={`${input} w-36`} type="date" value={l.expiryDate || ''} onChange={e => setLine(i, 'expiryDate', e.target.value)} /></td>
        <td><input className={`${input} w-24`} type="number" step="any" min={0} value={l.quantity} onChange={e => setLine(i, 'quantity', e.target.value)} /></td>
        <td><input className={`${input} w-24`} type="number" step="any" min={0} value={l.unitPrice || ''} onChange={e => setLine(i, 'unitPrice', e.target.value)} /></td>
        <td><input className={`${input} w-20`} type="number" step="any" min={0} placeholder="contract" value={l.gstRate || ''} onChange={e => setLine(i, 'gstRate', e.target.value)} /></td>
        <td><button className={btnLight} onClick={() => setTyped(typed.filter((_, j) => j !== i))}>Remove</button></td></tr>)}</tbody></table>}
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button className={btnLight} onClick={() => setTyped([...typed, { quantity: '' }])}>Type a line</button>
      <span className="text-sm text-slate-600">Returning about {inr(value)} with GST{head.principalInvoiceValue && value > Number(head.principalInvoiceValue) ? ': more than the invoice value' : ''}</span>
      <button className={btn} disabled={r.busy || !head.principalInvoiceNo || all.length === 0} onClick={send}>Send request</button>
      <button className={btnLight} onClick={() => done()}>Cancel</button>
    </div>
  </div>;
}

/** Records the principal's own credit note for an accepted claim; the number may follow later. */
export function PrincipalNoteForm({ claimId, act }: { claimId: number; act: (p: string, b?: unknown) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [creditNoteNo, setNo] = useState('');
  const [noteDate, setDate] = useState('');
  if (!open) return <button className={btn} onClick={() => setOpen(true)}>Record principal's credit note</button>;
  return <div className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
    <input className={`${input} w-56`} maxLength={60} placeholder="Principal's credit note no. (empty: to follow)" value={creditNoteNo} onChange={e => setNo(e.target.value)} />
    <input className={`${input} w-40`} type="date" value={noteDate} onChange={e => setDate(e.target.value)} />
    <button className={btn} onClick={() => act(`/api/cnf/claims/${claimId}/credit-note`, { creditNoteNo: creditNoteNo || null, noteDate: noteDate || null })}>Record</button>
    <button className={btnLight} onClick={() => setOpen(false)}>Cancel</button>
  </div>;
}
