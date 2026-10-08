/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-007 -- distributor returns: request against an invoice -> the principal approves -> the depot receives the
// goods (Warehouse > Returns: pallets ON HOLD, graded there) -> claim (who bears the loss) -> the principal accepts ->
// credit note in the invoice's name and series (PDF), which lowers what the distributor owes and the settlement.
// When the principal invoices itself the request names the principal's invoice and the credit note is the
// principal's own, recorded here (PrincipalReturn.tsx).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { ask, day, inr, post, principalNumberPending, qty, useRunner, when } from './cnf';
import { Grid, Info, PdfButton, Pill } from './CnfKit';
import type { CnfCtx } from './CnfPage';
import { pq } from './CnfPage';
import { NewPrincipalReturn, PrincipalNoteForm } from './PrincipalReturn';

export function ReturnsTab({ ctx }: { ctx: CnfCtx }) {
  const r = useRunner();
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [making, setMaking] = useState(false);
  const [depot, setDepot] = useState('');
  const load = useCallback(() => api(`/api/cnf/returns?status=${status}${pq(ctx, false)}`).then(d => setRows(d.returns || [])), [status, ctx.principalId]);
  useEffect(() => { load().catch(x => r.setError(String((x as Error).message))); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/cnf/returns/${id}`)); if (d) { setSel(d); setDepot(''); } };
  const act = async (path: string, body?: unknown) => { const d = await r.run(() => post(path, body)); if (d) { await load(); if (d.id) setSel(d); } };
  const withNote = async (path: string, q: string, key = 'note') => { const v = ask(q); if (v !== null) await act(path, { [key]: v }); };
  const writer = !ctx.partner || ctx.canWrite;
  const decider = ctx.partner ? ctx.canWrite : ctx.manager;
  const claim = sel?.claims?.find((c: any) => c.status !== 'REJECTED');
  return <>
    <Banner msg={r.msg} error={r.error} />
    <Section title="Returns and claims" right={<div className="flex gap-2">
      <select className={`${input} w-40`} value={status} onChange={e => setStatus(e.target.value)}>
        {['OPEN', 'ALL', 'REQUESTED', 'APPROVED', 'RECEIVED', 'GRADED', 'CLAIMED', 'CREDITED', 'REJECTED', 'CLOSED'].map(s => <option key={s} value={s}>{s === 'OPEN' ? 'Open' : s === 'ALL' ? 'All' : s}</option>)}</select>
      {writer && <button className={btn} onClick={() => { setSel(null); setMaking(true); }}>New return request</button>}
    </div>}>
      {making && <NewReturn ctx={ctx} r={r} done={async d => { setMaking(false); await load(); if (d) setSel(d); }} />}
      <Grid rows={rows} empty="No returns." onRow={x => open(x.id)} selected={sel?.id} cols={[
        { key: 'returnNo', title: 'Return' }, { key: 'createdAt', title: 'Asked', render: x => day(x.createdAt) }, { key: 'distributorName', title: 'Distributor' },
        { key: 'invoiceNo', title: 'Invoice' }, { key: 'reason', title: 'Reason' }, { key: 'requestedValue', title: 'Value', right: true, render: x => inr(x.requestedValue) },
        { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> }, { key: 'claimNo', title: 'Claim', render: x => (x.claimNo ? `${x.claimNo} (${x.claimStatus})` : '') },
        { key: 'creditNoteNo', title: 'Credit note' }]} />
      {sel && <div className="mt-4 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Return {sel.returnNo} <Pill s={sel.status} /></h3>
          <div className="flex flex-wrap gap-2">
            {sel.canDecide && <button className={btn} onClick={() => withNote(`/api/cnf/returns/${sel.id}/approve`, ctx.partner ? 'Note for the approval:' : 'Principal\'s approval reference (mail or letter):')}>Approve</button>}
            {sel.canDecide && <button className={btnRed} onClick={() => withNote(`/api/cnf/returns/${sel.id}/reject`, 'Reason for rejecting the return:')}>Reject</button>}
            {!ctx.partner && sel.status === 'APPROVED' && sel.reason !== 'SHORTAGE' && <>
              {sel.depots?.length > 1 && <select className={`${input} w-44`} value={depot} onChange={e => setDepot(e.target.value)}><option value="">Depot…</option>
                {sel.depots.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
              <button className={btn} disabled={sel.depots?.length > 1 && !depot} onClick={() => act(`/api/cnf/returns/${sel.id}/receive`, { vehicleNumber: ask('Truck number that brought the goods back (may be empty):') || null, warehouseId: depot || null })}>Receive at the depot</button></>}
            {!ctx.partner && ((sel.status === 'GRADED') || (sel.status === 'APPROVED' && sel.reason === 'SHORTAGE')) && <ClaimButton sel={sel} act={act} />}
            {decider && claim?.status === 'OPEN' && <button className={btn} onClick={() => withNote(`/api/cnf/claims/${claim.id}/accept`, ctx.partner ? 'Note for accepting the claim:' : 'Principal\'s acceptance reference:')}>Accept claim</button>}
            {decider && claim?.status === 'OPEN' && <button className={btnRed} onClick={() => withNote(`/api/cnf/claims/${claim.id}/reject`, 'Reason for rejecting the claim:')}>Reject claim</button>}
            {sel.principalInvoice && sel.canRecordPrincipalNote && claim?.status === 'ACCEPTED' && <PrincipalNoteForm claimId={claim.id} act={act} />}
            {!ctx.partner && !sel.principalInvoice && claim?.status === 'ACCEPTED' && <button className={btn} onClick={() => act(`/api/cnf/claims/${claim.id}/credit-note`)}>Issue credit note</button>}
            {!ctx.partner && !['CLOSED', 'REJECTED'].includes(sel.status) && <button className={btnLight} onClick={() => withNote(`/api/cnf/returns/${sel.id}/close`, 'Reason for closing (may be empty when credited):', 'reason')}>Close</button>}
            <button className={btnLight} onClick={() => setSel(null)}>Close view</button>
          </div>
        </div>
        <Info items={[['Distributor', sel.distributorName], ['Invoice', sel.invoiceText || sel.invoiceNo], ...(sel.challanNo ? [['Challan', sel.challanNo] as [string, string]] : []), ['Reason', `${sel.reason}: ${sel.reasonNote || ''}`], ['Value asked', inr(sel.requestedValue)],
          ['Asked by', `${sel.createdByName || ''}${sel.createdByPartner ? ' (principal)' : ''}`], ['Decided', sel.decidedByName ? `${sel.decidedByName}: ${sel.decisionNote || ''}` : ''],
          ['Received', when(sel.receivedAt)], ['Graded', when(sel.gradedAt)]]} />
        {sel.status === 'RECEIVED' && !ctx.partner && <div className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">The pallets are ON HOLD. Grade them on <Link className="font-semibold underline" to="/warehouse/returns">Warehouse &gt; Returns &amp; Disposal</Link> ({sel.warehouseReturn?.returnNo}); the grade comes back here.</div>}
        <div className="mt-3"><Grid rows={sel.lines || []} empty="" cols={[{ key: 'productName', title: 'Product' }, { key: 'batchNo', title: 'Batch' },
          { key: 'quantity', title: 'Asked', right: true, render: x => qty(x.quantity) }, { key: 'acceptedQty', title: 'Accepted', right: true, render: x => qty(x.acceptedQty) },
          { key: 'unitPrice', title: 'Price', right: true, render: x => inr(x.unitPrice) }, { key: 'gstRate', title: 'GST %', right: true }, { key: 'gradeSummary', title: 'Graded' }]} /></div>
        {sel.claims?.length > 0 && <div className="mt-3"><div className={label}>Claims</div><Grid rows={sel.claims} empty="" cols={[{ key: 'claimNo', title: 'Claim' }, { key: 'claimType', title: 'Type' },
          { key: 'amount', title: 'Amount', right: true, render: x => inr(x.amount) }, { key: 'borneBy', title: 'Loss borne by' }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> }, { key: 'note', title: 'Note' }]} /></div>}
        {sel.creditNotes?.length > 0 && <div className="mt-3"><div className={label}>Credit notes</div><Grid rows={sel.creditNotes} empty="" cols={[{ key: 'creditNoteNo', title: 'Number' },
          { key: 'noteDate', title: 'Date', render: x => day(x.noteDate) }, { key: 'totalAmount', title: 'Total', right: true, render: x => inr(x.totalAmount) }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
          { key: 'issuedInNameOf', title: 'Issued by', render: x => (x.issuedInNameOf === 'PRINCIPAL' ? 'The principal' : 'RefTech') },
          { key: 'pdf', title: '', render: x => <div className="flex gap-1"><PdfButton r={r} path={`/api/cnf/credit-notes/${x.id}/pdf`} />
            {sel.canRecordPrincipalNote && x.issuedInNameOf === 'PRINCIPAL' && principalNumberPending(x.creditNoteNo) &&
              <button className={btnLight} onClick={() => withNote(`/api/cnf/credit-notes/${x.id}/principal-number`, 'The principal\'s credit note number:', 'creditNoteNo')}>Type number</button>}</div> }]} /></div>}
      </div>}
    </Section>
  </>;
}

function ClaimButton({ sel, act }: { sel: any; act: (p: string, b?: unknown) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [borneBy, setBorneBy] = useState('PRINCIPAL');
  const [note, setNote] = useState('');
  if (!open) return <button className={btn} onClick={() => setOpen(true)}>Make claim</button>;
  return <div className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
    <select className={`${input} w-48`} value={borneBy} onChange={e => setBorneBy(e.target.value)}>
      <option value="PRINCIPAL">Loss borne by the principal</option><option value="CNF">Borne by us (C&amp;F)</option><option value="TRANSPORTER">Borne by the transporter</option></select>
    <input className={`${input} w-56`} placeholder="Note" value={note} onChange={e => setNote(e.target.value)} />
    <button className={btn} onClick={() => act(`/api/cnf/returns/${sel.id}/claim`, { borneBy, note })}>Make claim</button>
    <button className={btnLight} onClick={() => setOpen(false)}>Cancel</button>
  </div>;
}

function NewReturn({ ctx, r, done }: { ctx: CnfCtx; r: ReturnType<typeof useRunner>; done: (d?: any) => void }) {
  const [sources, setSources] = useState<any>(null);
  useEffect(() => { api(`/api/cnf/returns/principal-sources${pq(ctx)}`).then(setSources).catch(() => setSources({})); }, [ctx.principalId]);
  if (!sources) return <div className="mb-4 text-sm text-slate-500">Loading…</div>;
  if (sources.invoiceIssuer === 'PRINCIPAL') {
    if (!sources.principalReady) return <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">{sources.message || 'Run script 78 first.'} <button className={btnLight} onClick={() => done()}>Close</button></div>;
    return <NewPrincipalReturn ctx={ctx} r={r} sources={sources} done={done} />;
  }
  return <NewInvoiceReturn ctx={ctx} r={r} done={done} />;
}

function NewInvoiceReturn({ ctx, r, done }: { ctx: CnfCtx; r: ReturnType<typeof useRunner>; done: (d?: any) => void }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [lines, setLines] = useState<any[]>([]);
  const [take, setTake] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('DAMAGE');
  const [note, setNote] = useState('');
  useEffect(() => { api(`/api/cnf/invoices?status=ISSUED${pq(ctx, false)}`).then(d => setInvoices(d.invoices || [])).catch(x => r.setError(String((x as Error).message))); }, []);
  useEffect(() => { if (invoiceId) api(`/api/cnf/invoices/${invoiceId}/returnable`).then(d => { setLines(d.lines || []); setTake({}); }).catch(() => {}); else setLines([]); }, [invoiceId]);
  const send = async () => {
    const d = await r.run(() => post('/api/cnf/returns', { invoiceId, reason, reasonNote: note, lines: Object.entries(take).filter(([, q]) => Number(q) > 0).map(([id, q]) => ({ invoiceLineId: Number(id), quantity: q })) }));
    if (d) done(d);
  };
  return <div className="mb-4 rounded-xl border p-3">
    <div className="grid gap-3 md:grid-cols-3">
      <div><label className={label}>Invoice *</label><select className={input} value={invoiceId} onChange={e => setInvoiceId(e.target.value)}><option value="">Choose…</option>
        {invoices.map(i => <option key={i.id} value={i.id}>{i.invoiceNo} {day(i.invoiceDate)} {i.buyerName} {inr(i.total)}</option>)}</select></div>
      <div><label className={label}>Reason *</label><select className={input} value={reason} onChange={e => setReason(e.target.value)}>
        <option value="DAMAGE">Damaged</option><option value="EXPIRY">Expired / short life</option><option value="SHORTAGE">Short received (nothing comes back)</option><option value="OTHER">Other</option></select></div>
      <div><label className={label}>What happened *</label><input className={input} value={note} onChange={e => setNote(e.target.value)} /></div>
    </div>
    {lines.length > 0 && <table className="mt-3 w-full text-sm"><thead className="text-left text-slate-600"><tr><th>Product</th><th>Batch</th><th>Invoiced</th><th>Can return</th><th>Return now</th></tr></thead>
      <tbody>{lines.map(l => <tr key={l.invoiceLineId} className="border-t"><td>{l.description}</td><td>{l.batchNo}</td><td>{qty(l.quantity)}</td><td>{qty(l.returnable)}</td>
        <td><input className={`${input} w-28`} type="number" step="any" min={0} max={l.returnable} value={take[l.invoiceLineId] || ''} onChange={e => setTake({ ...take, [l.invoiceLineId]: e.target.value })} /></td></tr>)}</tbody></table>}
    <div className="mt-2 flex gap-2"><button className={btn} disabled={r.busy || !invoiceId} onClick={send}>Send request</button><button className={btnLight} onClick={() => done()}>Cancel</button></div>
  </div>;
}
