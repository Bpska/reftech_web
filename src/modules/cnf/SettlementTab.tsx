/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-005 -- the monthly settlement with the principal: commission on sales (slabs of the contract), handling fees,
// reimbursable costs with their bills, claims the C&F agent bears, and the collections handed over.
// DRAFT -> REVIEWED -> APPROVED (another Manager or an Admin) -> SENT -> ACCEPTED / DISPUTED -> SETTLED. PDF and Excel.
// The principal's login sees a settlement only once it is sent.
import { useCallback, useEffect, useState } from 'react';
import { api, apiOpen, apiUpload } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { ask, day, inr, lastMonth, post, qty, useRunner, when } from './cnf';
import { ExcelButton, Grid, Info, PdfButton, Pill } from './CnfKit';
import type { CnfCtx } from './CnfPage';
import { pq } from './CnfPage';

const COST_TYPES = ['FREIGHT', 'LOADING', 'UNLOADING', 'OCTROI', 'OTHER'];

export function SettlementTab({ ctx }: { ctx: CnfCtx }) {
  const r = useRunner();
  const staff = !ctx.partner;
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [month, setMonth] = useState(lastMonth());
  const load = useCallback(() => api(`/api/cnf/settlements${pq(ctx)}`).then(d => setRows(d.settlements || [])), [ctx.principalId]);
  useEffect(() => { load().catch(x => r.setError(String((x as Error).message))); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/cnf/settlements/${id}`)); if (d) setSel(d); };
  const act = async (path: string, body?: unknown) => {
    const d = await r.run(() => post(path, body));
    if (d) { await load(); const id = d.id || sel?.id; if (id) await open(id); }
  };
  const withNote = (path: string, q: string, key: string) => { const v = ask(q); if (v !== null) act(path, { [key]: v }); };
  const compute = () => act('/api/cnf/settlements/compute', { principalId: ctx.principalId, month });
  const s = sel;
  return <>
    <Banner msg={r.msg} error={r.error} />
    <Section title="Monthly settlements" right={staff && <div className="flex items-end gap-2">
      <div><label className={label}>Month</label><input type="month" className={input} value={month} max={new Date().toISOString().slice(0, 7)} onChange={e => setMonth(e.target.value)} /></div>
      <button className={btn} disabled={r.busy || !month} onClick={compute}>Work out</button>
    </div>}>
      <Grid rows={rows} empty={staff ? 'No settlements yet. Choose a month and press Work out.' : 'No settlement has been sent to you yet.'} onRow={x => open(x.id)} selected={s?.id} cols={[
        { key: 'settlementNo', title: 'Settlement' }, { key: 'periodMonth', title: 'Month', render: x => String(x.periodMonth || '').slice(0, 7) },
        { key: 'salesValue', title: 'Sales', right: true, render: x => inr(x.salesValue) }, { key: 'commission', title: 'Commission', right: true, render: x => inr(x.commission) },
        { key: 'handlingFees', title: 'Fees', right: true, render: x => inr(x.handlingFees) }, { key: 'reimbursable', title: 'Costs', right: true, render: x => inr(x.reimbursable) },
        { key: 'claimsDeducted', title: 'Claims', right: true, render: x => inr(x.claimsDeducted) }, { key: 'dueToCnf', title: 'Due to C&F', right: true, render: x => <b>{inr(x.dueToCnf)}</b> },
        { key: 'netToPrincipal', title: 'Net to principal', right: true, render: x => inr(x.netToPrincipal) },
        { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> }, { key: 'settledRef', title: 'Paid by' }]} />
      {s && <div className="mt-4 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Settlement {s.settlementNo} <Pill s={s.status} /></h3>
          <div className="flex flex-wrap gap-2">
            <PdfButton r={r} path={`/api/cnf/settlements/${s.id}/pdf`} />
            <ExcelButton r={r} path={`/api/cnf/settlements/${s.id}/excel`} file={`${s.settlementNo}.xlsx`} />
            {staff && ['DRAFT', 'DISPUTED'].includes(s.status) && <button className={btnLight} disabled={r.busy} onClick={() => act('/api/cnf/settlements/compute', { contractId: s.contractId, month: String(s.periodMonth).slice(0, 7) })}>Work out again</button>}
            {staff && s.status === 'DRAFT' && <button className={btn} disabled={r.busy} onClick={() => act(`/api/cnf/settlements/${s.id}/review`)}>Mark reviewed</button>}
            {s.canApprove && <button className={btn} disabled={r.busy} onClick={() => act(`/api/cnf/settlements/${s.id}/approve`)}>Approve</button>}
            {staff && s.status === 'APPROVED' && <button className={btn} disabled={r.busy} onClick={() => act(`/api/cnf/settlements/${s.id}/send`)}>Send to the principal</button>}
            {s.canRespond && <button className={btn} disabled={r.busy} onClick={() => withNote(`/api/cnf/settlements/${s.id}/accept`, ctx.partner ? 'Note for accepting (may be empty):' : 'Principal\'s acceptance reference (mail or letter):', 'note')}>Accept</button>}
            {s.canRespond && <button className={btnRed} disabled={r.busy} onClick={() => withNote(`/api/cnf/settlements/${s.id}/dispute`, 'What is wrong with the settlement?', 'note')}>Dispute</button>}
            {ctx.manager && ['REVIEWED', 'APPROVED', 'DISPUTED'].includes(s.status) && <button className={btnLight} disabled={r.busy} onClick={() => withNote(`/api/cnf/settlements/${s.id}/reopen`, 'Reason for reopening:', 'reason')}>Reopen</button>}
            {ctx.manager && s.status === 'ACCEPTED' && <button className={btn} disabled={r.busy} onClick={() => withNote(`/api/cnf/settlements/${s.id}/settle`, 'Payment reference (UTR, cheque or adjustment note):', 'reference')}>Mark settled</button>}
            <button className={btnLight} onClick={() => setSel(null)}>Close view</button>
          </div>
        </div>
        <div className="mt-2"><Info items={[['Principal', s.principalName], ['Contract', s.contractNo], ['Month', String(s.periodMonth || '').slice(0, 7)],
          ['Sales (taxable)', inr(s.salesValue)], ['Sales quantity', qty(s.salesQty)], ['Credit notes', inr(s.creditNoteValue)], ['Commission', inr(s.commission)],
          ['Handling fees', inr(s.handlingFees)], ['Costs to reimburse', inr(s.reimbursable)], ['Claims borne by C&F', inr(s.claimsDeducted)], ['Due to C&F', inr(s.dueToCnf)],
          ['Collections handed over', inr(s.collections)], ['Net to principal', inr(s.netToPrincipal)], ['Worked out', when(s.computedAt)],
          ['Reviewed', s.reviewedByName ? `${s.reviewedByName}, ${when(s.reviewedAt)}` : ''], ['Approved', s.approvedByName ? `${s.approvedByName}, ${when(s.approvedAt)}` : ''],
          ['Sent', s.sentByName ? `${s.sentByName}, ${when(s.sentAt)}` : ''], ['Answer', s.respondedByName ? `${s.responseNote || ''} (${s.respondedByName}, ${when(s.respondedAt)})` : ''],
          ['Settled', s.settledRef ? `${s.settledRef} (${s.settledByName}, ${when(s.settledAt)})` : '']]} /></div>
        <div className="mt-3"><Grid rows={s.lines || []} empty="No lines." cols={[
          { key: 'lineNo', title: '#' }, { key: 'kind', title: 'Kind', render: x => <Pill s={x.kind} /> }, { key: 'description', title: 'Description' },
          { key: 'basis', title: 'Basis', right: true, render: x => qty(x.basis) }, { key: 'rate', title: 'Rate', right: true, render: x => qty(x.rate) },
          { key: 'amount', title: 'Amount', right: true, render: x => inr(x.amount) }]} /></div>
        {(s.costs || []).length > 0 && <div className="mt-3 text-sm">
          <div className="font-semibold">Bills of the costs</div>
          {s.costs.map((k: any) => <div key={k.id}>{day(k.costDate)} {k.costType} {inr(k.amount)} ({k.billRef})
            {k.fileId && <button className="ml-2 text-sky-700 underline" onClick={() => r.run(() => apiOpen(`/api/cnf/costs/${k.id}/bill`))}>see the bill</button>}</div>)}
        </div>}
      </div>}
    </Section>
    {staff && <Costs ctx={ctx} r={r} month={month} />}
  </>;
}

function Costs({ ctx, r, month }: { ctx: CnfCtx; r: ReturnType<typeof useRunner>; month: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ costDate: '', costType: 'FREIGHT', amount: '', billRef: '', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const load = useCallback(() => api(`/api/cnf/costs?month=${month}${pq(ctx, false)}`).then(d => setRows(d.costs || [])), [month, ctx.principalId]);
  useEffect(() => { load().catch(x => r.setError(String((x as Error).message))); }, [load]);
  const add = async () => {
    const d = await r.run(() => post('/api/cnf/costs', { principalId: ctx.principalId, ...f, amount: Number(f.amount) }));
    if (!d) return;
    if (file && d.id) await r.run(() => apiUpload(`/api/cnf/costs/${d.id}/bill`, { file }));
    setF({ costDate: '', costType: 'FREIGHT', amount: '', billRef: '', description: '' }); setFile(null);
    await load();
  };
  const attach = async (id: number, x?: File) => { if (!x) return; const d = await r.run(() => apiUpload(`/api/cnf/costs/${id}/bill`, { file: x })); if (d) await load(); };
  const remove = async (id: number) => { const v = ask('Reason for removing the cost:'); if (v === null) return; const d = await r.run(() => post(`/api/cnf/costs/${id}/remove`, { reason: v })); if (d) await load(); };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));
  return <Section title={`Costs to be reimbursed, ${month}`}>
    <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <div><label className={label}>Date</label><input type="date" className={input} value={f.costDate} onChange={set('costDate')} /></div>
      <div><label className={label}>Kind</label><select className={input} value={f.costType} onChange={set('costType')}>{COST_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
      <div><label className={label}>Amount (₹)</label><input type="number" min="0" step="0.01" className={input} value={f.amount} onChange={set('amount')} /></div>
      <div><label className={label}>Bill no.</label><input className={input} value={f.billRef} onChange={set('billRef')} /></div>
      <div><label className={label}>About</label><input className={input} value={f.description} onChange={set('description')} /></div>
      <div><label className={label}>Copy of the bill</label><input type="file" accept=".pdf,image/*" className="text-sm" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
    </div>
    <button className={btn} disabled={r.busy || !f.costDate || !f.amount} onClick={add}>Add cost</button>
    <div className="mt-3"><Grid rows={rows} empty="No costs in this month." cols={[
      { key: 'costDate', title: 'Date', render: x => day(x.costDate) }, { key: 'costType', title: 'Kind' }, { key: 'amount', title: 'Amount', right: true, render: x => inr(x.amount) },
      { key: 'billRef', title: 'Bill no.' }, { key: 'description', title: 'About' }, { key: 'createdBy', title: 'By' },
      { key: 'settlementNo', title: 'Settlement', render: x => (x.settlementNo ? `${x.settlementNo} (${x.settlementStatus})` : '') },
      { key: 'fileName', title: 'Bill', render: x => (x.fileId
        ? <button className="text-sky-700 underline" onClick={() => r.run(() => apiOpen(`/api/cnf/costs/${x.id}/bill`))}>{x.fileName || 'open'}</button>
        : <input type="file" accept=".pdf,image/*" className="w-44 text-xs" onChange={e => attach(x.id, e.target.files?.[0])} />) },
      { key: 'a', title: '', render: x => <button className={btnRed} onClick={() => remove(x.id)}>Remove</button> }]} /></div>
  </Section>;
}
