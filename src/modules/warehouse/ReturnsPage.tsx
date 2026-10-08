/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-013 -- returns, damage and disposal.
//   Returns    goods back from a customer, a trip or inside the warehouse come in ON HOLD (expired goods too). Each
//              pallet is graded: back to good stock (Manager), keep on hold, damaged, or dispose of.
//   Disposals  pallets on hold or damaged are listed for disposal (destroy, return to owner, donate, salvage); a
//              Manager other than the requester approves; recording it as done (certificate, witness, agency,
//              photos) takes the pallets out of stock.
// A Partner login sees its own returns and disposals.
//
// Backend: ReturnsController (/api/warehouse/returns/**, /api/warehouse/disposals/**).
import { useCallback, useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, day, input, label, num, pill, qty, when, who } from './wms';
import { LineDraft, LinesEditor, OPS_SCRIPT, Photos, Table, Tabs, codes, opts, post, usePartners, useProducts, useRunner, useWarehouses } from './wmsOps';
import { fmtTemp, toBaseFields, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const METHODS: [string, string][] = [['DESTROY', 'Destroy'], ['RETURN_TO_OWNER', 'Return to the owner'], ['DONATE', 'Donate'], ['SALVAGE', 'Salvage']];

export function ReturnsPage() {
  const me = who();
  const r = useRunner();
  const [tab, setTab] = useState('returns');
  if (!me.staff && !me.partner) return null;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Undo2 className="h-8 w-8 text-sky-700" />Returns & Disposal</h1>
    <p className="text-slate-600">Returned goods come in on hold and are graded; damaged, expired or held goods are disposed of with approval and a record.</p>
    <Banner msg={r.msg} error={r.error} />
    <Tabs tabs={[['returns', 'Returns'], ['disposals', 'Disposals']]} value={tab} onChange={setTab} />
    {tab === 'returns' ? <Returns r={r} me={me} /> : <Disposals r={r} me={me} />}
  </>;
}

function Returns({ r, me }: any) {
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [ready, setReady] = useState<boolean | null>(null);
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [partnerId, setPartnerId] = useState('');
  const products = useProducts(partnerId);
  const [lines, setLines] = useState<LineDraft[]>([{}]);
  const [grades, setGrades] = useState<Record<number, { grade: string; note: string }>>({});
  const load = useCallback(async () => {
    try { const d = await api(`/api/warehouse/returns?status=${status}`); setReady(d.ready !== false); setList(d.returns || []); } catch (x) { r.setError(String((x as Error).message)); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/returns/${id}`)); if (d) { setSel(d); setGrades({}); } };
  const changed = async (d: any) => { setSel(d); setGrades({}); await load(); };
  return <>
    {ready === false && <NotReady script={OPS_SCRIPT} />}
    {me.staff && <Section title="Receive a return">
      <div className="mb-2 max-w-xs"><label className={label}>Partner</label><select className={input} value={partnerId} onChange={e => setPartnerId(e.target.value)}><option value="">Choose…</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <h3 className="mb-1 font-semibold">What came back</h3>
      <LinesEditor lines={lines} setLines={setLines} products={products} fields={[
        { key: 'dispatchedPalletCode', label: 'Dispatched pallet (optional)' }, { key: 'batchNo', label: 'Batch' }, { key: 'expiryDate', label: 'Expiry', kind: 'date', width: '9rem' },
        { key: 'quantity', label: 'Quantity per pallet', kind: 'number' }, { key: 'uom', label: 'Unit' }, { key: 'palletCount', label: 'Pallets', kind: 'number' },
        { key: 'weightKg', label: 'Kg per pallet', kind: 'number' }, { key: 'temperatureC', label: unitNow('temp'), kind: 'number' }]} />
      <p className="text-xs text-slate-500">With the dispatched pallet's label, its product, batch and expiry are taken from it.</p>
      <div className="mt-3" />
      <QuickForm key={partnerId} busy={r.busy} submitText="Receive (on hold)" fields={[
        { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), required: true },
        { name: 'source', label: 'From', type: 'select', options: [['CUSTOMER', 'Customer'], ['TRIP', 'Trip (refused at delivery)'], ['INTERNAL', 'Inside the warehouse']], required: true },
        { name: 'outboundOrderId', label: 'Outbound order id', type: 'number' }, { name: 'customerName', label: 'Customer' }, { name: 'customerRef', label: 'Customer reference' },
        { name: 'vehicleNumber', label: 'Truck' }, { name: 'reason', label: 'Why it came back', required: true, wide: true }]}
        onSubmit={(v, f) => r.run(() => post('/api/warehouse/returns', { ...v, partnerId, lines: lines.filter(l => l.productId || l.dispatchedPalletCode).map(l => toBaseFields(l as any, { temperatureC: 'temp' })) }) /* REQ-PLT-015: typed in the login's unit */,
          async (d: any) => { f.reset(); setLines([{}]); await changed(d); })} />
    </Section>}
    <Section title="Returns" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}>
      {[['OPEN', 'To grade'], ['GRADED', 'Graded'], ['CLOSED', 'Closed'], ['', 'All']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
      <Table rows={list} selected={sel?.id} onRow={x => open(x.id)} cols={[
        { key: 'returnNo', label: 'Return' }, { key: 'partnerName', label: 'Partner' }, { key: 'warehouseName', label: 'Warehouse' }, { key: 'source', label: 'From', render: x => `${x.source}${x.customerName ? ' · ' + x.customerName : ''}` },
        { key: 'orderNo', label: 'Order' }, { key: 'pallets', label: 'Pallets', right: true }, { key: 'ungraded', label: 'To grade', right: true },
        { key: 'createdAt', label: 'Received', render: x => when(x.createdAt) }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      ]} />
    </Section>
    {sel && <Section title={<>{sel.returnNo} <span className={pill(sel.status)}>{sel.status}</span></>} right={me.staff && <div className="flex gap-2">
      {sel.status !== 'CLOSED' && <button className={btn} disabled={r.busy || !Object.values(grades).some(g => g.grade)} onClick={() => {
        const list = Object.entries(grades).filter(([, g]) => g.grade).map(([lineId, g]) => ({ lineId: Number(lineId), grade: g.grade, note: g.note || undefined }));
        const method = list.some(g => g.grade === 'DISPOSE') ? window.prompt('Disposal method: DESTROY, RETURN_TO_OWNER, DONATE or SALVAGE', 'DESTROY') : undefined;
        if (method === null) return;
        void r.run(() => post(`/api/warehouse/returns/${sel.id}/grade`, { grades: list, disposalMethod: method || undefined }), changed);
      }}>Save grades</button>}
      {sel.status === 'GRADED' && <button className={btnLight} onClick={() => r.run(() => post(`/api/warehouse/returns/${sel.id}/close`), changed)}>Close</button>}
    </div>}>
      <div className="text-sm">{sel.partnerName} · {sel.warehouseName} · from {sel.source}{sel.customerName ? ` (${sel.customerName}${sel.customerRef ? ', ' + sel.customerRef : ''})` : ''}{sel.orderNo ? ` · order ${sel.orderNo}` : ''} · {sel.reason}</div>
      <div className="mt-3"><Table rows={sel.lineList || []} cols={[
        { key: 'palletCode', label: 'Pallet' }, { key: 'productName', label: 'Product', render: x => `${x.productCode} · ${x.productName}` }, { key: 'batchNo', label: 'Batch' },
        { key: 'expiryDate', label: 'Expiry', render: x => <span className={x.daysToExpiry != null && x.daysToExpiry < 0 ? 'font-bold text-red-700' : ''}>{day(x.expiryDate)}</span> },
        { key: 'quantity', label: 'Quantity', right: true, render: x => qty(x.quantity, x.uom) }, { key: 'temperatureC', label: unitNow('temp'), right: true, render: x => x.temperatureC == null ? '' : fmtTemp(x.temperatureC) },
        { key: 'stockState', label: 'Now', render: x => <><span className={pill(x.stockState)}>{x.stockState}</span> <span className={pill(x.palletStatus)}>{x.palletStatus}</span></> },
        { key: 'grade', label: 'Grade', render: x => x.grade && !me.staff ? x.grade : !me.staff || sel.status === 'CLOSED' ? (x.grade || '-') : <div className="flex gap-1">
          <select className="rounded-lg border px-1 py-0.5" value={grades[x.id]?.grade ?? ''} onChange={e => setGrades({ ...grades, [x.id]: { grade: e.target.value, note: grades[x.id]?.note || '' } })}>
            <option value="">{x.grade ? `${x.grade} (keep)` : 'Grade…'}</option>{me.manager && <option value="RESTOCK">Back to good stock</option>}
            <option value="HOLD">Keep on hold</option><option value="DAMAGED">Damaged</option><option value="DISPOSE">Dispose of</option></select>
          <input className="w-32 rounded-lg border px-1 py-0.5" placeholder="Note" value={grades[x.id]?.note ?? ''} onChange={e => setGrades({ ...grades, [x.id]: { grade: grades[x.id]?.grade || '', note: e.target.value } })} />
        </div> },
        { key: 'gradedBy', label: 'Graded', render: x => x.gradedBy ? `${x.gradedBy} ${when(x.gradedAt)}${x.gradeNote ? ': ' + x.gradeNote : ''}` : '' },
      ]} /></div>
      {sel.disposals?.length > 0 && <div className="mt-2 text-sm">Disposals: {sel.disposals.map((d: any) => `${d.disposalNo} (${d.method}, ${d.status})`).join('; ')}</div>}
      {me.staff && <div className="mt-3 flex items-center gap-2 text-sm">Photos: <Photos photos={sel.photos} entityType="RETURN" entityId={sel.id} onAdded={() => open(sel.id)} /></div>}
    </Section>}
  </>;
}

function Disposals({ r, me }: any) {
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const load = useCallback(async () => { try { const d = await api(`/api/warehouse/disposals?status=${status}`); setList(d.disposals || []); } catch { setList([]); } }, [status]);
  useEffect(() => { void load(); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/disposals/${id}`)); if (d) setSel(d); };
  const changed = async (d: any) => { setSel(d); await load(); };
  const act = (path: string, body?: any) => r.run(() => post(`/api/warehouse/disposals/${sel.id}/${path}`, body), changed);
  return <>
    {me.staff && <Section title="Request a disposal">
      <QuickForm busy={r.busy} submitText="Request" fields={[
        { name: 'palletCodes', label: 'Pallets on hold or damaged (scan or type the labels)', type: 'textarea', required: true, wide: true },
        { name: 'method', label: 'Method', type: 'select', options: METHODS, required: true }, { name: 'reason', label: 'Reason', required: true, wide: true }]}
        onSubmit={(v, f) => r.run(() => post('/api/warehouse/disposals', { ...v, palletCodes: codes(v.palletCodes) }), async (d: any) => { f.reset(); await changed(d); })} />
    </Section>}
    <Section title="Disposals" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}>
      {[['OPEN', 'Open'], ['REQUESTED', 'Waiting for approval'], ['APPROVED', 'Approved'], ['DONE', 'Done'], ['REJECTED', 'Rejected']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
      <Table rows={list} selected={sel?.id} onRow={x => open(x.id)} cols={[
        { key: 'disposalNo', label: 'Disposal' }, { key: 'partnerName', label: 'Partner' }, { key: 'warehouseName', label: 'Warehouse' }, { key: 'method', label: 'Method' },
        { key: 'pallets', label: 'Pallets', right: true }, { key: 'quantity', label: 'Quantity', right: true, render: x => num(x.quantity) }, { key: 'weightKg', label: 'Kg', right: true, render: x => num(x.weightKg) },
        { key: 'requestedAt', label: 'Requested', render: x => `${when(x.requestedAt)} · ${x.requestedByName}` }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      ]} />
    </Section>
    {sel && <Section title={<>{sel.disposalNo} <span className={pill(sel.status)}>{sel.status}</span></>} right={me.staff && <div className="flex gap-2">
      {sel.status === 'REQUESTED' && me.manager && <button className={btn} onClick={() => act('approve', { note: window.prompt('Note (optional)') || undefined })}>Approve</button>}
      {sel.status === 'REQUESTED' && me.manager && <button className={btnRed} onClick={() => { const note = window.prompt('Why is it rejected?'); if (note) void act('reject', { note }); }}>Reject</button>}
    </div>}>
      <div className="grid gap-1 text-sm md:grid-cols-3">
        <div>{sel.partnerName} · {sel.warehouseName}</div><div>Method: <b>{sel.method}</b></div><div>{sel.reason}</div>
        <div>Requested by {sel.requestedByName} {when(sel.requestedAt)}</div>
        {sel.decidedAt && <div>{sel.status === 'REJECTED' ? 'Rejected' : 'Approved'} by {sel.decidedByName} {when(sel.decidedAt)} {sel.decisionNote || ''}</div>}
        {sel.doneAt && <div>Done {when(sel.doneAt)} by {sel.doneByName} · certificate {sel.certificateNo || '-'} · witness {sel.witnessName || '-'} · {sel.disposalAgency || ''} {sel.doneNote || ''}</div>}
      </div>
      <div className="mt-3"><Table rows={sel.palletList || []} cols={[
        { key: 'palletCode', label: 'Pallet' }, { key: 'productName', label: 'Product', render: x => `${x.productCode} · ${x.productName}` }, { key: 'batchNo', label: 'Batch' },
        { key: 'expiryDate', label: 'Expiry', render: x => day(x.expiryDate) }, { key: 'quantity', label: 'Quantity', right: true, render: x => qty(x.quantity, x.uom) }, { key: 'weightKg', label: 'Kg', right: true },
        { key: 'stockState', label: 'State', render: x => <><span className={pill(x.stockState)}>{x.stockState}</span> <span className="text-xs">{x.stateReason}</span></> }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      ]} /></div>
      {me.staff && sel.status === 'APPROVED' && <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-1 font-semibold">Record the disposal</div>
        <QuickForm cols={4} busy={r.busy} submitText="Done: take out of stock" fields={[{ name: 'certificateNo', label: 'Certificate number' }, { name: 'witnessName', label: 'Witness' },
          { name: 'disposalAgency', label: 'Agency' }, { name: 'note', label: 'Note' }]} onSubmit={v => act('done', v)} />
        <p className="text-xs text-slate-500">A destruction needs the certificate number or a witness.</p></div>}
      {me.staff && <div className="mt-3 flex items-center gap-2 text-sm">Photos: <Photos photos={sel.photos} entityType="DISPOSAL" entityId={sel.id} onAdded={() => open(sel.id)} /></div>}
    </Section>}
  </>;
}
