/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-001 / REQ-CNF-004 -- the C&F contract of a principal (territory, depots, credit approvers, commission slabs,
// fees, portal flags), its distributors with their credit limit and position, and the money received from them.
// A Manager or an Admin changes the contract; staff and the principal's own (writing) logins keep distributors.
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/shared/services/api';
import { Banner, QuickForm, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { FEE_TYPES, SERVICES, ask, day, inr, post, put, useRunner } from './cnf';
import { Grid, Info, Pill } from './CnfKit';
import type { CnfCtx } from './CnfPage';
import { pq } from './CnfPage';

export function ContractsTab({ ctx }: { ctx: CnfCtx }) {
  const r = useRunner();
  const [contract, setContract] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const load = useCallback(async () => {
    const d = await api(`/api/cnf/contracts${pq(ctx)}`);
    const first = (d.contracts || [])[0];
    setContract(first ? await api(`/api/cnf/contracts/${first.id}`) : null);
  }, [ctx.principalId]);
  useEffect(() => { load().catch(x => r.setError(String((x as Error).message))); }, [load]);

  const setStatus = async (status: string) => {
    let reason: string | null = '';
    if (status !== 'ACTIVE') { reason = ask(`Reason to ${status === 'SUSPENDED' ? 'suspend' : 'end'} contract ${contract.contractNo} (at least 5 characters):`); if (reason === null) return; }
    const d = await r.run(() => post(`/api/cnf/contracts/${contract.id}/status`, { status, reason }));
    if (d) { setContract(d); ctx.reload(); }
  };

  return <>
    <Banner msg={r.msg} error={r.error} />
    <Section title="Contract" right={!ctx.partner && ctx.manager && !editing && <button className={btn} onClick={() => setEditing(true)}>{contract ? 'Change contract' : 'Make contract'}</button>}>
      {editing
        ? <ContractForm ctx={ctx} contract={contract} r={r} done={d => { setEditing(false); if (d) { setContract(d); ctx.reload(); } }} />
        : contract ? <ContractView c={contract} /> : <div className="text-slate-600">{ctx.partner ? 'RefTech has not set up your C&F contract yet.' : 'This principal has no C&F contract yet. A Manager or an Admin makes it.'}</div>}
      {contract && !editing && <>
        {contract.problems?.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Before it can be active:</b><ul className="ml-5 list-disc">{contract.problems.map((p: string) => <li key={p}>{p}</li>)}</ul></div>}
        {!ctx.partner && ctx.manager && <div className="mt-3 flex flex-wrap gap-2">
          {contract.status !== 'ACTIVE' && contract.status !== 'ENDED' && <button className={btn} disabled={r.busy} onClick={() => setStatus('ACTIVE')}>Activate</button>}
          {contract.status === 'ACTIVE' && <button className={btnLight} disabled={r.busy} onClick={() => setStatus('SUSPENDED')}>Suspend</button>}
          {contract.status !== 'ENDED' && <button className={btnRed} disabled={r.busy} onClick={() => setStatus('ENDED')}>End contract</button>}
        </div>}
      </>}
    </Section>
    {contract && <Distributors ctx={ctx} contract={contract} />}
    {contract && String(contract.services || '').includes('COLLECTION') && (!ctx.partner || contract.showOutstanding) && <Receipts ctx={ctx} />}
  </>;
}

function ContractView({ c }: { c: any }) {
  const yes = (v: unknown) => (v ? 'Yes' : 'No');
  return <>
    <Info items={[
      ['Contract', <>{c.contractNo} <Pill s={c.status} /></>], ['Valid', `${day(c.validFrom)} to ${c.validTo ? day(c.validTo) : 'open'}`],
      ['Services', String(c.services || '').replace(/,/g, ', ')], ['Stock owned by', c.stockOwner],
      ['Invoices', c.invoiceIssuer === 'PRINCIPAL_NAME' ? 'By us, in the principal\'s name' : c.invoiceIssuer === 'CNF' ? 'By us, in our name' : 'By the principal'],
      ['Invoice / CN / challan series', `${c.invoicePrefix || '-'} | ${c.creditNotePrefix || '-'} | ${c.challanPrefix || '-'}`],
      ['Principal (legal)', c.principalLegalName], ['GSTIN / state', `${c.principalGstin || '-'} / ${c.principalStateCode || '-'}`],
      ['Default GST', `${c.defaultGstRate}%`], ['Payment terms', `${c.paymentTermsDays} days`],
      ['Allotment rule', c.allotmentRule + (c.allotmentRule === 'MIN_LIFE_PCT' ? ` (${c.minLifePct}% life left)` : '')],
      ['Commission', `${c.commissionBasis}${c.commissionBasis?.startsWith('SLAB') ? ` (${c.slabMethod})` : ` at ${c.commissionRate}`}`],
      ['Credit control', yes(c.creditControl)], ['Claims / credit notes deducted', `${yes(c.deductClaims)} / ${yes(c.deductCreditNotes)}`],
      ['Portal shows', ['Stock', 'Orders', 'Invoices', 'Outstanding', 'Settlement', 'ServiceLevels'].filter(k => c[`show${k}`]).join(', ').replace('ServiceLevels', 'Service levels') || 'nothing'],
    ]} />
    <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
      <div><div className={label}>Territory</div>{c.territory?.length ? c.territory.map((t: any) => <div key={t.id}>{t.kind}: {t.value}</div>) : 'Anywhere'}</div>
      <div><div className={label}>Depots</div>{c.depots?.map((d: any) => <div key={d.warehouseId}>{d.name}{d.city ? `, ${d.city}` : ''}</div>)}</div>
      <div><div className={label}>Credit approvers</div>{c.approvers?.length ? c.approvers.map((a: any) => <div key={a.userId}>{a.userName}{a.maxAmount ? ` (up to ${inr(a.maxAmount)})` : ''}</div>) : 'None'}</div>
      <div><div className={label}>Slabs and fees</div>
        {c.slabs?.map((s: any, i: number) => <div key={i}>{inr(s.fromAmount)} to {s.toAmount ? inr(s.toAmount) : 'above'}: {s.rate}</div>)}
        {c.fees?.map((f: any) => <div key={f.feeType}>{f.feeType.replace(/_/g, ' ').toLowerCase()}: {inr(f.rate)}</div>)}
      </div>
    </div>
  </>;
}

type Row = Record<string, any>;

function RowsEditor({ title, rows, setRows, cols }: { title: string; rows: Row[]; setRows: (r: Row[]) => void; cols: { key: string; title: string; type?: string; options?: [string, string][] }[] }) {
  const set = (i: number, k: string, v: string) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return <div className="md:col-span-full">
    <div className={label}>{title}</div>
    {rows.map((row, i) => <div key={i} className="mb-1 flex flex-wrap gap-2">
      {cols.map(c => c.options
        ? <select key={c.key} className={`${input} w-48`} value={row[c.key] ?? ''} onChange={e => set(i, c.key, e.target.value)}>
            <option value="">{c.title}…</option>{c.options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        : <input key={c.key} className={`${input} w-40`} type={c.type || 'text'} step="any" placeholder={c.title} value={row[c.key] ?? ''} onChange={e => set(i, c.key, e.target.value)} />)}
      <button type="button" className={btnLight} onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
    </div>)}
    <button type="button" className={btnLight} onClick={() => setRows([...rows, {}])}>Add</button>
  </div>;
}

function ContractForm({ ctx, contract, r, done }: { ctx: CnfCtx; contract: any; r: ReturnType<typeof useRunner>; done: (d?: any) => void }) {
  const c = contract || {};
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [depots, setDepots] = useState<number[]>((c.depots || []).map((d: any) => d.warehouseId));
  const [services, setServices] = useState<string[]>(String(c.services || 'STORAGE,DISPATCH').split(','));
  const [territory, setTerritory] = useState<Row[]>(c.territory || []);
  const [approvers, setApprovers] = useState<Row[]>((c.approvers || []).map((a: any) => ({ userId: String(a.userId), maxAmount: a.maxAmount ?? '' })));
  const [slabs, setSlabs] = useState<Row[]>(c.slabs || []);
  const [fees, setFees] = useState<Row[]>(c.fees || []);
  useEffect(() => {
    api(`/api/cnf/warehouses${pq(ctx)}`).then(d => setWarehouses(d.warehouses || [])).catch(() => {});
    api(`/api/cnf/approver-candidates${pq(ctx)}`).then(d => setCandidates(d.users || [])).catch(() => {});
  }, []);
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter(x => x !== v));
  const fields = [
    { name: 'validFrom', label: 'Valid from', type: 'date' as const, required: true },
    { name: 'validTo', label: 'Valid to (empty: open)', type: 'date' as const },
    { name: 'stockOwner', label: 'Stock owned by', type: 'select' as const, required: true, options: [['PRINCIPAL', 'Principal'], ['CNF', 'C&F agent']] as [string, string][] },
    { name: 'invoiceIssuer', label: 'Invoices to distributors', type: 'select' as const, required: true, options: [['PRINCIPAL_NAME', 'By us, in the principal\'s name and series'], ['CNF', 'By us, in our name'], ['PRINCIPAL', 'By the principal itself']] as [string, string][] },
    { name: 'invoicePrefix', label: 'Invoice number prefix', placeholder: 'ABC/INV/' },
    { name: 'creditNotePrefix', label: 'Credit note prefix', placeholder: 'ABC/CN/' },
    { name: 'challanPrefix', label: 'Challan prefix', placeholder: 'ABC/DC/' },
    { name: 'principalLegalName', label: 'Principal\'s legal name' },
    { name: 'principalGstin', label: 'Principal\'s GSTIN' },
    { name: 'principalStateCode', label: 'Principal\'s GST state code', placeholder: '24' },
    { name: 'principalAddress', label: 'Principal\'s address', wide: true },
    { name: 'defaultGstRate', label: 'Default GST %', type: 'number' as const },
    { name: 'paymentTermsDays', label: 'Payment terms (days)', type: 'number' as const },
    { name: 'allotmentRule', label: 'Stock allotment rule', type: 'select' as const, required: true, options: [['FEFO', 'FEFO: first expiry first out'], ['FIFO', 'FIFO: first received first out'], ['MIN_LIFE_PCT', 'Minimum shelf life left'], ['FIXED_BATCH', 'Batch fixed on the order']] as [string, string][] },
    { name: 'minLifePct', label: 'Minimum life left % (for that rule)', type: 'number' as const },
    { name: 'commissionBasis', label: 'Commission basis', type: 'select' as const, required: true, options: [['VALUE_PCT', '% of sales value'], ['PER_UNIT', 'Per unit'], ['PER_CASE', 'Per case'], ['PER_KG', 'Per kg'], ['SLAB_VALUE', 'Slabs on value (%)'], ['SLAB_QTY', 'Slabs on units (₹ per unit)']] as [string, string][] },
    { name: 'commissionRate', label: 'Commission rate (not for slabs)', type: 'number' as const },
    { name: 'slabMethod', label: 'Slabs', type: 'select' as const, options: [['FLAT', 'Flat: all at the slab reached'], ['STEP', 'Step: each band at its rate']] as [string, string][] },
    { name: 'creditControl', label: 'Credit control on orders', type: 'checkbox' as const },
    { name: 'deductClaims', label: 'Deduct claims borne by C&F', type: 'checkbox' as const },
    { name: 'deductCreditNotes', label: 'Credit notes reduce commission', type: 'checkbox' as const },
    { name: 'showStock', label: 'Portal: stock', type: 'checkbox' as const },
    { name: 'showOrders', label: 'Portal: orders', type: 'checkbox' as const },
    { name: 'showInvoices', label: 'Portal: invoices', type: 'checkbox' as const },
    { name: 'showOutstanding', label: 'Portal: outstanding', type: 'checkbox' as const },
    { name: 'showSettlement', label: 'Portal: settlement', type: 'checkbox' as const },
    { name: 'showServiceLevels', label: 'Portal: service levels', type: 'checkbox' as const },
    { name: 'notes', label: 'Notes', type: 'textarea' as const, wide: true },
  ];
  const initial = contract ? c : { validFrom: new Date().toISOString().slice(0, 10), stockOwner: 'PRINCIPAL', invoiceIssuer: 'PRINCIPAL_NAME', defaultGstRate: 12, paymentTermsDays: 30,
    allotmentRule: 'FEFO', commissionBasis: 'VALUE_PCT', commissionRate: 2, slabMethod: 'FLAT', creditControl: true, deductClaims: true, deductCreditNotes: true,
    showStock: true, showOrders: true, showInvoices: true, showSettlement: true, showServiceLevels: true };
  const save = async (v: Record<string, unknown>) => {
    const body = {
      ...v, principalPartnerId: ctx.principalId, services: services.filter(Boolean), depots,
      territory: territory.filter(t => t.kind && t.value),
      approvers: approvers.filter(a => a.userId).map(a => ({ userId: Number(a.userId), userName: candidates.find(x => String(x.userId) === String(a.userId))?.userName, maxAmount: a.maxAmount || null })),
      slabs: slabs.filter(s => s.fromAmount !== undefined && s.fromAmount !== ''), fees: fees.filter(f => f.feeType && f.rate !== undefined && f.rate !== ''),
      validTo: v.validTo || null, minLifePct: v.minLifePct || null,
    };
    const d = await r.run(() => (contract ? put(`/api/cnf/contracts/${contract.id}`, body) : post('/api/cnf/contracts', body)));
    if (d) done(d);
  };
  return <div className="grid gap-4">
    <div className="grid gap-3 md:grid-cols-3">
      <div><div className={label}>Services</div>{SERVICES.map(s => <label key={s} className="mr-3 inline-flex items-center gap-1 text-sm"><input type="checkbox" checked={services.includes(s)} onChange={e => setServices(toggle(services, s, e.target.checked))} />{s.replace(/_/g, ' ').toLowerCase()}</label>)}</div>
      <div><div className={label}>Depots (warehouses the principal is assigned to)</div>{warehouses.map(w => <label key={w.id} className="mr-3 inline-flex items-center gap-1 text-sm"><input type="checkbox" checked={depots.includes(w.id)} onChange={e => setDepots(toggle(depots, w.id, e.target.checked))} />{w.name}</label>)}
        {!warehouses.length && <div className="text-sm text-slate-500">Assign the partner to a warehouse first (Manage Warehouses).</div>}</div>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <RowsEditor title="Territory (empty: anywhere)" rows={territory} setRows={setTerritory} cols={[{ key: 'kind', title: 'Kind', options: [['STATE', 'State'], ['DISTRICT', 'District'], ['PINCODE', 'Pincode (start)']] }, { key: 'value', title: 'Value' }]} />
      <RowsEditor title="Named credit approvers (empty limit: any amount)" rows={approvers} setRows={setApprovers} cols={[{ key: 'userId', title: 'Login', options: candidates.map(u => [String(u.userId), `${u.userName} (${u.kind === 'PRINCIPAL' ? 'principal' : u.role})`]) }, { key: 'maxAmount', title: 'Up to ₹', type: 'number' }]} />
      <RowsEditor title="Commission slabs" rows={slabs} setRows={setSlabs} cols={[{ key: 'fromAmount', title: 'From', type: 'number' }, { key: 'toAmount', title: 'To (empty: above)', type: 'number' }, { key: 'rate', title: 'Rate', type: 'number' }]} />
      <RowsEditor title="Handling fees (₹)" rows={fees} setRows={setFees} cols={[{ key: 'feeType', title: 'Fee', options: FEE_TYPES.map(f => [f, f.replace(/_/g, ' ').toLowerCase()]) }, { key: 'rate', title: 'Rate ₹', type: 'number' }, { key: 'note', title: 'Note' }]} />
    </div>
    <QuickForm fields={fields} initial={initial} onSubmit={save} submitText={contract ? 'Save contract' : 'Make contract (draft)'} onCancel={() => done()} busy={r.busy} />
  </div>;
}

function Distributors({ ctx, contract }: { ctx: CnfCtx; contract: any }) {
  const r = useRunner();
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => api(`/api/cnf/distributors${pq(ctx)}${q ? `${ctx.principalId ? '&' : '?'}q=${encodeURIComponent(q)}` : ''}`).then(d => setRows(d.distributors || [])), [ctx.principalId, q]);
  useEffect(() => { load().catch(x => r.setError(String((x as Error).message))); }, [load]);
  const open = async (row: any) => { const d = await r.run(() => api(`/api/cnf/distributors/${row.id}`)); if (d) setSel(d); };
  const writer = !ctx.partner || ctx.canWrite;
  const save = async (v: Record<string, unknown>) => {
    const body = { ...v, principalPartnerId: ctx.principalId };
    const d = await r.run(() => (form?.id ? put(`/api/cnf/distributors/${form.id}`, body) : post('/api/cnf/distributors', body)));
    if (d) { setForm(null); await load(); }
  };
  const reportOutstanding = async () => {
    const amount = ask(`${sel.name}: outstanding as the principal reports it (₹):`); if (amount === null) return;
    const days = ask('Days the oldest unpaid invoice is past its due date:'); if (days === null) return;
    const d = await r.run(() => post(`/api/cnf/distributors/${sel.id}/outstanding`, { outstanding: amount, overdueDays: days }));
    if (d) { await open(sel); await load(); }
  };
  const money = !ctx.partner || contract.showOutstanding;
  return <Section title="Distributors" right={<div className="flex gap-2">
    <input className={`${input} w-56`} placeholder="Search name, code, city" value={q} onChange={e => setQ(e.target.value)} />
    {writer && <button className={btn} onClick={() => setForm({ allowedOverdueDays: 15, state: '', active: true })}>Add distributor</button>}
  </div>}>
    <Banner msg={r.msg} error={r.error} />
    {form && <div className="mb-4 rounded-xl border p-3"><QuickForm initial={form} submitText={form.id ? 'Save distributor' : 'Add distributor'} onCancel={() => setForm(null)} busy={r.busy} onSubmit={save} fields={[
      { name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true }, { name: 'gstin', label: 'GSTIN' },
      { name: 'billingAddress', label: 'Billing address', wide: true }, { name: 'shippingAddress', label: 'Delivery address', wide: true },
      { name: 'city', label: 'City' }, { name: 'district', label: 'District' }, { name: 'state', label: 'State' }, { name: 'stateCode', label: 'GST state code' }, { name: 'pincode', label: 'Pincode' },
      { name: 'contactName', label: 'Contact person' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email' },
      { name: 'creditLimit', label: 'Credit limit ₹ (empty: none)', type: 'number' }, { name: 'allowedOverdueDays', label: 'Days allowed past due date', type: 'number' },
      { name: 'active', label: 'Active', type: 'checkbox' },
    ]} /></div>}
    <Grid rows={rows} empty="No distributors yet." onRow={open} selected={sel?.id} cols={[
      { key: 'code', title: 'Code' }, { key: 'name', title: 'Name' }, { key: 'city', title: 'City' }, { key: 'state', title: 'State' },
      ...(money ? [{ key: 'creditLimit', title: 'Limit', right: true, render: (x: any) => inr(x.creditLimit) || 'none' },
        { key: 'out', title: 'Outstanding', right: true, render: (x: any) => inr(x.credit?.outstanding) },
        { key: 'od', title: 'Overdue days', right: true, render: (x: any) => x.credit?.overdueDays ?? '' }] : []),
      { key: 'active', title: 'Active', render: (x: any) => (x.active ? 'Yes' : 'No') },
    ]} />
    {sel && <div className="mt-4 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold">{sel.name} ({sel.code})</h3>
        <div className="flex gap-2">{writer && <button className={btnLight} onClick={() => setForm(sel)}>Change</button>}
          {writer && sel.credit?.source === 'REPORTED' && <button className={btnLight} onClick={reportOutstanding}>Enter principal's outstanding</button>}
          <button className={btnLight} onClick={() => setSel(null)}>Close</button></div></div>
      <Info items={[['GSTIN', sel.gstin], ['Address', sel.billingAddress], ['Pincode', sel.pincode], ['Contact', `${sel.contactName || ''} ${sel.phone || ''}`]]} />
      {sel.credit && <div className="mt-2"><Info items={[['Credit limit', inr(sel.credit.creditLimit) || 'none'], ['Outstanding', inr(sel.credit.outstanding)],
        ['Oldest overdue', sel.credit.overdueDays ? `${sel.credit.overdueDays} days (${sel.credit.oldestOpenBill || ''})` : 'none'], ['Available', inr(sel.credit.available) || 'no limit'],
        ['Figures from', sel.credit.source === 'RECORDED' ? 'Our invoices and receipts' : `The principal (${sel.credit.reportedBy || 'not given yet'})`]]} /></div>}
      {sel.ledger && <div className="mt-3"><Grid rows={sel.ledger} empty="No invoices or receipts yet." cols={[
        { key: 'date', title: 'Date', render: x => day(x.date) }, { key: 'kind', title: 'Kind' }, { key: 'no', title: 'Number' }, { key: 'dueDate', title: 'Due', render: x => day(x.dueDate) },
        { key: 'debit', title: 'Debit', right: true, render: x => (Number(x.debit) ? inr(x.debit) : '') }, { key: 'credit', title: 'Credit', right: true, render: x => (Number(x.credit) ? inr(x.credit) : '') },
        { key: 'balance', title: 'Balance', right: true, render: x => inr(x.balance) }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> }]} /></div>}
    </div>}
  </Section>;
}

function Receipts({ ctx }: { ctx: CnfCtx }) {
  const r = useRunner();
  const [rows, setRows] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => api(`/api/cnf/receipts${pq(ctx)}`).then(d => setRows(d.receipts || [])), [ctx.principalId]);
  useEffect(() => { load().catch(x => r.setError(String((x as Error).message))); api(`/api/cnf/distributors${pq(ctx)}`).then(d => setDistributors(d.distributors || [])).catch(() => {}); }, [load]);
  const reverse = async (x: any) => {
    const reason = ask(`Reason to reverse the receipt of ${inr(x.amount)} from ${x.distributorName}:`); if (reason === null) return;
    if (await r.run(() => post(`/api/cnf/receipts/${x.id}/reverse`, { reason }))) await load();
  };
  return <Section title="Money received from distributors" right={!ctx.partner && <button className={btn} onClick={() => setAdding(!adding)}>Record a receipt</button>}>
    <Banner msg={r.msg} error={r.error} />
    {adding && <div className="mb-4 rounded-xl border p-3"><QuickForm submitText="Record" busy={r.busy} onCancel={() => setAdding(false)} initial={{ receiptDate: new Date().toISOString().slice(0, 10), mode: 'NEFT' }}
      onSubmit={async v => { if (await r.run(() => post('/api/cnf/receipts', v))) { setAdding(false); await load(); } }} fields={[
        { name: 'distributorId', label: 'Distributor', type: 'select', required: true, options: distributors.map(d => [d.id, `${d.code} ${d.name}`]) },
        { name: 'receiptDate', label: 'Date', type: 'date', required: true }, { name: 'amount', label: 'Amount ₹', type: 'number', required: true },
        { name: 'mode', label: 'Mode', type: 'select', required: true, options: ['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CASH', 'OTHER'].map(m => [m, m]) },
        { name: 'reference', label: 'UTR / cheque no.' }, { name: 'note', label: 'Note' }]} /></div>}
    <Grid rows={rows} empty="No receipts yet." cols={[
      { key: 'receiptDate', title: 'Date', render: x => day(x.receiptDate) }, { key: 'distributorName', title: 'Distributor' }, { key: 'amount', title: 'Amount', right: true, render: x => inr(x.amount) },
      { key: 'mode', title: 'Mode' }, { key: 'reference', title: 'Reference' }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
      { key: 'a', title: '', render: x => !ctx.partner && ctx.manager && x.status === 'RECORDED' && <button className={btnRed} onClick={() => reverse(x)}>Reverse</button> }]} />
  </Section>;
}
