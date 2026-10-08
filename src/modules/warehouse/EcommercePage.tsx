/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-021 -- e-commerce fulfilment. Marketplace and web-shop orders come in through the Open API
//   (POST /api/v1/ecom/orders, scope ecom:write) or are typed here. Pieces are picked in waves (first expiry first,
//   the most urgent orders first), packed at the pack station with a qualified cold box and coolant (REQ-CC-013),
//   the courier label and the tax invoice print, the parcel is scanned into the courier handover, and marketplace
//   returns are graded and restocked through the warehouse returns (REQ-WMS-013).
//
// Backend: EcomController (/api/warehouse/ecom/**), EcomOpenApiController (/api/v1/ecom/**), script 84.
import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, ScanBox, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, input, num, pill, printHtml, when, who } from './wms';
import { LinesEditor, StaffOnly, Table, Tabs, opts, post, usePartners, useProducts, useRunner, useWarehouses } from './wmsOps';
import { CAPACITY_SCRIPT, courierLabelHtml, invoiceHtml, matchScan, packTally } from './capacityKitEcom';

const GRADES: [string, string][] = [['SELLABLE', 'Sellable (restock)'], ['REPACK', 'Repack (hold)'], ['DAMAGED', 'Damaged'], ['DISPOSE', 'Dispose']];

export function EcommercePage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const [tab, setTab] = useState('orders');
  const [ready, setReady] = useState<boolean | null>(null);
  const [o, setO] = useState<any>({ channels: [], couriers: [], boxes: [], coolants: [] });
  const [status, setStatus] = useState('OPEN');
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [waves, setWaves] = useState<any[]>([]);
  const [wave, setWave] = useState<any>(null);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [ho, setHo] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const opt = await api('/api/warehouse/ecom/options');
      setReady(opt.ready !== false);
      if (opt.ready === false) return;
      setO(opt);
      const d = await api(`/api/warehouse/ecom/orders?status=${status}&q=${encodeURIComponent(q)}`); setOrders(d.orders || []);
      setWaves((await api('/api/warehouse/ecom/waves')).waves || []);
      setHandovers((await api('/api/warehouse/ecom/handovers')).handovers || []);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [status, q]);
  useEffect(() => { void load(); }, [load]);

  const openOrder = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/ecom/orders/${id}`)); if (d) setSel(d); };
  const openWave = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/ecom/waves/${id}`)); if (d) setWave(d); };
  const openHo = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/ecom/handovers/${id}`)); if (d) setHo(d); };
  const orderChanged = async (d: any) => { setSel(d); await load(); };
  const print = async (kind: 'label' | 'invoice') => {
    const d = await r.run(() => api(`/api/warehouse/ecom/orders/${sel.id}/documents`));
    if (d) printHtml(`${kind === 'label' ? 'Label' : 'Invoice'} ${sel.orderNo}`, kind === 'label' ? courierLabelHtml(d) : invoiceHtml(d));
  };
  if (!me.staff) return <StaffOnly title="E-commerce Fulfilment" />;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ShoppingCart className="h-8 w-8 text-sky-700" />E-commerce Fulfilment</h1>
    <p className="text-slate-600">Marketplace and web-shop orders: wave picking, the pack station with a cold box and coolant, courier label and invoice, handover scan, returns.</p>
    <Banner msg={r.msg} error={r.error} />
    {ready === false && <NotReady script={CAPACITY_SCRIPT} />}
    <Tabs value={tab} onChange={setTab} tabs={[['orders', 'Orders & packing'], ['new', 'New order'], ['waves', 'Waves & picking'], ['handover', 'Courier handover']]} />

    {tab === 'orders' && <>
      <Section title="Orders" right={<div className="flex gap-2">
        <input className={input} placeholder="Order, marketplace no., AWB, customer" value={q} onChange={e => setQ(e.target.value)} />
        <select className={input} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="OPEN">Open</option>{(o.statuses || []).map((s: string) => <option key={s} value={s}>{s}</option>)}<option value="">All</option></select></div>}>
        <Table rows={orders} selected={sel?.id} onRow={x => openOrder(x.id)} cols={[
          { key: 'orderNo', label: 'Order' }, { key: 'channel', label: 'Channel', render: x => `${x.channel} ${x.channelOrderRef}` }, { key: 'partnerName', label: 'Seller' },
          { key: 'customerName', label: 'Ship to', render: x => `${x.customerName} · ${x.shipCity || ''} ${x.shipPincode}` },
          { key: 'pieces', label: 'Pieces', right: true, render: x => `${num(x.piecesPicked)} / ${num(x.pieces)}` }, { key: 'shipBy', label: 'Ship by', render: x => when(x.shipBy) },
          { key: 'waveNo', label: 'Wave' }, { key: 'awbNo', label: 'AWB' }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
        ]} />
      </Section>
      {sel && <Section title={<>{sel.orderNo} · {sel.channel} {sel.channelOrderRef} <span className={pill(sel.status)}>{sel.status}</span></>} right={<div className="flex gap-2">
        {sel.invoiceNo && <><button className={btnLight} onClick={() => void print('label')}>Print courier label</button><button className={btnLight} onClick={() => void print('invoice')}>Print invoice</button></>}
        {['NEW', 'ALLOCATED', 'PICKED', 'PACKED'].includes(sel.status) && <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the order cancelled?'); if (reason) void r.run(() => post(`/api/warehouse/ecom/orders/${sel.id}/cancel`, { reason }), orderChanged); }}>Cancel</button>}
      </div>}>
        <div className="grid gap-1 text-sm md:grid-cols-3">
          <div>{sel.partnerName} · {sel.warehouseName} · {sel.source}</div>
          <div>{sel.customerName} · {sel.customerPhone || ''}<br />{sel.shipAddress}, {sel.shipCity} {sel.shipState} {sel.shipPincode}</div>
          <div>{sel.paymentMode}{sel.paymentMode === 'COD' ? ` ₹ ${num(sel.codAmount, 2)}` : ''} · value ₹ {num(sel.orderValue, 2)}<br />Ship by {when(sel.shipBy)}</div>
          <div>{sel.courier ? `${sel.courier} · AWB ${sel.awbNo}` : ''}</div><div>{sel.invoiceNo ? `Invoice ${sel.invoiceNo} · ${sel.invoiceDate}` : ''}</div>
          <div>{sel.handoverNo ? `Handover ${sel.handoverNo} · ${when(sel.handedOverAt)}` : sel.cancelledReason || ''}</div>
        </div>
        <div className="mt-3"><Table rows={sel.lines || []} cols={[
          { key: 'lineNo', label: '#' }, { key: 'productName', label: 'Product', render: x => `${x.productCode} · ${x.productName}` }, { key: 'sku', label: 'SKU' },
          { key: 'quantity', label: 'Ordered', right: true }, { key: 'allocatedQty', label: 'Allocated', right: true }, { key: 'pickedQty', label: 'Picked', right: true },
          { key: 'packedQty', label: 'Packed', right: true }, { key: 'returnedQty', label: 'Returned', right: true }, { key: 'unitPrice', label: 'Price', right: true, render: x => num(x.unitPrice, 2) },
        ]} /></div>
        {(sel.parcels || []).length > 0 && <div className="mt-3"><div className="font-semibold">Parcels</div><Table rows={sel.parcels} cols={[
          { key: 'parcelNo', label: 'Parcel' }, { key: 'boxName', label: 'Cold box' }, { key: 'coolantName', label: 'Coolant', render: x => x.coolantName ? `${x.coolantUnits} × ${x.coolantName}` : '-' },
          { key: 'weightKg', label: 'Kg', right: true }, { key: 'qualifiedUntil', label: 'Box holds until', render: x => when(x.qualifiedUntil) }, { key: 'packedByName', label: 'Packed by' }]} /></div>}
        {sel.status === 'PICKED' && <PackStation sel={sel} opt={o} r={r} onDone={orderChanged} />}
        {(sel.returns || []).length > 0 && <div className="mt-3"><div className="font-semibold">Returns</div><Table rows={sel.returns} cols={[
          { key: 'channelReturnRef', label: 'Marketplace return' }, { key: 'returnNo', label: 'Warehouse return' }, { key: 'grades', label: 'Grades' }, { key: 'reason', label: 'Reason' },
          { key: 'returnStatus', label: 'Status', render: x => <span className={pill(x.returnStatus)}>{x.returnStatus}</span> }]} /></div>}
        {['HANDED_OVER', 'RETURNED'].includes(sel.status) && <ReturnForm sel={sel} r={r} onDone={orderChanged} />}
      </Section>}
    </>}

    {tab === 'new' && <NewOrder opt={o} warehouses={warehouses} r={r} onDone={async (d: any) => { setTab('orders'); await orderChanged(d); }} />}

    {tab === 'waves' && <>
      <Section title="Release a wave">
        <p className="mb-2 text-sm text-slate-600">Takes the waiting (NEW) orders of the warehouse, most urgent first, that can be picked in full; at most {o.waveMax} orders.</p>
        <QuickForm cols={3} busy={r.busy} submitText="Release wave" fields={[
          { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), required: true }, { name: 'maxOrders', label: 'Most orders', type: 'number' }]}
          onSubmit={v => r.run(() => post('/api/warehouse/ecom/waves', v), async (d: any) => { setWave(d); await load(); })} />
      </Section>
      <Section title="Waves"><Table rows={waves} selected={wave?.id} onRow={x => openWave(x.id)} cols={[
        { key: 'waveNo', label: 'Wave' }, { key: 'warehouseName', label: 'Warehouse' }, { key: 'orders', label: 'Orders', right: true },
        { key: 'openPicks', label: 'Picks open', right: true, render: x => `${x.openPicks} / ${x.picks}` }, { key: 'createdAt', label: 'Released', render: x => when(x.createdAt) },
        { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> }]} /></Section>
      {wave && <Section title={<>{wave.waveNo} · pick list <span className={pill(wave.status)}>{wave.status}</span></>}>
        {(wave.waiting || []).length > 0 && <div className="mb-2 text-sm text-amber-700">Waiting: {wave.waiting.map((w: any) => `${w.orderNo} (${w.reason})`).join('; ')}</div>}
        <Table rows={wave.picks || []} cols={[
          { key: 'binCode', label: 'Bin' }, { key: 'palletCode', label: 'Pallet' }, { key: 'productName', label: 'Product', render: x => `${x.productCode} · ${x.productName}` },
          { key: 'batchNo', label: 'Batch' }, { key: 'orderNo', label: 'Order' }, { key: 'quantity', label: 'Pieces', right: true }, { key: 'pickedQty', label: 'Picked', right: true },
          { key: 'status', label: 'Status', render: x => x.status === 'OPEN' ? <span className="flex gap-1">
            <button className={btnLight} disabled={r.busy} onClick={() => { const code = window.prompt(`Scan pallet ${x.palletCode}`, ''); if (code) void r.run(() => post(`/api/warehouse/ecom/waves/${wave.id}/pick`, { pickId: x.id, palletCode: code, quantity: x.quantity }), async (d: any) => { setWave(d); await load(); }); }}>Pick</button>
            <button className={btnLight} disabled={r.busy} onClick={() => { const n = window.prompt('Pieces found (short pick)', '0'); if (n !== null) void r.run(() => post(`/api/warehouse/ecom/waves/${wave.id}/pick`, { pickId: x.id, palletCode: x.palletCode, quantity: n }), async (d: any) => { setWave(d); await load(); }); }}>Short</button>
          </span> : <span className={pill(x.status)}>{x.status}</span> }]} />
      </Section>}
    </>}

    {tab === 'handover' && <>
      <Section title="Open a handover">
        <QuickForm cols={3} busy={r.busy} submitText="Open" fields={[
          { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), required: true },
          { name: 'courier', label: 'Courier', type: 'select', options: (o.couriers || []).map((c: string) => [c, c]), required: true }]}
          onSubmit={v => r.run(() => post('/api/warehouse/ecom/handovers', v), async (d: any) => { setHo(d); await load(); })} />
      </Section>
      <Section title="Handovers"><Table rows={handovers} selected={ho?.id} onRow={x => openHo(x.id)} cols={[
        { key: 'handoverNo', label: 'Handover' }, { key: 'courier', label: 'Courier' }, { key: 'warehouseName', label: 'Warehouse' }, { key: 'parcels', label: 'Orders', right: true },
        { key: 'riderName', label: 'Rider' }, { key: 'createdAt', label: 'Opened', render: x => when(x.createdAt) }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> }]} /></Section>
      {ho && <Section title={<>{ho.handoverNo} · {ho.courier} <span className={pill(ho.status)}>{ho.status}</span></>} right={<button className={btnLight} onClick={() => printHtml(`Manifest ${ho.handoverNo}`, manifestHtml(ho))}>Print manifest</button>}>
        {ho.status === 'OPEN' && <div className="mb-3 grid gap-3 md:grid-cols-2">
          <ScanBox autoFocus disabled={r.busy} placeholder="Scan the waybill on each parcel" onScan={code => void r.run(() => post(`/api/warehouse/ecom/handovers/${ho.id}/scan`, { code }), async (d: any) => { setHo(d); await load(); })} />
          <QuickForm cols={3} busy={r.busy} submitText="Close and hand over" fields={[{ name: 'riderName', label: 'Rider', required: true }, { name: 'vehicleNumber', label: 'Vehicle' }]}
            onSubmit={v => r.run(() => post(`/api/warehouse/ecom/handovers/${ho.id}/close`, v), async (d: any) => { setHo(d); await load(); })} />
        </div>}
        <Table rows={ho.orders || []} empty="No parcels scanned yet." cols={[
          { key: 'awbNo', label: 'AWB' }, { key: 'orderNo', label: 'Order' }, { key: 'channel', label: 'Channel', render: x => `${x.channel} ${x.channelOrderRef}` },
          { key: 'customerName', label: 'Ship to', render: x => `${x.customerName} · ${x.shipCity || ''} ${x.shipPincode}` }, { key: 'parcels', label: 'Parcels', right: true },
          { key: 'weightKg', label: 'Kg', right: true }, { key: 'codAmount', label: 'COD', right: true, render: x => x.paymentMode === 'COD' ? num(x.codAmount, 2) : '-' },
          { key: 'handedOverAt', label: 'Scanned', render: x => when(x.handedOverAt) }]} />
      </Section>}
    </>}
  </>;
}

function PackStation({ sel, opt, r, onDone }: any) {
  const [scans, setScans] = useState<Record<string, number>>({});
  const [bad, setBad] = useState('');
  const lines = (sel.lines || []).filter((l: any) => Number(l.pickedQty) > 0).map((l: any) => ({ ...l, pickedQty: Number(l.pickedQty) }));
  const tally = packTally(lines, scans);
  const scan = (code: string) => {
    const pc = matchScan(lines, code);
    if (!pc) { setBad(`${code} is not on this order`); return; }
    setBad(''); setScans({ ...scans, [pc]: (scans[pc] || 0) + 1 });
  };
  return <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-1 font-semibold">Pack station</div>
    <div className="grid gap-3 md:grid-cols-2">
      <div><ScanBox autoFocus placeholder="Scan each piece (barcode, SKU or product code)" onScan={scan} />
        {bad && <div className="mt-1 font-semibold text-red-700">{bad}</div>}
        <table className="mt-2 w-full text-sm"><tbody>{tally.rows.map(x => <tr key={x.productCode} className="border-t">
          <td className="py-1">{x.productCode} · {x.productName}</td><td className="text-right">{x.scanned} / {x.picked}</td>
          <td className={`text-right font-bold ${x.left === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{x.left === 0 ? 'OK' : `${x.left} left`}</td></tr>)}</tbody></table>
        <button type="button" className={`${btnLight} mt-2`} onClick={() => setScans({})}>Clear scans</button></div>
      <QuickForm cols={2} busy={r.busy} submitText={tally.done ? 'Pack and make invoice' : 'Pack (scans do not match yet)'} initial={{ courier: sel.courier || '', transitHours: sel.transitHours ?? '' }} fields={[
        { name: 'boxTypeId', label: 'Cold box', type: 'select', options: (opt.boxes || []).map((b: any) => [String(b.id), `${b.name}${b.qualifiedHours ? ` (${b.qualifiedHours} h)` : ''}`]) },
        { name: 'coolantTypeId', label: 'Coolant', type: 'select', options: (opt.coolants || []).map((c: any) => [String(c.id), `${c.name} (${c.kind})`]) },
        { name: 'coolantUnits', label: 'Coolant units', type: 'number' }, { name: 'weightKg', label: 'Parcel kg', type: 'number' },
        { name: 'courier', label: 'Courier', type: 'select', options: (opt.couriers || []).map((c: string) => [c, c]), required: true },
        { name: 'awbNo', label: 'Waybill (AWB; empty: parcel no.)' }, { name: 'transitHours', label: `Transit hours (default ${opt.defaultTransitHours})`, type: 'number' }]}
        onSubmit={v => r.run(() => post(`/api/warehouse/ecom/orders/${sel.id}/pack`, { ...v, scans: Object.entries(scans).map(([code, quantity]) => ({ code, quantity })) }), onDone)} />
    </div>
  </div>;
}

function ReturnForm({ sel, r, onDone }: any) {
  const [rows, setRows] = useState<Record<number, { quantity: string; grade: string; note: string }>>({});
  const set = (id: number, k: string, v: string) => setRows({ ...rows, [id]: { ...(rows[id] || { quantity: '', grade: 'SELLABLE', note: '' }), [k]: v } });
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const lines = (sel.lines || []).filter((l: any) => Number(l.packedQty) > Number(l.returnedQty));
  if (!lines.length) return null;
  return <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-1 font-semibold">Marketplace return: grade the pieces</div>
    <table className="w-full text-sm"><tbody>{lines.map((l: any) => <tr key={l.id} className="border-t">
      <td className="py-1">{l.productCode} · {l.productName} <span className="text-slate-500">({num(Number(l.packedQty) - Number(l.returnedQty))} can come back)</span></td>
      <td><input className={input} type="number" placeholder="Pieces" value={rows[l.id]?.quantity || ''} onChange={e => set(l.id, 'quantity', e.target.value)} /></td>
      <td><select className={input} value={rows[l.id]?.grade || 'SELLABLE'} onChange={e => set(l.id, 'grade', e.target.value)}>{GRADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td>
      <td><input className={input} placeholder="Note" value={rows[l.id]?.note || ''} onChange={e => set(l.id, 'note', e.target.value)} /></td></tr>)}</tbody></table>
    <div className="mt-2 flex flex-wrap gap-2"><input className={`${input} max-w-xs`} placeholder="Marketplace return no." value={ref} onChange={e => setRef(e.target.value)} />
      <input className={`${input} max-w-md`} placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} />
      <button className={btn} disabled={r.busy} onClick={() => void r.run(() => post(`/api/warehouse/ecom/orders/${sel.id}/returns`, {
        channelReturnRef: ref || undefined, reason: reason || undefined,
        lines: Object.entries(rows).filter(([, x]) => Number(x.quantity) > 0).map(([lineId, x]) => ({ lineId: Number(lineId), quantity: x.quantity, grade: x.grade, note: x.note || undefined })),
      }), async (d: any) => { setRows({}); await onDone(d); })}>Receive return</button></div>
    <p className="mt-1 text-xs text-slate-600">Sellable pieces are restocked when a Manager receives them; otherwise they wait on hold in Returns & Disposal.</p>
  </div>;
}

function NewOrder({ opt, warehouses, r, onDone }: any) {
  const partners = usePartners();
  const [partnerId, setPartnerId] = useState('');
  const products = useProducts(partnerId);
  const [lines, setLines] = useState<any[]>([{ gstRate: 5 }]);
  return <Section title="Type an order (marketplaces send theirs through the Open API)">
    <select className={`${input} mb-2 max-w-sm`} value={partnerId} onChange={e => setPartnerId(e.target.value)}>
      <option value="">Seller (partner)…</option>{partners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    {partnerId && <LinesEditor lines={lines} setLines={setLines} products={products} fields={[
      { key: 'quantity', label: 'Pieces', kind: 'number' }, { key: 'unitPrice', label: 'Price incl. GST', kind: 'number' }, { key: 'gstRate', label: 'GST %', kind: 'number' }, { key: 'sku', label: 'Marketplace SKU' }]} />}
    <div className="mt-3"><QuickForm cols={4} busy={r.busy} submitText="Take the order" fields={[
      { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), required: true },
      { name: 'channel', label: 'Channel', type: 'select', options: (opt.channels || []).map((c: string) => [c, c]), required: true },
      { name: 'channelOrderRef', label: 'Marketplace order no.', required: true }, { name: 'shipBy', label: 'Ship by', placeholder: 'yyyy-mm-ddThh:mm' },
      { name: 'customerName', label: 'Customer', required: true }, { name: 'customerPhone', label: 'Phone' },
      { name: 'shipAddress', label: 'Address', required: true, wide: true }, { name: 'shipCity', label: 'City' }, { name: 'shipState', label: 'State' },
      { name: 'shipPincode', label: 'PIN code', required: true }, { name: 'paymentMode', label: 'Payment', type: 'select', options: [['PREPAID', 'Prepaid'], ['COD', 'Cash on delivery']], required: true },
      { name: 'codAmount', label: 'Cash to collect', type: 'number' }, { name: 'transitHours', label: 'Transit hours', type: 'number' }, { name: 'notes', label: 'Notes', wide: true }]}
      onSubmit={(v, f) => r.run(() => post('/api/warehouse/ecom/orders', { ...v, partnerId, lines: lines.filter(l => l.productId) }), async (d: any) => { f.reset(); setLines([{ gstRate: 5 }]); await onDone(d); })} /></div>
  </Section>;
}

function manifestHtml(h: any) {
  const esc = (v: unknown) => String(v ?? '-').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const rows = (h.orders || []).map((x: any, i: number) => `<tr><td>${i + 1}</td><td>${esc(x.awbNo)}</td><td>${esc(x.orderNo)}</td><td>${esc(x.customerName)}, ${esc(x.shipCity)} ${esc(x.shipPincode)}</td><td>${esc(x.parcels)}</td><td>${esc(x.weightKg)}</td><td>${x.paymentMode === 'COD' ? esc(x.codAmount) : '-'}</td></tr>`).join('');
  return `<div class="doc"><h1>Courier manifest ${esc(h.handoverNo)}</h1><div>${esc(h.courier)} · ${esc(h.warehouseName)} · ${(h.orders || []).length} order(s)</div>
    <table><tr><th>#</th><th>AWB</th><th>Order</th><th>Ship to</th><th>Parcels</th><th>Kg</th><th>COD</th></tr>${rows}</table>
    <div class="sign"><div>Handed over by</div><div>Rider ${esc(h.riderName === null ? '' : h.riderName)} ${esc(h.vehicleNumber === null ? '' : h.vehicleNumber)}</div></div></div>`;
}
