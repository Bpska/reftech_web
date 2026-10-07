/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-008 inbound notice, dock appointment, gate entry; REQ-WMS-001 goods inward with batch and expiry.
//   Deliveries   the partner (or staff) announces a delivery with its lines and books a dock slot; the gate records
//                the truck (vehicle, seal, temperature); the truck leaves through the gate.
//   Dock plan    the inbound docks of a day and their booked slots.
//   Receipts     the receipt note of a delivery: what was counted per line (batch, expiry, pallets, weight,
//                temperature, condition, photos, the reason for a difference against the notice). Posting makes the
//                pallets (damaged or held lines come in that way); then print their labels and put them away.
// A Partner login announces its own deliveries, books their slots and sees its receipt notes.
//
// Backend: InboundController (/api/warehouse/inbound/**, /api/warehouse/receipts/**, /api/warehouse/photos).
import { useCallback, useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Field, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, day, input, label, num, palletLabelsHtml, pill, printHtml, qty, when, who } from './wms';
import { LineDraft, LinesEditor, OPS_SCRIPT, Photos, Table, Tabs, iso, opts, post, put, today, usePartners, useProducts, useRunner, useWarehouses } from './wmsOps';
import { fmtTemp, toBaseFields, toShown, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function InboundPage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [tab, setTab] = useState('notices');
  const [ready, setReady] = useState<boolean | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [notices, setNotices] = useState<any[]>([]);
  const [notice, setNotice] = useState<any>(null);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [planDay, setPlanDay] = useState(today());
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (warehouses.length === 1 && !warehouseId) setWarehouseId(String(warehouses[0].id)); }, [warehouses]);

  const loadNotices = useCallback(async () => {
    try {
      const d = await api(`/api/warehouse/inbound?status=${status}${warehouseId ? `&warehouseId=${warehouseId}` : ''}`);
      setReady(d.ready !== false); setNotices(d.notices || []);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [status, warehouseId]);
  const loadReceipts = useCallback(async () => {
    try { const d = await api(`/api/warehouse/receipts${warehouseId ? `?warehouseId=${warehouseId}` : ''}`); setReceipts(d.receipts || []); } catch { setReceipts([]); }
  }, [warehouseId]);
  const loadSchedule = useCallback(async () => {
    if (!warehouseId) { setSchedule(null); return; }
    try { setSchedule(await api(`/api/warehouse/inbound/schedule?warehouseId=${warehouseId}&day=${planDay}`)); } catch { setSchedule(null); }
  }, [warehouseId, planDay]);
  useEffect(() => { void loadNotices(); }, [loadNotices]);
  useEffect(() => { void loadReceipts(); }, [loadReceipts]);
  useEffect(() => { if (tab === 'plan') void loadSchedule(); }, [tab, loadSchedule]);

  const openNotice = async (id: number) => { const n = await r.run(() => api(`/api/warehouse/inbound/${id}`)); if (n) setNotice(n); };
  const openReceipt = async (id: number) => { const x = await r.run(() => api(`/api/warehouse/receipts/${id}`)); if (x) { setReceipt(x); setTab('receipts'); } };
  const refreshNotice = async (x: any) => { setNotice(x); await loadNotices(); };

  if (!me.staff && !me.partner) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Inbound</h1><p className="mt-2 text-slate-600">This page is for RefTech staff and partners.</p></div>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Truck className="h-8 w-8 text-sky-700" />{me.partner ? 'My Deliveries' : 'Inbound & Receipts'}</h1>
    <p className="text-slate-600">{me.partner ? 'Tell the warehouse what is coming and book a dock slot. You see the receipt notes of your deliveries here.'
      : 'Deliveries announced, dock slots, the gate, and the receipt note that makes the pallets.'}</p>
    <Banner msg={r.msg} error={r.error} />
    {ready === false && <NotReady script={OPS_SCRIPT} />}
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <div><label className={label}>Warehouse</label>
        <select className={input} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">All</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
      <Tabs tabs={[['notices', 'Deliveries'], ['plan', 'Dock plan'], ['receipts', 'Receipt notes']]} value={tab} onChange={setTab} />
    </div>

    {tab === 'notices' && <>
      <Section title="Deliveries" right={<div className="flex gap-2">
        <select className={input} value={status} onChange={e => setStatus(e.target.value)}>
          {[['OPEN', 'Open'], ['NOTICED', 'Announced'], ['BOOKED', 'Slot booked'], ['ARRIVED', 'At the gate'], ['RECEIVING', 'Unloading'], ['RECEIVED', 'Received'], ['CLOSED', 'Left'], ['CANCELLED', 'Cancelled'], ['NO_SHOW', 'Not arrived']]
            .map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        <button className={btn} onClick={() => { setCreating(true); setNotice(null); }}>New delivery</button></div>}>
        <Table rows={notices} selected={notice?.id} onRow={x => openNotice(x.id)} cols={[
          { key: 'noticeNo', label: 'Notice' }, { key: 'partnerName', label: 'Partner' }, { key: 'warehouseName', label: 'Warehouse' },
          { key: 'supplierName', label: 'Supplier' }, { key: 'vehicleNumber', label: 'Truck' },
          { key: 'slot', label: 'Slot / expected', render: x => x.slotStart ? `${x.dockCode} ${when(x.slotStart)}` : when(x.expectedAt) },
          { key: 'qty', label: 'Received / expected', right: true, render: x => `${num(x.receivedQty)} / ${num(x.expectedQty)}` },
          { key: 'crossDock', label: 'Cross-dock', render: x => x.crossDock ? 'Yes' : '' },
          { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
        ]} />
      </Section>
      {creating && <NewNotice partners={partners} warehouses={warehouses} defaultWarehouse={warehouseId} partnerLogin={me.partner} partnerId={me.partnerId}
        onCancel={() => setCreating(false)} onSaved={async (n: any) => { setCreating(false); setNotice(n); await loadNotices(); }} r={r} />}
      {notice && <NoticeDetail n={notice} staff={me.staff} r={r} onChanged={refreshNotice} onReceipt={openReceipt} />}
    </>}

    {tab === 'plan' && <Section title="Dock plan" right={<input type="date" className={input} value={planDay} onChange={e => setPlanDay(e.target.value)} />}>
      {!warehouseId ? <div className="text-slate-500">Choose the warehouse.</div> : !schedule?.docks?.length ? <div className="text-slate-500">No inbound docks in this warehouse (Warehouse Layout).</div> :
        <div className="grid gap-3 md:grid-cols-3">{schedule.docks.map((d: any) => <div key={d.id} className="rounded-xl border p-3">
          <div className="font-bold">{d.dockCode} <span className="text-sm font-normal text-slate-500">{d.name}</span></div>
          {!d.slots.length ? <div className="mt-1 text-sm text-slate-500">Free all day</div> :
            d.slots.map((s: any) => <div key={s.id} className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
              <b>{when(s.slotStart).slice(-5)}–{when(s.slotEnd).slice(-5)}</b> {s.partnerName} · {s.vehicleNumber || 'truck not given'} <span className={pill(s.status)}>{s.status}</span>{s.crossDock && ' · cross-dock'}
              <div className="text-xs text-slate-500">{s.noticeNo}</div></div>)}
        </div>)}</div>}
    </Section>}

    {tab === 'receipts' && <>
      <Section title="Receipt notes" right={me.staff && <button className={btnLight} onClick={() => setReceipt({ newDirect: true })}>Receipt without a notice</button>}>
        <Table rows={receipts} selected={receipt?.id} onRow={x => openReceipt(x.id)} cols={[
          { key: 'receiptNo', label: 'Receipt note' }, { key: 'noticeNo', label: 'Notice' }, { key: 'partnerName', label: 'Partner' }, { key: 'warehouseName', label: 'Warehouse' },
          { key: 'vehicleNumber', label: 'Truck' }, { key: 'createdAt', label: 'Opened', render: x => when(x.createdAt) }, { key: 'postedAt', label: 'Posted', render: x => when(x.postedAt) },
          { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
        ]} />
      </Section>
      {receipt?.newDirect && <DirectReceipt partners={partners} warehouses={warehouses} r={r} onCancel={() => setReceipt(null)} onSaved={async (x: any) => { setReceipt(x); await loadReceipts(); }} />}
      {receipt?.id && <ReceiptDetail rc={receipt} staff={me.staff} r={r} onChanged={async (x: any) => { setReceipt(x); await loadReceipts(); await loadNotices(); }} />}
    </>}
  </>;
}

const LINE_FIELDS = [
  { key: 'batchNo', label: 'Batch' }, { key: 'mfgDate', label: 'Mfg date', kind: 'date' as const, width: '9rem' }, { key: 'expiryDate', label: 'Expiry', kind: 'date' as const, width: '9rem' },
  { key: 'quantity', label: 'Quantity', kind: 'number' as const }, { key: 'uom', label: 'Unit' }, { key: 'expectedPallets', label: 'Pallets', kind: 'number' as const },
];

function NewNotice({ partners, warehouses, defaultWarehouse, partnerLogin, partnerId, onCancel, onSaved, r }: any) {
  const [p, setP] = useState(partnerLogin ? String(partnerId || '') : '');
  const [lines, setLines] = useState<LineDraft[]>([{}]);
  const products = useProducts(p);
  const fields: Field[] = [
    ...(partnerLogin ? [] : [{ name: 'partnerId', label: 'Partner', type: 'select', options: opts(partners), required: true } as Field]),
    { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), required: true },
    { name: 'supplierName', label: 'Supplier' }, { name: 'supplierInvoiceNo', label: 'Supplier invoice' },
    { name: 'expectedAt', label: 'Expected at', type: 'text', placeholder: 'yyyy-mm-ddThh:mm', hint: 'Or book a dock slot after saving' },
    { name: 'transporterName', label: 'Transporter' }, { name: 'vehicleNumber', label: 'Truck number' }, { name: 'driverName', label: 'Driver' },
    { name: 'driverPhone', label: 'Driver phone' }, { name: 'expectedSealNo', label: 'Seal number' },
    { name: 'outboundOrderId', label: 'Cross-dock to outbound order (id)', type: 'number', hint: 'Goods go straight out on that order' },
    { name: 'crossDock', label: 'Cross-dock (no putaway)', type: 'checkbox' }, { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ];
  return <Section title="New delivery">
    {!partnerLogin && <div className="mb-3 max-w-sm"><label className={label}>Partner (for the product list)</label>
      <select className={input} value={p} onChange={e => setP(e.target.value)}><option value="">Choose…</option>{partners.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>}
    <h3 className="mb-1 font-semibold">Lines</h3>
    <LinesEditor lines={lines} setLines={setLines} products={products} fields={LINE_FIELDS} />
    <div className="mt-4" />
    <QuickForm fields={fields} initial={{ warehouseId: defaultWarehouse, partnerId: p }} busy={r.busy} submitText="Save the delivery" onCancel={onCancel}
      onSubmit={v => r.run(() => post('/api/warehouse/inbound', { ...v, partnerId: partnerLogin ? undefined : (v.partnerId || p), expectedAt: iso(v.expectedAt),
        lines: lines.filter(l => l.productId).map(l => ({ ...l, quantity: l.quantity, expectedPallets: l.expectedPallets || undefined })) }), onSaved)} />
  </Section>;
}

function NoticeDetail({ n, staff, r, onChanged, onReceipt }: any) {
  const [slot, setSlot] = useState({ dockId: n.dockId ? String(n.dockId) : '', slotStart: '', slotMinutes: '' });
  const act = (path: string, body?: any) => r.run(() => post(`/api/warehouse/inbound/${n.id}/${path}`, body), onChanged);
  const canBook = ['NOTICED', 'BOOKED'].includes(n.status);
  return <Section title={<>{n.noticeNo} <span className={pill(n.status)}>{n.status}</span></>} right={<div className="flex flex-wrap gap-2">
    {staff && ['ARRIVED', 'RECEIVING'].includes(n.status) && <button className={btn} onClick={async () => {
      const x = await r.run(() => post('/api/warehouse/receipts', { noticeId: n.id, lines: n.lines.filter((l: any) => Number(l.receivedQty) === 0).map((l: any) => ({
        noticeLineId: l.id, productId: l.productId, batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate, quantity: l.expectedQty, uom: l.uom, palletCount: l.expectedPallets || 1 })) }));
      if (x) onReceipt(x.id);
    }}>Open the receipt note</button>}
    {staff && ['ARRIVED', 'RECEIVING', 'RECEIVED'].includes(n.status) && <button className={btnLight} onClick={() => act('gate-out')}>Truck left</button>}
    {['NOTICED', 'BOOKED'].includes(n.status) && <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the delivery cancelled?'); if (reason) act('cancel', { reason }); }}>Cancel</button>}
    {staff && ['NOTICED', 'BOOKED'].includes(n.status) && <button className={btnRed} onClick={() => { const reason = window.prompt('Note for "not arrived":', 'Truck did not come'); if (reason) act('cancel', { reason, noShow: true }); }}>Not arrived</button>}
  </div>}>
    <div className="grid gap-1 text-sm md:grid-cols-3">
      <div>Partner: <b>{n.partnerName}</b></div><div>Warehouse: <b>{n.warehouseName}</b></div><div>Supplier: {n.supplierName || '-'} {n.supplierInvoiceNo ? `· invoice ${n.supplierInvoiceNo}` : ''}</div>
      <div>Truck: {n.vehicleNumber || '-'} {n.driverName ? `· ${n.driverName}` : ''} {n.driverPhone || ''}</div><div>Transporter: {n.transporterName || '-'}</div><div>Seal expected: {n.expectedSealNo || '-'}</div>
      <div>Slot: {n.slotStart ? `${n.dockCode}, ${when(n.slotStart)} to ${when(n.slotEnd).slice(-5)}` : 'not booked'}</div><div>Expected: {when(n.expectedAt)}</div>
      <div>{n.crossDock ? <b>Cross-dock{n.outboundOrderNo ? ` to ${n.outboundOrderNo}` : ''}</b> : 'To stock'}</div>
      {n.gateInAt && <div className="md:col-span-3">Gate: in {when(n.gateInAt)} by {n.gateInBy} · truck {n.gateVehicleNumber} · seal {n.gateSealNo || '-'} {n.sealIntact === false ? <b className="text-red-700">BROKEN</b> : n.sealIntact ? 'intact' : ''} · {n.gateTemperatureC != null ? fmtTemp(n.gateTemperatureC) : 'no temperature'} {n.gateRemarks ? `· ${n.gateRemarks}` : ''}{n.gateOutAt ? ` · out ${when(n.gateOutAt)}` : ''}</div>}
      {n.cancelledReason && <div className="md:col-span-3 text-red-700">{n.cancelledReason}</div>}
    </div>
    <div className="mt-3"><Table rows={n.lines} cols={[
      { key: 'lineNo', label: '#' }, { key: 'productName', label: 'Product', render: x => `${x.productCode} · ${x.productName}` }, { key: 'batchNo', label: 'Batch' },
      { key: 'expiryDate', label: 'Expiry', render: x => day(x.expiryDate) }, { key: 'expectedQty', label: 'Expected', right: true, render: x => qty(x.expectedQty, x.uom) },
      { key: 'receivedQty', label: 'Received', right: true, render: x => qty(x.receivedQty, x.uom) }, { key: 'expectedPallets', label: 'Pallets', right: true },
    ]} /></div>
    {n.receipts?.length > 0 && <div className="mt-2 text-sm">Receipt notes: {n.receipts.map((x: any) => <button key={x.id} className="mr-2 text-sky-700 underline" onClick={() => onReceipt(x.id)}>{x.receiptNo} ({x.status})</button>)}</div>}
    {canBook && <div className="mt-4 rounded-xl bg-slate-50 p-3">
      <div className="font-semibold">Book a dock slot</div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <select className={`${input} w-40`} value={slot.dockId} onChange={e => setSlot({ ...slot, dockId: e.target.value })}><option value="">Dock…</option>{(n.docks || []).map((d: any) => <option key={d.id} value={d.id}>{d.dockCode}</option>)}</select>
        <input type="datetime-local" className={`${input} w-56`} value={slot.slotStart} onChange={e => setSlot({ ...slot, slotStart: e.target.value })} />
        <input type="number" placeholder="Minutes" className={`${input} w-28`} value={slot.slotMinutes} onChange={e => setSlot({ ...slot, slotMinutes: e.target.value })} />
        <button className={btn} disabled={r.busy || !slot.dockId || !slot.slotStart} onClick={() => act('book', { dockId: slot.dockId, slotStart: iso(slot.slotStart), slotMinutes: slot.slotMinutes || undefined })}>Book</button>
      </div></div>}
    {staff && canBook && <div className="mt-4 rounded-xl bg-amber-50 p-3">
      <div className="font-semibold">Truck at the gate</div>
      <QuickForm cols={4} busy={r.busy} submitText="Record at the gate" initial={{ vehicleNumber: n.vehicleNumber, driverName: n.driverName, sealNumber: n.expectedSealNo }}
        fields={[{ name: 'vehicleNumber', label: 'Truck number', required: true }, { name: 'driverName', label: 'Driver' }, { name: 'sealNumber', label: 'Seal number' },
          { name: 'sealIntact', label: 'Seal', type: 'select', options: [['true', 'Intact'], ['false', 'Broken / tampered']] },
          { name: 'temperatureC', label: 'Truck temperature', type: 'number', unit: 'temp' }, { name: 'remarks', label: 'Remarks', wide: true }]}
        onSubmit={v => act('gate-in', { ...v, sealIntact: v.sealIntact === '' ? undefined : v.sealIntact === 'true' })} />
    </div>}
    {staff && n.gateInAt && <div className="mt-3"><div className="text-sm font-semibold">Gate photos</div><Photos photos={n.gatePhotos} entityType="GATE" entityId={n.id} onAdded={() => api(`/api/warehouse/inbound/${n.id}`).then(onChanged)} /></div>}
  </Section>;
}

function DirectReceipt({ partners, warehouses, r, onCancel, onSaved }: any) {
  return <Section title="Receipt without a notice">
    <QuickForm busy={r.busy} submitText="Open the receipt note" onCancel={onCancel} fields={[
      { name: 'partnerId', label: 'Partner', type: 'select', options: opts(partners), required: true }, { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), required: true },
      { name: 'vehicleNumber', label: 'Truck number' }, { name: 'supplierName', label: 'Supplier' }, { name: 'supplierInvoiceNo', label: 'Supplier invoice' },
      { name: 'crossDock', label: 'Cross-dock (no putaway)', type: 'checkbox' }, { name: 'remarks', label: 'Remarks', wide: true }]}
      onSubmit={v => r.run(() => post('/api/warehouse/receipts', v), onSaved)} />
  </Section>;
}

const RECEIPT_FIELDS = [
  { key: 'batchNo', label: 'Batch' }, { key: 'serialNo', label: 'Serial' }, { key: 'mfgDate', label: 'Mfg', kind: 'date' as const, width: '9rem' },
  { key: 'expiryDate', label: 'Expiry', kind: 'date' as const, width: '9rem' }, { key: 'quantity', label: 'Quantity (line)', kind: 'number' as const }, { key: 'uom', label: 'Unit' },
  { key: 'palletCount', label: 'Pallets', kind: 'number' as const }, { key: 'weightKg', label: 'Kg (line)', kind: 'number' as const }, { key: 'temperatureC', get label() { return unitNow('temp'); }, kind: 'number' as const }, // REQ-PLT-015: typed in the login's unit
  { key: 'condition', label: 'Condition', kind: 'select' as const, options: [['GOOD', 'Good'], ['DAMAGED', 'Damaged'], ['HOLD', 'Hold']] as [string, string][] },
  { key: 'conditionNote', label: 'What is wrong', width: '10rem' }, { key: 'differenceReason', label: 'Reason for a difference', width: '12rem' },
];

function ReceiptDetail({ rc, staff, r, onChanged }: any) {
  const products = useProducts(rc.partnerId);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [remarks, setRemarks] = useState('');
  useEffect(() => {
    setLines((rc.lines || []).map((l: any) => ({ ...l, mfgDate: l.mfgDate?.slice(0, 10) || '', expiryDate: l.expiryDate?.slice(0, 10) || '', uom: l.uom, condition: l.condition || 'GOOD', temperatureC: toShown('temp', l.temperatureC) })));
    setRemarks(rc.remarks || '');
  }, [rc]);
  const open = rc.status === 'OPEN';
  const reload = () => api(`/api/warehouse/receipts/${rc.id}`).then(onChanged);
  // REQ-PLT-015: the lines carry °C to the server
  const baseLines = () => lines.map(l => toBaseFields(l as any, { temperatureC: 'temp' }));
  const save = () => r.run(() => put(`/api/warehouse/receipts/${rc.id}/lines`, { remarks, lines: baseLines() }), onChanged);
  async function postNote() {
    const saved = await r.run(() => put(`/api/warehouse/receipts/${rc.id}/lines`, { remarks, lines: baseLines() }));
    if (!saved) return;
    let missingReason: string | undefined;
    if (saved.notReceived?.length) {
      const m = window.prompt(`${saved.notReceived.length} line(s) of the notice were not received at all. Why?`);
      if (m === null) return;
      missingReason = m;
    }
    await r.run(() => post(`/api/warehouse/receipts/${rc.id}/post`, { missingReason }), onChanged);
  }
  function printNote() {
    const rows = (rc.lines || []).map((l: any) => `<tr><td>${l.lineNo}</td><td>${l.productCode} ${l.productName}</td><td>${l.batchNo || ''}</td><td>${day(l.expiryDate)}</td><td>${qty(l.quantity, l.uom)}</td><td>${l.expectedQty != null ? qty(l.expectedQty, l.uom) : ''}</td><td>${l.palletCount}</td><td>${l.temperatureC == null ? '' : fmtTemp(l.temperatureC)}</td><td>${l.condition}${l.conditionNote ? ': ' + l.conditionNote : ''}${l.differenceReason ? '<br>' + l.differenceReason : ''}</td></tr>`).join('');
    printHtml(`Receipt note ${rc.receiptNo}`, `<div class="doc"><div class="head"><div><h1>Goods Receipt Note ${rc.receiptNo}</h1><div class="muted">${rc.warehouseName} · ${rc.partnerName}</div></div>
      <div>Notice: ${rc.noticeNo || '-'}<br>Truck: ${rc.vehicleNumber || '-'}<br>Supplier: ${rc.supplierName || '-'} ${rc.supplierInvoiceNo || ''}<br>Posted: ${when(rc.postedAt)}</div></div>
      <table><tr><th>#</th><th>Product</th><th>Batch</th><th>Expiry</th><th>Received</th><th>Expected</th><th>Pallets</th><th>${unitNow('temp')}</th><th>Condition / difference</th></tr>${rows}</table>
      <p>${rc.remarks || ''}</p><div class="sign"><div>Received by</div><div>Driver</div><div>Warehouse manager</div></div></div>`);
  }
  return <Section title={<>{rc.receiptNo} <span className={pill(rc.status)}>{rc.status}</span></>} right={<div className="flex flex-wrap gap-2">
    {staff && open && <button className={btnLight} disabled={r.busy} onClick={save}>Save lines</button>}
    {staff && open && <button className={btn} disabled={r.busy} onClick={postNote}>Post (make the pallets)</button>}
    {staff && open && <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the receipt note cancelled?'); if (reason) r.run(() => post(`/api/warehouse/receipts/${rc.id}/cancel`, { reason }), onChanged); }}>Cancel</button>}
    <button className={btnLight} onClick={printNote}>Print</button>
    {rc.pallets?.length > 0 && staff && <button className={btnLight} onClick={async () => {
      const fresh = await r.run(() => Promise.all(rc.pallets.map((p: any) => post(`/api/warehouse/pallets/${p.id}/label`))));
      if (fresh) printHtml(`Pallet labels ${rc.receiptNo}`, palletLabelsHtml(fresh));
    }}>Print pallet labels</button>}
  </div>}>
    <div className="grid gap-1 text-sm md:grid-cols-3">
      <div>Partner: <b>{rc.partnerName}</b></div><div>Warehouse: <b>{rc.warehouseName}</b> {rc.dockCode ? `· dock ${rc.dockCode}` : ''}</div><div>Notice: {rc.noticeNo || 'none'}</div>
      <div>Truck: {rc.vehicleNumber || '-'}</div><div>Supplier: {rc.supplierName || '-'} {rc.supplierInvoiceNo || ''}</div>
      <div>Gate: {rc.gateTemperatureC != null ? fmtTemp(rc.gateTemperatureC) : '-'} · seal {rc.gateSealNo || '-'} {rc.sealIntact === false ? <b className="text-red-700">BROKEN</b> : ''}</div>
      {rc.crossDock && <div className="font-bold">Cross-dock: pallets go to the outbound order without putaway</div>}
    </div>
    {open && staff ? <div className="mt-3">
      <LinesEditor lines={lines} setLines={setLines} products={products} fields={RECEIPT_FIELDS} fixedProduct={l => !!l.noticeLineId} />
      <div className="mt-2"><label className={label}>Remarks</label><input className={input} value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
      <p className="mt-1 text-xs text-slate-500">Quantity and kg are for the whole line; the line is split evenly over its pallets. Damaged or held lines come in that way. A difference against the notice needs its reason.</p>
    </div> : <div className="mt-3"><Table rows={rc.lines || []} cols={[
      { key: 'lineNo', label: '#' }, { key: 'productName', label: 'Product', render: x => `${x.productCode} · ${x.productName}` }, { key: 'batchNo', label: 'Batch' },
      { key: 'expiryDate', label: 'Expiry', render: x => day(x.expiryDate) }, { key: 'quantity', label: 'Received', right: true, render: x => qty(x.quantity, x.uom) },
      { key: 'expectedQty', label: 'Expected', right: true, render: x => x.expectedQty == null ? '-' : qty(x.expectedQty, x.uom) },
      { key: 'differenceQty', label: 'Difference', right: true, render: x => x.differenceQty == null || Number(x.differenceQty) === 0 ? '' : <b className="text-amber-700">{num(x.differenceQty)}</b> },
      { key: 'palletCount', label: 'Pallets', right: true }, { key: 'temperatureC', label: unitNow('temp'), right: true, render: x => x.temperatureC == null ? '' : fmtTemp(x.temperatureC) },
      { key: 'condition', label: 'Condition', render: x => <><span className={pill(x.condition === 'GOOD' ? 'GOOD' : x.condition)}>{x.condition}</span> {x.conditionNote} {x.differenceReason && <div className="text-xs text-slate-500">{x.differenceReason}</div>}</> },
    ]} /></div>}
    {staff && <div className="mt-3 space-y-1">
      <div className="text-sm font-semibold">Photos</div>
      <div className="flex items-center gap-2 text-sm">Delivery: <Photos photos={rc.photos} entityType="RECEIPT" entityId={rc.id} onAdded={reload} /></div>
      {(rc.lines || []).map((l: any) => <div key={l.id} className="flex items-center gap-2 text-sm">Line {l.lineNo}: <Photos photos={l.photos} entityType="RECEIPT_LINE" entityId={l.id} onAdded={reload} /></div>)}
    </div>}
    {rc.notReceived?.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-2 text-sm">Not received yet: {rc.notReceived.map((l: any) => `line ${l.lineNo} ${l.productName} ${qty(l.expectedQty, l.uom)}`).join('; ')}</div>}
    {rc.pallets?.length > 0 && <div className="mt-3"><div className="text-sm font-semibold">Pallets made</div><Table rows={rc.pallets} cols={[
      { key: 'palletCode', label: 'Pallet' }, { key: 'productName', label: 'Product' }, { key: 'batchNo', label: 'Batch' }, { key: 'quantity', label: 'Quantity', right: true, render: x => qty(x.quantity, x.uom) },
      { key: 'stockState', label: 'State', render: x => <span className={pill(x.stockState)}>{x.stockState}</span> }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      { key: 'suggestedBinCode', label: 'Put away to', render: x => x.binCode || x.suggestedBinCode || '-' },
    ]} /></div>}
  </Section>;
}
