/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-011 -- Outbound orders: order -> reserve (first expiry first out, honouring the minimum life on
// dispatch) -> pick by scanning (part of a pallet is split onto a new pallet with its own label) -> stage
// at an outbound dock -> link the trip (its truck must hold every product) -> load by scanning -> loading
// check (all loaded, truck temperature in range, pre-cooled, clean, seal) -> gate pass (stock leaves the
// warehouse and shows as in transit until the trip completes). A Manager can cancel an order; picked
// pallets then go back to Putaway.
// REQ-WMS-003 (script 48): the customer's minimum shelf life on the order or a line, the batches first expiry first
// out proposes while typing a line (a later batch needs a reason), and swapping the pallet of a pick line (a
// later expiry needs a reason). REQ-WMS-017 (script 48): cross-docking received pallets straight to the dock.
//
// Backend: OutboundController (/api/warehouse/outbound/**).
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Field, NotReady, QuickForm, ScanBox, Section } from '@/shared/components/FormKit';
import { barcodeSvg, escapeXml } from './barcode';
import { btn, btnLight, btnRed, day, errorText, input, num, palletLabelsHtml, pill, printHtml, qty, td, th, when, who } from './wms';
import { fmtTemp } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const STEPS = ['DRAFT', 'RESERVED', 'PICKING', 'PICKED', 'STAGED', 'LOADED', 'DISPATCHED'];
type Line = { productId: string; quantity: string; uom: string; batchNo: string; batchReason?: string; minLifeDays?: string };
const e = (v: unknown) => escapeXml(v === null || v === undefined ? '-' : String(v));

function pickListHtml(o: any) {
  return `<div class="doc"><div class="head"><div><h1>Pick list ${e(o.orderNo)}</h1><div class="muted">${e(o.warehouseName)} · ${e(o.partnerName)} · for ${e(o.consigneeName)}, ${e(o.consigneeCity)}</div>
    <div class="muted">Required ${e(day(o.requiredDate))} · printed ${e(when(new Date().toISOString()))}</div></div><div>${barcodeSvg(o.orderNo, 50, 1.5)}</div></div>
    <table><tr><th>#</th><th>Bin</th><th>Pallet</th><th>Product</th><th>Batch</th><th>Expiry</th><th>Pick</th><th>Done</th></tr>
    ${o.tasks.filter((k: any) => k.status !== 'CANCELLED').map((k: any, i: number) => `<tr><td>${i + 1}</td><td><b>${e(k.binCode)}</b></td><td>${e(k.palletCode)}</td><td>${e(k.productName)}</td>
      <td>${e(k.batchNo)}</td><td>${e(day(k.expiryDate))}</td><td><b>${e(qty(k.quantity, k.uom))}</b></td><td>${k.status === 'OPEN' ? '☐' : '☑'}</td></tr>`).join('')}</table>
    <div class="sign"><div>Picked by</div><div>Checked by</div></div></div>`;
}

function gatePassHtml(o: any) {
  const pallets = o.tasks.filter((k: any) => k.pickedPalletCode && k.status !== 'CANCELLED');
  return `<div class="doc"><div class="head"><div><h1>GATE PASS ${e(o.gatePassNo)}</h1><div class="muted">${e(o.warehouseName)}${o.warehouseCity ? ', ' + e(o.warehouseCity) : ''} · RefTech</div></div>
    <div>${barcodeSvg(String(o.gatePassNo || o.orderNo), 50, 1.5)}</div></div>
    <table><tr><th>Order</th><td>${e(o.orderNo)}${o.customerRef ? ' · ref ' + e(o.customerRef) : ''}</td><th>Issued</th><td>${e(when(o.gatePassAt))} by ${e(o.gatePassBy)}</td></tr>
    <tr><th>Partner</th><td>${e(o.partnerName)}</td><th>Consignee</th><td>${e(o.consigneeName)}<br>${e(o.consigneeAddress || o.consigneeCity)}</td></tr>
    <tr><th>Trip</th><td>${e(o.tripNumber)} (${e(o.tripFrom)} to ${e(o.tripTo)})</td><th>Truck / driver</th><td>${e(o.vehicleNumber)} · ${e(o.driverName)}</td></tr>
    <tr><th>Truck reading</th><td>${e(fmtTemp(o.truckTemperatureC))} · pre-cooled ${o.truckPrecooled ? 'yes' : 'no'} · clean ${o.truckClean ? 'yes' : 'no'}</td><th>Seal</th><td><b>${e(o.sealNumber)}</b></td></tr></table>
    <table><tr><th>#</th><th>Product</th><th>Ordered</th><th>Loaded</th><th>Kg</th></tr>${o.lines.map((l: any) => `<tr><td>${l.lineNo}</td><td>${e(l.productName)} (${e(l.productCode)})</td>
      <td>${e(qty(l.quantity, l.uom))}</td><td><b>${e(qty(l.loadedQty, l.uom))}</b></td><td>${l.loadedKg ? e(num(l.loadedKg)) : ''}</td></tr>`).join('')}</table>
    <table><tr><th>Pallet</th><th>Product</th><th>Batch</th><th>Expiry</th><th>Quantity</th></tr>${pallets.map((k: any) => `<tr><td>${e(k.pickedPalletCode)}</td><td>${e(k.productName)}</td>
      <td>${e(k.batchNo)}</td><td>${e(day(k.expiryDate))}</td><td>${e(qty(k.quantity, k.uom))}${k.pickedWeightKg ? ' · ' + e(num(k.pickedWeightKg)) + ' kg' : ''}</td></tr>`).join('')}</table>
    ${o.loadingRemarks ? `<p>Remarks: ${e(o.loadingRemarks)}</p>` : ''}
    <div class="sign"><div>Warehouse</div><div>Driver</div><div>Security gate</div></div></div>`;
}

export function OutboundOrdersPage() {
  const me = who();
  const [params, setParams] = useSearchParams();
  const orderId = Number(params.get('order') || 0);
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try { setList(await api(`/api/warehouse/outbound${status ? `?status=${status}` : ''}`)); }
    catch (x) { setError(errorText(x, 'Could not load the orders')); }
  }, [status]);
  const loadOrder = useCallback(async () => {
    if (!orderId) { setOrder(null); return; }
    try { setOrder(await api(`/api/warehouse/outbound/${orderId}`)); }
    catch (x) { setError(errorText(x, 'Could not load the order')); }
  }, [orderId]);
  useEffect(() => { if (me.staff) void loadList(); }, [loadList]);
  useEffect(() => { if (me.staff) void loadOrder(); }, [loadOrder]);
  useEffect(() => {
    if (!me.staff) return;
    api('/api/operations/partners').then(p => setPartners(Array.isArray(p) ? p : [])).catch(() => setPartners([]));
    api('/api/warehouse/layout').then(d => setWarehouses((d.warehouses || []).filter((w: any) => w.active))).catch(() => setWarehouses([]));
    api('/api/warehouse/outbound/trips').then(t => setTrips(Array.isArray(t) ? t : [])).catch(() => setTrips([]));
  }, []);

  /** Runs one step on the open order; the backend answers with the whole order and a message. On a refusal: { failed: reason }. */
  async function act(path: string, body?: unknown): Promise<any> {
    setBusy(true); setMsg(''); setError('');
    try {
      const r = await api(`/api/warehouse/outbound/${orderId}/${path}`, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
      setOrder(r); setMsg(r.message || ''); void loadList(); return r;
    } catch (x) { const m = errorText(x, 'Could not complete the step'); setError(m); return { failed: m }; }
    finally { setBusy(false); }
  }

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Outbound Orders</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Truck className="h-8 w-8 text-sky-700" />Outbound Orders</h1>
    <p className="text-slate-600">Reserve, pick, stage, load, check and dispatch with a gate pass.</p>
    <Banner msg={msg} error={error} />
    {list && !list.ready && <NotReady script="database_v2/30_req_wms_006_011_warehouse.sql" />}
    {list?.ready && <>
      {creating && <CreateOrder partners={partners} warehouses={warehouses} busy={busy} onCancel={() => setCreating(false)} onCreated={o => {
        setCreating(false); setMsg(`Order ${o.orderNo} created. Reserve stock next.`); void loadList(); setParams({ order: String(o.id) });
      }} setError={setError} setBusy={setBusy} />}
      {order && <OrderDetail o={order} me={me} trips={trips} busy={busy} act={act} onClose={() => setParams({})} />}
      <Section title="Orders" right={<div className="flex gap-2">
        <select value={status} onChange={x => setStatus(x.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
          <option value="OPEN">Open</option>{[...STEPS, 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}<option value="">All</option></select>
        {me.staff && <button onClick={() => setCreating(true)} className={btn}>New order</button>}</div>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Order</th><th className={th}>Partner</th><th className={th}>Consignee</th><th className={th}>Required</th>
            <th className={`${th} text-right`}>Ordered</th><th className={`${th} text-right`}>Loaded</th><th className={th}>Trip</th><th className={th}>Status</th></tr></thead>
          <tbody>{list.orders.map((o: any) => <tr key={o.id} onClick={() => setParams({ order: String(o.id) })} className={`cursor-pointer border-t hover:bg-sky-50 ${o.id === orderId ? 'bg-sky-50' : ''}`}>
            <td className={`${td} font-mono font-bold text-sky-800`}>{o.orderNo}{o.customerRef && <div className="font-sans text-xs font-normal text-slate-500">{o.customerRef}</div>}</td>
            <td className={td}>{o.partnerName}<div className="text-xs text-slate-500">{o.warehouseName}</div></td>
            <td className={td}>{o.consigneeName || '-'}<div className="text-xs text-slate-500">{o.consigneeCity || ''}</div></td>
            <td className={td}>{day(o.requiredDate)}</td><td className={`${td} text-right`}>{num(o.orderedQty)}</td><td className={`${td} text-right`}>{num(o.loadedQty)}</td>
            <td className={td}>{o.tripNumber || '-'}{o.vehicleNumber && <div className="text-xs text-slate-500">{o.vehicleNumber}</div>}</td>
            <td className={td}><span className={pill(o.status)}>{o.status}</span>{o.gatePassNo && <div className="text-xs">{o.gatePassNo}</div>}</td>
          </tr>)}
            {list.orders.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>No orders.</td></tr>}</tbody></table></div>
      </Section>
    </>}
  </>;
}

function CreateOrder({ partners, warehouses, busy, onCancel, onCreated, setError, setBusy }: {
  partners: any[]; warehouses: any[]; busy: boolean; onCancel: () => void; onCreated: (o: any) => void; setError: (s: string) => void; setBusy: (b: boolean) => void;
}) {
  const [partnerId, setPartnerId] = useState(partners.length === 1 ? String(partners[0].id) : '');
  const [products, setProducts] = useState<any[]>([]);
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: '', uom: '', batchNo: '' }]);
  useEffect(() => {
    if (!partnerId) { setProducts([]); return; }
    api(`/api/warehouse/products?partnerId=${partnerId}`).then(r => setProducts((r.products || []).filter((p: any) => p.active))).catch(() => setProducts([]));
  }, [partnerId]);
  const setLine = (i: number, k: keyof Line, v: string) => setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: v, ...(k === 'productId' ? { uom: '' } : {}) } : l));
  const fields: Field[] = [
    { name: 'warehouseId', label: 'Warehouse', type: 'select', required: true, options: warehouses.map(w => [w.id, w.name]) },
    { name: 'customerRef', label: 'Customer reference (SO / PO)' }, { name: 'requiredDate', label: 'Required on', type: 'date' },
    { name: 'consigneeName', label: 'Consignee' }, { name: 'consigneeCity', label: 'City' }, { name: 'consigneeAddress', label: 'Address' },
    { name: 'minLifeDays', label: "Customer's minimum shelf life (days)", type: 'number', hint: 'Empty: the product minimum only' },
    { name: 'crossDock', label: 'Cross-dock (goods arriving for this order go straight to the dock)', type: 'checkbox' },
    { name: 'notes', label: 'Notes', wide: true },
  ];
  const [whId, setWhId] = useState(warehouses.length === 1 ? String(warehouses[0].id) : '');
  const [fefo, setFefo] = useState<{ i: number; d: any } | null>(null);
  async function showFefo(i: number) {
    const l = lines[i];
    if (!partnerId || !whId || !l.productId) { setError('Choose the partner, the warehouse and the product first'); return; }
    try { setFefo({ i, d: await api(`/api/warehouse/outbound/fefo?warehouseId=${whId}&partnerId=${partnerId}&productId=${l.productId}${l.minLifeDays ? `&minLifeDays=${l.minLifeDays}` : ''}`) }); }
    catch (x) { setError(errorText(x, 'Could not load the batches')); }
  }
  async function submit(v: Record<string, unknown>) {
    setBusy(true); setError('');
    try {
      const body = { ...v, partnerId, lines: lines.filter(l => l.productId).map(l => ({ productId: l.productId, quantity: l.quantity, uom: l.uom || null, batchNo: l.batchNo || null,
        batchReason: l.batchReason || null, minLifeDays: l.minLifeDays || null })) };
      onCreated(await api('/api/warehouse/outbound', { method: 'POST', body: JSON.stringify(body) }));
    } catch (x) { setError(errorText(x, 'Could not create the order')); }
    finally { setBusy(false); }
  }
  return <Section title="New outbound order">
    <div className="mb-3 max-w-sm"><label className="mb-1 block text-sm font-semibold text-slate-700">Partner *</label>
      <select value={partnerId} onChange={x => setPartnerId(x.target.value)} className={input}><option value="">Choose</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
    <div className="mb-3 rounded-xl bg-slate-50 p-3"><div className="mb-2 text-sm font-semibold">Lines (one temperature per order: frozen and chilled goods go on separate orders)</div>
      {lines.map((l, i) => { const p = products.find(x => String(x.id) === l.productId); return <div key={i} className="mb-2"><div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto_auto]">
        <select value={l.productId} onChange={x => setLine(i, 'productId', x.target.value)} className={input}><option value="">Product</option>
          {products.map(x => <option key={x.id} value={x.id}>{x.productCode} · {x.name} · {x.temperatureProfileName || '-'}</option>)}</select>
        <input value={l.quantity} onChange={x => setLine(i, 'quantity', x.target.value)} type="number" step="any" placeholder="Quantity" className={input} />
        <select value={l.uom} onChange={x => setLine(i, 'uom', x.target.value)} className={input}><option value="">{p?.baseUom || 'Unit'}</option>
          {(p?.uoms || []).map((u: any) => <option key={u.uom} value={u.uom}>{u.uom} ({Number(u.factorToBase)} {p.baseUom})</option>)}</select>
        <input value={l.batchNo} onChange={x => setLine(i, 'batchNo', x.target.value)} placeholder="Batch (optional)" className={input} />
        <input value={l.minLifeDays || ''} onChange={x => setLine(i, 'minLifeDays', x.target.value)} type="number" placeholder="Min life days" className={input} />
        <button type="button" onClick={() => void showFefo(i)} className={btnLight}>Batches</button>
        <button type="button" onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls)} className={btnLight}>Remove</button>
      </div>
        {l.batchNo && <input value={l.batchReason || ''} onChange={x => setLine(i, 'batchReason', x.target.value)} className={`${input} mt-1`}
          placeholder="Reason for this batch (needed when it expires later than the batch first expiry first out proposes)" />}
        {fefo?.i === i && <div className="mt-1 rounded-lg border bg-white p-2 text-sm">
          <div className="mb-1 flex justify-between"><span>First expiry first out{fefo.d.minLifeDays ? `, at least ${fefo.d.minLifeDays} days of life on dispatch` : ''}</span><button type="button" className="text-slate-500" onClick={() => setFefo(null)}>✕</button></div>
          {(fefo.d.batches || []).length === 0 ? <div className="text-slate-500">No free stock of this product.</div> : <table className="w-full"><thead><tr className="text-slate-600"><th className={th}>Batch</th><th className={th}>Expiry</th><th className={`${th} text-right`}>Days</th><th className={`${th} text-right`}>Free</th><th className={`${th} text-right`}>Pallets</th><th /></tr></thead>
            <tbody>{fefo.d.batches.map((b: any) => <tr key={`${b.batchNo}-${b.expiryDate}`} className={`border-t ${b.proposed ? 'bg-emerald-50 font-semibold' : ''} ${b.meetsMinLife ? '' : 'text-slate-400'}`}>
              <td className={td}>{b.batchNo || '-'}{b.proposed && ' (proposed)'}</td><td className={td}>{day(b.expiryDate)}</td><td className={`${td} text-right`}>{b.daysToExpiry ?? '-'}</td>
              <td className={`${td} text-right`}>{qty(b.freeQty, fefo.d.uom)}</td><td className={`${td} text-right`}>{b.pallets}</td>
              <td className={td}>{b.batchNo && b.meetsMinLife && <button type="button" className={btnLight} onClick={() => { setLine(i, 'batchNo', String(b.batchNo)); setFefo(null); }}>Use</button>}</td></tr>)}</tbody></table>}
          <div className="mt-1 text-xs text-slate-500">Leave the batch empty to let reservation pick first expiry first out by itself. Grey batches have too little life left.</div>
        </div>}
      </div>; })}
      <button type="button" onClick={() => setLines(ls => [...ls, { productId: '', quantity: '', uom: '', batchNo: '' }])} className={btnLight}>Add line</button>
    </div>
    <div className="mb-3 max-w-sm"><label className="mb-1 block text-sm font-semibold text-slate-700">Warehouse *</label>
      <select value={whId} onChange={x => setWhId(x.target.value)} className={input}><option value="">Choose</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
    <QuickForm fields={fields.filter(f => f.name !== 'warehouseId')} busy={busy} submitText="Create order" onCancel={onCancel} onSubmit={v => submit({ ...v, warehouseId: whId })} />
  </Section>;
}

function OrderDetail({ o, me, trips, busy, act, onClose }: {
  o: any; me: ReturnType<typeof who>; trips: any[]; busy: boolean; act: (path: string, body?: unknown) => Promise<any>; onClose: () => void;
}) {
  const [bin, setBin] = useState('');
  const [dock, setDock] = useState('');
  const [tripId, setTripId] = useState('');
  const [arrived, setArrived] = useState<any[] | null>(null);
  const [xd, setXd] = useState<Record<number, boolean>>({});
  useEffect(() => { setBin(''); setDock(o.dockCode || (o.docks?.length === 1 ? o.docks[0].dockCode : '')); setTripId(o.tripId ? String(o.tripId) : ''); setArrived(null); setXd({}); }, [o.id]);
  const canCrossDock = ['DRAFT', 'RESERVED', 'PICKING', 'PICKED', 'STAGED'].includes(o.status);
  async function findArrived() {
    try {
      const d = await api(`/api/warehouse/putaway?warehouseId=${o.warehouseId}`);
      const products = new Set(o.lines.map((l: any) => l.productId));
      setArrived((d.pallets || []).filter((p: any) => p.partnerId === o.partnerId && p.stockState === 'GOOD' && products.has(p.productId)));
    } catch { setArrived([]); }
  }
  function swap(k: any) {
    const palletCode = window.prompt(`Pick line ${k.palletCode} (${qty(k.quantity, k.uom)}): label of the pallet to pick instead`);
    if (!palletCode) return;
    const reason = window.prompt('Reason (needed when that pallet expires later than the one proposed):') || undefined;
    void act(`tasks/${k.id}/swap`, { palletCode, reason });
  }
  const s = o.status;
  const open = o.tasks.filter((k: any) => k.status === 'OPEN');
  const picked = o.tasks.filter((k: any) => k.pickedPalletCode && k.status !== 'CANCELLED');
  const canReserve = ['DRAFT', 'RESERVED'].includes(s);
  const canPick = ['RESERVED', 'PICKING'].includes(s) && open.length > 0;
  const canStage = picked.some((k: any) => k.pickedPalletStatus === 'PICKED');
  const canLoad = !!o.tripId && picked.some((k: any) => ['PICKED', 'STAGED'].includes(k.pickedPalletStatus)) && !['LOADED', 'DISPATCHED', 'CANCELLED'].includes(s);
  const canCheck = !!o.tripId && ['RESERVED', 'PICKING', 'PICKED', 'STAGED'].includes(s) && picked.length > 0;

  async function pickScan(code: string) {
    const c = code.toUpperCase();
    const task = open.find((k: any) => String(k.palletCode).toUpperCase() === c);
    if (!task) { setBin(c); return; }
    const body: any = { taskId: task.id, palletCode: c, binCode: bin || undefined };
    let r = await act('pick', body);
    if (r.failed && /weigh/i.test(r.failed)) {
      const w = window.prompt(`Weight (kg) of the ${num(task.quantity)} ${task.uom} picked from ${c}:`);
      if (w) r = await act('pick', { ...body, weightKg: w });
    }
    setBin('');
    if (r.pickedPallet && r.pickedPallet.palletCode !== task.palletCode && window.confirm(`${r.message}\n\nPrint the label of ${r.pickedPallet.palletCode} now?`))
      printHtml(`Pallet ${r.pickedPallet.palletCode}`, palletLabelsHtml([r.pickedPallet]));
  }
  function loadingCheck(v: Record<string, unknown>) { void act('loading-check', v); }
  function cancel() {
    const reason = window.prompt(`Reason for cancelling order ${o.orderNo}:`);
    if (reason) void act('cancel', { reason });
  }
  async function gatePass() {
    const r = await act('gate-pass');
    if (!r.failed) printHtml(`Gate pass ${r.gatePassNo}`, gatePassHtml(r));
  }
  const checkFields: Field[] = [
    { name: 'truckTemperatureC', label: 'Truck temperature now', type: 'number', required: true, unit: 'temp' },
    { name: 'sealNumber', label: 'Seal number', required: true }, { name: 'remarks', label: 'Remarks' },
    { name: 'truckPrecooled', label: 'Truck pre-cooled', type: 'checkbox' }, { name: 'truckClean', label: 'Truck clean, no smell', type: 'checkbox' },
    { name: 'acceptShort', label: 'Dispatch short (some lines not picked)', type: 'checkbox' }, { name: 'shortReason', label: 'Reason for short dispatch', wide: true },
  ];

  return <Section id="order" title={<>{o.orderNo} <span className={pill(s)}>{s}</span></>} right={<div className="flex flex-wrap gap-2">
    {o.tasks.length > 0 && <button onClick={() => printHtml(`Pick list ${o.orderNo}`, pickListHtml(o))} className={btnLight}>Print pick list</button>}
    {o.gatePassNo && <button onClick={() => printHtml(`Gate pass ${o.gatePassNo}`, gatePassHtml(o))} className={btnLight}>Print gate pass</button>}
    {me.manager && !['DISPATCHED', 'CANCELLED'].includes(s) && <button disabled={busy} onClick={cancel} className={btnRed}>Cancel order</button>}
    <button onClick={onClose} className={btnLight}>Close</button></div>}>
    <div className="mb-3 flex flex-wrap gap-1 text-xs">{STEPS.map(x => <span key={x} className={`rounded-full px-2 py-0.5 ${STEPS.indexOf(x) <= STEPS.indexOf(s) ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{x}</span>)}</div>
    <div className="grid gap-2 text-sm md:grid-cols-3">
      <div><b>{o.partnerName}</b> · {o.warehouseName}<div className="text-slate-500">Ref {o.customerRef || '-'} · required {day(o.requiredDate)}
        {o.minLifeDays != null && ` · customer needs ${o.minLifeDays} d life`}{o.crossDock && ' · cross-dock'}</div></div>
      <div>To <b>{o.consigneeName || '-'}</b>, {o.consigneeCity || ''}<div className="text-slate-500">{o.consigneeAddress || ''}</div></div>
      <div>Trip <b>{o.tripNumber || '-'}</b> {o.vehicleNumber ? `· ${o.vehicleNumber}` : ''} {o.dockCode ? `· dock ${o.dockCode}` : ''}
        {o.loadingCheckedAt && <div className="text-slate-500">Checked {when(o.loadingCheckedAt)} by {o.loadingCheckedBy}: {fmtTemp(o.truckTemperatureC)}, seal {o.sealNumber}</div>}
        {o.cancelledReason && <div className="text-red-700">Cancelled: {o.cancelledReason}</div>}</div>
    </div>

    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>#</th><th className={th}>Product</th><th className={th}>Temperature</th><th className={`${th} text-right`}>Ordered</th>
        <th className={`${th} text-right`}>Reserved</th><th className={`${th} text-right`}>Picked</th><th className={`${th} text-right`}>Loaded</th><th className={`${th} text-right`}>Short</th></tr></thead>
      <tbody>{o.lines.map((l: any) => <tr key={l.id} className="border-t"><td className={td}>{l.lineNo}</td>
        <td className={td}>{l.productName}<div className="text-xs text-slate-500">{l.productCode}{l.batchNo ? ` · batch ${l.batchNo}` : ''}{l.effectiveMinLifeDays ? ` · min ${l.effectiveMinLifeDays} d life` : l.minDispatchLifeDays ? ` · min ${l.minDispatchLifeDays} d life` : ''}</div>
          {l.batchReason && <div className="text-xs text-amber-700">Batch chosen: {l.batchReason}</div>}</td>
        <td className={td}>{l.temperatureProfileName || '-'}</td><td className={`${td} text-right`}>{qty(l.quantity, l.uom)}</td><td className={`${td} text-right`}>{num(l.reservedQty)}</td>
        <td className={`${td} text-right`}>{num(l.pickedQty)}</td><td className={`${td} text-right`}>{num(l.loadedQty)}</td>
        <td className={`${td} text-right ${Number(l.shortQty) > 0 ? 'font-bold text-red-700' : ''}`}>{num(l.shortQty)}</td></tr>)}</tbody></table></div>

    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between"><b>1. Reserve and pick</b>
          {canReserve && <button disabled={busy} onClick={() => void act('reserve')} className={btn}>Reserve stock</button>}</div>
        {canPick && <div className="mt-2"><div className="text-sm text-slate-600">Scan the bin, then the pallet{bin && <> (bin <b className="font-mono">{bin}</b>)</>}. A part pick makes a new pallet with its own label.</div>
          <ScanBox disabled={busy} placeholder="Scan bin or pallet" onScan={c => void pickScan(c)} /></div>}
        <div className="mt-2 overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-slate-600"><th className={th}>Bin</th><th className={th}>Pallet</th><th className={th}>Batch / expiry</th><th className={`${th} text-right`}>Pick</th><th className={th}>Picked as</th><th /></tr></thead>
          <tbody>{o.tasks.map((k: any) => <tr key={k.id} className={`border-t ${k.status === 'CANCELLED' ? 'line-through opacity-50' : ''}`}>
            <td className={`${td} font-mono`}>{k.binCode || (k.crossDock ? 'cross-dock' : '')}</td><td className={`${td} font-mono font-bold`}>{k.palletCode}{k.overrideReason && <div className="font-sans text-xs font-normal text-amber-700">{k.overrideReason}</div>}</td>
            <td className={td}>{k.batchNo}<div className="text-xs">{day(k.expiryDate)}</div></td><td className={`${td} text-right`}>{qty(k.quantity, k.uom)}</td>
            <td className={td}>{k.pickedPalletCode ? <><span className="font-mono">{k.pickedPalletCode}</span> <span className={pill(k.pickedPalletStatus)}>{k.pickedPalletStatus}</span>{k.pickedWeightKg ? <div className="text-xs">{num(k.pickedWeightKg)} kg</div> : null}</> : <span className={pill(k.status)}>{k.status}</span>}</td>
            <td className={td}>{k.status === 'OPEN' && <button disabled={busy} onClick={() => swap(k)} className={btnLight}>Other pallet</button>}</td>
          </tr>)}
            {o.tasks.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>Reserve stock to make the pick list.</td></tr>}</tbody></table></div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border p-3"><b>2. Stage at an outbound dock</b>
          {canStage ? <div className="mt-2 grid gap-2 md:grid-cols-[1fr_2fr]">
            <select value={dock} onChange={x => setDock(x.target.value)} className={input}><option value="">Dock</option>{(o.docks || []).map((d: any) => <option key={d.id} value={d.dockCode}>{d.dockCode} · {d.name}</option>)}</select>
            <ScanBox disabled={busy || !dock} placeholder="Scan picked pallet" onScan={c => void act('stage', { palletCode: c, dockCode: dock })} /></div>
            : <div className="text-sm text-slate-500">{o.dockCode ? `Staged at ${o.dockCode}.` : 'Pick first.'}</div>}
        </div>
        {canCrossDock && <div className="rounded-xl border p-3"><div className="flex items-center justify-between"><b>Cross-dock arrived pallets</b>
          <button disabled={busy} onClick={() => void findArrived()} className={btnLight}>Find arrived pallets</button></div>
          <div className="text-xs text-slate-500">Received pallets of this order's products go straight to the outbound dock, with no putaway.</div>
          {arrived && (arrived.length === 0 ? <div className="mt-1 text-sm text-slate-500">No received pallet of these products is waiting.</div> : <div className="mt-2">
            {arrived.map(p => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!xd[p.id]} onChange={x => setXd({ ...xd, [p.id]: x.target.checked })} />
              <span className="font-mono">{p.palletCode}</span> {p.productName} · {p.batchNo || '-'} · {qty(p.quantity, p.uom)} · exp {day(p.expiryDate)}</label>)}
            <div className="mt-2 flex gap-2"><select value={dock} onChange={x => setDock(x.target.value)} className={input}><option value="">Dock</option>{(o.docks || []).map((d: any) => <option key={d.id} value={d.dockCode}>{d.dockCode} · {d.name}</option>)}</select>
              <button disabled={busy || !dock || !Object.values(xd).some(Boolean)} className={btn} onClick={async () => {
                const r = await act('cross-dock', { dockCode: dock, palletIds: Object.entries(xd).filter(([, v]) => v).map(([k]) => Number(k)) });
                if (!r.failed) { setXd({}); void findArrived(); }
              }}>Cross-dock</button></div>
          </div>)}
        </div>}
        <div className="rounded-xl border p-3"><b>3. Trip and truck</b>
          {!['LOADED', 'DISPATCHED', 'CANCELLED'].includes(s) ? <div className="mt-2 flex gap-2">
            <select value={tripId} onChange={x => setTripId(x.target.value)} className={input}><option value="">Choose a planned trip</option>
              {trips.map(t => <option key={t.id} value={t.id}>{t.tripNumber} · {t.vehicleNumber || 'no truck'} · {t.sourceCity} to {t.destinationCity} · {when(t.plannedStartAt)}</option>)}</select>
            <button disabled={busy || !tripId} onClick={() => void act('trip', { tripId })} className={btn}>Link</button></div>
            : <div className="text-sm">{o.tripNumber} · {o.vehicleNumber} · {o.driverName || ''}</div>}
          <div className="mt-1 text-xs text-slate-500">The truck must be able to hold the temperature of every product on the order.</div>
        </div>
        <div className="rounded-xl border p-3"><b>4. Load</b>
          {canLoad ? <div className="mt-2"><ScanBox disabled={busy} placeholder="Scan pallet onto the truck" onScan={c => void act('load', { palletCode: c })} /></div>
            : <div className="text-sm text-slate-500">{o.tripId ? `${picked.filter((k: any) => ['LOADED', 'DISPATCHED'].includes(k.pickedPalletStatus)).length} of ${picked.length} pallets on the truck.` : 'Link a trip first.'}</div>}
        </div>
        <div className="rounded-xl border p-3"><b>5. Loading check and gate pass</b>
          {canCheck && <div className="mt-2"><QuickForm cols={3} fields={checkFields} busy={busy} submitText="Pass the loading check" onSubmit={loadingCheck} /></div>}
          {s === 'LOADED' && <button disabled={busy} onClick={() => void gatePass()} className={`${btn} mt-2`}>Issue and print gate pass</button>}
          {s === 'DISPATCHED' && <div className="mt-1 text-sm">Gate pass <b>{o.gatePassNo}</b> issued {when(o.gatePassAt)} by {o.gatePassBy}.</div>}
        </div>
      </div>
    </div>
  </Section>;
}
