/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-005 -- stock count, quality hold of a batch, recall and traceability.
//   Counts          a cycle count (a chamber, a zone or a partner) or a full count; blind by default. Scan the bin and
//                   the pallet and type what is there. A Manager (not the one who submitted it) approves: differences
//                   become ledger corrections, pallets not found are written off, pallets in another bin are moved.
//   Holds & recalls a batch hold (staff) or a recall (Manager) puts every pallet of the batch in the building ON HOLD
//                   and stops its picking; pallets of the batch received later come in on hold. The recall lists who
//                   received the pallets already dispatched.
//   Trace           where a batch (or a pallet's batch) came from and where it went, with its whole history.
// A Partner login traces its own batches.
//
// Backend: StockControlController (/api/warehouse/counts/**, /api/warehouse/batch-blocks/**, /api/warehouse/trace).
import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, ScanBox, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, day, input, label, num, pill, qty, when, who } from './wms';
import { OPS_SCRIPT, Table, Tabs, opts, post, usePartners, useProducts, useRunner, useWarehouses } from './wmsOps';
import { fmtTemp, fmtTempNumber, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function StockControlPage() {
  const me = who();
  const r = useRunner();
  const [tab, setTab] = useState(me.partner ? 'trace' : 'counts');
  if (!me.staff && !me.partner) return null;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ClipboardCheck className="h-8 w-8 text-sky-700" />Stock Control</h1>
    <p className="text-slate-600">{me.partner ? 'Trace a batch: where it came from and where it went.' : 'Stock counts, batch holds and recalls, and tracing a batch forward and back.'}</p>
    <Banner msg={r.msg} error={r.error} />
    {!me.partner && <Tabs tabs={[['counts', 'Stock counts'], ['blocks', 'Holds & recalls'], ['trace', 'Trace']]} value={tab} onChange={setTab} />}
    {tab === 'counts' && <Counts r={r} manager={me.manager} />}
    {tab === 'blocks' && <Blocks r={r} manager={me.manager} />}
    {tab === 'trace' && <TracePanel r={r} partnerLogin={me.partner} partnerId={me.partnerId} />}
  </>;
}

function Counts({ r, manager }: any) {
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [ready, setReady] = useState<boolean | null>(null);
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [chambers, setChambers] = useState<any[]>([]);
  const [wh, setWh] = useState('');
  const [binCode, setBinCode] = useState('');
  const [pallet, setPallet] = useState('');
  const load = useCallback(async () => {
    try { const d = await api(`/api/warehouse/counts?status=${status}`); setReady(d.ready !== false); setList(d.counts || []); } catch (x) { r.setError(String((x as Error).message)); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!wh) { setChambers([]); return; }
    api(`/api/warehouse/chambers/board?warehouseId=${wh}`).then(d => setChambers(d.chambers || [])).catch(() => setChambers([]));
  }, [wh]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/counts/${id}`)); if (d) setSel(d); };
  const changed = async (d: any) => { setSel(d); await load(); };
  const act = (path: string, body?: any) => r.run(() => post(`/api/warehouse/counts/${sel.id}/${path}`, body), changed);

  async function countPallet(code: string) {
    const q = window.prompt(`Quantity found on pallet ${code}${binCode ? ` in bin ${binCode}` : ''} (0 = empty):`);
    if (q === null || q.trim() === '') return;
    await act('count', { palletCode: code, binCode: binCode || undefined, countedQty: q.trim() });
    setPallet(code);
  }
  return <>
    {ready === false && <NotReady script={OPS_SCRIPT} />}
    <Section title="Start a count">
      <div className="mb-2 max-w-xs"><label className={label}>Warehouse (for the chamber list)</label>
        <select className={input} value={wh} onChange={e => setWh(e.target.value)}><option value="">Choose…</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
      <QuickForm key={wh} cols={4} busy={r.busy} submitText="Start the count" initial={{ warehouseId: wh, blind: true }} fields={[
        { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), required: true },
        { name: 'countType', label: 'Count', type: 'select', options: [['CYCLE', 'Cycle (a chamber or a partner)'], ['FULL', 'Full (whole warehouse)']], required: true },
        { name: 'chamberId', label: 'Chamber', type: 'select', options: opts(chambers) }, { name: 'partnerId', label: 'Only this partner', type: 'select', options: opts(partners) },
        { name: 'blind', label: 'Blind (counter does not see the expected quantity)', type: 'checkbox' }, { name: 'notes', label: 'Notes', wide: true }]}
        onSubmit={v => r.run(() => post('/api/warehouse/counts', v), changed)} />
    </Section>
    <Section title="Counts" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}>
      {[['OPEN', 'Open'], ['APPROVED', 'Approved'], ['CANCELLED', 'Cancelled']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
      <Table rows={list} selected={sel?.id} onRow={x => open(x.id)} cols={[
        { key: 'countNo', label: 'Count' }, { key: 'warehouseName', label: 'Warehouse' }, { key: 'place', label: 'Place', render: x => x.countType === 'FULL' ? 'Whole warehouse' : [x.chamberName, x.zoneCode, x.partnerName].filter(Boolean).join(' · ') },
        { key: 'progress', label: 'Counted', render: x => `${x.counted} / ${x.lines}` }, { key: 'differences', label: 'Differences', right: true },
        { key: 'createdAt', label: 'Started', render: x => when(x.createdAt) }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      ]} />
    </Section>
    {sel && <Section title={<>{sel.countNo} <span className={pill(sel.status)}>{sel.status}</span>{sel.blind && <span className="ml-2 text-sm font-normal text-slate-500">blind</span>}</>} right={<div className="flex flex-wrap gap-2">
      {sel.status === 'OPEN' && <button className={btn} onClick={() => {
        const left = Number(sel.lines) - Number(sel.counted);
        const missing = left > 0 && window.confirm(`${left} pallet(s) are not counted. Count them as NOT FOUND? (Cancel = go back and count them)`);
        if (left > 0 && !missing) return;
        void act('submit', { uncountedAsMissing: missing });
      }}>Submit</button>}
      {sel.status === 'SUBMITTED' && manager && <button className={btn} onClick={() => act('approve', { note: window.prompt('Note (optional)') || undefined })}>Approve differences</button>}
      {sel.status === 'SUBMITTED' && manager && <button className={btnLight} onClick={() => { const note = window.prompt('What should be counted again?'); if (note) void act('recount', { note }); }}>Count again</button>}
      {['OPEN', 'SUBMITTED'].includes(sel.status) && manager && <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the count cancelled?'); if (reason) void act('cancel', { reason }); }}>Cancel</button>}
    </div>}>
      {sel.status === 'OPEN' && <div className="mb-3 grid gap-2 md:grid-cols-2">
        <div><label className={label}>1. Scan the bin</label><ScanBox placeholder={binCode ? `Bin ${binCode} (scan another)` : 'Bin label'} onScan={c => setBinCode(c)} /></div>
        <div><label className={label}>2. Scan each pallet in it</label><ScanBox placeholder={pallet ? `Last: ${pallet}` : 'Pallet label'} onScan={countPallet} autoFocus /></div>
      </div>}
      {sel.decisionNote && <div className="mb-2 text-sm">{sel.decisionNote} {sel.decidedByName ? `(${sel.decidedByName})` : ''}</div>}
      {sel.skipped?.length > 0 && <div className="mb-2 rounded-xl bg-amber-50 p-2 text-sm">Left out: {sel.skipped.join('; ')}</div>}
      <Table rows={sel.lineList || []} cols={[
        { key: 'expectedBinCode', label: 'Bin' }, { key: 'palletCode', label: 'Pallet' }, { key: 'productName', label: 'Product', render: x => `${x.productCode} · ${x.productName}` },
        { key: 'batchNo', label: 'Batch' }, { key: 'systemQty', label: 'Expected', right: true, render: x => sel.systemHidden ? '•••' : qty(x.systemQty, x.uom) },
        { key: 'countedQty', label: 'Counted', right: true, render: x => x.countedQty == null ? '' : qty(x.countedQty, x.uom) },
        { key: 'differenceQty', label: 'Difference', right: true, render: x => x.differenceQty == null || Number(x.differenceQty) === 0 ? '' : <b className="text-amber-700">{num(x.differenceQty)}</b> },
        { key: 'foundBinCode', label: 'Found in', render: x => x.foundBinCode && x.foundBinCode !== x.expectedBinCode ? <b className="text-amber-700">{x.foundBinCode}</b> : x.foundBinCode || '' },
        { key: 'countedBy', label: 'By', render: x => x.countedBy ? `${x.countedBy}${x.unexpected ? ' · not expected here' : ''}` : '' },
      ]} />
    </Section>}
  </>;
}

function Blocks({ r, manager }: any) {
  const partners = usePartners();
  const [partnerId, setPartnerId] = useState('');
  const products = useProducts(partnerId);
  const [status, setStatus] = useState('ACTIVE');
  const [list, setList] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const load = useCallback(async () => { try { const d = await api(`/api/warehouse/batch-blocks?status=${status}`); setList(d.blocks || []); } catch { setList([]); } }, [status]);
  useEffect(() => { void load(); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/batch-blocks/${id}`)); if (d) setSel(d); };
  return <>
    <Section title="Hold a batch or start a recall">
      <div className="mb-2 max-w-xs"><label className={label}>Partner</label><select className={input} value={partnerId} onChange={e => setPartnerId(e.target.value)}><option value="">Choose…</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <QuickForm key={partnerId} cols={3} busy={r.busy} submitText="Block the batch" fields={[
        { name: 'productId', label: 'Product', type: 'select', options: opts(products, p => `${p.productCode} · ${p.name}`), required: true },
        { name: 'batchNo', label: 'Batch', required: true },
        { name: 'blockType', label: 'Type', type: 'select', options: manager ? [['HOLD', 'Batch hold (quality check)'], ['RECALL', 'Recall']] : [['HOLD', 'Batch hold (quality check)']], required: true },
        { name: 'recallRef', label: 'Recall / reference number' }, { name: 'reason', label: 'Reason', required: true, wide: true }]}
        onSubmit={v => r.run(() => post('/api/warehouse/batch-blocks', { ...v, partnerId }), async (d: any) => { setSel(d); await load(); })} />
    </Section>
    <Section title="Holds & recalls" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}><option value="ACTIVE">Active</option><option value="LIFTED">Lifted</option><option value="">All</option></select>}>
      <Table rows={list} selected={sel?.id} onRow={x => open(x.id)} cols={[
        { key: 'blockType', label: 'Type', render: x => <span className={pill(x.blockType === 'RECALL' ? 'RECALL' : 'HOLD')}>{x.blockType}</span> }, { key: 'partnerName', label: 'Partner' },
        { key: 'productName', label: 'Product', render: x => `${x.productCode} · ${x.productName}` }, { key: 'batchNo', label: 'Batch' }, { key: 'reason', label: 'Reason', render: x => `${x.recallRef ? x.recallRef + ': ' : ''}${x.reason}` },
        { key: 'inBuilding', label: 'In the building', right: true, render: x => `${x.palletsInBuilding} pallet(s), ${num(x.qtyInBuilding)}` }, { key: 'palletsDispatched', label: 'Dispatched', right: true },
        { key: 'createdAt', label: 'Since', render: x => `${when(x.createdAt)} · ${x.createdByName}` }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      ]} />
    </Section>
    {sel && <Section title={<>{sel.blockType === 'RECALL' ? 'Recall' : 'Batch hold'} · {sel.productCode} batch {sel.batchNo} <span className={pill(sel.status)}>{sel.status}</span></>}
      right={sel.status === 'ACTIVE' && (sel.blockType !== 'RECALL' || manager) && <button className={btnLight} onClick={() => {
        const reason = window.prompt('Why is the block lifted? (the pallets it held go back to good stock)'); if (reason) void r.run(() => post(`/api/warehouse/batch-blocks/${sel.id}/lift`, { reason }), async (d: any) => { setSel(d); await load(); });
      }}>Lift the block</button>}>
      {sel.liftedAt && <div className="mb-2 text-sm">Lifted {when(sel.liftedAt)} by {sel.liftedByName}: {sel.liftReason}</div>}
      <TraceView t={sel.trace} />
    </Section>}
  </>;
}

function TracePanel({ r, partnerLogin, partnerId: own }: any) {
  const partners = usePartners();
  const [partnerId, setPartnerId] = useState(partnerLogin ? String(own || '') : '');
  const products = useProducts(partnerId);
  const [t, setT] = useState<any>(null);
  return <>
    <Section title="Trace">
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className={label}>By pallet label</label><ScanBox placeholder="Scan or type a pallet label" onScan={c => r.run(() => api(`/api/warehouse/trace?palletCode=${encodeURIComponent(c)}`), setT)} /></div>
        <div className="grid gap-2 md:grid-cols-3">
          {!partnerLogin && <div><label className={label}>Partner</label><select className={input} value={partnerId} onChange={e => setPartnerId(e.target.value)}><option value="">Choose…</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
          <form className="contents" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void r.run(() => api(`/api/warehouse/trace?partnerId=${partnerId}&productId=${f.get('productId')}&batchNo=${encodeURIComponent(String(f.get('batchNo') || ''))}`), setT); }}>
            <div><label className={label}>Product</label><select name="productId" className={input} required>{products.map(p => <option key={p.id} value={p.id}>{p.productCode} · {p.name}</option>)}</select></div>
            <div><label className={label}>Batch</label><div className="flex gap-1"><input name="batchNo" className={input} required /><button className={btn}>Trace</button></div></div>
          </form>
        </div>
      </div>
    </Section>
    {t && <Section title={`${t.product ? `${t.product.productCode} · ${t.product.name}` : 'Pallet'}${t.batchNo ? ` · batch ${t.batchNo}` : ''}`}><TraceView t={t} /></Section>}
  </>;
}

function TraceView({ t }: { t: any }) {
  if (!t) return null;
  const tot = t.totals || {};
  return <div className="space-y-4">
    <div className="grid gap-2 text-sm md:grid-cols-5">
      <div className="rounded-xl bg-slate-50 p-2">Pallets<br /><b className="text-lg">{tot.pallets}</b></div>
      <div className="rounded-xl bg-slate-50 p-2">In the building<br /><b className="text-lg">{num(tot.inBuilding)}</b></div>
      <div className="rounded-xl bg-slate-50 p-2">Of which not good<br /><b className="text-lg">{num(tot.notGood)}</b></div>
      <div className="rounded-xl bg-slate-50 p-2">Dispatched<br /><b className="text-lg">{num(tot.dispatched)}</b></div>
      <div className="rounded-xl bg-slate-50 p-2">Disposed of<br /><b className="text-lg">{num(tot.disposed)}</b></div>
    </div>
    <div><h3 className="font-semibold">Came from</h3>
      <Table rows={t.receipts || []} empty="No receipt note (received before receipt notes, see below)." cols={[
        { key: 'receiptNo', label: 'Receipt note' }, { key: 'postedAt', label: 'Posted', render: x => when(x.postedAt) }, { key: 'supplierName', label: 'Supplier', render: x => `${x.supplierName || '-'} ${x.supplierInvoiceNo || ''}` },
        { key: 'vehicleNumber', label: 'Truck' }, { key: 'noticeNo', label: 'Notice' }, { key: 'gate', label: 'Gate', render: x => `${x.gateTemperatureC == null ? '-' : fmtTemp(x.gateTemperatureC)} · seal ${x.sealNo || '-'}${x.sealIntact === false ? ' BROKEN' : ''}` },
        { key: 'receivedTemperatureC', label: `At receipt ${unitNow('temp')}`, right: true, render: x => x.receivedTemperatureC == null ? '-' : fmtTempNumber(x.receivedTemperatureC) }, { key: 'quantity', label: 'Quantity', right: true, render: x => num(x.quantity) }, { key: 'condition', label: 'Condition', render: x => `${x.condition}${x.conditionNote ? ': ' + x.conditionNote : ''}` },
      ]} />
      {t.directReceipts?.length > 0 && <div className="mt-1 text-sm">Received directly: {t.directReceipts.map((x: any) => `${x.palletCode} ${num(x.quantity)} on ${when(x.at)} by ${x.userName}${x.note ? ` (${x.note})` : ''}`).join('; ')}</div>}
      {t.returns?.length > 0 && <div className="mt-1 text-sm">Returns: {t.returns.map((x: any) => `${x.returnNo} from ${x.customerName || x.source} ${num(x.quantity)} (${x.grade || 'not graded'})`).join('; ')}</div>}
    </div>
    <div><h3 className="font-semibold">Went to</h3>
      <Table rows={t.dispatches || []} empty="Nothing dispatched." cols={[
        { key: 'orderNo', label: 'Order' }, { key: 'consigneeName', label: 'Consignee', render: x => `${x.consigneeName || '-'}, ${x.consigneeCity || ''}` }, { key: 'customerRef', label: 'Customer ref' },
        { key: 'dispatchedAt', label: 'Dispatched', render: x => when(x.dispatchedAt) }, { key: 'gatePassNo', label: 'Gate pass' }, { key: 'vehicleNumber', label: 'Truck', render: x => `${x.vehicleNumber || '-'}${x.tripNumber ? ` · trip ${x.tripNumber}` : ''}` },
        { key: 'pallets', label: 'Pallets', right: true }, { key: 'quantity', label: 'Quantity', right: true, render: x => num(x.quantity) },
      ]} />
      {t.transfers?.length > 0 && <div className="mt-1 text-sm">Transfers: {t.transfers.map((x: any) => `${x.transferNo} ${x.fromWarehouse} → ${x.toWarehouse}${x.transferType === 'OWNER' ? ` (${x.fromPartner} → ${x.toPartner})` : ''} ${num(x.quantity)} ${x.status}`).join('; ')}</div>}
      {t.disposals?.length > 0 && <div className="mt-1 text-sm">Disposals: {t.disposals.map((x: any) => `${x.disposalNo} ${x.method} ${num(x.quantity)} ${x.status}${x.certificateNo ? ` cert. ${x.certificateNo}` : ''}`).join('; ')}</div>}
    </div>
    <div><h3 className="font-semibold">Pallets now</h3>
      <Table rows={t.pallets || []} cols={[
        { key: 'palletCode', label: 'Pallet' }, { key: 'partnerName', label: 'Partner' }, { key: 'quantity', label: 'Quantity', right: true, render: x => qty(x.quantity, x.uom) },
        { key: 'expiryDate', label: 'Expiry', render: x => day(x.expiryDate) }, { key: 'place', label: 'Where', render: x => [x.warehouseName, x.chamberName, x.binCode].filter(Boolean).join(' · ') },
        { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> }, { key: 'stockState', label: 'State', render: x => <><span className={pill(x.stockState)}>{x.stockState}</span> <span className="text-xs">{x.stateReason}</span></> },
      ]} />
    </div>
    <details><summary className="cursor-pointer font-semibold">History ({(t.timeline || []).length} movements)</summary>
      <Table rows={t.timeline || []} cols={[
        { key: 'at', label: 'Time', render: x => when(x.at) }, { key: 'palletCode', label: 'Pallet' }, { key: 'movementType', label: 'Movement' }, { key: 'quantity', label: 'Qty', right: true, render: x => num(x.quantity) },
        { key: 'where', label: 'Where', render: x => [x.warehouseName, x.binCode].filter(Boolean).join(' · ') }, { key: 'status', label: 'Status', render: x => [x.statusFrom, x.statusTo].filter(Boolean).join(' → ') },
        { key: 'ref', label: 'Reference', render: x => [x.referenceType, x.referenceNo].filter(Boolean).join(' ') }, { key: 'note', label: 'Note' }, { key: 'userName', label: 'By' },
      ]} />
    </details>
  </div>;
}
