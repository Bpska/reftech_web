/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-019 -- kitting, sorting and grading, retail-ready packing. A job turns stock into new stock: kits and combo
//   packs from a bill of components (the components are reserved first-expiry-first and taken out of the stock
//   ledger), produce sorted into grades (kg in = grades + waste, within the tolerance), retail-ready packs. What is
//   made comes in as new pallets with its own batch and expiry. Billed per unit, per kg or per hour on the storage bill.
//
// Backend: KitController (/api/warehouse/kitting/**), script 84.
import { useCallback, useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, input, num, palletLabelsHtml, pill, printHtml, qty, when, who } from './wms';
import { LinesEditor, StaffOnly, Table, Tabs, codes, iso, opts, post, put, usePartners, useProducts, useRunner, useWarehouses } from './wmsOps';
import { CAPACITY_SCRIPT, gradeBalance } from './capacityKitEcom';

const TYPES: [string, string][] = [['KIT', 'Kit / combo pack'], ['RETAIL_PACK', 'Retail-ready pack'], ['SORT_GRADE', 'Sort and grade']];
const UNITS: [string, string][] = [['UNIT', 'Per unit'], ['KG', 'Per kg'], ['HOUR', 'Per hour']];
const typeName = (s: string) => TYPES.find(([v]) => v === s)?.[1] || s;

export function KittingPage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [tab, setTab] = useState('jobs');
  const [ready, setReady] = useState<boolean | null>(null);
  const [manager, setManager] = useState(false);
  const [tolerance, setTolerance] = useState(3);
  const [status, setStatus] = useState('OPEN');
  const [jobs, setJobs] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [newType, setNewType] = useState('KIT');

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/warehouse/kitting/jobs?status=${status}`);
      setReady(d.ready !== false); setManager(!!d.manager); setJobs(d.jobs || []);
      if (d.tolerancePct != null) setTolerance(Number(d.tolerancePct));
      if (d.ready === false) return;
      const b = await api('/api/warehouse/kitting/boms?all=true'); setBoms(b.boms || []);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/kitting/jobs/${id}`)); if (d) setSel(d); };
  const changed = async (d: any) => { setSel(d); await load(); };
  const act = (path: string, body?: any) => r.run(() => post(`/api/warehouse/kitting/jobs/${sel.id}/${path}`, body), changed);
  if (!me.staff) return <StaffOnly title="Kitting & Grading" />;
  const sort = newType === 'SORT_GRADE';

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Boxes className="h-8 w-8 text-sky-700" />Kitting & Grading</h1>
    <p className="text-slate-600">Kits and combo packs from a bill of components, sorting and grading of produce, retail-ready packing. Components leave the stock ledger; what is made comes in with its own batch and expiry.</p>
    <Banner msg={r.msg} error={r.error} />
    {ready === false && <NotReady script={CAPACITY_SCRIPT} />}
    <Tabs value={tab} onChange={setTab} tabs={[['jobs', 'Jobs'], ['boms', 'Bills of components']]} />

    {tab === 'jobs' && <>
      <Section title="Plan a job">
        <div className="mb-2 flex gap-2">{TYPES.map(([v, t]) => <button key={v} type="button" className={newType === v ? btn : btnLight} onClick={() => setNewType(v)}>{t}</button>)}</div>
        <QuickForm key={newType} cols={4} busy={r.busy} submitText="Plan" fields={[
          ...(sort
            ? [{ name: 'palletCodes', label: 'Produce pallets to sort (scan or type)', type: 'textarea' as const, wide: true, required: true }]
            : [{ name: 'bomId', label: 'Bill of components', type: 'select' as const, required: true, options: opts(boms.filter(b => b.active && b.jobType === newType), b => `${b.bomCode} · ${b.name} (${b.partnerName})`) },
               { name: 'plannedQty', label: 'Units to make', type: 'number' as const, required: true },
               { name: 'warehouseId', label: 'Warehouse', type: 'select' as const, required: true, options: opts(warehouses) }]),
          { name: 'billingUnit', label: 'Billed', type: 'select', options: UNITS, hint: 'Empty: per kg for sorting, per unit otherwise' },
          { name: 'rate', label: 'Rate (empty: the tariff\'s repack rate)', type: 'number' },
          { name: 'plannedAt', label: 'Planned for', placeholder: 'yyyy-mm-ddThh:mm' },
          { name: 'description', label: 'Description', wide: true }]}
          onSubmit={(v, f) => r.run(() => post('/api/warehouse/kitting/jobs', { ...v, jobType: newType, plannedAt: iso(v.plannedAt), palletCodes: sort ? codes(v.palletCodes) : undefined }),
            async (d: any) => { f.reset(); await changed(d); })} />
      </Section>
      <Section title="Jobs" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}>
        {[['OPEN', 'Planned and running'], ['DONE', 'Done'], ['CANCELLED', 'Cancelled'], ['', 'All']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
        <Table rows={jobs} selected={sel?.id} onRow={x => open(x.id)} cols={[
          { key: 'jobNo', label: 'Job' }, { key: 'jobType', label: 'Kind', render: x => typeName(x.jobType) }, { key: 'partnerName', label: 'Partner' },
          { key: 'bomCode', label: 'Makes', render: x => x.outputProductName ? `${x.outputProductName}` : x.bomCode || 'grades' },
          { key: 'plannedQty', label: 'Planned / made', right: true, render: x => x.jobType === 'SORT_GRADE' ? `${num(x.inputKg)} kg → ${num(x.outputKg)} kg` : `${num(x.plannedQty)} / ${num(x.builtQty)}` },
          { key: 'billedQty', label: 'To bill', right: true, render: x => x.billedQty != null ? `${num(x.billedQty)} ${String(x.billingUnit).toLowerCase()}` : String(x.billingUnit).toLowerCase() },
          { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
        ]} />
      </Section>
      {sel && <Section title={<>{sel.jobNo} · {typeName(sel.jobType)} <span className={pill(sel.status)}>{sel.status}</span></>} right={<div className="flex gap-2">
        {sel.status === 'PLANNED' && <button className={btn} disabled={r.busy} onClick={() => void act('start')}>Start (reserve stock)</button>}
        {(sel.inputs || []).length > 0 && <button className={btnLight} onClick={() => printHtml(`Pick list ${sel.jobNo}`, pickListHtml(sel))}>Print pick list</button>}
        {(sel.outputs || []).length > 0 && <button className={btnLight} onClick={() => printHtml(`Labels ${sel.jobNo}`, palletLabelsHtml(sel.outputs.map((o: any) => ({ ...o, partnerName: sel.partnerName, warehouseName: sel.warehouseName }))))}>Print labels</button>}
        {['PLANNED', 'RUNNING'].includes(sel.status) && <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the job cancelled?'); if (reason) void act('cancel', { reason }); }}>Cancel</button>}
      </div>}>
        <div className="grid gap-1 text-sm md:grid-cols-3">
          <div>{sel.partnerName} · {sel.warehouseName}</div>
          <div>{sel.bomCode ? `${sel.bomCode} · ${sel.bomName}` : ''}{sel.outputBatchNo ? ` · batch ${sel.outputBatchNo}` : ''}{sel.outputExpiryDate ? ` · expiry ${sel.outputExpiryDate}` : ''}</div>
          <div>Billed {String(sel.billingUnit).toLowerCase()}{sel.billedQty != null ? `: ${num(sel.billedQty)}` : ''}{sel.rate != null ? ` at ₹ ${num(sel.rate, 2)}` : ''}</div>
          <div>Started {when(sel.startedAt)} {sel.startedBy || ''}</div><div>Ended {when(sel.endedAt)} {sel.endedBy || ''} {sel.startedAt ? `(${num(sel.hoursRun, 2)} h)` : ''}</div>
          <div>{sel.resultNote || sel.cancelledReason || sel.description || ''}</div>
        </div>
        {sel.components && <><div className="mt-3 font-semibold">Components for {num(sel.plannedQty)} units</div><Table rows={sel.components} cols={[
          { key: 'productName', label: 'Component', render: x => `${x.productCode} · ${x.productName}` }, { key: 'quantity', label: 'Per build', right: true },
          { key: 'need', label: 'Needed', right: true, render: x => qty(x.need, x.uom) },
          { key: 'available', label: 'Free in stock', right: true, render: x => <span className={Number(x.available) < Number(x.need) && sel.status === 'PLANNED' ? 'font-bold text-red-700' : ''}>{qty(x.available, x.uom)}</span> },
        ]} /></>}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div><div className="font-semibold">Stock taken</div><Table rows={sel.inputs || []} empty="Nothing reserved yet." cols={[
            { key: 'palletCode', label: 'Pallet' }, { key: 'binCode', label: 'Bin' }, { key: 'productName', label: 'Product' }, { key: 'batchNo', label: 'Batch' }, { key: 'expiryDate', label: 'Expiry' },
            { key: 'reservedQty', label: 'Reserved', right: true }, { key: 'usedQty', label: 'Used', right: true }]} /></div>
          <div><div className="font-semibold">Stock made</div><Table rows={sel.outputs || []} empty="Nothing made yet." cols={[
            { key: 'palletCode', label: 'Pallet' }, { key: 'productName', label: 'Product' }, { key: 'grade', label: 'Grade' }, { key: 'batchNo', label: 'Batch' }, { key: 'expiryDate', label: 'Expiry' },
            { key: 'quantity', label: 'Quantity', right: true, render: x => qty(x.quantity, x.uom) }, { key: 'weightKg', label: 'Kg', right: true }]} /></div>
        </div>
        {sel.status === 'RUNNING' && (sel.jobType === 'SORT_GRADE' ? <CompleteSort sel={sel} r={r} tolerance={tolerance} onDone={(b: any) => act('complete', b)} />
          : <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-1 font-semibold">Complete the job</div>
            <QuickForm cols={4} busy={r.busy} submitText="Complete" initial={{ builtQty: sel.plannedQty }} fields={[
              { name: 'builtQty', label: 'Units made', type: 'number', required: true }, { name: 'batchNo', label: 'Batch (empty: the job number)' },
              { name: 'mfgDate', label: 'Made on', type: 'date' }, { name: 'expiryDate', label: 'Expiry (empty: earliest component, capped by shelf life)', type: 'date' },
              { name: 'perPallet', label: 'Units per pallet', type: 'number' }, { name: 'totalKg', label: 'Total kg made', type: 'number' },
              { name: 'billedQty', label: `To bill (${String(sel.billingUnit).toLowerCase()}; empty = worked out)`, type: 'number' }, { name: 'resultNote', label: 'Note', wide: true }]}
              onSubmit={v => act('complete', v)} /></div>)}
      </Section>}
    </>}

    {tab === 'boms' && <BomEditor boms={boms} partners={partners} manager={manager} r={r} onSaved={load} />}
  </>;
}

function CompleteSort({ sel, r, tolerance, onDone }: any) {
  const products = useProducts(sel.partnerId);
  const [lines, setLines] = useState<any[]>([{ grade: 'A' }, { grade: 'B' }]);
  const [inputKg, setInputKg] = useState(String((sel.inputs || []).reduce((s: number, i: any) => s + (Number(i.palletKg) || 0), 0) || ''));
  const [wasteKg, setWasteKg] = useState('');
  const [note, setNote] = useState('');
  const bal = gradeBalance(Number(inputKg), lines, Number(wasteKg), tolerance);
  return <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-1 font-semibold">Record the grades</div>
    <LinesEditor lines={lines} setLines={setLines} products={products} fields={[
      { key: 'grade', label: 'Grade' }, { key: 'quantity', label: 'Quantity', kind: 'number' }, { key: 'weightKg', label: 'Kg', kind: 'number' },
      { key: 'batchNo', label: 'Batch (empty: job-grade)' }, { key: 'expiryDate', label: 'Expiry', kind: 'date' }, { key: 'perPallet', label: 'Per pallet', kind: 'number' }]} />
    <div className="mt-2 flex flex-wrap items-end gap-3 text-sm">
      <label>Kg sorted<input className={input} type="number" step="any" value={inputKg} onChange={e => setInputKg(e.target.value)} /></label>
      <label>Kg thrown away<input className={input} type="number" step="any" value={wasteKg} onChange={e => setWasteKg(e.target.value)} /></label>
      <label className="grow">Note (needed when off by more than {tolerance} %)<input className={input} value={note} onChange={e => setNote(e.target.value)} /></label>
      <span className={bal.ok ? 'text-emerald-700' : 'font-bold text-red-700'}>{num(bal.accounted)} kg of {num(inputKg)} kg accounted ({bal.diffPct} % off)</span>
      <button className={btn} disabled={r.busy} onClick={() => onDone({ outputs: lines.filter(l => l.productId), inputKg: inputKg || undefined, wasteKg: wasteKg || 0, resultNote: note || undefined })}>Complete</button>
    </div>
  </div>;
}

function BomEditor({ boms, partners, manager, r, onSaved }: any) {
  const [edit, setEdit] = useState<any>(null);
  const [partnerId, setPartnerId] = useState('');
  const [lines, setLines] = useState<any[]>([]);
  const products = useProducts(partnerId);
  const begin = (b: any) => { setEdit(b || {}); setPartnerId(b ? String(b.partnerId) : ''); setLines(b ? b.lines.map((l: any) => ({ productId: String(l.productId), quantity: l.quantity })) : [{}]); };
  const save = (v: Record<string, unknown>) => {
    const body = { ...v, partnerId, lines: lines.filter(l => l.productId).map(l => ({ productId: l.productId, quantity: l.quantity })) };
    return r.run(() => (edit.id ? put(`/api/warehouse/kitting/boms/${edit.id}`, body) : post('/api/warehouse/kitting/boms', body)), async () => { setEdit(null); await onSaved(); });
  };
  return <Section title="Bills of components" right={manager && !edit && <button className={btn} onClick={() => begin(null)}>New bill</button>}>
    {edit && <div className="mb-4 rounded-xl bg-slate-50 p-3">
      <select className={`${input} mb-2 max-w-sm`} value={partnerId} onChange={e => setPartnerId(e.target.value)} disabled={!!edit.id}>
        <option value="">Partner…</option>{partners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      {partnerId && <LinesEditor lines={lines} setLines={setLines} products={products} fields={[{ key: 'quantity', label: 'Per build', kind: 'number' }]} />}
      <QuickForm key={edit.id || 'new'} cols={4} busy={r.busy} submitText="Save" onCancel={() => setEdit(null)} initial={{ ...edit, active: edit.id ? edit.active : true, outputProductId: edit.outputProductId ? String(edit.outputProductId) : '' }} fields={[
        { name: 'bomCode', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true },
        { name: 'jobType', label: 'Kind', type: 'select', options: TYPES.slice(0, 2), required: true },
        { name: 'outputProductId', label: 'Makes', type: 'select', options: opts(products, p => `${p.productCode} · ${p.name}`), required: true },
        { name: 'outputQty', label: 'Units per build', type: 'number', required: true }, { name: 'active', label: 'Active', type: 'checkbox' }, { name: 'notes', label: 'Notes', wide: true }]}
        onSubmit={v => save(v)} />
    </div>}
    <Table rows={boms} onRow={manager ? begin : undefined} cols={[
      { key: 'bomCode', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'partnerName', label: 'Partner' }, { key: 'jobType', label: 'Kind', render: x => typeName(x.jobType) },
      { key: 'outputProductName', label: 'Makes', render: x => `${num(x.outputQty)} × ${x.outputProductName}` },
      { key: 'lines', label: 'Components', render: x => x.lines.map((l: any) => `${num(l.quantity)} ${l.productName}`).join(', ') },
      { key: 'active', label: 'Active', render: x => (x.active ? 'Yes' : 'No') }]} />
  </Section>;
}

function pickListHtml(j: any) {
  const esc = (v: unknown) => String(v ?? '-').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const rows = (j.inputs || []).map((i: any) => `<tr><td>${esc(i.binCode)}</td><td>${esc(i.palletCode)}</td><td>${esc(i.productName)}</td><td>${esc(i.batchNo)}</td><td>${esc(i.expiryDate)}</td><td>${esc(i.reservedQty)} ${esc(i.uom)}</td><td></td></tr>`).join('');
  return `<div class="doc"><h1>Pick list ${esc(j.jobNo)}</h1><div>${esc(j.partnerName)} · ${esc(j.warehouseName)} · ${esc(typeName(j.jobType))}</div>
    <table><tr><th>Bin</th><th>Pallet</th><th>Product</th><th>Batch</th><th>Expiry</th><th>Take</th><th>Taken</th></tr>${rows}</table></div>`;
}
